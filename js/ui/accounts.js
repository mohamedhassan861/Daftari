/* Account screens and forms. */
  const curOpts = (sel, gold) =>
    CUR.filter(x => (gold ? isGold(x[0]) : !isGold(x[0]) || x[0] === sel))
      .map(
        ([c, ar, en]) =>
          `<option value="${c}" ${c === sel ? 'selected' : ''}>${isGold(c) ? '' : c + ' — '}${esc(lng() === 'en' ? en : ar)}</option>`
      )
      .join('');
  const moneyC = (n, c, cls) =>
    `<span class="num ${cls || ''}">${fmt(n)}</span>${c && c !== BASE() ? ` <small class="cur">${esc(curSym(c))}</small>` : ''}`;
  const accOpts = sel =>
    S.accounts
      .map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)} · ${a.currency}</option>`)
      .join('');
  function payAcc(c) {
    c = c || BASE();
    const d = accOf(S.defAcc);
    if (d && d.currency === c) return d.id;
    const b = S.accounts.find(a => a.currency === c);
    return b ? b.id : null;
  }
  /* exchange rates: free public API, no account data is sent */
  async function updateRates(manual) {
    try {
      const r = await fetch('https://open.er-api.com/v6/latest/' + BASE(), {cache: 'no-store'});
      const j = await r.json();
      if (j.result !== 'success' || !j.rates) throw new Error('rates');
      for (const c of CUR.map(x => x[0]))
        if (c !== BASE() && j.rates[c]) S.rates[c] = Math.round((1 / j.rates[c]) * 10000) / 10000;
      let oz = j.rates.XAU ? 1 / j.rates.XAU : 0;
      /* the exchange-rate feed has no gold; take the ounce price from a free daily feed (two mirrors) */
      if (!oz && !S.goldManual)
        for (const u of [
          'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json',
          'https://latest.currency-api.pages.dev/v1/currencies/xau.json'
        ]) {
          try {
            const g = await (await fetch(u, {cache: 'no-store'})).json();
            const v = g && g.xau && g.xau[BASE().toLowerCase()];
            if (v > 0) {
              oz = v;
              break;
            }
          } catch (e) {}
        }
      if (oz && !S.goldManual) {
        const g24 = oz / 31.1035;
        S.rates.G24 = Math.round(g24 * 100) / 100;
        S.rates.G21 = Math.round(((g24 * 21) / 24) * 100) / 100;
        S.rates.G18 = Math.round(((g24 * 18) / 24) * 100) / 100;
      }
      S.rateHist = S.rateHist || {};
      const snap = {};
      Object.keys(S.rates).forEach(c => {
        if (+S.rates[c] > 0) snap[c] = +S.rates[c];
      });
      S.rateHist[TODAY] = snap;
      const ks = Object.keys(S.rateHist).sort();
      while (ks.length > 400) delete S.rateHist[ks.shift()];
      S.ratesAt = new Date().toISOString();
      commit(manual ? t('ratesUpdated') : oz ? '' : '');
    } catch (e) {
      if (manual) toast(t('ratesFailed'));
    }
  }
  const datalist = (id, vals) =>
    `<datalist id="${id}">${[...new Set(vals.filter(Boolean))].map(v => `<option value="${esc(v)}"></option>`).join('')}</datalist>`;
  function catOptsTree(ty, sel, isNew) {
    const show = c => !(c.sys && isNew && !['other', 'iother', 'adjust', 'iadjust'].includes(c.id)) || c.id === sel;
    return S.cats[ty]
      .filter(c => !c.parent)
      .map(m => {
        let h = show(m) ? `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(cName(m))}</option>` : '';
        catKids(ty, m.id).forEach(k => {
          if (show(k)) h += `<option value="${k.id}" ${k.id === sel ? 'selected' : ''}>   — ${esc(cName(k))}</option>`;
        });
        return h;
      })
      .join('');
  }
  function catForm(ty, c) {
    const isNew = !c;
    c = c || {ar: '', en: '', parent: null, sys: false};
    const mains = S.cats[ty].filter(m => !m.parent && m.id !== c.id && !m.sys);
    const hasKids = !isNew && catKids(ty, c.id).length > 0;
    openSheet(
      isNew ? t('addCat') : cName(c),
      `<form class="form" id="f">
    <label class="fld"><span>${t('name')}</span><input class="in-f" id="nm" value="${esc(cName(c))}" ${c.sys ? 'disabled' : ''}></label>
    ${c.sys ? '' : `<label class="fld"><span>${t('altName')}</span><input class="in-f" id="nm2c" dir="${lng() === 'en' ? 'rtl' : 'ltr'}" value="${esc(isNew ? '' : (lng() === 'en' ? c.ar : c.en) === cName(c) ? '' : lng() === 'en' ? c.ar : c.en)}"></label>`}
    <label class="fld"><span>${t('underGroup')}</span><select class="in-f" id="pa" ${hasKids ? 'disabled' : ''}><option value="">${t('mainGroup')}</option>${mains.map(m => `<option value="${m.id}" ${m.id === c.parent ? 'selected' : ''}>${esc(cName(m))}</option>`).join('')}</select></label>
    ${hasKids ? `<p class="hint">${t('hasKids')}</p>` : ''}
    <div class="foot">${isNew || c.sys ? '' : `<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div></form>`,
      r => {
        if (!isNew) setTimeout(() => {}, 0);
        else setTimeout(() => r.querySelector('#nm').focus(), 50);
        const d = r.querySelector('#del');
        if (d)
          d.onclick = () => {
            const used = S.tx.some(x => x.cat === c.id);
            confirmSheet(used ? t('catInUse') : t('confirmDel'), t('del'), () => {
              S.cats[ty].forEach(k => {
                if (k.parent === c.id) k.parent = null;
              });
              S.cats[ty] = S.cats[ty].filter(k => k.id !== c.id);
              S.tx.forEach(x => {
                if (x.cat === c.id) x.cat = c.parent || (ty === 'expense' ? 'other' : 'iother');
              });
              delete S.budgets[c.id];
              commit(t('deleted'));
            });
          };
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const nm = val(r, 'nm');
          if (!c.sys && !nm) {
            toast(t('needName'));
            return;
          }
          const pa = r.querySelector('#pa').value || null;
          const n2 = (r.querySelector('#nm2c') || {value: ''}).value.trim(),
            L1 = lng(),
            L2 = L1 === 'en' ? 'ar' : 'en';
          if (isNew)
            S.cats[ty].splice(
              S.cats[ty].findIndex(
                k =>
                  k.sys && !k.parent && ['inst', 'gam', 'adjust', 'other', 'gamin', 'iadjust', 'iother'].includes(k.id)
              ),
              0,
              {id: 'c' + uid(), [L1]: nm, [L2]: n2 || nm, sys: false, parent: pa}
            );
          else {
            const o = S.cats[ty].find(k => k.id === c.id);
            if (!c.sys) {
              o[L1] = nm;
              o[L2] = n2 || nm;
            }
            if (!hasKids) o.parent = pa;
          }
          closeSheet();
          commit(t('saved'));
        };
      }
    );
  }
