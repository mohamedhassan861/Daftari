/* Entry forms: transactions, loans, transfers and settings. (part 2 of 5; continues from forms-1.js) */
  function accForm(acc, preset) {
    const isNew = !acc;
    acc = acc || Object.assign({type: 'bank', name: '', currency: BASE(), opening: ''}, preset || {});
    let type = acc.type;
    const tn = {
      cash: t('aCash'),
      bank: t('aBank'),
      wallet: t('aWallet'),
      card: t('aCard'),
      gold: t('aGold'),
      cert: t('aCert')
    };
    openSheet(
      isNew ? t('addAcc') : acc.name + ' · ' + acc.currency,
      `<form class="form" id="f">
    <div style="display:contents" class="atw">${segHTML(
      'at',
      ACC_TYPES.map(k => [k, tn[k]]),
      type
    )}</div>
    <label class="fld"><span>${t('group')}</span><input class="in-f" id="gp" list="dl-ag" value="${esc(acc.group || '')}" placeholder="${esc(accGroup(Object.assign({}, acc, {group: ''})))}">${datalist('dl-ag', S.accounts.map(accGroup))}</label>
    <label class="fld"><span>${t('accName')}</span><input class="in-f" id="nm" value="${esc(acc.name)}" placeholder="${t('accNameHint')}"></label>${altFld(acc)}
    <label class="fld"><span id="ccL">${type === 'gold' ? t('karat') : t('currency')}</span><select class="in-f" id="cc">${curOpts(type === 'gold' && !isGold(acc.currency) ? 'G21' : acc.currency, type === 'gold')}</select></label>
    <label class="fld"><span id="opL">${type === 'gold' ? t('openingGrams') : t('opening')}</span><input class="in-f amt num" id="op" inputmode="decimal" value="${acc.opening}" placeholder="0"></label>
    <div id="certW" class="form" ${type === 'cert' ? '' : 'hidden'}>
      <div class="two"><label class="fld"><span>${t('certRate')}</span><input class="in-f num" id="cr" inputmode="decimal" value="${acc.rate || ''}" placeholder="0"></label>
      <label class="fld"><span>${t('certEnd')}</span><input class="in-f" type="date" id="ce" value="${acc.maturity || ''}"></label></div>
      <label class="fld"><span>${t('certPay')}</span><select class="in-f" id="cp">${['monthly', 'quarterly', 'yearly', 'maturity'].map(f => `<option value="${f}" ${f === (acc.payout || 'monthly') ? 'selected' : ''}>${f === 'maturity' ? t('atMaturity') : freqName(f)}</option>`).join('')}</select></label>
      ${isNew ? `<label class="fld"><span>${t('certAuto')}</span><select class="in-f" id="ca"><option value="">${t('noAuto')}</option>${accOpts('').replace(/ selected/g, '')}</select></label>` : ''}
    </div>
    <div id="cardW" class="form" ${type === 'card' ? '' : 'hidden'}>
      <div class="two"><label class="fld"><span>${t('closeDay')}</span><input class="in-f num" id="kd" inputmode="numeric" value="${acc.closeDay || ''}" placeholder="11"></label>
      <label class="fld"><span>${t('payDay')}</span><input class="in-f num" id="kp" inputmode="numeric" value="${acc.dueDay || ''}" placeholder="5"></label></div>
      <p class="hint" id="kEx"></p>
      <label class="fld"><span>${t('cardLimit')}</span><input class="in-f num" id="kl" inputmode="decimal" value="${acc.limit || ''}" placeholder="0"></label>
      <p class="hint">${t('cardOpenHint')}</p>
    </div>
    ${isNew ? '' : `<p class="hint">${t('balance')}: ${moneyC(accBalance(acc), acc.currency)} ${acc.currency === BASE() ? esc(curSym(BASE())) : ''}</p>`}
    <div class="foot">${isNew ? '' : `<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div>
  </form>`,
      r => {
        const kEx = () => {
          const cd = parseInt(val(r, 'kd')),
            dd = parseInt(val(r, 'kp')),
            el = r.querySelector('#kEx');
          if (!el) return;
          if (!(cd >= 1 && cd <= 31 && dd >= 1 && dd <= 31)) {
            el.textContent = t('cardDaysNeed');
            return;
          }
          const f = {closeDay: cd, dueDay: dd},
            ex = [TODAY, iso(new Date(dOf(TODAY).getTime() + 20 * 864e5))];
          el.textContent = ex
            .map(d =>
              t('cardEx')
                .replace('%b', shortDate(d))
                .replace('%p', shortDate(cardDueFor(f, d)))
            )
            .join(' · ');
        };
        ['kd', 'kp'].forEach(id => {
          const e = r.querySelector('#' + id);
          if (e) e.addEventListener('input', kEx);
        });
        kEx();
        bindSeg(r, 'at', v => {
          const wasGold = type === 'gold';
          type = v;
          r.querySelector('#certW').hidden = v !== 'cert';
          r.querySelector('#cardW').hidden = v !== 'card';
          if ((v === 'gold') !== wasGold) {
            r.querySelector('#cc').innerHTML = curOpts(v === 'gold' ? 'G21' : BASE(), v === 'gold');
            r.querySelector('#ccL').textContent = v === 'gold' ? t('karat') : t('currency');
            r.querySelector('#opL').textContent = v === 'gold' ? t('openingGrams') : t('opening');
          }
        });
        if (!isNew)
          r.querySelector('#del').onclick = () => {
            if (S.tx.some(x => x.acc === acc.id || x.toAcc === acc.id)) {
              toast(t('accInUse'));
              return;
            }
            {
              const u = [
                ...S.recur
                  .filter(r => r.tpl.acc === acc.id || r.tpl.toAcc === acc.id)
                  .map(r => r.tpl.note || catName(r.tpl.cat)),
                ...S.inst.filter(o => o.payWith === acc.id).map(o => o.name),
                ...S.goals.filter(g => g.acc === acc.id).map(g => g.name)
              ];
              if (u.length) {
                toast(t('accUsedBy') + ' ' + u.slice(0, 3).join('، '), 7000);
                return;
              }
            }
            if (S.accounts.length < 2) {
              toast(t('accLast'));
              return;
            }
            confirmSheet(t('confirmDel'), t('del'), () => {
              S.accounts = S.accounts.filter(a => a.id !== acc.id);
              if (S.defAcc === acc.id) S.defAcc = S.accounts[0].id;
              commit(t('deleted'));
            });
          };
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const nm = val(r, 'nm');
          if (!nm) {
            toast(t('needName'));
            return;
          }
          const cc = val(r, 'cc');
          if (S.accounts.some(a => a.id !== acc.id && a.name.trim() === nm && a.currency === cc)) {
            toast(t('accDup'));
            return;
          }
          if (!isNew && cc !== acc.currency && S.tx.some(x => x.acc === acc.id || x.toAcc === acc.id)) {
            toast(t('accCurLocked'));
            return;
          }
          const o = {type, name: nm, currency: cc, opening: numv(r, 'op'), group: val(r, 'gp')};
          if (type === 'card') {
            const d = x => {
              const n = parseInt(val(r, x));
              return n >= 1 && n <= 31 ? n : '';
            };
            Object.assign(o, {closeDay: d('kd'), dueDay: d('kp'), limit: numv(r, 'kl') || 0});
          }
          if (type === 'cert')
            Object.assign(o, {rate: parseFloat(val(r, 'cr')) || 0, maturity: val(r, 'ce') || '', payout: val(r, 'cp')});
          let nid = acc.id;
          if (isNew) {
            nid = 'a' + uid();
            S.accounts.push(Object.assign({id: nid}, o));
          } else
            Object.assign(
              S.accounts.find(a => a.id === acc.id),
              o
            );
          const ca = r.querySelector('#ca');
          if (isNew && type === 'cert' && ca && ca.value && o.rate > 0 && o.payout !== 'maturity') {
            const n = {monthly: 12, quarterly: 4, yearly: 1}[o.payout],
              amt = Math.round(((o.opening * o.rate) / 100 / n) * 100) / 100,
              dest = accOf(ca.value);
            const first = advance(TODAY, o.payout);
            S.recur.push({
              id: 'r' + uid(),
              freq: o.payout,
              day: +first.slice(8, 10),
              next: first,
              end: o.maturity || null,
              tpl: {
                type: 'income',
                acc: dest.id,
                cat: 'interest',
                amount:
                  dest.currency === cc
                    ? amt
                    : Math.round(((amt * rateOf(cc)) / (rateOf(dest.currency) || 1)) * 100) / 100,
                note: t('certReturn') + ' · ' + nm
              }
            });
          }
          closeSheet();
          commit(t('saved'));
          if (cc !== BASE() && !rateOf(cc)) updateRates(false);
        };
      }
    );
  }
  function ratesForm() {
    const list = usedCurrencies();
    openSheet(
      t('rates'),
      `<form class="form" id="f">
    <p class="hint">${t('ratesHint')}</p>
    ${list.length ? list.map(c => `<label class="fld"><span>${isGold(c) ? t('gramPrice') + ' ' + esc(curName(c)) : '1 ' + c + ' (' + esc(curName(c)) + ')'} = ? ${esc(curSym(BASE()))}</span><input class="in-f num" inputmode="decimal" data-r="${c}" value="${S.rates[c] || ''}"></label>`).join('') : `<p class="hint">${t('noForeign')}</p>`}
    <div class="foot"><button type="button" class="btn grow" id="up">${t('ratesUpdate')}</button><button class="btn pri grow">${t('save')}</button></div>
    ${S.ratesAt ? `<p class="hint">${t('ratesAt')}: ${esc(dateOf(new Date(S.ratesAt)) + ' ' + hmOf(new Date(S.ratesAt)))} · <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener" style="color:var(--accent)">ExchangeRate-API</a></p>` : ''}
  </form>`,
      r => {
        r.querySelector('#up').onclick = async () => {
          S.goldManual = false;
          await updateRates(true);
          closeSheet();
          ratesForm();
        };
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          r.querySelectorAll('[data-r]').forEach(i => {
            const v = parseFloat(i.value);
            if (v > 0) {
              if (isGold(i.dataset.r) && v !== S.rates[i.dataset.r]) S.goldManual = true;
              S.rates[i.dataset.r] = v;
            }
          });
          closeSheet();
          commit(t('saved'));
        };
      }
    );
  }
  function instForm(it) {
    const isNew = !it;
    it = it || {name: '', monthly: '', currency: BASE(), group: '', count: 12, start: TODAY_YM, paid: []};
    openSheet(
      isNew ? t('addInst') : it.name,
      `<form class="form" id="f">
    <label class="fld"><span>${t('name')}</span><input class="in-f" id="nm" value="${esc(it.name)}" placeholder="${S.lang === 'en' ? 'e.g. Fridge' : 'مثلاً: تلاجة، عربية، موبايل'}"></label>${altFld(it)}
    <div class="two"><label class="fld"><span>${t('group')}</span><input class="in-f" id="gp" list="dl-og" value="${esc(it.group || '')}" placeholder="${t('groupHint')}">${datalist(
      'dl-og',
      [...S.inst, ...S.gam].map(o => o.group)
    )}</label>
    <label class="fld"><span>${t('payCat')}</span><select class="in-f" id="ic">${catOptsTree('expense', it.cat || 'inst', false)}</select></label></div>
    <label class="fld"><span>${t('payWith')}</span><select class="in-f" id="pw"><option value="">${t('anyAcc')}</option>${S.accounts.map(a => `<option value="${a.id}" ${a.id === it.payWith ? 'selected' : ''}>${esc(a.name)} · ${a.currency}</option>`).join('')}</select></label>
    <div class="two"><label class="fld"><span>${t('monthly')}</span><input class="in-f amt num" id="mo" inputmode="decimal" value="${it.monthly}"></label>
    <label class="fld"><span>${t('currency')}</span><select class="in-f" id="oc">${curOpts(it.currency || BASE())}</select></label></div>
    <div class="two"><label class="fld"><span>${t('count')}</span><input class="in-f num" id="ct" inputmode="numeric" value="${it.count}"></label>
    <label class="fld"><span>${t('startMonth')}</span><input class="in-f" type="month" id="st" value="${it.start}"></label></div>
    <label class="fld"><span>${t('dueDay')}</span><input class="in-f num" id="dd" inputmode="numeric" value="${it.dueDay || 1}"></label>
    ${isNew ? `<label class="fld"><span>${t('paidSoFar')}</span><input class="in-f num" id="pd" inputmode="numeric" value="0"></label>` : ''}
    <div class="foot">${isNew ? '' : `<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div>
    ${!isNew && it.paid.length ? `<button type="button" class="btn block" id="undo">${t('undoLast')}</button>` : ''}
  </form>`,
      r => {
        if (!isNew) {
          r.querySelector('#del').onclick = () =>
            confirmSheet(t('confirmDel'), t('del'), () => {
              S.inst = S.inst.filter(x => x.id !== it.id);
              commit(t('deleted'));
            });
          const u = r.querySelector('#undo');
          if (u)
            u.onclick = () => {
              closeSheet();
              undoLast('inst', it.id);
            };
        }
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const nm = val(r, 'nm'),
            mo = numv(r, 'mo'),
            ct = Math.max(1, parseInt(val(r, 'ct')) || 1),
            st = val(r, 'st') || TODAY_YM;
          if (!nm) {
            toast(t('needName'));
            return;
          }
          if (mo <= 0) {
            toast(t('needAmt'));
            return;
          }
          if (isNew) {
            const n = Math.min(ct, Math.max(0, parseInt(val(r, 'pd')) || 0));
            const o = {
              id: uid(),
              name: nm,
              monthly: mo,
              currency: val(r, 'oc'),
              group: val(r, 'gp'),
              cat: val(r, 'ic') || 'inst',
              payWith: (r.querySelector('#pw') || {}).value || '',
              dueDay: Math.min(28, Math.max(1, parseInt(val(r, 'dd')) || 1)),
              count: ct,
              start: st,
              paid: []
            };
            o.paid = instMonths(o).slice(0, n);
            S.inst.push(o);
          } else {
            const o = S.inst.find(x => x.id === it.id);
            Object.assign(o, {
              name: nm,
              monthly: mo,
              currency: val(r, 'oc'),
              group: val(r, 'gp'),
              cat: val(r, 'ic') || 'inst',
              payWith: (r.querySelector('#pw') || {}).value || '',
              dueDay: Math.min(28, Math.max(1, parseInt(val(r, 'dd')) || 1)),
              count: ct,
              start: st
            });
            const ms = instMonths(o);
            o.paid = o.paid.filter(m => ms.includes(m));
          }
          closeSheet();
          commit(t('saved'));
        };
      }
    );
  }
