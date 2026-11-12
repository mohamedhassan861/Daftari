/* Reading a bank or card statement from any bank: find the columns, then turn each row into {date, desc, amt, bal}. */
  /* amt is the effect on the account in the app's terms: money in is +, money out (or a card purchase) is − */
  const stmtNorm = s =>
    normDigits(String(s == null ? '' : s).normalize('NFKC'))
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[^\p{L}\p{N}/ ]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  /* words that name each column; a cell scores for the role whose word it contains, the best cell wins the role */
  const STMT_ROLES = {
    date: [
      ['تاريخ', 3],
      ['date', 3],
      ['حركه', 1],
      ['عمليه', 1],
      ['معامله', 1],
      ['transaction', 1],
      ['trans', 1],
      ['txn', 1],
      ['posting', 1],
      ['post', 1],
      ['booking', 1],
      ['قيمه', -2],
      ['value', -2],
      ['استحقاق', -2],
      ['due', -2]
    ],
    desc: [
      ['بيان', 3],
      ['وصف', 3],
      ['الوصف', 3],
      ['تفاصيل', 3],
      ['شرح', 3],
      ['description', 3],
      ['details', 3],
      ['narrative', 3],
      ['particulars', 3],
      ['remarks', 2],
      ['merchant', 2],
      ['memo', 2]
    ],
    debit: [
      ['مدين', 3],
      ['مسحوب', 3],
      ['مسحوبات', 3],
      ['سحب', 2],
      ['خصم', 2],
      ['debit', 3],
      ['debits', 3],
      ['withdrawal', 3],
      ['withdrawals', 3],
      ['dr', 2],
      ['paid out', 3],
      ['money out', 3]
    ],
    credit: [
      ['دائن', 3],
      ['ايداع', 3],
      ['ايداعات', 3],
      ['اضافه', 2],
      ['credit', 3],
      ['credits', 3],
      ['deposit', 3],
      ['deposits', 3],
      ['cr', 2],
      ['paid in', 3],
      ['money in', 3]
    ],
    amount: [
      ['مبلغ', 3],
      ['المبلغ', 3],
      ['القيمه', 2],
      ['amount', 3]
    ],
    balance: [
      ['رصيد', 3],
      ['الرصيد', 3],
      ['balance', 3]
    ],
    dc: [
      ['dr/cr', 3],
      ['cr/dr', 3],
      ['d/c', 3],
      ['نوع الحركه', 3],
      ['مدين/دائن', 3],
      ['type', 1]
    ]
  };
  function stmtRoleScore(cell, role) {
    const n = stmtNorm(cell);
    if (!n || n.length > 40) return 0;
    const words = ' ' + n + ' ';
    let s = 0;
    STMT_ROLES[role].forEach(([w, v]) => {
      if (w.length <= 3 ? words.includes(' ' + w + ' ') : n.includes(w)) s += v;
    });
    return s > 0 ? s : 0;
  }
  /* best cell for each role in one row; a cell serves one role only */
  function stmtGuessCols(row) {
    const cols = {},
      taken = new Set();
    const all = [];
    Object.keys(STMT_ROLES).forEach(role =>
      row.forEach((c, i) => {
        const s = stmtRoleScore(c, role);
        if (s) all.push([s, role, i]);
      })
    );
    all.sort((a, b) => b[0] - a[0]);
    all.forEach(([, role, i]) => {
      if (cols[role] == null && !taken.has(i)) {
        cols[role] = i;
        taken.add(i);
      }
    });
    return cols;
  }
  const stmtColsOk = c => c.date != null && (c.amount != null || c.debit != null || c.credit != null);
  /* the header is the row among the first 40 that names the most columns and has a date and an amount */
  function stmtFindHeader(rows) {
    let best = null;
    rows.slice(0, 40).forEach((r, i) => {
      const c = stmtGuessCols(r),
        n = Object.keys(c).length;
      if (stmtColsOk(c) && (!best || n > best.n)) best = {i, cols: c, n};
    });
    return best;
  }
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
    if (v instanceof Date && !isNaN(v)) return {ymd: [v.getFullYear(), v.getMonth() + 1, v.getDate()]};
    if (typeof v === 'number') {
      if (v > 20000 && v < 80000) {
        const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * 864e5);
        return {ymd: [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]};
      }
      return null;
    }
    const x = stmtNorm(v).replace(/\//g, ' / ');
    const s = normDigits(String(v)).trim();
    let m;
    if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return {ymd: [+m[1], +m[2], +m[3]]};
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)))
      return {ab: [+m[1], +m[2]], y: m[3].length === 2 ? 2000 + +m[3] : +m[3]};
    const yr = (x.match(/\b(\d{4})\b/) || x.match(/\b(\d{2})$/) || [])[1],
      mon = Object.keys(STMT_MONTHS).find(k => new RegExp('(^|[^\\p{L}])' + k, 'u').test(x)),
      day = (x.replace(/\b\d{4}\b/, '').match(/\b(\d{1,2})\b/) || [])[1];
    if (yr && mon && day) return {ymd: [yr.length === 2 ? 2000 + +yr : +yr, STMT_MONTHS[mon], +day]};
    return null;
  }
  const stmtYmd = ([y, m, d]) =>
    m >= 1 && m <= 12 && d >= 1 && d <= 31 && y > 1990 && y < 2200 ? y + '-' + pad(m) + '-' + pad(d) : null;
  /* rows: arrays of cells (header found here); isCard: card statements show purchases as debit / positive */
  function stmtParse(rows, cols, hdr, isCard, flip) {
    const body = rows.slice(hdr + 1),
      dp = body.map(r => stmtDateParts(r[cols.date]));
    const mdy = dp.some(p => p && p.ab && p.ab[1] > 12) && !dp.some(p => p && p.ab && p.ab[0] > 12);
    const lines = [];
    body.forEach((r, k) => {
      const p = dp[k],
        date = p ? stmtYmd(p.ymd || (mdy ? [p.y, p.ab[0], p.ab[1]] : [p.y, p.ab[1], p.ab[0]])) : null;
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
          amt = f === 'dr' ? -Math.abs(n.v) : f === 'cr' ? Math.abs(n.v) : isCard ? -n.v : n.v;
        }
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
    lines.forEach((l, i) => (l.i = i));
    const last = lines.filter(l => l.bal != null).pop();
    let endBal = last ? last.bal : null;
    if (last && last.bf === 'dr' && endBal > 0) endBal = -endBal;
    /* a card statement shows what is owed as a positive balance; in the app that is a negative balance */
    if (isCard && endBal != null && last.bf !== 'dr') endBal = -endBal;
    return {
      lines,
      from: lines.length ? lines.reduce((a, l) => (l.date < a ? l.date : a), lines[0].date) : null,
      to: lines.length ? lines.reduce((a, l) => (l.date > a ? l.date : a), lines[0].date) : null,
      endBal,
      endDate: last ? last.date : null
    };
  }
