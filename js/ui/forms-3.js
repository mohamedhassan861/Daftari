/* Entry forms: transactions, loans, transfers and settings. (part 3 of 5; continues from forms-2.js) */
  function gamForm(g) {
    const isNew = !g;
    g = g || {
      name: '',
      share: '',
      currency: BASE(),
      group: '',
      members: 10,
      myTurn: 1,
      start: TODAY_YM,
      paid: [],
      received: false
    };
    openSheet(
      isNew ? t('addGam') : g.name,
      `<form class="form" id="f">
    <label class="fld"><span>${t('name')}</span><input class="in-f" id="nm" value="${esc(g.name)}" placeholder="${S.lang === 'en' ? 'e.g. Work circle' : 'مثلاً: جمعية الشغل'}"></label>${altFld(g)}
    <label class="fld"><span>${t('group')}</span><input class="in-f" id="gp" list="dl-og2" value="${esc(g.group || '')}" placeholder="${t('groupHint')}">${datalist(
      'dl-og2',
      [...S.inst, ...S.gam].map(o => o.group)
    )}</label>
    <div class="two"><label class="fld"><span>${t('share')}</span><input class="in-f amt num" id="sh" inputmode="decimal" value="${g.share}"></label>
    <label class="fld"><span>${t('currency')}</span><select class="in-f" id="oc">${curOpts(g.currency || BASE())}</select></label></div>
    <div class="two"><label class="fld"><span>${t('members')}</span><input class="in-f num" id="mb" inputmode="numeric" value="${g.members}"></label>
    <label class="fld"><span>${t('myTurn')}</span><input class="in-f num" id="tn" inputmode="numeric" value="${g.myTurn}"></label></div>
    <div class="two"><label class="fld"><span>${t('startMonth')}</span><input class="in-f" type="month" id="st" value="${g.start}"></label>
    <label class="fld"><span>${t('dueDay')}</span><input class="in-f num" id="dd" inputmode="numeric" value="${g.dueDay || 1}"></label></div>
    ${isNew ? `<label class="fld"><span>${t('paidSoFar')}</span><input class="in-f num" id="pd" inputmode="numeric" value="0"></label><label class="chk"><input type="checkbox" id="rc"> ${t('received')}</label>` : ''}
    <div class="foot">${isNew ? '' : `<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div>
    ${!isNew && g.paid.length ? `<button type="button" class="btn block" id="undo">${t('undoLast')}</button>` : ''}
  </form>`,
      r => {
        if (!isNew) {
          r.querySelector('#del').onclick = () =>
            confirmSheet(t('confirmDel'), t('del'), () => {
              S.gam = S.gam.filter(x => x.id !== g.id);
              commit(t('deleted'));
            });
          const u = r.querySelector('#undo');
          if (u)
            u.onclick = () => {
              closeSheet();
              undoLast('gam', g.id);
            };
        }
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const nm = val(r, 'nm'),
            sh = numv(r, 'sh'),
            mb = Math.max(1, parseInt(val(r, 'mb')) || 1),
            tn = Math.min(mb, Math.max(1, parseInt(val(r, 'tn')) || 1)),
            st = val(r, 'st') || TODAY_YM;
          if (!nm) {
            toast(t('needName'));
            return;
          }
          if (sh <= 0) {
            toast(t('needAmt'));
            return;
          }
          if (isNew) {
            const n = Math.min(mb, Math.max(0, parseInt(val(r, 'pd')) || 0));
            const o = {
              id: uid(),
              name: nm,
              share: sh,
              currency: val(r, 'oc'),
              group: val(r, 'gp'),
              dueDay: Math.min(28, Math.max(1, parseInt(val(r, 'dd')) || 1)),
              members: mb,
              myTurn: tn,
              start: st,
              paid: [],
              received: r.querySelector('#rc').checked
            };
            o.paid = gamMonths(o).slice(0, n);
            S.gam.push(o);
          } else {
            const o = S.gam.find(x => x.id === g.id);
            Object.assign(o, {
              name: nm,
              share: sh,
              currency: val(r, 'oc'),
              group: val(r, 'gp'),
              dueDay: Math.min(28, Math.max(1, parseInt(val(r, 'dd')) || 1)),
              members: mb,
              myTurn: tn,
              start: st
            });
            const ms = gamMonths(o);
            o.paid = o.paid.filter(m => ms.includes(m));
          }
          closeSheet();
          commit(t('saved'));
        };
      }
    );
  }
