/* Backup and restore screens. */
  /* a readable copy for a review: asks for the PIN again and warns that the file is not encrypted */
  function reviewExport() {
    openSheet(
      t('reviewExport'),
      `<form class="form" id="f"><p class="hint" style="color:var(--neg)">⚠️ ${t('reviewWarn')}</p>
    <label class="fld"><span>${t('curPin')}</span><input class="in-f pin" type="password" inputmode="numeric" id="rp0" autocomplete="off"></label><p class="err" id="re"></p>
    <div class="foot"><button class="btn pri grow">${t('reviewGo')}</button></div></form>`,
      r => {
        r.querySelector('#f').onsubmit = async e => {
          e.preventDefault();
          if (!PINMEM || r.querySelector('#rp0').value !== PINMEM) {
            r.querySelector('#re').textContent = t('wrongPin');
            return;
          }
          await saving;
          const data = JSON.stringify({
            app: 'daftar-elbeit',
            enc: 0,
            review: 1,
            created: new Date().toISOString(),
            data: PS || S
          });
          closeSheet();
          await deliverFile(new Blob([data], {type: 'application/json'}), 'daftari_review_' + fileStamp() + '.json');
        };
      }
    );
  }
  async function saveToPhone(quiet) {
    if (!KEYOBJ) return false;
    const data = await makeBackup(),
      fn = backupName();
    const dw = await getDownloads();
    if (dw) {
      try {
        await dw.save({filename: fn, data});
        markBackup();
        if (!quiet) toast(t('saved'));
        return true;
      } catch (e) {
        return false;
      }
    }
    if (window.claude) {
      if (!quiet) toast(t('dlUnavailable'));
      return false;
    }
    try {
      const u = URL.createObjectURL(new Blob([data], {type: 'application/json'}));
      const a = document.createElement('a');
      a.href = u;
      a.download = fn;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 3000);
      markBackup();
      return true;
    } catch (e) {
      return false;
    }
  }
  function afterChange() {
    clearTimeout(bkTimer);
    if (S && S.autoDl)
      bkTimer = setTimeout(() => {
        saveToPhone(true).then(ok => {
          if (ok && tab === 'set') render();
        });
      }, 4000);
    markChange();
    scheduleDrive();
  }
  async function copyBackup() {
    const data = await makeBackup();
    const ok = () => {
      markBackup();
      toast(t('copied'));
      if (tab === 'set') render();
    };
    const fb = () =>
      openSheet(
        t('copyText'),
        `<div class="form"><p class="hint">${t('exportHint')}</p><textarea class="in-f" id="ex" readonly>${esc(data)}</textarea></div>`,
        r => {
          const ta = r.querySelector('#ex');
          ta.focus();
          ta.select();
        }
      );
    try {
      navigator.clipboard.writeText(data).then(ok, fb);
    } catch (e) {
      fb();
    }
  }
  function doImport(prefill) {
    openSheet(
      t('importB'),
      `<div class="form"><label class="fld"><span>${t('chooseFile')}</span><input class="in-f" type="file" id="fl" accept=".json,.txt,application/json,text/plain"></label>
    <label class="fld"><span>${t('pasteHere')}</span><textarea class="in-f" id="ps"></textarea></label>
    <label class="fld"><span>${t('backupPin')}</span><input class="in-f pin" type="password" inputmode="numeric" autocomplete="off" id="bp"></label>
    <p class="err" id="ie"></p>
    <div class="foot"><button class="btn pri grow" id="go">${t('restore')}</button></div></div>`,
      r => {
        const err = m => (r.querySelector('#ie').textContent = m);
        if (prefill) r.querySelector('#ps').value = prefill;
        r.querySelector('#fl').onchange = ev => {
          const f = ev.target.files[0];
          if (!f) return;
          const fr = new FileReader();
          fr.onload = () => {
            r.querySelector('#ps').value = fr.result;
          };
          fr.readAsText(f);
        };
        r.querySelector('#go').onclick = async () => {
          const v = r.querySelector('#ps').value.trim();
          let o;
          try {
            o = JSON.parse(v);
          } catch (e) {
            err(t('badFile'));
            return;
          }
          let data = null;
          if (o && o.enc && o.salt && o.ct) {
            err(t('working'));
            try {
              const k = await derive(r.querySelector('#bp').value, fromB64(o.salt), o.iter || ITER);
              data = await unseal(k, o.iv, o.ct);
            } catch (e) {
              err(t('wrongPin'));
              return;
            }
          } else if (o && o.v && Array.isArray(o.tx)) data = o;
          if (!data || !Array.isArray(data.tx)) {
            err(t('badFile'));
            return;
          }
          err('');
          if (ACT !== 'me') {
            toast(t('restorePersonal'));
            return;
          }
          confirmSheet(t('restoreConfirm'), t('restore'), () => {
            delete data.app;
            delete data.exported;
            const keep = PS.ledgers;
            S = Object.assign(blank(), data);
            if (!S.ledgers || !S.ledgers.length) S.ledgers = keep;
            S.sample = false;
            PS = S;
            commit(t('restored'));
          });
        };
      }
    );
  }
  function changePinForm(known) {
    openSheet(
      t('changePin'),
      `<form class="form" id="f">
    ${known ? `<p class="hint">${t('recSetNew')}</p><input type="hidden" id="p0">` : `<label class="fld"><span>${t('curPin')}</span><input class="in-f pin" type="password" inputmode="numeric" autocomplete="off" id="p0"></label>`}
    <label class="fld"><span>${t('newPin')}</span><input class="in-f pin" type="password" inputmode="numeric" autocomplete="off" id="p1"></label>
    <label class="fld"><span>${t('pin2')}</span><input class="in-f pin" type="password" inputmode="numeric" autocomplete="off" id="p2"></label>
    <p class="hint">${t('pinChangeHint')}</p><p class="err" id="pe"></p>
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,
      r => {
        const err = m => (r.querySelector('#pe').textContent = m);
        if (known) r.querySelector('#p0').value = known;
        r.querySelector('#f').onsubmit = async e => {
          e.preventDefault();
          const p0 = r.querySelector('#p0').value,
            p1 = r.querySelector('#p1').value,
            p2 = r.querySelector('#p2').value;
          if (p1.length < 6) {
            err(t('pinShort'));
            return;
          }
          if (p1 !== p2) {
            err(t('pinMismatch'));
            return;
          }
          err(t('working'));
          try {
            const vt = readVault();
            const k = await derive(p0, fromB64(vt.salt), vt.iter);
            await unseal(k, vt.iv, vt.ct);
          } catch (x) {
            err(t('wrongPin'));
            return;
          }
          const caches = [];
          for (const m of (PS && PS.ledgers) || []) caches.push([m, await cacheLoad(m)]);
          await saving;
          SALT = crypto.getRandomValues(new Uint8Array(16));
          KEYOBJ = await derive(p1, SALT, ITER);
          await saveRT();
          for (const [m, D] of caches) if (D) await cacheSave(m, D);
          try {
            if (localStorage.getItem(BIO_KEY)) {
              localStorage.removeItem(BIO_KEY);
              toast(t('bioReset'));
            }
          } catch (e) {}
          if (ACT !== 'me' && PS) vaultSave(PS);
          PINMEM = p1;
          recSetup(true);
          closeSheet();
          commit(t('pinChanged'));
          if (known) setTimeout(() => syncDrive(true), 500);
        };
      }
    );
  }
