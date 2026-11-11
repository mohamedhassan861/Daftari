/* Shared ledgers: encryption key, merge and upload. (part 1 of 3) */
  async function ledKey(m) {
    if (!ledKeys.has(m.key))
      ledKeys.set(
        m.key,
        await crypto.subtle.importKey('raw', fromB64u(m.key), 'AES-GCM', false, ['encrypt', 'decrypt'])
      );
    return ledKeys.get(m.key);
  }
  const colsOf = D => [
    ...SH_COLS.map(k => [k, D[k] || []]),
    ['cx', (D.cats || {}).expense || []],
    ['ci', (D.cats || {}).income || []]
  ];
  const strip = r => {
    const o = Object.assign({}, r);
    delete o.u;
    return JSON.stringify(o);
  };
  const setOf = D => {
    const o = {};
    SETK.forEach(k => (o[k] = D[k]));
    return o;
  };
  function snapshot(D) {
    const m = {};
    colsOf(D).forEach(([k, a]) => {
      m[k] = {};
      a.forEach(r => (m[k][r.id] = strip(r)));
    });
    m._set = JSON.stringify(setOf(D));
    m._bud = JSON.stringify(D.budgets || {});
    return m;
  }
  /* mark what changed since the last snapshot: new/edited records get a time, removed ones a tombstone */
  function stamp(D) {
    const now = Date.now();
    D._del = D._del || {};
    colsOf(D).forEach(([k, arr]) => {
      const old = shadow[k] || {},
        ids = new Set();
      arr.forEach(r => {
        ids.add(r.id);
        if (old[r.id] !== strip(r)) {
          r.u = now;
          if (k === 'tx' && !r.by && drv.email) r.by = drv.email;
        }
      });
      Object.keys(old).forEach(id => {
        if (!ids.has(id)) D._del[id] = now;
      });
    });
    if (JSON.stringify(setOf(D)) !== shadow._set) D._su = now;
    if (JSON.stringify(D.budgets || {}) !== shadow._bud) D._bu = now;
    shadow = snapshot(D);
  }
  /* newest version of each record wins; a deletion wins over older edits */
  function mergeLedger(A, B) {
    const R = Object.assign({}, A),
      del = Object.assign({}, A._del || {});
    Object.entries(B._del || {}).forEach(([id, ts]) => {
      if (!(del[id] >= ts)) del[id] = ts;
    });
    R._del = del;
    const pick = (la, lb) => {
      const m = new Map();
      [...(la || []), ...(lb || [])].forEach(r => {
        const c = m.get(r.id);
        if (!c || (r.u || 0) > (c.u || 0)) m.set(r.id, r);
      });
      return [...m.values()].filter(r => !(del[r.id] >= (r.u || 0)));
    };
    SH_COLS.forEach(k => (R[k] = pick(A[k], B[k])));
    R.cats = {
      expense: pick((A.cats || {}).expense, (B.cats || {}).expense),
      income: pick((A.cats || {}).income, (B.cats || {}).income)
    };
    if ((B._su || 0) > (A._su || 0)) {
      SETK.forEach(k => (R[k] = B[k]));
      R._su = B._su;
    }
    if ((B._bu || 0) > (A._bu || 0)) {
      R.budgets = B.budgets;
      R._bu = B._bu;
    }
    return R;
  }
  const stripLocal = D => {
    const o = Object.assign({}, D);
    LOCALK.forEach(k => delete o[k]);
    return o;
  };
  function prepShared(D) {
    D.lang = (PS && PS.lang) || LANG;
    D.sample = false;
    D.cats = D.cats || mkCats();
    ['tx', 'accounts', 'inst', 'gam', 'loans', 'recur', 'goals', 'settles'].forEach(k => {
      if (!Array.isArray(D[k])) D[k] = [];
    });
    if (!D.budgets) D.budgets = {};
    return D;
  }
  async function cacheSave(m, D) {
    try {
      localStorage.setItem('daftari-led-' + m.id, JSON.stringify(await seal(KEYOBJ, D)));
    } catch (e) {}
  }
  async function cacheLoad(m) {
    try {
      const o = JSON.parse(localStorage.getItem('daftari-led-' + m.id) || 'null');
      return o ? await unseal(KEYOBJ, o.iv, o.ct) : null;
    } catch (e) {
      return null;
    }
  }
  async function shDownload(m) {
    const j = await (await gfetch('/drive/v3/files/' + m.fileId + '?alt=media')).json();
    if (j.app !== 'daftari-shared') throw new Error('bad');
    return await unseal(await ledKey(m), j.iv, j.ct);
  }
  async function shBody(m, D) {
    return JSON.stringify(Object.assign({app: 'daftari-shared', v: 1}, await seal(await ledKey(m), stripLocal(D))));
  }
  async function shUpload(m, D) {
    await gfetch(GAPI + '/upload/drive/v3/files/' + m.fileId + '?uploadType=media', {
      method: 'PATCH',
      headers: {'Content-Type': 'application/json'},
      body: await shBody(m, D)
    });
  }
  async function shMeta(m) {
    return await (
      await gfetch(
        '/drive/v3/files/' + m.fileId + '?fields=modifiedTime,trashed,capabilities(canEdit),owners(emailAddress)'
      )
    ).json();
  }
  async function needAccess() {
    if (await ensureAccess()) return true;
    drv.needAuth = true;
    render();
    return false;
  }
  async function shPull(force) {
    if (ACT === 'me' || !SHM || shBusy) return;
    if (!(await needAccess())) return;
    const m = SHM;
    shBusy = true;
    try {
      const info = await shMeta(m);
      m.role = info.capabilities && info.capabilities.canEdit ? 'writer' : 'reader';
      m.ownerEmail = ((info.owners && info.owners[0]) || {}).emailAddress || m.ownerEmail;
      if (!force && info.modifiedTime === m.mod && !shDirty) return;
      const R = await shDownload(m);
      if (ACT !== m.id) return;
      S = prepShared(S ? mergeLedger(S, R) : R);
      shadow = snapshot(S);
      m.mod = info.modifiedTime;
      m.name = S.name || m.name;
      await cacheSave(m, S);
      vaultSave(PS);
      render();
      if (shDirty) shPush();
    } catch (e) {
      if (String(e.message).includes('404')) toast(t('ledgerGone'));
    } finally {
      shBusy = false;
    }
  }
  function sharedSave() {
    if (SHM.role === 'reader') {
      toast(t('readOnly'));
      cacheLoad(SHM).then(D => {
        if (D && ACT === SHM.id) {
          S = prepShared(D);
          render();
        }
      });
      return;
    }
    stamp(S);
    shDirty = true;
    cacheSave(SHM, JSON.parse(JSON.stringify(S)));
    clearTimeout(shTimer);
    shTimer = setTimeout(shPush, 1500);
  }
  async function shPush() {
    if (ACT === 'me' || !SHM || !shDirty) return;
    if (shBusy) {
      clearTimeout(shTimer);
      shTimer = setTimeout(shPush, 1500);
      return;
    }
    if (!(await needAccess())) return;
    const m = SHM;
    shBusy = true;
    try {
      const R = await shDownload(m);
      if (ACT !== m.id) return;
      S = prepShared(mergeLedger(S, R));
      shadow = snapshot(S);
      await shUpload(m, S);
      shDirty = false;
      m.mod = (await shMeta(m)).modifiedTime;
      await cacheSave(m, S);
      render();
    } catch (e) {
      toast(t('shareSyncFail'));
    } finally {
      shBusy = false;
    }
  }
  function startPoll() {
    stopPoll();
    shPoll = setInterval(() => {
      if (!document.hidden) shPull(false);
    }, 30000);
  }
  function stopPoll() {
    if (shPoll) clearInterval(shPoll);
    shPoll = null;
  }
  async function switchLedger(id) {
    closeSheet();
    if (id === ACT) return;
    if (ACT !== 'me' && shDirty) {
      clearTimeout(shTimer);
      await shPush();
    }
    if (id === 'me') {
      ACT = 'me';
      SHM = null;
      S = PS;
      stopPoll();
      cur = TODAY_YM;
      render();
      return;
    }
    const m = PS.ledgers.find(l => l.id === id);
    if (!m) return;
    ACT = id;
    SHM = m;
    shDirty = false;
    const D = await cacheLoad(m);
    S = prepShared(D || Object.assign(blank(), {name: m.name}));
    shadow = D ? snapshot(S) : {};
    render();
    toast(t('nowIn') + ' ' + m.name);
    await shPull(true);
    startPoll();
    runRecurring();
  }
  async function shCreateFile(m, D) {
    const folder = await ensureFolder(),
      bd = 'sh' + uid(),
      meta = JSON.stringify({name: 'Daftari - ' + m.name + '.dft', parents: [folder], mimeType: 'application/json'});
    const body =
      '--' +
      bd +
      '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      meta +
      '\r\n--' +
      bd +
      '\r\nContent-Type: application/json\r\n\r\n' +
      (await shBody(m, D)) +
      '\r\n--' +
      bd +
      '--';
    return (
      await (
        await gfetch(GAPI + '/upload/drive/v3/files?uploadType=multipart&fields=id', {
          method: 'POST',
          headers: {'Content-Type': 'multipart/related; boundary=' + bd},
          body
        })
      ).json()
    ).id;
  }
