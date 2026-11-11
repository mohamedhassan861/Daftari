/* Drawing the current tab and the navigation. (part 2 of 3; continues from render-1.js) */
  function actClick(e) {
    const r = e.target.closest('#view [data-tx]');
    if (r) {
      txForm(S.tx.find(x => x.id === r.dataset.tx));
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id,
      a = b.dataset.act;
    if (b.closest('summary') && b.tagName !== 'SUMMARY') e.preventDefault();
    if (a === 'why') {
      e.preventDefault();
      e.stopPropagation();
      whySheet(b.dataset.w);
      return;
    }
    if (a === 'openTx') {
      const x = S.tx.find(y => y.id === id);
      if (x) txForm(x);
      return;
    }
    const A = {
      payInst: () => payInst(id),
      payGam: () => payGam(id),
      recvGam: () => recvGam(id),
      goLoans: () => {
        closeSheet();
        tab = 'obl';
        oblTab = 'loan';
        render();
        window.scrollTo(0, 0);
      },
      goInst: () => {
        closeSheet();
        tab = 'obl';
        oblTab = 'inst';
        render();
        window.scrollTo(0, 0);
      },
      goGam: () => {
        closeSheet();
        tab = 'obl';
        oblTab = 'gam';
        render();
        window.scrollTo(0, 0);
      },
      goTx: () => {
        tab = 'tx';
        render();
        window.scrollTo(0, 0);
      },
      editInst: () => instForm(S.inst.find(x => x.id === id)),
      editGam: () => gamForm(S.gam.find(x => x.id === id)),
      editLoan: () => loanForm(S.loans.find(x => x.id === id)),
      repay: () => repayForm(S.loans.find(x => x.id === id)),
      addObl: () =>
        oblTab === 'card'
          ? accForm(null, {type: 'card'})
          : oblTab === 'inst'
            ? instForm()
            : oblTab === 'gam'
              ? gamForm()
              : oblTab === 'rec'
                ? txForm(null, 'monthly')
                : oblTab === 'goal'
                  ? goalForm()
                  : loanForm(),
      gamCalc: gamCalc,
      editGoal: () => goalForm(S.goals.find(g => g.id === id)),
      goalAdd: () => goalAddForm(S.goals.find(g => g.id === id)),
      goGoals: () => {
        closeSheet();
        tab = 'obl';
        oblTab = 'goal';
        render();
        window.scrollTo(0, 0);
      },
      safe: safeSheet,
      useQuick: () => {
        const q = S.quick.find(x => x.id === id);
        if (q) {
          const p = Object.assign({}, q);
          delete p.id;
          txForm(null, '', p);
        }
      },
      delQuick: () => {
        S.quick = S.quick.filter(x => x.id !== id);
        commit(t('deleted'));
      },
      clearFilt: () => {
        txCat = '';
        txAcc = '';
        txQuery = '';
        txTag = '';
        txDay = '';
        render();
      },
      clearDay: () => {
        txDay = '';
        render();
      },
      pickDay: () => {
        txDay = txDay === b.dataset.d ? '' : b.dataset.d;
        render();
      },
      stmtTag: () => {
        const g = b.dataset.name;
        stmtSheet({
          title: '#' + g,
          sub: perLabel(),
          cur: BASE(),
          kind: 'flow',
          rows: flowRows(txIn().filter(x => x.type !== 'transfer' && (x.tags || []).includes(g)))
        });
      },
      stmtFilt: () => {
        const ty = b.dataset.ty,
          list = txFiltered(),
          title =
            [
              txCat ? catPath(txCat) : '',
              txAcc ? accOf(txAcc).name + ' ' + accOf(txAcc).currency : '',
              txQuery ? '"' + txQuery + '"' : ''
            ]
              .filter(Boolean)
              .join(' · ') || t('tx');
        const pl = x => (txCat && FIN_CATS.has(catRoot(txCat)) ? x.type !== 'transfer' : isPL(x));
        if (ty === 'net')
          stmtSheet({title, sub: perLabel(), cur: BASE(), kind: 'acc', opening: 0, rows: flowRows(list.filter(pl))});
        else
          stmtSheet({
            title: (ty === 'income' ? t('income') : t('expense')) + ' · ' + title,
            sub: perLabel(),
            cur: BASE(),
            kind: 'flow',
            rows: flowRows(list.filter(x => x.type === ty && pl(x)))
          });
      },
      stmtFin: () => flowStmt('fin'),
      users: usersSheet,
      unreg: unregister,
      reg: () => {
        if (!driveReady()) {
          toast(t('regLoading'));
          return;
        }
        doRegister().then(
          () => {
            toast(t('regDone') + ' ' + REG.email);
            render();
          },
          () => toast(t('regFail'))
        );
      },
      pushOn: pushEnable,
      pushOff: pushDisable,
      pushTest: pushTest,
      bioOn: bioEnableForm,
      bioOff: bioOff,
      importX: importForm,
      settle: () => settleForm(b.dataset.from, b.dataset.to, b.dataset.v),
      payCard: () => payCard(id),
      goCards: () => {
        closeSheet();
        tab = 'obl';
        oblTab = 'card';
        render();
        window.scrollTo(0, 0);
      },
      goAcc: () => {
        closeSheet();
        if (tab !== 'home') {
          tab = 'home';
          render();
        }
        const e =
          [...document.querySelectorAll('#view details.box')].find(d =>
            /accounts|الحسابات/i.test(d.textContent.slice(0, 80))
          ) || document.querySelector('#view details.box');
        if (e) {
          e.open = true;
          e.scrollIntoView({behavior: 'smooth'});
        }
      },
      addTxT: () => txForm(null, '', {type: b.dataset.ty}),
      addRecT: () => txForm(null, 'monthly'),
      appUpdate: async () => {
        toast(t('working'), 0);
        await updateNow();
      },
      goNW: () => {
        tab = 'rep';
        render();
        setTimeout(() => {
          const e = $('#nw');
          if (e) e.scrollIntoView({behavior: 'smooth'});
        }, 50);
      },
      editRec: () => {
        const r = S.recur.find(v => v.id === id);
        if (r) recRuleForm(r);
      },
      stmtRec: () => {
        const r = S.recur.find(v => v.id === id);
        if (!r) return;
        stmtSheet({
          title: r.tpl.note || catPath(r.tpl.cat),
          sub: freqName(r.freq) + ' · ' + t('allTime'),
          cur: BASE(),
          kind: 'flow',
          rows: flowRows(S.tx.filter(x => x.rec === r.id && x.type !== 'transfer'))
        });
      },
      exportTx: () =>
        exportTx(
          (() => {
            let l = txIn();
            if (txFilter !== 'all') l = l.filter(x => x.type === txFilter);
            return l;
          })(),
          t('tx')
        ),
      exportCats: () => {
        const tx = txIn().filter(x => x.type === 'expense' && isPL(x));
        const by = new Map();
        tx.forEach(x => by.set(x.cat, (by.get(x.cat) || 0) + baseAmt(x)));
        exportSheet({
          title: t('byCat'),
          sub: perLabel() + ' · ' + curName(BASE()),
          cols: [t('category'), t('amount')],
          num: [1],
          rows: [...by].sort((a, b) => b[1] - a[1]).map(([c, v]) => [catPath(c), Math.round(v * 100) / 100]),
          foot: [[t('total'), Math.round([...by.values()].reduce((a, b) => a + b, 0) * 100) / 100]]
        });
      },
      budget: budgetForm,
      clearSample: () => {
        const l = S.lang,
          keep = S.ledgers;
        S = blank();
        S.lang = l;
        S.ledgers = keep || [];
        if (ACT === 'me') PS = S;
        commit();
      },
      addCat: () => catForm(b.dataset.ty),
      editCat: () => {
        const ty = b.dataset.ty;
        catForm(
          ty,
          S.cats[ty].find(c => c.id === id)
        );
      },
      fcMonth: () => fcMonthSheet(b.dataset.m || id),
      cashSheet: () => cashSheet(),
      planCat: () => planCatSheet(id, b.dataset.ty),
      closeMonth: () => closeMonthSheet(b.dataset.m, false),
      stmtAcc: () => accStmt(id),
      stmtCat: () => catStmt(id),
      catGroup: () => catGroupSheet(b.dataset.ty, id),
      stmtFlow: () => flowStmt(b.dataset.ty),
      stmtPerson: () => personStmt(b.dataset.name || id),
      stmtObl: () => oblStmt(b.dataset.k || b.dataset.ty, id),
      recon: () => recForm(accOf(id)),
      addCatOld: () => {
        const ty = b.dataset.ty;
        openSheet(
          t('addCat'),
          `<form class="form" id="f"><label class="fld"><span>${t('name')}</span><input class="in-f" id="nm"></label><div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,
          r => {
            setTimeout(() => r.querySelector('#nm').focus(), 50);
            r.querySelector('#f').onsubmit = ev => {
              ev.preventDefault();
              const nm = val(r, 'nm');
              if (!nm) {
                toast(t('needName'));
                return;
              }
              S.cats[ty].splice(S.cats[ty].length - (ty === 'expense' ? 3 : 2), 0, {
                id: 'c' + uid(),
                ar: nm,
                en: nm,
                sys: false
              });
              closeSheet();
              commit(t('saved'));
            };
          }
        );
      },
