/* Where each number comes from: the breakdown shown when a number is tapped. (part 2 of 3; continues from why-1.js) */
      case 'accTot': {
        const r = S.accounts.map(a =>
          L(a.name, toBase(accBalanceAt(a, PE), a.currency), {
            plain: 1,
            act: 'stmtAcc',
            id: a.id,
            s: a.currency !== BASE() ? fmt(accBalanceAt(a, PE)) + ' ' + a.currency : ''
          })
        );
        return {
          title: t('accounts'),
          sub: dmyOf(dsDate(PE)),
          lines: r.concat([
            L(
              t('total'),
              r.reduce((v, x) => v + x.v, 0),
              {strong: 1, total: 1}
            )
          ])
        };
      }
      case 'pvaIn':
      case 'pvaOut':
      case 'pvaNet':
      case 'pvaFin': {
        const {P: Pp, A} = planVsActual(perMonths()),
          Lb = x => catName(x);
        const grp = ty =>
          [...new Set([...Object.keys(Pp[ty]), ...Object.keys(A[ty])])].map(c => ({
            c,
            p: Pp[ty][c] || 0,
            a: A[ty][c] || 0
          }));
        const sumA = ty => grp(ty).reduce((v, x) => v + x.a, 0),
          sumP = ty => grp(ty).reduce((v, x) => v + x.p, 0);
        if (k === 'pvaNet')
          return {
            title: t('netShort'),
            sub: perLabel() + ' · ' + t('cashBanks'),
            lines: [
              L(t('cashIn'), sumA('income'), {w: 'pvaIn', s: t('planned') + ' ' + fmt(sumP('income'))}),
              L(t('cashOut'), -sumA('expense'), {w: 'pvaOut', s: t('planned') + ' ' + fmt(sumP('expense'))}),
              L(t('netShort'), sumA('income') - sumA('expense'), {
                strong: 1,
                total: 1,
                s: t('planned') + ' ' + fmt(sumP('income') - sumP('expense'))
              })
            ]
          };
        if (k === 'pvaFin') {
          const g = grp('fin').map(x => ({...x, sg: x.c.startsWith('fi:') ? 1 : -1}));
          return {
            title: t('finTitle'),
            sub: perLabel(),
            lines: g
              .map(x =>
                L(
                  Pp.fin[x.c] != null || A.fin[x.c] != null ? (x.sg > 0 ? '+ ' : '− ') + catName(x.c.slice(3)) : '',
                  x.sg * x.a,
                  {s: t('planned') + ' ' + fmt(x.p), act: 'stmtFin'}
                )
              )
              .concat([
                L(
                  t('total'),
                  g.reduce((v, x) => v + x.sg * x.a, 0),
                  {strong: 1, total: 1, s: t('planned') + ' ' + fmt(g.reduce((v, x) => v + x.sg * x.p, 0))}
                )
              ])
          };
        }
        const ty = k === 'pvaIn' ? 'income' : 'expense',
          sg = ty === 'income' ? 1 : -1,
          g = grp(ty).sort((a, b) => b.a - a.a);
        return {
          title: (ty === 'income' ? t('cashIn') : t('cashOut')) + ' · ' + t('actual'),
          sub: perLabel() + ' · ' + t('cashBanks'),
          lines: g
            .map(x =>
              L(
                x.c.startsWith('card:')
                  ? t('cardPayNote') + ' · ' + ((accById(x.c.slice(5)) || {}).name || '')
                  : Lb(x.c),
                sg * x.a,
                {
                  s: t('planned') + ' ' + fmt(x.p),
                  act: x.c.startsWith('card:') ? 'stmtAcc' : 'planCat',
                  id: x.c.startsWith('card:') ? x.c.slice(5) : x.c,
                  ty
                }
              )
            )
            .concat([L(t('total'), sg * sumA(ty), {strong: 1, total: 1, s: t('planned') + ' ' + fmt(sumP(ty))})])
        };
      }
      case 'fcEnd':
      case 'fcLow': {
        const sr = fcSeries(fcHorizon()),
          tgt = k === 'fcEnd' ? sr[sr.length - 1] : sr.reduce((a, r) => (r.bal < a.bal ? r : a), sr[0]);
        const ls = [L(t('availNow'), liqAll(TODAY), {strong: 1, w: 'availNow'})];
        for (const r of sr) {
          let n, si, so;
          if (r.kind === 'cur') {
            const ev = remainingPlan(r.m),
              sm = f => ev.filter(f).reduce((v, e) => v + e.amt, 0);
            si = sm(e => e.dir === 'in' && e.kind !== 'xfer' && !e.fin);
            so = sm(e => e.dir === 'out' && e.kind !== 'xfer' && !e.fin);
            n = r.bal - liqAll(TODAY);
          } else {
            si = r.i;
            so = r.e;
            n = r.bal - r.open;
          }
          ls.push(
            L((r.kind === 'cur' ? t('restOf') + ' ' : '') + monthLbl(r.m), n, {
              act: 'fcMonth',
              id: r.m,
              s:
                t('cashIn') +
                ' ' +
                fmt(Math.round(si)) +
                ' · ' +
                t('cashOut') +
                ' ' +
                fmt(Math.round(so)) +
                (Math.abs(n - (si - so)) > 0.5
                  ? ' · ' + t('finTitle') + '/' + t('transfers') + ' ' + fmt(Math.round(n - (si - so)))
                  : '')
            })
          );
          if (r.m === tgt.m) break;
        }
        ls.push(L(k === 'fcEnd' ? t('endBal') : t('lowestBal'), tgt.bal, {strong: 1, total: 1}));
        return {
          title: k === 'fcEnd' ? t('endBal') : t('lowestBal'),
          sub: monthLbl(tgt.m) + ' · ' + t('fromToday'),
          lines: ls,
          go: {act: 'cashSheet', l: t('willLast')}
        };
      }
      case 'fcGap': {
        const sr = fcSeries(fcHorizon()),
          r = sr.find(z => z.gi - z.go < -0.5);
        if (!r) return null;
        return {
          title: t('firstGap'),
          sub: monthLbl(r.m),
          lines: [L(t('cashIn'), r.gi), L(t('cashOut'), -r.go), L(t('gapW'), r.gi - r.go, {strong: 1, total: 1})],
          go: {act: 'fcMonth', id: r.m, l: monthLbl(r.m)},
          note: t('gapNote')
        };
      }
      case 'catExp':
      case 'catInc': {
        const ty = k === 'catExp' ? 'expense' : 'income',
          by = new Map();
        txIn()
          .filter(x => x.type === ty && isPL(x))
          .forEach(x => {
            const c = catRoot(x.cat);
            by.set(c, (by.get(c) || 0) + baseAmt(x));
          });
        const r = [...by]
          .sort((a, b) => b[1] - a[1])
          .map(([c, v]) =>
            L(catName(c), v, {plain: 1, act: catKids(ty, c).length ? 'catGroup' : 'stmtCat', id: c, ty})
          );
        return {
          title: ty === 'expense' ? t('expByCat') : t('incByCat'),
          sub: perLabel(),
          lines: r.concat([
            L(
              t('total'),
              r.reduce((v, x) => v + x.v, 0),
              {strong: 1, total: 1}
            )
          ]),
          go: {act: 'stmtFlow', l: t('statement')}
        };
      }
      case 'avgIn':
      case 'avgOut':
      case 'avgNet': {
        const ml = per.mode === 'month' ? Array.from({length: 6}, (_, i) => ymAdd(cur, i - 5)) : perMonths().slice(-24),
          ms = ml.map(m => {
            const x = txOf(m);
            return {
              m,
              i: sumB(x.filter(y => y.type === 'income' && isPL(y))),
              e: sumB(x.filter(y => y.type === 'expense' && isPL(y)))
            };
          });
        const f = o => (k === 'avgIn' ? o.i : k === 'avgOut' ? o.e : o.i - o.e),
          tot = ms.reduce((v, o) => v + f(o), 0);
        return {
          title: k === 'avgIn' ? t('avgIn') : k === 'avgOut' ? t('avgOut') : t('netShort'),
          sub: monthLbl(ml[0]) + ' → ' + monthLbl(ml[ml.length - 1]),
          lines: ms
            .map(o => L(monthLbl(o.m), f(o), {plain: 1}))
            .concat([
              L(t('total'), tot, {plain: 1}),
              L(t('avgW') + ' ÷ ' + ms.length, Math.round(tot / ms.length), {strong: 1, total: 1})
            ])
        };
      }
      case 'zakat': {
        const z = zakatCalc();
        if (!z.price) return null;
        return {
          title: t('zakat'),
          sub: t('asOfToday'),
          lines: [
            L(t('zkCash'), z.cash, {w: 'nwAcc'}),
            z.gold ? L(t('zkGoldVal'), z.gold) : null,
            z.recvOn ? L(t('owedToMe'), z.recv, {act: 'goLoans'}) : null,
            z.debtOn ? L(t('iOwe'), -z.debt, {act: 'goLoans'}) : null,
            L(t('zkBase'), z.base, {strong: 1}),
            L(t('nisab') + ' (85 ' + t('gram') + ' × ' + fmt(z.price) + ')', z.nisab, {plain: 1}),
            L(z.due ? '× 2.5%' : t('zkNotDue'), z.due ? z.base * 0.025 : 0, {strong: 1, total: 1})
          ].filter(Boolean)
        };
      }
      case 'oDue':
      case 'oPaid':
      case 'oLeft': {
        const kk = oblTab === 'gam' ? 'gam' : 'inst',
          L0 = oblBase(kk),
          f = k === 'oDue' ? st => st.due + st.late : k === 'oPaid' ? st => st.paidP : st => st.left;
        const r = L0.map(o => {
          const st = oblStats(kk, o);
          return L(o.name, f(st), {
            plain: 1,
            act: 'stmtObl',
            id: o.id,
            ty: kk,
            s:
              k === 'oDue'
                ? st.late > 0.5
                  ? t('plusLate') + ' ' + fmt(Math.round(st.late))
                  : ''
                : k === 'oPaid'
                  ? t('sinceStart') + ': ' + fmt(Math.round(st.paidCum))
                  : t('ofTotal') +
                    ' ' +
                    fmt(Math.round(st.total)) +
                    (st.waived > 0.5 ? ' · ' + t('waivedLbl') + ' ' + fmt(Math.round(st.waived)) : '')
          });
        }).filter(x => Math.abs(x.v) >= 0.5);
        const tot = r.reduce((v, x) => v + x.v, 0);
        return {
          title:
            (kk === 'inst' ? t('installments') : t('gameyas')) +
            ' · ' +
            (k === 'oDue' ? t('dueLbl') : k === 'oPaid' ? t('paidLbl') : t('remaining')),
          sub: perLabel(),
          lines: r.concat([L(t('total'), tot, {strong: 1, total: 1})]),
          note: k === 'oDue' ? t('dueWhyNote') : k === 'oPaid' ? t('paidWhyNote') : t('leftWhyNote')
        };
      }
      case 'lLent':
      case 'lBorrowed':
      case 'lNet': {
        const L0 = oblBase('loan'),
          r = L0.filter(l => k === 'lNet' || l.dir === (k === 'lLent' ? 'lent' : 'borrowed'))
            .map(l =>
              L(
                l.person + (l.note ? ' · ' + l.note : ''),
                (l.dir === 'lent' ? 1 : -1) *
                  (k === 'lNet' ? 1 : l.dir === 'lent' ? 1 : -1) *
                  toBase(loanLeftAt(l, PE), l.currency || BASE()),
                {plain: 1, act: 'stmtPerson', id: l.person}
              )
            )
            .filter(x => Math.abs(x.v) >= 0.5);
        return {
          title: k === 'lLent' ? t('owedToMe') : k === 'lBorrowed' ? t('iOwe') : t('netShort'),
          sub: dmyOf(dsDate(PE)),
          lines: r.concat([
            L(
              t('total'),
              r.reduce((v, x) => v + x.v, 0),
              {strong: 1, total: 1}
            )
          ])
        };
      }
