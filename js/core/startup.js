/* One-time page wiring and start-up, in the order it must run; closes the private scope opened in core/start. */
  /* ---------- fingerprint unlock (passkey + PRF): the PIN is kept encrypted by a key only the fingerprint can release ---------- */
  const BIO_KEY = 'daftari-bio';
  let BIO_AC = null;

  /* ---------- forgotten PIN: recover with the Google account instead of erasing ----------
   A random recovery key lives in the user's own Drive (Daftari folder). The phone keeps the PIN
   encrypted with that key, so signing in to the same Google account can open the vault again. */
  const REC_KEY = 'daftari-rec',
    REC_FILE = 'daftari-recovery.json';
  let PINMEM = null;

  /* ---------- install (PWA) ---------- */
  let installEvt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    installEvt = e;
    if (S && tab === 'set') render();
  });
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  /* ---------- lock ---------- */
  const FP_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.040-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.390 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.210.12zM14.91 22c-.04 0-.09-.01-.13-.02-1.59-.44-2.63-1.03-3.72-2.1-1.4-1.39-2.17-3.24-2.17-5.22 0-1.62 1.38-2.94 3.08-2.94 1.7 0 3.08 1.32 3.08 2.94 0 1.07.93 1.94 2.08 1.94s2.08-.87 2.08-1.94c0-3.77-3.25-6.83-7.25-6.83-2.84 0-5.44 1.58-6.61 4.03-.39.81-.59 1.76-.59 2.8 0 .78.07 2.01.67 3.61.1.26-.03.55-.29.64-.26.1-.55-.04-.64-.29-.49-1.31-.73-2.61-.73-3.96 0-1.2.23-2.29.68-3.240 1.33-2.79 4.28-4.6 7.51-4.6 4.55 0 8.25 3.51 8.25 7.83 0 1.62-1.38 2.94-3.08 2.94s-3.08-1.32-3.08-2.94c0-1.07-.93-1.94-2.08-1.94s-2.08.87-2.08 1.94c0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.85.27.07.42.35.35.61-.05.23-.26.38-.47.38z"/></svg>';
  let fails = 0,
    blockedUntil = 0,
    hiddenAt = 0,
    LOCKBIO = () => {},
    BIO_AFTER = false;
  let RECOVERED = null,
    EXT = 0,
    hiddenOut = false;
  $('#lkForgot').onclick = () => {
    if (recInfo() && driveConfigured()) {
      $('#lkT').textContent = t('recTitle');
      $('#lkH').textContent = t('recovHint');
      $('#lkE').textContent = '';
      $('#lkForgot').hidden = true;
      $('#lkF').innerHTML =
        `<button type="button" class="btn pri block gbtn" id="rGo"><span class="g">G</span>${t('recBtn')}</button><button type="button" class="btn block" id="rBack">${t('cancel')}</button><button type="button" class="link" id="rWipe" style="color:var(--neg);margin-top:6px">${t('recWipe')}</button>`;
      $('#rBack').onclick = showLock;
      $('#rWipe').onclick = forgotWipe;
      $('#rGo').onclick = async () => {
        const err = m => ($('#lkE').textContent = m);
        if (!driveReady()) {
          err(t('regLoading'));
          return;
        }
        err(t('working'));
        try {
          const pin = await recRecoverPin();
          RECOVERED = pin;
          showLock();
          $('#lp1').value = pin;
          $('#lkF').requestSubmit();
        } catch (x) {
          err(x && x.message === 'nokey' ? t('recNoKey') : t('recFail'));
        }
      };
      return;
    }
    forgotWipe();
  };
  $('#lockBtn').onclick = () => {
    if (S) lockNow();
  };
  $('#brand').onclick = () => {
    if (S && PS) ledgersSheet();
  };
  /* leaving the app locks it at once; when you leave from inside it (picking a file, sharing, Google sign-in, printing, the fingerprint prompt) it stays open if you come back within 5 minutes */
  document.addEventListener(
    'click',
    e => {
      const x = e.target.closest && e.target;
      if (!x) return;
      const l = x.closest('label');
      if (
        x.closest('input[type=file],a[target=_blank],a[href^="mailto:"],a[href^="tel:"],a[href^="https://wa.me"]') ||
        (l && l.querySelector('input[type=file]'))
      )
        goingOut();
    },
    true
  );
  try {
    if (navigator.share) {
      const sh = navigator.share.bind(navigator);
      navigator.share = (...a) => {
        goingOut();
        return sh(...a);
      };
    }
  } catch (e) {}
  window.addEventListener('blur', () => {
    if (S) cover(true);
  });
  window.addEventListener('focus', () => {
    if (!document.hidden) cover(false);
  });
  window.addEventListener('pageshow', e => {
    if (e.persisted) {
      if (S) lockNow();
      cover(false);
    }
  });
  window.addEventListener('pagehide', () => {
    if (S) {
      cover(true);
      if (Date.now() - EXT >= 20000) lockNow();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cover(true);
      hiddenAt = Date.now();
      hiddenOut = Date.now() - EXT < 20000;
      if (S && !hiddenOut) lockNow();
    } else {
      if (S && hiddenAt && (!hiddenOut || Date.now() - hiddenAt > 300000)) lockNow();
      EXT = 0;
      cover(false);
      checkUpdate();
      if (!S) setTimeout(LOCKBIO, 250);
    }
  });
  /* updates: the published version is in version.json; while locked the app reloads itself, while open it shows a banner and updates at the next lock */
  let NEWVER = null;
  setInterval(checkUpdate, 30 * 60000);

  checkUpdate();
  if (!(window.crypto && crypto.subtle)) {
    $('#lkT').textContent = 'This browser cannot encrypt data. Open the app over https.';
  } else showLock();

  /* automated checks only: exposed on a local test server, never on the real site */
  if (location.hostname === 'localhost')
    window.__T = {
      seed,
      get S() {
        return S;
      },
      set S(v) {
        S = v;
      },
      get per() {
        return per;
      },
      setPer(p, c) {
        per = p;
        if (c) cur = c;
      },
      accBalance,
      accBalanceAt,
      balAll,
      liqAll,
      cashActual,
      cashPlan,
      monthCash,
      planItems,
      planVsActual,
      remainingPlan,
      cashTimeline,
      safeToSpend,
      fcSeries,
      lateItems,
      cardInfo,
      cardDueFor,
      dateIn,
      loanSched,
      loanOwedUpTo,
      loanLeft,
      owedUpTo,
      oblLeft,
      allocate,
      unlink,
      relink,
      dueFor,
      netWorth,
      perRange,
      monthEnd,
      ymAdd,
      advance,
      runRecurring,
      closeRows,
      txOf,
      TODAY,
      TODAY_YM,
      projFlows,
      perCash,
      upcomingReminders,
      recPending,
      monthSummary,
      glanceHTML,
      cardCycles,
      applyNames,
      bridgeHTML,
      whyData,
      fxGain,
      rateAt,
      valAt,
      xferBase,
      loanForm,
      loanTopUp,
      loanPaid,
      loanAdj,
      parseEntry,
      isPL,
      isFin,
      flowStmt,
      accStmt,
      personStmt,
      oblStmt,
      oblStats,
      oblPaidReal,
      oblWaived,
      oblBase,
      get lastStmt() {
        return lastStmt;
      },
      commit,
      render,
      migrate,
      blank,
      save
    };
})();
