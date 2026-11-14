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
      /* old copies are cleared once a day, and only after the user agreed to the keep rule */
      if (drv.keep === 'tidy' && drv.tidied !== TODAY) {
        drv.tidied = TODAY;
        drvSave();
        ensureFolder()
          .then(f => tidyBackups(f, 300))
          .catch(() => {});
      }
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
      /* the agreement to clear old copies was given for the old account's folder */
      drv.keep = drv.tidied = undefined;
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
      const files = (await driveList(folder, 1000)).filter(f => isBackupFile(f.name));
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
  /* every backup copy in the Drive folder (Drive returns at most 1000 files per page) */
  async function driveBackups(folder) {
    const q = encodeURIComponent("'" + folder + "' in parents and trashed=false");
    let out = [],
      page = '';
    for (let i = 0; i < 10; i++) {
      const j = await (
        await gfetch(
          '/drive/v3/files?q=' +
            q +
            '&pageSize=1000&fields=' +
            encodeURIComponent('nextPageToken,files(id,name,createdTime)') +
            '&spaces=drive' +
            (page ? '&pageToken=' + encodeURIComponent(page) : '')
        )
      ).json();
      out = out.concat((j.files || []).filter(f => isBackupFile(f.name)));
      page = j.nextPageToken;
      if (!page) break;
    }
    return out;
  }
  /* moves the copies outside the keep rule to the Drive bin (they can be restored from there for 30 days) */
  async function tidyBackups(folder, max) {
    const gone = backupsToTrash(await driveBackups(folder), TODAY).slice(0, max);
    for (let i = 0; i < gone.length; i += 5)
      await Promise.all(
        gone.slice(i, i + 5).map(f =>
          gfetch('/drive/v3/files/' + f.id, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({trashed: true})
          })
        )
      );
    return gone.length;
  }
  /* nothing is binned before the user sees the numbers and agrees; after that it runs by itself */
  async function driveTidyAsk() {
    try {
      if (!(await ensureAccess())) {
        toast(t('driveErr'));
        return;
      }
      toast(t('working'));
      const folder = await ensureFolder(),
        all = await driveBackups(folder),
        gone = backupsToTrash(all, TODAY);
      if (!gone.length) {
        drv.keep = 'tidy';
        drvSave();
        render();
        toast(t('tidyNone').replace('%n', all.length));
        return;
      }
      confirmSheet(
        t('tidyQ')
          .replace('%n', all.length)
          .replace('%k', all.length - gone.length)
          .replace('%g', gone.length),
        t('tidyYes'),
        async () => {
          drv.keep = 'tidy';
          drv.tidied = TODAY;
          drvSave();
          render();
          try {
            toast(t('tidyDone').replace('%n', await tidyBackups(folder, 3000)));
          } catch (e) {
            toast(t('driveErr'));
          }
        }
      );
    } catch (e) {
      toast(t('driveErr'));
    }
  }
  function driveKeepAll() {
    drv.keep = 'all';
    drvSave();
    render();
  }
  function msAutoToggle() {
    drv.sumOff = !drv.sumOff;
    drvSave();
    render();
  }
