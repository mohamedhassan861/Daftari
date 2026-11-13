/* Matching a bank or card statement with the app's entries on one account. */
  /* the effect of one entry on one account, the same way the account balance counts it */
  function accEffect(x, id) {
    if (x.type === 'transfer') {
      if (x.acc === id) return -(+x.amount || 0);
      if (x.toAcc === id) return +(x.toAmount ?? x.amount) || 0;
      return 0;
    }
    if (x.acc !== id) return 0;
    return x.type === 'income' ? +x.amount || 0 : -(+x.amount || 0);
  }
  const ymdShift = (s, n) => iso(new Date(dOf(s).getTime() + n * 864e5));
  const daysApart = (a, b) => Math.abs(dOf(a) - dOf(b)) / 864e5;
  const cents = v => Math.round(v * 100);
  /* subset of items (nearest first) whose cents add up to target; gives up after a fixed amount of work */
  function sumSubset(items, target) {
    let work = 0;
    const pick = [];
    const go = (i, left) => {
      if (left === 0) return pick.length >= 2;
      if (i >= items.length || ++work > 40000) return false;
      const c = items[i].c;
      if (c <= left) {
        pick.push(items[i]);
        if (go(i + 1, left - c)) return true;
        pick.pop();
      }
      return go(i + 1, left);
    };
    return go(0, target) ? pick.slice() : null;
  }
  /* lines: from stmtParse; txs: all entries. Steps: same amount within a few days, then one entry = several bank lines
     (a total the user entered for several days), then one bank line = several entries. What is left is reported. */
  function stmtMatch(lines, txs, accId, isCard) {
    if (!lines.length) return {pairs: [], groups: [], many: [], bankOnly: [], appOnly: []};
    const from = lines.reduce((a, l) => (l.date < a ? l.date : a), lines[0].date),
      to = lines.reduce((a, l) => (l.date > a ? l.date : a), lines[0].date),
      tol = isCard ? 7 : 3;
    const bank = lines.map(l => ({l, c: cents(l.amt), used: false})),
      app = txs
        .map(x => ({x, c: cents(accEffect(x, accId)), used: false}))
        .filter(a => a.c !== 0 && a.x.date >= ymdShift(from, -tol) && a.x.date <= ymdShift(to, tol));
    const pairs = [],
      groups = [],
      many = [];
    const cand = [];
    bank.forEach(b =>
      app.forEach(a => {
        if (a.c === b.c) {
          const d = daysApart(a.x.date, b.l.date);
          if (d <= tol) cand.push([d, b, a]);
        }
      })
    );
    cand.sort((p, q) => p[0] - q[0] || p[1].l.i - q[1].l.i);
    cand.forEach(([, b, a]) => {
      if (b.used || a.used) return;
      b.used = a.used = true;
      pairs.push({l: b.l, x: a.x});
    });
    /* a total entered for several days: bank lines up to a month before it (and a few days after), same direction */
    app
      .filter(a => !a.used)
      .sort((p, q) => (p.x.date < q.x.date ? -1 : 1))
      .forEach(a => {
        const lo = ymdShift(a.x.date, -31),
          hi = ymdShift(a.x.date, tol);
        const pool = bank
          .filter(b => !b.used && Math.sign(b.c) === Math.sign(a.c) && b.l.date >= lo && b.l.date <= hi)
          .map(b => ({b, c: Math.abs(b.c), d: daysApart(b.l.date, a.x.date)}))
          .sort((p, q) => p.d - q.d)
          .slice(0, 30);
        const hit = sumSubset(pool, Math.abs(a.c));
        if (!hit) return;
        a.used = true;
        hit.forEach(h => (h.b.used = true));
        groups.push({x: a.x, lines: hit.map(h => h.b.l).sort((p, q) => p.i - q.i)});
      });
    /* one bank line split into several entries in the app */
    bank
      .filter(b => !b.used)
      .forEach(b => {
        const pool = app
          .filter(a => !a.used && Math.sign(a.c) === Math.sign(b.c) && daysApart(a.x.date, b.l.date) <= tol)
          .map(a => ({a, c: Math.abs(a.c), d: daysApart(a.x.date, b.l.date)}))
          .sort((p, q) => p.d - q.d)
          .slice(0, 20);
        const hit = sumSubset(pool, Math.abs(b.c));
        if (!hit) return;
        b.used = true;
        hit.forEach(h => (h.a.used = true));
        many.push({l: b.l, xs: hit.map(h => h.a.x)});
      });
    return {
      pairs,
      groups,
      many,
      bankOnly: bank.filter(b => !b.used).map(b => b.l),
      /* entries just outside the statement dates are only used for matching, not reported */
      appOnly: app.filter(a => !a.used && a.x.date >= from && a.x.date <= to).map(a => a.x),
      from,
      to
    };
  }
  /* routing suggested for a bank line: what the same description got last time on this account, else a clear keyword */
  function stmtSuggest(l, accId) {
    const key = s => stmtNorm(s).replace(/\d+/g, '').replace(/\s+/g, ' ').trim().slice(0, 28);
    const k = key(l.desc);
    if (k.length >= 4) {
      const prev = [...S.tx]
        .filter(
          x =>
            x.note &&
            accEffect(x, accId) !== 0 &&
            Math.sign(accEffect(x, accId)) === Math.sign(l.amt) &&
            key(x.note) === k
        )
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      if (prev)
        return prev.type === 'transfer' ? 'acc:' + (prev.acc === accId ? prev.toAcc : prev.acc) : 'cat:' + prev.cat;
    }
    const d = stmtNorm(l.desc),
      first = ty => (S.accounts.find(a => a.type === ty && a.id !== accId && !a.closed) || {}).id;
    if (l.amt < 0 && /\batm\b|صراف|سحب نقدي|cash withdrawal/.test(d) && first('cash')) return 'acc:' + first('cash');
    if (l.amt < 0 && /card payment|credit card|سداد (بطاقه|كارت|الكارت|البطاقه)/.test(d) && first('card'))
      return 'acc:' + first('card');
    if (l.amt > 0 && accOf(accId).type === 'card' && /payment|thank you|سداد/.test(d) && first('bank'))
      return 'acc:' + first('bank');
    return '';
  }
