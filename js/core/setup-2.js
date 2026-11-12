/* Constants and app state, kept in the order they must be created. (part 2 of 2; continues from setup-1.js) */
  /* buttons inside a bottom sheet (e.g. "edit" in a warning) use the same actions as the main screen */
  $('#shB').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && $('#shB').contains(b)) actClick(e);
  });
  $('#view').addEventListener('click', e => actClick(e));
  let bkTimer;

  /* ---------- Google Drive (drive.file scope: the app sees only files it created) ---------- */
  const CFG = window.DAFTARI_CONFIG || {};
  const DRV_KEY = 'daftari-drive',
    DKEEP = 100,
    GAPI = 'https://www.googleapis.com';
  let drv = {linked: false, folderId: null, lastUp: null, email: '', needAuth: false, busy: false};
  try {
    Object.assign(drv, JSON.parse(localStorage.getItem(DRV_KEY) || '{}'));
  } catch (e) {}
  let gToken = null,
    gExp = 0,
    gClient = null,
    drvTimer = null;
  const TOK_KEY = 'daftari-gtoken';
  try {
    const o = JSON.parse(localStorage.getItem(TOK_KEY) || 'null');
    if (o && o.exp > Date.now()) {
      gToken = o.t;
      gExp = o.exp;
    }
  } catch (e) {}
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  /* long-lived Google grant: kept encrypted with the PIN key, never in backups */
  const RT_KEY = 'daftari-rt';
  let RT = null;

  /* ---------- shared ledgers (a Drive file, encrypted with the ledger's own key) ---------- */
  const SH_COLS = ['tx', 'accounts', 'inst', 'gam', 'loans', 'recur', 'goals', 'settles'],
    SETK = ['base', 'rates', 'ratesAt', 'goldManual', 'zakat', 'rk', 'name', 'members'],
    LOCALK = ['lang', 'defAcc', 'autoDl', 'sample'];
  let ACT = 'me',
    PS = null,
    SHM = null,
    shadow = {},
    shTimer = null,
    shPoll = null,
    shBusy = false,
    shDirty = false,
    pendingJoin = null;
  const ledKeys = new Map();
  /* joining: the invite link carries the file id and key in the # part, which never leaves the phone */
  (function () {
    const m = location.hash.match(/^#join\.([\w-]+)\.([\w-]+)$/);
    if (m) {
      pendingJoin = {fileId: m[1], key: m[2]};
      try {
        history.replaceState(null, '', location.pathname);
      } catch (e) {}
    }
  })();
  let gapiP = null;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ACT !== 'me') shPull(false);
  });

  /* ---------- share to Google Drive (system share sheet, no Google Cloud needed) ---------- */
  const LASTCHG = 'daftari-lastchange';

  /* ---------- sign-up with Google, once: the email goes to the owner's list ---------- */
  const REG_KEY = 'daftari-reg';
  let REG = null;
  try {
    REG = JSON.parse(localStorage.getItem(REG_KEY) || 'null');
  } catch (e) {}
  let idClient = null;
  let PENDING_RT = null,
    FRESH_DRIVE = false;
  const DRVASK = 'daftari-drvask';
  let LOCKSETUP = false;
  const REMT_KEY = 'daftari-remtime';
  /* daily price history for the lowest-price table; loaded once per session when the rates section is shown */
  let RLOW = null,
    RLOW_BUSY = false;
