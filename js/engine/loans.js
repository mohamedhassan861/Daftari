/* Loans: schedule, paid, owed up to a date, remaining, and the origin amount. */
  const loanPaid = l => sum(l.pays);
  /* a loan repaid in monthly installments: [{m, amount}] from the start month until the amount is covered */
  function loanSched(l) {
    const base = loanSched0(l);
    if (!(l.adj && l.adj.length)) return base;
    const mm = {};
    base.forEach(x => (mm[x.m] = (mm[x.m] || 0) + x.amount));
    l.adj.forEach(x => (mm[x.m] = (mm[x.m] || 0) + (+x.amount || 0)));
    return Object.keys(mm)
      .sort()
      .map(m => ({m, amount: Math.round(mm[m] * 100) / 100}))
      .filter(x => Math.abs(x.amount) > 0.004);
  }
  function loanSched0(l) {
    if (l.plan === 'inst' && +l.instAmt > 0 && l.instStart) {
      const base = Math.min(Math.max(0, +l.instBase || 0), +l.amount),
        out = [];
      if (base > 0.004) {
        const lm = (l.date || l.instStart).slice(0, 7);
        out.push({m: lm < l.instStart ? lm : ymAdd(l.instStart, -1), amount: Math.round(base * 100) / 100});
      }
      let left = +l.amount - base,
        m = l.instStart,
        g = 0;
      while (left > 0.004 && g++ < 600) {
        const v = Math.min(+l.instAmt, left);
        out.push({m, amount: Math.round(v * 100) / 100});
        left -= v;
        m = ymAdd(m, 1);
      }
      return out;
    }
    return l.due ? [{m: l.due, amount: +l.amount}] : [];
  }
  /* still owed on the schedule up to month m (payments cover the earliest months first) */
  const loanOwedUpTo = (l, m) =>
    Math.max(
      0,
      Math.round(
        (loanSched(l)
          .filter(x => x.m <= m)
          .reduce((v, x) => v + x.amount, 0) -
          loanPaid(l)) *
          100
      ) / 100
    );
  const loanAdj = l => (l.adj || []).reduce((v, x) => v + (+x.amount || 0), 0);
  const loanOrigAmt = (l, amt) => Math.round(((amt ?? +l.amount) - sum(l.adds || []) - (+l.folded || 0)) * 100) / 100;
  const loanLeft = l => Math.max(0, l.amount + loanAdj(l) - loanPaid(l));
