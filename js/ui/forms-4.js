/* Entry forms: transactions, loans, transfers and settings. (part 4 of 5; continues from forms-3.js) */
  function loanForm(l) {
    const isNew = !l;
    l = l || {dir: 'lent', person: '', amount: '', currency: BASE(), date: TODAY, note: '', pays: []};
    let dir = l.dir;
    openSheet(
      isNew ? t('addLoan') : l.person,
      `<form class="form" id="f">
    ${segHTML(
      'dr',
      [
        ['lent', t('lent')],
        ['borrowed', t('borrowed')]
      ],
      dir
    )}
    <div class="two"><label class="fld"><span>${t('person')}</span><input class="in-f" id="pr" list="dl-lp" value="${esc(l.person)}">${datalist(
      'dl-lp',
      S.loans.map(x => x.person)
    )}</label>
    <label class="fld"><span>${t('group')}</span><input class="in-f" id="gp" list="dl-lg" value="${esc(l.group || '')}" placeholder="${t('groupHint')}">${datalist(
      'dl-lg',
      S.loans.map(x => x.group)
    )}</label></div>
    <div class="two"><label class="fld"><span>${t('amount')}</span><input class="in-f amt num" id="amt" inputmode="decimal" value="${l.amount}"></label>
    <label class="fld"><span>${t('currency')}</span><select class="in-f" id="lc">${curOpts(l.currency || BASE())}</select></label></div>
    <div class="two"><label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${l.date}"></label>
    <label class="fld" id="ldW" ${l.plan === 'inst' ? 'hidden' : ''}><span>${t('loanDue')}</span><input class="in-f" type="month" id="ld" value="${l.due || ''}"></label></div>
    <label class="fld"><span id="laL">${dir === 'borrowed' ? t('loanIntoAcc') : t('loanFromAcc')}</span><select class="in-f" id="la"></select></label>
    ${
      isNew
        ? ''
        : (() => {
            const ox = S.tx.find(x => x.link && x.link.k === 'loanorig' && x.link.id === l.id),
              want = loanOrigAmt(l);
            return (
              (ox && Math.abs(+ox.amount - want) > 0.5
                ? `<div class="banner" style="background:var(--warn-soft)"><span>⚠️ ${t('loanMismatch')
                    .replace('%t', fmt(+ox.amount))
                    .replaceAll('%l', fmt(want))
                    .replace('%d', fmt(Math.abs(+ox.amount - want)))}</span></div>`
                : '') + `<p class="hint" style="margin:-4px 0 0">${t('loanSyncHint')}</p>`
            );
          })()
    }
    <div class="fld"><span>${t('loanPlan')}</span>${segHTML(
      'lp',
      [
        ['once', t('planOnce')],
        ['inst', t('planInst')]
      ],
      l.plan || 'once'
    )}</div>
    ${!isNew ? `<div class="row" style="padding:0 2px"><div class="main"><span class="s">${t('loanPaidSoFar')} ${moneyC(loanPaid(l), l.currency)} · ${t('remaining')} ${moneyC(loanLeft(l), l.currency)}</span></div><button type="button" class="btn sm" id="topup">+ ${l.dir === 'borrowed' ? t('loanMoreB') : t('loanMoreL')}</button></div>` : ''}
    ${(l.adds || []).length ? `<div class="list">${l.adds.map(z => `<div class="row"><div class="main"><span class="t">+ ${moneyC(z.amount, l.currency)}</span><span class="s">${t('loanAdded')} · ${esc(dayLbl(z.date))}</span></div></div>`).join('')}</div>` : ''}
    <div id="liW" ${l.plan === 'inst' ? '' : 'hidden'}><div class="two"><label class="fld"><span>${t('monthly')}</span><input class="in-f amt num" id="lia" inputmode="decimal" value="${l.instAmt || ''}"></label>
    <label class="fld"><span>${t('instMonths')}</span><input class="in-f num" id="lic" inputmode="numeric" value=""></label></div>
    <label class="fld"><span>${t('instFrom')}</span><input class="in-f" type="month" id="lis" value="${l.instStart || ymAdd(TODAY_YM, 1)}"></label></div>
    <p class="hint" id="liH" ${l.plan === 'inst' ? '' : 'hidden'}></p>
    <label class="fld"><span>${t('note')}</span><input class="in-f" id="nt" value="${esc(l.note)}"></label>
    ${!isNew && l.pays.length ? `<div class="list">${l.pays.map(p => `<div class="row"><div class="main"><span class="t">${moneyC(p.amount, l.currency)}</span><span class="s">${esc(dayLbl(p.date))}</span></div><button type="button" class="btn sm danger" data-pay="${p.id}">${t('del')}</button></div>`).join('')}</div>` : ''}
    <div class="foot">${isNew ? '' : `<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div>
  </form>`,
      r => {
        const OX = isNew ? null : S.tx.find(x => x.link && x.link.k === 'loanorig' && x.link.id === l.id);
        let first = true;
        const fillAcc = () => {
          const sel = r.querySelector('#la');
          if (!sel) return;
          const cc = val(r, 'lc') || BASE(),
            prev = first ? (isNew ? '' : OX ? OX.acc : '') : sel.value,
            accs = S.accounts.filter(a => a.currency === cc && isLiquid(a)),
            def =
              first && !isNew
                ? prev
                : prev && accs.some(a => a.id === prev)
                  ? prev
                  : payAcc(cc) || (accs[0] || {}).id || '';
          first = false;
          sel.innerHTML =
            accs
              .map(
                a =>
                  `<option value="${a.id}" ${a.id === def ? 'selected' : ''}>${esc(a.name)} · ${a.currency} · ${fmt(accBalance(a))}</option>`
              )
              .join('') + `<option value="" ${accs.length ? '' : 'selected'}>${t('loanNoAcc')}</option>`;
          r.querySelector('#laL').textContent = dir === 'borrowed' ? t('loanIntoAcc') : t('loanFromAcc');
        };
        bindSeg(r, 'dr', v => {
          dir = v;
          fillAcc();
        });
        let plan = l.plan || 'once';
        fillAcc();
        r.querySelector('#lc').addEventListener('change', fillAcc);
        /* installments spread what is still left: total (with moves and drops) minus what was paid */
        const leftOf = () =>
          Math.max(0, Math.round((numv(r, 'amt') + (isNew ? 0 : loanAdj(l)) - (isNew ? 0 : loanPaid(l))) * 100) / 100);
        /* unchanged plan: show the months still open on the current schedule; changed plan: the new spread of what is left */
        const sameAsNow = () =>
          !isNew &&
          (l.plan || 'once') === 'inst' &&
          numv(r, 'amt') === +l.amount &&
          numv(r, 'lia') === +l.instAmt &&
          val(r, 'lis') === l.instStart;
        const openMonths = () => {
          let paid = loanPaid(l);
          return loanSched(l).filter(x => {
            const take = Math.min(paid, x.amount);
            paid -= take;
            return x.amount - take > 0.004;
          });
        };
        const liHint = () => {
          const a = leftOf(),
            q = numv(r, 'lia');
          let n = q > 0 ? Math.ceil(a / q - 1e-9) : 0,
            last = ymAdd(val(r, 'lis') || TODAY_YM, n - 1),
            lastV = Math.round((a - q * (n - 1)) * 100) / 100;
          if (sameAsNow()) {
            const om = openMonths();
            n = om.length;
            if (n) {
              last = om[n - 1].m;
              lastV = om[n - 1].amount;
            }
          }
          if (document.activeElement !== r.querySelector('#lic')) r.querySelector('#lic').value = n || '';
          r.querySelector('#liH').textContent =
            a > 0 && q > 0 && n > 0
              ? (isNew ? '' : t('instOfLeft').replace('%v', fmt(a)) + ' ') +
                t('instCount').replace('%n', n).replace('%m', monthLbl(last)) +
                (lastV < q - 0.004 ? ' · ' + t('lastInst') + ' ' + fmt(lastV) : '')
              : '';
        };
        bindSeg(r, 'lp', v => {
          plan = v;
          r.querySelector('#liW').hidden = v !== 'inst';
          r.querySelector('#liH').hidden = v !== 'inst';
          r.querySelector('#ldW').hidden = v === 'inst';
          liHint();
        });
        ['amt', 'lia', 'lis'].forEach(id => r.querySelector('#' + id).addEventListener('input', liHint));
        r.querySelector('#lic').addEventListener('input', () => {
          const n = Math.round(numv(r, 'lic'));
          if (n > 0) {
            r.querySelector('#lia').value = Math.ceil((leftOf() / n) * 100) / 100;
            liHint();
          }
        });
        liHint();
        if (!isNew) r.querySelector('#topup').onclick = () => loanTopUp(l.id);
        r.querySelectorAll('[data-pay]').forEach(
          b =>
            (b.onclick = () => {
              const o = S.loans.find(x => x.id === l.id);
              o.pays = o.pays.filter(p => p.id !== b.dataset.pay);
              S.tx = S.tx.filter(x => !(x.link && x.link.k === 'loan' && x.link.pay === b.dataset.pay));
              save();
              render();
              loanForm(o);
            })
        );
        if (!isNew)
          r.querySelector('#del').onclick = () =>
            confirmSheet(
              S.tx.some(x => x.link && x.link.k === 'loanorig' && x.link.id === l.id)
                ? t('loanDelOrig')
                : t('confirmDel'),
              t('del'),
              () => {
                S.loans = S.loans.filter(x => x.id !== l.id);
                S.tx = S.tx.filter(x => !(x.link && x.link.k === 'loanorig' && x.link.id === l.id));
                commit(t('deleted'));
              }
            );
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const pr = val(r, 'pr'),
            a = numv(r, 'amt');
          if (!pr) {
            toast(t('needName'));
            return;
          }
          if (a <= 0) {
            toast(t('needAmt'));
            return;
          }
          const o = {
            dir,
            person: pr,
            group: val(r, 'gp'),
            amount: a,
            currency: val(r, 'lc'),
            date: val(r, 'dt') || TODAY,
            due: plan === 'once' ? val(r, 'ld') || '' : '',
            plan,
            instAmt: plan === 'inst' ? numv(r, 'lia') : 0,
            instStart: plan === 'inst' ? val(r, 'lis') || ymAdd(TODAY_YM, 1) : '',
            note: val(r, 'nt')
          };
          if (plan === 'inst' && !(o.instAmt > 0)) {
            toast(t('needAmt'));
            return;
          }
          if (isNew) {
            const nl = Object.assign({id: uid(), pays: []}, o);
            S.loans.push(nl);
            const acc = val(r, 'la');
            if (acc)
              S.tx.push({
                id: uid(),
                acc,
                type: dir === 'borrowed' ? 'income' : 'expense',
                cat: dir === 'borrowed' ? 'loanrecv' : 'loangive',
                amount: a,
                date: o.date,
                note:
                  (dir === 'borrowed' ? t('borrowedFrom') : t('lentTo')) + ' · ' + pr + (o.note ? ' · ' + o.note : ''),
                link: {k: 'loanorig', id: nl.id}
              });
          } else {
            const L = S.loans.find(x => x.id === l.id);
            /* keep the money entry in step with the loan: same direction, account, date and person, amount moved by the change made here */
            {
              const acc = val(r, 'la'),
                ox = S.tx.find(x => x.link && x.link.k === 'loanorig' && x.link.id === L.id),
                note =
                  (dir === 'borrowed' ? t('borrowedFrom') : t('lentTo')) + ' · ' + pr + (o.note ? ' · ' + o.note : '');
              const fields = {
                acc,
                type: dir === 'borrowed' ? 'income' : 'expense',
                cat: dir === 'borrowed' ? 'loanrecv' : 'loangive',
                date: o.date,
                note
              };
              if (ox && !acc) {
                logTx('del', ox, null);
                S.tx = S.tx.filter(x => x !== ox);
              } else if (ox) {
                const before = Object.assign({}, ox),
                  amt = loanOrigAmt(L, a);
                if (amt <= 0.004) {
                  toast(t('needAmt'));
                  return;
                }
                Object.assign(ox, fields, {amount: amt});
                logTx('edit', before, ox);
              } else if (acc) {
                const amt = loanOrigAmt(L, a);
                if (amt <= 0.004) {
                  toast(t('needAmt'));
                  return;
                }
                const nx = Object.assign({id: uid(), amount: amt, link: {k: 'loanorig', id: L.id}}, fields);
                S.tx.push(nx);
                logTx('add', null, nx);
              }
            }
            /* a new plan applies to what is left now: moves and drops are folded into the amount and what was already paid stays as paid */
            const replan =
              o.plan !== (L.plan || 'once') ||
              +o.amount !== +L.amount ||
              (o.plan === 'inst' && (+o.instAmt !== +L.instAmt || o.instStart !== L.instStart)) ||
              (o.plan === 'once' && o.due !== (L.due || ''));
            if (replan) {
              o.folded = Math.round(((+L.folded || 0) + loanAdj(L)) * 100) / 100;
              o.amount = Math.round((o.amount + loanAdj(L)) * 100) / 100;
              o.adj = [];
              o.instBase = o.plan === 'inst' ? Math.min(loanPaid(L), o.amount) : 0;
            }
            Object.assign(L, o);
          }
          closeSheet();
          commit(t('saved'));
        };
      }
    );
  }
