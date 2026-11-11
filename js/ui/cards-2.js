/* Card and obligation screens, net worth and zakat. (part 2 of 2; continues from cards-1.js) */
  function vObl() {
    if (oblTab === 'rec') oblTab = 'inst';
    let body = '';
    if (oblTab === 'inst') {
      const PEo = perRange()[1];
      const LI = oblList('inst');
      body = LI.length
        ? LI.map(it => {
            const n = it.paid.length,
              nx = instNext(it),
              pd = oblPaidReal('inst', it, PEo),
              lf = oblLeftAt('inst', it, PEo),
              wv = oblWaived('inst', it),
              p = (it.monthly * it.count - lf) / (it.monthly * it.count);
            const late = instMonths(it).filter(m => m < TODAY_YM && !it.paid.includes(m)).length;
            return `<div class="card"><div class="hd tap" data-act="stmtObl" data-k="inst" data-id="${it.id}"><h3>${esc(it.name)} ›</h3>${nx ? (late ? `<span class="pill neg">${t('overdue')} ${late}</span>` : '') : `<span class="pill ok">${t('done')}</span>`}</div>
      <div class="kv"><div><span class="label">${t('monthly')}</span><b>${moneyC(it.monthly, it.currency)}</b></div><div><span class="label">${t('paidLbl')}</span><b>${moneyC(pd, it.currency)}</b></div><div><span class="label">${t('remaining')}</span><b>${moneyC(lf, it.currency)}</b></div></div>${wv > 0.004 ? `<span class="muted">${t('waivedLbl')}: ${moneyC(wv, it.currency)}</span>` : ''}
      <div class="bar"><i style="width:${p * 100}%"></i></div>
      <div class="hd"><span class="muted"><span class="num">${n} / ${it.count}</span> · ${nx ? t('next') + ': ' + esc(monthLbl(nx)) : ''}</span></div>
      <div class="acts">${nx ? `<button class="btn sm pri" data-act="payInst" data-id="${it.id}">${t('pay')}</button>` : ''}<button class="btn sm" data-act="stmtObl" data-k="inst" data-id="${it.id}">${t('statement')}</button><button class="btn sm" data-act="editInst" data-id="${it.id}">${t('edit')}</button></div></div>`;
          }).join('')
        : `<div class="list"><div class="empty">${t('noItems')}</div></div>`;
    } else if (oblTab === 'gam') {
      const PEg = perRange()[1];
      const LG = oblList('gam');
      body = LG.length
        ? LG.map(g => {
            const n = g.paid.length,
              nx = gamNext(g),
              po = gamPayout(g),
              pd = oblPaidReal('gam', g, PEg),
              lfg = oblLeftAt('gam', g, PEg);
            return `<div class="card"><div class="hd tap" data-act="stmtObl" data-k="gam" data-id="${g.id}"><h3>${esc(g.name)} ›</h3>${g.received ? `<span class="pill ok">${t('received')}</span>` : `<span class="pill">${t('turnOf')}: ${esc(monthLbl(po))}</span>`}</div>
      <div class="kv"><div><span class="label">${t('share')}</span><b>${moneyC(g.share, g.currency)}</b></div><div><span class="label">${t('payout')}</span><b>${moneyC(g.share * g.members, g.currency)}</b></div><div><span class="label">${t('remaining')}</span><b>${moneyC(lfg, g.currency)}</b></div></div>
      <div class="bar"><i style="width:${((g.share * g.members - lfg) / (g.share * g.members)) * 100}%"></i></div>
      <div class="hd"><span class="muted"><span class="num">${n} / ${g.members}</span>${nx ? ' · ' + t('next') + ': ' + esc(monthLbl(nx)) : ''}</span></div>
      <div class="acts">${nx ? `<button class="btn sm pri" data-act="payGam" data-id="${g.id}">${t('pay')}</button>` : ''}${!g.received ? `<button class="btn sm" data-act="recvGam" data-id="${g.id}">${t('collectPay')}</button>` : ''}<button class="btn sm" data-act="stmtObl" data-k="gam" data-id="${g.id}">${t('statement')}</button><button class="btn sm" data-act="editGam" data-id="${g.id}">${t('edit')}</button></div></div>`;
          }).join('')
        : `<div class="list"><div class="empty">${t('noItems')}</div></div>`;
    } else {
      const PEl = perRange()[1];
      body =
        `<p class="hint">${t('loansHint')}</p>` +
        (oblList('loan').length
          ? [...oblList('loan')]
              .sort((a, b) => (loanLeft(a) === 0) - (loanLeft(b) === 0))
              .map(l => {
                const left = loanLeftAt(l, PEl),
                  pd = l.pays.filter(p => p.date <= PEl).reduce((v, p) => v + (+p.amount || 0), 0);
                return `<div class="card"><div class="hd tap" data-act="stmtPerson" data-name="${esc(l.person)}"><div><h3>${esc(l.person)} ›</h3><span class="muted">${l.dir === 'lent' ? t('lent') : t('borrowed')} · ${esc(dayLbl(l.date))}${left && l.plan === 'inst' && l.instAmt ? ' · ' + fmt(l.instAmt) + ' ' + t('perMonthFrom') + ' ' + esc(monthLbl(l.instStart)) : l.due && left ? ' · ' + t('loanDue') + ': ' + esc(monthLbl(l.due)) : ''}</span></div>${left === 0 ? `<span class="pill ok">${t('settled')}</span>` : `<span class="pill ${l.dir === 'lent' ? 'ok' : 'warn'}">${l.dir === 'lent' ? t('owedToMe') : t('iOwe')}</span>`}</div>
      <div class="kv"><div><span class="label">${t('amount')}</span><b>${moneyC(l.amount, l.currency)}</b></div><div><span class="label">${t('paidLbl')}</span><b>${moneyC(pd, l.currency)}</b></div><div><span class="label">${t('remaining')}</span><b class="${left && l.dir === 'borrowed' ? 'neg' : ''}">${moneyC(left, l.currency)}</b></div></div>
      <div class="bar"><i style="width:${Math.min(100, (pd / l.amount) * 100)}%"></i></div>
      ${l.note ? `<span class="muted">${esc(l.note)}</span>` : ''}
      <div class="acts">${left ? `<button class="btn sm pri" data-act="repay" data-id="${l.id}">${t('repay')}</button>` : ''}<button class="btn sm" data-act="stmtPerson" data-name="${esc(l.person)}">${t('statement')}</button><button class="btn sm" data-act="editLoan" data-id="${l.id}">${t('edit')}</button></div></div>`;
              })
              .join('')
          : `<div class="list"><div class="empty">${t('noItems')}</div></div>`);
    }
    if (oblTab === 'goal') body = goalsBody();
    if (oblTab === 'card') body = cardsBody();
    if (oblTab === 'gam') body = `<button class="btn block" data-act="gamCalc">🧮 ${t('gamCalc')}</button>` + body;
    if (false) {
      body =
        `<p class="hint">${t('recHint')}</p>` +
        (S.recur.length
          ? `<div class="list">${S.recur
              .map(r => {
                const a = accOf(r.tpl.acc);
                return `<div class="row tap" data-act="editRec" data-id="${r.id}"><div class="glyph">↻</div>
      <div class="main"><span class="t">${esc(r.tpl.note || (r.tpl.type === 'transfer' ? t('transfer') : catPath(r.tpl.cat)))}</span><span class="s">${freqName(r.freq)} · ${t('nextOn')}: ${esc(shortDate(r.next))} · ${esc(a ? a.name : '')}</span></div>
      <b class="amt ${r.tpl.type === 'income' ? 'pos' : ''}">${moneyC(r.tpl.amount, a ? a.currency : BASE())}</b></div><div class="row sub"><button class="link" data-act="stmtRec" data-id="${r.id}">${t('statement')} ›</button></div>`;
              })
              .join('')}</div>`
          : `<div class="list"><div class="empty">${t('noItems')}</div></div>`);
    }
    const addLbl = {
      inst: t('addInst'),
      gam: t('addGam'),
      loan: t('addLoan'),
      rec: t('addRec'),
      goal: t('addGoal'),
      card: t('addCard')
    }[oblTab];
    return `<div class="stickbar">${segHTML(
      'obf',
      [
        ['inst', t('installments')],
        ['gam', t('gameyas')],
        ['card', t('cardsT')],
        ['loan', t('loans')],
        ['goal', t('goals')]
      ],
      oblTab
    )}${oblSum()}
    <div class="search"><div class="qbox"><input class="in-f" id="oq" placeholder="${t('oblSearch')}" value="${esc(oblQ)}" autocomplete="off">${oblQ ? `<button class="qx" id="oqx" type="button" aria-label="clear">✕</button>` : ''}</div></div>
    ${oblChips()}
    ${oblF.size || oblC.size || oblQ ? `<button class="link" id="ofx" style="align-self:flex-start">✕ ${t('clearFilters')}</button>` : ''}</div>${body}${['inst', 'gam', 'loan', 'goal'].includes(oblTab) && oblBase(oblTab).length > 1 ? `<button class="btn block" data-act="oblOrder">↕ ${t('reorder')}</button>` : ''}${(() => {
      if (!['inst', 'gam', 'loan'].includes(oblTab) || oblF.size || oblQ) return '';
      const n = oblBase(oblTab).filter(o => oblDone(oblTab, o)).length;
      return n
        ? `<button class="link" style="align-self:center;margin:4px 0" data-act="showDone" data-id="t${oblTab}">${SHOW_DONE['t' + oblTab] ? t('hideDone') : t('showDone').replace('%n', n)}</button>`
        : '';
    })()}<button class="btn block" data-act="addObl">+ ${addLbl}</button>`;
  }
  function netWorthHTML() {
    const PE = perRange()[1],
      n = netWorth(PE),
      ms = Array.from({length: 12}, (_, i) => ymAdd(TODAY_YM, i - 11)).map(m => {
        const end = m === TODAY_YM ? TODAY : ymAdd(m, 1) + '-01';
        const d = m === TODAY_YM ? TODAY : iso(new Date(dOf(end).getTime() - 864e5));
        return {m, v: netWorth(d).net};
      });
    const top = Math.max(1, ...ms.map(o => Math.abs(o.v))),
      row = (l, v, c) =>
        `<div class="row"><div class="main"><span class="t">${l}</span></div><b class="amt ${c || ''}">${money(v)}</b></div>`;
    return `<details class="box" id="nw" data-k="nw"><summary><h2>${t('netWorth')} <small class="muted" style="font-size:12px;font-weight:400">${t('asOf')} ${esc(dmyOf(dsDate(PE)))}</small></h2><span class="sumv ${n.net < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="nw">${money(n.net)}</span> <small>${esc(curSym(BASE()))}</small></span></summary>
    <div class="slip"><div class="net"><span class="label">${t('netWorth')} ${t('asOf')} ${esc(dmyOf(dsDate(PE)))}</span><span class="big ${n.net < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="nw">${money(n.net)}</span><small>${esc(curSym(BASE()))}</small></span></div></div>
    <div class="list">${row(t('nwAssets'), n.assets)}${n.neg ? row(t('nwNeg'), n.neg, 'neg') : ''}${row(t('owedToMe'), n.recv, 'pos')}${row(t('iOwe'), -n.pay, n.pay ? 'neg' : '')}${row(t('nwObl'), -n.obl, n.obl ? 'neg' : '')}${
      n.obl
        ? `<div class="row" style="padding-top:0"><div class="main"><span class="s">${t('nwOblSplit')
            .replace('%d', fmt(Math.round(n.oblDue)))
            .replace('%l', fmt(Math.round(n.oblLater)))}</span></div></div>`
        : ''
    }${Math.abs(n.gam) > 0.5 ? row(t('nwGam'), n.gam, n.gam < 0 ? 'neg' : 'pos') : ''}</div>
    <div class="list"><div class="cols" dir="ltr" style="grid-template-columns:repeat(12,minmax(18px,1fr))">${(lng() === 'ar' ? [...ms].reverse() : ms).map(o => `<div class="c" title="${esc(monthLbl(o.m))}: ${fmt(o.v)}"><i class="${o.v < 0 ? 'b' : 'a'}" style="width:60%;max-width:20px;height:${(Math.abs(o.v) / top) * 100}%"></i></div>`).join('')}</div>
    <div class="colsx" dir="ltr" style="grid-template-columns:repeat(12,minmax(18px,1fr))">${(lng() === 'ar' ? [...ms].reverse() : ms).map(o => `<span>${esc(colLbl(o.m, ms.length))}</span>`).join('')}</div>
    <p class="hint" style="padding:0 14px 12px">${t('nwHint')}</p></div></details>`;
  }
  function zakatHTML() {
    const z = (S.zakat = Object.assign({karat: '24', gold: true, recv: true, debt: true}, S.zakat || {}));
    const price = rateOf('G' + z.karat),
      nisab = 85 * price;
    let cash = 0,
      gold = 0;
    S.accounts.forEach(a => {
      const v = toBase(accBalance(a), a.currency);
      if (v <= 0) return;
      if (a.type === 'gold') gold += v;
      else cash += v;
    });
    const recv = S.loans
        .filter(l => l.dir === 'lent')
        .reduce((v, l) => v + toBase(loanLeft(l), l.currency || BASE()), 0),
      debt = S.loans
        .filter(l => l.dir === 'borrowed')
        .reduce((v, l) => v + toBase(loanLeft(l), l.currency || BASE()), 0);
    const base = cash + (z.gold ? gold : 0) + (z.recv ? recv : 0) - (z.debt ? debt : 0),
      due = price && base >= nisab;
    const row = (l, v) =>
      `<div class="row"><div class="main"><span class="t">${l}</span></div><b class="amt">${money(v)}</b></div>`;
    return `<details class="box" id="zk" data-k="zk"><summary><h2>${t('zakat')} <small class="muted" style="font-size:12px;font-weight:400">${t('asOfToday')}</small></h2><span class="sumv">${price ? `<span class="why" data-act="why" data-w="zakat">${money(due ? base * 0.025 : 0)}</span>` : '—'} <small>${esc(curSym(BASE()))}</small></span></summary>
    <div class="list">
      <div class="setrow"><span>${t('nisabKarat')}</span><select class="in-f" id="zkK" style="max-width:40%"><option value="21" ${z.karat === '21' ? 'selected' : ''}>${t('k21')}</option><option value="24" ${z.karat === '24' ? 'selected' : ''}>${t('k24')}</option></select></div>
      <label class="setrow chk" style="justify-content:space-between"><span>${t('zkGold')}</span><input type="checkbox" id="zkG" ${z.gold ? 'checked' : ''}></label>
      <label class="setrow chk" style="justify-content:space-between"><span>${t('zkRecv')}</span><input type="checkbox" id="zkR" ${z.recv ? 'checked' : ''}></label>
      <label class="setrow chk" style="justify-content:space-between"><span>${t('zkDebt')}</span><input type="checkbox" id="zkD" ${z.debt ? 'checked' : ''}></label>
    </div>
    ${
      price
        ? `<div class="list">${row(t('zkCash'), cash)}${z.gold ? row(t('zkGoldVal'), gold) : ''}${z.recv ? row(t('owedToMe'), recv) : ''}${z.debt ? row(t('iOwe'), -debt) : ''}
      <div class="row"><div class="main"><span class="t"><b>${t('zkBase')}</b></span></div><b class="amt">${money(base)}</b></div>
      <div class="row"><div class="main"><span class="t">${t('nisab')}</span><span class="s">85 ${t('gram')} × ${fmt(price)}</span></div><b class="amt">${money(nisab)}</b></div></div>
      <div class="slip"><div class="net"><span class="label">${due ? t('zkDue') : t('zkNotDue')}</span><span class="big">${money(due ? base * 0.025 : 0)}<small>${esc(curSym(BASE()))}</small></span></div></div>`
        : `<div class="banner"><span>${t('needGoldPrice')}</span><button class="btn sm pri" data-act="rates">${t('rates')}</button></div>`
    }
    <p class="hint">${t('zkNote')}</p></details>`;
  }
  function tagsHTML() {
    const tx = txIn().filter(x => x.type === 'expense' && x.tags && x.tags.length);
    if (!tx.length) return '';
    const by = new Map();
    tx.forEach(x => x.tags.forEach(g => by.set(g, (by.get(g) || 0) + baseAmt(x))));
    const rows = [...by].sort((a, b) => b[1] - a[1]);
    return `<details class="box" open><summary><h2>${t('byTag')}</h2></summary><div class="list">${rows.map(([g, v]) => `<div class="catbar tile" data-act="stmtTag" data-name="${esc(g)}"><div class="l"><span>#${esc(g)}</span><span>${fmt(v)}</span></div><div class="bar"><i style="width:${(v / rows[0][1]) * 100}%;background:var(--neg)"></i></div></div>`).join('')}</div></details>`;
  }
