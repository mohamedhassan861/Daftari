/* The selected period (month, quarter, year or custom): its range and the transactions inside it. */
  const perStart = () => {
    const [y, m] = cur.split('-').map(Number),
      n = PMODES[per.mode] || 1;
    return y + '-' + pad(Math.floor((m - 1) / n) * n + 1);
  };
  function perRange() {
    if (per.mode === 'custom') return per.from <= per.to ? [per.from, per.to] : [per.to, per.from];
    const s = perStart();
    return [s + '-01', monthEnd(ymAdd(s, PMODES[per.mode] - 1))];
  }
  function perMonths() {
    const [a, b] = perRange();
    const out = [];
    let m = a.slice(0, 7);
    while (m <= b.slice(0, 7) && out.length < 240) {
      out.push(m);
      m = ymAdd(m, 1);
    }
    return out;
  }
  const txIn = () => {
    const [a, b] = perRange();
    return S.tx.filter(x => x.date >= a && x.date <= b);
  };
  function perFactor() {
    if (per.mode !== 'custom') return PMODES[per.mode];
    const [a, b] = perRange();
    return Math.max(1, (dOf(b) - dOf(a)) / 864e5 + 1) / 30.4375;
  }
  function perLabel() {
    const y = cur.slice(0, 4),
      m = +cur.slice(5, 7),
      en = lng() === 'en';
    if (per.mode === 'month') return monthLbl(cur);
    if (per.mode === 'quarter') {
      const q = Math.floor((m - 1) / 3) + 1;
      return en ? 'Q' + q + ' ' + y : 'الربع ' + ['الأول', 'التاني', 'التالت', 'الرابع'][q - 1] + ' ' + y;
    }
    if (per.mode === 'half') {
      const h = m <= 6 ? 1 : 2;
      return en ? 'H' + h + ' ' + y : 'النص ' + (h === 1 ? 'الأول' : 'التاني') + ' ' + y;
    }
    if (per.mode === 'year') return y;
    const [a, b] = perRange();
    /* whole months: name them */
    if (a.slice(8) === '01' && b === monthEnd(b.slice(0, 7))) {
      const ma = a.slice(0, 7),
        mb = b.slice(0, 7),
        ya = a.slice(0, 4),
        yb = b.slice(0, 4),
        mn = m2 => new Intl.DateTimeFormat(L(), {month: 'long'}).format(dsDate(m2 + '-01'));
      if (ma === ya + '-01' && mb === yb + '-12') return ya === yb ? ya : ya + ' – ' + yb;
      if (ma === mb) return monthLbl(ma);
      return ya === yb ? mn(ma) + ' – ' + mn(mb) + ' ' + ya : monthLbl(ma) + ' – ' + monthLbl(mb);
    }
    const A = dsDate(a),
      B = dsDate(b),
      sh = d => '\u200E' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '\u200E';
    return A.getFullYear() === B.getFullYear()
      ? sh(A) + ' – ' + sh(B) + '/' + B.getFullYear()
      : dmyOf(A) + ' – ' + dmyOf(B);
  }
  function perShift(k) {
    if (per.mode === 'custom') {
      const [a, b] = perRange(),
        len = Math.round((dOf(b) - dOf(a)) / 864e5) + 1;
      per.from = iso(new Date(dOf(a).getTime() + k * len * 864e5));
      per.to = iso(new Date(dOf(b).getTime() + k * len * 864e5));
      return;
    }
    cur = ymAdd(perStart(), k * PMODES[per.mode]);
  }
