
const bioInfo=()=>{try{return JSON.parse(localStorage.getItem(BIO_KEY)||'null')}catch(e){return null}};
const bioSupported=()=>!!(window.PublicKeyCredential&&navigator.credentials&&window.isSecureContext);
async function prfKey(bytes){const k=await crypto.subtle.importKey('raw',bytes,'HKDF',false,['deriveKey']);return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(32),info:te.encode('daftari-bio')},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function bioPrf(credId,salt){
  goingOut();try{BIO_AC&&BIO_AC.abort()}catch(e){}BIO_AC=new AbortController();const a=await navigator.credentials.get({signal:BIO_AC.signal,publicKey:{challenge:crypto.getRandomValues(new Uint8Array(32)),allowCredentials:[{type:'public-key',id:credId,transports:['internal']}],hints:['client-device'],userVerification:'required',timeout:30000,extensions:{prf:{eval:{first:salt}}}}});BIO_AC=null;
  const r=a.getClientExtensionResults();if(!r.prf||!r.prf.results||!r.prf.results.first)throw new Error('noprf');return new Uint8Array(r.prf.results.first);
}
function bioEnableForm(){
  if(!bioSupported()){toast(t('bioUnsupported'));return}
  openSheet(t('bioOn'),`<form class="form" id="f"><p class="hint">${t('bioHint')}</p><label class="fld"><span>${t('curPin')}</span><input class="in-f pin" type="password" inputmode="numeric" id="p0" autocomplete="off"></label><p class="err" id="be"></p><div class="foot"><button class="btn pri grow">${t('bioSetup')}</button></div></form>`,r=>{
    const err=m=>r.querySelector('#be').textContent=m;setTimeout(()=>r.querySelector('#p0').focus(),60);
    r.querySelector('#f').onsubmit=async e=>{e.preventDefault();const pin=r.querySelector('#p0').value;
      try{err(t('working'));const vt=readVault();const k=await derive(pin,fromB64(vt.salt),vt.iter);await unseal(k,vt.iv,vt.ct)}catch(x){err(t('wrongPin'));return}
      try{
        const salt=crypto.getRandomValues(new Uint8Array(32));
        goingOut();const cred=await navigator.credentials.create({publicKey:{rp:{name:'Daftari',id:location.hostname},user:{id:crypto.getRandomValues(new Uint8Array(16)),name:myEmail()||'daftari',displayName:t('app')},
          challenge:crypto.getRandomValues(new Uint8Array(32)),pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
          authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'preferred'},hints:['client-device'],timeout:60000,extensions:{prf:{eval:{first:salt}}}}});
        const ext=cred.getClientExtensionResults();if(ext.prf&&ext.prf.enabled===false)throw new Error('noprf');
        const out=ext.prf&&ext.prf.results&&ext.prf.results.first?new Uint8Array(ext.prf.results.first):await bioPrf(cred.rawId,salt);
        const iv=crypto.getRandomValues(new Uint8Array(12)),ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await prfKey(out),te.encode(pin));
        localStorage.setItem(BIO_KEY,JSON.stringify({id:toB64(cred.rawId),salt:toB64(salt),iv:toB64(iv),ct:toB64(ct)}));
        closeSheet();toast(t('bioDone'));render();
      }catch(x){err(x&&x.message==='noprf'?t('bioUnsupported'):t('bioFail'))}
    };
  });
}
async function bioUnlockPin(){const b=bioInfo();if(!b)throw new Error('none');const out=await bioPrf(fromB64(b.id),fromB64(b.salt));
  return td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(b.iv)},await prfKey(out),fromB64(b.ct)))}
function bioOff(){try{localStorage.removeItem(BIO_KEY)}catch(e){}toast(t('bioOffMsg'));render()}
const recInfo=()=>{try{return JSON.parse(localStorage.getItem(REC_KEY)||'null')}catch(e){return null}};
const isSysFile=n=>n.startsWith('receipt_')||n.startsWith('summary_')||n===REC_FILE;
async function recKeyFrom(b64){const k=await crypto.subtle.importKey('raw',fromB64(b64),'HKDF',false,['deriveKey']);return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(32),info:te.encode('daftari-recovery')},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
async function recFetch(create){
  const folder=await ensureFolder(),q=encodeURIComponent("'"+folder+"' in parents and name='"+REC_FILE+"' and trashed=false");
  const j=await (await gfetch('/drive/v3/files?q='+q+'&fields=files(id)&spaces=drive')).json();
  if(j.files&&j.files.length){const o=await (await gfetch('/drive/v3/files/'+j.files[0].id+'?alt=media')).json();if(o&&o.r)return o.r}
  if(!create)return null;
  const r=toB64(crypto.getRandomValues(new Uint8Array(32))),bd='rc'+uid();
  const meta=JSON.stringify({name:REC_FILE,parents:[folder],mimeType:'application/json',description:'Daftari recovery key. Do not delete.'});
  const body='--'+bd+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+bd+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify({app:'daftari-recovery',r})+'\r\n--'+bd+'--';
  await gfetch(GAPI+'/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+bd},body});
  return r;
}
async function recSetup(force){
  if(!PINMEM||!drv.linked||!KEYOBJ)return;
  const cur=recInfo();if(cur&&!force&&cur.email===drv.email)return;
  try{if(!(await ensureAccess()))return;
    const r=await recFetch(true),iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await recKeyFrom(r),te.encode(PINMEM));
    localStorage.setItem(REC_KEY,JSON.stringify({email:drv.email,iv:toB64(iv),ct:toB64(ct)}));
  }catch(e){}
}
async function recRecoverPin(){
  const rc=recInfo();if(!rc)throw new Error('none');
  if(!hasToken()){if(useWorker()){const j=await workerCall('/exchange',{code:await requestCode(false,false,rc.email)});setAccess(j)}else await requestToken('')}
  const r=await recFetch(false);if(!r)throw new Error('nokey');
  return td.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(rc.iv)},await recKeyFrom(r),fromB64(rc.ct)));
}
function showLock(){
  const vt=readVault(),setup=!vt,needReg=!!CFG.authWorker;LOCKSETUP=setup;
  const de=document.documentElement;de.lang=LANG;de.dir=LANG==='en'?'ltr':'rtl';
  $('#lkBrand').textContent=t('app');
  $('#lkT').textContent=setup?t('setupTitle'):'';$('#lkT').hidden=!setup;
  $('#lkH').textContent=setup?t('pinMin'):'';
  $('#lkE').textContent='';
  $('#lkF').innerHTML=`${needReg?`<div id="acctW">${acctHTML()}</div>`:''}
    
    <div id="pinW" style="display:grid;gap:10px">
    <input class="in-f pin" type="password" inputmode="numeric" autocomplete="off" id="lp1" aria-label="${t('pin1')}" placeholder="${t('pin1')}">
    ${setup?`<input class="in-f pin" type="password" inputmode="numeric" autocomplete="off" id="lp2" aria-label="${t('pin2')}" placeholder="${t('pin2')}">`:''}
    <button class="btn pri block">${setup?t('create'):t('open')}</button></div>
    ${!setup&&bioSupported()?`<button type="button" class="fpbtn ${bioInfo()?'on':''}" id="bioBtn" aria-label="${t('bioUnlock')}">${FP_SVG}</button>`:''}
    ${needReg?`<p class="hint" style="text-align:center;margin:0"><a href="privacy.html" target="_blank" rel="noopener" style="color:var(--muted)">${t('privacy')}</a></p>`:''}`;
  $('#lkForgot').hidden=setup;$('#lkForgot').textContent=t('forgot');
  $('#lock').hidden=false;
  const err=m=>{$('#lkE').classList.remove('ok');$('#lkE').textContent=m};
  const bindG=()=>{const g=$('#gbtn');if(g)g.onclick=async()=>{if(!driveReady()){err(t('regLoading'));return}err(t('working'));
    try{await doRegister();$('#acctW').innerHTML=acctHTML();err('');$('#lp1').focus()}catch(x){err(t('regFail'))}}};
  bindG();
  let bioBusy=false;const bioGo=async auto=>{if(bioBusy&&auto)return;bioBusy=true;try{const pin=await bioUnlockPin();$('#lp1').value=pin;$('#lkF').requestSubmit()}catch(x){if(!auto)err(t('bioFail'))}bioBusy=false};
  const bb=$('#bioBtn');if(bb)bb.onclick=()=>{if(bioInfo())bioGo(false);else{BIO_AFTER=true;bb.classList.add('wait');err(t('bioAfterPin'));$('#lkE').classList.add('ok');$('#lp1').focus()}};
  if(bb){try{const v=localStorage.getItem('daftari-fp');if(v)$('#lock').style.setProperty('--fpB',v+'px')}catch(e){}
    let hold=0,moving=false,moved=false;
    bb.addEventListener('pointerdown',e=>{moved=false;hold=setTimeout(()=>{moving=true;bb.classList.add('move');err(t('fpMove'));$('#lkE').classList.add('ok');try{navigator.vibrate&&navigator.vibrate(30)}catch(x){}},650)});
    bb.addEventListener('pointermove',e=>{if(!moving)return;e.preventDefault();moved=true;const px=Math.max(8,Math.min(innerHeight*.6,innerHeight-e.clientY-36));$('#lock').style.setProperty('--fpB',Math.round(px)+'px')});
    const end=()=>{clearTimeout(hold);if(moving){moving=false;bb.classList.remove('move');const v=getComputedStyle($('#lock')).getPropertyValue('--fpB').trim();try{localStorage.setItem('daftari-fp',parseFloat(v))}catch(x){}err(t('fpSaved'));$('#lkE').classList.add('ok')}};
    bb.addEventListener('pointerup',end);bb.addEventListener('pointercancel',end);
    bb.addEventListener('click',e=>{if(moved||bb.classList.contains('move')){e.stopImmediatePropagation();e.preventDefault();moved=false}},true);
  }
  LOCKBIO=()=>{if(bioInfo()&&!S&&!document.hidden&&!$('#lock').hidden)bioGo(true)};
  $('#lp1').addEventListener('focus',()=>$('#lock').classList.add('typing'));$('#lp1').addEventListener('blur',()=>setTimeout(()=>$('#lock').classList.remove('typing'),150));
  if(bb&&window.PublicKeyCredential&&PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable)PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(()=>{});
  if(!setup)takeSession().then(pin=>{if(pin&&$('#lp1')&&!S){$('#lp1').value=pin;$('#lkF').requestSubmit()}else LOCKBIO()});
  else if(!needReg||REG)setTimeout(()=>{const i=$('#lp1');if(i)i.focus()},80);
  $('#lkF').onsubmit=async e=>{e.preventDefault();
    const p1=$('#lp1').value;
    if(setup){const p2=$('#lp2').value;if(p1.length<6){err(t('pinShort'));return}if(p1!==p2){err(t('pinMismatch'));return}}
    else if(Date.now()<blockedUntil){err(t('waitTry'));return}
    /* sign in with Google first if this phone has not yet (skipped when offline) */
    /* first time on this phone: Google sign-in and Drive link are required before the PIN is created */
    if(setup&&needReg&&(!REG||(useWorker()&&!drv.linked))){
      if(!navigator.onLine){err(t('needOnline'));return}
      if(!driveReady()){err(t('regLoading'));return}
      {err(t('working'));
        try{if(useWorker())await signUpWithDrive();else await doRegister();$('#acctW').innerHTML=acctHTML();bindG()}
        catch(x){err(t('regDriveFail'));return}}
    }
    else if(needReg&&(!REG||(needDriveAtSignIn()&&driveReady()))&&navigator.onLine){
      if(!driveReady()){err(t('regLoading'));return}
      const had=!!REG;err(t('working'));
      try{await doRegister();$('#acctW').innerHTML=acctHTML();bindG()}
      catch(x){if(!had){err(t('regFail'));return}try{localStorage.setItem(DRVASK,'1')}catch(e){}}
    }
    err(t('working'));
    if(setup){
      SALT=crypto.getRandomValues(new Uint8Array(16));KEYOBJ=await derive(p1,SALT,ITER);PINMEM=p1;
      let legacy=null;try{const r=localStorage.getItem(KEY);if(r)legacy=JSON.parse(r)}catch(x){}
      S=legacy&&legacy.v?Object.assign(blank(),legacy):seed();S.lang=S.lang||LANG;
      save();await saving;try{localStorage.removeItem(KEY)}catch(x){}
      unlocked();return}
    try{const k=await derive(p1,fromB64(vt.salt),vt.iter||ITER);const o=await unseal(k,vt.iv,vt.ct);KEYOBJ=k;PINMEM=p1;SALT=fromB64(vt.salt);S=Object.assign(blank(),o);fails=0;unlocked()}
    catch(x){fails++;$('#lp1').value='';if(fails>=5){blockedUntil=Date.now()+30000;fails=0;err(t('waitTry'))}else err(t('wrongPin'))}
  };
}
function unlocked(){EXT=0;REC_LATER=new Set();setTimeout(()=>{try{runRecurring();showRecPopup()}catch(e){}},700);if(BIO_AFTER){BIO_AFTER=false;const pin=PINMEM;setTimeout(()=>{bioEnableForm();const i=$('#shB #p0');if(i)i.value=pin},700)}if(RECOVERED){const k=RECOVERED;RECOVERED=null;setTimeout(()=>changePinForm(k),400)}$('#lock').hidden=true;$('#lkF').innerHTML='';LANG=S.lang;ACT='me';SHM=null;migrate();PS=S;if(pendingJoin)setTimeout(joinSheet,300);if(pendingShare){const txt=pendingShare;pendingShare=null;setTimeout(()=>quickFromText(txt),350)}render();runRecurring();maybeUpdateRates();setTimeout(pushKeep,4000);writeReminders();maybeAskClose();loadRT().then(async()=>{if(PENDING_RT&&KEYOBJ){RT=PENDING_RT;PENDING_RT=null;await saveRT()}
    if(FRESH_DRIVE&&drv.linked){FRESH_DRIVE=false;try{const f=await ensureFolder();const has=(await driveList(f,10)).some(x=>!isSysFile(x.name));if(has){toast(t('foundBackup'));driveRestore()}else syncDrive(true)}catch(e){}}
    if(drv.linked&&useWorker()&&!RT&&!hasToken()&&S){drv.needAuth=true;render()}
    setTimeout(()=>recSetup(false),1500)})}
function lockNow(){if(NEWVER&&NEWVER!==APP_VER)setTimeout(checkUpdate,300);clearTimeout(bkTimer);if(ACT!=='me'&&shDirty)shPush();stopPoll();ACT='me';SHM=null;PS=null;closeSheet();S=null;KEYOBJ=null;SALT=null;RT=null;PINMEM=null;$('#view').innerHTML='';showLock()}function goingOut(){EXT=Date.now()}
function forgotWipe(){
  $('#lkT').textContent=t('forgotConfirm');$('#lkH').textContent='';$('#lkE').textContent='';$('#lkForgot').hidden=true;
  $('#lkF').innerHTML=`<div class="foot"><button type="button" class="btn grow" id="fNo">${t('cancel')}</button><button type="button" class="btn grow" id="fYes" style="background:var(--neg);border-color:var(--neg);color:#fff">${t('del')}</button></div>`;
  $('#fNo').onclick=showLock;
  $('#fYes').onclick=()=>{try{localStorage.removeItem(VAULT);localStorage.removeItem(KEY);localStorage.removeItem('daftari-rt');localStorage.removeItem('daftari-gtoken');localStorage.removeItem(REC_KEY);localStorage.removeItem(BIO_KEY)}catch(e){}showLock()};
}
/* black cover the moment the app loses focus (app switcher, notifications, another app), so the phone's recent-apps picture shows nothing */
const cover=on=>{const c=$('#privacy');if(c)c.hidden=!on};
async function checkUpdate(){
  if(!navigator.onLine||location.protocol!=='https:')return;
  try{const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const v=String((await r.json()).v||'');
    if(!v||v===APP_VER)return;NEWVER=v;let tried='';try{tried=sessionStorage.getItem('daftari-upd')||''}catch(e){}
    if(!S&&!($('#lp1')&&$('#lp1').value)&&tried!==v){try{sessionStorage.setItem('daftari-upd',v)}catch(e){}await updateNow();return}
    if(S)render()}catch(e){}
}
async function updateNow(){if(S)await keepSession();try{const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.update()));const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}catch(e){}location.reload()}
