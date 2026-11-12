/* The lock screen: PIN, fingerprint and recovery. (part 1 of 3) */
  const bioInfo = () => {
    try {
      return JSON.parse(localStorage.getItem(BIO_KEY) || 'null');
    } catch (e) {
      return null;
    }
  };
  const bioSupported = () => !!(window.PublicKeyCredential && navigator.credentials && window.isSecureContext);
  async function prfKey(bytes) {
    const k = await crypto.subtle.importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode('daftari-bio')},
      k,
      {name: 'AES-GCM', length: 256},
      false,
      ['encrypt', 'decrypt']
    );
  }
  async function bioPrf(credId, salt) {
    goingOut();
    try {
      BIO_AC && BIO_AC.abort();
    } catch (e) {}
    BIO_AC = new AbortController();
    const a = await navigator.credentials.get({
      signal: BIO_AC.signal,
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: [{type: 'public-key', id: credId, transports: ['internal']}],
        hints: ['client-device'],
        userVerification: 'required',
        timeout: 30000,
        extensions: {prf: {eval: {first: salt}}}
      }
    });
    BIO_AC = null;
    const r = a.getClientExtensionResults();
    if (!r.prf || !r.prf.results || !r.prf.results.first) throw new Error('noprf');
    return new Uint8Array(r.prf.results.first);
  }
  /* why a sheet and not a toast: the person needs to know what to do next, and that moving browsers does not move data */
  function bioHelp(kind) {
    const android = /Android/i.test(navigator.userAgent),
      chrome = !!(navigator.userAgentData && navigator.userAgentData.brands.some(b => b.brand === 'Google Chrome'));
    const url =
      'intent://' +
      location.host +
      location.pathname +
      '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' +
      encodeURIComponent('https://play.google.com/store/apps/details?id=com.android.chrome') +
      ';end';
    openSheet(
      t('bioOn'),
      `<div class="form"><p>${esc(t(kind === 'prf' ? 'bioNoPrf' : 'bioNoBrowser'))}</p>
    ${chrome ? '' : `<p class="hint">${esc(t('bioMove'))}</p>`}
    ${android && !chrome ? `<div class="foot"><a class="btn pri grow" style="text-decoration:none" href="${esc(url)}">${esc(t('openChrome'))}</a></div>` : ''}</div>`
    );
  }
  function bioEnableForm() {
    if (!bioSupported()) {
      bioHelp('browser');
      return;
    }
    openSheet(
      t('bioOn'),
      `<form class="form" id="f"><p class="hint">${t('bioHint')}</p><label class="fld"><span>${t('curPin')}</span><input class="in-f pin" type="password" inputmode="numeric" id="p0" autocomplete="off"></label><p class="err" id="be"></p><div class="foot"><button class="btn pri grow">${t('bioSetup')}</button></div></form>`,
      r => {
        const err = m => (r.querySelector('#be').textContent = m);
        setTimeout(() => r.querySelector('#p0').focus(), 60);
        r.querySelector('#f').onsubmit = async e => {
          e.preventDefault();
          const pin = r.querySelector('#p0').value;
          try {
            err(t('working'));
            const vt = readVault();
            const k = await derive(pin, fromB64(vt.salt), vt.iter);
            await unseal(k, vt.iv, vt.ct);
          } catch (x) {
            err(t('wrongPin'));
            return;
          }
          try {
            const salt = crypto.getRandomValues(new Uint8Array(32));
            goingOut();
            const cred = await navigator.credentials.create({
              publicKey: {
                rp: {name: 'Daftari', id: location.hostname},
                user: {
                  id: crypto.getRandomValues(new Uint8Array(16)),
                  name: myEmail() || 'daftari',
                  displayName: t('app')
                },
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                pubKeyCredParams: [
                  {type: 'public-key', alg: -7},
                  {type: 'public-key', alg: -257}
                ],
                authenticatorSelection: {
                  authenticatorAttachment: 'platform',
                  userVerification: 'required',
                  residentKey: 'preferred'
                },
                hints: ['client-device'],
                timeout: 60000,
                extensions: {prf: {eval: {first: salt}}}
              }
            });
            const ext = cred.getClientExtensionResults();
            if (ext.prf && ext.prf.enabled === false) throw new Error('noprf');
            const out =
              ext.prf && ext.prf.results && ext.prf.results.first
                ? new Uint8Array(ext.prf.results.first)
                : await bioPrf(cred.rawId, salt);
            const iv = crypto.getRandomValues(new Uint8Array(12)),
              ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await prfKey(out), te.encode(pin));
            localStorage.setItem(
              BIO_KEY,
              JSON.stringify({id: toB64(cred.rawId), salt: toB64(salt), iv: toB64(iv), ct: toB64(ct)})
            );
            closeSheet();
            toast(t('bioDone'));
            render();
          } catch (x) {
            if (x && x.message === 'noprf') {
              closeSheet();
              setTimeout(() => bioHelp('prf'), 250);
            } else err(t('bioFail'));
          }
        };
      }
    );
  }
  async function bioUnlockPin() {
    const b = bioInfo();
    if (!b) throw new Error('none');
    const out = await bioPrf(fromB64(b.id), fromB64(b.salt));
    return td.decode(
      await crypto.subtle.decrypt({name: 'AES-GCM', iv: fromB64(b.iv)}, await prfKey(out), fromB64(b.ct))
    );
  }
  function bioOff() {
    try {
      localStorage.removeItem(BIO_KEY);
    } catch (e) {}
    toast(t('bioOffMsg'));
    render();
  }
  const recInfo = () => {
    try {
      return JSON.parse(localStorage.getItem(REC_KEY) || 'null');
    } catch (e) {
      return null;
    }
  };
  const isSysFile = n => n.startsWith('receipt_') || n.startsWith('summary_') || n === REC_FILE;
  async function recKeyFrom(b64) {
    const k = await crypto.subtle.importKey('raw', fromB64(b64), 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      {name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: te.encode('daftari-recovery')},
      k,
      {name: 'AES-GCM', length: 256},
      false,
      ['encrypt', 'decrypt']
    );
  }
  async function recFetch(create) {
    const folder = await ensureFolder(),
      q = encodeURIComponent("'" + folder + "' in parents and name='" + REC_FILE + "' and trashed=false");
    const j = await (await gfetch('/drive/v3/files?q=' + q + '&fields=files(id)&spaces=drive')).json();
    if (j.files && j.files.length) {
      const o = await (await gfetch('/drive/v3/files/' + j.files[0].id + '?alt=media')).json();
      if (o && o.r) return o.r;
    }
    if (!create) return null;
    const r = toB64(crypto.getRandomValues(new Uint8Array(32))),
      bd = 'rc' + uid();
    const meta = JSON.stringify({
      name: REC_FILE,
      parents: [folder],
      mimeType: 'application/json',
      description: 'Daftari recovery key. Do not delete.'
    });
    const body =
      '--' +
      bd +
      '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
      meta +
      '\r\n--' +
      bd +
      '\r\nContent-Type: application/json\r\n\r\n' +
      JSON.stringify({app: 'daftari-recovery', r}) +
      '\r\n--' +
      bd +
      '--';
    await gfetch(GAPI + '/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: {'Content-Type': 'multipart/related; boundary=' + bd},
      body
    });
    return r;
  }
  async function recSetup(force) {
    if (!PINMEM || !drv.linked || !KEYOBJ) return;
    const cur = recInfo();
    if (cur && !force && cur.email === drv.email) return;
    try {
      if (!(await ensureAccess())) return;
      const r = await recFetch(true),
        iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await recKeyFrom(r), te.encode(PINMEM));
      localStorage.setItem(REC_KEY, JSON.stringify({email: drv.email, iv: toB64(iv), ct: toB64(ct)}));
    } catch (e) {}
  }
  async function recRecoverPin() {
    const rc = recInfo();
    if (!rc) throw new Error('none');
    if (!hasToken()) {
      if (useWorker()) {
        const j = await workerCall('/exchange', {code: await requestCode(false, false, rc.email)});
        setAccess(j);
      } else await requestToken('');
    }
    const r = await recFetch(false);
    if (!r) throw new Error('nokey');
    return td.decode(
      await crypto.subtle.decrypt({name: 'AES-GCM', iv: fromB64(rc.iv)}, await recKeyFrom(r), fromB64(rc.ct))
    );
  }
