/* The monthly plan: planned items, late items, plan versus actual, and month cash. (part 2 of 2; continues from plan-1.js) */
  function cashPlan(m) {
    const r = {};
    const put = (k, l, v) => {
      if (v <= 0.004) return;
      if (!r[k]) r[k] = {label: l, v: 0};
      r[k].v += v;
    };
    for (let i = -3; i <= 0; i++) {
      const pm = ymAdd(m, i);
      for (const it of i === 0 ? planItems(pm).concat(lateItems(pm)) : planItems(pm)) {
        const a = accById(it.acc);
        if (a && a.type === 'card') {
          if (it.type === 'expense' && !it.done && (it.date >= TODAY || pm === TODAY_YM)) {
            const due = cardDueFor(a, it.date < TODAY ? TODAY : it.date);
            if (due.slice(0, 7) === m) put('out:card:' + a.id, t('cardPayNote') + ' · ' + a.name, it.amount);
          }
        } else if (i === 0) {
          const rc = catRoot(it.cat);
          put(
            (FIN_CATS.has(rc) ? (it.type === 'income' ? 'fi:' : 'fo:') : it.type === 'income' ? 'in:' : 'out:') + rc,
            catName(rc),
            it.amount
          );
        }
      }
    }
    cards().forEach(a => {
      const c = cardInfo(a);
      if (!c.owed) return;
      const parts = a.closeDay
        ? [
            [c.due, c.dueDate],
            [c.cycle, cardDueFor(a, c.nextClose)]
          ]
        : [[c.owed, cardDueFor(a, TODAY)]];
      parts.forEach(([v, d]) => {
        if (v > 0 && d) {
          const dm = d.slice(0, 7) < TODAY_YM ? TODAY_YM : d.slice(0, 7);
          if (dm === m) put('out:card:' + a.id, t('cardPayNote') + ' · ' + a.name, toBase(v, a.currency));
        }
      });
    });
    if (m <= TODAY_YM) {
      const ac = cashActual(txOf(m));
      Object.entries(ac)
        .filter(([k]) => k.startsWith('out:card:'))
        .forEach(([k, x]) => put(k, x.label, x.v));
    }
    const ov = (S.planOver || {})[m] || {};
    cards().forEach(a => {
      const k = 'out:card:' + a.id,
        src = 'card:' + a.id;
      if (src in ov) {
        if (!r[k]) r[k] = {label: t('cardPayNote') + ' · ' + a.name, v: 0};
        r[k].base = r[k].v;
        r[k].v = +ov[src];
      }
    });
    return r;
  }
  /* past months = actual; this month = the larger of actual and plan per line (card payments add up); later months = plan */
  function monthCash(m) {
    const act = cashActual(txOf(m));
    const sum = (o, p) =>
      Object.entries(o)
        .filter(([k]) => k.startsWith(p))
        .reduce((v, [, x]) => v + x.v, 0);
    const xn = o => sum(o, 'xin:') - sum(o, 'xout:'),
      fn = o => sum(o, 'fi:') - sum(o, 'fo:');
    const gr = o => ({fi: sum(o, 'fi:'), fo: sum(o, 'fo:'), xi: sum(o, 'xin:'), xo: sum(o, 'xout:')}),
      gre = rem => {
        const z = {fi: 0, fo: 0, xi: 0, xo: 0};
        rem.forEach(e => {
          if (e.kind === 'xfer') z[e.dir === 'in' ? 'xi' : 'xo'] += e.amt;
          else if (e.fin) z[e.dir === 'in' ? 'fi' : 'fo'] += e.amt;
        });
        return z;
      };
    if (m < TODAY_YM)
      return Object.assign(
        {i: sum(act, 'in:'), e: sum(act, 'out:'), x: xn(act), f: fn(act), kind: 'act', lines: act},
        gr(act)
      );
    const pl = cashPlan(m);
    /* later months: the plan less what was already paid ahead, plus entries already recorded with a date in that month (moves between your accounts kept apart) */
    if (m > TODAY_YM) {
      const rem = remainingPlan(m),
        rs = d => rem.filter(e => e.dir === d && e.kind !== 'xfer' && !e.fin).reduce((v, e) => v + e.amt, 0),
        net = f => rem.filter(f).reduce((v, e) => v + (e.dir === 'in' ? e.amt : -e.amt), 0);
      return Object.assign(
        {i: rs('in'), e: rs('out'), x: net(e => e.kind === 'xfer'), f: net(e => e.fin), kind: 'plan', lines: pl},
        gre(rem)
      );
    }
    /* this month: the row shows the plan as it is; the balance also takes into account where actual already went past the plan */
    const lines = {},
      dev = [];
    new Set([...Object.keys(pl), ...Object.keys(act)].filter(k => !k.startsWith('x') && !k.startsWith('f'))).forEach(
      k => {
        const p = pl[k] ? pl[k].v : 0,
          a = act[k] ? act[k].v : 0;
        lines[k] = {label: (pl[k] || act[k]).label, v: Math.max(p, a), a, p};
        if (a - p > 0.5) dev.push({k, label: lines[k].label, v: a - p});
      }
    );
    const sp = pfx =>
      Object.entries(lines)
        .filter(([k]) => k.startsWith(pfx))
        .reduce((v, [, x]) => v + x.p, 0);
    /* projected for the whole month = what already happened up to today + what is still to come (same calculation as "will the money last?") */
    const past = cashActual(txOf(m).filter(x => x.date <= TODAY)),
      rem = remainingPlan(m),
      rs = d => rem.filter(e => e.dir === d && e.kind !== 'xfer' && !e.fin).reduce((v, e) => v + e.amt, 0),
      rx = rem.filter(e => e.kind === 'xfer').reduce((v, e) => v + (e.dir === 'in' ? e.amt : -e.amt), 0),
      rf = rem.filter(e => e.fin).reduce((v, e) => v + (e.dir === 'in' ? e.amt : -e.amt), 0);
    const g1 = gr(past),
      g2 = gre(rem);
    return {
      i: sp('in:'),
      e: sp('out:'),
      iMax: sum(past, 'in:') + rs('in'),
      eMax: sum(past, 'out:') + rs('out'),
      x: xn(past) + rx,
      f: fn(past) + rf,
      kind: 'cur',
      lines,
      dev,
      fi: g1.fi + g2.fi,
      fo: g1.fo + g2.fo,
      xi: g1.xi + g2.xi,
      xo: g1.xo + g2.xo
    };
  }
