/* Constants and app state, kept in the order they must be created. (part 1 of 2) */
  /* ---------- data ---------- */
  const DEF_CATS = {
    expense: [
      ['food', 'أكل وبقالة', 'Groceries & food'],
      ['bills', 'فواتير (كهربا، مياه، غاز، نت)', 'Bills & utilities'],
      ['rent', 'إيجار', 'Rent'],
      ['transport', 'مواصلات وبنزين', 'Transport & fuel'],
      ['edu', 'تعليم ومدارس', 'Education'],
      ['health', 'صحة وعلاج', 'Health'],
      ['clothes', 'لبس', 'Clothing'],
      ['house', 'البيت والصيانة', 'Home & repairs'],
      ['personal', 'مصروف شخصي', 'Personal'],
      ['gifts', 'هدايا ومناسبات', 'Gifts & occasions'],
      ['charity', 'صدقات وزكاة', 'Charity & zakat'],
      ['inst', 'أقساط', 'Installments', 1],
      ['gam', 'جمعيات', "Gam'eya payments", 1],
      ['other', 'أخرى', 'Other', 1]
    ],
    income: [
      ['salary', 'مرتب', 'Salary'],
      ['bonus', 'حوافز ومكافآت', 'Bonuses'],
      ['side', 'دخل إضافي', 'Side income'],
      ['gamin', 'قبض جمعية', "Gam'eya payout", 1],
      ['iother', 'أخرى', 'Other', 1]
    ]
  };

  let S = null;

  /* ---------- encryption (PBKDF2 + AES-GCM, all on the device) ---------- */
  const VAULT = 'daftar-elbeit-vault',
    ITER = 310000;
  const te = new TextEncoder(),
    td = new TextDecoder();
  let KEYOBJ = null,
    SALT = null;
  let saving = Promise.resolve();
  let tokenAsked = 0;

  /* ---------- currencies & accounts ---------- */
  const CUR = [
    ['EGP', 'جنيه مصري', 'Egyptian pound', 'ج.م'],
    ['USD', 'دولار أمريكي', 'US dollar', '$'],
    ['EUR', 'يورو', 'Euro', '€'],
    ['SAR', 'ريال سعودي', 'Saudi riyal', 'ر.س'],
    ['AED', 'درهم إماراتي', 'UAE dirham', 'د.إ'],
    ['KWD', 'دينار كويتي', 'Kuwaiti dinar', 'د.ك'],
    ['QAR', 'ريال قطري', 'Qatari riyal', 'ر.ق'],
    ['BHD', 'دينار بحريني', 'Bahraini dinar', 'د.ب'],
    ['OMR', 'ريال عماني', 'Omani rial', 'ر.ع'],
    ['JOD', 'دينار أردني', 'Jordanian dinar', 'د.أ'],
    ['GBP', 'جنيه إسترليني', 'British pound', '£'],
    ['TRY', 'ليرة تركية', 'Turkish lira', '₺'],
    ['CHF', 'فرنك سويسري', 'Swiss franc', 'CHF'],
    ['CAD', 'دولار كندي', 'Canadian dollar', 'C$'],
    ['AUD', 'دولار أسترالي', 'Australian dollar', 'A$'],
    ['CNY', 'يوان صيني', 'Chinese yuan', 'CN¥'],
    ['JPY', 'ين ياباني', 'Japanese yen', 'JP¥'],
    ['INR', 'روبية هندية', 'Indian rupee', '₹'],
    ['MAD', 'درهم مغربي', 'Moroccan dirham', 'د.م'],
    ['LYD', 'دينار ليبي', 'Libyan dinar', 'د.ل'],
    ['IQD', 'دينار عراقي', 'Iraqi dinar', 'د.ع'],
    ['SDG', 'جنيه سوداني', 'Sudanese pound', 'ج.س'],
    ['TND', 'دينار تونسي', 'Tunisian dinar', 'د.ت'],
    ['DZD', 'دينار جزائري', 'Algerian dinar', 'د.ج'],
    ['G24', 'ذهب عيار 24 (بالجرام)', 'Gold 24K (grams)', 'جم ع24'],
    ['G21', 'ذهب عيار 21 (بالجرام)', 'Gold 21K (grams)', 'جم ع21'],
    ['G18', 'ذهب عيار 18 (بالجرام)', 'Gold 18K (grams)', 'جم ع18']
  ];
  const ACC_TYPES = ['cash', 'bank', 'wallet', 'card', 'gold', 'cert'];

  /* ---------- groups ---------- */
  const DEF_ACC_GROUP = {
    cash: ['كاش', 'Cash'],
    bank: ['بنوك', 'Banks'],
    wallet: ['محافظ', 'Wallets'],
    card: ['كروت', 'Cards'],
    gold: ['ذهب', 'Gold'],
    cert: ['شهادات وودائع', 'Certificates & deposits']
  };

  /* ---------- recurring entries ---------- */
  const FREQS = ['weekly', 'monthly', 'quarterly', 'yearly'];
  /* a repeat is "every N units": stored as "N:u" (u = d day, w week, m month, y year); the old names still work */
  const FREQ_OLD = {weekly: '1:w', monthly: '1:m', quarterly: '3:m', yearly: '1:y', daily: '1:d', biweekly: '2:w'};
  /* what to show when the app opens: repeats due (or postponed to) today or earlier, and those whose reminder day has come */
  let REC_LATER = new Set();

  /* ---------- export: Excel, CSV, PDF ---------- */
  let XLSXP = null;
  let lastStmt = null;
  /* loans and gam'eyas move money but are not income or spending (paying back a loan, saving in a gam'eya) */
  const FIN_CATS = new Set(['loanpay', 'loanback', 'loanrecv', 'loangive', 'gam', 'gamin']);
  $('#shB').addEventListener('click', e => {
    const b = e.target.closest('[data-sact]');
    if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.sact === 'tx') {
      const x = S.tx.find(v => v.id === id);
      if (x) txForm(x);
    } else if (b.dataset.sact === 'cat') catStmt(id);
    else if (b.dataset.sact === 'recon') recForm(accOf(id));
    else if (b.dataset.sact === 'export') exportStmt();
    else if (b.dataset.sact === 'led') switchLedger(id);
    else if (b.dataset.sact === 'ledInvite' && SHM) inviteForm(SHM);
    else if (b.dataset.sact === 'ledLeave') leaveLedger();
    else if (b.dataset.sact === 'rcpt') showReceipt(id);
    else if (b.dataset.sact === 'rec') {
      const r = S.recur.find(v => v.id === id);
      if (r) recRuleForm(r);
    }
  });

  /* ---------- quick entry: plain-language text, voice and shared bank messages ---------- */
  const AR_DIG = '٠١٢٣٤٥٦٧٨٩',
    FA_DIG = '۰۱۲۳۴۵۶۷۸۹';
  const KW_CAT = [
    [
      /بنزين|وقود|سولار|غاز طبيعي|fuel|petrol|gas station|اوبر|أوبر|uber|careem|كريم|تاكسي|مواصلات|مترو|ميكروباص/i,
      'transport'
    ],
    [
      /عيش|خضار|فاكهة|فاكهه|سوبر ?ماركت|هايبر|بقالة|بقاله|كارفور|carrefour|سبينيس|spinneys|مطعم|اكل|أكل|طلبات|talabat|ماكدونالدز|كافيه|قهوة|grocer|restaurant|food/i,
      'food'
    ],
    [
      /كهربا|كهرباء|مياه|ميه|غاز|فاتورة|فاتوره|انترنت|إنترنت|نت|باقة|باقه|we |اتصالات|اورنج|أورانج|فودافون فاتورة|bill|electric|water/i,
      'bills'
    ],
    [/دكتور|طبيب|صيدلية|صيدليه|دوا|دواء|علاج|مستشفى|تحاليل|pharmacy|doctor|hospital/i, 'health'],
    [/مدرسة|مدرسه|دروس|درس|كورس|جامعة|مصاريف دراسية|school|course|tuition/i, 'edu'],
    [/لبس|هدوم|جزمة|جزمه|كوتشي|clothes|shoes/i, 'clothes'],
    [/ايجار|إيجار|rent/i, 'rent'],
    [/هدية|هديه|عيدية|عيديه|فرح|gift/i, 'gifts'],
    [/صدقة|صدقه|زكاة|زكاه|تبرع|charity|zakat/i, 'charity'],
    [/صيانة|صيانه|سباك|كهربائي|نقاش|repair/i, 'house'],
    [/مرتب|راتب|salary|payroll/i, 'salary'],
    [/حافز|مكافأة|مكافاة|بونص|bonus/i, 'bonus'],
    [/فوايد|فوائد|عائد|interest/i, 'interest']
  ];
  const KW_IN =
    /قبضت|استلمت|جالي|جالى|اتحول لي|اتحولي|حولولي|إيداع|ايداع|اضافة|إضافة|دائن|credited|received|deposit|refund|استرداد|مرتجع|تم استلام|incoming/i;
  const KW_OUT = /صرفت|دفعت|اشتريت|خصم|سحب|شراء|مدين|debited|purchase|paid|withdraw|spent|تم دفع|سداد|charged/i;
  let pendingShare = null;
  (function () {
    try {
      const sp = new URLSearchParams(location.search);
      const txt = [sp.get('title'), sp.get('text')].filter(Boolean).join(' ').trim();
      if (txt) {
        pendingShare = txt;
        history.replaceState(null, '', location.pathname);
      }
    } catch (e) {}
  })();
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  let cur = TODAY_YM,
    tab = 'home',
    oblTab = 'inst',
    txFilter = 'all',
    txQuery = '',
    txCat = '',
    txAcc = '',
    txTag = '',
    txDay = '',
    txView = 'list';
  /* reporting period: a calendar month, quarter, half-year, year, or a custom date range */
  const PMODES = {month: 1, quarter: 3, half: 6, year: 12};
  let per = {mode: 'month', from: TODAY_YM + '-01', to: TODAY};
  let tt;

  /* ---------- sheet ---------- */
  /* the phone shows date fields in its own order (often month/day); show them as ddd dd/mm/yyyy and keep the phone's calendar for picking */
  const LRI = '\u2066',
    PDI = '\u2069';
  new MutationObserver(() =>
    document.querySelectorAll('input[type=date]:not([data-dw]),input[type=month]:not([data-dw])').forEach(dateField)
  ).observe(document.documentElement, {childList: true, subtree: true});
  (() => {
    const set = () => {
      const a = document.querySelector('.top'),
        b = document.querySelector('.shh');
      if (a) document.documentElement.style.setProperty('--topH', a.getBoundingClientRect().height + 'px');
      if (b && b.offsetHeight)
        document.documentElement.style.setProperty('--shH', b.getBoundingClientRect().height + 'px');
    };
    try {
      const ro = new ResizeObserver(set);
      const go = () => {
        const a = document.querySelector('.top'),
          b = document.querySelector('.shh');
        if (a) ro.observe(a);
        if (b) ro.observe(b);
        set();
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
      else go();
    } catch (e) {}
    window.addEventListener('resize', set);
  })();
  window.addEventListener('resize', () => {
    try {
      fitHeader();
    } catch (e) {}
  });
  /* settings: every titled section becomes a closed box (title + what matters at a glance) */
  (() => {
    let on = false,
      raf = 0;
    const f = () => {
      raf = 0;
      const s = on ? scrollY > 12 : scrollY > 90;
      if (s !== on) {
        on = s;
        document.body.classList.toggle('scr', s);
        const sb = document.querySelector('#view .stickbar');
        document.documentElement.style.setProperty('--stickH', sb ? sb.getBoundingClientRect().height + 'px' : '0px');
      }
    };
    window.addEventListener(
      'scroll',
      () => {
        if (!raf) raf = requestAnimationFrame(f);
      },
      {passive: true}
    );
  })();
  window.addEventListener('popstate', () => {
    if (!$('#sheet').hidden) {
      closeSheet();
      return;
    }
    if (S && tab !== 'home') {
      tab = 'home';
      render();
      window.scrollTo(0, 0);
      return;
    }
    try {
      history.back();
    } catch (e) {}
  });
  $('#scrim').onclick = closeSheet;
  $('#shX').onclick = closeSheet;
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet();
  });
  let ALT = null;
  document.addEventListener(
    'submit',
    e => {
      const f = e.target,
        a = f.querySelector && f.querySelector('#nm2'),
        n = f.querySelector && f.querySelector('#nm');
      ALT = a && n ? {name: n.value.trim(), alt: a.value.trim(), lang: lng()} : null;
    },
    true
  );
  const SHOW_DONE = {};

  let oblF = new Set(),
    oblC = new Set(),
    oblQ = '';
  let CLOSE_NOTE = '';
  let catOpen = new Set();

  /* ---------- render ---------- */
  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    tx: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    obl: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    rep: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    set: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
  };
  $('#nav').onclick = e => {
    const b = e.target.closest('[data-tab]');
    if (b) {
      tab = b.dataset.tab;
      render();
      window.scrollTo(0, 0);
    }
  };
  $('#mPrev').onclick = () => {
    perShift(-1);
    render();
  };
  $('#mLbl').onclick = () => {
    if (S) periodForm();
  };
  $('#shareBtn').onclick = () => shareApp();
  $('#mNext').onclick = () => {
    perShift(1);
    render();
  };
  $('#fab').onclick = () => txForm();

