/* Where each number comes from: the breakdown shown when a number is tapped. (part 1 of 3) */
  /* where a number comes from: the sum line by line, the entries behind it, and where to see them */
  function whyData(k) {
    if (k.startsWith('cst:')) {
      const [, id, C] = k.split(':'),
        a = accById(id);
      if (!a) return null;
      const s = cardCycles(a).find(x => x.C === C);
      if (!s) return null;
      return {
        title: a.name + ' · ' + t('statement'),
        sub:
          dmyOf(dsDate(iso(new Date(dOf(s.P).getTime() + 864e5)))) +
          ' → ' +
          dmyOf(dsDate(s.C)) +
          ' · ' +
          t('payDay') +
          ' ' +
          dmyOf(dsDate(s.due)),
        lines: [{l: t('total'), v: toBase(s.sum, a.currency), strong: 1, total: 1}],
        rows: s.list.map(x => ({
          d: x.date,
          l: x.note || (x.type === 'transfer' ? t('transfer') : catPath(x.cat)),
          v: -toBase(+x.amount || 0, a.currency),
          act: 'openTx',
          id: x.id
        })),
        go: {act: 'stmtAcc', id: a.id, l: t('statement')}
      };
    }
    const P = perCash(),
      [PA, PE] = perRange(),
      to = P.proj ? TODAY : PE,
      W = P.fut ? [] : S.tx.filter(x => x.date >= PA && x.date <= to),
      L = (l, v, o) => Object.assign({l, v}, o || {});
    const accLines = d =>
      S.accounts
        .filter(isLiquid)
        .map(a =>
          L(a.name, toBase(accBalanceAt(a, d), a.currency), {
            plain: 1,
            act: 'stmtAcc',
            id: a.id,
            s: a.currency !== BASE() ? fmt(accBalanceAt(a, d)) + ' ' + a.currency : ''
          })
        );
    const txRow = (x, v) => ({
      d: x.date,
      l:
        (x.note || (x.type === 'transfer' ? t('transfer') : catPath(x.cat))) +
        ' · ' +
        ((accById(x.acc) || {}).name || ''),
      v,
      act: 'openTx',
      id: x.id
    });
    const evRow = e => ({d: e.date, l: e.label, v: e.dir === 'in' ? e.amt : -e.amt, exp: 1});
    const liq = x => isLiquid(accById(x.acc)),
      fut = P.fut ? evsUpTo(PE, PA) : P.proj ? evsUpTo(PE) : [];
    const sub = (P.fut ? t('expWord') : perLabel()) + ' · ' + t('cashBanks');
    switch (k) {
      case 'availEnd':
        return {
          title: P.proj ? t('projEndS') : t('closeBal'),
          sub,
          lines: bridgeLines(),
          go: P.proj ? {act: 'cashSheet', l: t('willLast')} : {act: 'goAcc', l: t('accounts')}
        };
      case 'availNow':
        return {
          title: t('availNow'),
          sub: dmyOf(dsDate(TODAY)),
          lines: accLines(TODAY).concat([L(t('total'), liqAll(TODAY), {strong: 1, total: 1})]),
          go: {act: 'goAcc', l: t('accounts')}
        };
      case 'closing':
        return {
          title: t('closeBal'),
          sub: dmyOf(dsDate(PE)),
          lines: accLines(PE).concat([L(t('total'), liqAll(PE), {strong: 1, total: 1})]),
          go: {act: 'goAcc', l: t('accounts')}
        };
      case 'opening':
        if (P.fut) {
          const p0 = projFlows(dayBefore(PA));
          return {
            title: t('projStart'),
            sub: dmyOf(dsDate(dayBefore(PA))),
            lines: [
              L(t('availNow'), P.now, {strong: 1, w: 'availNow'}),
              L(t('expIn'), p0.i),
              L(t('expOut'), -p0.o),
              L(t('finTitle'), p0.f),
              L(t('xferNet'), p0.x),
              L(t('projStart'), P.o, {strong: 1, total: 1})
            ].filter(x => x.strong || Math.abs(x.v) >= 0.5),
            rows: evsUpTo(dayBefore(PA)).map(evRow),
            go: {act: 'cashSheet', l: t('willLast')}
          };
        }
        return {
          title: t('openBal'),
          sub: dmyOf(dsDate(dayBefore(PA))),
          lines: accLines(dayBefore(PA)).concat([L(t('total'), P.o, {strong: 1, total: 1})]),
          go: {act: 'goAcc', l: t('accounts')}
        };
      case 'cashIn':
      case 'cashOut': {
        const inn = k === 'cashIn',
          act = W.filter(x => liq(x) && (inn ? x.type === 'income' : x.type === 'expense'))
            .map(x => txRow(x, inn ? baseAmt(x) : -baseAmt(x)))
            .concat(
              W.filter(
                x =>
                  x.type === 'transfer' &&
                  (inn ? !liq(x) && isLiquid(accById(x.toAcc)) : liq(x) && !isLiquid(accById(x.toAcc)))
              ).map(x =>
                txRow(x, inn ? toBase(+(x.toAmount ?? x.amount), (accById(x.toAcc) || {}).currency) : -baseAmt(x))
              )
            );
        const ex = fut.filter(e => e.dir === (inn ? 'in' : 'out')).map(evRow),
          sg = inn ? 1 : -1;
        return {
          title: inn ? t('cashIn') : t('cashOut'),
          sub,
          lines: [
            L(inn ? t('plIn') : t('plOut'), sg * (inn ? P.ai + P.pi : P.ao + P.po), {plain: 1}),
            L(t('finTitle'), sg * (inn ? P.fIn : P.fOut), {plain: 1, w: 'finCash'}),
            L(t('xferShort'), sg * (inn ? P.xIn : P.xOut), {plain: 1, w: 'xferCash'}),
            L(t('total'), sg * (inn ? P.gi : P.go), {strong: 1, total: 1})
          ].filter(x => x.strong || Math.abs(x.v) >= 0.5),
          rows: act.concat(ex).sort((a, b) => (a.d || '').localeCompare(b.d || '')),
          note: t('cashVsPL')
        };
      }
      case 'finCash': {
        const act = W.filter(x => liq(x) && isFin(x)).map(x =>
            txRow(x, x.type === 'income' ? baseAmt(x) : -baseAmt(x))
          ),
          ex = fut.filter(e => e.fin).map(evRow);
        return {
          title: t('finTitle'),
          sub,
          lines: [
            L(t('actWord'), P.f0 || 0),
            L(t('expWord'), (P.fz || 0) - (P.f0 || 0)),
            L(t('total'), P.fz || 0, {strong: 1, total: 1})
          ].filter(x => x.strong || Math.abs(x.v) >= 0.5),
          rows: act.concat(ex),
          go: {act: 'stmtFin', l: t('statement')}
        };
      }
      case 'moves': {
        const ls = bridgeLines().filter(x => !x.strong);
        return {title: t('movesNet'), sub, lines: ls.concat([L(t('movesNet'), P.c - P.o, {strong: 1, total: 1})])};
      }
      case 'xferAct': {
        const r = W.filter(
          x =>
            x.type === 'transfer' && liq(x) !== isLiquid(accById(x.toAcc)) && (accById(x.toAcc) || {}).type !== 'card'
        ).map(x =>
          txRow(x, liq(x) ? -baseAmt(x) : toBase(+(x.toAmount ?? x.amount), (accById(x.toAcc) || {}).currency))
        );
        return {title: t('xferNet'), sub, lines: [L(t('total'), P.xf0, {strong: 1, total: 1})], rows: r};
      }
      case 'xferCash': {
        const act = W.filter(
            x =>
              x.type === 'transfer' && liq(x) !== isLiquid(accById(x.toAcc)) && (accById(x.toAcc) || {}).type !== 'card'
          ).map(x =>
            txRow(x, liq(x) ? -baseAmt(x) : toBase(+(x.toAmount ?? x.amount), (accById(x.toAcc) || {}).currency))
          ),
          ex = fut.filter(e => e.kind === 'xfer').map(evRow);
        return {title: t('xferNet'), sub, lines: [L(t('total'), P.xf, {strong: 1, total: 1})], rows: act.concat(ex)};
      }
      case 'cardPays': {
        const r = W.filter(x => x.type === 'transfer' && liq(x) && (accById(x.toAcc) || {}).type === 'card').map(x =>
          txRow(x, -baseAmt(x))
        );
        return {
          title: t('cardPayNote'),
          sub,
          lines: [
            L(
              t('total'),
              r.reduce((v, x) => v + x.v, 0),
              {strong: 1, total: 1}
            )
          ],
          rows: r,
          go: {act: 'goCards', l: t('cardsT')}
        };
      }
      case 'rest': {
        const ev = fut.filter(e => e.date > TODAY || e.date === TODAY);
        return {
          title: t('restExpected'),
          sub: dmyOf(dsDate(TODAY)) + ' → ' + dmyOf(dsDate(PE)),
          lines: [
            L(t('expIn'), P.pi),
            L(t('expOut'), -P.po),
            L(t('finTitle'), (P.fz || 0) - (P.f0 || 0)),
            L(t('xferNet'), P.xf - (P.xf0 || 0)),
            L(t('total'), P.c - P.now, {strong: 1, total: 1})
          ].filter(x => x.strong || Math.abs(x.v) >= 0.5),
          rows: ev.map(evRow),
          go: {act: 'cashSheet', l: t('willLast')}
        };
      }
      case 'safe': {
        const x = safeToSpend(),
          ev = remainingPlan(TODAY_YM).filter(
            e => e.dir === 'out' && ['inst', 'gam', 'loan', 'card', 'adj', 'tx', 'xfer', 'rec'].includes(e.kind)
          );
        return {
          title: t('safeTitle'),
          sub: dmyOf(dsDate(TODAY)) + ' → ' + dmyOf(dsDate(monthEnd(TODAY_YM))),
          lines: [
            L(t('availNow'), x.liquid, {strong: 1, w: 'availNow'}),
            L(t('safeObl'), -x.obl),
            L(t('safeRec'), -x.recOut),
            L(t('goals'), -x.goals, {act: 'goGoals'}),
            L(t('safeTitle'), x.safe, {strong: 1, total: 1}),
            L(t('goalsKeep'), x.goals),
            L(t('budStill'), -x.bud),
            L(t('otherOut'), -x.other),
            L(t('inToEnd'), x.recIn),
            L(t('safeToEnd'), x.end, {strong: 1, total: 1})
          ].filter(y => y.strong || Math.abs(y.v) >= 0.5),
          rows: ev.map(evRow),
          note: t('safeWhyNote'),
          go: {act: 'safe', l: t('details')}
        };
      }
      case 'cardsOwe': {
        const r = cards()
          .map(a => {
            const c = cardInfo(a, PE);
            return L(a.name, -toBase(c.owed, a.currency), {
              plain: 1,
              act: 'stmtAcc',
              id: a.id,
              s: c.due ? t('cardDue') + ' ' + fmt(c.due) + ' · ' + esc(shortDate(c.dueDate)) : ''
            });
          })
          .filter(x => Math.abs(x.v) >= 0.5);
        return {
          title: t('cardsOwe'),
          sub: dmyOf(dsDate(PE)),
          lines: r.concat([
            L(
              t('total'),
              r.reduce((v, x) => v + x.v, 0),
              {strong: 1, total: 1}
            )
          ]),
          go: {act: 'goCards', l: t('cardsT')}
        };
      }
      case 'nw': {
        const n = netWorth(PE);
        return {
          title: t('netWorth'),
          sub: dmyOf(dsDate(PE)),
          lines: [
            L(t('nwAssets'), n.assets, {w: 'nwAcc'}),
            L(t('nwNeg'), n.neg, {w: 'nwAcc'}),
            L(t('owedToMe'), n.recv, {act: 'goLoans'}),
            L(t('iOwe'), -n.pay, {act: 'goLoans'}),
            L(t('nwObl'), -n.obl, {
              act: 'goInst',
              s: t('nwOblSplit')
                .replace('%d', fmt(Math.round(n.oblDue)))
                .replace('%l', fmt(Math.round(n.oblLater)))
            }),
            L(t('nwGam'), n.gam, {act: 'goGam'}),
            L(t('netWorth'), n.net, {strong: 1, total: 1})
          ].filter(x => x.strong || Math.abs(x.v) >= 0.5),
          note: t('nwHint')
        };
      }
      case 'nwAcc':
