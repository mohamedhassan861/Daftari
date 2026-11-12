/* Match with a bank or card statement: the result and its actions. (part 2 of 2; continues from stmt-match-1.js) */
  function bankMatchRun() {
    const C = STMT_CUR,
      a = C && accOf(C.acc);
    if (!a) return;
    const isCard = a.type === 'card',
      P = stmtParse(C.rows, C.cols, C.hdr, isCard, C.flip);
    if (!P.lines.length) {
      toast(t('bmNoLines'));
      bankMatchCols();
      return;
    }
    const M = stmtMatch(P.lines, S.tx, a.id, isCard),
      sum = v => Math.round(v.reduce((s, n) => s + n, 0) * 100) / 100,
      bOnly = sum(M.bankOnly.map(l => l.amt)),
      aOnly = sum(M.appOnly.map(x => accEffect(x, a.id))),
      dm = d => dmyOf(dsDate(d)),
      sg = v => (v < 0 ? '−' : v > 0 ? '+' : '') + fmt(Math.abs(v)),
      amt = v => `<b class="amt ${v > 0 ? 'pos' : 'neg'}">${v > 0 ? '+' : '−'}${fmt(Math.abs(v))}</b>`,
      bal = v =>
        isCard
          ? v < 0
            ? t('stOwe') + ' ' + fmt(-v)
            : t('stCredit') + ' ' + fmt(v)
          : (v < 0 ? '−' : '') + fmt(Math.abs(v));
    let balHTML = '';
    if (P.endBal != null) {
      const ab = Math.round(accBalanceAt(a, P.endDate) * 100) / 100,
        diff = Math.round((P.endBal - ab) * 100) / 100,
        rest = Math.round((diff - bOnly + aOnly) * 100) / 100;
      balHTML = `<div class="list"><div class="cmp" style="grid-template-columns:1.4fr 1fr"><span>${t('bmBankBal')} ${dm(P.endDate)}</span><b class="num">${bal(P.endBal)}</b></div>
      <div class="cmp" style="grid-template-columns:1.4fr 1fr"><span>${t('bmAppBal')}</span><b class="num">${bal(ab)}</b></div>
      <div class="cmp" style="grid-template-columns:1.4fr 1fr"><span>${t('bmDiff')}</span><b class="num ${Math.abs(diff) < 0.01 ? 'pos' : 'neg'}">${Math.abs(diff) < 0.01 ? '✓ 0' : sg(diff)}</b></div></div>
      ${Math.abs(diff) >= 0.01 ? `<p class="hint">${t('bmDiffWhy').replace('%b', sg(bOnly)).replace('%a', sg(aOnly)).replace('%r', sg(rest))}${Math.abs(rest) >= 0.01 ? ' ' + t('bmRestHint') : ''}</p>` : ''}`;
    }
    const sec = (k, title, n, body, open) =>
      n
        ? `<details class="box" ${open ? 'open' : ''} data-bm="${k}"><summary><h2>${title} <span class="muted">(${n})</span></h2></summary>${body}</details>`
        : '';
    const lineRow = (l, sel) =>
      `<div class="row"><div class="main"><span class="t">${esc(l.desc || '—')}</span><span class="s">${dm(l.date)}</span>${sel || ''}</div>${amt(l.amt)}</div>`;
    const bankBody = `<div class="list">${M.bankOnly
      .map(l =>
        lineRow(
          l,
          `<select class="in-f" style="margin-top:6px" data-bl="${l.i}">${bmRouteOpts(l, a.id, stmtSuggest(l, a.id))}</select>`
        )
      )
      .join(
        ''
      )}</div><button type="button" class="btn pri block" id="bmadd" style="margin-top:8px">${t('bmAdd')}</button>`;
    const route0 = x => (x.type === 'transfer' ? 'acc:' + (x.acc === a.id ? x.toAcc : x.acc) : 'cat:' + x.cat);
    const groupBody = M.groups
      .map(
        (
          g,
          gi
        ) => `<div class="list" style="margin-bottom:10px"><div class="grp"><span>${dm(g.x.date)} · ${esc(g.x.note || catPath(g.x.cat) || '')}</span>${amt(accEffect(g.x, a.id))}</div>
        ${g.lines.map(l => lineRow(l, g.x.link ? '' : `<select class="in-f" style="margin-top:6px" data-gl="${gi}">${bmRouteOpts(l, a.id, stmtSuggest(l, a.id) || route0(g.x))}</select>`)).join('')}
        ${g.x.link ? `<p class="hint" style="padding:0 12px">${t('bmLinked')}</p>` : `<div class="acts" style="padding:8px 12px"><button type="button" class="btn sm pri" data-split="${gi}">${t('bmSplit')} (${g.lines.length})</button></div>`}</div>`
      )
      .join('');
    const appBody = `<p class="hint">${t('bmAppOnlyHint')}</p><div class="list">${M.appOnly
      .map(
        x =>
          `<div class="row tap" data-sact="tx" data-id="${x.id}"><div class="main"><span class="t">${esc(x.note || catPath(x.cat) || '')}</span><span class="s">${dm(x.date)}</span></div>${amt(accEffect(x, a.id))}</div>`
      )
      .join('')}</div>`;
    const okBody = `<div class="list">${M.pairs
      .map(p => lineRow(p.l))
      .concat(M.many.map(m => lineRow(m.l, `<span class="s">${t('bmMany').replace('%n', m.xs.length)}</span>`)))
      .join('')}</div>`;
    openSheet(
      t('bmTitle') + ' · ' + a.name,
      `<div class="form"><p class="hint">${t('bmRead').replace('%n', P.lines.length).replace('%f', dm(P.from)).replace('%t', dm(P.to))} · <span dir="auto">${esc(C.name || '')}</span></p>
    ${balHTML}
    ${sec('bank', '➕ ' + t('bmBankOnly'), M.bankOnly.length, bankBody, true)}
    ${sec('grp', '🧩 ' + t('bmGroups'), M.groups.length, groupBody, true)}
    ${sec('app', '❓ ' + t('bmAppOnly'), M.appOnly.length, appBody)}
    ${sec('ok', '✓ ' + t('bmOk'), M.pairs.length + M.many.length, okBody)}
    ${!M.bankOnly.length && !M.groups.length && !M.appOnly.length ? `<div class="empty">✓ ${t('bmAllOk')}</div>` : ''}
    <div class="acts"><button type="button" class="btn sm" id="bmcols">${t('bmCols')}</button><button type="button" class="btn sm" id="bmflip">⇅ ${t('bmFlip')}</button></div></div>`,
      r => {
        r.querySelector('#bmcols').onclick = () => bankMatchCols();
        r.querySelector('#bmflip').onclick = () => {
          C.flip = !C.flip;
          bankMatchRun();
        };
        const add = r.querySelector('#bmadd');
        if (add)
          add.onclick = () => {
            const news = [];
            r.querySelectorAll('[data-bl]').forEach(s => {
              if (!/^(cat|acc):/.test(s.value)) return;
              news.push(bmTx(P.lines[+s.dataset.bl], s.value, a.id));
            });
            if (!news.length) {
              toast(t('bmNone'));
              return;
            }
            bmApply(
              news.map(x => x.date),
              () => {
                news.forEach(x => {
                  S.tx.push(x);
                  logTx('add', null, x);
                });
                commit(t('bmAdded').replace('%n', news.length));
                bankMatchRun();
              }
            );
          };
        r.querySelectorAll('[data-split]').forEach(
          b =>
            (b.onclick = () => {
              const g = M.groups[+b.dataset.split],
                sels = [...r.querySelectorAll(`[data-gl="${b.dataset.split}"]`)];
              if (sels.some(s => !/^(cat|acc):/.test(s.value))) {
                toast(t('bmSplitAll'));
                return;
              }
              const news = sels.map((s, i) => bmTx(g.lines[i], s.value, a.id));
              confirmSheet(
                t('bmSplitQ')
                  .replace('%n', news.length)
                  .replace('%a', fmt(Math.abs(accEffect(g.x, a.id)))),
                t('bmSplit'),
                () =>
                  bmApply([g.x.date].concat(news.map(x => x.date)), () => {
                    delTx(g.x.id);
                    news.forEach(x => {
                      S.tx.push(x);
                      logTx('add', null, x);
                    });
                    commit(t('bmSplitDone'));
                    bankMatchRun();
                  })
              );
            })
        );
      }
    );
  }
