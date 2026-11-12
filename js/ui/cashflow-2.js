/* Cash-flow, forecast and number-breakdown screens. (part 2 of 2; continues from cashflow-1.js) */
  /* today's rates and a day-by-day list (from the saved daily rates) */
  function ratesHTML() {
    const H = S.rateHist || {},
      days = Object.keys(H).sort().reverse().slice(0, 60),
      cs = ['USD', 'SAR', 'EUR', 'G21', 'G24'].filter(c => c !== BASE()),
      nm = c => (isGold(c) ? t('goldG') + ' ' + c.slice(1) : c);
    const usd = d => (H[d] || {}).USD || 0,
      cell = (d, c) => {
        const v = (H[d] || {})[c];
        return v ? fmt(v) : '—';
      };
    const now = c => (S.rates[c] ? fmt(S.rates[c]) : '—'),
      g21u = S.rates.G21 && S.rates.USD ? fmt(Math.round((S.rates.G21 / S.rates.USD) * 100) / 100) : '—';
    return `<section class="sec"><div class="sec-h"><h2>💱 ${t('ratesT')}</h2><span class="muted">$ ${now('USD')} · ${t('goldG')} 21: ${now('G21')}</span></div>
    <p class="hint">${t('ratesHint')} ${S.ratesAt ? t('ratesAtL') + ' ' + esc(dateOf(new Date(S.ratesAt))) + ' ' + hmOf(new Date(S.ratesAt)) : ''}${S.goldManual ? ' · ' + t('goldManualOn') : ''}</p>
    <div class="list"><div class="cmp h" style="grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr))"><span>${t('item')}</span><span>${esc(BASE())}</span><span>$</span></div>
      ${cs.map(c => `<div class="cmp" style="grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr))"><span>${esc(nm(c))}${isGold(c) ? ' / ' + t('gram') : ''}</span><b>${now(c)}</b><span>${c === 'USD' ? '1' : S.rates[c] && S.rates.USD ? fmt(Math.round((S.rates[c] / S.rates.USD) * 10000) / 10000) : '—'}</span></div>`).join('')}</div>
    ${
      S.rates.G24
        ? (() => {
            const g = S.rates.G24,
              u = S.rates.USD || 0,
              gk = k => S.rates['G' + k] || (g * k) / 24,
              row = (l, v, s2) =>
                `<div class="cmp" style="grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr))"><span>${l}${s2 ? `<small class="muted" style="display:block;font-size:11px">${s2}</small>` : ''}</span><b>${fmt(Math.round(v))}</b><span>${u ? fmt(Math.round((v / u) * 100) / 100) : '—'}</span></div>`;
            return `<div class="grp" style="margin-top:8px;border-radius:12px 12px 0 0"><span>🪙 ${t('goldPrices')}</span></div><div class="list" style="border-radius:0 0 12px 12px">
        <div class="cmp h" style="grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr))"><span>${t('item')}</span><span>${esc(BASE())}</span><span>$</span></div>
        <div class="grp"><span>${t('perGram')}</span></div>
        ${[24, 21, 18, 14].map(k => row(t('goldK').replace('%k', k), gk(k))).join('')}
        ${row(t('ounce'), g * 31.1035, '31.1 ' + t('gram') + ' · ' + t('goldK').replace('%k', 24))}
        <div class="grp"><span>${t('goldPound')} · ${t('goldK').replace('%k', 21)}</span></div>
        ${row(t('goldPoundQ'), gk(21) * 2, '2 ' + t('gram'))}${row(t('goldPoundHalf'), gk(21) * 4, '4 ' + t('gram'))}${row(t('goldPound'), gk(21) * 8, '8 ' + t('gram'))}${row(t('goldPound5'), gk(21) * 40, '40 ' + t('gram'))}
        <div class="grp"><span>${t('bar').replace('%w', '').trim()} · ${t('goldK').replace('%k', 24)}</span></div>
        ${[0.25, 0.5, 1, 2.5, 5, 10, 15.55, 20, 25, 31.1, 50, 100, 250, 1000].map(w => row(w === 31.1 ? t('barOz') : t('bar').replace('%w', w >= 1000 ? '1 ' + t('kilo') : w + ' ' + t('gram')), g * w, w === 31.1 ? '31.1 ' + t('gram') : '')).join('')}
      </div><p class="hint">${t('goldRawNote')}</p>`;
          })()
        : ''
    }
    <div class="acts"><button class="btn sm pri" data-act="ratesNow">↻ ${t('ratesNow')}</button><button class="btn sm" data-act="rates">✎ ${t('ratesManual')}</button></div>
    ${days.length ? `<div class="tblw" style="max-height:50vh"><table class="stmt"><thead><tr><th>${t('date')}</th>${cs.map(c => `<th>${esc(nm(c))}</th>`).join('')}<th>${t('goldG')} 21 $</th></tr></thead><tbody>${days.map(d => `<tr><td class="d">${esc(shortDate(d))}</td>${cs.map(c => `<td class="n">${cell(d, c)}</td>`).join('')}<td class="n">${(H[d] || {}).G21 && usd(d) ? fmt(Math.round((H[d].G21 / usd(d)) * 100) / 100) : '—'}</td></tr>`).join('')}</tbody></table></div>` : `<p class="hint">${t('ratesNoHist')}</p>`}
    <p class="hint">${t('ratesMidNote')}</p>${lowsHTML()}</section>`;
  }
  function vSet() {
    const chip = (ty, c) =>
      `<button class="chip" style="padding:4px 12px;background:none;cursor:pointer" data-act="editCat" data-ty="${ty}" data-id="${c.id}">${esc(cName(c))}</button>`;
    const chips = ty =>
      S.cats[ty]
        .filter(c => !c.parent)
        .map(m => {
          const kids = catKids(ty, m.id),
            op = catOpen.has(ty + m.id);
          return `<div class="row catrow"><button type="button" class="main tap" style="text-align:start;background:none;border:0;padding:0;font:inherit;color:inherit" data-act="editCat" data-ty="${ty}" data-id="${m.id}"><span class="t">${esc(cName(m))}${m.sys ? ' <small class="muted">🔒</small>' : ''}</span></button>${kids.length ? `<button type="button" class="btn sm" data-act="catKidsT" data-id="${ty + m.id}">${kids.length} ${t('subW')} ${op ? '▾' : '▸'}</button>` : ''}</div>${op ? kids.map(k => `<div class="row catrow sub"><button type="button" class="main tap" style="text-align:start;background:none;border:0;padding:0;font:inherit;color:inherit" data-act="editCat" data-ty="${ty}" data-id="${k.id}"><span class="t">↳ ${esc(cName(k))}</span></button></div>`).join('') : ''}`;
        })
        .join('');
    return `<section class="sec"><div class="sec-h"><h2>⚙️ ${t('general')}</h2><span class="muted">${esc(BASE())} · ${S.lang === 'en' ? 'English' : 'عربي'}</span></div><div class="list">
    <div class="setrow"><span>${t('lang')}</span>${segHTML(
      'lg',
      [
        ['ar', 'عربي'],
        ['en', 'English']
      ],
      S.lang
    )}</div>
    <div class="setrow"><span>${t('baseCur')}</span><select class="in-f" id="cur" style="max-width:60%">${curOpts(BASE())}</select></div>
    <div class="setrow"><span>${t('defAcc')}</span><select class="in-f" id="defAcc" style="max-width:60%">${accOpts(S.defAcc)}</select></div>
  </div></section>
  ${ratesHTML()}
  ${S.quick.length ? `<section class="sec"><div class="sec-h"><h2>${t('quickList')}</h2></div><div class="list"><div class="chips">${S.quick.map(q => `<span class="chip">${esc(q.note || catName(q.cat))} · ${fmt(q.amount)}<button data-act="delQuick" data-id="${q.id}" aria-label="${t('del')}">×</button></span>`).join('')}</div></div></section>` : ''}
  <section class="sec"><div class="sec-h"><h2>${t('cats')} · ${t('expense')}</h2><span class="muted">${S.cats.expense.filter(c => !c.parent).length} · ${S.cats.expense.filter(c => c.parent).length} ${t('subW')}</span></div><div class="list">${chips('expense')}<div class="row"><button class="link" data-act="addCat" data-ty="expense">+ ${t('addCat')}</button><button class="btn sm" data-act="catOrder" data-ty="expense" style="margin-inline-start:auto">↕ ${t('reorder')}</button></div></div></section>
  <section class="sec"><div class="sec-h"><h2>${t('cats')} · ${t('income')}</h2><span class="muted">${S.cats.income.filter(c => !c.parent).length} · ${S.cats.income.filter(c => c.parent).length} ${t('subW')}</span></div><div class="list">${chips('income')}<div class="row"><button class="link" data-act="addCat" data-ty="income">+ ${t('addCat')}</button><button class="btn sm" data-act="catOrder" data-ty="income" style="margin-inline-start:auto">↕ ${t('reorder')}</button></div></div></section>
  <section class="sec"><div class="sec-h"><h2>${t('account')}</h2></div><div class="list">
    <div class="setrow"><span>${REG ? `<span dir="ltr">${esc(REG.email)}</span>` : t('notReg')}</span>${REG ? `<button class="btn sm danger" data-act="unreg">${t('unreg')}</button>` : `<button class="btn sm pri" data-act="reg">${t('regBtn')}</button>`}</div>
    ${driveConfigured() ? `<div class="setrow"><span>Google Drive</span>${drv.linked ? `<span class="pill ok">${t('linkedOk')}</span>` : `<button class="btn sm pri" data-act="driveLink">${t('driveLink')}</button>`}</div>` : ''}
    ${REG && REG.admin ? `<div class="setrow"><span>${t('usersHint2')}</span><button class="btn sm pri" data-act="users">${t('users')}</button></div>` : ''}
  </div></section>
  <section class="sec"><div class="sec-h"><h2>Google Drive</h2><span class="pill ${drv.linked ? 'ok' : ''}">${drv.linked ? t('driveLinked') : t('driveOff')}</span></div>
    <p class="hint">${driveConfigured() ? t('driveHint') : t('driveNotSetup')}</p>
    ${
      driveConfigured()
        ? drv.linked
          ? `<div class="list"><div class="setrow stack"><span class="label">${t('driveAccount')}</span><b class="num" dir="ltr" style="align-self:stretch;text-align:start;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${drv.email ? esc(drv.email) : `<span class="muted" style="font-weight:400">${t('loading')}</span>`}</b></div></div>
      <p class="hint">${t('msHint')}</p><div class="acts"><button class="btn" data-act="monthSum">${t('msBtn')}</button></div>
      <div class="acts"><button class="btn" data-act="driveRestore">${t('driveRestore')}</button><button class="btn" data-act="driveSwitch">${t('driveSwitch')}</button><button class="btn danger" data-act="driveUnlink">${t('driveUnlink')}</button></div>
      <p class="hint">${t('driveLast')}: ${esc(driveLastLbl())} · ${t('driveKeep')}</p>`
          : `<div class="acts"><button class="btn pri" data-act="driveLink">${t('driveLink')}</button></div>`
        : ''
    }
  </section>
  <section class="sec"><button class="btn block" data-act="shareApp">${t('shareApp')}</button></section>
  ${installEvt ? `<section class="sec"><button class="btn pri block" data-act="install">${t('install')}</button></section>` : ''}
  <section class="sec"><div class="sec-h"><h2>${t('remindersT')}</h2><span class="pill ${pushOn() ? 'ok' : ''}">${pushOn() ? t('on') : t('off')}</span></div>
    <p class="hint">${pushSupported() ? t('remHint') : t('pushUnsupported')}</p>
    ${
      pushSupported()
        ? (() => {
            const rt = remTime();
            return `<div class="two"><label class="fld"><span>${t('remAt')}</span><input class="in-f num" type="time" step="900" id="remHm" value="${hmStr(rt.hm)}"></label>
      <label class="fld"><span>${t('remLead')}</span><select class="in-f" id="remLead">${[0, 1, 2, 3, 7].map(d => `<option value="${d}" ${rt.lead === d ? 'selected' : ''}>${t('lead' + d)}</option>`).join('')}</select></label></div>`;
          })()
        : ''
    }
    ${pushSupported() ? `<div class="acts">${pushOn() ? `<button class="btn" data-act="pushTest">${t('pushTestBtn')}</button><button class="btn danger" data-act="pushOff">${t('turnOff')}</button>` : `<button class="btn pri" data-act="pushOn">${t('turnOn')}</button>`}</div>` : ''}
    ${(() => {
      const u = upcomingReminders(PS).slice(0, 4);
      return u.length
        ? `<div class="list">${u.map(x => `<div class="row"><div class="main"><span class="t">${esc(x.title)}</span><span class="s">${esc(shortDate(x.date))} · ${esc(x.body)}</span></div></div>`).join('')}</div>`
        : '';
    })()}
  </section>
  <section class="sec"><div class="sec-h"><h2>${t('security')}</h2></div><p class="hint">${t('autoLockHint')}</p>
    <div class="list"><div class="setrow"><span>${t('bioOn')}</span>${bioInfo() ? `<button class="btn sm danger" data-act="bioOff">${t('turnOff')}</button>` : `<button class="btn sm pri" data-act="bioOn">${t('turnOn')}</button>`}</div></div>
    <div class="acts"><button class="btn" data-act="changePin">${t('changePin')}</button><button class="btn" data-act="lockNow">${t('lockNow')}</button></div></section>
  <section class="sec"><div class="sec-h"><h2>${t('backup')}</h2><span class="muted">${t('lastBackup')}: ${esc(lastBackupLbl())}</span></div>
    <p class="hint">${t('storageHint')} ${t('encHint')}</p>
    <div class="list">
      <label class="setrow chk" style="justify-content:space-between"><span>${t('autoDl')}<br><span class="hint">${t('autoDlHint')}</span></span><input type="checkbox" id="autoDl" ${S.autoDl ? 'checked' : ''}></label>
    </div>
    ${
      drv.linked
        ? ''
        : `<button class="btn block" data-act="shareDrive">${t('shareDrive')}</button>
    <p class="hint">${t('shareHint')}</p>`
    }
    <div class="acts"><button class="btn" data-act="export">${t('dlNow')}</button><button class="btn" data-act="copyBackup">${t('copyText')}</button><button class="btn" data-act="import">${t('importB')}</button><button class="btn" data-act="importX">${t('importX')}</button></div>
    <button class="btn block" data-act="reviewExport" style="margin-top:8px">🔍 ${t('reviewExport')}</button></section>
  <section class="sec"><div class="sec-h"><h2>🧾 ${t('logT')}</h2><span class="muted">${(S.log || []).length}</span></div><p class="hint">${t('logHint')}</p>
    <div class="list">${
      (S.log || [])
        .slice(-60)
        .reverse()
        .map(l => {
          const x = l.a || l.b,
            lb = {add: t('logAdd'), edit: t('logEdit'), del: t('logDel')}[l.act];
          const ch =
            l.act === 'edit' && l.b && l.a
              ? [
                  l.b.a !== l.a.a ? fmt(l.b.a) + ' → ' + fmt(l.a.a) : '',
                  l.b.d !== l.a.d ? shortDate(l.b.d) + ' → ' + shortDate(l.a.d) : '',
                  l.b.c !== l.a.c ? catName(l.b.c) + ' → ' + catName(l.a.c) : '',
                  l.b.acc !== l.a.acc
                    ? ((accById(l.b.acc) || {}).name || '') + ' → ' + ((accById(l.a.acc) || {}).name || '')
                    : ''
                ]
                  .filter(Boolean)
                  .join(' · ')
              : '';
          return `<div class="row ${l.act !== 'del' && S.tx.some(y => y.id === l.id) ? 'tap' : ''}" ${l.act !== 'del' && S.tx.some(y => y.id === l.id) ? `data-act="openTx" data-id="${l.id}"` : ''} style="padding:6px 12px"><div class="main"><span class="t" style="font-size:13px">${lb} · ${esc(x.n || catName(x.c))}</span><span class="s">${esc(dateOf(new Date(l.at)))} ${hmOf(new Date(l.at))}${ch ? ' · ' + esc(ch) : ' · ' + esc(shortDate(x.d))}</span></div><b class="amt ${l.act === 'del' ? 'neg' : ''}">${fmt(x.a)}</b></div>`;
        })
        .join('') || `<div class="empty">${t('noItems')}</div>`
    }</div></section>
  <section class="sec"><button class="btn danger block" data-act="reset">${t('reset')}</button></section>
  <p class="hint" style="text-align:center">Daftari v${APP_VER} · <button class="link" data-act="appUpdate" style="font-size:inherit">${t('appUpdate')}</button> · <a href="privacy.html" style="color:var(--accent)">${lng() === 'en' ? 'Privacy policy' : 'سياسة الخصوصية'}</a></p>`;
  }
