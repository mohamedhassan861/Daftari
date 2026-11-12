/* Match with a bank or card statement: choose the file, read it, line up the columns. (part 1 of 2) */
  function bankMatchForm(acc) {
    const accs = S.accounts.filter(a => !isGold(a.currency));
    acc = acc && accs.includes(acc) ? acc : accs.find(a => a.type === 'bank') || accs[0];
    if (!acc) return;
    const again = STMT_CUR && STMT_CUR.acc && accOf(STMT_CUR.acc);
    openSheet(
      t('bmTitle'),
      `<div class="form"><p class="hint">${t('bmHint')}</p>
    <label class="fld"><span>${t('account')}</span><select class="in-f" id="bma">${accs.map(a => `<option value="${a.id}" ${a.id === acc.id ? 'selected' : ''}>${esc(a.name)} · ${a.currency}</option>`).join('')}</select></label>
    <label class="fld"><span>${t('bmFile')}</span><input class="in-f" type="file" id="bmf" accept=".xlsx,.xls,.xlsm,.csv,.txt,.pdf,application/pdf"></label>
    <label class="fld" id="bmpw" hidden><span>${t('bmPw')}</span><input class="in-f" type="password" id="bmpwi" autocomplete="off"></label>
    <p class="err" id="bme"></p><div id="bmx"></div>
    ${again ? `<button type="button" class="btn block" id="bmr">↻ ${t('bmAgain')} · ${esc(again.name)}</button>` : ''}</div>`,
      r => {
        const err = m => (r.querySelector('#bme').textContent = m);
        if (again) r.querySelector('#bmr').onclick = () => bankMatchRun();
        /* reading starts as soon as a file is chosen; a locked PDF asks for its password in the same place */
        const go = async () => {
          const fi = r.querySelector('#bmf'),
            accSel = r.querySelector('#bma');
          /* Enter and leaving the password box can both start a read; only one runs, on this screen only */
          if (!fi || !fi.isConnected || fi.dataset.busy) return;
          fi.dataset.busy = '1';
          try {
            await goRead(fi, accSel);
          } finally {
            delete fi.dataset.busy;
          }
        };
        const goRead = async (fi, accSel) => {
          const f = fi.files[0];
          if (!f) return;
          err(t('working'));
          r.querySelector('#bmx').innerHTML = '';
          let got;
          try {
            got = await readStmtFile(f, r.querySelector('#bmpwi').value);
          } catch (e) {
            if (e && e.name === 'PasswordException') {
              r.querySelector('#bmpw').hidden = false;
              err(r.querySelector('#bmpwi').value ? t('bmPwWrong') : t('bmPwNeed'));
              r.querySelector('#bmpwi').focus();
              return;
            }
            err(e && e.message === 'pdfTable' ? t('bmPdfFail') : t('bmBadFile'));
            return;
          }
          if (!fi.isConnected) return;
          const a = accOf(accSel.value),
            h = got.hdr;
          STMT_CUR = {acc: a.id, rows: got.rows, hdr: h ? h.i : 0, cols: h ? h.cols : {}, flip: false, name: f.name};
          if (h) {
            bankMatchRun();
            return;
          }
          /* the column screen is only a fallback, offered and never forced */
          err(t('bmNoCols'));
          r.querySelector('#bmx').innerHTML = `<button type="button" class="btn sm" id="bmman">${t('bmCols')}</button>`;
          r.querySelector('#bmman').onclick = () => bankMatchCols();
        };
        r.querySelector('#bmf').onchange = go;
        r.querySelector('#bmpwi').onkeydown = e => {
          if (e.key === 'Enter') go();
        };
        r.querySelector('#bmpwi').onchange = go;
      }
    );
  }
  /* when the columns could not be found (or were found wrong): pick the header row and each column by hand */
  function bankMatchCols() {
    const C = STMT_CUR,
      rows = C.rows,
      cut = s => String(s == null ? '' : s).slice(0, 18);
    const headOpts = rows
      .slice(0, 25)
      .map(
        (rw, i) =>
          `<option value="${i}" ${i === C.hdr ? 'selected' : ''}>${i + 1}: ${esc(
            rw
              .filter(v => v !== '')
              .map(cut)
              .join(' | ')
              .slice(0, 70)
          )}</option>`
      )
      .join('');
    const roles = [
      ['date', t('date')],
      ['desc', t('bmDesc')],
      ['debit', t('bmOut')],
      ['credit', t('bmIn')],
      ['amount', t('bmAmt')],
      ['balance', t('balCol')]
    ];
    const sels = () => {
      const head = rows[C.hdr] || [];
      return roles
        .map(
          ([k, l]) =>
            `<label class="fld"><span>${l}</span><select class="in-f" data-r="${k}"><option value="">—</option>${head.map((h, i) => `<option value="${i}" ${C.cols[k] === i ? 'selected' : ''}>${esc(cut(h) || '#' + (i + 1))}</option>`).join('')}</select></label>`
        )
        .join('');
    };
    openSheet(
      t('bmCols'),
      `<div class="form"><p class="hint">${t('bmColsHint')}</p>
    <label class="fld"><span>${t('bmHead')}</span><select class="in-f" id="bmh">${headOpts}</select></label>
    <div id="bms" class="two" style="flex-wrap:wrap">${sels()}</div><p class="err" id="bme"></p>
    <button type="button" class="btn pri block" id="bmgo">${t('bmMatch')}</button></div>`,
      r => {
        r.querySelector('#bmh').onchange = e => {
          C.hdr = +e.target.value;
          C.cols = stmtGuessCols(rows[C.hdr] || []);
          r.querySelector('#bms').innerHTML = sels();
        };
        r.querySelector('#bmgo').onclick = () => {
          const c = {};
          r.querySelectorAll('[data-r]').forEach(s => {
            if (s.value !== '') c[s.dataset.r] = +s.value;
          });
          if (!stmtColsOk(c)) {
            r.querySelector('#bme').textContent = t('needCols');
            return;
          }
          C.cols = c;
          bankMatchRun();
        };
      }
    );
  }
  /* routing choices for one bank line: categories of the right kind, or a transfer with another account in the same currency */
  function bmRouteOpts(l, accId, sel) {
    const a = accOf(accId),
      ty = l.amt < 0 ? 'expense' : 'income',
      cs = sel && sel.startsWith('cat:') ? sel.slice(4) : '',
      others = S.accounts.filter(o => o.id !== accId && o.currency === a.currency);
    return `<option value="">${t('bmPick')}</option><option value="skip" ${sel === 'skip' ? 'selected' : ''}>${t('bmSkip')}</option>
    <optgroup label="${esc(t(ty === 'expense' ? 'exp1' : 'inc1'))}">${catOptsTree(ty, cs, true).replace(/value="/g, 'value="cat:')}</optgroup>
    ${others.length ? `<optgroup label="${esc(t(l.amt < 0 ? 'bmTo' : 'bmFrom'))}">${others.map(o => `<option value="acc:${o.id}" ${sel === 'acc:' + o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</optgroup>` : ''}`;
  }
  /* a bank line + its routing → a new entry on the account (note = the bank's description) */
  function bmTx(l, route, accId) {
    const base = {id: uid(), amount: Math.abs(l.amt), date: l.date, note: (l.desc || '').slice(0, 140)};
    if (route.startsWith('acc:')) {
      const o = route.slice(4);
      return Object.assign(base, {
        type: 'transfer',
        cat: 'transfer',
        acc: l.amt < 0 ? accId : o,
        toAcc: l.amt < 0 ? o : accId
      });
    }
    return Object.assign(base, {type: l.amt < 0 ? 'expense' : 'income', acc: accId, cat: route.slice(4)});
  }
  /* changes in a closed month ask first, like any other edit there */
  function bmApply(dates, go) {
    const months = [...new Set(dates.map(d => d.slice(0, 7)))].filter(m => S.closed && S.closed[m]);
    if (months.length) closedEdit(months, go);
    else go();
  }
