/* ---------- fingerprint unlock (passkey + PRF): the PIN is kept encrypted by a key only the fingerprint can release ---------- */
const BIO_KEY='daftari-bio';
const bioInfo=()=>{try{return JSON.parse(localStorage.getItem(BIO_KEY)||'null')}catch(e){return null}};
const bioSupported=()=>!!(window.PublicKeyCredential&&navigator.credentials&&window.isSecureContext);
async function prfKey(bytes){const k=await crypto.subtle.importKey('raw',bytes,'HKDF',false,['deriveKey']);return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:new Uint8Array(32),info:te.encode('daftari-bio')},k,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
let BIO_AC=null;
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


/* ---------- forgotten PIN: recover with the Google account instead of erasing ----------
   A random recovery key lives in the user's own Drive (Daftari folder). The phone keeps the PIN
   encrypted with that key, so signing in to the same Google account can open the vault again. */
const REC_KEY='daftari-rec',REC_FILE='daftari-recovery.json';
let PINMEM=null;
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

/* ---------- install (PWA) ---------- */
let installEvt=null;
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;if(S&&tab==='set')render()});
if('serviceWorker' in navigator&&location.protocol==='https:'){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})})}

/* ---------- lock ---------- */
const FP_SVG='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.81 4.47c-.08 0-.16-.02-.23-.06C15.66 3.42 14 3 12.01 3c-1.98 0-3.86.47-5.57 1.41-.24.13-.54.04-.68-.2-.13-.24-.04-.55.2-.68C7.82 2.52 9.86 2 12.01 2c2.13 0 3.99.47 6.03 1.52.25.13.34.43.21.67-.09.18-.26.28-.44.28zM3.5 9.72c-.1 0-.2-.03-.29-.09-.23-.16-.28-.47-.12-.7.99-1.4 2.25-2.5 3.75-3.27C9.98 4.04 14 4.03 17.15 5.65c1.5.77 2.76 1.86 3.75 3.25.16.22.11.54-.12.7-.23.16-.54.11-.7-.12-.9-1.26-2.040-2.25-3.39-2.94-2.87-1.47-6.54-1.47-9.4.01-1.36.7-2.5 1.7-3.4 2.96-.08.14-.23.21-.39.21zm6.25 12.07c-.13 0-.26-.05-.35-.15-.87-.87-1.34-1.43-2.01-2.64-.69-1.23-1.05-2.73-1.05-4.34 0-2.97 2.54-5.390 5.66-5.39s5.66 2.42 5.66 5.39c0 .28-.22.5-.5.5s-.5-.22-.5-.5c0-2.42-2.09-4.39-4.66-4.39-2.57 0-4.66 1.97-4.66 4.39 0 1.44.32 2.77.93 3.85.64 1.15 1.08 1.64 1.85 2.42.19.2.19.51 0 .71-.11.1-.24.15-.37.15zm7.17-1.85c-1.19 0-2.24-.3-3.1-.89-1.49-1.01-2.38-2.65-2.38-4.39 0-.28.22-.5.5-.5s.5.22.5.5c0 1.41.72 2.74 1.94 3.56.71.48 1.54.71 2.54.71.24 0 .64-.03 1.04-.1.27-.05.53.13.58.41.05.27-.13.53-.41.58-.57.11-1.07.12-1.210.12zM14.91 22c-.04 0-.09-.01-.13-.02-1.59-.44-2.63-1.03-3.72-2.1-1.4-1.39-2.17-3.24-2.17-5.22 0-1.62 1.38-2.94 3.08-2.94 1.7 0 3.08 1.32 3.08 2.94 0 1.07.93 1.94 2.08 1.94s2.08-.87 2.08-1.94c0-3.77-3.25-6.83-7.25-6.83-2.84 0-5.44 1.58-6.61 4.03-.39.81-.59 1.76-.59 2.8 0 .78.07 2.01.67 3.61.1.26-.03.55-.29.64-.26.1-.55-.04-.64-.29-.49-1.31-.73-2.61-.73-3.96 0-1.2.23-2.29.68-3.240 1.33-2.79 4.28-4.6 7.51-4.6 4.55 0 8.25 3.51 8.25 7.83 0 1.62-1.38 2.94-3.08 2.94s-3.08-1.32-3.08-2.94c0-1.07-.93-1.94-2.08-1.94s-2.08.87-2.08 1.94c0 1.71.66 3.31 1.87 4.51.95.94 1.86 1.46 3.27 1.85.27.07.42.35.35.61-.05.23-.26.38-.47.38z"/></svg>';
let fails=0,blockedUntil=0,hiddenAt=0,LOCKBIO=()=>{},BIO_AFTER=false;
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
function lockNow(){if(NEWVER&&NEWVER!==APP_VER)setTimeout(checkUpdate,300);clearTimeout(bkTimer);if(ACT!=='me'&&shDirty)shPush();stopPoll();ACT='me';SHM=null;PS=null;closeSheet();S=null;KEYOBJ=null;SALT=null;RT=null;PINMEM=null;$('#view').innerHTML='';showLock()}
let RECOVERED=null,EXT=0,hiddenOut=false;function goingOut(){EXT=Date.now()}
$('#lkForgot').onclick=()=>{
  if(recInfo()&&driveConfigured()){
    $('#lkT').textContent=t('recTitle');$('#lkH').textContent=t('recovHint');$('#lkE').textContent='';$('#lkForgot').hidden=true;
    $('#lkF').innerHTML=`<button type="button" class="btn pri block gbtn" id="rGo"><span class="g">G</span>${t('recBtn')}</button><button type="button" class="btn block" id="rBack">${t('cancel')}</button><button type="button" class="link" id="rWipe" style="color:var(--neg);margin-top:6px">${t('recWipe')}</button>`;
    $('#rBack').onclick=showLock;$('#rWipe').onclick=forgotWipe;
    $('#rGo').onclick=async()=>{const err=m=>$('#lkE').textContent=m;if(!driveReady()){err(t('regLoading'));return}err(t('working'));
      try{const pin=await recRecoverPin();RECOVERED=pin;showLock();$('#lp1').value=pin;$('#lkF').requestSubmit()}
      catch(x){err(x&&x.message==='nokey'?t('recNoKey'):t('recFail'))}};
    return;
  }
  forgotWipe();
};
function forgotWipe(){
  $('#lkT').textContent=t('forgotConfirm');$('#lkH').textContent='';$('#lkE').textContent='';$('#lkForgot').hidden=true;
  $('#lkF').innerHTML=`<div class="foot"><button type="button" class="btn grow" id="fNo">${t('cancel')}</button><button type="button" class="btn grow" id="fYes" style="background:var(--neg);border-color:var(--neg);color:#fff">${t('del')}</button></div>`;
  $('#fNo').onclick=showLock;
  $('#fYes').onclick=()=>{try{localStorage.removeItem(VAULT);localStorage.removeItem(KEY);localStorage.removeItem('daftari-rt');localStorage.removeItem('daftari-gtoken');localStorage.removeItem(REC_KEY);localStorage.removeItem(BIO_KEY)}catch(e){}showLock()};
}
$('#lockBtn').onclick=()=>{if(S)lockNow()};
$('#brand').onclick=()=>{if(S&&PS)ledgersSheet()};
/* leaving the app locks it at once; when you leave from inside it (picking a file, sharing, Google sign-in, printing, the fingerprint prompt) it stays open if you come back within 5 minutes */
document.addEventListener('click',e=>{const x=e.target.closest&&e.target;if(!x)return;const l=x.closest('label');if(x.closest('input[type=file],a[target=_blank],a[href^="mailto:"],a[href^="tel:"],a[href^="https://wa.me"]')||(l&&l.querySelector('input[type=file]')))goingOut()},true);
try{if(navigator.share){const sh=navigator.share.bind(navigator);navigator.share=(...a)=>{goingOut();return sh(...a)}}}catch(e){}
/* black cover the moment the app loses focus (app switcher, notifications, another app), so the phone's recent-apps picture shows nothing */
const cover=on=>{const c=$('#privacy');if(c)c.hidden=!on};
window.addEventListener('blur',()=>{if(S)cover(true)});
window.addEventListener('focus',()=>{if(!document.hidden)cover(false)});
window.addEventListener('pageshow',e=>{if(e.persisted){if(S)lockNow();cover(false)}});
window.addEventListener('pagehide',()=>{if(S){cover(true);if(Date.now()-EXT>=20000)lockNow()}});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){cover(true);hiddenAt=Date.now();hiddenOut=Date.now()-EXT<20000;if(S&&!hiddenOut)lockNow()}
  else{if(S&&hiddenAt&&(!hiddenOut||Date.now()-hiddenAt>300000))lockNow();EXT=0;cover(false);checkUpdate();if(!S)setTimeout(LOCKBIO,250)}
});
/* updates: the published version is in version.json; while locked the app reloads itself, while open it shows a banner and updates at the next lock */
let NEWVER=null;
async function checkUpdate(){
  if(!navigator.onLine||location.protocol!=='https:')return;
  try{const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)return;const v=String((await r.json()).v||'');
    if(!v||v===APP_VER)return;NEWVER=v;let tried='';try{tried=sessionStorage.getItem('daftari-upd')||''}catch(e){}
    if(!S&&!($('#lp1')&&$('#lp1').value)&&tried!==v){try{sessionStorage.setItem('daftari-upd',v)}catch(e){}await updateNow();return}
    if(S)render()}catch(e){}
}
async function updateNow(){if(S)await keepSession();try{const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.update()));const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)))}catch(e){}location.reload()}
setInterval(checkUpdate,30*60000);

checkUpdate();
if(!(window.crypto&&crypto.subtle)){$('#lkT').textContent='This browser cannot encrypt data. Open the app over https.';}
else showLock();

/* automated checks only: exposed on a local test server, never on the real site */
if(location.hostname==='localhost')window.__T={get S(){return S},set S(v){S=v},get per(){return per},setPer(p,c){per=p;if(c)cur=c},accBalance,accBalanceAt,balAll,liqAll,cashActual,cashPlan,monthCash,planItems,planVsActual,remainingPlan,cashTimeline,safeToSpend,fcSeries,lateItems,cardInfo,cardDueFor,dateIn,loanSched,loanOwedUpTo,loanLeft,owedUpTo,oblLeft,allocate,unlink,relink,dueFor,netWorth,perRange,monthEnd,ymAdd,advance,runRecurring,closeRows,txOf,TODAY,TODAY_YM,projFlows,perCash,upcomingReminders,recPending,monthSummary,glanceHTML,cardCycles,applyNames,bridgeHTML,whyData,fxGain,rateAt,valAt,xferBase,loanForm,loanTopUp,loanPaid,loanAdj,parseEntry,isPL,isFin,flowStmt,accStmt,personStmt,oblStmt,oblStats,oblPaidReal,oblWaived,oblBase,get lastStmt(){return lastStmt},commit,render,migrate,blank,save};
})();
