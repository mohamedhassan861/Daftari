/* Currencies and gold: rates on a date and converting every amount to the base currency. */
  const isGold = c => /^G(24|21|18)$/.test(c || '');
  const curInfo = c => CUR.find(x => x[0] === c) || [c, c, c, c];
  const curSym = c => {
    const i = curInfo(c);
    if (lng() === 'en') {
      if (isGold(c)) return 'g ' + c.slice(1) + 'K';
      if (/[\u0600-\u06FF]/.test(i[3])) return c;
    }
    return i[3];
  };
  const curName = c => {
    const i = curInfo(c);
    return lng() === 'en' ? i[2] : i[1];
  };
  const BASE = () => (S && S.base) || 'EGP';
  const rateOf = c => (c === BASE() ? 1 : +(S.rates || {})[c] || 0);
  const curOfTx = x => (accOf(x.acc) || {}).currency || BASE();
  const toBase = (n, c) => (+n || 0) * rateOf(c);
  /* the rate on a date: the last saved rate on or before it (today = current) */
  function rateAt(c, d) {
    if (c === BASE()) return 1;
    if (!d || d >= TODAY) return rateOf(c);
    const H = S.rateHist || {},
      ks = Object.keys(H)
        .filter(k => H[k][c] > 0)
        .sort();
    let best = null;
    for (const k of ks) {
      if (k <= d) best = k;
      else break;
    }
    if (best) return H[best][c];
    return ks.length ? H[ks[0]][c] : rateOf(c);
  }
  const valAt = (a, d) => accBalanceAt(a, d) * rateAt(a.currency, d);
  /* a transfer is worth what left (or arrived in) the base-currency side; otherwise its own rate */
  function xferBase(x) {
    const a = accById(x.acc),
      b = accById(x.toAcc);
    if (a && a.currency === BASE()) return +x.amount || 0;
    if (b && b.currency === BASE()) return +(x.toAmount ?? x.amount) || 0;
    return (+x.amount || 0) * (+x.rate || rateAt(a ? a.currency : BASE(), x.date));
  }
  const baseAmt = x => {
    if (x.type === 'transfer') return xferBase(x);
    const c = curOfTx(x);
    return c === BASE() ? +x.amount || 0 : (+x.amount || 0) * (+x.rate || rateAt(c, x.date));
  };
  const sumB = a => a.reduce((v, x) => v + baseAmt(x), 0);
  const multiCur = () =>
    S.accounts.some(a => a.currency !== BASE()) || S.loans.some(l => l.currency && l.currency !== BASE());
  function missingRates() {
    const set = new Set();
    S.accounts.forEach(a => {
      if (a.currency !== BASE() && !rateOf(a.currency)) set.add(a.currency);
    });
    S.loans.forEach(l => {
      if (l.currency && l.currency !== BASE() && !rateOf(l.currency)) set.add(l.currency);
    });
    return [...set];
  }
  function usedCurrencies() {
    const set = new Set(['G21']);
    S.accounts.forEach(a => set.add(a.currency));
    S.loans.forEach(l => l.currency && set.add(l.currency));
    set.delete(BASE());
    return [...set];
  }
  function maybeUpdateRates() {
    if (!S) return;
    if (!S.ratesAt || Date.now() - new Date(S.ratesAt).getTime() > 864e5) updateRates(false);
  }
