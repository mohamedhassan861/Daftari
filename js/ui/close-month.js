/* The close-month screens. */
  function closedEdit(months, go, del) {
    const ml = months.map(monthLbl).join('، ');
    confirmSheet(t('closedQ').replace('%m', ml), del ? t('del') : t('editAnyway'), () => {
      const before = months.map(m => ({m, pl: monthNetPL(m), cash: monthCashNet(m)}));
      go();
      before.forEach(b => {
        S.closed[b.m] = false;
      });
      commit();
      const b = before[0],
        dpl = monthNetPL(b.m) - b.pl,
        dc = monthCashNet(b.m) - b.cash;
      CLOSE_NOTE = t('reopenedNote')
        .replace('%m', monthLbl(b.m))
        .replace('%p', (dpl >= 0 ? '+' : '−') + fmt(Math.abs(Math.round(dpl * 100) / 100)))
        .replace('%c', (dc >= 0 ? '+' : '−') + fmt(Math.abs(Math.round(dc * 100) / 100)));
      setTimeout(() => closeMonthSheet(b.m, false), 350);
    });
  }
  function closeMonthSheet(m, auto) {
    const rows = closeRows(m),
      next = Array.from({length: 6}, (_, i) => ymAdd(m, i + 1)).filter(x => x >= TODAY_YM || x === ymAdd(m, 1));
    const opt = (r, i) => {
      const mv = next.map(x => `<option value="${x}">${t('moveTo')} ${esc(monthLbl(x))}</option>`).join('');
      const cu = `<option value="custom">✎ ${t('moveCustom')}</option>`;
      if (r.kind === 'bud')
        return `<select class="in-f" data-ci="${i}"><option value="">${t('finalAmt')}</option>${cu}${mv}</select>`;
      if (r.kind === 'loan')
        return `<select class="in-f" data-ci="${i}"><option value="">${t('keepDue')}</option>${cu}${mv}</select>`;
      return `<select class="in-f" data-ci="${i}"><option value="">${t('keepDue')}</option><option value="done">${t('finalAmt')}</option><option value="waive">${t('closeWaive')}</option>${mv}</select>`;
    };
    const note = CLOSE_NOTE;
    CLOSE_NOTE = '';
    openSheet(
      t('closeTitle') + ' · ' + monthLbl(m),
      `<div class="form">${note ? `<div class="banner"><span>✎ ${esc(note)}</span></div>` : ''}<p class="hint">${rows.length ? t('closeHint') : t('closeNothing')}</p>
    ${rows
      .map(
        (r, i) =>
          `<div class="list"><div class="row"><div class="main"><span class="t">${esc(r.label)}</span><span class="s">${t('planned')} ${fmt(r.plan)} · ${t('actual')} ${fmt(r.act)} · ${t('remaining')} ${fmt(r.plan - r.act)}</span></div></div><div style="padding:0 12px 10px">${opt(r, i)}${
            r.kind === 'bud' || r.kind === 'loan'
              ? `<div data-amw="${i}" hidden style="margin-top:8px"><div class="two"><label class="fld"><span>${t('newAmt')}</span><input class="in-f num" inputmode="decimal" data-am="${i}" value="${Math.round((r.plan - r.act) * 100) / 100}"></label>
      <label class="fld"><span>${t('toMonth')}</span><select class="in-f" data-mo="${i}">${next
        .filter(x => x > m)
        .map(x => `<option value="${x}">${esc(monthLbl(x))}</option>`)
        .join('')}</select></label></div><p class="hint" style="margin:4px 0 0" data-ah="${i}"></p></div>`
              : ''
          }</div></div>`
      )
      .join('')}
    <div class="foot">${auto ? `<button type="button" class="btn grow" id="cLater">${t('later')}</button>` : ''}<button type="button" class="btn pri grow" id="cGo">${t('closeBtn')}</button></div></div>`,
      r => {
        const remOf = i => Math.round((rows[i].plan - rows[i].act) * 100) / 100,
          amOf = i => {
            const e = r.querySelector(`[data-am="${i}"]`);
            return e ? parseFloat(normDigits(e.value).replace(/,/g, '')) : NaN;
          };
        const lastM = l => {
          const sc = loanSched(l);
          return sc.length ? sc[sc.length - 1].m : m;
        };
        const hint = i => {
          const h = r.querySelector(`[data-ah="${i}"]`);
          if (!h) return;
          const R = remOf(i),
            X = amOf(i),
            row = rows[i];
          if (!(X > 0)) {
            h.textContent = '';
            return;
          }
          const d = Math.round((R - X) * 100) / 100;
          if (row.kind === 'loan') {
            const L = S.loans.find(x => x.id === row.id);
            h.textContent =
              X > R + 0.004
                ? t('loanCustomMax').replace('%v', fmt(R))
                : Math.abs(d) < 0.005
                  ? ''
                  : t('loanCustomRest')
                      .replace('%v', fmt(d))
                      .replace('%m', monthLbl(ymAdd(lastM(L), 1)));
          } else h.textContent = d > 0.004 ? t('budCustomRest').replace('%v', fmt(d)) : '';
        };
        r.querySelectorAll('[data-ci]').forEach(sel => {
          const i = sel.dataset.ci,
            w = r.querySelector(`[data-amw="${i}"]`);
          if (!w) return;
          sel.addEventListener('change', () => {
            w.hidden = sel.value !== 'custom';
            hint(i);
          });
          r.querySelector(`[data-am="${i}"]`).addEventListener('input', () => hint(i));
        });
        const lt = r.querySelector('#cLater');
        if (lt)
          lt.onclick = () => {
            closeSheet();
            try {
              sessionStorage.setItem('daftari-close-later', m);
            } catch (e) {}
          };
        r.querySelector('#cGo').onclick = () => {
          const picks = [...r.querySelectorAll('[data-ci]')].map(sel => {
            const i = sel.dataset.ci,
              mo = r.querySelector(`[data-mo="${i}"]`);
            return {dataset: sel.dataset, value: sel.value, amt: amOf(i), to: mo ? mo.value : ''};
          });
          if (picks.some(p => p.value === 'custom' && !(p.amt > 0))) {
            toast(t('needAmt'));
            return;
          }
          if (
            picks.some(
              p => p.value === 'custom' && rows[+p.dataset.ci].kind === 'loan' && p.amt > remOf(+p.dataset.ci) + 0.004
            )
          ) {
            toast(t('loanCustomMax').replace('%v', ''));
            return;
          }
          authGate(t('closeTitle') + ' · ' + monthLbl(m), () => {
            picks.forEach(sel => {
              const row = rows[+sel.dataset.ci],
                v = sel.value;
              if (!v) return;
              if (row.kind === 'obl') {
                const o = (row.k === 'inst' ? S.inst : S.gam).find(x => x.id === row.id);
                if (!o) return;
                if (v === 'done') {
                  if (!o.paid.includes(row.x)) o.paid.push(row.x);
                  if (o.part) delete o.part[row.x];
                } else if (v === 'waive') {
                  o.waived = o.waived || {};
                  o.waived[row.x] = Math.round((oblPer(row.k, o) - partOf(o, row.x)) * 100) / 100;
                  if (!o.paid.includes(row.x)) o.paid.push(row.x);
                  if (o.part) delete o.part[row.x];
                  logTx('waive', null, {
                    date: TODAY,
                    type: 'waive',
                    amount: o.waived[row.x],
                    cat: row.k,
                    note: o.name + ' · ' + monthShort(row.x)
                  });
                } else {
                  o.moved = o.moved || {};
                  o.moved[row.x] = v;
                }
              } else if (row.kind === 'loan' && v === 'custom') {
                const l = S.loans.find(x => x.id === row.id);
                if (!l) return;
                const R = Math.round((row.plan - row.act) * 100) / 100,
                  X = Math.round(sel.amt * 100) / 100,
                  end = ymAdd((loanSched(l).slice(-1)[0] || {m}).m, 1);
                l.adj = l.adj || [];
                l.adj.push({m, amount: -R}, {m: sel.to, amount: X});
                if (R - X > 0.004) l.adj.push({m: end, amount: Math.round((R - X) * 100) / 100});
              } else if (row.kind === 'loan') {
                const l = S.loans.find(x => x.id === row.id);
                if (!l) return;
                if (l.plan === 'inst') {
                  const [a, b] = [m, v].map(z => z.split('-').map(Number)),
                    d = (b[0] - a[0]) * 12 + b[1] - a[1];
                  l.instStart = ymAdd(l.instStart, d);
                } else l.due = v;
              } else if (row.kind === 'bud')
                S.planAdj.push({
                  m: v === 'custom' ? sel.to : v,
                  cat: row.cat,
                  amount:
                    v === 'custom' ? Math.round(sel.amt * 100) / 100 : Math.round((row.plan - row.act) * 100) / 100,
                  label: catName(row.cat) + ' · ' + t('carriedFrom') + ' ' + monthShort(m),
                  from: m
                });
            });
            S.closed[m] = true;
            closeSheet();
            commit(t('closedMsg'));
            if (!drv.sumOff) setTimeout(() => saveMonthSummary(m, false), 1500);
          });
        };
      }
    );
  }
  /* protected step: confirm with fingerprint or PIN before it happens */
  function authGate(title, go) {
    const hasBio = !!bioInfo();
    openSheet(
      title,
      `<form class="form" id="agF"><p class="hint" style="text-align:center">🔒 ${t('authNeed')}</p>
    ${hasBio ? `<button type="button" class="biobtn" id="agBio" aria-label="${t('bioUnlock')}">${FP_SVG}</button>` : ''}
    <input class="in-f pin" type="password" inputmode="numeric" autocomplete="off" id="gPin" placeholder="${t('pinW')}" aria-label="${t('pinW')}">
    <p class="err" id="agE"></p><div class="foot"><button type="button" class="btn grow" id="agX">${t('cancel')}</button><button class="btn pri grow">${t('confirm')}</button></div></form>`,
      r => {
        const ok = () => {
          closeSheet();
          go();
        };
        r.querySelector('#agX').onclick = () => closeSheet();
        r.querySelector('#agF').onsubmit = e => {
          e.preventDefault();
          if (r.querySelector('#gPin').value === PINMEM) ok();
          else {
            r.querySelector('#agE').textContent = t('wrongPin');
            r.querySelector('#gPin').value = '';
          }
        };
        const b = r.querySelector('#agBio');
        if (b)
          b.onclick = async () => {
            try {
              const pin = await bioUnlockPin();
              if (pin === PINMEM) ok();
              else throw 0;
            } catch (x) {
              r.querySelector('#agE').textContent = t('bioFail');
            }
          };
      }
    );
  }
  function maybeAskClose() {
    if (!S || ACT !== 'me') return;
    const m = ymAdd(TODAY_YM, -1);
    if (m < S.closeFrom || S.closed[m]) return;
    try {
      if (sessionStorage.getItem('daftari-close-later') === m) return;
    } catch (e) {}
    if (!closeRows(m).length) {
      S.closed[m] = true;
      save();
      return;
    }
    setTimeout(() => {
      if (S && $('#sheet').hidden) closeMonthSheet(m, true);
    }, 900);
  }

  /* one category in plan vs actual: where the planned amount comes from, and what actually happened */
  function planCatSheet(root, ty) {
    const months = perMonths(),
      pl = [],
      ac = [],
      onCard = id => {
        const a = accById(id);
        return a && a.type === 'card' ? a : null;
      };
    months.forEach(m => {
      planItems(m)
        .filter(x => x.type === ty && catRoot(x.cat) === root)
        .forEach(x => pl.push(Object.assign({m}, x)));
      txOf(m)
        .filter(x => x.type === ty && catRoot(x.cat) === root)
        .forEach(x => ac.push(x));
    });
    const tp = pl.filter(x => !onCard(x.acc)).reduce((v, x) => v + x.amount, 0),
      ta = ac.filter(x => isLiquid(accOf(x.acc))).reduce((v, x) => v + baseAmt(x), 0),
      d = ty === 'income' ? ta - tp : tp - ta;
    const multi = months.length > 1,
      cardNote = `<small class="muted"> · ${t('inCardPay')}</small>`;
    openSheet(
      catName(root) + ' · ' + perLabel(),
      `<div class="form">
    <div class="blk plan"><div class="blk-h"><span>● ${t('planned')}</span><b>${money(tp)}</b></div><div style="padding:0 14px 8px">${
      pl.length
        ? pl
            .map(x => {
              const c = onCard(x.acc);
              return `<div class="ln" style="${c ? 'opacity:.6' : ''}"><span>${esc(x.label || catName(x.cat))}${multi ? ' · ' + esc(monthShort(x.m)) : ''}${x.done ? ' ✓' : ''}${c ? ' 💳' + cardNote : ''}</span><b>${money(x.amount)}</b></div>`;
            })
            .join('')
        : `<div class="ln"><span>${t('noItems')}</span></div>`
    }</div></div>
    <div class="blk act"><div class="blk-h"><span>● ${t('actual')}</span><b>${money(ta)}</b></div><div style="padding:0 14px 8px">${
      ac.length
        ? ac
            .sort((a, b) => a.date.localeCompare(b.date))
            .map(x => {
              const a = accOf(x.acc),
                c = a && a.type === 'card';
              return `<div class="ln" style="${c ? 'opacity:.6' : ''}"><span>${esc(shortDate(x.date))} · ${esc(x.note || catName(x.cat))}${a ? ' · ' + esc(a.name) : ''}${c ? ' 💳' + cardNote : ''}</span><b>${money(baseAmt(x))}</b></div>`;
            })
            .join('')
        : `<div class="ln"><span>${t('noItems')}</span></div>`
    }</div></div>
    <div class="blk"><div class="blk-h"><span>${t('variance')}</span><b class="${d < -0.5 ? 'neg' : d > 0.5 ? 'pos' : ''}">${d > 0.5 ? '+' : ''}${money(d)}</b></div><p class="hint" style="padding:0 14px">${t('planCatHint')}</p></div>
    <button type="button" class="btn block" id="pcStmt">${t('statement')} ›</button></div>`,
      r => {
        r.querySelector('#pcStmt').onclick = () => catStmt(root);
      }
    );
  }
