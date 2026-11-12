/* The lowest-price table at the bottom of the rates section. */
  /* days newer than the shipped history file come from the same free daily feed, kept on this device (public prices, not user data) */
  async function recentRateDays(last) {
    const KEY = 'daftari-rates-recent';
    let cache = {};
    try {
      cache = JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (e) {}
    const want = [];
    for (let d = dsDate(last); want.length < 120; ) {
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      const s = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      if (s > TODAY) break;
      if (!cache[s]) want.push([s, d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate()]);
    }
    await Promise.all(
      want.map(async ([s, v]) => {
        try {
          const j = await (await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@' + v + '/v1/currencies/egp.min.json')).json();
          const e = j && j.egp,
            inv = (k, n) => (e && e[k] ? Math.round((1 / e[k]) * 10 ** n) / 10 ** n : null);
          if (e) cache[j.date || s] = [inv('usd', 4), inv('sar', 4), inv('eur', 4), inv('xau', 2)];
        } catch (x) {}
      })
    );
    Object.keys(cache).forEach(k => {
      if (k <= last) delete cache[k];
    });
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch (e) {}
    return Object.keys(cache)
      .sort()
      .map(k => [k].concat(cache[k]));
  }
  async function loadRateLows() {
    if (RLOW || RLOW_BUSY) return;
    RLOW_BUSY = true;
    try {
      const j = await (await fetch('data/rates-history.json?v=' + APP_VER)).json();
      RLOW = j.rows.concat(await recentRateDays(j.rows[j.rows.length - 1][0]));
      if (S && tab === 'set') render();
    } catch (e) {
      RLOW = 'fail';
      if (S && tab === 'set') render();
    }
    RLOW_BUSY = false;
  }
  function lowsHTML() {
    if (!RLOW) {
      setTimeout(loadRateLows, 0);
      return `<p class="hint">${t('loading')}</p>`;
    }
    if (RLOW === 'fail') return `<p class="hint">${t('lowsFail')}</p>`;
    const L = rateLows(RLOW, TODAY),
      grid = 'style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;text-align:center;padding:6px 10px"',
      nm = c => (isGold(c) ? t('goldG') + ' ' + c.slice(1) + ' / ' + t('gram') : c),
      /* gold is shown in whole pounds so four prices fit across a phone screen */
      val = (c, v) => fmt(isGold(c) ? Math.round(v) : Math.round(v * 100) / 100),
      cell = (c, b) =>
        b
          ? `<span><b class="num" style="font-size:14px">${val(c, b.v)}</b><small class="muted" style="display:block;font-size:10px">${dmyOf(dsDate(b.d))}</small></span>`
          : '<span>—</span>';
    return `<div class="grp" style="margin-top:12px;border-radius:12px 12px 0 0"><span>📉 ${t('lowsT')}</span></div><div class="list" style="border-radius:0 0 12px 12px">
    <div class="muted" ${grid}>${LOW_WINDOWS.map(([, k]) => `<small style="font-size:12px">${t(k)}</small>`).join('')}</div>
    ${LOW_CODES.map(c => `<div style="border-top:1px solid var(--line)"><div style="padding:6px 10px 0;font-size:13px;font-weight:600">${esc(nm(c))}</div><div ${grid}>${LOW_WINDOWS.map(([, k]) => cell(c, L[c][k])).join('')}</div></div>`).join('')}
    </div><p class="hint">${t('lowsHint').replace('%d', dmyOf(dsDate(RLOW[RLOW.length - 1][0])))}</p>`;
  }
