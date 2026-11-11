/* The main tab views: home, activity and reports. (part 2 of 2; continues from views-1.js) */
  function calendarHTML() {
    const ym = perRange()[0].slice(0, 7),
      [y, m] = ym.split('-').map(Number),
      first = new Date(y, m - 1, 1),
      days = new Date(y, m, 0).getDate();
    const startDow = (first.getDay() + 1) % 7; /* week starts Saturday */
    const list = S.tx.filter(x => x.date.slice(0, 7) === ym && x.type === 'expense'),
      byDay = {};
    list.forEach(x => {
      byDay[x.date] = (byDay[x.date] || 0) + baseAmt(x);
    });
    const inc = {};
    S.tx
      .filter(x => x.date.slice(0, 7) === ym && x.type === 'income')
      .forEach(x => {
        inc[x.date] = (inc[x.date] || 0) + baseAmt(x);
      });
    const due = {};
    S.recur.forEach(r => {
      let d = r.next,
        g = 0;
      while (d <= ym + '-31' && g++ < 2000) {
        if (d.slice(0, 7) === ym) due[d] = 1;
        d = advance(d, r.freq, r.day);
      }
    });
    [
      ['inst', S.inst],
      ['gam', S.gam]
    ].forEach(([k, l]) =>
      l.forEach(o => {
        if (oblMonths(k, o).includes(ym) && !o.paid.includes(ym)) due[ym + '-01'] = 1;
      })
    );
    const mx = Math.max(1, ...Object.values(byDay)),
      wd =
        lng() === 'en'
          ? ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr']
          : ['سبت', 'حد', 'اتنين', 'تلات', 'أربع', 'خميس', 'جمعة'];
    let cells = '';
    for (let i = 0; i < startDow; i++) cells += '<div></div>';
    for (let d = 1; d <= days; d++) {
      const ds = ym + '-' + pad(d),
        v = byDay[ds] || 0;
      cells += `<button class="cday ${ds === TODAY ? 'today' : ''} ${ds === txDay ? 'on' : ''}" data-act="pickDay" data-d="${ds}" style="--h:${v ? Math.max(0.15, v / mx) : 0}"><span class="dn">${d}</span>${v ? `<span class="dv">${v >= 1000 ? fmt(Math.round(v / 100) / 10) + 'k' : fmt(Math.round(v))}</span>` : ''}${inc[ds] ? '<i class="din"></i>' : ''}${due[ds] ? '<i class="ddue"></i>' : ''}</button>`;
    }
    return `<div class="cal"><div class="cwd">${wd.map(w => `<span>${w}</span>`).join('')}</div><div class="cgrid">${cells}</div>
    <div class="legend" style="padding:8px 4px 0"><span style="--c:var(--neg)">${t('expense')}</span><span style="--c:var(--accent)">${t('income')}</span><span style="--c:var(--warn)">${t('dueSoon')}</span></div></div>`;
  }
  function totalsBar(tx) {
    const pl = x => (txCat && FIN_CATS.has(catRoot(txCat)) ? true : isPL(x)),
      inc = sumB(tx.filter(x => x.type === 'income' && pl(x))),
      exp = sumB(tx.filter(x => x.type === 'expense' && pl(x))),
      trs = tx.filter(x => x.type === 'transfer');
    if (txFilter === 'transfer')
      return `<div class="totbar"><div><span class="label">${t('countWord')}</span><b>${trs.length}</b></div><div style="grid-column:span 2"><span class="label">${t('transfers')} (${BASE()})</span><b>${fmt(trs.reduce((v, x) => v + baseAmt(x), 0))}</b></div></div>`;
    return `<div class="totbar"><div class="tile" data-act="stmtFilt" data-ty="income"><span class="label">${t('income')}</span><b class="pos">${fmt(inc)}</b></div><div class="tile" data-act="stmtFilt" data-ty="expense"><span class="label">${t('expense')}</span><b>${fmt(exp)}</b></div><div class="tile" data-act="stmtFilt" data-ty="net"><span class="label">${t('netShort')} · ${tx.length} ${t('rowsWord')}</span><b class="${inc - exp < 0 ? 'neg' : ''}">${fmt(inc - exp)}</b></div></div>`;
  }
  function recBody() {
    return (
      `<p class="hint">${t('recHint')}</p>` +
      (S.recur.length
        ? `<div class="list">${S.recur
            .map(r => {
              const a = accOf(r.tpl.acc);
              return `<div class="row tap" data-act="editRec" data-id="${r.id}"><div class="glyph">↻</div>
      <div class="main"><span class="t">${esc(r.tpl.note || (r.tpl.type === 'transfer' ? t('transfer') : catPath(r.tpl.cat)))}</span><span class="s">${freqName(r.freq)} · ${t('nextOn')}: ${esc(shortDate(r.next))}${r.end ? ' · ' + t('recUntil') + ' ' + esc(shortDate(r.end)) : ''} · ${esc(a ? a.name : '')}</span></div>
      <b class="amt ${r.tpl.type === 'income' ? 'pos' : ''}">${moneyC(r.tpl.amount, a ? a.currency : BASE())}</b></div><div class="row sub"><button class="link" data-act="stmtRec" data-id="${r.id}">${t('statement')} ›</button></div>`;
            })
            .join('')}</div>`
        : `<div class="list"><div class="empty">${t('noItems')}</div></div>`)
    );
  }
  function vTx() {
    const tx = txFiltered().sort((a, b) => b.date.localeCompare(a.date));
    const groups = {};
    tx.forEach(x => (groups[x.date] = groups[x.date] || []).push(x));
    const catOpt = `<option value="">${t('allCats')}</option><optgroup label="${t('expense')}">${catOptsTree('expense', txCat, false)}</optgroup><optgroup label="${t('income')}">${catOptsTree('income', txCat, false)}</optgroup>`;
    const addRow = `<div class="addrow"><button class="btn" data-act="addTxT" data-ty="expense">− ${t('exp1')}</button><button class="btn" data-act="addTxT" data-ty="income">+ ${t('inc1')}</button><button class="btn" data-act="addTxT" data-ty="transfer">⇄ ${t('transfer')}</button></div>`;
    if (txView === 'rec')
      return `${addRow}${segHTML(
        'tv',
        [
          ['list', '☰ ' + t('viewList')],
          ['cal', '▦ ' + t('viewCal')],
          ['rec', '↻ ' + t('recurring')]
        ],
        txView
      )}${recBody()}<button class="btn block" data-act="addRecT">+ ${t('addRec')}</button>`;
    return `${addRow}${segHTML(
      'txf',
      [
        ['all', t('all')],
        ['expense', t('expense')],
        ['income', t('income')],
        ['transfer', t('transfers')]
      ],
      txFilter
    )}
  <div class="search"><div class="qbox"><input class="in-f" id="q" placeholder="${t('search')}" value="${esc(txQuery)}" autocomplete="off">${txQuery ? `<button class="qx" id="qx" type="button" aria-label="clear">✕</button>` : ''}</div><button class="btn" data-act="exportTx" title="${t('export')}">⤓</button></div>
  <div class="filters"><select class="in-f" id="cf">${catOpt}</select><select class="in-f" id="af"><option value="">${t('allAccs')}</option>${accOpts(txAcc)}</select>
    ${
      allTags().length
        ? `<select class="in-f" id="tgf"><option value="">${t('allTags')}</option>${allTags()
            .map(g => `<option value="${esc(g)}" ${g === txTag ? 'selected' : ''}>#${esc(g)}</option>`)
            .join('')}</select>`
        : ''
    }
    </div><div class="stickbar">${segHTML(
      'tv',
      [
        ['list', '☰ ' + t('viewList')],
        ['cal', '▦ ' + t('viewCal')],
        ['rec', '↻ ' + t('recurring')]
      ],
      txView
    )}${totalsBar(tx)}</div>
  ${txView === 'cal' ? calendarHTML() : ''}
  ${txDay ? `<div class="banner"><span>${esc(dayLbl(txDay))}</span><button class="btn sm" data-act="clearDay">✕</button></div>` : ''}
  ${txCat || txAcc || txQuery || txTag ? `<button class="link" data-act="clearFilt" style="align-self:flex-start">✕ ${t('clearFilters')}</button>` : ''}
  <div class="list" style="overflow:clip">${
    tx.length
      ? Object.keys(groups)
          .map(d => `<div class="daylbl">${esc(dayLbl(d))}</div>${groups[d].map(txRow).join('')}`)
          .join('')
      : `<div class="empty">${t('noTx')}</div>`
  }</div>`;
  }
