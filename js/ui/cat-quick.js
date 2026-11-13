/* Adding a category from inside the entry form, without leaving it for settings. */
  const quickCatOpt = () => `<option value="__new">＋ ${esc(t('addCat'))}</option>`;
  function quickCatHTML() {
    return `<div id="ncW" hidden style="display:grid;gap:8px;padding:10px;border:1px dashed var(--line);border-radius:12px">
    <label class="fld"><span>${t('addCat')}</span><input class="in-f" id="ncN" autocomplete="off" enterkeyhint="done"></label>
    <label class="fld"><span>${t('underGroup')}</span><select class="in-f" id="ncP"></select></label>
    <div class="acts"><button type="button" class="btn sm" style="border-color:var(--accent);color:var(--accent)" id="ncOk">${t('add')}</button><button type="button" class="btn sm" id="ncX">${t('cancel')}</button></div></div>`;
  }
  /* same placement as a category added in settings: before the fixed ones at the end of the list */
  function newCat(ty, nm, pa) {
    const L1 = lng(),
      L2 = L1 === 'en' ? 'ar' : 'en',
      c = {id: 'c' + uid(), [L1]: nm, [L2]: nm, sys: false, parent: pa || null};
    S.cats[ty].splice(
      S.cats[ty].findIndex(
        k => k.sys && !k.parent && ['inst', 'gam', 'adjust', 'other', 'gamin', 'iadjust', 'iother'].includes(k.id)
      ),
      0,
      c
    );
    return c;
  }
  /* sel: the category select; ty(): the entry's current kind; opts(ty, chosen): the select's options */
  function quickCatBind(r, ty, opts) {
    const q = s => r.querySelector(s),
      sel = q('#cat');
    let prev = sel.value;
    const close = () => {
      q('#ncW').hidden = true;
      q('#ncN').value = '';
    };
    sel.addEventListener('change', () => {
      if (sel.value !== '__new') {
        prev = sel.value;
        close();
        return;
      }
      const mains = S.cats[ty()].filter(m => !m.parent && !m.sys);
      q('#ncP').innerHTML =
        `<option value="">${t('mainGroup')}</option>` +
        mains.map(m => `<option value="${m.id}">${esc(cName(m))}</option>`).join('');
      q('#ncW').hidden = false;
      setTimeout(() => q('#ncN').focus(), 50);
    });
    const add = () => {
      const nm = q('#ncN').value.trim();
      if (!nm) {
        toast(t('needName'));
        q('#ncN').focus();
        return;
      }
      const low = nm.toLowerCase(),
        same = S.cats[ty()].find(k => (k.ar || '').trim() === nm || (k.en || '').trim().toLowerCase() === low),
        c = same || newCat(ty(), nm, q('#ncP').value);
      sel.innerHTML = opts(ty(), c.id);
      sel.value = c.id;
      prev = c.id;
      close();
      if (!same) save();
      toast(same ? t('catExists') : t('saved'));
    };
    q('#ncOk').onclick = add;
    q('#ncN').onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        add();
      }
    };
    q('#ncX').onclick = () => {
      close();
      sel.value = prev;
    };
    return close;
  }
