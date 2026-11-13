/* Cash-flow, forecast and number-breakdown screens. (part 1 of 2) */
  function cashSheet() {
    const PE = perRange()[1],
      selYm = PE.slice(0, 7) > TODAY_YM ? PE.slice(0, 7) : TODAY_YM;
    const tl = cashTimeline(selYm, true);
    let shown = false;
    const totOut = tl.ev.filter(e => e.dir === 'out').reduce((v, e) => v + e.amt, 0),
      lowMatters = tl.low && tl.low.bal < tl.mEnd[selYm] - 0.5;
    const grouped = [];
    tl.ev.forEach(e => {
      const g = grouped[grouped.length - 1];
      if (g && g.date === e.date && g.label === e.label && g.dir === e.dir) {
        g.amt += e.amt;
        g.bal = e.bal;
      } else grouped.push(Object.assign({}, e));
    });
    const rows = grouped;
    const noDays = cards().filter(a => !a.closeDay);
    openSheet(
      t('willLast'),
      `<div class="form">${noDays.length ? `<div class="banner"><span>${t('cardSetDays')}</span><button class="btn sm" data-act="goCards">${t('edit')}</button></div>` : ''}
    <div class="blk ${tl.first ? '' : 'act'}"><div class="blk-h"><span>${tl.first ? '⚠️ ' + t('notEnough') : '✓ ' + t('enoughTo').replace('%m', monthLbl(tl.last))}</span></div>
      <div class="flowb"><div><span>${t('nowHave')}</span><b>${money(tl.start)}</b><span>${esc(shortDate(TODAY))}</span></div><div><span>${t('leftAtEnd')} ${esc(monthLbl(selYm))}</span><b class="${tl.mEnd[selYm] < 0 ? 'neg' : ''}">${money(tl.mEnd[selYm])}</b><span>${esc(shortDate(monthEnd(selYm)))}</span></div>${lowMatters ? `<div><span>${t('lowestBal')}</span><b class="${tl.low.bal < 0 ? 'neg' : ''}">${money(tl.low.bal)}</b><span>${esc(shortDate(tl.low.date))}</span></div>` : `<div><span>${t('willGoOut')}</span><b>${money(totOut)}</b><span>${t('inclFin')}</span></div>`}</div>${lowMatters ? `<p class="hint" style="padding:0 14px">${t('lowWhy').replace('%v', fmt(tl.low.bal)).replace('%d', shortDate(tl.low.date))}</p>` : ''}
      ${tl.first ? `<p class="hint" style="padding:0 14px">${t('shortMsg').replace('%d', shortDate(tl.first.date)).replace('%l', tl.first.label).replace('%n', fmt(-tl.low.bal))}</p>` : ''}</div>
    <label class="fld"><span>${t('warnBefore')}</span><select class="in-f" id="sd">${[3, 5, 7, 10, 14, 21, 30].map(n => `<option value="${n}" ${n === shortDays() ? 'selected' : ''}>${n} ${t('daysW')}</option>`).join('')}</select></label>
    <div class="list">${tl.months
      .map(m => {
        const mr = rows.filter(e => e.date.slice(0, 7) === m),
          mi = mr.filter(e => e.dir === 'in').reduce((v, e) => v + e.amt, 0),
          mo = mr.filter(e => e.dir === 'out').reduce((v, e) => v + e.amt, 0);
        return `<div class="grp mhead"><span>${esc(monthLbl(m))}</span><span class="muted" style="font-weight:400">${mi ? '<span class="pos">+' + fmt(mi) + '</span> · ' : ''}−${fmt(mo)}</span></div>${
          mr
            .map(e => {
              const bad = e.bal < -0.5;
              const h = bad && !shown;
              if (bad) shown = true;
              return `${h ? `<div class="grp" style="color:var(--neg)"><span>${t('notCovered')}</span></div>` : ''}<div class="row"><div class="main"><span class="t">${e.dir === 'in' ? '+ ' : '− '}${esc(e.label)}</span><span class="s">${esc(shortDate(e.date))} · <span class="balaft">${t('balAfter')} <b class="${bad ? 'neg' : ''}">${fmt(e.bal)}</b></span></span></div><b class="amt ${e.dir === 'in' ? 'pos' : bad ? 'neg' : ''}">${money(e.amt)}</b></div>`;
            })
            .join('') || `<div class="empty">${t('noItems')}</div>`
        }<div class="row mend"><div class="main"><span class="t">${t('leftAtEnd')} ${esc(monthLbl(m))}</span><span class="s">${esc(shortDate(monthEnd(m)))}</span></div><b class="amt balaft ${tl.mEnd[m] < 0 ? 'neg' : ''}">${money(tl.mEnd[m])}</b></div>`;
      })
      .join('')}</div>
    <p class="hint">${t('willLastHint')}</p></div>`,
      r => {
        r.querySelector('#sd').onchange = e => {
          S.shortDays = +e.target.value;
          commit(t('saved'));
          cashSheet();
        };
      }
    );
  }
  /* cash & banks over the period: actual up to today, plan after it */
  /* one sentence for the chosen period: start, in, out, loans/transfers, end; plus the lowest point ahead. Same figures as the boxes below. */
  function glanceHTML() {
    if (ACT !== 'me') return '';
    const P = perCash(),
      lbl = perLabel(),
      N = (v, c) => `<b class="${c || (v < 0 ? 'neg' : 'gnum')}">${fmt(Math.round(v))}</b>`;
    const fxT = Math.abs(P.fx) >= 1 ? t('sumFx').replace('%v', N(P.fx)) : '';
    let line = '';
    if (P.fut)
      line = t('sumFut')
        .replace('%m', esc(lbl))
        .replace('%a', N(P.o))
        .replace('%i', N(P.gi, 'pos'))
        .replace('%o', N(P.go, 'gneg'))
        .replace('%f', '')
        .replace('%c', N(P.c));
    else if (P.proj) {
      const pp = projFlows(P.b);
      line =
        t('sumNow').replace('%a', N(P.now)) +
        ' ' +
        t('sumCur')
          .replace('%m', esc(lbl))
          .replace('%i', N(pp.i + pp.fi + pp.xi, 'pos'))
          .replace('%o', N(pp.o + pp.fo + pp.xo, 'gneg'))
          .replace('%f', '')
          .replace('%c', N(P.c));
    } else
      line = t('sumPast')
        .replace('%m', esc(lbl))
        .replace('%a', N(P.o))
        .replace('%i', N(P.gi, 'pos'))
        .replace('%o', N(P.go, 'gneg'))
        .replace('%f', fxT)
        .replace('%c', N(P.c));
    let low = '';
    if (P.proj || P.fut || perRange()[1] >= TODAY) {
      const tl = cashTimeline(ymAdd(TODAY_YM, 2));
      if (tl.low)
        low = `<span class="gl2">${t('sumLow')
          .replace('%v', N(tl.low.bal))
          .replace('%d', esc(shortDate(tl.low.date)))}</span>`;
    }
    return `<div class="glance tap" data-act="glance" data-id="${P.proj || P.fut ? 'c' : 'w'}"><span class="gl1">${line}</span>${low}</div>`;
  }
  function planHTML() {
    const months = perMonths(),
      {P, A, L} = planVsActual(months);
    const sec = ty => {
      const keys = [...new Set([...Object.keys(P[ty]), ...Object.keys(A[ty])])].sort(
        (a, b) => Math.max(P[ty][b] || 0, A[ty][b] || 0) - Math.max(P[ty][a] || 0, A[ty][a] || 0)
      );
      let tp = 0,
        ta = 0;
      const rows = keys
        .map(k => {
          const p = P[ty][k] || 0,
            a = A[ty][k] || 0;
          tp += p;
          ta += a;
          const d = ty === 'income' ? a - p : p - a;
          return `<div class="cmp tap" data-act="${k.startsWith('card:') ? 'stmtAcc' : k === 'xfer' ? '' : 'planCat'}" data-id="${k.startsWith('card:') ? k.slice(5) : k}" data-ty="${ty}"><span>${esc(L[k] || catName(k))} ›</span><span>${money(p)}</span><span>${money(a)}</span><b class="${d < -0.5 ? 'neg' : d > 0.5 ? 'pos' : ''}">${d > 0.5 ? '+' : ''}${money(d)}</b></div>`;
        })
        .join('');
      const d = ty === 'income' ? ta - tp : tp - ta;
      return {
        html: `<div class="grp"><span>${ty === 'income' ? t('income') : t('expense')}</span></div>${rows || `<div class="empty">${t('noItems')}</div>`}<div class="cmp t"><span>${t('total')}</span><span>${money(tp)}</span><span>${money(ta)}</span><b class="${d < -0.5 ? 'neg' : d > 0.5 ? 'pos' : ''}">${d > 0.5 ? '+' : ''}${money(d)}</b></div>`,
        tp,
        ta
      };
    };
    const I = sec('income'),
      E = sec('expense'),
      np = I.tp - E.tp,
      na = I.ta - E.ta;
    const fk = [...new Set([...Object.keys(P.fin), ...Object.keys(A.fin)])],
      sg = k => (k.startsWith('fi:') ? 1 : -1);
    let fp = 0,
      fa = 0;
    const FR = fk
      .map(k => {
        const p = sg(k) * (P.fin[k] || 0),
          a = sg(k) * (A.fin[k] || 0);
        fp += p;
        fa += a;
        const d = a - p;
        return `<div class="cmp"><span>${sg(k) > 0 ? '+' : '−'} ${esc(L[k] || '')}</span><span>${money(p)}</span><span>${money(a)}</span><b class="${d < -0.5 ? 'neg' : d > 0.5 ? 'pos' : ''}">${d > 0.5 ? '+' : ''}${money(d)}</b></div>`;
      })
      .join('');
    const FH = fk.length
      ? `<div class="grp"><span>🤝 ${t('finTitle')}</span><small class="muted" style="font-weight:400">${t('finHint')}</small></div>${FR}<div class="cmp t"><span>${t('total')}</span><span>${money(fp)}</span><span>${money(fa)}</span><b class="${fa - fp < -0.5 ? 'neg' : fa - fp > 0.5 ? 'pos' : ''}">${fa - fp > 0.5 ? '+' : ''}${money(fa - fp)}</b></div>`
      : '';
    const start = TODAY_YM,
      endY = +TODAY.slice(0, 4) + 1 + '-12',
      horizon = [];
    for (let m = start; m <= endY && horizon.length < 36; m = ymAdd(m, 1)) horizon.push(m);
    const fc = fcSeries(horizon[horizon.length - 1] || start);
    const cm = per.mode === 'month' ? cur : ymAdd(TODAY_YM, -1);
    const dN = na - np;
    return `<details class="box" data-k="pva"><summary><h2>${t('planVsAct')}</h2><div class="sumline"><div>${t('cashIn')} · ${t('actual')}<b class="pos"><span class="why" data-act="why" data-w="pvaIn">${money(I.ta)}</span></b><small>${t('planned')} ${money(I.tp)}</small></div><div>${t('cashOut')} · ${t('actual')}<b><span class="why" data-act="why" data-w="pvaOut">${money(E.ta)}</span></b><small>${t('planned')} ${money(E.tp)}</small></div><div>${t('netShort')}<b class="${na < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="pvaNet">${money(na)}</span></b><small>${t('planned')} ${money(np)}</small><small class="${dN < -0.5 ? 'neg' : dN > 0.5 ? 'pos' : ''}">${Math.abs(dN) < 0.5 ? t('asPlanned') : (dN > 0 ? t('betterBy') : t('worseBy')) + ' ' + fmt(Math.round(Math.abs(dN)))}</small></div></div>${fk.length ? `<div class="sumline" style="grid-template-columns:1fr"><div>🤝 ${t('finTitle')} <small>${t('finHint')}</small><b class="${fa < 0 ? 'neg' : 'pos'}"><span class="why" data-act="why" data-w="pvaFin">${fa < 0 ? '− ' : '+ '}${money(Math.abs(fa))}</span></b><small>${t('planned')} ${fp < 0 ? '− ' : '+ '}${money(Math.abs(fp))}</small></div></div>` : ''}</summary>${cm <= TODAY_YM ? `<button class="btn block" data-act="closeMonth" data-m="${cm}" style="margin:8px 0">${S.closed[cm] ? '✓ ' : ''}${t('closeTitle')} · ${esc(monthLbl(cm))}</button>` : ''}<div class="list">
    <div class="cmp h"><span>${t('category')}</span><span>${t('planned')}</span><span>${t('actual')}</span><span>${t('variance')}</span></div>
    ${I.html}${E.html}
    <div class="cmp t"><span>${t('netShort')}</span><span>${money(np)}</span><span>${money(na)}</span><b class="${na - np < -0.5 ? 'neg' : na - np > 0.5 ? 'pos' : ''}">${na - np > 0.5 ? '+' : ''}${money(na - np)}</b></div>
    ${FH}${fk.length ? `<div class="cmp t"><span>${t('cashNetAll')}</span><span>${money(np + fp)}</span><span>${money(na + fa)}</span><b class="${na + fa - np - fp < -0.5 ? 'neg' : na + fa - np - fp > 0.5 ? 'pos' : ''}">${na + fa - np - fp > 0.5 ? '+' : ''}${money(na + fa - np - fp)}</b></div>` : ''}</div><p class="hint">${t('planHint')}</p></details>
  <button class="btn block" data-act="cashSheet" style="margin:6px 0">${(() => {
    const a = cashTimeline();
    return a.first ? '⚠️ ' + t('willLast') + ' · ' + t('notEnough') : '✓ ' + t('willLast');
  })()}</button>
  ${
    fc.length
      ? `<details class="box" data-k="fc"><summary><h2>${t('forecastT')} <small class="muted" style="font-size:12px;font-weight:400">${t('fromToday')}</small></h2>
    ${(() => {
      const low = fc.reduce((a, r) => (r.bal < a.bal ? r : a), fc[0]),
        firstGap = fc.find(r => r.gi - r.go < -0.5);
      return `<div class="flowb sumline" style="border-top:0;padding:0"><div><span>${t('lowestBal')}</span><b class="${low.bal < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="fcLow">${money(low.bal)}</span></b><span>${esc(monthLbl(low.m))}</span></div><div><span>${t('firstGap')}</span><b class="${firstGap ? 'neg' : 'pos'}">${firstGap ? `<span class="why" data-act="why" data-w="fcGap">${money(firstGap.gi - firstGap.go)}</span>` : '—'}</b><span>${firstGap ? esc(monthLbl(firstGap.m)) : t('noGap')}</span></div><div><span>${t('endBal')}</span><b class="${fc[fc.length - 1].bal < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="fcEnd">${money(fc[fc.length - 1].bal)}</span></b><span>${esc(monthLbl(fc[fc.length - 1].m))}</span></div></div>`;
    })()}</summary><div class="list">
    ${cards().some(a => !a.closeDay) ? `<p class="hint" style="padding:6px 14px;margin:0">${t('cardSetDays')}</p>` : ''}
    <div class="cmp h fc"><span>${t('monthW')}</span><span>${t('cashIn')}</span><span>${t('cashOut')}</span><span>${t('gapW')}</span><span>${t('availEnd')}</span></div>
    ${fc.map(r => `<div class="cmp fc tap" data-act="fcMonth" data-m="${r.m}"><span>${esc(monthShort(r.m))} ${r.m.slice(2, 4)}${r.kind === 'cur' ? ' •' : ''}</span><span class="pos">${money(r.gi)}</span><span>${money(r.go)}</span><b class="${r.gi - r.go < 0 ? 'neg' : 'pos'}">${money(r.gi - r.go)}</b><b class="${r.bal < 0 ? 'neg' : ''}">${money(r.bal)}</b></div>${(r.fi || 0) + (r.fo || 0) + (r.xi || 0) + (r.xo || 0) > 0.5 ? `<div class="cmp fc" style="font-size:11px"><span style="grid-column:1/5;white-space:normal">↳ ${t('ofWhich')} 🤝 ${t('finTitle')}: ${(r.fi || 0) > 0.5 ? '+' + fmt(Math.round(r.fi)) : ''}${(r.fi || 0) > 0.5 && (r.fo || 0) > 0.5 ? ' / ' : ''}${(r.fo || 0) > 0.5 ? '−' + fmt(Math.round(r.fo)) : ''}${(r.xi || 0) + (r.xo || 0) > 0.5 ? ' · ⇄ ' + t('xferShort') + ': ' + ((r.xi || 0) > 0.5 ? '+' + fmt(Math.round(r.xi)) : '') + ((r.xo || 0) > 0.5 ? ' −' + fmt(Math.round(r.xo)) : '') : ''}</span><b></b></div>` : ''}${r.dev && r.dev.length ? `<div class="cmp fc" style="font-size:11px"><span style="grid-column:1/5;white-space:normal">↳ ${t('overPlan')}: ${r.dev.map(d => esc(d.label) + ' ' + (d.k.startsWith('in:') ? '+' : '−') + fmt(d.v)).join('، ')}</span><b></b></div>` : ''}`).join('')}
    </div><p class="hint">${t('forecastHint')}</p></details>`
      : ''
  }`;
  }
  /* one line of a breakdown: label, amount, and where tapping it goes */
  function whyLine(x) {
    const go = x.w
      ? `data-act="why" data-w="${x.w}"`
      : x.act
        ? `data-act="${x.act}" ${x.ty ? `data-ty="${x.ty}"` : ''} ${x.id ? `data-id="${x.id}"` : ''}`
        : '';
    return `<div class="row ${go ? 'tap' : ''}" ${go} ${x.total ? 'data-total="1"' : ''} style="padding:7px 12px"><div class="main"><span class="t" style="${x.strong ? 'font-weight:700' : ''}">${x.l}${go ? ' ›' : ''}</span>${x.s ? `<span class="s">${x.s}</span>` : ''}</div><b class="amt ${(x.inv ? x.v > 0 : x.v < 0) ? 'neg' : x.strong || x.plain ? '' : 'pos'}">${x.strong || x.plain ? money(x.v) : (x.v < 0 ? '− ' : '+ ') + money(Math.abs(x.v))}</b></div>`;
  }
  function bridgeHTML() {
    const P = perCash(),
      rows = bridgeLines().map(whyLine).join('');
    return `<details class="box" data-k="bridge"><summary><h2>${t('perSummary')} <small class="muted" style="font-size:12px;font-weight:400">${t('cashBanks')}</small></h2><div class="sumline"><div>${P.fut ? t('projStart') : t('openBal')}<b><span class="why" data-act="why" data-w="opening">${money(P.o)}</span></b></div><div>${t('movesNet')}<b class="${P.c - P.o < 0 ? 'neg' : 'pos'}"><span class="why" data-act="why" data-w="moves">${P.c - P.o < 0 ? '− ' : '+ '}${money(Math.abs(P.c - P.o))}</span></b></div><div>${P.proj ? t('projEndS') : t('closeBal')}<b class="${P.c < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="availEnd">${money(P.c)}</span></b></div></div></summary><div class="list">${rows}</div><p class="hint">${t('bridgeHint')}</p></details>`;
  }
  function whySheet(k) {
    const o = whyData(k);
    if (!o) {
      toast(t('noDetails'));
      return;
    }
    const rows = (o.rows || []).slice().sort((a, b) => (a.d || '').localeCompare(b.d || ''));
    openSheet(
      o.title,
      `<div class="form">${o.sub ? `<p class="hint">${o.sub}</p>` : ''}
    <div class="list">${o.lines.map(whyLine).join('')}</div>
    ${
      rows.length
        ? `<div class="grp" style="border-radius:12px 12px 0 0"><span>${t('whyRows')} (${rows.length})</span></div><div class="list" style="border-radius:0 0 12px 12px">${rows
            .slice(0, 300)
            .map(
              r =>
                `<div class="row ${r.act ? 'tap' : ''}" ${r.act ? `data-act="${r.act}" data-id="${r.id}"` : ''} style="padding:6px 12px"><div class="main"><span class="t" style="font-size:13px">${esc(r.l)}${r.act ? ' ›' : ''}</span><span class="s">${esc(shortDate(r.d))}${r.exp ? ' · ' + t('expWord') : ''}</span></div><b class="amt ${(r.inv ? r.v > 0 : r.v < 0) ? 'neg' : 'pos'}">${r.v < 0 ? '− ' : '+ '}${money(Math.abs(r.v))}</b></div>`
            )
            .join('')}</div>`
        : ''
    }
    ${o.go ? `<button type="button" class="btn block" data-act="${o.go.act}" ${o.go.id ? `data-id="${o.go.id}"` : ''}>${o.go.l} ›</button>` : ''}
    ${o.note ? `<p class="hint">${o.note}</p>` : ''}</div>`
    );
  }
  function vRep() {
    const tx = txIn(),
      exp = tx.filter(x => x.type === 'expense' && isPL(x)),
      inc = sumB(tx.filter(x => x.type === 'income' && isPL(x))),
      te = sumB(exp),
      bf = perFactor(),
      B = id => (S.budgets[id] ? Math.round(S.budgets[id] * bf) : 0);
    const by = {};
    exp.forEach(x => {
      const k = catRoot(x.cat);
      by[k] = (by[k] || 0) + baseAmt(x);
    });
    Object.keys(S.budgets).forEach(k => {
      if (!(k in by)) by[k] = 0;
    });
    const rows = Object.entries(by).sort((a, b) => b[1] - a[1]);
    const mx = Math.max(1, ...rows.map(r => Math.max(r[1], B(r[0]))));
    const mlist = per.mode === 'month' ? Array.from({length: 6}, (_, i) => ymAdd(cur, i - 5)) : perMonths().slice(-24);
    const ms = mlist.map(m => {
      const x = txOf(m);
      return {
        m,
        i: sumB(x.filter(y => y.type === 'income' && isPL(y))),
        e: sumB(x.filter(y => y.type === 'expense' && isPL(y)))
      };
    });
    const top = Math.max(1, ...ms.map(o => Math.max(o.i, o.e)));
    return `${bridgeHTML()}<section class="slip"><div class="split"><div class="tile" data-act="stmtFlow" data-ty="income"><span class="label">${t('income')} ›</span><span class="mid pos">${money(inc)}</span></div><div class="tile" data-act="stmtFlow" data-ty="expense"><span class="label">${t('expense')} ›</span><span class="mid">${money(te)}</span></div></div>
    <div class="perf"></div><div class="net tile" data-act="stmtFlow" data-ty="net"><span class="label">${t('net')} ›</span><span class="mid ${inc - te < 0 ? 'neg' : ''}">${money(inc - te)} <small class="muted">${esc(curSym(BASE()))}</small></span></div>${finHTML(tx)}${(() => {
      const [a, b] = perRange(),
        g = fxGain(a, b > TODAY ? TODAY : b);
      return Math.abs(g.tot) >= 0.5
        ? `<div class="row tap" data-act="why" data-w="fx" style="padding:6px 14px 10px"><div class="main"><span class="t" style="font-size:13px">💱 ${t('fxTitle')} ›</span><span class="s">${t('fxHint')}</span></div><b class="amt ${g.tot < 0 ? 'neg' : 'pos'}">${g.tot < 0 ? '− ' : '+ '}${money(Math.abs(g.tot))}</b></div>`
        : '';
    })()}</section>
  ${planHTML()}
  <details class="box" data-k="byCat"><summary><h2>${t('byCat')}</h2><span class="sumv"><span class="why" data-act="why" data-w="catExp">${money(te)}</span> <small>${esc(curSym(BASE()))}</small></span></summary><div class="acts" style="justify-content:flex-end"><button class="link" data-act="exportCats">⤓ ${t('export')}</button> · <button class="link" data-act="budget">${t('budget')}</button></div>
    <div class="list">${
      rows.length
        ? rows
            .map(([id, v]) => {
              const lim = B(id),
                p = lim ? v / lim : 0;
              return `<div class="catbar tile" data-act="${catKids('expense', id).length ? 'catGroup' : 'stmtCat'}" data-id="${id}" data-ty="expense"><div class="l"><span>${esc(catName(id))}${catKids('expense', id).length ? ' ›' : ''}</span><span>${money(v)}${lim ? ` <span class="muted">/ ${money(lim)}</span>` : ''} <span class="muted num">${te ? Math.round((v / te) * 100) : 0}%</span></span></div>
      <div class="bar"><i class="${lim ? (p >= 1 ? 'neg' : p >= 0.8 ? 'warn' : '') : ''}" style="width:${lim ? Math.min(100, p * 100) : (v / mx) * 100}%"></i></div></div>`;
            })
            .join('')
        : `<div class="empty">${t('noTx')}</div>`
    }</div></details>
  <details class="box" data-k="byMonth"><summary><h2>${per.mode === 'month' ? t('sixMonths') : t('byMonth')}</h2>${(() => {
    const n = ms.length || 1,
      ai = ms.reduce((v, o) => v + o.i, 0) / n,
      ae = ms.reduce((v, o) => v + o.e, 0) / n;
    return `<div class="sumline"><div>${t('avgIn')}<b class="pos"><span class="why" data-act="why" data-w="avgIn">${money(Math.round(ai))}</span></b></div><div>${t('avgOut')}<b><span class="why" data-act="why" data-w="avgOut">${money(Math.round(ae))}</span></b></div><div>${t('netShort')}<b class="${ai - ae < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="avgNet">${money(Math.round(ai - ae))}</span></b></div></div>`;
  })()}</summary>
    <div class="list" style="overflow-x:auto"><div class="cols" dir="ltr" style="grid-template-columns:repeat(${ms.length},minmax(18px,1fr))">${(S.lang === 'ar' ? [...ms].reverse() : ms).map(o => `<div class="c" title="${esc(monthLbl(o.m))}"><i class="a" style="height:${(o.i / top) * 100}%"></i><i class="b" style="height:${(o.e / top) * 100}%"></i></div>`).join('')}</div>
    <div class="colsx" dir="ltr" style="grid-template-columns:repeat(${ms.length},minmax(18px,1fr))">${(S.lang === 'ar' ? [...ms].reverse() : ms).map(o => `<span style="${per.mode === 'month' && o.m === cur ? 'color:var(--ink);font-weight:600' : ''}">${esc(colLbl(o.m, ms.length))}</span>`).join('')}</div>
    <div class="legend"><span style="--c:var(--accent)">${t('income')}</span><span style="--c:var(--neg)">${t('expense')}</span></div></div></details>
  ${catTotalsHTML('income')}
  ${tagsHTML()}
  ${netWorthHTML()}${zakatHTML()}`;
  }
