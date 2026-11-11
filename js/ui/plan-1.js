/* The plan screens. (part 1 of 2) */
  function fcMonthSheet(m) {
    const r = monthCash(m),
      row = (l, v, c) =>
        `<div class="row"><div class="main"><span class="t">${esc(l)}</span></div><b class="amt ${c || ''}">${money(v)}</b></div>`;
    const part = p =>
      Object.entries(r.lines)
        .filter(([k]) => k.startsWith(p))
        .sort((a, b) => b[1].v - a[1].v)
        .map(([k, x]) =>
          row(
            x.label + (r.kind === 'cur' && x.a ? ' (' + t('actual') + ' ' + fmt(x.a) + ')' : ''),
            x.v,
            p === 'in:' ? 'pos' : ''
          )
        )
        .join('') || `<div class="empty">${t('noItems')}</div>`;
    const P = cashPlan(m),
      A = cashActual(txOf(m));
    const cmpSec = p => {
      const keys = [...new Set([...Object.keys(P), ...Object.keys(A)])]
        .filter(k => k.startsWith(p))
        .sort(
          (a, b) =>
            Math.max((P[b] || {}).v || 0, (A[b] || {}).v || 0) - Math.max((P[a] || {}).v || 0, (A[a] || {}).v || 0)
        );
      let tp = 0,
        ta = 0;
      const rows = keys
        .map(k => {
          const pv = (P[k] || {}).v || 0,
            av = (A[k] || {}).v || 0;
          tp += pv;
          ta += av;
          const d = p === 'in:' ? av - pv : pv - av;
          return `<div class="cmp"><span>${esc((P[k] || A[k]).label)}</span><span>${money(pv)}</span><span>${money(av)}</span><b class="${d < -0.5 ? 'neg' : d > 0.5 ? 'pos' : ''}">${d > 0.5 ? '+' : ''}${money(d)}</b></div>`;
        })
        .join('');
      const d = p === 'in:' ? ta - tp : tp - ta;
      return {
        html: `<div class="grp"><span>${p === 'in:' ? t('cashIn') : t('cashOut')}</span></div>${rows || `<div class="empty">${t('noItems')}</div>`}<div class="cmp t"><span>${t('total')}</span><span>${money(tp)}</span><span>${money(ta)}</span><b class="${d < -0.5 ? 'neg' : d > 0.5 ? 'pos' : ''}">${d > 0.5 ? '+' : ''}${money(d)}</b></div>`,
        tp,
        ta
      };
    };
    const CI = cmpSec('in:'),
      CO = cmpSec('out:'),
      np = CI.tp - CO.tp,
      na = CI.ta - CO.ta;
    const sumP = (o, p) =>
      Object.entries(o)
        .filter(([k]) => k.startsWith(p))
        .reduce((v, [, x]) => v + x.v, 0);
    const ai = sumP(A, 'in:'),
      ao = sumP(A, 'out:'),
      pi = sumP(P, 'in:'),
      po = sumP(P, 'out:');
    const three = (i, o, cls) =>
      `<div class="flowb"><div><span>${t('cashIn')}</span><b class="${cls ? '' : 'pos'}">${money(i)}</b></div><div><span>${t('cashOut')}</span><b>${money(o)}</b></div><div><span>${t('netShort')}</span><b class="${i - o < 0 ? 'neg' : 'pos'}">${money(i - o)}</b></div></div>`;
    const fI = o => sumP(o, 'fi:') + sumP(o, 'xin:'),
      fO = o => sumP(o, 'fo:') + sumP(o, 'xout:'),
      frow = o =>
        fI(o) + fO(o) > 0.5
          ? `<div class="ln" style="padding:0 12px 6px;font-size:12px"><span>${t('ofWhich')} 🤝 ${t('finTitle')} / ⇄ ${t('xferShort')}</span><b>${fI(o) > 0.5 ? '+' + money(fI(o)) : ''}${fI(o) > 0.5 && fO(o) > 0.5 ? ' · ' : ''}${fO(o) > 0.5 ? '−' + money(fO(o)) : ''}</b></div>`
          : '';
    const ax = sumP(A, 'xin:') - sumP(A, 'xout:'),
      xrow =
        Math.abs(ax) > 0.5
          ? `<div class="ln" style="padding:0 12px 6px"><span>⇄ ${t('xferNet')}</span><b>${ax > 0 ? '+' : '−'}${money(Math.abs(ax))}</b></div>`
          : '';
    const lines = o => {
      const L = Object.entries(o)
        .filter(([k]) => !k.startsWith('x') && !k.startsWith('f'))
        .sort((a, b) => b[1].v - a[1].v);
      return L.length
        ? `<details><summary>${t('showLines')} ›</summary>${L.map(([k, x]) => `<div class="ln"><span>${k.startsWith('in:') ? '+' : '−'} ${esc(x.label)}</span><b class="${k.startsWith('in:') ? 'pos' : ''}">${money(x.v)}</b></div>`).join('')}</details>`
        : '';
    };
    const sg = (v, goodUp) => {
      const c = Math.abs(v) < 0.5 ? '' : v > 0 === goodUp ? 'pos' : 'neg';
      return `<b class="${c}">${v > 0.5 ? '+' : ''}${money(v)}</b>`;
    };
    openSheet(
      monthLbl(m),
      `<div class="form">
    <div class="blk act"><div class="blk-h"><span>● ${t('actual')}</span><small class="muted">${m > TODAY_YM ? t('notYet') : t('cashBanks')}</small></div>${three(ai + fI(A), ao + fO(A))}${frow(A)}${lines(A)}</div>
    <div class="blk plan"><div class="blk-h"><span>● ${t('planned')}</span><small class="muted">${t('cashBanks')}</small></div>${three(pi + fI(P), po + fO(P))}${frow(P)}${lines(P)}</div>
    ${
      m >= TODAY_YM
        ? (() => {
            const sr = fcSeries(m),
              me = sr[sr.length - 1],
              nowBal = liqAll(TODAY),
              curRem = remainingPlan(TODAY_YM).reduce((v, e) => v + (e.dir === 'in' ? e.amt : -e.amt), 0);
            const steps = [
              `<div class="ln"><span>${t('nowHave')} (${esc(shortDate(TODAY))})</span><b>${money(nowBal)}</b></div>`
            ];
            let run = nowBal;
            const lines = mm =>
              monthLines(mm)
                .map(
                  e =>
                    `<div class="ln" style="padding-inline-start:14px;font-size:12px"><span>${e.dir === 'in' ? '+' : '−'} ${esc(e.label)}</span><b class="${e.dir === 'in' ? 'pos' : ''}">${money(e.amt)}</b></div>`
                )
                .join('');
            const step = (lbl, n, mm) =>
              `<details class="ln" style="display:block"><summary style="display:flex;justify-content:space-between;gap:8px;color:inherit;font-size:13px"><span>${n < 0 ? '−' : '+'} ${lbl} ›</span><b class="${n < 0 ? 'neg' : 'pos'}">${money(Math.abs(n))}</b></summary>${lines(mm)}</details>`;
            if (m > TODAY_YM) {
              run += curRem;
              steps.push(step(t('restOf') + ' ' + esc(monthLbl(TODAY_YM)), curRem, TODAY_YM));
              sr.slice(1, -1).forEach(x => {
                const n = x.i - x.e + (x.x || 0) + (x.f || 0);
                run += n;
                steps.push(step(t('gapW') + ' ' + esc(monthLbl(x.m)), n, x.m));
              });
            }
            steps.push(
              `<div class="ln"><span><b>= ${m > TODAY_YM ? t('availStart') + ' ' + esc(monthLbl(m)) : t('nowHave')}</b></span><b>${money(m > TODAY_YM ? me.open : nowBal)}</b></div>`
            );
            const net = me.bal - me.open;
            return `<div class="blk plan"><div class="blk-h"><span>● ${t('availEnd')}</span></div>
        <div class="flowb"><div><span>${t('carried')}</span><b class="${me.open < 0 ? 'neg' : ''}">${money(me.open)}</b></div><div><span>${net < 0 ? '−' : '+'} ${t('gapW')}</span><b class="${net < 0 ? 'neg' : 'pos'}">${money(Math.abs(net))}</b></div><div><span>= ${t('availEnd')}</span><b class="${me.bal < 0 ? 'neg' : ''}">${money(me.bal)}</b></div></div>
        <details><summary>${t('whereFrom')} ›</summary>${steps.join('')}</details></div>`;
          })()
        : ''
    }
    <div class="blk"><div class="blk-h"><span>${t('diffActPlan')}</span></div><div class="flowb"><div><span>${t('cashIn')}</span>${sg(ai - pi, true)}</div><div><span>${t('cashOut')}</span>${sg(ao - po, false)}</div><div><span>${t('netShort')}</span>${sg(ai - ao - (pi - po), true)}</div></div></div>
    <div class="blk plan" style="padding-bottom:8px"><div class="blk-h"><span>✎ ${t('editPlan')}</span></div>
    ${(() => {
      const adj = (S.planAdj || []).map((a, i) => ({a, i})).filter(z => z.a.m === m);
      const tin = adj.filter(z => z.a.type === 'income').reduce((v, z) => v + +z.a.amount, 0),
        tout = adj.filter(z => z.a.type !== 'income').reduce((v, z) => v + +z.a.amount, 0);
      return adj.length
        ? `<div class="grp"><span>${t('extraPlan')}</span></div><div class="flowb" style="border-top:0;padding:6px 12px"><div><span>${t('cashIn')}</span><b class="pos">${money(tin)}</b></div><div><span>${t('cashOut')}</span><b>${money(tout)}</b></div><div><span>${t('netShort')}</span><b class="${tin - tout < 0 ? 'neg' : 'pos'}">${money(tin - tout)}</b></div></div><div class="list">${adj.map(({a, i}) => `<div class="row tap" data-adje="${i}"><div class="main"><span class="t">${esc(a.label || catName(a.cat))} ›</span><span class="s">${a.type === 'income' ? t('inc1') : t('exp1')}</span></div><b class="amt ${a.type === 'income' ? 'pos' : ''}">${money(a.amount)}</b><button type="button" class="btn sm danger" data-adj="${i}">${t('del')}</button></div>`).join('')}</div>`
        : '';
    })()}
    ${(() => {
      const cp = cashPlan(m),
        it = planItems(m)
          .filter(x => x.src && !x.done)
          .map(x => {
            const a = accById(x.acc);
            return a && a.type === 'card'
              ? Object.assign(x, {
                  onCard: a,
                  payD: cardDueFor(a, x.date < TODAY ? TODAY : x.date),
                  payM: cardDueFor(a, x.date < TODAY ? TODAY : x.date).slice(0, 7)
                })
              : x;
          })
          .concat(
            cards()
              .filter(a => cp['out:card:' + a.id])
              .map(a => {
                const z = cp['out:card:' + a.id];
                return {
                  type: 'expense',
                  cat: 'other',
                  amount: z.v,
                  base: z.base,
                  label: z.label,
                  src: 'card:' + a.id,
                  card: 1
                };
              })
          );
      const tin = it.filter(x => x.type === 'income').reduce((v, x) => v + x.amount, 0),
        tout = it.filter(x => x.type !== 'income' && !x.onCard).reduce((v, x) => v + x.amount, 0);
      return it.length
        ? `<div class="grp"><span>${t('planLines')}</span></div><div class="flowb" style="border-top:0;padding:6px 12px"><div><span>${t('cashIn')}</span><b class="pos">${money(tin)}</b></div><div><span>${t('cashOut')}</span><b>${money(tout)}</b></div><div><span>${t('netShort')}</span><b class="${tin - tout < 0 ? 'neg' : 'pos'}">${money(tin - tout)}</b></div></div><div class="list">${it.map(x => `<div class="row tap" data-pe="${esc(x.src)}" data-pl="${esc(x.label)}" data-pv="${x.amount}" data-pb="${x.base ?? x.amount}"><div class="main"><span class="t">${esc(x.label)}${x.base != null ? ' ✎' : ''} ›</span><span class="s">${x.card ? t('cardPayLine') : x.onCard ? '💳 ' + esc(x.onCard.name) + ' · ' + t('paidIn') + ' ' + esc(shortDate(x.payD)) + (x.onCard.closeDay ? '' : ' ⚠️') : (x.type === 'income' ? t('inc1') : t('exp1')) + ' · ' + esc(catName(catRoot(x.cat)))}${x.base != null ? ' · ' + t('usually') + ' ' + fmt(x.base) : ''}</span></div><b class="amt ${x.type === 'income' ? 'pos' : ''}">${money(x.amount)}</b></div>`).join('')}</div><p class="hint">${t('planLinesHint')}</p>`
        : '';
    })()}
    <div style="padding:0 10px"><button type="button" class="btn block" id="adjAdd">+ ${t('addPlan')}</button></div></div>
    <p class="hint">${t('fcMonthHint')}</p></div>`,
      rr => {
        rr.querySelectorAll('[data-adj]').forEach(
          b =>
            (b.onclick = e => {
              e.stopPropagation();
              S.planAdj.splice(+b.dataset.adj, 1);
              commit(t('deleted'));
              fcMonthSheet(m);
            })
        );
        rr.querySelectorAll('[data-adje]').forEach(el => (el.onclick = () => planAdjForm(m, +el.dataset.adje)));
        rr.querySelector('#adjAdd').onclick = () => planAdjForm(m);
        rr.querySelectorAll('[data-pe]').forEach(
          el => (el.onclick = () => planEditForm(m, el.dataset.pe, el.dataset.pl, +el.dataset.pv, +el.dataset.pb))
        );
      }
    );
  }
  function planEditForm(m, src, label, amount, base) {
    const [kind, id] = src.split(/:(.+)/),
      canOn = kind === 'rec' || kind === 'bud',
      has = src in ((S.planOver || {})[m] || {});
    openSheet(
      label + ' · ' + monthLbl(m),
      `<form class="form" id="f"><p class="hint">${t('usually')}: ${fmt(base)}</p>
    <label class="fld"><span>${t('amount')} (${t('zeroSkip')})</span><input class="in-f amt num" id="ev" inputmode="decimal" value="${amount}"></label>
    ${canOn ? `<label class="fld"><span>${t('applyTo')}</span><select class="in-f" id="es"><option value="one">${t('thisMonthOnly')}</option><option value="on">${t('fromThisOn')}</option></select></label>` : ''}
    <div class="foot">${has ? `<button type="button" class="btn grow" id="eReset">${t('resetPlan')}</button>` : ''}<button class="btn pri grow">${t('save')}</button></div></form>`,
      r => {
        const back = () => {
          commit(t('saved'));
          fcMonthSheet(m);
        };
        const rs = r.querySelector('#eReset');
        if (rs)
          rs.onclick = () => {
            delete S.planOver[m][src];
            back();
          };
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const raw = val(r, 'ev'),
            v = raw === '' ? 0 : numv(r, 'ev');
          if (v < 0) {
            toast(t('needAmt'));
            return;
          }
          const scope = canOn ? val(r, 'es') : 'one';
          if (scope === 'on' && kind === 'rec') {
            const rc = S.recur.find(x => x.id === id);
            if (rc) {
              if (rc.next.slice(0, 7) >= m) {
                rc.tpl.amount = v;
              } else {
                let d = rc.next;
                while (d.slice(0, 7) < m) d = advance(d, rc.freq, rc.day);
                const nr = JSON.parse(JSON.stringify(rc));
                nr.id = 'r' + uid();
                nr.next = d;
                nr.tpl.amount = v;
                rc.end = dayBefore(d);
                S.recur.push(nr);
              }
              Object.keys(S.planOver).forEach(k => {
                if (k >= m) delete S.planOver[k][src];
              });
              if (v === 0) {
                const z = S.recur.find(x => x.id === id);
                if (z && z.next.slice(0, 7) >= m) z.end = dayBefore(z.next);
              }
            }
          } else if (scope === 'on' && kind === 'bud') {
            for (let i = 0; i < 36; i++) {
              const k = ymAdd(m, i);
              (S.planOver[k] = S.planOver[k] || {})[src] = v;
            }
          } else {
            (S.planOver[m] = S.planOver[m] || {})[src] = v;
          }
          back();
        };
      }
    );
  }
