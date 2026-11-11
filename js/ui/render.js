/* ---------- render ---------- */
const ICONS={home:'<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',tx:'<path d="M4 6h16M4 12h16M4 18h10"/>',obl:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',rep:'<path d="M5 20V10M12 20V4M19 20v-7"/>',set:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'};
function render(){
  if(S)migrate();
  const de=document.documentElement;de.lang=S.lang;de.dir=S.lang==='en'?'ltr':'rtl';
  $('#brand').textContent=ACT==='me'?t('app'):'👥 '+(SHM&&SHM.name||'');document.title=t('app');document.querySelector('.top').classList.toggle('shared',ACT!=='me');$('#mLbl').textContent=perLabel();fitHeader();requestAnimationFrame(()=>{try{fitHeader()}catch(e){}});
  $('#nav').innerHTML=['home','tx','obl','rep','set'].map(k=>`<button data-tab="${k}" class="${tab===k?'on':''}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>${t(k)}</button>`).join('');
  const v=$('#view');
  v.innerHTML=tab==='home'?vHome():tab==='tx'?vTx():tab==='obl'?vObl():tab==='rep'?vRep():setBoxes(vSet());
  boxStates(v);navSync();
  $('#fab').hidden=!(tab==='home'||tab==='tx')||(ACT!=='me'&&SHM&&SHM.role==='reader');
  if(tab==='home'){const f=v.querySelector('#qadd');if(f){f.onsubmit=e=>{e.preventDefault();const q=v.querySelector('#qtext').value.trim();if(q)quickFromText(q);else txForm()};const mic=v.querySelector('#qmic');if(mic)mic.onclick=()=>listen(txt=>{v.querySelector('#qtext').value=txt;quickFromText(txt)})}}
  if(tab==='tx'&&txView==='rec')bindSeg(v,'tv',x=>{txView=x;txDay='';render()});
  if(tab==='tx'&&txView!=='rec'){bindSeg(v,'txf',x=>{txFilter=x;render()});const cf=v.querySelector('#cf'),af=v.querySelector('#af'),qx=v.querySelector('#qx');cf.value=txCat;af.value=txAcc;cf.onchange=()=>{txCat=cf.value;render()};const tgf=v.querySelector('#tgf');if(tgf)tgf.onchange=()=>{txTag=tgf.value;render()};bindSeg(v,'tv',x=>{txView=x;txDay='';render()});af.onchange=()=>{txAcc=af.value;render()};if(qx)qx.onclick=()=>{txQuery='';render();$('#q').focus()};const q=v.querySelector('#q');q.oninput=()=>{txQuery=q.value;const p=q.selectionStart;render();const n=$('#q');n.focus();n.setSelectionRange(p,p)}}
  if(tab==='obl'){bindSeg(v,'obf',x=>{oblTab=x;oblF.clear();oblC.clear();render()});
    v.querySelectorAll('[data-of]').forEach(el=>el.onclick=()=>{const f=el.dataset.of;if(oblF.has(f))oblF.delete(f);else oblF.add(f);render()});
    v.querySelectorAll('[data-oc]').forEach(el=>el.onclick=()=>{const f=el.dataset.oc;if(oblC.has(f))oblC.delete(f);else oblC.add(f);render()});
    const oq=v.querySelector('#oq');if(oq){oq.oninput=()=>{oblQ=oq.value;const p=oq.selectionStart;render();const n=$('#view #oq');if(n){n.focus();try{n.setSelectionRange(p,p)}catch(e){}}}}
    const oqx=v.querySelector('#oqx');if(oqx)oqx.onclick=()=>{oblQ='';render()};const ofx=v.querySelector('#ofx');if(ofx)ofx.onclick=()=>{oblQ='';oblF.clear();oblC.clear();render()}}
  if(tab==='rep'){const zs=(id,k,isSel)=>{const el=v.querySelector(id);if(el)el.onchange=()=>{S.zakat[k]=isSel?el.value:el.checked;if(k==='karat')S.zakat.karatSet=true;commit()}};zs('#zkK','karat',1);zs('#zkG','gold');zs('#zkR','recv');zs('#zkD','debt')}
  if(tab==='set'&&drv.linked&&!drv.email&&hasToken()&&!fetchDriveEmail.busy){fetchDriveEmail.busy=1;fetchDriveEmail().then(e=>{fetchDriveEmail.busy=0;if(e&&tab==='set')render()})}
  if(tab==='set'){const rh=v.querySelector('#remHm'),rl=v.querySelector('#remLead');if(rh){const go=()=>{const [h,m]=(rh.value||'09:00').split(':').map(Number);remTimeSave(h*60+(m||0),+rl.value)};rh.onchange=go;rl.onchange=go}}
  if(tab==='set'){bindSeg(v,'lg',x=>{applyNames(x);S.lang=x;LANG=x;if(PS&&PS!==S){PS.lang=x;vaultSave(PS)}commit()});const ad=v.querySelector('#autoDl');ad.onchange=()=>{S.autoDl=ad.checked;commit(t('saved'))};const c=v.querySelector('#cur');c.onchange=()=>{S.base=c.value;S.rates={};S.ratesAt=null;commit(t('saved'));updateRates(false)};const da=v.querySelector('#defAcc');da.onchange=()=>{S.defAcc=da.value;commit(t('saved'))}}
}
$('#nav').onclick=e=>{const b=e.target.closest('[data-tab]');if(b){tab=b.dataset.tab;render();window.scrollTo(0,0)}};
$('#mPrev').onclick=()=>{perShift(-1);render()};
$('#mLbl').onclick=()=>{if(S)periodForm()};
$('#shareBtn').onclick=()=>shareApp();
$('#mNext').onclick=()=>{perShift(1);render()};
$('#fab').onclick=()=>txForm();

/* buttons inside a bottom sheet (e.g. "edit" in a warning) use the same actions as the main screen */
$('#shB').addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&$('#shB').contains(b))actClick(e)});
$('#view').addEventListener('click',e=>actClick(e));
function actClick(e){
  const r=e.target.closest('#view [data-tx]');if(r){txForm(S.tx.find(x=>x.id===r.dataset.tx));return}
  const b=e.target.closest('[data-act]');if(!b)return;const id=b.dataset.id,a=b.dataset.act;if(b.closest('summary')&&b.tagName!=='SUMMARY')e.preventDefault();if(a==='why'){e.preventDefault();e.stopPropagation();whySheet(b.dataset.w);return}if(a==='openTx'){const x=S.tx.find(y=>y.id===id);if(x)txForm(x);return}
  const A={
    payInst:()=>payInst(id),payGam:()=>payGam(id),recvGam:()=>recvGam(id),
    goLoans:()=>{closeSheet();tab='obl';oblTab='loan';render();window.scrollTo(0,0)},goInst:()=>{closeSheet();tab='obl';oblTab='inst';render();window.scrollTo(0,0)},goGam:()=>{closeSheet();tab='obl';oblTab='gam';render();window.scrollTo(0,0)},goTx:()=>{tab='tx';render();window.scrollTo(0,0)},
    editInst:()=>instForm(S.inst.find(x=>x.id===id)),editGam:()=>gamForm(S.gam.find(x=>x.id===id)),editLoan:()=>loanForm(S.loans.find(x=>x.id===id)),
    repay:()=>repayForm(S.loans.find(x=>x.id===id)),
    addObl:()=>oblTab==='card'?accForm(null,{type:'card'}):oblTab==='inst'?instForm():oblTab==='gam'?gamForm():oblTab==='rec'?txForm(null,'monthly'):oblTab==='goal'?goalForm():loanForm(),
    gamCalc:gamCalc,editGoal:()=>goalForm(S.goals.find(g=>g.id===id)),goalAdd:()=>goalAddForm(S.goals.find(g=>g.id===id)),goGoals:()=>{closeSheet();tab='obl';oblTab='goal';render();window.scrollTo(0,0)},safe:safeSheet,
    useQuick:()=>{const q=S.quick.find(x=>x.id===id);if(q){const p=Object.assign({},q);delete p.id;txForm(null,'',p)}},delQuick:()=>{S.quick=S.quick.filter(x=>x.id!==id);commit(t('deleted'))},
    clearFilt:()=>{txCat='';txAcc='';txQuery='';txTag='';txDay='';render()},clearDay:()=>{txDay='';render()},pickDay:()=>{txDay=txDay===b.dataset.d?'':b.dataset.d;render()},
    stmtTag:()=>{const g=b.dataset.name;stmtSheet({title:'#'+g,sub:perLabel(),cur:BASE(),kind:'flow',rows:flowRows(txIn().filter(x=>x.type!=='transfer'&&(x.tags||[]).includes(g)))})},
    stmtFilt:()=>{const ty=b.dataset.ty,list=txFiltered(),title=[txCat?catPath(txCat):'',txAcc?accOf(txAcc).name+' '+accOf(txAcc).currency:'',txQuery?'"'+txQuery+'"':''].filter(Boolean).join(' · ')||t('tx');
      const pl=x=>txCat&&FIN_CATS.has(catRoot(txCat))?x.type!=='transfer':isPL(x);
      if(ty==='net')stmtSheet({title,sub:perLabel(),cur:BASE(),kind:'acc',opening:0,rows:flowRows(list.filter(pl))});
      else stmtSheet({title:(ty==='income'?t('income'):t('expense'))+' · '+title,sub:perLabel(),cur:BASE(),kind:'flow',rows:flowRows(list.filter(x=>x.type===ty&&pl(x)))})},
    stmtFin:()=>flowStmt('fin'),
    users:usersSheet,unreg:unregister,reg:()=>{if(!driveReady()){toast(t('regLoading'));return}doRegister().then(()=>{toast(t('regDone')+' '+REG.email);render()},()=>toast(t('regFail')))},
    pushOn:pushEnable,pushOff:pushDisable,pushTest:pushTest,bioOn:bioEnableForm,bioOff:bioOff,importX:importForm,
    settle:()=>settleForm(b.dataset.from,b.dataset.to,b.dataset.v),
    payCard:()=>payCard(id),goCards:()=>{closeSheet();tab='obl';oblTab='card';render();window.scrollTo(0,0)},goAcc:()=>{closeSheet();if(tab!=='home'){tab='home';render()}const e=[...document.querySelectorAll('#view details.box')].find(d=>/accounts|الحسابات/i.test(d.textContent.slice(0,80)))||document.querySelector('#view details.box');if(e){e.open=true;e.scrollIntoView({behavior:'smooth'})}},
    addTxT:()=>txForm(null,'',{type:b.dataset.ty}),addRecT:()=>txForm(null,'monthly'),
    appUpdate:async()=>{toast(t('working'),0);await updateNow()},
    goNW:()=>{tab='rep';render();setTimeout(()=>{const e=$('#nw');if(e)e.scrollIntoView({behavior:'smooth'})},50)},
    editRec:()=>{const r=S.recur.find(v=>v.id===id);if(r)recRuleForm(r)},
    stmtRec:()=>{const r=S.recur.find(v=>v.id===id);if(!r)return;stmtSheet({title:r.tpl.note||catPath(r.tpl.cat),sub:freqName(r.freq)+' · '+t('allTime'),cur:BASE(),kind:'flow',rows:flowRows(S.tx.filter(x=>x.rec===r.id&&x.type!=='transfer'))})},exportTx:()=>exportTx((()=>{let l=txIn();if(txFilter!=='all')l=l.filter(x=>x.type===txFilter);return l})(),t('tx')),
    exportCats:()=>{const tx=txIn().filter(x=>x.type==='expense'&&isPL(x));const by=new Map();tx.forEach(x=>by.set(x.cat,(by.get(x.cat)||0)+baseAmt(x)));exportSheet({title:t('byCat'),sub:perLabel()+' · '+curName(BASE()),cols:[t('category'),t('amount')],num:[1],rows:[...by].sort((a,b)=>b[1]-a[1]).map(([c,v])=>[catPath(c),Math.round(v*100)/100]),foot:[[t('total'),Math.round([...by.values()].reduce((a,b)=>a+b,0)*100)/100]]})},
    budget:budgetForm,
    clearSample:()=>{const l=S.lang,keep=S.ledgers;S=blank();S.lang=l;S.ledgers=keep||[];if(ACT==='me')PS=S;commit()},
    addCat:()=>catForm(b.dataset.ty),editCat:()=>{const ty=b.dataset.ty;catForm(ty,S.cats[ty].find(c=>c.id===id))},
    fcMonth:()=>fcMonthSheet(b.dataset.m||id),cashSheet:()=>cashSheet(),planCat:()=>planCatSheet(id,b.dataset.ty),closeMonth:()=>closeMonthSheet(b.dataset.m,false),
    stmtAcc:()=>accStmt(id),stmtCat:()=>catStmt(id),catGroup:()=>catGroupSheet(b.dataset.ty,id),stmtFlow:()=>flowStmt(b.dataset.ty),
    stmtPerson:()=>personStmt(b.dataset.name||id),stmtObl:()=>oblStmt(b.dataset.k||b.dataset.ty,id),recon:()=>recForm(accOf(id)),
    addCatOld:()=>{const ty=b.dataset.ty;openSheet(t('addCat'),`<form class="form" id="f"><label class="fld"><span>${t('name')}</span><input class="in-f" id="nm"></label><div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
      setTimeout(()=>r.querySelector('#nm').focus(),50);
      r.querySelector('#f').onsubmit=ev=>{ev.preventDefault();const nm=val(r,'nm');if(!nm){toast(t('needName'));return}S.cats[ty].splice(S.cats[ty].length-(ty==='expense'?3:2),0,{id:'c'+uid(),ar:nm,en:nm,sys:false});closeSheet();commit(t('saved'))}})},
    delCat:()=>{const ty=b.dataset.ty,used=S.tx.some(x=>x.cat===id);confirmSheet(used?t('catInUse'):t('confirmDel'),t('del'),()=>{
      S.cats[ty]=S.cats[ty].filter(c=>c.id!==id);S.tx.forEach(x=>{if(x.cat===id)x.cat=ty==='expense'?'other':'iother'});delete S.budgets[id];commit(t('deleted'))})},
    export:()=>saveToPhone(false).then(ok=>{if(ok)render()}),glance:()=>{if(id==='c')cashSheet();else whySheet('availEnd')},monthSum:()=>saveMonthSummary(perRange()[1].slice(0,7)>TODAY_YM?TODAY_YM:perRange()[1].slice(0,7),true),reconAll:()=>reconAllSheet(),showDone:()=>{SHOW_DONE[id]=!SHOW_DONE[id];render()},accOrder:()=>accOrderSheet(),catOrder:()=>catOrderSheet(b.dataset.ty),oblOrder:()=>oblOrderSheet(oblTab),recDo:()=>recDoSheet(id),recLater:()=>recLaterSheet(id),recSkip:()=>recSkip(id),ratesNow:()=>{toast(t('working'),0);updateRates(true)},catKidsT:()=>{if(catOpen.has(id))catOpen.delete(id);else catOpen.add(id);render()},reviewExport:reviewExport,import:doImport,copyBackup:copyBackup,shareDrive:shareBackup,addAcc:()=>accForm(),editAcc:()=>accForm(S.accounts.find(a=>a.id===id)),addAccCur:()=>accForm(null,{name:b.dataset.name,type:b.dataset.type,group:b.dataset.group,currency:usedCurrencies().includes('USD')?'EUR':'USD'}),rates:ratesForm,shareApp:shareApp,driveLink:driveConnect,driveSync:()=>{if(hasToken())syncDrive(true);else driveResume()},driveRestore:driveRestore,driveUnlink:driveUnlink,driveSwitch:driveSwitch,driveResume:driveResume,
    install:()=>{if(installEvt){installEvt.prompt();installEvt=null;render()}},changePin:changePinForm,lockNow:lockNow,
    reset:()=>confirmSheet(t('resetConfirm'),t('del'),()=>{const l=S.lang,keep=ACT==='me'?S.ledgers:undefined;S=blank();S.lang=l;if(ACT==='me'){S.ledgers=keep||[];PS=S}commit(t('deleted'))}),
  };
  if(A[a])A[a]();
}

