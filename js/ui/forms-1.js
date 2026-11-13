/* Entry forms: transactions, loans, transfers and settings. (part 1 of 5) */
  /* ---------- forms ---------- */
  function txForm(tx, repeat, pre) {
    const isNew = !tx;
    tx =
      tx ||
      Object.assign(
        {
          type: 'expense',
          cat: 'food',
          acc: S.defAcc,
          amount: '',
          date: cur === TODAY_YM ? TODAY : cur + '-01',
          note: '',
          repeat: repeat || ''
        },
        pre || {}
      );
    let type = tx.type;
    const catOpts = (ty, sel) => catOptsTree(ty, sel || tx.cat, isNew) + quickCatOpt();
    const toDef = tx.toAcc || (S.accounts.find(a => a.id !== tx.acc) || S.accounts[0]).id;
    openSheet(
      isNew ? t('addTx') : t('editTx'),
      `<form class="form" id="f">
    ${segHTML(
      'ty',
      [
        ['expense', t('exp1')],
        ['income', t('inc1')],
        ['transfer', t('transfer')]
      ],
      type
    )}
    <label class="fld"><span id="accL">${type === 'transfer' ? t('fromAcc') : t('account')}</span><select class="in-f" id="acc">${accOpts(tx.acc)}</select></label>
    <label class="fld" id="toW" ${type === 'transfer' ? '' : 'hidden'}><span>${t('toAcc')}</span><select class="in-f" id="to">${accOpts(toDef)}</select></label>
    <label class="fld"><span>${t('amount')} (<b id="amtC"></b>)</span><input class="in-f amt num" id="amt" inputmode="decimal" autocomplete="off" value="${tx.amount}" placeholder="0"></label>
    <label class="fld" id="xrW" hidden><span>${t('rateOfDay')} (<b id="xrC"></b>)</span><input class="in-f num" id="xr" inputmode="decimal" autocomplete="off" value="${tx.rate || ''}" placeholder=""></label>
    <label class="fld" id="toAmtW" hidden><span>${t('recvAmt')} (<b id="toC"></b>)</span><input class="in-f amt num" id="toAmt" inputmode="decimal" autocomplete="off" value="${tx.toAmount ?? ''}" placeholder="0"></label>
    <label class="fld" id="catW" ${type === 'transfer' ? 'hidden' : ''}><span>${t('category')}</span><select class="in-f" id="cat">${type === 'transfer' ? '' : catOpts(type)}</select></label>
    ${quickCatHTML()}
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${tx.date}"></label>
    <label class="fld"><span>${t('note')}</span><input class="in-f" id="nt" value="${esc(tx.note)}" autocomplete="off"></label>
    ${
      ACT !== 'me' && ledgerMembers().length > 1
        ? `<div class="two" id="spW"><label class="fld"><span>${t('paidByL')}</span><select class="in-f" id="pb">${ledgerMembers()
            .map(
              m =>
                `<option value="${esc(m)}" ${(tx.paidBy || tx.by || myEmail()) === m ? 'selected' : ''}>${esc(shortName(m))}</option>`
            )
            .join('')}</select></label>
      <label class="fld"><span>${t('splitL')}</span><select class="in-f" id="spl"><option value="">${t('splitAll')}</option><option value="self" ${tx.split === 'self' ? 'selected' : ''}>${t('splitSelf')}</option></select></label></div>`
        : ''
    }
    <label class="fld"><span>${t('tags')}</span><input class="in-f" id="tg" list="dl-tags" value="${esc((tx.tags || []).join('، '))}" placeholder="${t('tagsHint')}" autocomplete="off">${datalist('dl-tags', allTags())}</label>
    <label class="fld"><span>${t('receipt')}</span><input class="in-f" type="file" accept="image/*" id="rf"></label>
    ${isNew ? `<label class="chk"><input type="checkbox" id="qk"> ${t('saveQuick')}</label>` : ''}
    ${tx.rcpt ? `<button type="button" class="btn block" data-sact="rcpt" data-id="${tx.id}">🧾 ${t('showReceipt')}</button>` : ''}
    ${
      tx.rec && S.recur.some(v => v.id === tx.rec)
        ? `<button type="button" class="btn block" data-sact="rec" data-id="${tx.rec}">↻ ${t('recurring')}: ${freqName(S.recur.find(v => v.id === tx.rec).freq)}</button>`
        : freqFields(tx.repeat || '', true, '', '')
    }
    <div class="foot">${isNew ? '' : `<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div>
  </form>`,
      r => {
        const $r = q => r.querySelector(q);
        let toTouched = !isNew && tx.toAmount != null;
        {
          const bf = bindFreq(r, () => $r('#dt').value);
          if (bf) $r('#dt').addEventListener('change', bf);
        }
        const sync = () => {
          const fa = accOf($r('#acc').value),
            ta = accOf($r('#to').value),
            diff = type === 'transfer' && fa.currency !== ta.currency;
          $r('#amtC').textContent = curName(fa.currency);
          $r('#toC').textContent = curName(ta.currency);
          $r('#toAmtW').hidden = !diff;
          const fx = type !== 'transfer' && fa.currency !== BASE();
          $r('#xrW').hidden = !fx;
          if (fx) {
            $r('#xrC').textContent = '1 ' + fa.currency + ' = ? ' + BASE();
            $r('#xr').placeholder = String(rateAt(fa.currency, $r('#dt').value || TODAY) || '');
          }
          if (diff && !toTouched) {
            const a = parseFloat($r('#amt').value) || 0,
              ra = rateOf(fa.currency),
              rb = rateOf(ta.currency);
            $r('#toAmt').value = a && ra && rb ? Math.round(((a * ra) / rb) * 100) / 100 : '';
          }
        };
        const ncClose = quickCatBind(r, () => type, catOpts);
        bindSeg(r, 'ty', v => {
          type = v;
          $r('#toW').hidden = v !== 'transfer';
          $r('#catW').hidden = v === 'transfer';
          ncClose();
          $r('#accL').textContent = v === 'transfer' ? t('fromAcc') : t('account');
          if (v !== 'transfer') $r('#cat').innerHTML = catOpts(v);
          sync();
        });
        $r('#acc').onchange = sync;
        $r('#to').onchange = sync;
        $r('#amt').oninput = sync;
        $r('#toAmt').oninput = () => {
          toTouched = true;
        };
        sync();
        if (isNew) setTimeout(() => $r('#amt').focus(), 50);
        if (!isNew)
          $r('#del').onclick = () => {
            const go = () => {
              delTx(tx.id);
              commit(t('deleted'));
            };
            if (S.closed && S.closed[tx.date.slice(0, 7)]) closedEdit([tx.date.slice(0, 7)], go, true);
            else confirmSheet(t('confirmDel'), t('del'), go);
          };
        $r('#f').onsubmit = e => {
          e.preventDefault();
          const a = numv(r, 'amt');
          if (a <= 0) {
            toast(t('needAmt'));
            return;
          }
          /* "＋ new category" chosen but not added yet */
          if (type !== 'transfer' && $r('#cat').value === '__new') {
            toast(t('needName'));
            $r('#ncN').focus();
            return;
          }
          let o = {
            type,
            acc: val(r, 'acc'),
            amount: a,
            date: val(r, 'dt') || TODAY,
            note: val(r, 'nt'),
            tags: parseTags(val(r, 'tg'))
          };
          if (!o.tags.length) delete o.tags;
          if ($r('#pb')) {
            o.paidBy = $r('#pb').value;
            o.split = $r('#spl').value || undefined;
          }
          if (type === 'transfer') {
            const to = val(r, 'to');
            if (to === o.acc) {
              toast(t('sameAcc'));
              return;
            }
            const diff = accOf(o.acc).currency !== accOf(to).currency,
              ta = diff ? numv(r, 'toAmt') : a;
            if (diff && ta <= 0) {
              toast(t('needAmt'));
              return;
            }
            Object.assign(o, {toAcc: to, toAmount: ta, cat: 'transfer'});
          } else Object.assign(o, {cat: val(r, 'cat'), toAcc: undefined, toAmount: undefined});
          {
            const fc = accOf(o.acc).currency;
            if (type !== 'transfer' && fc !== BASE()) {
              const xr = numv(r, 'xr') || rateAt(fc, o.date);
              if (xr > 0) o.rate = Math.round(xr * 10000) / 10000;
            }
          }
          const rp = readFreq(r),
            qk = !!($r('#qk') && $r('#qk').checked),
            rf = $r('#rf').files[0];
          /* a closed month: say so, and if you go ahead it opens again and asks to be closed with the difference */
          const months = [...new Set([o.date.slice(0, 7)].concat(isNew ? [] : [tx.date.slice(0, 7)]))].filter(
            m => S.closed && S.closed[m]
          );
          const doSave = () => {
            let saved;
            const prev = isNew
              ? null
              : Object.assign(
                  {},
                  S.tx.find(x => x.id === tx.id)
                );
            if (isNew) {
              saved = Object.assign({id: uid()}, o);
              S.tx.push(saved);
            } else {
              saved = S.tx.find(x => x.id === tx.id);
              const lk = saved.link,
                changed = lk && (+saved.amount !== +o.amount || saved.date !== o.date || saved.type !== o.type);
              Object.assign(saved, o);
              if (!o.tags) delete saved.tags;
              if (type !== 'transfer') {
                delete saved.toAcc;
                delete saved.toAmount;
              }
              if (lk && lk.k === 'loanorig' && prev && type !== 'transfer') {
                const L = S.loans.find(x => x.id === lk.id);
                if (L) {
                  L.amount = Math.round((+o.amount + sum(L.adds || []) + (+L.folded || 0)) * 100) / 100;
                  L.date = o.date;
                  L.dir = o.type === 'income' ? 'borrowed' : 'lent';
                }
              }
              if (changed) relink(saved, lk);
            }
            if (isNew && qk) {
              const q = Object.assign({}, saved);
              delete q.id;
              delete q.date;
              delete q.rec;
              delete q.rcpt;
              delete q.link;
              S.quick.push(Object.assign({id: 'q' + uid()}, q));
            }
            if (rp && !saved.rec) {
              const rid = 'r' + uid(),
                tpl = Object.assign({}, saved);
              delete tpl.id;
              delete tpl.date;
              delete tpl.rec;
              delete tpl.link;
              const nr = {id: rid, freq: rp, day: +saved.date.slice(8, 10), next: advance(saved.date, rp), tpl},
                lv = $r('#rl') ? $r('#rl').value : '',
                en = $r('#ren') ? $r('#ren').value : '';
              if (lv !== '') nr.lead = +lv;
              if (en) nr.end = en;
              S.recur.push(nr);
              saved.rec = rid;
            }

            logTx(isNew ? 'add' : 'edit', prev, saved);
            S.defAcc = o.acc;
            closeSheet();
            commit(t('saved'));
            if (rp) runRecurring();
            if (rf) uploadReceipt(saved, rf);
          };
          if (months.length) closedEdit(months, doSave);
          else doSave();
        };
      }
    );
  }
