/* The monthly plan: planned items, late items, plan versus actual, and month cash. (part 1 of 2) */
  /* ---------- planned (expected) amounts per month, from everything the app already knows ---------- */
  function planItems(m) {
    const out = [],
      add = (type, cat, amount, o) => {
        if (amount > 0 || (o && o.src))
          out.push(Object.assign({type, cat, amount, date: m + '-01', acc: '', label: '', done: false}, o || {}));
      };
    for (const r of S.recur || []) {
      const a = accOf(r.tpl.acc);
      if (!a || !['income', 'expense'].includes(r.tpl.type)) continue;
      S.tx
        .filter(x => x.rec === r.id && x.date.slice(0, 7) === m)
        .forEach(x => add(x.type, x.cat, baseAmt(x), {date: x.date, acc: x.acc, label: r.tpl.note, done: true}));
      let d = r.next,
        g = 0;
      while (d && (d.slice(0, 7) <= m || (r.snooze && r.snooze[d] && r.snooze[d].slice(0, 7) <= m)) && g++ < 400) {
        if (r.end && d > r.end) break;
        const de = (r.snooze && r.snooze[d]) || d;
        if (de.slice(0, 7) === m)
          add(r.tpl.type, r.tpl.cat, toBase(+r.tpl.amount, a.currency), {
            date: de,
            acc: r.tpl.acc,
            label: r.tpl.note || catName(r.tpl.cat),
            src: 'rec:' + r.id
          });
        d = advance(d, r.freq, r.day);
      }
    }
    S.inst.forEach(o =>
      instMonths(o)
        .filter(x => effM(o, x) === m)
        .forEach(x =>
          add('expense', o.cat || 'inst', toBase(+o.monthly - partOf(o, x) * (x !== m ? 1 : 0), o.currency || BASE()), {
            date: m + '-' + pad(Math.min(28, o.dueDay || 1)),
            acc: o.payWith || '',
            label: o.name,
            done: o.paid.includes(x),
            src: 'inst:' + o.id,
            ox: x,
            part: x === m ? partOf(o, x) : 0
          })
        )
    );
    S.gam.forEach(o => {
      gamMonths(o)
        .filter(x => effM(o, x) === m)
        .forEach(x =>
          add('expense', 'gam', toBase(+o.share, o.currency || BASE()), {
            date: m + '-' + pad(Math.min(28, o.dueDay || 1)),
            label: o.name,
            done: o.paid.includes(x),
            src: 'gam:' + o.id,
            ox: x,
            part: partOf(o, x)
          })
        );
      if (gamPayout(o) === m)
        add('income', 'gamin', toBase(o.share * o.members, o.currency || BASE()), {
          label: o.name,
          done: !!o.received,
          src: 'gamr:' + o.id
        });
    });
    S.loans.forEach(l => {
      const x = loanSched(l).find(z => z.m === m);
      if (x)
        add(
          l.dir === 'borrowed' ? 'expense' : 'income',
          l.dir === 'borrowed' ? 'loanpay' : 'loanback',
          toBase(x.amount, l.currency || BASE()),
          {
            label: l.person,
            done: loanOwedUpTo(l, m) === 0,
            src: 'loan:' + l.id,
            owed: Math.max(0, loanOwedUpTo(l, m) - loanOwedUpTo(l, ymAdd(m, -1)))
          }
        );
    });
    const has = new Set(out.filter(x => x.type === 'expense').map(x => x.cat));
    Object.entries(S.budgets || {}).forEach(([c, v]) => {
      if (!has.has(c)) add('expense', c, +v, {label: catName(c), src: 'bud:' + c});
    });
    const ov = (S.planOver || {})[m] || {};
    out.forEach(x => {
      if (x.src && !x.done && x.src in ov) {
        x.base = x.amount;
        x.amount = +ov[x.src];
      }
    });
    (S.planAdj || [])
      .filter(a => a.m === m)
      .forEach(a =>
        add(a.type || 'expense', a.cat, +a.amount, {
          label: a.label || catName(a.cat),
          acc: a.acc || '',
          date: a.acc ? m + '-' + pad(Math.max(+TODAY.slice(8, 10), 1)).slice(-2) : m + '-01'
        })
      );
    return out.filter(x => x.amount > 0 || (x.src && x.src in ov));
  }
  /* unpaid installments, gam'eya months and loan payments from earlier months: still due, counted from today */
  function lateItems(m) {
    if (m !== TODAY_YM) return [];
    const out = [];
    S.inst.forEach(o =>
      instMonths(o)
        .filter(x => effM(o, x) < m && !o.paid.includes(x))
        .forEach(x => {
          const v = +o.monthly - partOf(o, x);
          if (v > 0.004)
            out.push({
              type: 'expense',
              cat: o.cat || 'inst',
              amount: toBase(v, o.currency || BASE()),
              date: TODAY,
              acc: o.payWith || '',
              label: o.name + ' · ' + t('lateFrom') + ' ' + monthLbl(effM(o, x)),
              done: false,
              src: 'inst:' + o.id,
              late: 1,
              part: 0
            });
        })
    );
    S.gam.forEach(o => {
      gamMonths(o)
        .filter(x => effM(o, x) < m && !o.paid.includes(x))
        .forEach(x => {
          const v = +o.share - partOf(o, x);
          if (v > 0.004)
            out.push({
              type: 'expense',
              cat: 'gam',
              amount: toBase(v, o.currency || BASE()),
              date: TODAY,
              acc: '',
              label: o.name + ' · ' + t('lateFrom') + ' ' + monthLbl(x),
              done: false,
              src: 'gam:' + o.id,
              late: 1,
              part: 0
            });
        });
      if (!o.received && gamPayout(o) < m)
        out.push({
          type: 'income',
          cat: 'gamin',
          amount: toBase(o.share * o.members, o.currency || BASE()),
          date: TODAY,
          acc: '',
          label: o.name + ' · ' + t('lateFrom') + ' ' + monthLbl(gamPayout(o)),
          done: false,
          src: 'gamr:' + o.id,
          late: 1,
          part: 0
        });
    });
    S.loans.forEach(l => {
      const v = loanOwedUpTo(l, ymAdd(m, -1));
      if (v > 0.004)
        out.push({
          type: l.dir === 'borrowed' ? 'expense' : 'income',
          cat: l.dir === 'borrowed' ? 'loanpay' : 'loanback',
          amount: toBase(v, l.currency || BASE()),
          date: TODAY,
          acc: '',
          label: l.person + ' · ' + t('lateWord'),
          done: false,
          src: 'loan:' + l.id,
          late: 1,
          owed: v
        });
    });
    return out;
  }
  function planVsActual(months) {
    const P = {income: {}, expense: {}, fin: {}},
      A = {income: {}, expense: {}, fin: {}},
      L = {};
    months.forEach(m => {
      const cp = cashPlan(m),
        ca = cashActual(txOf(m));
      [
        [cp, P],
        [ca, A]
      ].forEach(([src, dst]) =>
        Object.entries(src).forEach(([k, x]) => {
          if (k.startsWith('x')) return;
          const ty = k.startsWith('fi:') || k.startsWith('fo:') ? 'fin' : k.startsWith('in:') ? 'income' : 'expense',
            id = k.slice(k.indexOf(':') + 1);
          const id2 = ty === 'fin' ? k : id;
          dst[ty][id2] = (dst[ty][id2] || 0) + x.v;
          L[id2] = x.label;
        })
      );
    });
    return {P, A, L};
  }
  const isLiquid = a => !!a && ['cash', 'bank', 'wallet'].includes(a.type);
  const liqAll = date => S.accounts.filter(isLiquid).reduce((v, a) => v + valAt(a, date), 0);
  /* actual money in and out of cash, bank and wallets, keyed by category (or by card for card payments) */
  function cashActual(list) {
    const r = {};
    const put = (k, l, v) => {
      if (!r[k]) r[k] = {label: l, v: 0};
      r[k].v += v;
    };
    for (const x of list) {
      const a = accOf(x.acc);
      if (!a) continue;
      const v = baseAmt(x);
      if (x.type === 'transfer') {
        const b = accOf(x.toAcc);
        if (!b) continue;
        const la = isLiquid(a),
          lb = isLiquid(b);
        if (la && !lb)
          put(
            b.type === 'card' ? 'out:card:' + b.id : 'xout:' + b.id,
            b.type === 'card' ? t('cardPayNote') + ' · ' + b.name : t('xferTo') + ' ' + b.name,
            v
          );
        else if (!la && lb) put('xin:' + a.id, t('xferFrom') + ' ' + a.name, xferBase(x));
      } else if (isLiquid(a)) {
        const rc = catRoot(x.cat),
          k = (FIN_CATS.has(rc) ? (x.type === 'income' ? 'fi:' : 'fo:') : x.type === 'income' ? 'in:' : 'out:') + rc;
        put(k, catName(rc), v);
      }
    }
    return r;
  }
