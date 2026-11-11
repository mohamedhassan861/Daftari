/* The plan screens. (part 2 of 2; continues from plan-1.js) */
  function planAdjForm(m, idx) {
    const ed = idx != null ? S.planAdj[idx] : null;
    let ty = ed ? ed.type || 'expense' : 'expense';
    openSheet(
      (ed ? t('edit') : t('addPlan')) + ' · ' + monthLbl(m),
      `<form class="form" id="f">${segHTML(
        'pa',
        [
          ['expense', t('exp1')],
          ['income', t('inc1')]
        ],
        ty
      )}
    <label class="fld"><span>${t('category')}</span><select class="in-f" id="pc">${catOptsTree(ty, ed ? ed.cat : '', false)}</select></label>
    <label class="fld"><span>${t('amount')}</span><input class="in-f amt num" id="pv" inputmode="decimal" placeholder="0" value="${ed ? ed.amount : ''}"></label>
    <label class="fld"><span>${t('note')}</span><input class="in-f" id="pn" value="${ed ? esc(ed.label && ed.label !== catName(ed.cat) ? ed.label : '') : ''}"></label>
    <label class="fld"><span>${t('payWith')}</span><select class="in-f" id="pa2"><option value="">${t('cashOrBank')}</option>${cards()
      .map(a => `<option value="${a.id}" ${ed && ed.acc === a.id ? 'selected' : ''}>💳 ${esc(a.name)}</option>`)
      .join('')}</select></label>
    <label class="fld" ${ed ? 'hidden' : ''}><span>${t('repeatFor')}</span><select class="in-f" id="pr">${[1, 2, 3, 6, 12].map(n => `<option value="${n}">${n === 1 ? t('thisMonthOnly') : n + ' ' + t('monthsW')}</option>`).join('')}</select></label>
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,
      r => {
        bindSeg(r, 'pa', v => {
          ty = v;
          r.querySelector('#pc').innerHTML = catOptsTree(v, '', false);
        });
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const v = numv(r, 'pv');
          if (!(v > 0)) {
            toast(t('needAmt'));
            return;
          }
          const n = +val(r, 'pr') || 1,
            cat = val(r, 'pc'),
            note = val(r, 'pn');
          const acc = ty === 'expense' ? val(r, 'pa2') : '';
          if (ed) Object.assign(ed, {type: ty, cat, amount: v, acc, label: note || catName(cat)});
          else
            for (let i = 0; i < n; i++)
              S.planAdj.push({m: ymAdd(m, i), type: ty, cat, amount: v, acc, label: note || catName(cat)});
          commit(t('saved'));
          fcMonthSheet(m);
        };
      }
    );
  }
