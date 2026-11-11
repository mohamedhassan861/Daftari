/* The bottom sheet, date fields and other shared screen parts. */
  function dateField(el) {
    if (el.dataset.dw) return;
    el.dataset.dw = '1';
    const w = document.createElement('span');
    w.className = 'dwrap';
    const sh = document.createElement('span');
    sh.className = 'in-f dshow';
    el.parentNode.insertBefore(w, el);
    w.appendChild(sh);
    w.appendChild(el);
    const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const upd = () => {
      const v = d.get.call(el);
      sh.textContent = !v ? '—' : el.type === 'month' ? monthLbl(v) : dayLbl(v);
    };
    Object.defineProperty(el, 'value', {
      configurable: true,
      get() {
        return d.get.call(el);
      },
      set(v) {
        d.set.call(el, v);
        upd();
      }
    });
    el.addEventListener('input', upd);
    el.addEventListener('change', upd);
    el.addEventListener('click', () => {
      try {
        el.showPicker && el.showPicker();
      } catch (e) {}
    });
    upd();
  }
  /* every box starts closed showing its totals; the ones you open stay open next time */
  /* the period at the top shows in full: smaller type first, then the app name steps aside */
  function fitHeader() {
    const b = $('#mLbl'),
      br = $('#brand');
    if (!b) return;
    const fits = () => b.scrollWidth <= b.clientWidth + 1;
    br.style.display = '';
    b.style.maxWidth = '';
    b.style.fontSize = '';
    for (const f of [14, 13, 12]) {
      b.style.fontSize = f + 'px';
      if (fits()) return;
    }
    br.style.display = 'none';
    b.style.maxWidth = 'none';
    for (const f of [14, 13, 12, 11, 10]) {
      b.style.fontSize = f + 'px';
      if (fits()) return;
    }
  }
  function setBoxes(h) {
    return h.replace(
      /<section class="sec"( id="[^"]*")?><div class="sec-h">([\s\S]*?)<\/div>([\s\S]*?)<\/section>/g,
      (m, id, head, body) => `<details class="box"${id || ''}><summary>${head}</summary>${body}</details>`
    );
  }
  function boxStates(v) {
    let st = {};
    try {
      st = JSON.parse(localStorage.getItem('daftari-open') || '{}');
    } catch (e) {}
    v.querySelectorAll('details.box').forEach(d => {
      const h = d.querySelector('summary h2');
      const k = tab + ':' + (d.dataset.k || (h ? h.textContent.trim() : ''));
      d.open = !!st[k];
      d.addEventListener('toggle', () => {
        try {
          const s2 = JSON.parse(localStorage.getItem('daftari-open') || '{}');
          if (d.open) s2[k] = 1;
          else delete s2[k];
          localStorage.setItem('daftari-open', JSON.stringify(s2));
        } catch (e) {}
      });
    });
    const sb = v.querySelector('.stickbar');
    document.documentElement.style.setProperty('--stickH', sb ? sb.getBoundingClientRect().height + 'px' : '0px');
  }
  function openSheet(title, html, ready) {
    $('#shT').textContent = title;
    $('#shB').innerHTML = html;
    $('#sheet').hidden = false;
    navSync();
    if (ready) ready($('#shB'));
  }
  /* the phone's back button closes the open sheet first, then goes back to the home tab, and only then leaves the app */
  /* one extra history entry stands for "something to go back from" (an open sheet or a tab other than home) */
  function navSync() {
    try {
      const want = !$('#sheet').hidden ? 'sheet' : S && tab !== 'home' ? 'tab' : null,
        cur = history.state && history.state.nav;
      if (want) {
        if (!cur) history.pushState({nav: want}, '');
        else if (cur !== want) history.replaceState({nav: want}, '');
      } else if (cur && cur !== 'idle') history.replaceState({nav: 'idle'}, '');
    } catch (e) {}
  }
  function closeSheet() {
    $('#sheet').hidden = true;
    $('#shB').innerHTML = '';
    navSync();
  }
  function confirmSheet(msg, yesLbl, onYes) {
    openSheet(
      msg,
      `<div class="foot"><button class="btn grow" id="cNo">${t('cancel')}</button><button class="btn pri grow" id="cYes" style="background:var(--neg);border-color:var(--neg)">${esc(yesLbl || t('yes'))}</button></div>`,
      b => {
        b.querySelector('#cNo').onclick = closeSheet;
        b.querySelector('#cYes').onclick = () => {
          closeSheet();
          onYes();
        };
      }
    );
  }
  const altFld = o => {
    const ol = lng() === 'en' ? 'ar' : 'en',
      v = (o && o.nm && o.nm[ol]) || (o && ol === 'ar' && /[\u0600-\u06FF]/.test(o.name || '') ? o.name : '');
    return `<label class="fld"><span>${t('altName')}</span><input class="in-f" id="nm2" dir="${ol === 'en' ? 'ltr' : 'rtl'}" value="${esc(v)}"></label>`;
  };
  const segHTML = (id, opts, val) =>
    `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === val ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>`;
  function bindSeg(root, id, cb) {
    root.querySelectorAll('#' + id + ' button').forEach(
      b =>
        (b.onclick = () => {
          root.querySelectorAll('#' + id + ' button').forEach(x => x.classList.toggle('on', x === b));
          cb(b.dataset.v);
        })
    );
  }
  const val = (r, id) => r.querySelector('#' + id).value.trim();
