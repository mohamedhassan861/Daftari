/* Statement screens and the ordering sheets. (part 2 of 2; continues from statements-1.js) */
  /* month-end reconciliation: the balance the bank app / your wallet / the card statement shows against the book, for all accounts at once */
  /* the order of groups (banks, cash, cards…) and of the accounts inside each one; it is the order of S.accounts */
  /* one ordering screen for everything: groups move with ▲▼, and so do the items inside each group; saving rewrites the array order */
  function orderSheet(title, G, save, hint) {
    const btn = (act, i, j, dis, lbl) =>
        `<button type="button" class="btn sm" data-o="${act}" data-i="${i}" data-j="${j}" ${dis ? 'disabled style="opacity:.35"' : ''}>${lbl}</button>`,
      one = G.length < 2;
    const draw = r => {
      r.querySelector('#ol').innerHTML = G.map(
        (g, i) =>
          (one && !g.g
            ? ''
            : `<div class="grp" style="display:flex;align-items:center;gap:6px"><span style="flex:1">${esc(g.g)}</span>${one ? '' : btn('gu', i, 0, i === 0, '▲') + btn('gd', i, 0, i === G.length - 1, '▼')}</div>`) +
          g.items
            .map(
              (x, j) =>
                `<div class="row" style="gap:6px"><div class="main"><span class="t">${esc(x.n)}</span>${x.s ? `<span class="s">${esc(x.s)}</span>` : ''}</div>${btn('nu', i, j, j === 0, '▲')}${btn('nd', i, j, j === g.items.length - 1, '▼')}</div>`
            )
            .join('')
      ).join('');
    };
    openSheet(
      t('reorder') + ' · ' + title,
      `<div class="form"><p class="hint">${hint || t('reorderHint2')}</p><div class="list" id="ol"></div><div class="foot"><button type="button" class="btn pri grow" id="os">${t('save')}</button></div></div>`,
      r => {
        draw(r);
        r.querySelector('#ol').onclick = e => {
          const b = e.target.closest('[data-o]');
          if (!b || b.disabled) return;
          const i = +b.dataset.i,
            j = +b.dataset.j,
            sw = (a, x, y) => {
              [a[x], a[y]] = [a[y], a[x]];
            };
          if (b.dataset.o === 'gu') sw(G, i, i - 1);
          else if (b.dataset.o === 'gd') sw(G, i, i + 1);
          else if (b.dataset.o === 'nu') sw(G[i].items, j, j - 1);
          else sw(G[i].items, j, j + 1);
          draw(r);
        };
        r.querySelector('#os').onclick = () => {
          save(G.flatMap(g => (g.ids || []).concat(g.items.flatMap(x => x.ids))));
          closeSheet();
          commit(t('saved'));
        };
      }
    );
  }
  function accOrderSheet() {
    const G = [...groupsOf(S.accounts, accGroup)].map(([g, accs]) => ({
      g,
      items: [...groupsOf(accs, a => a.name)].map(([n, l]) => ({
        n,
        s: l.map(a => a.currency).join(' · '),
        ids: l.map(a => a.id)
      }))
    }));
    orderSheet(
      t('accounts'),
      G,
      ids => {
        S.accounts = byRank(S.accounts, ids, a => a.id);
      },
      t('reorderHint')
    );
  }
  function catOrderSheet(ty) {
    const G = S.cats[ty]
      .filter(c => !c.parent)
      .map(m => ({g: cName(m), ids: [m.id], items: catKids(ty, m.id).map(k => ({n: cName(k), ids: [k.id]}))}));
    orderSheet(
      t('cats') + ' · ' + t(ty),
      G,
      ids => {
        S.cats[ty] = byRank(S.cats[ty], ids, c => c.id);
      },
      t('reorderCatHint')
    );
  }
  function oblOrderSheet(k) {
    const L = k === 'inst' ? S.inst : k === 'gam' ? S.gam : k === 'loan' ? S.loans : S.goals,
      nm = o => (k === 'loan' ? o.person : o.name),
      sub = o => (k === 'loan' ? (o.dir === 'lent' ? t('lentTo') : t('borrowedFrom')) + ' · ' + fmt(+o.amount) : '');
    const G =
      k === 'goal'
        ? [{g: '', items: L.map(o => ({n: nm(o), ids: [o.id]}))}]
        : [...groupsOf(L, plainGroup)].map(([g, l]) => ({g, items: l.map(o => ({n: nm(o), s: sub(o), ids: [o.id]}))}));
    orderSheet({inst: t('installments'), gam: t('gameyas'), loan: t('loans'), goal: t('goals')}[k], G, ids => {
      const v = byRank(L, ids, o => o.id);
      if (k === 'inst') S.inst = v;
      else if (k === 'gam') S.gam = v;
      else if (k === 'loan') S.loans = v;
      else S.goals = v;
    });
  }
  function reconAllSheet() {
    const accs = S.accounts.filter(a => isLiquid(a) || a.type === 'card'),
      isC = a => a.type === 'card';
    const shown = a => (isC(a) ? -accBalance(a) : accBalance(a)),
      lastOf = a => (S.recons || []).filter(r => r.acc === a.id).slice(-1)[0];
    const defCat = (a, d) =>
      d < 0 ? (a.type === 'cash' ? 'adjust' : 'bankfees') : a.type === 'bank' ? 'interest' : 'iadjust';
    openSheet(
      t('reconAll'),
      `<form class="form" id="f"><p class="hint">${t('reconAllHint')}</p>
    <div class="list">${accs
      .map(a => {
        const l = lastOf(a);
        return `<div class="row" style="flex-wrap:wrap;gap:6px" data-r="${a.id}">
      <div class="main" style="min-width:55%"><span class="t">${esc(a.name)} <small class="muted">${esc(a.currency)}</small></span>
      <span class="s">${isC(a) ? t('reconCardBook') : t('bookBal')}: <b class="num">${fmt(shown(a))}</b></span>${l ? '<span class="s">' + t('reconLast') + ' ' + esc(l.date.slice(8, 10) + '/' + l.date.slice(5, 7) + '/' + l.date.slice(0, 4)) + (Math.abs(l.diff) > 0.004 ? ' (' + (l.diff > 0 ? '+' : '−') + fmt(Math.abs(l.diff)) + ')' : ' ✓') + '</span>' : ''}</div>
      <input class="in-f num" style="flex:1;min-width:110px" inputmode="decimal" autocomplete="off" data-in="${a.id}" placeholder="${isC(a) ? t('reconCardAct') : t('actualBal')}">
      <span class="s" style="flex-basis:100%" data-d="${a.id}"></span>
      <select class="in-f" data-c="${a.id}" hidden style="flex-basis:100%"></select></div>`;
      })
      .join('')}</div>
    <div class="foot"><button class="btn pri grow">${t('reconSave')}</button></div>
    ${
      (S.recons || []).length
        ? `<details><summary>${t('reconHist')} ›</summary><div class="list">${(S.recons || [])
            .slice(-30)
            .reverse()
            .map(r => {
              const a = accById(r.acc);
              return `<div class="row"><div class="main"><span class="t">${esc(a ? a.name + ' ' + a.currency : '—')}</span><span class="s">${esc(shortDate(r.date))} · ${t('bookBal')} ${fmt(r.book)} · ${t('actualBal')} ${fmt(r.actual)}</span></div><b class="amt ${Math.abs(r.diff) < 0.005 ? 'pos' : 'neg'}">${Math.abs(r.diff) < 0.005 ? '✓' : (r.diff > 0 ? '+' : '−') + fmt(Math.abs(r.diff))}</b></div>`;
            })
            .join('')}</div></details>`
        : ''
    }</form>`,
      r => {
        const diffOf = a => {
          const i = r.querySelector(`[data-in="${a.id}"]`),
            v = i.value.trim();
          if (v === '') return null;
          const n = parseFloat(normDigits(v).replace(/,/g, ''));
          if (isNaN(n)) return null;
          const target = isC(a) ? -n : n;
          return Math.round((target - accBalance(a)) * 100) / 100;
        };
        accs.forEach(a => {
          const i = r.querySelector(`[data-in="${a.id}"]`),
            dEl = r.querySelector(`[data-d="${a.id}"]`),
            sel = r.querySelector(`[data-c="${a.id}"]`);
          i.oninput = () => {
            const d = diffOf(a);
            if (d === null) {
              dEl.textContent = '';
              sel.hidden = true;
              return;
            }
            if (Math.abs(d) < 0.005) {
              dEl.innerHTML = `<span class="pos">✓ ${t('matched')}</span>`;
              sel.hidden = true;
              return;
            }
            const more = isC(a) ? d < 0 : d > 0;
            const dd = isC(a) ? -d : d;
            dEl.innerHTML = `<span class="neg">${t('diff')}: ${dd > 0 ? '+' : '−'}${fmt(Math.abs(dd))}</span> · ${isC(a) ? (more ? t('reconCardMore') : t('reconCardLess')) : more ? t('diffMore') : t('diffLess')}`;
            const ty = d < 0 ? 'expense' : 'income',
              want = sel.dataset.ty !== ty;
            if (want) {
              sel.innerHTML = catOptsTree(ty, defCat(a, d), true);
              sel.dataset.ty = ty;
            }
            sel.hidden = false;
          };
        });
        r.querySelector('#f').onsubmit = e => {
          e.preventDefault();
          let n = 0,
            adj = 0;
          S.recons = S.recons || [];
          accs.forEach(a => {
            const d = diffOf(a);
            if (d === null) return;
            n++;
            const book = shown(a),
              actual = book + (isC(a) ? -d : d),
              rec = {id: uid(), date: TODAY, acc: a.id, book, actual, diff: isC(a) ? -d : d};
            if (Math.abs(d) >= 0.005) {
              const sel = r.querySelector(`[data-c="${a.id}"]`),
                tx = {
                  id: uid(),
                  type: d < 0 ? 'expense' : 'income',
                  acc: a.id,
                  cat: sel.value || defCat(a, d),
                  amount: Math.abs(d),
                  date: TODAY,
                  note: t('recNote')
                };
              S.tx.push(tx);
              rec.tx = tx.id;
              adj++;
            }
            S.recons.push(rec);
          });
          if (!n) {
            toast(t('needAmt'));
            return;
          }
          S.recons = S.recons.slice(-200);
          closeSheet();
          commit(adj ? t('reconDoneAdj').replace('%n', adj) : t('reconDoneOk'));
        };
      }
    );
  }
