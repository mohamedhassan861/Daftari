/* Finding the statement columns from what is in them, for files whose headings are missing or unusual. */
  /* a column of dates, the number columns next to it and the longest text column; the running balance is the
     number column that moves by each row's amount; two number columns that are never both filled are out / in */
  function stmtGuessByContent(rows) {
    const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
    /* "22-10" is a day, not an amount */
    const isNum = v => stmtIsAmt(v) && isFinite(stmtNum(v).v) && !(typeof v === 'string' && stmtDateParts(v));
    /* Excel dates arrive as dates, so a plain number (an amount like 45,000) is never taken for one */
    const isDate = v => typeof v !== 'number' && !!stmtDateParts(v);
    /* the first column that is (nearly) all dates: transaction date usually comes before the posting date */
    const dn = Array.from({length: width}, (_, j) => rows.filter(r => isDate(r[j])).length),
      best = Math.max(0, ...dn),
      dateCol = dn.findIndex(n => n >= best * 0.9 && n > 0);
    if (dateCol < 0 || best < 2) return null;
    const data = rows.map((r, i) => ({r, i})).filter(x => isDate(x.r[dateCol]));
    const first = data[0].i,
      nums = [];
    for (let j = 0; j < width; j++) {
      if (j === dateCol) continue;
      if (data.filter(x => isNum(x.r[j]) && stmtNum(x.r[j]).v).length >= 2) nums.push(j);
    }
    if (!nums.length) return null;
    const val = (r, j) => (isNum(r[j]) ? stmtNum(r[j]).v || 0 : 0),
      c100 = v => Math.round(Math.abs(v) * 100);
    /* balance: the number column that moves by another column's amount (or by in − out) on most rows */
    let balance = null,
      bestHits = 0,
      use = {};
    nums.forEach(b => {
      const others = nums.filter(j => j !== b),
        u = {};
      let hits = 0;
      for (let k = 1; k < data.length; k++) {
        const d = c100(val(data[k].r, b) - val(data[k - 1].r, b));
        if (!d) continue;
        const one = others.find(j => Math.abs(d - c100(val(data[k].r, j))) <= 1);
        if (one != null) {
          hits++;
          u[one] = (u[one] || 0) + 1;
        }
      }
      if (data.length > 2 && hits >= (data.length - 1) * 0.6 && hits > bestHits) {
        bestHits = hits;
        balance = b;
        use = u;
      }
    });
    /* amount columns: with a balance, those that explain its moves; without, any number column */
    const amts = balance != null ? nums.filter(j => use[j]) : nums.slice(),
      cols = {date: dateCol};
    if (balance != null) cols.balance = balance;
    if (!amts.length) return null;
    const both = (a, b) => data.filter(x => val(x.r, a) && val(x.r, b)).length;
    const pair = amts.length >= 2 ? [amts[0], amts[1]] : null;
    if (pair && both(pair[0], pair[1]) <= data.length * 0.05) {
      let [dr, cr] = pair;
      /* with a balance column the direction is known: the balance falls on the "out" column */
      if (balance != null) {
        let down = 0;
        for (let k = 1; k < data.length; k++)
          if (val(data[k].r, dr)) down += val(data[k].r, balance) < val(data[k - 1].r, balance) ? 1 : -1;
        if (down < 0) [dr, cr] = [cr, dr];
      }
      cols.debit = dr;
      cols.credit = cr;
    } else {
      cols.amount = amts.sort((a, b) => (use[b] || 0) - (use[a] || 0))[0];
      /* one amount column written without signs: each row's direction comes from the balance */
      const unsigned = data.every(x => val(x.r, cols.amount) >= 0);
      if (balance != null && unsigned) cols.sb = true;
      else if (balance != null) {
        let same = 0;
        for (let k = 1; k < data.length; k++) {
          const d = val(data[k].r, balance) - val(data[k - 1].r, balance),
            v = val(data[k].r, cols.amount);
          if (d && v) same += Math.sign(d) === Math.sign(v) ? 1 : -1;
        }
        if (same < 0) cols.neg = true;
      }
    }
    let descLen = 0;
    for (let j = 0; j < width; j++) {
      if (j === dateCol || nums.includes(j)) continue;
      const len = data.reduce(
        (s, x) => s + (isNum(x.r[j]) || isDate(x.r[j]) ? 0 : String(x.r[j] == null ? '' : x.r[j]).length),
        0
      );
      if (len > descLen) {
        descLen = len;
        cols.desc = j;
      }
    }
    return {i: first - 1, cols};
  }
