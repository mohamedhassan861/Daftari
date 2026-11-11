/* Shared ledgers: encryption key, merge and upload. (part 2 of 3; continues from shared-1.js) */
  async function createLedger(name) {
    if (!drv.linked) {
      toast(t('needDriveShare'));
      return;
    }
    try {
      if (!(await ensureAccess())) await authorize(false);
    } catch (e) {
      return;
    }
    const P = PS,
      now = Date.now(),
      D = blank();
    Object.assign(D, {
      name,
      base: P.base,
      rates: Object.assign({}, P.rates),
      ratesAt: P.ratesAt,
      cats: JSON.parse(JSON.stringify(P.cats)),
      rk: toB64(crypto.getRandomValues(new Uint8Array(32))),
      sample: false,
      _del: {},
      _su: now,
      _bu: now,
      accounts: [{id: 'cash', type: 'cash', name: lng() === 'en' ? 'Cash' : 'كاش', currency: P.base, opening: 0}]
    });
    colsOf(D).forEach(([, a]) => a.forEach(r => (r.u = now)));
    const m = {
      id: '',
      name,
      key: toB64u(crypto.getRandomValues(new Uint8Array(32))),
      role: 'writer',
      owner: true,
      ownerEmail: drv.email
    };
    try {
      m.fileId = await shCreateFile(m, D);
      m.id = m.fileId;
    } catch (e) {
      toast(t('shareSyncFail'));
      return;
    }
    D.members = [myEmail()].filter(Boolean);
    PS.ledgers.push(m);
    vaultSave(PS);
    await cacheSave(m, D);
    await switchLedger(m.id);
    inviteForm(m);
  }
  const joinLink = m =>
    location.origin + location.pathname.replace(/index\.html$/, '') + '#join.' + m.fileId + '.' + m.key;
  function inviteForm(m) {
    openSheet(
      t('invite') + ' · ' + m.name,
      `<form class="form" id="f">
    <p class="hint">${t('inviteHint')}</p>
    <label class="fld"><span>${t('emailOf')}</span><input class="in-f" type="email" id="em" autocomplete="off" dir="ltr" placeholder="name@gmail.com"></label>
    <label class="fld"><span>${t('canDo')}</span><select class="in-f" id="ro"><option value="writer">${t('roleWriter')}</option><option value="reader">${t('roleReader')}</option></select></label>
    <div class="foot"><button class="btn pri grow">${t('sendInvite')}</button></div>
    <div id="lk" hidden class="form"><p class="hint">${t('sendLink')}</p><input class="in-f" readonly dir="ltr" value="${esc(joinLink(m))}" id="lkv"><div class="foot"><button type="button" class="btn grow" id="cp">${t('copy')}</button><button type="button" class="btn pri grow" id="sh">${t('shareApp')}</button></div></div>
    <div id="mem" class="list"></div>
  </form>`,
      r => {
        const $r = q => r.querySelector(q);
        const loadMembers = async () => {
          try {
            const j = await (
              await gfetch(
                '/drive/v3/files/' + m.fileId + '/permissions?fields=permissions(id,emailAddress,role,type,displayName)'
              )
            ).json();
            $r('#mem').innerHTML =
              `<div class="grp"><span>${t('ledMembers')}</span></div>` +
              (j.permissions || [])
                .map(
                  p => `<div class="row"><div class="main"><span class="t" dir="ltr" style="text-align:start">${esc(p.emailAddress || p.displayName || '')}</span><span class="s">${p.role === 'owner' ? t('roleOwner') : p.role === 'reader' ? t('roleReader') : t('roleWriter')}</span></div>
        ${p.role === 'owner' ? '' : `<button type="button" class="btn sm" data-pr="${p.id}" data-to="${p.role === 'reader' ? 'writer' : 'reader'}">${p.role === 'reader' ? t('makeWriter') : t('makeReader')}</button><button type="button" class="btn sm danger" data-pd="${p.id}">${t('remove')}</button>`}</div>`
                )
                .join('');
            $r('#mem')
              .querySelectorAll('[data-pr]')
              .forEach(
                b =>
                  (b.onclick = async () => {
                    await gfetch('/drive/v3/files/' + m.fileId + '/permissions/' + b.dataset.pr, {
                      method: 'PATCH',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({role: b.dataset.to})
                    });
                    loadMembers();
                  })
              );
            $r('#mem')
              .querySelectorAll('[data-pd]')
              .forEach(
                b =>
                  (b.onclick = async () => {
                    await gfetch('/drive/v3/files/' + m.fileId + '/permissions/' + b.dataset.pd, {method: 'DELETE'});
                    loadMembers();
                  })
              );
          } catch (e) {}
        };
        const showLink = () => {
          $r('#lk').hidden = false;
          $r('#cp').onclick = () => {
            navigator.clipboard.writeText(joinLink(m)).then(
              () => toast(t('copied')),
              () => {
                $r('#lkv').select();
              }
            );
          };
          $r('#sh').onclick = async () => {
            try {
              await navigator.share({
                title: t('app') + ' · ' + m.name,
                text: t('joinText') + ' ' + m.name,
                url: joinLink(m)
              });
            } catch (e) {}
          };
        };
        if (m.owner) {
          loadMembers();
          showLink();
        } else {
          $r('#f').hidden = false;
        }
        $r('#f').onsubmit = async e => {
          e.preventDefault();
          const em = val(r, 'em').toLowerCase();
          if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) {
            toast(t('badEmail'));
            return;
          }
          try {
            if (!(await needAccess())) return;
            await gfetch(
              '/drive/v3/files/' +
                m.fileId +
                '/permissions?sendNotificationEmail=true&emailMessage=' +
                encodeURIComponent(t('joinText') + ' ' + m.name),
              {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({type: 'user', role: val(r, 'ro'), emailAddress: em})
              }
            );
            toast(t('invited'));
            $r('#em').value = '';
            showLink();
            loadMembers();
          } catch (x) {
            toast(t('inviteFail'));
          }
        };
      }
    );
  }
  function loadPicker() {
    if (gapiP) return gapiP;
    gapiP = new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = 'https://apis.google.com/js/api.js';
      sc.onload = () => window.gapi.load('picker', {callback: res, onerror: rej});
      sc.onerror = () => {
        gapiP = null;
        rej(new Error('gapi'));
      };
      document.head.appendChild(sc);
    });
    return gapiP;
  }
  function pickFile(fileId) {
    return loadPicker().then(
      () =>
        new Promise((res, rej) => {
          const view = new google.picker.DocsView(google.picker.ViewId.DOCS)
            .setFileIds(fileId)
            .setMode(google.picker.DocsViewMode.LIST);
          new google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(gToken)
            .setDeveloperKey(CFG.pickerKey)
            .setAppId(CFG.appId || CFG.googleClientId.split('-')[0])
            .setTitle(t('pickTitle'))
            .setCallback(d => {
              if (d.action === google.picker.Action.PICKED) res(d.docs[0].id);
              else if (d.action === google.picker.Action.CANCEL) rej(new Error('cancel'));
            })
            .build()
            .setVisible(true);
        })
    );
  }
  function joinSheet() {
    const j = pendingJoin;
    if (!j) return;
    if (PS.ledgers.some(l => l.fileId === j.fileId)) {
      pendingJoin = null;
      switchLedger(j.fileId);
      return;
    }
    openSheet(
      t('joinTitle'),
      `<div class="form"><p class="hint">${t('joinHint')}</p>
    ${drv.linked ? '' : `<p class="hint"><b>${t('joinNeedDrive')}</b></p>`}
    <button type="button" class="btn pri block" id="go">${drv.linked ? t('joinOpen') : t('driveLink')}</button>
    <button type="button" class="btn block" id="no">${t('cancel')}</button></div>`,
      r => {
        r.querySelector('#no').onclick = () => {
          pendingJoin = null;
          closeSheet();
        };
        r.querySelector('#go').onclick = async () => {
          if (!drv.linked) {
            await driveConnect();
            joinSheet();
            return;
          }
          if (!CFG.pickerKey) {
            toast(t('pickerMissing'));
            return;
          }
          try {
            if (!(await ensureAccess())) await authorize(false);
            const id = await pickFile(j.fileId);
            const m = {id, fileId: id, key: j.key, role: 'writer', owner: false, name: ''};
            const D = await shDownload(m);
            m.name = D.name || t('sharedLedger');
            PS.ledgers.push(m);
            vaultSave(PS);
            await cacheSave(m, D);
            pendingJoin = null;
            await switchLedger(id);
            if (myEmail() && !(S.members || []).includes(myEmail())) {
              S.members = [...(S.members || []), myEmail()];
              commit();
            }
          } catch (e) {
            if (e && e.message !== 'cancel') toast(t('joinFail'));
          }
        };
      }
    );
  }
  function ledgersSheet() {
    const L2 = PS.ledgers || [],
      row = (id, name, sub, on) =>
        `<div class="row tap" data-sact="led" data-id="${id}"><div class="glyph ${on ? 'in' : ''}">${on ? '✓' : esc(initial(name))}</div><div class="main"><span class="t">${esc(name)}</span><span class="s">${sub}</span></div></div>`;
    openSheet(
      t('ledgers'),
      `<div class="form"><div class="list">
    ${row('me', t('myLedger'), t('onlyMe'), ACT === 'me')}
    ${L2.map(l => row(l.id, l.name, (l.owner ? t('roleOwner') : l.role === 'reader' ? t('roleReader') : t('roleWriter')) + (l.ownerEmail && !l.owner ? ' · ' + esc(l.ownerEmail) : ''), ACT === l.id)).join('')}
  </div>
  ${ACT !== 'me' ? `<div class="acts"><button type="button" class="btn" data-sact="ledInvite">${SHM.owner ? t('membersInvite') : t('membersShow')}</button><button type="button" class="btn danger" data-sact="ledLeave">${SHM.owner ? t('deleteLedger') : t('leaveLedger')}</button></div>` : ''}
  <form class="form" id="nf"><label class="fld"><span>${t('newShared')}</span><input class="in-f" id="nn" placeholder="${t('newSharedHint')}"></label><button class="btn pri block">${t('createLedger')}</button></form>
  <p class="hint">${t('ledgersHint')}</p></div>`,
      r => {
        r.querySelector('#nf').onsubmit = e => {
          e.preventDefault();
          const n = val(r, 'nn');
          if (!n) {
            toast(t('needName'));
            return;
          }
          closeSheet();
          createLedger(n);
        };
      }
    );
  }
