/* Cash flow: remaining plan, cash timeline, projections, forecast series and FX gains. (part 2 of 2; continues from cashflow-1.js) */
  function perCash() {
    const [a, b] = perRange(),
      proj = b > TODAY,
      now = liqAll(TODAY);
    const G = (r, pi, po, fi, fo, xi, xo) =>
      Object.assign(r, {fIn: fi, fOut: fo, xIn: xi, xOut: xo, gi: r.ai + pi + fi + xi, go: r.ao + po + fo + xo});
    if (a > TODAY) {
      const p0 = projFlows(dayBefore(a)),
        p1 = projFlows(b),
        o = now + p0.i - p0.o + p0.x + p0.f,
        pi = p1.i - p0.i,
        po = p1.o - p0.o,
        xf = p1.x - p0.x,
        fz = p1.f - p0.f;
      return G(
        {a, b, proj, fut: true, o, ai: 0, ao: 0, xf, fz, f0: 0, pi, po, c: o + pi - po + xf + fz, now, fx: 0},
        pi,
        po,
        p1.fi - p0.fi,
        p1.fo - p0.fo,
        p1.xi - p0.xi,
        p1.xo - p0.xo
      );
    }
    const o = liqAll(dayBefore(a)),
      cf = cashActual(S.tx.filter(x => x.date >= a && x.date <= (proj ? TODAY : b))),
      sm = p =>
        Object.entries(cf)
          .filter(([k]) => k.startsWith(p))
          .reduce((v, [, x]) => v + x.v, 0);
    const ai = sm('in:'),
      ao = sm('out:'),
      xf0 = sm('xin:') - sm('xout:'),
      f0 = sm('fi:') - sm('fo:'),
      endA = proj ? now : liqAll(b),
      p = proj ? projFlows(b) : {i: 0, o: 0, x: 0, f: 0},
      xf = xf0 + p.x,
      fz = f0 + p.f;
    return G(
      {
        a,
        b,
        proj,
        fut: false,
        o,
        ai,
        ao,
        xf,
        xf0,
        fz,
        f0,
        pi: p.i,
        po: p.o,
        c: endA + p.i - p.o + p.x + p.f,
        now,
        fx: endA - o - (ai - ao) - xf0 - f0
      },
      p.i,
      p.o,
      sm('fi:') + (p.fi || 0),
      sm('fo:') + (p.fo || 0),
      sm('xin:') + (p.xi || 0),
      sm('xout:') + (p.xo || 0)
    );
  }
  function fcSeries(endM) {
    const out = [];
    let bal = liqAll(monthEnd(ymAdd(TODAY_YM, -1)));
    for (let m = TODAY_YM; m <= endM && out.length < 60; m = ymAdd(m, 1)) {
      const r = monthCash(m),
        open = bal;
      r.gi = (r.kind === 'cur' ? r.iMax : r.i) + (r.fi || 0) + (r.xi || 0);
      r.go = (r.kind === 'cur' ? r.eMax : r.e) + (r.fo || 0) + (r.xo || 0);
      bal += (r.kind === 'cur' ? r.iMax - r.eMax : r.i - r.e) + (r.x || 0) + (r.f || 0);
      out.push(Object.assign({m, open, bal}, r));
    }
    return out;
  }

  /* cash & banks over the period, from the opening to the closing, line by line */
  function fxGain(PA, PE, only) {
    let tot = 0;
    const rows = [];
    const b0 = dayBefore(PA);
    S.accounts
      .filter(a => a.currency !== BASE() && (!only || only(a)))
      .forEach(a => {
        let flow = 0;
        S.tx.forEach(x => {
          if (x.date < PA || x.date > PE) return;
          if (x.type === 'transfer') {
            if (x.acc === a.id) flow -= xferBase(x);
            if (x.toAcc === a.id) flow += xferBase(x);
          } else if (x.acc === a.id) flow += (x.type === 'income' ? 1 : -1) * baseAmt(x);
        });
        const g = valAt(a, PE) - valAt(a, b0) - flow;
        if (Math.abs(g) >= 0.5) {
          tot += g;
          rows.push({a, g, open: valAt(a, b0), close: valAt(a, PE), flow});
        }
      });
    return {tot, rows};
  }
  function bridgeLines() {
    const P = perCash(),
      [PA, PE] = perRange(),
      to = P.proj ? TODAY : PE,
      W = P.fut ? [] : S.tx.filter(x => x.date >= PA && x.date <= to);
    const sm = f => W.filter(f).reduce((v, x) => v + baseAmt(x), 0),
      liq = x => isLiquid(accById(x.acc));
    const inc = sm(x => x.type === 'income' && isPL(x)),
      exp = sm(x => x.type === 'expense' && isPL(x)),
      fi = sm(x => x.type === 'income' && isFin(x)),
      fo = sm(x => x.type === 'expense' && isFin(x));
    const offCash = sm(x => x.type === 'expense' && !liq(x)) - sm(x => x.type === 'income' && !liq(x));
    const ca = cashActual(W),
      cardPay = Object.entries(ca)
        .filter(([k]) => k.startsWith('out:card:'))
        .reduce((v, [, x]) => v + x.v, 0);
    const L = (l, v, o) => Object.assign({l, v}, o || {}),
      endA = P.fut ? P.o : P.proj ? P.now : P.c;
    const out = P.fut
      ? [
          L(t('projStart'), P.o, {strong: 1, w: 'opening'}),
          L(t('expIn'), P.gi, {
            w: 'cashIn',
            s:
              P.fIn + P.xIn > 0.5
                ? t('ofWhich') +
                  ' ' +
                  t('finTitle') +
                  ' ' +
                  fmt(Math.round(P.fIn)) +
                  (P.xIn > 0.5 ? ' · ' + t('xferShort') + ' ' + fmt(Math.round(P.xIn)) : '')
                : ''
          }),
          L(t('expOut'), -P.go, {
            w: 'cashOut',
            s:
              P.fOut + P.xOut > 0.5
                ? t('ofWhich') +
                  ' ' +
                  t('finTitle') +
                  ' ' +
                  fmt(Math.round(P.fOut)) +
                  (P.xOut > 0.5 ? ' · ' + t('xferShort') + ' ' + fmt(Math.round(P.xOut)) : '')
                : ''
          }),
          L(t('projEndS'), P.c, {strong: 1, total: 1})
        ]
      : [
          L(t('openBal'), P.o, {strong: 1, w: 'opening'}),
          L(t('income'), inc, {act: 'stmtFlow', ty: 'income'}),
          L(t('expense'), -exp, {act: 'stmtFlow', ty: 'expense'}),
          L(t('finTitle'), fi - fo, {act: 'stmtFin'}),
          L(t('cardSpendNotPaid'), offCash, {act: 'goCards'}),
          L(t('cardPayNote'), -cardPay, {w: 'cardPays'}),
          L(t('xferNet'), P.xf0, {w: 'xferAct'}),
          L(t('fxDiff'), P.fx)
        ].concat(
          P.proj
            ? [
                L(t('availNow'), endA, {strong: 1, w: 'availNow'}),
                L(t('restExpected'), P.c - endA, {w: 'rest'}),
                L(t('projEndS'), P.c, {strong: 1, total: 1})
              ]
            : [L(t('closeBal'), P.c, {strong: 1, total: 1, w: 'closing'})]
        );
    return out.filter(x => x.strong || Math.abs(x.v) >= 0.5);
  }
  /* expected cash events from today up to date d (same list the forecast uses) */
  function evsUpTo(d, from) {
    const out = [];
    if (d <= TODAY) return out;
    for (let m = TODAY_YM; m <= d.slice(0, 7); m = ymAdd(m, 1))
      remainingPlan(m).forEach(e => {
        if (e.date <= d && (!from || e.date >= from)) out.push(Object.assign({m}, e));
      });
    return out;
  }
  const fcHorizon = () => {
    const endY = +TODAY.slice(0, 4) + 1 + '-12';
    let m = TODAY_YM,
      n = 0;
    while (m < endY && n < 35) {
      m = ymAdd(m, 1);
      n++;
    }
    return m;
  };
  function monthSummary(m) {
    const s0 = m + '-01',
      open = liqAll(dayBefore(s0)),
      close = liqAll(monthEnd(m) > TODAY ? TODAY : monthEnd(m)),
      ca = cashActual(txOf(m).filter(x => x.date <= TODAY)),
      rows = [];
    const grp = (p, sign) =>
      Object.entries(ca)
        .filter(([k]) => k.startsWith(p))
        .sort((a, b) => b[1].v - a[1].v)
        .map(([, x]) => ['   ' + x.label, sign * Math.round(x.v)]);
    const sm = p =>
      Object.entries(ca)
        .filter(([k]) => k.startsWith(p))
        .reduce((v, [, x]) => v + x.v, 0);
    const ii = sm('in:'),
      oo = sm('out:'),
      fi = sm('fi:') - sm('fo:'),
      xx = sm('xin:') - sm('xout:'),
      fx = close - open - (ii - oo) - fi - xx;
    rows.push(
      [t('msOpen'), Math.round(open)],
      [t('msIn'), Math.round(ii)],
      ...grp('in:', 1),
      [t('msOut'), -Math.round(oo)],
      ...grp('out:', -1)
    );
    if (Math.abs(fi) >= 1) rows.push([t('msFin'), Math.round(fi)]);
    if (Math.abs(xx) >= 1) rows.push([t('msX'), Math.round(xx)]);
    if (Math.abs(fx) >= 1) rows.push([t('msFx'), Math.round(fx)]);
    return {
      title: t('msTitle').replace('%m', monthLbl(m)),
      sub: BASE(),
      cols: [t('item'), t('amount')],
      rows,
      num: [1],
      foot: [
        [t('msClose'), Math.round(close)],
        [t('msNW'), Math.round(netWorth(monthEnd(m) > TODAY ? TODAY : monthEnd(m)).net)]
      ]
    };
  }
