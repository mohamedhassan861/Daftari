/* Drawing the current tab and the navigation. (part 3 of 3; continues from render-2.js) */
      delCat: () => {
        const ty = b.dataset.ty,
          used = S.tx.some(x => x.cat === id);
        confirmSheet(used ? t('catInUse') : t('confirmDel'), t('del'), () => {
          S.cats[ty] = S.cats[ty].filter(c => c.id !== id);
          S.tx.forEach(x => {
            if (x.cat === id) x.cat = ty === 'expense' ? 'other' : 'iother';
          });
          delete S.budgets[id];
          commit(t('deleted'));
        });
      },
      export: () =>
        saveToPhone(false).then(ok => {
          if (ok) render();
        }),
      glance: () => {
        if (id === 'c') cashSheet();
        else whySheet('availEnd');
      },
      monthSum: () =>
        saveMonthSummary(perRange()[1].slice(0, 7) > TODAY_YM ? TODAY_YM : perRange()[1].slice(0, 7), true),
      reconAll: () => reconAllSheet(),
      showDone: () => {
        SHOW_DONE[id] = !SHOW_DONE[id];
        render();
      },
      accOrder: () => accOrderSheet(),
      catOrder: () => catOrderSheet(b.dataset.ty),
      oblOrder: () => oblOrderSheet(oblTab),
      recDo: () => recDoSheet(id),
      recLater: () => recLaterSheet(id),
      recSkip: () => recSkip(id),
      ratesNow: () => {
        toast(t('working'), 0);
        updateRates(true);
      },
      catKidsT: () => {
        if (catOpen.has(id)) catOpen.delete(id);
        else catOpen.add(id);
        render();
      },
      reviewExport: reviewExport,
      import: doImport,
      copyBackup: copyBackup,
      shareDrive: shareBackup,
      addAcc: () => accForm(),
      editAcc: () => accForm(S.accounts.find(a => a.id === id)),
      addAccCur: () =>
        accForm(null, {
          name: b.dataset.name,
          type: b.dataset.type,
          group: b.dataset.group,
          currency: usedCurrencies().includes('USD') ? 'EUR' : 'USD'
        }),
      rates: ratesForm,
      shareApp: shareApp,
      driveLink: driveConnect,
      driveSync: () => {
        if (hasToken()) syncDrive(true);
        else driveResume();
      },
      driveRestore: driveRestore,
      driveTidy: driveTidyAsk,
      driveKeepAll: driveKeepAll,
      msAuto: msAutoToggle,
      driveUnlink: driveUnlink,
      driveSwitch: driveSwitch,
      driveResume: driveResume,
      install: () => {
        if (installEvt) {
          installEvt.prompt();
          installEvt = null;
          render();
        }
      },
      changePin: changePinForm,
      lockNow: lockNow,
      reset: () =>
        confirmSheet(t('resetConfirm'), t('del'), () => {
          const l = S.lang,
            keep = ACT === 'me' ? S.ledgers : undefined;
          S = blank();
          S.lang = l;
          if (ACT === 'me') {
            S.ledgers = keep || [];
            PS = S;
          }
          commit(t('deleted'));
        })
    };
    if (A[a]) A[a]();
  }
