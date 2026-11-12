/* Reading a bank or card statement from any bank: finding the columns by their headings. (part 1 of 2) */
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
  /* a piece of text that is a number or a date (digits and separators only), as against words */
  const pdfKind = s => (/^[\s\d.,()+\-/٠-٩٫٬]+$/.test(normDigits(s)) && /\d/.test(normDigits(s)) ? 'n' : 't');
  /* an amount cell, allowing a currency or DR/CR written next to the number ("1,234.50 EGP CR") */
  const stmtIsAmt = v =>
    typeof v === 'number'
      ? isFinite(v)
      : v != null &&
        v !== '' &&
        pdfKind(
          String(v)
            .replace(/\b(egp|usd|eur|sar|aed|gbp|le|l\.e|dr|cr|debit|credit)\b\.?/gi, '')
            .replace(/ج\.?م\.?|جنيه|مدين|دائن/g, '')
            .trim()
        ) === 'n';
  /* words that name each column; a cell scores for the role whose word it contains, the best cell wins the role */
  const STMT_ROLES = {
    date: [
      ['تاريخ', 3],
      ['date', 3],
      ['dt', 3],
      ['trx', 1],
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
      ['amount', 3],
      ['value', 2],
      ['egp', 1],
      ['جنيه', 1]
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
  /* the header is the row among the first 400 that names the most columns and has a date and an amount */
  function stmtFindHeader(rows) {
    let best = null;
    rows.slice(0, 400).forEach((r, i) => {
      const c = stmtGuessCols(r),
        n = Object.keys(c).length;
      if (stmtColsOk(c) && (!best || n > best.n)) best = {i, cols: c, n};
    });
    return best;
  }
