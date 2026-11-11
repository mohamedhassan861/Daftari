/* Google Drive: sign-in tokens, upload, and the monthly summary file. (part 1 of 2) */
  const drvSave = () => {
    try {
      localStorage.setItem(
        DRV_KEY,
        JSON.stringify({linked: drv.linked, folderId: drv.folderId, lastUp: drv.lastUp, email: drv.email})
      );
    } catch (e) {}
  };
  const keepToken = () => {
    try {
      gToken ? localStorage.setItem(TOK_KEY, JSON.stringify({t: gToken, exp: gExp})) : localStorage.removeItem(TOK_KEY);
    } catch (e) {}
  };
  const driveConfigured = () => !!CFG.googleClientId;
  const driveReady = () => driveConfigured() && !!(window.google && google.accounts && google.accounts.oauth2);
  const hasToken = () => !!gToken && Date.now() < gExp;
  const useWorker = () => !!CFG.authWorker;
  async function saveRT() {
    if (!KEYOBJ) return;
    try {
      if (RT) {
        localStorage.setItem(RT_KEY, JSON.stringify(await seal(KEYOBJ, {rt: RT})));
      } else localStorage.removeItem(RT_KEY);
    } catch (e) {}
  }
  async function loadRT() {
    RT = null;
    try {
      const o = JSON.parse(localStorage.getItem(RT_KEY) || 'null');
      if (o && KEYOBJ) RT = (await unseal(KEYOBJ, o.iv, o.ct)).rt || null;
    } catch (e) {}
  }
  function setAccess(j) {
    gToken = j.access_token;
    gExp = Date.now() + ((+j.expires_in || 3600) - 120) * 1000;
    keepToken();
    drv.needAuth = false;
  }
  async function workerCall(path, body) {
    const r = await fetch(CFG.authWorker.replace(/\/+$/, '') + path, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) {
      const e = new Error(j.error || 'http ' + r.status);
      e.code = j.error;
      throw e;
    }
    return j;
  }
  async function ensureAccess() {
    if (hasToken()) return true;
    if (useWorker() && RT) {
      try {
        setAccess(await workerCall('/refresh', {refresh_token: RT}));
        return true;
      } catch (e) {
        if (e.code === 'invalid_grant') {
          RT = null;
          await saveRT();
        }
        return false;
      }
    }
    return false;
  }
  function requestCode(selectAccount, withId, hint) {
    goingOut();
    return new Promise((res, rej) => {
      if (!driveReady()) {
        rej(new Error('notready'));
        return;
      }
      const cfg = {
        client_id: CFG.googleClientId,
        scope: withId ? SCOPE + ' openid email profile' : SCOPE,
        ux_mode: 'popup',
        callback: r => {
          r && r.code ? res(r.code) : rej(r);
        },
        error_callback: e => rej(e)
      };
      if (selectAccount) cfg.select_account = true;
      else {
        const h = hint || drv.email || (REG && REG.email);
        if (h) cfg.login_hint = h;
      }
      google.accounts.oauth2.initCodeClient(cfg).requestCode();
    });
  }
  /* interactive: must run from a tap */
  async function authorize(selectAccount) {
    if (!useWorker()) {
      await requestToken(selectAccount ? 'select_account consent' : 'consent');
      return;
    }
    const j = await workerCall('/exchange', {code: await requestCode(selectAccount)});
    setAccess(j);
    if (j.refresh_token) {
      RT = j.refresh_token;
      await saveRT();
      return;
    }
    /* Google skipped the long-lived grant because an older one exists: clear it so the next tap gets a fresh one */
    try {
      google.accounts.oauth2.revoke(gToken, () => {});
    } catch (e) {}
    gToken = null;
    keepToken();
    toast(t('driveAgain'));
    throw new Error('again');
  }
  function revokeAll() {
    try {
      if (driveReady()) {
        if (RT) google.accounts.oauth2.revoke(RT, () => {});
        else if (gToken) google.accounts.oauth2.revoke(gToken, () => {});
      }
    } catch (e) {}
  }
  function requestToken(prompt) {
    goingOut();
    return new Promise((res, rej) => {
      if (!driveReady()) {
        rej(new Error('notready'));
        return;
      }
      if (!gClient)
        gClient = google.accounts.oauth2.initTokenClient({
          client_id: CFG.googleClientId,
          scope: 'https://www.googleapis.com/auth/drive.file',
          callback: () => {}
        });
      gClient.callback = r => {
        if (r && r.access_token) {
          gToken = r.access_token;
          gExp = Date.now() + ((+r.expires_in || 3600) - 120) * 1000;
          keepToken();
          drv.needAuth = false;
          res(gToken);
        } else rej(r);
      };
      gClient.error_callback = e => rej(e);
      const o = {prompt};
      if (drv.email) o.login_hint = drv.email;
      gClient.requestAccessToken(o);
    });
  }
  async function gfetch(path, opt) {
    opt = opt || {};
    opt.headers = Object.assign({Authorization: 'Bearer ' + gToken}, opt.headers || {});
    const r = await fetch(path.startsWith('http') ? path : GAPI + path, opt);
    if (r.status === 401 || (r.status === 403 && !gToken)) {
      gToken = null;
      keepToken();
      throw new Error('auth');
    }
    if (r.status === 401) {
      gToken = null;
      keepToken();
      throw new Error('auth');
    }
    if (!r.ok) throw new Error('http ' + r.status);
    return r;
  }
  async function ensureFolder() {
    if (drv.folderId) {
      try {
        const j = await (await gfetch('/drive/v3/files/' + drv.folderId + '?fields=id,trashed')).json();
        if (!j.trashed) return drv.folderId;
      } catch (e) {
        if (e.message === 'auth') throw e;
      }
    }
    const q = encodeURIComponent("name='Daftari' and mimeType='application/vnd.google-apps.folder' and trashed=false");
    const j = await (await gfetch('/drive/v3/files?q=' + q + '&fields=files(id)&spaces=drive')).json();
    if (j.files && j.files.length) drv.folderId = j.files[0].id;
    else {
      const c = await (
        await gfetch('/drive/v3/files?fields=id', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({name: 'Daftari', mimeType: 'application/vnd.google-apps.folder'})
        })
      ).json();
      drv.folderId = c.id;
    }
    drvSave();
    return drv.folderId;
  }
  async function driveList(folder, n) {
    const q = encodeURIComponent("'" + folder + "' in parents and trashed=false");
    const j = await (
      await gfetch(
        '/drive/v3/files?q=' +
          q +
          '&orderBy=' +
          encodeURIComponent('createdTime desc') +
          '&pageSize=' +
          n +
          '&fields=' +
          encodeURIComponent('files(id,name,createdTime)') +
          '&spaces=drive'
      )
    ).json();
    return j.files || [];
  }
  async function pruneOld(folder) {
    const all = (await driveList(folder, DKEEP + 50)).filter(f => !isSysFile(f.name));
    for (const f of all.slice(DKEEP)) {
      await gfetch('/drive/v3/files/' + f.id, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({trashed: true})
      });
    }
  }
  async function saveMonthSummary(m, manual) {
    if (!drv.linked) {
      if (manual) toast(t('driveOff'));
      return;
    }
    try {
      if (!(await ensureAccess())) {
        if (manual) toast(t('driveErr'));
        return;
      }
      const html = docHTML(monthSummary(m)),
        folder = await ensureFolder(),
        bd = 'ms' + uid(),
        name = 'summary_' + m + '.html';
      const old = (await driveList(folder, DKEEP + 60)).filter(f => f.name === name);
      for (const f of old)
        await gfetch('/drive/v3/files/' + f.id, {
          method: 'PATCH',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({trashed: true})
        });
      const meta = JSON.stringify({name, parents: [folder], mimeType: 'text/html'});
      const body =
        '--' +
        bd +
        '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
        meta +
        '\r\n--' +
        bd +
        '\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n' +
        html +
        '\r\n--' +
        bd +
        '--';
      await gfetch(GAPI + '/upload/drive/v3/files?uploadType=multipart&fields=id', {
        method: 'POST',
        headers: {'Content-Type': 'multipart/related; boundary=' + bd},
        body
      });
      toast(t('msSaved'));
    } catch (e) {
      if (manual) toast(t('driveErr'));
    }
  }
