/* ---------- share to Google Drive (system share sheet, no Google Cloud needed) ---------- */
const LASTCHG='daftari-lastchange';
function markChange(){try{localStorage.setItem(LASTCHG,new Date().toISOString())}catch(e){}}
function backupDue(){
  let lc=null,lb=null;try{lc=localStorage.getItem(LASTCHG);lb=localStorage.getItem('daftar-elbeit-lastbackup')}catch(e){}
  if(!lc)return false;if(!lb)return Date.now()-new Date(lc).getTime()>3600e3;
  return new Date(lc)>new Date(lb)&&Date.now()-new Date(lb).getTime()>864e5;
}
async function shareBackup(){
  if(!KEYOBJ)return;
  const data=await makeBackup(),name=backupName().replace(/\.json$/,'.txt');
  let file=null;try{file=new File([data],name,{type:'text/plain'})}catch(e){}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:name});markBackup();toast(t('saved'));render()}
    catch(e){if(e&&e.name!=='AbortError')toast(t('shareUnsupported'))}
    return;
  }
  toast(t('shareUnsupported'));
  if(await saveToPhone(true))render();
}

/* ---------- sign-up with Google, once: the email goes to the owner's list ---------- */
const REG_KEY='daftari-reg';
let REG=null;try{REG=JSON.parse(localStorage.getItem(REG_KEY)||'null')}catch(e){}
let idClient=null;
function idToken(prompt,hint){goingOut();
  return new Promise((res,rej)=>{
    if(!driveReady()){rej(new Error('notready'));return}
    if(!idClient)idClient=google.accounts.oauth2.initTokenClient({client_id:CFG.googleClientId,scope:'openid email profile',callback:()=>{}});
    idClient.callback=r=>r&&r.access_token?res(r.access_token):rej(r);idClient.error_callback=e=>rej(e);
    const o={prompt};if(hint)o.login_hint=hint;idClient.requestAccessToken(o);
  });
}
const workerPost=async(path,body)=>{const r=await fetch(CFG.authWorker.replace(/\/+$/,'')+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||'http '+r.status);return j};
let PENDING_RT=null,FRESH_DRIVE=false;
/* one Google tap: sign up and link Drive together */
async function signUpWithDrive(){
  const j=await workerCall('/exchange',{code:await requestCode(!REG,true,REG&&REG.email)});
  setAccess(j);
  const r=await workerPost('/register',{access_token:j.access_token,lang:lng()});
  REG={email:r.email,name:r.name,admin:!!r.admin,at:new Date().toISOString()};try{localStorage.setItem(REG_KEY,JSON.stringify(REG))}catch(x){}
  drv.linked=true;drv.email=r.email;drv.folderId=null;drvSave();
  if(j.refresh_token){if(KEYOBJ){RT=j.refresh_token;await saveRT()}else PENDING_RT=j.refresh_token}
  FRESH_DRIVE=true;return REG;
}
async function doRegister(){
  if(useWorker()&&!drv.linked){try{return await signUpWithDrive()}catch(e){if(e&&e.type==='popup_closed')throw e}}
  const tok=await idToken(REG?'':'select_account',REG&&REG.email);
  const j=await workerPost('/register',{access_token:tok,lang:lng()});
  REG={email:j.email,name:j.name,admin:!!j.admin,at:new Date().toISOString()};try{localStorage.setItem(REG_KEY,JSON.stringify(REG))}catch(x){}
  return REG;
}
const DRVASK='daftari-drvask';const drvAsked=()=>{try{return !!localStorage.getItem(DRVASK)}catch(e){return true}};
const needDriveAtSignIn=()=>!!(REG&&useWorker()&&!drv.linked&&!drvAsked());
let LOCKSETUP=false;
const acctHTML=()=>REG&&!needDriveAtSignIn()&&!(LOCKSETUP&&useWorker()&&!drv.linked)?`<div class="acct"><span class="g">G</span><span class="em" dir="ltr">${esc(REG.email)}</span><span class="ok">✓</span></div>`:`<button type="button" class="btn block gbtn" id="gbtn"><span class="g">G</span>${LOCKSETUP?t('regDriveBtn'):t('regBtn')}</button>`;
function regGate(done){
  const box=$('#lock');box.hidden=false;
  $('#lkT').textContent=t('regTitle');$('#lkH').textContent=t('regHint');$('#lkE').textContent='';$('#lkForgot').hidden=true;
  $('#lkF').innerHTML=`<button class="btn pri block" type="submit">${t('regBtn')}</button>${navigator.onLine?'':`<button class="btn block" type="button" id="regSkip">${t('regLater')}</button>`}<p class="hint" style="text-align:center"><a href="privacy.html" target="_blank" rel="noopener" style="color:var(--accent)">${t('privacy')}</a></p>`;
  const sk=$('#regSkip');if(sk)sk.onclick=()=>{box.hidden=true;$('#lkF').innerHTML='';done&&done()};
  $('#lkF').onsubmit=async e=>{e.preventDefault();const err=m=>$('#lkE').textContent=m;
    if(!driveReady()){err(t('regLoading'));return}
    try{err(t('working'));const j=await doRegister();
      box.hidden=true;$('#lkF').innerHTML='';toast(t('regDone')+' '+j.email);done&&done();
      if(PENDING_RT&&KEYOBJ){RT=PENDING_RT;PENDING_RT=null;await saveRT()}
      if(FRESH_DRIVE&&KEYOBJ&&S){FRESH_DRIVE=false;syncDrive(true);render()}
    }catch(x){err(t('regFail'))}};
}
async function usersSheet(){
  try{
    const tok=await idToken('',REG&&REG.email);
    const j=await workerPost('/users',{access_token:tok});const list=j.users||[];
    const dd=v=>v?dateOf(new Date(v)):'';
    openSheet(t('users')+' · '+list.length,`<div class="form">
      <div class="acts"><button type="button" class="btn sm" id="ux">⤓ ${t('export')}</button></div>
      <div class="list">${list.map(u=>`<div class="row"><div class="glyph">${esc(initial(u.name||u.email))}</div><div class="main"><span class="t" dir="ltr" style="text-align:start">${esc(u.email)}</span><span class="s">${esc(u.name||'')} · ${t('joined')} ${esc(dd(u.first_seen))} · ${t('lastOpen')} ${esc(dd(u.last_seen))}</span></div><b class="amt">${u.opens}</b></div>`).join('')||`<div class="empty">${t('noItems')}</div>`}</div>
      <p class="hint">${t('usersHint')}</p></div>`,r=>{
      r.querySelector('#ux').onclick=()=>exportSheet({title:t('users'),sub:new Date().toISOString().slice(0,10),cols:['Email',t('name'),t('joined'),t('lastOpen'),t('regCount'),t('lang')],num:[4],rows:list.map(u=>[u.email,u.name||'',(u.first_seen||'').slice(0,10),(u.last_seen||'').slice(0,10),u.opens,u.lang])});
    });
  }catch(e){toast(e.message==='not_admin'?t('notAdmin'):t('regFail'))}
}
function unregister(){
  confirmSheet(t('unregQ'),t('unreg'),async()=>{
    try{const tok=await idToken('',REG&&REG.email);await workerPost('/unregister',{access_token:tok});REG=null;try{localStorage.removeItem(REG_KEY)}catch(e){}toast(t('unregDone'));render()}
    catch(e){toast(t('regFail'))}
  });
}

