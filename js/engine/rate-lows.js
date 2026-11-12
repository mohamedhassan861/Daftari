/* Lowest price of each currency and of gold over the last 3 months / 1 / 2 / 3 years, from one row per day. */
  const LOW_CODES = ['USD', 'SAR', 'EUR', 'G21', 'G24'],
    LOW_WINDOWS = [
      [3, 'lowsM3'],
      [12, 'lowsY1'],
      [24, 'lowsY2'],
      [36, 'lowsY3']
    ];
  /* the same date m months earlier (31 March - 1 month = 28/29 February) */
  function ymdBack(ds, m) {
    let [y, mo, d] = ds.split('-').map(Number);
    mo -= m;
    while (mo < 1) {
      mo += 12;
      y--;
    }
    return y + '-' + pad(mo) + '-' + pad(Math.min(d, new Date(y, mo, 0).getDate()));
  }
  /* a row is [date, USD, SAR, EUR, gold ounce], all in EGP; gold per gram uses the same formula as the live rates */
  function lowVal(row, code) {
    const i = {USD: 1, SAR: 2, EUR: 3}[code];
    if (i) return row[i];
    const g24 = row[4] / 31.1035;
    if (!(g24 > 0)) return null;
    return code === 'G24' ? g24 : (g24 * 21) / 24;
  }
  /* ties keep the most recent day */
  function rateLows(rows, today) {
    const out = {};
    LOW_CODES.forEach(c => {
      out[c] = {};
      LOW_WINDOWS.forEach(([m, k]) => {
        const from = ymdBack(today, m);
        let best = null;
        rows.forEach(r => {
          if (r[0] < from || r[0] > today) return;
          const v = lowVal(r, c);
          if (v > 0 && (!best || v <= best.v)) best = {v, d: r[0]};
        });
        out[c][k] = best;
      });
    });
    return out;
  }
