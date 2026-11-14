/* Repeat screens: the popup when the app opens, record now, remind later, and the repeat settings. */
  function showRecPopup() {
    const Q = recQueue();
    if (!Q.length || (!$('#sheet').hidden && !$('#shB').querySelector('[data-rq]'))) return;
    const {r, due} = Q[0],
      a = accOf(r.tpl.acc),
      e = recEff(r);
    let more = 0,
      d = advance(r.next, r.freq, r.day),
      g = 0;
    if (due)
      while (d <= TODAY && g++ < 400 && (!r.end || d <= r.end)) {
        more++;
        d = advance(d, r.freq, r.day);
      }
    openSheet(
      '↻ ' + t('recPopT'),
      `<div class="form" data-rq="1"><div class="banner" style="background:var(--accent-soft)"><span>${due ? (e < TODAY ? t('recPopLate') : t('recPopToday')) : t('recPopSoon').replace('%d', shortDate(e))}</span></div>
    <div class="list"><div class="row"><div class="main"><span class="t">${esc(r.tpl.note || (r.tpl.type === 'transfer' ? t('transfer') : catPath(r.tpl.cat)))}</span><span class="s">${esc(a.name)} · ${esc(freqName(r.freq))}</span></div><b class="amt ${r.tpl.type === 'income' ? 'pos' : ''}">${moneyC(+r.tpl.amount, a.currency)}</b></div>
    <div class="row"><div class="main"><span class="t">${t('recDue')}</span></div><b>${esc(shortDate(e))}</b></div>${r.snooze && r.snooze[r.next] ? `<div class="row"><div class="main"><span class="s">${t('recWasLater')} · ${t('recOrig')} ${esc(shortDate(r.next))}</span></div></div>` : ''}${more ? `<div class="row"><div class="main"><span class="s">${t('recMore').replace('%n', more)}</span></div></div>` : ''}</div>
    <button class="btn pri block" id="rqDo">✓ ${due ? t('recDo') : t('recDoNow')}</button>
    ${due ? '' : `<button class="btn block" id="rqAck">🔔 ${t('recRemindOnDay').replace('%d', shortDate(e))}</button>`}
    <button class="btn block" id="rqLater">⏰ ${t('recLater')}</button>
    ${due ? `<button class="btn block" id="rqSkip" style="color:var(--muted)">${t('recSkip')}</button>` : ''}
    <div class="foot"><button class="btn grow" id="rqClose">${t('later')}${Q.length > 1 ? ' · ' + t('recLeft').replace('%n', Q.length) : ''}</button></div></div>`,
      f => {
        f.querySelector('#rqDo').onclick = () => recDoSheet(r.id);
        f.querySelector('#rqLater').onclick = () => recLaterSheet(r.id);
        const sk = f.querySelector('#rqSkip');
        if (sk) sk.onclick = () => recSkip(r.id);
        const ak = f.querySelector('#rqAck');
        if (ak)
          ak.onclick = () => {
            r.ack = r.ack || {};
            r.ack[r.next] = 1;
            save();
            closeSheet();
            setTimeout(showRecPopup, 250);
          };
        f.querySelector('#rqClose').onclick = () => {
          Q.forEach(q => REC_LATER.add(q.r.id + q.r.next));
          closeSheet();
        };
      }
    );
  }
  function recDoSheet(id) {
    const r = S.recur.find(x => x.id === id);
    if (!r) return;
    const occ = r.next,
      ovm = ((S.planOver || {})[occ.slice(0, 7)] || {})['rec:' + r.id],
      accs = S.accounts.filter(a => a.type !== 'gold');
    openSheet(
      t('recDo') + ' · ' + (r.tpl.note || catPath(r.tpl.cat)),
      `<form class="form" id="f"><p class="hint">${esc(freqName(r.freq))} · ${t('recDue')} ${esc(shortDate(occ))}</p>
    <div class="two"><label class="fld"><span>${t('amount')}</span><input class="in-f amt num" id="amt" inputmode="decimal" value="${ovm > 0 ? ovm : r.tpl.amount}"></label>
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${occ < TODAY || recEff(r) > TODAY ? TODAY : occ}"></label></div>
    <label class="fld"><span>${t('account')}</span><select class="in-f" id="ac">${accs.map(a => `<option value="${a.id}" ${a.id === r.tpl.acc ? 'selected' : ''}>${esc(a.name)} · ${a.currency}</option>`).join('')}</select></label>
    <label class="fld"><span>${t('note')}</span><input class="in-f" id="nt" value="${esc(r.tpl.note || '')}"></label>
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,
      f => {
        f.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const a = numv(f, 'amt');
          if (!(a > 0)) {
            toast(t('needAmt'));
            return;
          }
          const tx = Object.assign({}, r.tpl, {
            id: 'R' + r.id + '_' + occ,
            date: val(f, 'dt') || TODAY,
            rec: r.id,
            amount: a,
            acc: val(f, 'ac'),
            note: val(f, 'nt')
          });
          const go = () => {
            S.tx.push(tx);
            logTx('add', null, tx);
            recAdvance(r);
            closeSheet();
            commit(t('saved'));
            runRecurring();
            setTimeout(showRecPopup, 350);
          };
          if (S.closed && S.closed[tx.date.slice(0, 7)]) closedEdit([tx.date.slice(0, 7)], go);
          else go();
        };
      }
    );
  }
  function recLaterSheet(id) {
    const r = S.recur.find(x => x.id === id);
    if (!r) return;
    const tm = iso(new Date(dOf(TODAY).getTime() + 864e5)),
      def = r.next > TODAY ? r.next : tm;
    openSheet(
      t('recLater'),
      `<form class="form" id="f"><p class="hint">${t('recLaterHint')}</p><label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${def}" min="${tm}"></label>
    <div class="chips" style="padding:0">${[
      [1, t('tomorrow')],
      [3, '+3'],
      [7, '+7']
    ]
      .map(
        ([n, l]) =>
          `<button type="button" class="chip" style="cursor:pointer;background:none" data-dd="${n}">${l}</button>`
      )
      .join('')}</div>
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,
      f => {
        f.querySelectorAll('[data-dd]').forEach(
          b =>
            (b.onclick = () => {
              f.querySelector('#dt').value = iso(new Date(dOf(TODAY).getTime() + +b.dataset.dd * 864e5));
            })
        );
        f.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const d = val(f, 'dt');
          if (!d || d <= TODAY) {
            toast(t('recLaterPick'));
            return;
          }
          r.snooze = r.snooze || {};
          r.snooze[r.next] = d;
          if (r.ack) delete r.ack[r.next];
          closeSheet();
          commit(t('recLaterDone').replace('%d', shortDate(d)));
          setTimeout(showRecPopup, 350);
        };
      }
    );
  }
  function recSkip(id) {
    const r = S.recur.find(x => x.id === id);
    if (!r) return;
    confirmSheet(t('recSkipQ').replace('%d', shortDate(r.next)), t('recSkip'), () => {
      logTx('skip', null, {date: r.next, type: 'skip', amount: +r.tpl.amount, cat: r.tpl.cat, note: r.tpl.note || ''});
      recAdvance(r);
      commit(t('saved'));
      setTimeout(showRecPopup, 350);
    });
  }
  /* the repeat picker: a number and a unit, with quick choices */
  function freqFields(cur, none, lead, end) {
    const f = cur ? parseFreq(cur) : {n: 1, u: ''},
      U = [
        ['d', t('uDay')],
        ['w', t('uWeek')],
        ['m', t('uMonth')],
        ['y', t('uYear')]
      ];
    return `<div class="fld"><span>${t('repeat')}</span><div style="display:flex;gap:8px;align-items:center"><span class="muted" style="flex:none">${t('everyW')}</span><input class="in-f num" id="fqn" inputmode="numeric" value="${f.n}" style="width:72px;flex:none;text-align:center" ${cur || !none ? '' : 'disabled'}><select class="in-f" id="fqu" style="flex:1">${none ? `<option value="" ${cur ? '' : 'selected'}>${t('noRepeat')}</option>` : ''}${U.map(([v, l]) => `<option value="${v}" ${v === f.u ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="chips" style="padding:6px 0 0" id="fqc">${[['1:d'], ['1:w'], ['2:w'], ['1:m'], ['3:m'], ['1:y']].map(([v]) => `<button type="button" class="chip" style="cursor:pointer;background:none" data-fq="${v}">${esc(freqName(v))}</button>`).join('')}</div><span class="hint" id="fqh" style="margin:0"></span></div>${
      lead !== undefined
        ? `<div id="fqx" class="two" ${cur ? '' : 'hidden'}><label class="fld"><span>${t('remLead')}</span><select class="in-f" id="rl"><option value="">${t('remDefault')}</option>${[0, 1, 2, 3, 7].map(d => `<option value="${d}" ${String(lead) === String(d) ? 'selected' : ''}>${d ? d + ' ' + t('daysW') : t('sameDay')}</option>`).join('')}</select></label>
    <label class="fld"><span>${t('endOn')}</span><input class="in-f" type="date" id="ren" value="${end || ''}"></label></div>`
        : ''
    }`;
  }
  function bindFreq(r, dateOf) {
    const n = r.querySelector('#fqn'),
      u = r.querySelector('#fqu'),
      h = r.querySelector('#fqh');
    if (!n) return;
    const rl = r.querySelector('#rl'),
      x = r.querySelector('#fqx');
    const upd = () => {
      n.disabled = !u.value;
      if (x) x.hidden = !u.value;
      const f = readFreq(r);
      if (!f) {
        h.textContent = '';
        return;
      }
      const d0 = dateOf() || TODAY,
        nx = advance(d0, f, +d0.slice(8, 10)),
        ld = rl && rl.value !== '' ? +rl.value : remTime().lead,
        rd = iso(new Date(dOf(nx).getTime() - ld * 864e5));
      h.textContent =
        freqName(f) +
        ' · ' +
        t('nextOn') +
        ': ' +
        shortDate(nx) +
        (rl ? ' · ' + t('recWillRemind').replace('%d', shortDate(rd)) : '');
    };
    u.onchange = upd;
    n.oninput = upd;
    if (rl) rl.onchange = upd;
    r.querySelector('#fqc').onclick = e => {
      const b = e.target.closest('[data-fq]');
      if (!b) return;
      const p = parseFreq(b.dataset.fq);
      n.value = p.n;
      u.value = p.u;
      upd();
    };
    upd();
    return upd;
  }
  const readFreq = r => {
    const u = r.querySelector('#fqu'),
      n = r.querySelector('#fqn');
    if (!u || !u.value) return '';
    const k = Math.min(366, Math.max(1, parseInt(normDigits(n.value)) || 1));
    return k + ':' + u.value;
  };
  function recRuleForm(r) {
    openSheet(
      t('recurring'),
      `<form class="form" id="f">
    <p class="hint">${esc(r.tpl.note || catPath(r.tpl.cat))} · ${esc(accOf(r.tpl.acc).name)}</p>
    <div class="two"><label class="fld"><span>${t('amount')} (${esc(curName(accOf(r.tpl.acc).currency))})</span><input class="in-f amt num" id="amt" inputmode="decimal" value="${r.tpl.amount}"></label>
    </div>${freqFields(r.freq, false, r.lead == null ? '' : r.lead, r.end || '')}
    <p class="hint" style="margin:0">${t('recAskHint')}</p>
    <label class="fld"><span>${t('nextOn')}</span><input class="in-f" type="date" id="nx" value="${r.next}"></label>
    <div class="foot"><button type="button" class="btn danger" id="del">${t('stopRec')}</button><button class="btn pri grow">${t('save')}</button></div></form>`,
      rr => {
        bindFreq(rr, () => val(rr, 'nx'));
        rr.querySelector('#nx').addEventListener('change', () => bindFreq(rr, () => val(rr, 'nx')));
        rr.querySelector('#del').onclick = () =>
          confirmSheet(t('stopRecQ'), t('stopRec'), () => {
            S.recur = S.recur.filter(x => x.id !== r.id);
            commit(t('saved'));
          });
        rr.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          const a = numv(rr, 'amt');
          if (a <= 0) {
            toast(t('needAmt'));
            return;
          }
          r.tpl.amount = a;
          r.freq = readFreq(rr) || r.freq;
          {
            const lv = val(rr, 'rl');
            if (lv === '') delete r.lead;
            else r.lead = +lv;
          }
          r.next = val(rr, 'nx') || r.next;
          r.day = +r.next.slice(8, 10);
          r.end = val(rr, 'ren') || null;
          closeSheet();
          commit(t('saved'));
          runRecurring();
        };
      }
    );
  }
