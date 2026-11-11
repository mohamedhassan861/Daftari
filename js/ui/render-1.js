/* Drawing the current tab and the navigation. (part 1 of 3) */
  function render() {
    if (S) migrate();
    const de = document.documentElement;
    de.lang = S.lang;
    de.dir = S.lang === 'en' ? 'ltr' : 'rtl';
    $('#brand').textContent = ACT === 'me' ? t('app') : '👥 ' + ((SHM && SHM.name) || '');
    document.title = t('app');
    document.querySelector('.top').classList.toggle('shared', ACT !== 'me');
    $('#mLbl').textContent = perLabel();
    fitHeader();
    requestAnimationFrame(() => {
      try {
        fitHeader();
      } catch (e) {}
    });
    $('#nav').innerHTML = ['home', 'tx', 'obl', 'rep', 'set']
      .map(
        k =>
          `<button data-tab="${k}" class="${tab === k ? 'on' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>${t(k)}</button>`
      )
      .join('');
    const v = $('#view');
    v.innerHTML =
      tab === 'home'
        ? vHome()
        : tab === 'tx'
          ? vTx()
          : tab === 'obl'
            ? vObl()
            : tab === 'rep'
              ? vRep()
              : setBoxes(vSet());
    boxStates(v);
    navSync();
    $('#fab').hidden = !(tab === 'home' || tab === 'tx') || (ACT !== 'me' && SHM && SHM.role === 'reader');
    if (tab === 'home') {
      const f = v.querySelector('#qadd');
      if (f) {
        f.onsubmit = e => {
          e.preventDefault();
          const q = v.querySelector('#qtext').value.trim();
          if (q) quickFromText(q);
          else txForm();
        };
        const mic = v.querySelector('#qmic');
        if (mic)
          mic.onclick = () =>
            listen(txt => {
              v.querySelector('#qtext').value = txt;
              quickFromText(txt);
            });
      }
    }
    if (tab === 'tx' && txView === 'rec')
      bindSeg(v, 'tv', x => {
        txView = x;
        txDay = '';
        render();
      });
    if (tab === 'tx' && txView !== 'rec') {
      bindSeg(v, 'txf', x => {
        txFilter = x;
        render();
      });
      const cf = v.querySelector('#cf'),
        af = v.querySelector('#af'),
        qx = v.querySelector('#qx');
      cf.value = txCat;
      af.value = txAcc;
      cf.onchange = () => {
        txCat = cf.value;
        render();
      };
      const tgf = v.querySelector('#tgf');
      if (tgf)
        tgf.onchange = () => {
          txTag = tgf.value;
          render();
        };
      bindSeg(v, 'tv', x => {
        txView = x;
        txDay = '';
        render();
      });
      af.onchange = () => {
        txAcc = af.value;
        render();
      };
      if (qx)
        qx.onclick = () => {
          txQuery = '';
          render();
          $('#q').focus();
        };
      const q = v.querySelector('#q');
      q.oninput = () => {
        txQuery = q.value;
        const p = q.selectionStart;
        render();
        const n = $('#q');
        n.focus();
        n.setSelectionRange(p, p);
      };
    }
    if (tab === 'obl') {
      bindSeg(v, 'obf', x => {
        oblTab = x;
        oblF.clear();
        oblC.clear();
        render();
      });
      v.querySelectorAll('[data-of]').forEach(
        el =>
          (el.onclick = () => {
            const f = el.dataset.of;
            if (oblF.has(f)) oblF.delete(f);
            else oblF.add(f);
            render();
          })
      );
      v.querySelectorAll('[data-oc]').forEach(
        el =>
          (el.onclick = () => {
            const f = el.dataset.oc;
            if (oblC.has(f)) oblC.delete(f);
            else oblC.add(f);
            render();
          })
      );
      const oq = v.querySelector('#oq');
      if (oq) {
        oq.oninput = () => {
          oblQ = oq.value;
          const p = oq.selectionStart;
          render();
          const n = $('#view #oq');
          if (n) {
            n.focus();
            try {
              n.setSelectionRange(p, p);
            } catch (e) {}
          }
        };
      }
      const oqx = v.querySelector('#oqx');
      if (oqx)
        oqx.onclick = () => {
          oblQ = '';
          render();
        };
      const ofx = v.querySelector('#ofx');
      if (ofx)
        ofx.onclick = () => {
          oblQ = '';
          oblF.clear();
          oblC.clear();
          render();
        };
    }
    if (tab === 'rep') {
      const zs = (id, k, isSel) => {
        const el = v.querySelector(id);
        if (el)
          el.onchange = () => {
            S.zakat[k] = isSel ? el.value : el.checked;
            if (k === 'karat') S.zakat.karatSet = true;
            commit();
          };
      };
      zs('#zkK', 'karat', 1);
      zs('#zkG', 'gold');
      zs('#zkR', 'recv');
      zs('#zkD', 'debt');
    }
    if (tab === 'set' && drv.linked && !drv.email && hasToken() && !fetchDriveEmail.busy) {
      fetchDriveEmail.busy = 1;
      fetchDriveEmail().then(e => {
        fetchDriveEmail.busy = 0;
        if (e && tab === 'set') render();
      });
    }
    if (tab === 'set') {
      const rh = v.querySelector('#remHm'),
        rl = v.querySelector('#remLead');
      if (rh) {
        const go = () => {
          const [h, m] = (rh.value || '09:00').split(':').map(Number);
          remTimeSave(h * 60 + (m || 0), +rl.value);
        };
        rh.onchange = go;
        rl.onchange = go;
      }
    }
    if (tab === 'set') {
      bindSeg(v, 'lg', x => {
        applyNames(x);
        S.lang = x;
        LANG = x;
        if (PS && PS !== S) {
          PS.lang = x;
          vaultSave(PS);
        }
        commit();
      });
      const ad = v.querySelector('#autoDl');
      ad.onchange = () => {
        S.autoDl = ad.checked;
        commit(t('saved'));
      };
      const c = v.querySelector('#cur');
      c.onchange = () => {
        S.base = c.value;
        S.rates = {};
        S.ratesAt = null;
        commit(t('saved'));
        updateRates(false);
      };
      const da = v.querySelector('#defAcc');
      da.onchange = () => {
        S.defAcc = da.value;
        commit(t('saved'));
      };
    }
  }
