/* The lock screen: PIN, fingerprint and recovery. (part 3 of 3; continues from lock-2.js) */
  function unlocked() {
    EXT = 0;
    REC_LATER = new Set();
    setTimeout(() => {
      try {
        runRecurring();
        showRecPopup();
      } catch (e) {}
    }, 700);
    if (BIO_AFTER) {
      BIO_AFTER = false;
      const pin = PINMEM;
      setTimeout(() => {
        bioEnableForm();
        const i = $('#shB #p0');
        if (i) i.value = pin;
      }, 700);
    }
    if (RECOVERED) {
      const k = RECOVERED;
      RECOVERED = null;
      setTimeout(() => changePinForm(k), 400);
    }
    $('#lock').hidden = true;
    $('#lkF').innerHTML = '';
    LANG = S.lang;
    ACT = 'me';
    SHM = null;
    migrate();
    PS = S;
    if (pendingJoin) setTimeout(joinSheet, 300);
    if (pendingShare) {
      const txt = pendingShare;
      pendingShare = null;
      setTimeout(() => quickFromText(txt), 350);
    }
    render();
    runRecurring();
    maybeUpdateRates();
    setTimeout(pushKeep, 4000);
    writeReminders();
    maybeAskClose();
    loadRT().then(async () => {
      if (PENDING_RT && KEYOBJ) {
        RT = PENDING_RT;
        PENDING_RT = null;
        await saveRT();
      }
      if (FRESH_DRIVE && drv.linked) {
        FRESH_DRIVE = false;
        try {
          const f = await ensureFolder();
          const has = (await driveList(f, 10)).some(x => !isSysFile(x.name));
          if (has) {
            toast(t('foundBackup'));
            driveRestore();
          } else syncDrive(true);
        } catch (e) {}
      }
      if (drv.linked && useWorker() && !RT && !hasToken() && S) {
        drv.needAuth = true;
        render();
      }
      setTimeout(() => recSetup(false), 1500);
    });
  }
  function lockNow() {
    if (NEWVER && NEWVER !== APP_VER) setTimeout(checkUpdate, 300);
    clearTimeout(bkTimer);
    if (ACT !== 'me' && shDirty) shPush();
    stopPoll();
    ACT = 'me';
    SHM = null;
    PS = null;
    closeSheet();
    S = null;
    KEYOBJ = null;
    SALT = null;
    RT = null;
    PINMEM = null;
    $('#view').innerHTML = '';
    showLock();
  }
  function goingOut() {
    EXT = Date.now();
  }
  function forgotWipe() {
    $('#lkT').textContent = t('forgotConfirm');
    $('#lkH').textContent = '';
    $('#lkE').textContent = '';
    $('#lkForgot').hidden = true;
    $('#lkF').innerHTML =
      `<div class="foot"><button type="button" class="btn grow" id="fNo">${t('cancel')}</button><button type="button" class="btn grow" id="fYes" style="background:var(--neg);border-color:var(--neg);color:#fff">${t('del')}</button></div>`;
    $('#fNo').onclick = showLock;
    $('#fYes').onclick = () => {
      try {
        localStorage.removeItem(VAULT);
        localStorage.removeItem(KEY);
        localStorage.removeItem('daftari-rt');
        localStorage.removeItem('daftari-gtoken');
        localStorage.removeItem(REC_KEY);
        localStorage.removeItem(BIO_KEY);
      } catch (e) {}
      showLock();
    };
  }
  /* black cover the moment the app loses focus (app switcher, notifications, another app), so the phone's recent-apps picture shows nothing */
  const cover = on => {
    const c = $('#privacy');
    if (c) c.hidden = !on;
  };
  async function checkUpdate() {
    if (!navigator.onLine || location.protocol !== 'https:') return;
    try {
      const r = await fetch('version.json?t=' + Date.now(), {cache: 'no-store'});
      if (!r.ok) return;
      const v = String((await r.json()).v || '');
      if (!v || v === APP_VER) return;
      NEWVER = v;
      let tried = '';
      try {
        tried = sessionStorage.getItem('daftari-upd') || '';
      } catch (e) {}
      if (!S && !($('#lp1') && $('#lp1').value) && tried !== v) {
        try {
          sessionStorage.setItem('daftari-upd', v);
        } catch (e) {}
        await updateNow();
        return;
      }
      if (S) render();
    } catch (e) {}
  }
  async function updateNow() {
    if (S) await keepSession();
    try {
      const rs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(rs.map(r => r.update()));
      const ks = await caches.keys();
      await Promise.all(ks.map(k => caches.delete(k)));
    } catch (e) {}
    location.reload();
  }
