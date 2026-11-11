/* Google Drive: sign-in tokens, upload, and the monthly summary file. (part 2 of 2; continues from drive-1.js) */
  async function driveUpload() {
    if (!drv.email) {
      try {
        const a = await (await gfetch('/drive/v3/about?fields=user(emailAddress)')).json();
        drv.email = (a.user && a.user.emailAddress) || '';
        drvSave();
      } catch (x) {
        if (x.message === 'auth') throw x;
      }
    }
    const data = await makeBackup(),
      folder = await ensureFolder(),
      bd = 'pl' + uid();
    const meta = JSON.stringify({name: backupName(), parents: [folder], mimeType: 'application/json'});
    const body =
      '--' +
      bd +
      '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      meta +
      '\r\n--' +
      bd +
      '\r\nContent-Type: application/json\r\n\r\n' +
      data +
      '\r\n--' +
      bd +
      '--';
    await gfetch(GAPI + '/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: {'Content-Type': 'multipart/related; boundary=' + bd},
      body
    });
    drv.lastUp = new Date().toISOString();
    drvSave();
    markBackup();
  }
  async function syncDrive(manual) {
    if (!drv.linked || !S || !KEYOBJ || drv.busy) return;
    drv.busy = true;
    if (!(await ensureAccess())) {
      drv.busy = false;
      drv.needAuth = true;
      render();
      return;
    }
    try {
      await driveUpload();
      drv.needAuth = false;
      if (manual) toast(t('driveSaved'));
    } catch (e) {
      if (e.message === 'auth' && (await ensureAccess())) {
        try {
          await driveUpload();
          if (manual) toast(t('driveSaved'));
        } catch (x) {
          drv.needAuth = x.message === 'auth';
          if (manual && !drv.needAuth) toast(t('driveErr'));
        }
      } else if (e.message === 'auth') {
        drv.needAuth = true;
      } else if (manual) toast(t('driveErr'));
    } finally {
      drv.busy = false;
      if (tab === 'set' || drv.needAuth) render();
    }
  }
  function scheduleDrive() {
    if (!drv.linked || ACT !== 'me') return;
    clearTimeout(drvTimer);
    drvTimer = setTimeout(() => syncDrive(false), 5000);
  }
  async function driveConnect() {
    if (!driveReady()) {
      toast(driveConfigured() ? t('loading') : t('driveNotSetup'));
      return;
    }
    try {
      await authorize(false);
      try {
        const a = await (await gfetch('/drive/v3/about?fields=user(emailAddress)')).json();
        drv.email = (a.user && a.user.emailAddress) || '';
      } catch (x) {}
      await ensureFolder();
      drv.linked = true;
      drvSave();
      await syncDrive(true);
      recSetup(true);
    } catch (e) {}
    render();
  }
  async function fetchDriveEmail() {
    try {
      const a = await (await gfetch('/drive/v3/about?fields=user(emailAddress)')).json();
      drv.email = (a.user && a.user.emailAddress) || '';
      drvSave();
      return drv.email;
    } catch (e) {
      return '';
    }
  }
  async function driveSwitch() {
    if (!driveReady()) return;
    try {
      revokeAll();
      RT = null;
      await saveRT();
      gToken = null;
      keepToken();
      drv.email = '';
      drv.folderId = null;
      drv.lastUp = null;
      drvSave();
      await authorize(true);
      await fetchDriveEmail();
      await ensureFolder();
      drv.linked = true;
      drvSave();
      await syncDrive(true);
    } catch (e) {}
    render();
  }
  async function driveResume() {
    try {
      if (useWorker() && !RT) await authorize(false);
      else if (!(await ensureAccess())) {
        if (useWorker()) await authorize(false);
        else await requestToken('');
      }
      drv.needAuth = false;
      await syncDrive(true);
    } catch (e) {}
    render();
  }
  function driveUnlink() {
    confirmSheet(t('driveUnlink') + '?', t('driveUnlink'), () => {
      revokeAll();
      RT = null;
      saveRT();
      gToken = null;
      keepToken();
      drv = {linked: false, folderId: null, lastUp: null, email: '', needAuth: false, busy: false};
      drvSave();
      render();
    });
  }
  async function driveRestore() {
    try {
      if (!(await ensureAccess())) {
        if (useWorker()) await authorize(false);
        else await requestToken('');
      }
      const folder = await ensureFolder();
      const files = (await driveList(folder, 1000)).filter(f => !isSysFile(f.name));
      openSheet(
        t('driveRestore'),
        files.length
          ? `<p class="hint">${t('restorePick')}</p><div class="list" style="overflow:hidden">${(() => {
              let last = '',
                h = '';
              const dF = {format: dateOf},
                tF = new Intl.DateTimeFormat(L(), {hour: 'numeric', minute: '2-digit', second: '2-digit'});
              files.forEach(f => {
                const d = new Date(f.createdTime),
                  k = d.toDateString();
                if (k !== last) {
                  last = k;
                  h += `<div class="daylbl">${esc(dF.format(d))}</div>`;
                }
                h += `<div class="row tap" data-f="${esc(f.id)}"><div class="glyph">⟲</div><div class="main"><span class="t num">${esc(tF.format(d))}</span></div></div>`;
              });
              return h;
            })()}</div>`
          : `<div class="empty">${t('driveNone')}</div>`,
        r => {
          r.querySelectorAll('[data-f]').forEach(
            el =>
              (el.onclick = async () => {
                const txt = await (await gfetch('/drive/v3/files/' + el.dataset.f + '?alt=media')).text();
                closeSheet();
                doImport(txt);
              })
          );
        }
      );
    } catch (e) {
      toast(t('driveErr'));
    }
  }
  const driveLastLbl = () =>
    drv.lastUp ? dateOf(new Date(drv.lastUp)) + ' ' + hmOf(new Date(drv.lastUp)) : t('never');
