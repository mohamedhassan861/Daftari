/* Card and obligation screens, net worth and zakat. (part 1 of 2) */
  function cardsBody() {
    const list = oblList('card');
    const PEc = perRange()[1];
    return (
      `<p class="hint">${t('cardsHint')}</p>` +
      (list.length
        ? list
            .map(a => {
              const c = cardInfo(a, PEc),
                sym = curSym(a.currency);
              return `<div class="card"><div class="hd tap" data-act="stmtAcc" data-id="${a.id}"><div><h3>${esc(a.name)} ›</h3><span class="muted">${a.closeDay ? `${t('closeDay')} ${a.closeDay} · ${t('payDay')} ${a.dueDay || a.closeDay}` : t('cardNoDays')}</span></div>${c.owed ? `<span class="pill warn">${t('iOwe')}</span>` : `<span class="pill ok">${t('settled')}</span>`}</div>
      <div class="kv"><div><span class="label">${t('cardOwed')}</span><b class="${c.owed ? 'neg' : ''}">${fmt(c.owed)} <small>${esc(sym)}</small></b></div><div><span class="label">${t('cardDue')}${c.dueDate ? ' ' + esc(shortDate(c.dueDate)) : ''}</span><b>${fmt(c.due)} <small>${esc(sym)}</small></b></div><div><span class="label">${t('cardCycle')}</span><b>${fmt(c.cycle)} <small>${esc(sym)}</small></b></div></div>
      ${a.limit ? `<div class="bar"><i class="${c.owed / a.limit >= 0.8 ? 'warn' : ''}" style="width:${Math.min(100, (c.owed / a.limit) * 100)}%"></i></div><span class="muted">${t('cardLimit')}: ${fmt(a.limit)} · ${t('cardAvail')}: ${fmt(Math.max(0, a.limit - c.owed))}</span>` : ''}
      ${cardStmtsHTML(a, c)}
      <div class="acts">${c.owed ? `<button class="btn sm pri" data-act="payCard" data-id="${a.id}">${t('pay')}</button>` : ''}<button class="btn sm" data-act="stmtAcc" data-id="${a.id}">${t('statement')}</button><button class="btn sm" data-act="editAcc" data-id="${a.id}">${t('edit')}</button></div></div>`;
            })
            .join('')
        : `<div class="list"><div class="empty">${t('noCards')}</div></div>`)
    );
  }
  function cardStmtsHTML(a, c) {
    const cy = cardCycles(a);
    if (!cy.length) return '';
    const sym = curSym(a.currency);
    return `<div class="list cst"><div class="grp"><span>${t('cStmts')}</span></div>${cy.map(s => `<div class="row tap" data-act="why" data-w="cst:${a.id}:${s.C}"><div class="main"><span class="t">${esc((s.open ? t('cStOpen') : s.cur ? t('cStDue') : t('cStPrev')).replace('%c', s.C.slice(8, 10) + '/' + s.C.slice(5, 7)))}</span><span class="s">${esc(t('cStPay').replace('%d', s.due.slice(8, 10) + '/' + s.due.slice(5, 7)))} · ${s.list.length ? s.list.length + ' ' + t('rowsWord') : t('cStNone')}${s.cur ? ' · ' + (s.left > 0.5 ? `<span class="neg">${t('cStLeft').replace('%v', fmt(s.left))}</span>` : `<span class="pos">${t('cStPaid')}</span>`) : ''}</span></div><b class="amt">${fmt(s.sum)} <small>${esc(sym)}</small></b></div>`).join('')}</div>`;
  }
  function payCard(id) {
    const a = accById(id);
    if (!a) return;
    const c = cardInfo(a),
      due = c.due || c.owed;
    const froms = S.accounts.filter(x => x.id !== a.id && x.currency === a.currency && isLiquid(x)),
      def = (froms.find(x => x.type === 'bank') || froms[0] || {}).id;
    if (!froms.length) {
      toast(t('needAccCur') + ' ' + a.currency);
      return;
    }
    openSheet(
      t('pay') + ' · ' + a.name,
      `<form class="form" id="f">
    <div class="sumgrid"><div><span class="label">${t('cardDue')}${c.dueDate ? ' ' + esc(shortDate(c.dueDate)) : ''}</span><b class="num">${fmt(c.due)}</b></div><div><span class="label">${t('cardOwed')}</span><b class="num">${fmt(c.owed)}</b></div></div>
    <label class="fld"><span>${t('amountPaid')}</span><input class="in-f amt num" id="amt" inputmode="decimal" value="${due}"></label>
    <div class="two"><label class="fld"><span>${t('fromAcc')}</span><select class="in-f" id="acc">${froms.map(x => `<option value="${x.id}" ${x.id === def ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${TODAY}"></label></div>
    ${remBlock(c.dueDate ? c.dueDate.slice(0, 7) : TODAY_YM, false)}
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,
      r => {
        const getRem = c.due > 0 ? bindRem(r, c.due) : () => null;
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const v = numv(r, 'amt');
          if (v <= 0) {
            toast(t('needAmt'));
            return;
          }
          const rr = getRem();
          if (rr && rr.act !== 'keep' && c.close)
            a.defer = {close: c.close, to: rr.act + '-' + pad(Math.min(28, +(a.dueDay || 5)))};
          S.tx.push({
            id: uid(),
            type: 'transfer',
            acc: val(r, 'acc'),
            toAcc: a.id,
            amount: v,
            toAmount: v,
            date: val(r, 'dt') || TODAY,
            note: t('cardPayNote') + ' · ' + a.name,
            cat: 'transfer'
          });
          closeSheet();
          commit(t('saved'));
        };
      }
    );
  }
  function oblSum() {
    const [PA, PE] = perRange(),
      endLbl = dmyOf(dsDate(PE)).replace(/\/\d{4}/, '');
    const box = (...cells) =>
      `<div class="totbar">${cells.map(([l, v, cl, f, sm, wk]) => `<div class="${f ? 'tap' : ''} ${f && oblF.has(f) ? 'on' : ''}" ${f ? `data-of="${f}"` : ''}><span class="label">${l}${f && oblF.has(f) ? ' ✓' : ''}${wk ? ` <button type="button" class="info" data-act="why" data-w="${wk}" aria-label="details">ⓘ</button>` : ''}</span><b class="${cl || ''}">${typeof v === 'string' ? esc(v) : fmt(Math.round(v))}</b>${sm ? `<small class="muted" style="font-size:11px;line-height:1.3">${sm}</small>` : ''}</div>`).join('')}</div>`;
    if (oblTab === 'inst' || oblTab === 'gam') {
      const L = oblBase(oblTab);
      if (!(oblTab === 'inst' ? S.inst : S.gam).length) return '';
      const T = {due: 0, late: 0, paidP: 0, paidCum: 0, left: 0, total: 0};
      L.forEach(o => {
        const st = oblStats(oblTab, o);
        for (const x in T) T[x] += st[x];
      });
      return box(
        [
          t('dueLbl'),
          T.due,
          '',
          'due',
          T.late > 0.5 ? t('plusLate') + ' ' + fmt(Math.round(T.late)) : t('noLate'),
          'oDue'
        ],
        [
          t('paidLbl'),
          T.paidP,
          '',
          'paid',
          t('sinceStart') + ' ' + esc(endLbl) + ': ' + fmt(Math.round(T.paidCum)),
          'oPaid'
        ],
        [
          t('remaining'),
          T.left,
          'neg',
          'left',
          t('ofTotal') +
            ' ' +
            fmt(Math.round(T.total)) +
            (T.waived > 0.5 ? ' · ' + t('waivedLbl') + ' ' + fmt(Math.round(T.waived)) : ''),
          'oLeft'
        ]
      );
    }
    if (oblTab === 'loan') {
      if (!S.loans.length) return '';
      const L = oblBase('loan'),
        sm = d => L.filter(l => l.dir === d),
        left = d => sm(d).reduce((v, l) => v + toBase(loanLeftAt(l, PE), l.currency || BASE()), 0),
        paidP = d =>
          sm(d).reduce(
            (v, l) =>
              v +
              toBase(
                l.pays.filter(p => p.date >= PA && p.date <= PE).reduce((a, p) => a + (+p.amount || 0), 0),
                l.currency || BASE()
              ),
            0
          );
      const r = left('lent'),
        p = left('borrowed');
      return box(
        [t('owedToMe'), r, 'pos', 'lent', t('gotInPer') + ' ' + fmt(Math.round(paidP('lent'))), 'lLent'],
        [t('iOwe'), p, 'neg', 'borrowed', t('paidInPer') + ' ' + fmt(Math.round(paidP('borrowed'))), 'lBorrowed'],
        [t('netShort'), r - p, r - p < 0 ? 'neg' : 'pos', '', '', 'lNet']
      );
    }
    if (oblTab === 'card') {
      const cs = cards();
      if (!cs.length) return '';
      const inf = cs.map(a => ({a, c: cardInfo(a, PE)}));
      const nd = inf
        .map(z => z.c.dueDate)
        .filter(Boolean)
        .sort()[0];
      const paid = cs.reduce(
        (v, a) =>
          v +
          S.tx
            .filter(
              x =>
                x.date >= PA &&
                x.date <= PE &&
                ((x.type === 'transfer' && x.toAcc === a.id) || (x.type === 'income' && x.acc === a.id))
            )
            .reduce(
              (s2, x) => s2 + toBase(+(x.type === 'transfer' ? (x.toAmount ?? x.amount) : x.amount) || 0, a.currency),
              0
            ),
        0
      );
      return box(
        [
          t('cardsOwe'),
          inf.reduce((v, z) => v + toBase(z.c.owed, z.a.currency), 0),
          'neg',
          'owed',
          t('paidInPer') + ' ' + fmt(Math.round(paid)),
          'cardsOwe'
        ],
        [t('cardDue'), inf.reduce((v, z) => v + toBase(z.c.due || 0, z.a.currency), 0), '', 'cdue', '', 'cDue'],
        [
          t('nextPay') + (nd ? ' · ' + wdOf(dsDate(nd)) : ''),
          nd ? '‎' + nd.slice(8, 10) + '/' + nd.slice(5, 7) + '‎' : '—'
        ]
      );
    }
    return '';
  }
  /* the chip row: status, how it is paid, group */
  function oblChips() {
    if (!['inst', 'gam', 'loan'].includes(oblTab)) return '';
    const all = oblTab === 'inst' ? S.inst : oblTab === 'gam' ? S.gam : S.loans;
    if (!all.length) return '';
    const ch = (id, l) =>
      `<button type="button" class="balchip ${oblC.has(id) ? 'on' : ''}" data-oc="${id}">${esc(l)}</button>`;
    const st = [
      ['st:late', t('overdue')],
      ['st:due', t('dueThisPer')],
      ['st:done', t('done')]
    ]
      .map(([i, l]) => ch(i, l))
      .join('');
    const pays =
      oblTab === 'loan'
        ? ''
        : [...new Set(all.map(payType))]
            .map(p => ch('pay:' + p, {cash: t('payCash'), bank: t('payBank'), card: t('payCard')}[p]))
            .join('');
    const gs = [...new Set(all.map(o => o.group || '').filter(Boolean))].map(g => ch('grp:' + g, g)).join('');
    return `<div class="qchips" style="margin-top:0;flex-wrap:wrap">${st}${pays ? '<span class="muted" style="align-self:center">·</span>' + pays : ''}${gs ? '<span class="muted" style="align-self:center">·</span>' + gs : ''}</div>`;
  }
