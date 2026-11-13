/* Reading a bank or card statement: numbers, dates and rows → {date, desc, amt, bal}. (part 2 of 2; continues from stmt-parse-1.js) */
  /* "1,234.50", "(1,234.50)", "1.234,50", "1234.5-", "1,234.50 DR", "٣٬٤٥٠٫٥٠" → number; flag tells DR/CR when written */
  function stmtNum(v) {
    if (typeof v === 'number') return {v, f: ''};
    let x = normDigits(String(v == null ? '' : v))
      .replace(/٫/g, '.')
      .replace(/٬/g, ',')
      .trim();
    if (!x) return {v: NaN, f: ''};
    const f = /\b(dr|debit)\b|مدين/i.test(x) ? 'dr' : /\b(cr|credit)\b|دائن/i.test(x) ? 'cr' : '';
    const neg = /^\(.*\)$/.test(x) || /^-/.test(x) || /-$/.test(x) || /^[^\d]*-\s*\d/.test(x);
    x = x.replace(/[^\d.,]/g, '');
    if (!x) return {v: NaN, f};
    const lc = x.lastIndexOf(','),
      ld = x.lastIndexOf('.');
    if (lc > -1 && ld > -1) x = lc > ld ? x.replace(/\./g, '').replace(',', '.') : x.replace(/,/g, '');
    else if (lc > -1) x = /^\d{1,3},\d{2}$/.test(x) ? x.replace(',', '.') : x.replace(/,/g, '');
    const n = parseFloat(x);
    return {v: isNaN(n) ? NaN : neg ? -n : n, f};
  }
  const STMT_MONTHS = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    sept: 9,
    oct: 10,
    nov: 11,
    dec: 12,
    يناير: 1,
    فبراير: 2,
    مارس: 3,
    ابريل: 4,
    مايو: 5,
    يونيو: 6,
    يونيه: 6,
    يوليو: 7,
    يوليه: 7,
    اغسطس: 8,
    سبتمبر: 9,
    اكتوبر: 10,
    نوفمبر: 11,
    ديسمبر: 12
  };
  /* one date cell → [y, m, d] or for a/b/y strings the raw parts, decided later for the whole file (day first unless it can't be) */
  function stmtDateParts(v) {
    if (v == null || v === '') return null;
    /* Excel date cells: whether the reader made them at local or UTC midnight, noon UTC is the same day */
    if (v instanceof Date && !isNaN(v)) {
      const n = new Date(v.getTime() + 432e5);
      return {ymd: [n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate()]};
    }
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) {
        const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5);
        return {ymd: [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]};
      }
      return null;
    }
    /* "12NOV26" and "Nov12" are split into words first */
    const x = stmtNorm(v)
      .replace(/\//g, ' / ')
      .replace(/(\d)(\p{L})/gu, '$1 $2')
      .replace(/(\p{L})(\d)/gu, '$1 $2');
    const s = normDigits(String(v)).trim();
    let m;
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return {ymd: [+m[1], +m[2], +m[3]]};
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)))
      return {ab: [+m[1], +m[2]], y: m[3].length === 2 ? 2000 + +m[3] : +m[3]};
    /* card statements often leave out the year ("12/11", "12 NOV"): year 0 here, filled in from today later */
    if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})$/))) return {ab: [+m[1], +m[2]], y: 0};
    const mon = Object.keys(STMT_MONTHS).find(k => new RegExp('(^|[^\\p{L}])' + k, 'u').test(x)),
      nums = x.match(/\b\d{1,4}\b/g) || [];
    if (mon && nums.length === 1 && +nums[0] >= 1 && +nums[0] <= 31) return {ymd: [0, STMT_MONTHS[mon], +nums[0]]};
    const yr = (x.match(/\b(\d{4})\b/) || x.match(/\b(\d{2})$/) || [])[1],
      day = (x.replace(/\b\d{4}\b/, '').match(/\b(\d{1,2})\b/) || [])[1];
    if (yr && mon && day) return {ymd: [yr.length === 2 ? 2000 + +yr : +yr, STMT_MONTHS[mon], +day]};
    return null;
  }
  /* a date written without a year is the latest such day that is not in the future */
  const stmtYear = (m, d) => {
    const y = +TODAY.slice(0, 4);
    return y + '-' + pad(m) + '-' + pad(d) > TODAY ? y - 1 : y;
  };
  const stmtYmd = ([y, m, d]) =>
    m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1990 && y < 2200 ? y + '-' + pad(m) + '-' + pad(d) : null;
  /* rows: arrays of cells (header found here); isCard: card statements show purchases as debit / positive */
  function stmtParse(rows, cols, hdr, isCard, flip) {
    const body = rows.slice(hdr + 1),
      dp = body.map(r => stmtDateParts(r[cols.date]));
    const mdy = dp.some(p => p && p.ab && p.ab[1] > 12) && !dp.some(p => p && p.ab && p.ab[0] > 12);
    const lines = [];
    let closing = null;
    body.forEach((r, k) => {
      const p = dp[k],
        ymd = p ? p.ymd || (mdy ? [p.y, p.ab[0], p.ab[1]] : [p.y, p.ab[1], p.ab[0]]) : null,
        date = ymd ? stmtYmd(ymd[0] ? ymd : [stmtYear(ymd[1], ymd[2]), ymd[1], ymd[2]]) : null;
      const desc =
        cols.desc != null
          ? String(r[cols.desc] == null ? '' : r[cols.desc])
              .replace(/\s+/g, ' ')
              .trim()
          : '';
      let amt = NaN;
      if (cols.debit != null || cols.credit != null) {
        const dr = cols.debit != null ? Math.abs(stmtNum(r[cols.debit]).v || 0) : 0,
          cr = cols.credit != null ? Math.abs(stmtNum(r[cols.credit]).v || 0) : 0;
        if (dr || cr) amt = cr - dr;
      }
      if (isNaN(amt) && cols.amount != null) {
        const n = stmtNum(r[cols.amount]),
          ind = cols.dc != null ? stmtNorm(r[cols.dc]) : '';
        if (n.v) {
          const f = /^(dr|d|debit|مدين)$/.test(ind) ? 'dr' : /^(cr|c|credit|دائن)$/.test(ind) ? 'cr' : n.f;
          amt = f === 'dr' ? -Math.abs(n.v) : f === 'cr' ? Math.abs(n.v) : isCard !== !!cols.neg ? -n.v : n.v;
        }
      }
      /* opening / closing balance lines are not entries; the closing one is the statement's end balance */
      const nd = stmtNorm(desc);
      if (/opening balance|balance (b|brought)|previous balance|رصيد (اول|سابق|افتتاحي)/.test(nd)) return;
      if (/closing balance|balance (c|carried)|رصيد (ختامي|اخر|آخر)/.test(nd)) {
        if (!isNaN(amt)) closing = Math.round(amt * 100) / 100;
        return;
      }
      if (!date) {
        /* a line with text only continues the description of the line above */
        if (desc && isNaN(amt) && lines.length && lines[lines.length - 1].k === k - 1) {
          const l = lines[lines.length - 1];
          l.desc = (l.desc + ' ' + desc).trim();
          l.k = k;
        }
        return;
      }
      if (isNaN(amt) || Math.abs(amt) < 0.005) return;
      const b = cols.balance != null ? stmtNum(r[cols.balance]) : {v: NaN};
      lines.push({
        k,
        date,
        desc,
        amt: Math.round((flip ? -amt : amt) * 100) / 100,
        bal: isNaN(b.v) ? null : b.v,
        bf: b.f
      });
    });
    /* statements listed newest first are turned round so "last" means the latest */
    const desc = lines.length > 1 && lines[0].date > lines[lines.length - 1].date;
    if (desc) lines.reverse();
    /* amounts without signs: the money went in when the balance rose (the first line can only be guessed: out) */
    if (cols.sb)
      lines.forEach((l, i) => {
        const up = i && l.bal != null && lines[i - 1].bal != null ? l.bal > lines[i - 1].bal : false;
        l.amt = (up ? 1 : -1) * Math.abs(l.amt);
      });
    lines.forEach((l, i) => (l.i = i));
    const last = lines.filter(l => l.bal != null).pop();
    let endBal = last ? last.bal : null;
    const endFromClosing = endBal == null && closing != null;
    if (last && last.bf === 'dr' && endBal > 0) endBal = -endBal;
    /* a card statement shows what is owed as a positive balance; in the app that is a negative balance */
    if (isCard && endBal != null && last.bf !== 'dr') endBal = -endBal;
    /* no balance column: the closing balance line (already in the app's sign, like the amounts) */
    if (endFromClosing) endBal = closing;
    return {
      lines,
      from: lines.length ? lines.reduce((a, l) => (l.date < a ? l.date : a), lines[0].date) : null,
      to: lines.length ? lines.reduce((a, l) => (l.date > a ? l.date : a), lines[0].date) : null,
      endBal,
      endDate: last
        ? last.date
        : endFromClosing && lines.length
          ? lines.reduce((a, l) => (l.date > a ? l.date : a), lines[0].date)
          : null
    };
  }
