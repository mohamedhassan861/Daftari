/* Entry forms: transactions, loans, transfers and settings. (part 5 of 5; continues from forms-4.js) */
  function loanTopUp(id) {
    const l = S.loans.find(x => x.id === id);
    if (!l) return;
    const cc = l.currency || BASE(),
      accs = S.accounts.filter(a => a.currency === cc && a.type !== 'card');
    openSheet(
      (l.dir === 'borrowed' ? t('loanMoreB') : t('loanMoreL')) + ' · ' + l.person,
      `<form class="form" id="f">
    <div class="two"><label class="fld"><span>${t('amount')}</span><input class="in-f amt num" id="amt" inputmode="decimal"></label>
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${TODAY}"></label></div>
    <label class="fld"><span>${l.dir === 'borrowed' ? t('loanIntoAcc') : t('loanFromAcc')}</span><select class="in-f" id="ac">${accs.map(a => `<option value="${a.id}" ${a.id === payAcc(cc) ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}<option value="">${t('loanNoAcc')}</option></select></label>
    <p class="hint">${t('loanMoreHint')}</p>
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,
      r => {
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const a = numv(r, 'amt');
          if (!(a > 0)) {
            toast(t('needAmt'));
            return;
          }
          const L = S.loans.find(x => x.id === id),
            date = val(r, 'dt') || TODAY,
            acc = val(r, 'ac');
          if (acc) {
            const tx = {
              id: uid(),
              acc,
              type: L.dir === 'borrowed' ? 'income' : 'expense',
              cat: L.dir === 'borrowed' ? 'loanrecv' : 'loangive',
              amount: a,
              date,
              note: (L.dir === 'borrowed' ? t('loanMoreB') : t('loanMoreL')) + ' · ' + L.person
            };
            S.tx.push(tx);
            relink(tx, {k: 'loanadd', id: L.id});
          } else {
            L.adds = (L.adds || []).concat({id: uid(), amount: a, date});
            L.amount = Math.round((+L.amount + a) * 100) / 100;
          }
          save();
          render();
          toast(t('loanMoreDone'));
          loanForm(L);
        };
      }
    );
  }
  function repayForm(l) {
    openSheet(
      t('repay') + ' · ' + l.person,
      `<form class="form" id="f">
    <label class="fld"><span>${t('amount')} (${t('remaining')}: ${fmt(loanLeft(l))} ${esc(curSym(l.currency || BASE()))})</span><input class="in-f amt num" id="amt" inputmode="decimal" value="${l.plan === 'inst' ? Math.min(loanLeft(l), loanOwedUpTo(l, TODAY_YM) || +l.instAmt || loanLeft(l)) : loanLeft(l)}"></label>
    <div class="two"><label class="fld"><span>${l.dir === 'borrowed' ? t('fromAcc') : t('toAcc')}</span><select class="in-f" id="ra"><option value="">${t('noAccount')}</option>${S.accounts
      .filter(a => a.currency === (l.currency || BASE()))
      .map(
        a =>
          `<option value="${a.id}" ${a.id === payAcc(l.currency || BASE()) ? 'selected' : ''}>${esc(a.name)}</option>`
      )
      .join('')}</select></label>
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${TODAY}"></label></div>
    ${remBlock(TODAY_YM, true)}
    <p class="hint">${t('repayHint')}</p>
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,
      r => {
        const dueNow =
            l.plan === 'inst'
              ? Math.min(loanLeft(l), loanOwedUpTo(l, TODAY_YM) || +l.instAmt || loanLeft(l))
              : loanLeft(l),
          getRem = bindRem(r, dueNow);
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const a = numv(r, 'amt');
          if (a <= 0) {
            toast(t('needAmt'));
            return;
          }
          const rr = getRem(),
            L = S.loans.find(x => x.id === l.id);
          if (rr && rr.act !== 'keep') {
            L.adj = L.adj || [];
            L.adj.push({m: TODAY_YM, amount: -rr.rem});
            if (rr.act !== 'drop') L.adj.push({m: rr.act, amount: rr.rem});
          }
          const pid = uid(),
            date = val(r, 'dt') || TODAY,
            acc = val(r, 'ra');
          S.loans.find(x => x.id === l.id).pays.push({id: pid, amount: a, date});
          if (acc)
            S.tx.push({
              id: uid(),
              type: l.dir === 'borrowed' ? 'expense' : 'income',
              acc,
              cat: l.dir === 'borrowed' ? 'loanpay' : 'loanback',
              amount: a,
              date,
              note: t('repay') + ' · ' + l.person,
              link: {k: 'loan', id: l.id, pay: pid}
            });
          closeSheet();
          commit(t('saved'));
        };
      }
    );
  }
  function budgetForm() {
    openSheet(
      t('editBudget'),
      `<form class="form" id="f">${S.cats.expense
        .filter(c => !c.sys)
        .map(
          c =>
            `<label class="fld ${c.parent ? 'sub' : ''}"><span>${esc(c.parent ? catPath(c.id) : cName(c))}</span><input class="in-f num" inputmode="decimal" data-b="${c.id}" value="${S.budgets[c.id] || ''}" placeholder="${t('noBudget')}"></label>`
        )
        .join('')}
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,
      r => {
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const b = {};
          r.querySelectorAll('[data-b]').forEach(i => {
            const v = parseFloat(i.value);
            if (v > 0) b[i.dataset.b] = v;
          });
          S.budgets = b;
          closeSheet();
          commit(t('saved'));
        };
      }
    );
  }
