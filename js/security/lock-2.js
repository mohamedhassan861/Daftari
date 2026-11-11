/* The lock screen: PIN, fingerprint and recovery. (part 2 of 3; continues from lock-1.js) */
  function showLock() {
    const vt = readVault(),
      setup = !vt,
      needReg = !!CFG.authWorker;
    LOCKSETUP = setup;
    const de = document.documentElement;
    de.lang = LANG;
    de.dir = LANG === 'en' ? 'ltr' : 'rtl';
    $('#lkBrand').textContent = t('app');
    $('#lkT').textContent = setup ? t('setupTitle') : '';
    $('#lkT').hidden = !setup;
    $('#lkH').textContent = setup ? t('pinMin') : '';
    $('#lkE').textContent = '';
    $('#lkF').innerHTML = `${needReg ? `<div id="acctW">${acctHTML()}</div>` : ''}
    
    <div id="pinW" style="display:grid;gap:10px">
    <input class="in-f pin" type="password" inputmode="numeric" autocomplete="off" id="lp1" aria-label="${t('pin1')}" placeholder="${t('pin1')}">
    ${setup ? `<input class="in-f pin" type="password" inputmode="numeric" autocomplete="off" id="lp2" aria-label="${t('pin2')}" placeholder="${t('pin2')}">` : ''}
    <button class="btn pri block">${setup ? t('create') : t('open')}</button></div>
    ${!setup && bioSupported() ? `<button type="button" class="fpbtn ${bioInfo() ? 'on' : ''}" id="bioBtn" aria-label="${t('bioUnlock')}">${FP_SVG}</button>` : ''}
    ${needReg ? `<p class="hint" style="text-align:center;margin:0"><a href="privacy.html" target="_blank" rel="noopener" style="color:var(--muted)">${t('privacy')}</a></p>` : ''}`;
    $('#lkForgot').hidden = setup;
    $('#lkForgot').textContent = t('forgot');
    $('#lock').hidden = false;
    const err = m => {
      $('#lkE').classList.remove('ok');
      $('#lkE').textContent = m;
    };
    const bindG = () => {
      const g = $('#gbtn');
      if (g)
        g.onclick = async () => {
          if (!driveReady()) {
            err(t('regLoading'));
            return;
          }
          err(t('working'));
          try {
            await doRegister();
            $('#acctW').innerHTML = acctHTML();
            err('');
            $('#lp1').focus();
          } catch (x) {
            err(t('regFail'));
          }
        };
    };
    bindG();
    let bioBusy = false;
    const bioGo = async auto => {
      if (bioBusy && auto) return;
      bioBusy = true;
      try {
        const pin = await bioUnlockPin();
        $('#lp1').value = pin;
        $('#lkF').requestSubmit();
      } catch (x) {
        if (!auto) err(t('bioFail'));
      }
      bioBusy = false;
    };
    const bb = $('#bioBtn');
    if (bb)
      bb.onclick = () => {
        if (bioInfo()) bioGo(false);
        else {
          BIO_AFTER = true;
          bb.classList.add('wait');
          err(t('bioAfterPin'));
          $('#lkE').classList.add('ok');
          $('#lp1').focus();
        }
      };
    if (bb) {
      try {
        const v = localStorage.getItem('daftari-fp');
        if (v) $('#lock').style.setProperty('--fpB', v + 'px');
      } catch (e) {}
      let hold = 0,
        moving = false,
        moved = false;
      bb.addEventListener('pointerdown', e => {
        moved = false;
        hold = setTimeout(() => {
          moving = true;
          bb.classList.add('move');
          err(t('fpMove'));
          $('#lkE').classList.add('ok');
          try {
            navigator.vibrate && navigator.vibrate(30);
          } catch (x) {}
        }, 650);
      });
      bb.addEventListener('pointermove', e => {
        if (!moving) return;
        e.preventDefault();
        moved = true;
        const px = Math.max(8, Math.min(innerHeight * 0.6, innerHeight - e.clientY - 36));
        $('#lock').style.setProperty('--fpB', Math.round(px) + 'px');
      });
      const end = () => {
        clearTimeout(hold);
        if (moving) {
          moving = false;
          bb.classList.remove('move');
          const v = getComputedStyle($('#lock')).getPropertyValue('--fpB').trim();
          try {
            localStorage.setItem('daftari-fp', parseFloat(v));
          } catch (x) {}
          err(t('fpSaved'));
          $('#lkE').classList.add('ok');
        }
      };
      bb.addEventListener('pointerup', end);
      bb.addEventListener('pointercancel', end);
      bb.addEventListener(
        'click',
        e => {
          if (moved || bb.classList.contains('move')) {
            e.stopImmediatePropagation();
            e.preventDefault();
            moved = false;
          }
        },
        true
      );
    }
    LOCKBIO = () => {
      if (bioInfo() && !S && !document.hidden && !$('#lock').hidden) bioGo(true);
    };
    $('#lp1').addEventListener('focus', () => $('#lock').classList.add('typing'));
    $('#lp1').addEventListener('blur', () => setTimeout(() => $('#lock').classList.remove('typing'), 150));
    if (bb && window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable)
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => {});
    if (!setup)
      takeSession().then(pin => {
        if (pin && $('#lp1') && !S) {
          $('#lp1').value = pin;
          $('#lkF').requestSubmit();
        } else LOCKBIO();
      });
    else if (!needReg || REG)
      setTimeout(() => {
        const i = $('#lp1');
        if (i) i.focus();
      }, 80);
    $('#lkF').onsubmit = async e => {
      e.preventDefault();
      const p1 = $('#lp1').value;
      if (setup) {
        const p2 = $('#lp2').value;
        if (p1.length < 6) {
          err(t('pinShort'));
          return;
        }
        if (p1 !== p2) {
          err(t('pinMismatch'));
          return;
        }
      } else if (Date.now() < blockedUntil) {
        err(t('waitTry'));
        return;
      }
      /* sign in with Google first if this phone has not yet (skipped when offline) */
      /* first time on this phone: Google sign-in and Drive link are required before the PIN is created */
      if (setup && needReg && (!REG || (useWorker() && !drv.linked))) {
        if (!navigator.onLine) {
          err(t('needOnline'));
          return;
        }
        if (!driveReady()) {
          err(t('regLoading'));
          return;
        }
        {
          err(t('working'));
          try {
            if (useWorker()) await signUpWithDrive();
            else await doRegister();
            $('#acctW').innerHTML = acctHTML();
            bindG();
          } catch (x) {
            err(t('regDriveFail'));
            return;
          }
        }
      } else if (needReg && (!REG || (needDriveAtSignIn() && driveReady())) && navigator.onLine) {
        if (!driveReady()) {
          err(t('regLoading'));
          return;
        }
        const had = !!REG;
        err(t('working'));
        try {
          await doRegister();
          $('#acctW').innerHTML = acctHTML();
          bindG();
        } catch (x) {
          if (!had) {
            err(t('regFail'));
            return;
          }
          try {
            localStorage.setItem(DRVASK, '1');
          } catch (e) {}
        }
      }
      err(t('working'));
      if (setup) {
        SALT = crypto.getRandomValues(new Uint8Array(16));
        KEYOBJ = await derive(p1, SALT, ITER);
        PINMEM = p1;
        let legacy = null;
        try {
          const r = localStorage.getItem(KEY);
          if (r) legacy = JSON.parse(r);
        } catch (x) {}
        S = legacy && legacy.v ? Object.assign(blank(), legacy) : seed();
        S.lang = S.lang || LANG;
        save();
        await saving;
        try {
          localStorage.removeItem(KEY);
        } catch (x) {}
        unlocked();
        return;
      }
      try {
        const k = await derive(p1, fromB64(vt.salt), vt.iter || ITER);
        const o = await unseal(k, vt.iv, vt.ct);
        KEYOBJ = k;
        PINMEM = p1;
        SALT = fromB64(vt.salt);
        S = Object.assign(blank(), o);
        fails = 0;
        unlocked();
      } catch (x) {
        fails++;
        $('#lp1').value = '';
        if (fails >= 5) {
          blockedUntil = Date.now() + 30000;
          fails = 0;
          err(t('waitTry'));
        } else err(t('wrongPin'));
      }
    };
  }
