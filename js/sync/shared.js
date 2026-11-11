
async function ledKey(m){if(!ledKeys.has(m.key))ledKeys.set(m.key,await crypto.subtle.importKey('raw',fromB64u(m.key),'AES-GCM',false,['encrypt','decrypt']));return ledKeys.get(m.key)}
const colsOf=D=>[...SH_COLS.map(k=>[k,D[k]||[]]),['cx',(D.cats||{}).expense||[]],['ci',(D.cats||{}).income||[]]];
const strip=r=>{const o=Object.assign({},r);delete o.u;return JSON.stringify(o)};
const setOf=D=>{const o={};SETK.forEach(k=>o[k]=D[k]);return o};
function snapshot(D){const m={};colsOf(D).forEach(([k,a])=>{m[k]={};a.forEach(r=>m[k][r.id]=strip(r))});m._set=JSON.stringify(setOf(D));m._bud=JSON.stringify(D.budgets||{});return m}
/* mark what changed since the last snapshot: new/edited records get a time, removed ones a tombstone */
function stamp(D){
  const now=Date.now();D._del=D._del||{};
  colsOf(D).forEach(([k,arr])=>{const old=shadow[k]||{},ids=new Set();
    arr.forEach(r=>{ids.add(r.id);if(old[r.id]!==strip(r)){r.u=now;if(k==='tx'&&!r.by&&drv.email)r.by=drv.email}});
    Object.keys(old).forEach(id=>{if(!ids.has(id))D._del[id]=now})});
  if(JSON.stringify(setOf(D))!==shadow._set)D._su=now;
  if(JSON.stringify(D.budgets||{})!==shadow._bud)D._bu=now;
  shadow=snapshot(D);
}
/* newest version of each record wins; a deletion wins over older edits */
function mergeLedger(A,B){
  const R=Object.assign({},A),del=Object.assign({},A._del||{});
  Object.entries(B._del||{}).forEach(([id,ts])=>{if(!(del[id]>=ts))del[id]=ts});R._del=del;
  const pick=(la,lb)=>{const m=new Map();[...(la||[]),...(lb||[])].forEach(r=>{const c=m.get(r.id);if(!c||(r.u||0)>(c.u||0))m.set(r.id,r)});return [...m.values()].filter(r=>!(del[r.id]>=(r.u||0)))};
  SH_COLS.forEach(k=>R[k]=pick(A[k],B[k]));
  R.cats={expense:pick((A.cats||{}).expense,(B.cats||{}).expense),income:pick((A.cats||{}).income,(B.cats||{}).income)};
  if((B._su||0)>(A._su||0)){SETK.forEach(k=>R[k]=B[k]);R._su=B._su}
  if((B._bu||0)>(A._bu||0)){R.budgets=B.budgets;R._bu=B._bu}
  return R;
}
const stripLocal=D=>{const o=Object.assign({},D);LOCALK.forEach(k=>delete o[k]);return o};
function prepShared(D){D.lang=(PS&&PS.lang)||LANG;D.sample=false;D.cats=D.cats||mkCats();['tx','accounts','inst','gam','loans','recur','goals','settles'].forEach(k=>{if(!Array.isArray(D[k]))D[k]=[]});if(!D.budgets)D.budgets={};return D}
async function cacheSave(m,D){try{localStorage.setItem('daftari-led-'+m.id,JSON.stringify(await seal(KEYOBJ,D)))}catch(e){}}
async function cacheLoad(m){try{const o=JSON.parse(localStorage.getItem('daftari-led-'+m.id)||'null');return o?await unseal(KEYOBJ,o.iv,o.ct):null}catch(e){return null}}
async function shDownload(m){const j=await (await gfetch('/drive/v3/files/'+m.fileId+'?alt=media')).json();if(j.app!=='daftari-shared')throw new Error('bad');return await unseal(await ledKey(m),j.iv,j.ct)}
async function shBody(m,D){return JSON.stringify(Object.assign({app:'daftari-shared',v:1},await seal(await ledKey(m),stripLocal(D))))}
async function shUpload(m,D){await gfetch(GAPI+'/upload/drive/v3/files/'+m.fileId+'?uploadType=media',{method:'PATCH',headers:{'Content-Type':'application/json'},body:await shBody(m,D)})}
async function shMeta(m){return await (await gfetch('/drive/v3/files/'+m.fileId+'?fields=modifiedTime,trashed,capabilities(canEdit),owners(emailAddress)')).json()}
async function needAccess(){if(await ensureAccess())return true;drv.needAuth=true;render();return false}
async function shPull(force){
  if(ACT==='me'||!SHM||shBusy)return;if(!(await needAccess()))return;
  const m=SHM;shBusy=true;
  try{
    const info=await shMeta(m);m.role=info.capabilities&&info.capabilities.canEdit?'writer':'reader';m.ownerEmail=(info.owners&&info.owners[0]||{}).emailAddress||m.ownerEmail;
    if(!force&&info.modifiedTime===m.mod&&!shDirty)return;
    const R=await shDownload(m);if(ACT!==m.id)return;
    S=prepShared(S?mergeLedger(S,R):R);shadow=snapshot(S);m.mod=info.modifiedTime;m.name=S.name||m.name;
    await cacheSave(m,S);vaultSave(PS);render();
    if(shDirty)shPush();
  }catch(e){if(String(e.message).includes('404'))toast(t('ledgerGone'))}
  finally{shBusy=false}
}
function sharedSave(){
  if(SHM.role==='reader'){toast(t('readOnly'));cacheLoad(SHM).then(D=>{if(D&&ACT===SHM.id){S=prepShared(D);render()}});return}
  stamp(S);shDirty=true;cacheSave(SHM,JSON.parse(JSON.stringify(S)));clearTimeout(shTimer);shTimer=setTimeout(shPush,1500);
}
async function shPush(){
  if(ACT==='me'||!SHM||!shDirty)return;if(shBusy){clearTimeout(shTimer);shTimer=setTimeout(shPush,1500);return}
  if(!(await needAccess()))return;
  const m=SHM;shBusy=true;
  try{
    const R=await shDownload(m);if(ACT!==m.id)return;
    S=prepShared(mergeLedger(S,R));shadow=snapshot(S);
    await shUpload(m,S);shDirty=false;
    m.mod=(await shMeta(m)).modifiedTime;await cacheSave(m,S);render();
  }catch(e){toast(t('shareSyncFail'))}
  finally{shBusy=false}
}
function startPoll(){stopPoll();shPoll=setInterval(()=>{if(!document.hidden)shPull(false)},30000)}
function stopPoll(){if(shPoll)clearInterval(shPoll);shPoll=null}
async function switchLedger(id){
  closeSheet();if(id===ACT)return;
  if(ACT!=='me'&&shDirty){clearTimeout(shTimer);await shPush()}
  if(id==='me'){ACT='me';SHM=null;S=PS;stopPoll();cur=TODAY_YM;render();return}
  const m=PS.ledgers.find(l=>l.id===id);if(!m)return;
  ACT=id;SHM=m;shDirty=false;
  const D=await cacheLoad(m);
  S=prepShared(D||Object.assign(blank(),{name:m.name}));shadow=D?snapshot(S):{};
  render();toast(t('nowIn')+' '+m.name);
  await shPull(true);startPoll();runRecurring();
}
async function shCreateFile(m,D){
  const folder=await ensureFolder(),bd='sh'+uid(),meta=JSON.stringify({name:'Daftari - '+m.name+'.dft',parents:[folder],mimeType:'application/json'});
  const body='--'+bd+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+bd+'\r\nContent-Type: application/json\r\n\r\n'+(await shBody(m,D))+'\r\n--'+bd+'--';
  return (await (await gfetch(GAPI+'/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+bd},body})).json()).id;
}
async function createLedger(name){
  if(!drv.linked){toast(t('needDriveShare'));return}
  try{if(!(await ensureAccess()))await authorize(false)}catch(e){return}
  const P=PS,now=Date.now(),D=blank();
  Object.assign(D,{name,base:P.base,rates:Object.assign({},P.rates),ratesAt:P.ratesAt,cats:JSON.parse(JSON.stringify(P.cats)),rk:toB64(crypto.getRandomValues(new Uint8Array(32))),sample:false,_del:{},_su:now,_bu:now,
    accounts:[{id:'cash',type:'cash',name:lng()==='en'?'Cash':'كاش',currency:P.base,opening:0}]});
  colsOf(D).forEach(([,a])=>a.forEach(r=>r.u=now));
  const m={id:'',name,key:toB64u(crypto.getRandomValues(new Uint8Array(32))),role:'writer',owner:true,ownerEmail:drv.email};
  try{m.fileId=await shCreateFile(m,D);m.id=m.fileId}catch(e){toast(t('shareSyncFail'));return}
  D.members=[myEmail()].filter(Boolean);PS.ledgers.push(m);vaultSave(PS);await cacheSave(m,D);
  await switchLedger(m.id);inviteForm(m);
}
const joinLink=m=>location.origin+location.pathname.replace(/index\.html$/,'')+'#join.'+m.fileId+'.'+m.key;
function inviteForm(m){
  openSheet(t('invite')+' · '+m.name,`<form class="form" id="f">
    <p class="hint">${t('inviteHint')}</p>
    <label class="fld"><span>${t('emailOf')}</span><input class="in-f" type="email" id="em" autocomplete="off" dir="ltr" placeholder="name@gmail.com"></label>
    <label class="fld"><span>${t('canDo')}</span><select class="in-f" id="ro"><option value="writer">${t('roleWriter')}</option><option value="reader">${t('roleReader')}</option></select></label>
    <div class="foot"><button class="btn pri grow">${t('sendInvite')}</button></div>
    <div id="lk" hidden class="form"><p class="hint">${t('sendLink')}</p><input class="in-f" readonly dir="ltr" value="${esc(joinLink(m))}" id="lkv"><div class="foot"><button type="button" class="btn grow" id="cp">${t('copy')}</button><button type="button" class="btn pri grow" id="sh">${t('shareApp')}</button></div></div>
    <div id="mem" class="list"></div>
  </form>`,r=>{
    const $r=q=>r.querySelector(q);
    const loadMembers=async()=>{try{const j=await (await gfetch('/drive/v3/files/'+m.fileId+'/permissions?fields=permissions(id,emailAddress,role,type,displayName)')).json();
      $r('#mem').innerHTML=`<div class="grp"><span>${t('ledMembers')}</span></div>`+(j.permissions||[]).map(p=>`<div class="row"><div class="main"><span class="t" dir="ltr" style="text-align:start">${esc(p.emailAddress||p.displayName||'')}</span><span class="s">${p.role==='owner'?t('roleOwner'):p.role==='reader'?t('roleReader'):t('roleWriter')}</span></div>
        ${p.role==='owner'?'':`<button type="button" class="btn sm" data-pr="${p.id}" data-to="${p.role==='reader'?'writer':'reader'}">${p.role==='reader'?t('makeWriter'):t('makeReader')}</button><button type="button" class="btn sm danger" data-pd="${p.id}">${t('remove')}</button>`}</div>`).join('');
      $r('#mem').querySelectorAll('[data-pr]').forEach(b=>b.onclick=async()=>{await gfetch('/drive/v3/files/'+m.fileId+'/permissions/'+b.dataset.pr,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:b.dataset.to})});loadMembers()});
      $r('#mem').querySelectorAll('[data-pd]').forEach(b=>b.onclick=async()=>{await gfetch('/drive/v3/files/'+m.fileId+'/permissions/'+b.dataset.pd,{method:'DELETE'});loadMembers()});
    }catch(e){}};
    const showLink=()=>{$r('#lk').hidden=false;$r('#cp').onclick=()=>{navigator.clipboard.writeText(joinLink(m)).then(()=>toast(t('copied')),()=>{$r('#lkv').select()})};
      $r('#sh').onclick=async()=>{try{await navigator.share({title:t('app')+' · '+m.name,text:t('joinText')+' '+m.name,url:joinLink(m)})}catch(e){}}};
    if(m.owner){loadMembers();showLink()}else{$r('#f').hidden=false}
    $r('#f').onsubmit=async e=>{e.preventDefault();const em=val(r,'em').toLowerCase();if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){toast(t('badEmail'));return}
      try{if(!(await needAccess()))return;
        await gfetch('/drive/v3/files/'+m.fileId+'/permissions?sendNotificationEmail=true&emailMessage='+encodeURIComponent(t('joinText')+' '+m.name),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'user',role:val(r,'ro'),emailAddress:em})});
        toast(t('invited'));$r('#em').value='';showLink();loadMembers();
      }catch(x){toast(t('inviteFail'))}};
  });
}
function loadPicker(){if(gapiP)return gapiP;gapiP=new Promise((res,rej)=>{const sc=document.createElement('script');sc.src='https://apis.google.com/js/api.js';sc.onload=()=>window.gapi.load('picker',{callback:res,onerror:rej});sc.onerror=()=>{gapiP=null;rej(new Error('gapi'))};document.head.appendChild(sc)});return gapiP}
function pickFile(fileId){
  return loadPicker().then(()=>new Promise((res,rej)=>{
    const view=new google.picker.DocsView(google.picker.ViewId.DOCS).setFileIds(fileId).setMode(google.picker.DocsViewMode.LIST);
    new google.picker.PickerBuilder().addView(view).setOAuthToken(gToken).setDeveloperKey(CFG.pickerKey).setAppId(CFG.appId||CFG.googleClientId.split('-')[0])
      .setTitle(t('pickTitle')).setCallback(d=>{if(d.action===google.picker.Action.PICKED)res(d.docs[0].id);else if(d.action===google.picker.Action.CANCEL)rej(new Error('cancel'))}).build().setVisible(true);
  }));
}
function joinSheet(){
  const j=pendingJoin;if(!j)return;
  if(PS.ledgers.some(l=>l.fileId===j.fileId)){pendingJoin=null;switchLedger(j.fileId);return}
  openSheet(t('joinTitle'),`<div class="form"><p class="hint">${t('joinHint')}</p>
    ${drv.linked?'':`<p class="hint"><b>${t('joinNeedDrive')}</b></p>`}
    <button type="button" class="btn pri block" id="go">${drv.linked?t('joinOpen'):t('driveLink')}</button>
    <button type="button" class="btn block" id="no">${t('cancel')}</button></div>`,r=>{
    r.querySelector('#no').onclick=()=>{pendingJoin=null;closeSheet()};
    r.querySelector('#go').onclick=async()=>{
      if(!drv.linked){await driveConnect();joinSheet();return}
      if(!CFG.pickerKey){toast(t('pickerMissing'));return}
      try{if(!(await ensureAccess()))await authorize(false);
        const id=await pickFile(j.fileId);
        const m={id,fileId:id,key:j.key,role:'writer',owner:false,name:''};
        const D=await shDownload(m);m.name=D.name||t('sharedLedger');
        PS.ledgers.push(m);vaultSave(PS);await cacheSave(m,D);pendingJoin=null;await switchLedger(id);
        if(myEmail()&&!(S.members||[]).includes(myEmail())){S.members=[...(S.members||[]),myEmail()];commit()}
      }catch(e){if(e&&e.message!=='cancel')toast(t('joinFail'))}
    };
  });
}
function ledgersSheet(){
  const L2=PS.ledgers||[],row=(id,name,sub,on)=>`<div class="row tap" data-sact="led" data-id="${id}"><div class="glyph ${on?'in':''}">${on?'✓':esc(initial(name))}</div><div class="main"><span class="t">${esc(name)}</span><span class="s">${sub}</span></div></div>`;
  openSheet(t('ledgers'),`<div class="form"><div class="list">
    ${row('me',t('myLedger'),t('onlyMe'),ACT==='me')}
    ${L2.map(l=>row(l.id,l.name,(l.owner?t('roleOwner'):l.role==='reader'?t('roleReader'):t('roleWriter'))+(l.ownerEmail&&!l.owner?' · '+esc(l.ownerEmail):''),ACT===l.id)).join('')}
  </div>
  ${ACT!=='me'?`<div class="acts"><button type="button" class="btn" data-sact="ledInvite">${SHM.owner?t('membersInvite'):t('membersShow')}</button><button type="button" class="btn danger" data-sact="ledLeave">${SHM.owner?t('deleteLedger'):t('leaveLedger')}</button></div>`:''}
  <form class="form" id="nf"><label class="fld"><span>${t('newShared')}</span><input class="in-f" id="nn" placeholder="${t('newSharedHint')}"></label><button class="btn pri block">${t('createLedger')}</button></form>
  <p class="hint">${t('ledgersHint')}</p></div>`,r=>{
    r.querySelector('#nf').onsubmit=e=>{e.preventDefault();const n=val(r,'nn');if(!n){toast(t('needName'));return}closeSheet();createLedger(n)};
  });
}
function leaveLedger(){
  const m=SHM;if(!m)return;
  confirmSheet(m.owner?t('deleteLedgerQ'):t('leaveLedgerQ'),m.owner?t('deleteLedger'):t('leaveLedger'),async()=>{
    if(m.owner){try{await gfetch('/drive/v3/files/'+m.fileId,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})})}catch(e){}}
    PS.ledgers=PS.ledgers.filter(l=>l.id!==m.id);try{localStorage.removeItem('daftari-led-'+m.id)}catch(e){}
    shDirty=false;await switchLedger('me');vaultSave(PS);
  });
}
