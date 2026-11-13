/* The main tab views: home, activity and reports. (part 1 of 2) */
  /* ---------- views ---------- */
  const txRow = x => {
    const a = accOf(x.acc),
      multi = S.accounts.length > 1;
    if (x.type === 'transfer') {
      const b = accOf(x.toAcc);
      return `<div class="row tap" data-tx="${x.id}"><div class="glyph">⇄</div>
    <div class="main"><span class="t">${esc(x.note || t('transfer'))}</span><span class="s">${esc(a.name + ' (' + a.currency + ')' + (lng() === 'en' ? ' → ' : ' ← '))}${esc(b ? b.name + ' (' + b.currency + ')' : '')} · ${esc(dayLbl(x.date))}</span></div>
    <span class="amt">${moneyC(x.amount, a.currency)}</span></div>`;
    }
    return `<div class="row tap" data-tx="${x.id}"><div class="glyph ${x.type === 'income' ? 'in' : ''}">${esc(initial(catName(x.cat)))}</div>
  <div class="main"><span class="t">${esc(x.note || catName(x.cat))}</span><span class="s">${(x.tags || []).map(g => '#' + esc(g) + ' ').join('')}${ACT !== 'me' && x.by ? '👤 ' + esc(x.by.split('@')[0]) + ' · ' : ''}${x.rcpt ? '🧾 ' : ''}${x.rec ? '↻ ' : ''}${esc(x.note ? catName(x.cat) + ' · ' : '')}${multi ? esc(a.name) + ' · ' : ''}${esc(dayLbl(x.date))}</span></div>
  <span class="amt ${x.type === 'income' ? 'pos' : ''}">${x.type === 'income' ? '+' : '−'}${moneyC(x.amount, a.currency)}</span></div>`;
  };
  function accountsHTML() {
    const pEnd = perRange()[1],
      AB = a => accBalanceAt(a, pEnd);
    const total = S.accounts.reduce((v, a) => v + valAt(a, pEnd), 0),
      miss = missingRates();
    const groups = groupsOf(S.accounts, accGroup);
    return `<details class="box" open><summary><h2>${t('accounts')} <small class="muted" style="font-weight:400;font-size:12px">${t('asOf')} ${esc(dmyOf(dsDate(pEnd)))}</small></h2><span class="sumv"><span class="why" data-act="why" data-w="accTot">${fmt(total)}</span> <small>${esc(curSym(BASE()))}</small></span></summary>
    <div class="list">${[...groups]
      .map(([g, accs]) => {
        const gt = accs.reduce((v, a) => v + toBase(AB(a), a.currency), 0);
        const banks = groupsOf(accs, a => a.name);
        return (
          `<div class="grp"><span>${esc(g)}</span><span class="num">${fmt(gt)} ${esc(curSym(BASE()))}</span></div>` +
          [...banks]
            .map(
              ([
                name,
                list
              ]) => `<div class="row" style="align-items:flex-start"><div class="glyph">${esc(initial(name))}</div>
      <div class="main"><span class="t">${esc(name)} <button class="link" style="padding:0 6px;font-size:12px" data-act="editAcc" data-id="${list[0].id}">${t('edit')}</button></span>
        <span class="balchips">${list
          .map(a => {
            const v = AB(a);
            return `<button class="balchip" data-act="stmtAcc" data-id="${a.id}"><span class="num ${v < 0 ? 'neg' : ''}">${fmt(v)}</span><small class="cur">${esc(curSym(a.currency))}</small></button>`;
          })
          .join('')}
        ${list[0].type === 'gold' || list[0].type === 'cert' ? '' : `<button class="balchip add" data-act="addAccCur" data-name="${esc(name)}" data-type="${list[0].type}" data-group="${esc(list[0].group || '')}">+ ${t('addCur')}</button>`}</span>
        ${list[0].type === 'cert' && list[0].rate ? `<span class="s">${list[0].rate}% · ${list[0].payout === 'maturity' ? t('atMaturity') : freqName(list[0].payout)}${list[0].maturity ? ' · ' + t('certEnd') + ' ' + esc(shortDate(list[0].maturity)) : ''}</span>` : ''}
        ${list[0].type === 'gold' ? `<span class="s">≈ ${fmt(list.reduce((v, a) => v + toBase(AB(a), a.currency), 0))} ${esc(curSym(BASE()))}</span>` : ''}</div></div>`
            )
            .join('')
        );
      })
      .join('')}
      <div class="row"><button class="link" data-act="addAcc">+ ${t('addAcc')}</button><button class="btn sm" data-act="accOrder" style="margin-inline-start:auto">↕ ${t('reorder')}</button><button class="btn sm" data-act="reconAll">⚖️ ${t('reconAll')}${(() => {
        const l = (S.recons || []).slice(-1)[0];
        return l ? ' <small class="muted">· ' + esc(l.date.slice(8, 10) + '/' + l.date.slice(5, 7)) + '</small>' : '';
      })()}</button></div>
    </div>${miss.length ? `<div class="banner"><span>${t('needRates')}: ${miss.join('، ')}</span><button class="btn sm pri" data-act="rates">${t('rates')}</button></div>` : ''}
    <p class="hint">${t('tapForStmt')}</p></details>`;
  }
  function catTotalsHTML(ty) {
    const tx = txIn().filter(x => x.type === ty && isPL(x));
    if (!tx.length) return '';
    const by = new Map();
    tx.forEach(x => {
      const k = catRoot(x.cat);
      by.set(k, (by.get(k) || 0) + baseAmt(x));
    });
    const tot = [...by.values()].reduce((a, b) => a + b, 0),
      rows = [...by].sort((a, b) => b[1] - a[1]);
    return `<details class="box"><summary><h2>${ty === 'expense' ? t('expByCat') : t('incByCat')}</h2><span class="sumv">${`<span class="why" data-act="why" data-w="${ty === 'expense' ? 'catExp' : 'catInc'}">${fmt(tot)}</span>`} <small>${esc(curSym(BASE()))}</small></span></summary>
    <div class="list">${rows
      .map(([id, v]) => {
        const kids = catKids(ty, id).length;
        return `<div class="catbar tile" data-act="${kids ? 'catGroup' : 'stmtCat'}" data-ty="${ty}" data-id="${id}"><div class="l"><span>${esc(catName(id))}${kids ? ' ›' : ''}</span><span>${fmt(v)}<span class="pct">${Math.round((v / tot) * 100)}%</span></span></div><div class="bar"><i style="width:${(v / rows[0][1]) * 100}%;${ty === 'income' ? '' : 'background:var(--neg)'}"></i></div></div>`;
      })
      .join('')}</div></details>`;
  }
  function loansHTML() {
    if (!S.loans.length) return '';
    const E = perRange()[1],
      loanLeft = l => loanLeftAt(l, E);
    const people = groupsOf(S.loans, l => l.person);
    const bal = ls =>
      ls.reduce((v, l) => v + (l.dir === 'lent' ? 1 : -1) * toBase(loanLeft(l), l.currency || BASE()), 0);
    const owed = S.loans
        .filter(l => l.dir === 'lent')
        .reduce((a, l) => a + toBase(loanLeft(l), l.currency || BASE()), 0),
      owe = S.loans
        .filter(l => l.dir === 'borrowed')
        .reduce((a, l) => a + toBase(loanLeft(l), l.currency || BASE()), 0);
    const allP = [...people],
      liveP = allP.filter(([p, ls]) => ls.some(l => loanLeft(l) >= 0.5)),
      doneP = allP.length - liveP.length,
      groups = groupsOf(SHOW_DONE.loan ? allP : liveP, ([p, ls]) => plainGroup(ls[0]));
    return `<details class="box" data-k="loanh"><summary><h2>${t('loans')}</h2><span class="muted"><span class="pos">${t('owedToMe')} ${money(owed)}</span> · <span class="${owe ? 'neg' : ''}">${t('iOwe')} ${money(owe)}</span></span></summary>
    <div class="list">${[...groups]
      .map(
        ([g, ps]) =>
          `<div class="grp"><span>${esc(g)}</span><span class="num">${fmt(bal(ps.flatMap(p => p[1])))}</span></div>` +
          ps
            .map(([p, ls]) => {
              const v = bal(ls);
              return `<div class="row tap" data-act="stmtPerson" data-name="${esc(p)}"><div class="glyph ${v > 0 ? 'in' : ''}">${esc(initial(p))}</div><div class="main"><span class="t">${esc(p)}</span><span class="s">${v > 0.004 ? t('drPerson') : v < -0.004 ? t('crPerson') : t('settledBal')}</span></div><b class="amt ${v < 0 ? 'neg' : v > 0 ? 'pos' : ''}">${money(Math.abs(v))}</b></div>`;
            })
            .join('')
      )
      .join(
        ''
      )}${doneP ? `<div class="row"><button class="link" data-act="showDone" data-id="loan">${SHOW_DONE.loan ? t('hideDone') : t('showDone').replace('%n', doneP)}</button></div>` : ''}</div></details>`;
  }
  function oblHTML() {
    const E = perRange()[1],
      oblLeft = (k, o) => oblLeftAt(k, o, E);
    const items = [
      ...S.inst.map(o => ({k: 'inst', o, per: o.monthly, n: o.count})),
      ...S.gam.map(o => ({k: 'gam', o, per: o.share, n: o.members}))
    ];
    if (!items.length) return '';
    const rem = it => toBase(oblLeft(it.k, it.o), it.o.currency || BASE());
    const tot = items.reduce((v, it) => v + rem(it), 0),
      live = items.filter(it => Math.abs(oblLeft(it.k, it.o)) >= 0.5),
      done = items.length - live.length,
      groups = groupsOf(SHOW_DONE.obl ? items : live, it => plainGroup(it.o));
    return `<details class="box" data-k="oblh"><summary><h2>${t('instGam')}</h2><span class="sumv"><small>${t('remaining')}</small> ${fmt(tot)} <small>${esc(curSym(BASE()))}</small></span></summary>
    <div class="list">${[...groups]
      .map(
        ([g, list]) =>
          `<div class="grp"><span>${esc(g)}</span><span class="num">${fmt(list.reduce((v, it) => v + rem(it), 0))}</span></div>` +
          list
            .map(it => {
              const left = oblLeft(it.k, it.o);
              return `<div class="row tap" data-act="stmtObl" data-k="${it.k}" data-id="${it.o.id}"><div class="glyph">${esc(initial(it.o.name))}</div><div class="main"><span class="t">${esc(it.o.name)}</span><span class="s">${it.k === 'inst' ? t('installments') : t('gameyas')} · <span class="num">${it.o.paid.length} / ${it.n}</span></span></div><b class="amt">${moneyC(left, it.o.currency)}</b></div>`;
            })
            .join('')
      )
      .join(
        ''
      )}${done ? `<div class="row"><button class="link" data-act="showDone" data-id="obl">${SHOW_DONE.obl ? t('hideDone') : t('showDone').replace('%n', done)}</button></div>` : ''}</div></details>`;
  }
  function goalsHTML() {
    if (!S.goals.length) return '';
    return `<details class="box"><summary><h2>${t('goals')}</h2><span class="sumv">${S.goals.length}</span></summary><div class="list">${S.goals
      .map(g => {
        const sv = goalSavedAt(g, perRange()[1]),
          p = Math.min(1, sv / (+g.target || 1));
        return `<div class="catbar tile" data-act="goGoals"><div class="l"><span>${esc(g.name)}</span><span>${fmt(sv)} / ${fmt(g.target)}<span class="pct">${Math.round(p * 100)}%</span></span></div><div class="bar"><i style="width:${p * 100}%"></i></div></div>`;
      })
      .join('')}</div></details>`;
  }
  function vHome() {
    const tx = txIn(),
      inc = sumB(tx.filter(x => x.type === 'income' && isPL(x))),
      exp = sumB(tx.filter(x => x.type === 'expense' && isPL(x))),
      net = inc - exp;
    const [PA, PE] = perRange(),
      DM = PE.slice(0, 7),
      due = dueFor(DM),
      past = PE < TODAY,
      future = PA > TODAY;
    const nw = netWorth(PE).net;
    const alerts = budgetState().filter(b => b.p >= 0.8),
      sa = shortAlert();
    const recent = [...tx].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    const dueTotal = due.filter(d => d.k !== 'gamr').reduce((a, d) => a + toBase(d.amount, d.cur || BASE()), 0);
    return `${sa ? `<div class="banner" style="background:color-mix(in srgb,var(--neg) 14%,var(--surface))"><span>⚠️ ${esc(t('shortMsg').replace('%d', shortDate(sa.date)).replace('%l', sa.label).replace('%n', fmt(sa.need)))}</span><button class="btn sm pri" data-act="cashSheet">${t('details')}</button></div>` : ''}${drv.linked && drv.needAuth ? `<div class="banner"><span>${useWorker() && !RT ? t('driveNeedRT') : t('driveNeedAuth')}</span><button class="btn sm pri" data-act="driveResume">${useWorker() && !RT ? t('driveFinish') : t('driveResume')}</button></div>` : ''}${!S.sample && !drv.linked && backupDue() ? `<div class="banner"><span>${t('remindBk')}</span><button class="btn sm pri" data-act="shareDrive">${t('shareDrive')}</button></div>` : ''}${NEWVER && NEWVER !== APP_VER ? `<div class="banner"><span>${t('newVer')} v${esc(NEWVER)}</span><button class="btn sm pri" data-act="appUpdate">${t('appUpdate')}</button></div>` : ''}${S.sample ? `<div class="banner"><span>${t('sampleBanner')}</span><button class="btn sm" data-act="clearSample">${t('clearSample')}</button></div>` : ''}
  <form class="qadd" id="qadd"><div class="qbox"><input class="in-f" id="qtext" placeholder="${t('quickHint')}" autocomplete="off" enterkeyhint="send"></div>${SpeechRec ? `<button type="button" class="btn" id="qmic" aria-label="voice">🎤</button>` : ''}<button class="btn pri" aria-label="add">↵</button></form>
  ${
    S.quick.length
      ? `<div class="qchips">${S.quick
          .map(q => {
            const a = accOf(q.acc);
            return `<button class="balchip" data-act="useQuick" data-id="${q.id}">${esc(q.note || catName(q.cat))} <small class="cur">${fmt(q.amount)}${a && a.currency !== BASE() ? ' ' + esc(curSym(a.currency)) : ''}</small></button>`;
          })
          .join('')}</div>`
      : ''
  }
  ${glanceHTML()}
  ${
    past
      ? ''
      : (() => {
          const x = safeToSpend();
          return `<div class="slip tile" data-act="safe"><div class="net"><span class="label">${t('safeTitle')}${future ? ' <small class="muted">(' + t('fromToday') + ')</small>' : ''} ›</span><span class="mid ${x.safe < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="safe">${money(x.safe)}</span> <small class="muted">${esc(curSym(BASE()))}</small></span><span class="label">${x.safe > 0 ? fmt(x.perDay) + ' ' + esc(curSym(BASE())) + ' ' + t('perDay') + ' · ' : ''}${x.daysLeft} ${t('daysLeft')}</span></div></div>`;
        })()
  }
  <section class="slip">
    ${(() => {
      const [a, b] = perRange(),
        P = perCash(),
        o = P.o,
        c = P.c,
        ci = P.gi,
        co = P.go;
      const owe = cards()
          .map(x => ({x, c: cardInfo(x, b)}))
          .filter(z => z.c.owed > 0),
        oweT = owe.reduce((v, z) => v + toBase(z.c.owed, z.x.currency), 0),
        nextD = owe
          .map(z => {
            if (b < TODAY) return z.c.dueDate || cardDueFor(z.x, b);
            const c0 = cardInfo(z.x);
            return c0.due > 0.5 ? c0.dueDate : cardDueFor(z.x, TODAY);
          })
          .sort()[0];
      /* what has to be paid and by when: the closed statements (the same figure as the cards' "due" everywhere),
         not everything owed; one date for all of them reads as a sentence, several dates fall back to the total */
      const dueCs = owe.map(z => ({z, c0: z.c})).filter(q => q.c0.due > 0.5),
        dueAt = dueCs.reduce((v, q) => v + toBase(q.c0.due, q.z.x.currency), 0),
        dueDs = [...new Set(dueCs.map(q => q.c0.dueDate))],
        dueAmt = `<b class="why" data-act="why" data-w="cDue">${fmt(dueAt)}</b>`,
        dueLine = !dueCs.length
          ? ''
          : dueDs.length === 1
            ? t('payBy').replace('%d', esc(shortDate(dueDs[0]))).replace('%v', dueAmt) +
              (dueCs.length === 1 ? ' · ' + t('stmtTo').replace('%c', esc(dmyOf(dsDate(dueCs[0].c0.close)))) : '')
            : t('cardDue') + ' ' + dueAmt + ' · ' + t('nextPay') + ' ' + esc(shortDate(dueDs.sort()[0]));
      const sub = (pl, fn, xf, inn) => {
        const ps = [
          [inn ? t('plIn') : t('plOut'), pl],
          [t('finTitle'), fn],
          [t('xferShort'), xf]
        ].filter(z => z[1] > 0.5);
        return ps.length > 1
          ? `<small class="muted" style="display:block;font-size:11px;line-height:1.5">${ps.map(z => esc(z[0]) + ' ' + fmt(Math.round(z[1]))).join('<br>')}</small>`
          : '';
      };
      return `<div class="net tile" data-act="${P.proj ? 'cashSheet' : 'goAcc'}"><span class="label">${P.proj ? (per.mode === 'month' ? t('projEndMonth') : t('projEnd')) : per.mode === 'month' ? t('availEndMonth') : t('availEnd')} ›</span><span class="big ${c < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="availEnd">${money(c)}</span><small>${esc(curSym(BASE()))}</small></span></div>
    ${P.proj && !P.fut ? `<div class="row tap" data-act="goAcc" style="padding:4px 14px 8px"><div class="main"><span class="t">${t('availNow')}</span></div><b class="amt ${P.now < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="availNow">${money(P.now)}</span></b></div>` : ''}
    <div class="perf"></div>
    <div class="flowb"><div><span>${P.fut ? t('projStart') : t('carried')}</span><b class="${o < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="opening">${money(o)}</span></b></div><div><span>+ ${t('cashIn')}</span><b class="pos"><span class="why" data-act="why" data-w="cashIn">${money(ci)}</span></b>${sub(P.ai + P.pi, P.fIn, P.xIn, 1)}</div><div><span>− ${t('cashOut')}</span><b><span class="why" data-act="why" data-w="cashOut">${money(co)}</span></b>${sub(P.ao + P.po, P.fOut, P.xOut, 0)}</div></div>
    ${oweT > 0 ? `<div class="row tap" data-act="goCards" style="padding:8px 14px"><div class="main"><span class="t">💳 ${t('cardsOwe')}</span><span class="s">${dueLine || (nextD ? t('nextPay') + ' ' + esc(shortDate(nextD)) : '')}</span></div><b class="amt neg"><span class="why" data-act="why" data-w="cardsOwe">${money(oweT)}</span></b></div>` : ''}
    <div class="split"><div class="tile" data-act="stmtFlow" data-ty="income"><span class="label">${t('income')} ›</span><span class="mid pos">${money(inc)}</span></div><div class="tile" data-act="stmtFlow" data-ty="expense"><span class="label">${t('expense')} ›</span><span class="mid">${money(exp)}</span></div></div>
    <div class="net tile" data-act="stmtFlow" data-ty="net" style="padding-top:6px"><span class="label">${per.mode === 'month' ? t('netMonthOnly') : t('netPer')} ›</span><span class="mid ${net < 0 ? 'neg' : 'pos'}">${money(net)} <small class="muted">${esc(curSym(BASE()))}</small></span></div>
    ${finHTML(tx)}
    ${Math.abs(P.fx) > 1 ? `<p class="hint" style="padding:0 14px 8px;margin:0">${t('fxDiff')} ${money(P.fx)}</p>` : ''}`;
    })()}
  </section>
  <details class="box" data-k="due"><summary><h2>${per.mode === 'month' ? t('dueMonth') : t('dueUntil') + ' ' + esc(monthLbl(DM))}</h2>${dueTotal ? `<span class="sumv"><span class="why" data-act="why" data-w="due">${money(dueTotal)}</span> <small>${esc(curSym(BASE()))}</small></span>` : ''}</summary>
    <div class="list">${
      due.length
        ? due
            .map(
              d => `<div class="row"><div class="glyph ${d.k === 'gamr' ? 'in' : ''}">${esc(initial(d.name))}</div>
      <div class="main"><span class="t">${esc(d.name)}</span><span class="s">${d.k === 'inst' ? t('installments') : d.k === 'gam' ? t('gameyas') : t('payout')} · ${esc(monthLbl(d.ym))}</span></div>
      ${d.late ? `<span class="pill neg">${t('overdue')} ${d.late}</span>` : ''}${d.partial ? `<span class="pill warn">${t('partial')}</span>` : ''}
      <span class="amt ${d.k === 'gamr' ? 'pos' : ''}">${moneyC(d.amount, d.cur)}</span>
      <button class="btn sm ${d.k === 'gamr' ? '' : 'pri'}" data-act="${d.k === 'inst' ? 'payInst' : d.k === 'gam' ? 'payGam' : 'recvGam'}" data-id="${d.id}">${d.k === 'gamr' ? t('receive') : t('pay')}</button></div>`
            )
            .join('')
        : ''
    }
      ${S.loans
        .map(l => ({l, v: loanOwedUpTo(l, DM)}))
        .filter(o => o.v > 0)
        .map(
          ({l, v}) =>
            `<div class="row"><div class="glyph ${l.dir === 'lent' ? 'in' : ''}">${esc(initial(l.person))}</div><div class="main"><span class="t">${esc(l.person)}</span><span class="s">${l.dir === 'lent' ? t('owedToMe') : t('loans')}${l.plan === 'inst' ? ' · ' + t('planInst') : ''}</span></div><span class="amt ${l.dir === 'lent' ? 'pos' : ''}">${moneyC(v, l.currency)}</span><button class="btn sm ${l.dir === 'lent' ? '' : 'pri'}" data-act="repay" data-id="${l.id}">${l.dir === 'lent' ? t('receive') : t('pay')}</button></div>`
        )
        .join('')}
      ${cards()
        .map(a => ({a, c: cardInfo(a)}))
        .filter(o => o.c.due > 0 && o.c.dueDate && o.c.dueDate.slice(0, 7) <= DM)
        .map(
          ({a, c}) =>
            `<div class="row"><div class="glyph">💳</div><div class="main"><span class="t">${esc(a.name)}</span><span class="s">${t('cardDue')} · ${esc(shortDate(c.dueDate))}</span></div>${c.dueDate < TODAY ? `<span class="pill neg">${t('overdue')}</span>` : ''}<span class="amt">${moneyC(c.due, a.currency)}</span><button class="btn sm pri" data-act="payCard" data-id="${a.id}">${t('pay')}</button></div>`
        )
        .join('')}
      ${
        !due.length &&
        !S.loans.some(l => loanOwedUpTo(l, DM) > 0) &&
        !cards().some(a => {
          const c = cardInfo(a);
          return c.due > 0 && c.dueDate && c.dueDate.slice(0, 7) <= DM;
        })
          ? `<div class="empty">${per.mode === 'month' ? t('nothingDue') : t('nothingDueP')}</div>`
          : ''
      }</div></details>
  ${alerts.length ? `<section class="sec"><div class="sec-h"><h2>${t('budgetAlerts')}</h2></div><div class="list">${alerts.map(b => `<div class="catbar"><div class="l"><span>${esc(catName(b.id))} <span class="pill ${b.p >= 1 ? 'neg' : 'warn'}">${b.p >= 1 ? t('over') : t('near')}</span></span><span>${money(b.sp)} / ${money(b.lim)}</span></div><div class="bar"><i class="${b.p >= 1 ? 'neg' : 'warn'}" style="width:${Math.min(100, b.p * 100)}%"></i></div></div>`).join('')}</div></section>` : ''}
  <div class="slip tile" data-act="goNW"><div class="net"><span class="label">${t('netWorth')} <small class="muted">${t('asOf')} ${esc(dmyOf(dsDate(PE)))}</small> ›</span><span class="mid ${nw < 0 ? 'neg' : ''}"><span class="why" data-act="why" data-w="nw">${money(nw)}</span> <small class="muted">${esc(curSym(BASE()))}</small></span></div></div>
  ${splitHTML()}${accountsHTML()}${catTotalsHTML('expense')}${catTotalsHTML('income')}${loansHTML()}${oblHTML()}${goalsHTML()}
  <section class="sec"><div class="sec-h"><h2>${t('recent')}</h2><button class="link" data-act="goTx">${t('seeAll')}</button></div>
    <div class="list">${recent.length ? recent.map(txRow).join('') : `<div class="empty">${t('noTx')}</div>`}</div></section>`;
  }
