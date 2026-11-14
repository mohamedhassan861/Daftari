/* The saved data: default categories, a blank ledger, sample data, encryption of the vault, and the migrations that upgrade old saves. */
  const mkCats = () => ({
    expense: DEF_CATS.expense.map(([id, ar, en, sys]) => ({id, ar, en, sys: !!sys})),
    income: DEF_CATS.income.map(([id, ar, en, sys]) => ({id, ar, en, sys: !!sys}))
  });
  const blank = () => ({
    v: 1,
    lang: 'ar',
    base: 'EGP',
    rates: {},
    accounts: [],
    cats: mkCats(),
    tx: [],
    inst: [],
    gam: [],
    loans: [],
    budgets: {},
    sample: false
  });

  /* sample ledger for the automated checks only (window.__T.seed on the local test server); users never get it */
  function seed() {
    const s = blank();
    s.sample = true;
    const d = (ym, day) => ym + '-' + pad(day);
    const add = (type, cat, amount, date, note) => s.tx.push({id: uid(), type, cat, amount, date, note: note || ''});
    for (let i = -4; i <= 0; i++) {
      const ym = ymAdd(TODAY_YM, i),
        last = i === 0 ? Math.max(1, now.getDate()) : 28;
      const dd = n => d(ym, Math.min(n, last));
      add('income', 'salary', 25000, dd(1), '');
      if (i % 2 === 0) add('income', 'side', 3500, dd(12), 'شغل فريلانس');
      add('expense', 'food', 1850 + (((i + 5) * 137) % 600), dd(3), 'هايبر');
      add('expense', 'food', 920 + (((i + 5) * 91) % 300), dd(14), 'خضار وفاكهة');
      add('expense', 'bills_e', 1400 + (((i + 5) * 53) % 250), dd(5), '');
      add('expense', 'bills_n', 450, dd(6), '');
      add('expense', 'transport', 1100 + (((i + 5) * 71) % 400), dd(9), 'بنزين');
      add('expense', 'edu', 1200, dd(2), 'مصاريف دروس');
      add('expense', 'personal', 600, dd(18), '');
      if (i === -2) add('expense', 'clothes', 2300, dd(20), 'لبس المدارس');
      if (i === -1) add('expense', 'health', 850, dd(16), 'كشف ودوا');
    }
    const ac = {id: uid(), name: 'تكييف', monthly: 1500, count: 12, start: ymAdd(TODAY_YM, -5), paid: []};
    for (let i = 0; i < 5; i++) {
      const ym = ymAdd(ac.start, i);
      ac.paid.push(ym);
      s.tx.push({
        id: uid(),
        type: 'expense',
        cat: 'inst',
        amount: 1500,
        date: ym + '-05',
        note: 'تكييف',
        link: {k: 'inst', id: ac.id, ym}
      });
    }
    s.inst.push(ac);
    const g = {
      id: uid(),
      name: 'جمعية الشغل',
      share: 2000,
      members: 10,
      myTurn: 7,
      start: ymAdd(TODAY_YM, -4),
      paid: [],
      received: false
    };
    for (let i = 0; i < 4; i++) {
      const ym = ymAdd(g.start, i);
      g.paid.push(ym);
      s.tx.push({
        id: uid(),
        type: 'expense',
        cat: 'gam',
        amount: 2000,
        date: ym + '-01',
        note: g.name,
        link: {k: 'gam', id: g.id, ym}
      });
    }
    s.gam.push(g);
    s.loans.push({
      id: uid(),
      dir: 'lent',
      person: 'أحمد',
      amount: 3000,
      date: d(ymAdd(TODAY_YM, -2), 10),
      note: '',
      pays: [{id: uid(), amount: 1000, date: d(ymAdd(TODAY_YM, -1), 10)}]
    });
    s.loans.push({
      id: uid(),
      dir: 'borrowed',
      person: 'خالي',
      amount: 5000,
      date: d(ymAdd(TODAY_YM, -3), 2),
      note: 'مصاريف المدرسة',
      pays: []
    });
    s.budgets = {food: 3500, transport: 1500, personal: 800};
    s.cats.expense.splice(
      2,
      0,
      {id: 'bills_e', ar: 'كهربا وغاز', en: 'Power & gas', sys: false, parent: 'bills'},
      {id: 'bills_n', ar: 'نت وموبايل', en: 'Internet & mobile', sys: false, parent: 'bills'}
    );
    s.loans[0].group = 'الأصحاب';
    s.loans[1].group = 'العيلة';
    s.inst[0].group = 'البيت';
    s.gam[0].group = 'الشغل';
    s.base = 'EGP';
    s.rates = {USD: 48.5, EUR: 52.5, SAR: 12.9, G24: 5150, G21: 4500, G18: 3860};
    s.accounts = [
      {id: 'cash', type: 'cash', name: 'كاش', currency: 'EGP', opening: 30000},
      {id: 'nbe', type: 'bank', name: 'البنك الأهلي', currency: 'EGP', opening: 40000},
      {id: 'cib-usd', type: 'bank', name: 'CIB', currency: 'USD', opening: 1500},
      {id: 'cib-egp', type: 'bank', name: 'CIB', currency: 'EGP', opening: 8000}
    ];
    s.tx.forEach(x => {
      x.acc = ['food', 'transport', 'personal'].includes(x.cat) ? 'cash' : 'nbe';
    });
    s.defAcc = 'cash';
    return s;
  }
  async function derive(pin, salt, iter) {
    const base = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256'},
      base,
      {name: 'AES-GCM', length: 256},
      false,
      ['encrypt', 'decrypt']
    );
  }
  async function seal(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, te.encode(JSON.stringify(obj)));
    return {iv: toB64(iv), ct: toB64(ct)};
  }
  async function unseal(key, iv, ct) {
    const pt = await crypto.subtle.decrypt({name: 'AES-GCM', iv: fromB64(iv)}, key, fromB64(ct));
    return JSON.parse(td.decode(pt));
  }
  const readVault = () => {
    try {
      return JSON.parse(localStorage.getItem(VAULT) || 'null');
    } catch (e) {
      return null;
    }
  };
  function vaultSave(obj) {
    if (!KEYOBJ || !obj) return;
    const snap = JSON.parse(JSON.stringify(obj));
    const key = KEYOBJ,
      salt = SALT;
    saving = saving
      .then(async () => {
        const {iv, ct} = await seal(key, snap);
        localStorage.setItem(VAULT, JSON.stringify({v: 2, salt: toB64(salt), iter: ITER, iv, ct}));
        try {
          localStorage.setItem('daftar-elbeit-lang', snap.lang);
        } catch (e) {}
      })
      .catch(saveFailed);
  }
  /* a change that did not reach the phone's storage would be lost on the next open, so the user is told (at most once a minute) */
  function saveFailed() {
    if (Date.now() - saveFailed.at < 60000) return;
    saveFailed.at = Date.now();
    toast(t('saveFail'), 15000);
  }
  /* asks the browser not to clear the saved ledger when the phone runs low on space; browsers may refuse, nothing depends on it */
  function keepStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    } catch (e) {}
  }
  function migrate() {
    if (!S.base) S.base = 'EGP';
    if (!Array.isArray(S.recur)) S.recur = [];
    if (!Array.isArray(S.goals)) S.goals = [];
    if (!Array.isArray(S.planAdj)) S.planAdj = [];
    if (!S.closed) S.closed = {};
    if (!S.planOver || typeof S.planOver !== 'object') S.planOver = {};
    if (!S.closeFrom) S.closeFrom = TODAY_YM;
    if (!Array.isArray(S.settles)) S.settles = [];
    if (!Array.isArray(S.quick)) S.quick = [];
    if (ACT === 'me' && !Array.isArray(S.ledgers)) S.ledgers = [];
    if (!S.rk) S.rk = toB64(crypto.getRandomValues(new Uint8Array(32)));
    if (!S.rates || typeof S.rates !== 'object') S.rates = {};
    if (!Array.isArray(S.accounts) || !S.accounts.length)
      S.accounts = [{id: 'cash', type: 'cash', name: lng() === 'en' ? 'Cash' : 'كاش', currency: S.base, opening: 0}];
    const ids = new Set(S.accounts.map(a => a.id));
    for (const x of S.tx) if (!x.acc || !ids.has(x.acc)) x.acc = S.accounts[0].id;
    for (const l of S.loans) if (!l.currency) l.currency = S.base;
    for (const o of S.inst) if (!o.currency) o.currency = S.base;
    for (const o of S.gam) if (!o.currency) o.currency = S.base;
    const addCat = (ty, id, ar, en, sys, before) => {
      if (!S.cats[ty].some(c => c.id === id)) {
        const i = S.cats[ty].findIndex(c => c.id === before);
        S.cats[ty].splice(i < 0 ? S.cats[ty].length : i, 0, {id, ar, en, sys});
      }
    };
    addCat('expense', 'bankfees', 'رسوم ومصاريف بنكية', 'Bank fees', false, 'inst');
    addCat('expense', 'adjust', 'فروقات تسوية', 'Reconciliation difference', true, 'other');
    addCat('income', 'interest', 'فوايد وعوائد', 'Interest & returns', false, 'gamin');
    addCat('expense', 'loanpay', 'سداد سلف', 'Loan repayments', true, 'other');
    addCat('income', 'loanback', 'تحصيل سلف', 'Loan collections', true, 'iother');
    addCat('income', 'loanrecv', 'سلف استلمتها', 'Loans received', true, 'iother');
    addCat('expense', 'loangive', 'سلف ادّيتها', 'Loans given', true, 'other');
    /* a "loan received" category made by the Excel import counted borrowed money as income: fold it into the loans category */
    if (S.zakat && S.zakat.karat === '21' && !S.zakat.karatSet) S.zakat.karat = '24';
    {
      const ix = S.cats.income.findIndex(c => c.id === 'loanin');
      if (ix >= 0 && !S.cats.income.some(c => c.parent === 'loanin')) {
        const mv = x => {
          if (x && x.cat === 'loanin') x.cat = 'loanrecv';
        };
        S.tx.forEach(mv);
        (S.planAdj || []).forEach(mv);
        (S.recur || []).forEach(r => mv(r.tpl));
        S.cats.income.splice(ix, 1);
      }
    }
    addCat('income', 'iadjust', 'فروقات تسوية', 'Reconciliation difference', true, 'iother');
    if (!S.defAcc || !ids.has(S.defAcc)) S.defAcc = S.accounts[0].id;
    {
      const cd = S.accounts.find(a => a.type === 'card');
      for (const o of S.inst)
        if (o.payWith === undefined) o.payWith = cd && /كريديت|كارت|credit|card/i.test(o.name) ? cd.id : '';
    }
    if ('currency' in S) delete S.currency;
  }
  function applyAlt() {
    if (!ALT || !S) return;
    const {name, alt, lang} = ALT,
      ol = lang === 'en' ? 'ar' : 'en';
    ALT = null;
    if (!name) return;
    [S.accounts, S.inst, S.gam, S.goals].forEach(L =>
      (L || []).forEach(o => {
        if (o.name !== name) return;
        o.nm = o.nm || {};
        o.nm[lang] = name;
        if (alt) o.nm[ol] = alt;
        else delete o.nm[ol];
      })
    );
  }
  function applyNames(lang) {
    [S.accounts, S.inst, S.gam, S.goals].forEach(L =>
      (L || []).forEach(o => {
        if (o.nm && o.nm[lang]) o.name = o.nm[lang];
      })
    );
  }
