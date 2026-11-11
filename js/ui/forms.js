/* ---------- forms ---------- */
function txForm(tx,repeat,pre){
  const isNew=!tx;tx=tx||Object.assign({type:'expense',cat:'food',acc:S.defAcc,amount:'',date:(cur===TODAY_YM?TODAY:cur+'-01'),note:'',repeat:repeat||''},pre||{});
  let type=tx.type;
  const catOpts=ty=>catOptsTree(ty,tx.cat,isNew);
  const toDef=tx.toAcc||(S.accounts.find(a=>a.id!==tx.acc)||S.accounts[0]).id;
  openSheet(isNew?t('addTx'):t('editTx'),`<form class="form" id="f">
    ${segHTML('ty',[['expense',t('exp1')],['income',t('inc1')],['transfer',t('transfer')]],type)}
    <label class="fld"><span id="accL">${type==='transfer'?t('fromAcc'):t('account')}</span><select class="in-f" id="acc">${accOpts(tx.acc)}</select></label>
    <label class="fld" id="toW" ${type==='transfer'?'':'hidden'}><span>${t('toAcc')}</span><select class="in-f" id="to">${accOpts(toDef)}</select></label>
    <label class="fld"><span>${t('amount')} (<b id="amtC"></b>)</span><input class="in-f amt num" id="amt" inputmode="decimal" autocomplete="off" value="${tx.amount}" placeholder="0"></label>
    <label class="fld" id="xrW" hidden><span>${t('rateOfDay')} (<b id="xrC"></b>)</span><input class="in-f num" id="xr" inputmode="decimal" autocomplete="off" value="${tx.rate||''}" placeholder=""></label>
    <label class="fld" id="toAmtW" hidden><span>${t('recvAmt')} (<b id="toC"></b>)</span><input class="in-f amt num" id="toAmt" inputmode="decimal" autocomplete="off" value="${tx.toAmount??''}" placeholder="0"></label>
    <label class="fld" id="catW" ${type==='transfer'?'hidden':''}><span>${t('category')}</span><select class="in-f" id="cat">${type==='transfer'?'':catOpts(type)}</select></label>
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${tx.date}"></label>
    <label class="fld"><span>${t('note')}</span><input class="in-f" id="nt" value="${esc(tx.note)}" autocomplete="off"></label>
    ${ACT!=='me'&&ledgerMembers().length>1?`<div class="two" id="spW"><label class="fld"><span>${t('paidByL')}</span><select class="in-f" id="pb">${ledgerMembers().map(m=>`<option value="${esc(m)}" ${(tx.paidBy||tx.by||myEmail())===m?'selected':''}>${esc(shortName(m))}</option>`).join('')}</select></label>
      <label class="fld"><span>${t('splitL')}</span><select class="in-f" id="spl"><option value="">${t('splitAll')}</option><option value="self" ${tx.split==='self'?'selected':''}>${t('splitSelf')}</option></select></label></div>`:''}
    <label class="fld"><span>${t('tags')}</span><input class="in-f" id="tg" list="dl-tags" value="${esc((tx.tags||[]).join('، '))}" placeholder="${t('tagsHint')}" autocomplete="off">${datalist('dl-tags',allTags())}</label>
    <label class="fld"><span>${t('receipt')}</span><input class="in-f" type="file" accept="image/*" id="rf"></label>
    ${isNew?`<label class="chk"><input type="checkbox" id="qk"> ${t('saveQuick')}</label>`:''}
    ${tx.rcpt?`<button type="button" class="btn block" data-sact="rcpt" data-id="${tx.id}">🧾 ${t('showReceipt')}</button>`:''}
    ${tx.rec&&S.recur.some(v=>v.id===tx.rec)?`<button type="button" class="btn block" data-sact="rec" data-id="${tx.rec}">↻ ${t('recurring')}: ${freqName(S.recur.find(v=>v.id===tx.rec).freq)}</button>`:
      freqFields(tx.repeat||'',true,'','')}
    <div class="foot">${isNew?'':`<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div>
  </form>`,r=>{
    const $r=q=>r.querySelector(q);let toTouched=!isNew&&tx.toAmount!=null;{const bf=bindFreq(r,()=>$r('#dt').value);if(bf)$r('#dt').addEventListener('change',bf)}
    const sync=()=>{
      const fa=accOf($r('#acc').value),ta=accOf($r('#to').value),diff=type==='transfer'&&fa.currency!==ta.currency;
      $r('#amtC').textContent=curName(fa.currency);$r('#toC').textContent=curName(ta.currency);
      $r('#toAmtW').hidden=!diff;const fx=type!=='transfer'&&fa.currency!==BASE();$r('#xrW').hidden=!fx;if(fx){$r('#xrC').textContent='1 '+fa.currency+' = ? '+BASE();$r('#xr').placeholder=String(rateAt(fa.currency,$r('#dt').value||TODAY)||'')}
      if(diff&&!toTouched){const a=parseFloat($r('#amt').value)||0,ra=rateOf(fa.currency),rb=rateOf(ta.currency);$r('#toAmt').value=a&&ra&&rb?Math.round(a*ra/rb*100)/100:''}
    };
    bindSeg(r,'ty',v=>{type=v;$r('#toW').hidden=v!=='transfer';$r('#catW').hidden=v==='transfer';$r('#accL').textContent=v==='transfer'?t('fromAcc'):t('account');if(v!=='transfer')$r('#cat').innerHTML=catOpts(v);sync()});
    $r('#acc').onchange=sync;$r('#to').onchange=sync;$r('#amt').oninput=sync;$r('#toAmt').oninput=()=>{toTouched=true};
    sync();
    if(isNew)setTimeout(()=>$r('#amt').focus(),50);
    if(!isNew)$r('#del').onclick=()=>{const go=()=>{delTx(tx.id);commit(t('deleted'))};if(S.closed&&S.closed[tx.date.slice(0,7)])closedEdit([tx.date.slice(0,7)],go,true);else confirmSheet(t('confirmDel'),t('del'),go)};
    $r('#f').onsubmit=e=>{e.preventDefault();const a=numv(r,'amt');if(a<=0){toast(t('needAmt'));return}
      let o={type,acc:val(r,'acc'),amount:a,date:val(r,'dt')||TODAY,note:val(r,'nt'),tags:parseTags(val(r,'tg'))};if(!o.tags.length)delete o.tags;
      if($r('#pb')){o.paidBy=$r('#pb').value;o.split=$r('#spl').value||undefined}
      if(type==='transfer'){
        const to=val(r,'to');if(to===o.acc){toast(t('sameAcc'));return}
        const diff=accOf(o.acc).currency!==accOf(to).currency,ta=diff?numv(r,'toAmt'):a;
        if(diff&&ta<=0){toast(t('needAmt'));return}
        Object.assign(o,{toAcc:to,toAmount:ta,cat:'transfer'});
      }else Object.assign(o,{cat:val(r,'cat'),toAcc:undefined,toAmount:undefined});
      {const fc=accOf(o.acc).currency;if(type!=='transfer'&&fc!==BASE()){const xr=numv(r,'xr')||rateAt(fc,o.date);if(xr>0)o.rate=Math.round(xr*10000)/10000}}
      const rp=readFreq(r),qk=!!($r('#qk')&&$r('#qk').checked),rf=$r('#rf').files[0];
      /* a closed month: say so, and if you go ahead it opens again and asks to be closed with the difference */
      const months=[...new Set([o.date.slice(0,7)].concat(isNew?[]:[tx.date.slice(0,7)]))].filter(m=>S.closed&&S.closed[m]);
      const doSave=()=>{let saved;
      const prev=isNew?null:Object.assign({},S.tx.find(x=>x.id===tx.id));
      if(isNew){saved=Object.assign({id:uid()},o);S.tx.push(saved)}else{saved=S.tx.find(x=>x.id===tx.id);
        const lk=saved.link,changed=lk&&(+saved.amount!==+o.amount||saved.date!==o.date||saved.type!==o.type);
        Object.assign(saved,o);if(!o.tags)delete saved.tags;if(type!=='transfer'){delete saved.toAcc;delete saved.toAmount}
        if(lk&&lk.k==='loanorig'&&prev&&type!=='transfer'){const L=S.loans.find(x=>x.id===lk.id);if(L){L.amount=Math.round((+o.amount+sum(L.adds||[])+(+L.folded||0))*100)/100;L.date=o.date;L.dir=o.type==='income'?'borrowed':'lent'}}
        if(changed)relink(saved,lk)}
      if(isNew&&qk){const q=Object.assign({},saved);delete q.id;delete q.date;delete q.rec;delete q.rcpt;delete q.link;S.quick.push(Object.assign({id:'q'+uid()},q))}
      if(rp&&!saved.rec){const rid='r'+uid(),tpl=Object.assign({},saved);delete tpl.id;delete tpl.date;delete tpl.rec;delete tpl.link;
        const nr={id:rid,freq:rp,day:+saved.date.slice(8,10),next:advance(saved.date,rp),tpl},lv=$r('#rl')?$r('#rl').value:'',en=$r('#ren')?$r('#ren').value:'';if(lv!=='')nr.lead=+lv;if(en)nr.end=en;S.recur.push(nr);saved.rec=rid}

      logTx(isNew?'add':'edit',prev,saved);S.defAcc=o.acc;closeSheet();commit(t('saved'));if(rp)runRecurring();if(rf)uploadReceipt(saved,rf)};
      if(months.length)closedEdit(months,doSave);else doSave()};
  });
}
function accForm(acc,preset){
  const isNew=!acc;acc=acc||Object.assign({type:'bank',name:'',currency:BASE(),opening:''},preset||{});let type=acc.type;
  const tn={cash:t('aCash'),bank:t('aBank'),wallet:t('aWallet'),card:t('aCard'),gold:t('aGold'),cert:t('aCert')};
  openSheet(isNew?t('addAcc'):acc.name+' · '+acc.currency,`<form class="form" id="f">
    <div style="display:contents" class="atw">${segHTML('at',ACC_TYPES.map(k=>[k,tn[k]]),type)}</div>
    <label class="fld"><span>${t('group')}</span><input class="in-f" id="gp" list="dl-ag" value="${esc(acc.group||'')}" placeholder="${esc(accGroup(Object.assign({},acc,{group:''})))}">${datalist('dl-ag',S.accounts.map(accGroup))}</label>
    <label class="fld"><span>${t('accName')}</span><input class="in-f" id="nm" value="${esc(acc.name)}" placeholder="${t('accNameHint')}"></label>${altFld(acc)}
    <label class="fld"><span id="ccL">${type==='gold'?t('karat'):t('currency')}</span><select class="in-f" id="cc">${curOpts(type==='gold'&&!isGold(acc.currency)?'G21':acc.currency,type==='gold')}</select></label>
    <label class="fld"><span id="opL">${type==='gold'?t('openingGrams'):t('opening')}</span><input class="in-f amt num" id="op" inputmode="decimal" value="${acc.opening}" placeholder="0"></label>
    <div id="certW" class="form" ${type==='cert'?'':'hidden'}>
      <div class="two"><label class="fld"><span>${t('certRate')}</span><input class="in-f num" id="cr" inputmode="decimal" value="${acc.rate||''}" placeholder="0"></label>
      <label class="fld"><span>${t('certEnd')}</span><input class="in-f" type="date" id="ce" value="${acc.maturity||''}"></label></div>
      <label class="fld"><span>${t('certPay')}</span><select class="in-f" id="cp">${['monthly','quarterly','yearly','maturity'].map(f=>`<option value="${f}" ${f===(acc.payout||'monthly')?'selected':''}>${f==='maturity'?t('atMaturity'):freqName(f)}</option>`).join('')}</select></label>
      ${isNew?`<label class="fld"><span>${t('certAuto')}</span><select class="in-f" id="ca"><option value="">${t('noAuto')}</option>${accOpts('').replace(/ selected/g,'')}</select></label>`:''}
    </div>
    <div id="cardW" class="form" ${type==='card'?'':'hidden'}>
      <div class="two"><label class="fld"><span>${t('closeDay')}</span><input class="in-f num" id="kd" inputmode="numeric" value="${acc.closeDay||''}" placeholder="11"></label>
      <label class="fld"><span>${t('payDay')}</span><input class="in-f num" id="kp" inputmode="numeric" value="${acc.dueDay||''}" placeholder="5"></label></div>
      <p class="hint" id="kEx"></p>
      <label class="fld"><span>${t('cardLimit')}</span><input class="in-f num" id="kl" inputmode="decimal" value="${acc.limit||''}" placeholder="0"></label>
      <p class="hint">${t('cardOpenHint')}</p>
    </div>
    ${isNew?'':`<p class="hint">${t('balance')}: ${moneyC(accBalance(acc),acc.currency)} ${acc.currency===BASE()?esc(curSym(BASE())):''}</p>`}
    <div class="foot">${isNew?'':`<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div>
  </form>`,r=>{
    const kEx=()=>{const cd=parseInt(val(r,'kd')),dd=parseInt(val(r,'kp')),el=r.querySelector('#kEx');if(!el)return;if(!(cd>=1&&cd<=31&&dd>=1&&dd<=31)){el.textContent=t('cardDaysNeed');return}
      const f={closeDay:cd,dueDay:dd},ex=[TODAY,iso(new Date(dOf(TODAY).getTime()+20*864e5))];el.textContent=ex.map(d=>t('cardEx').replace('%b',shortDate(d)).replace('%p',shortDate(cardDueFor(f,d)))).join(' · ')};
    ['kd','kp'].forEach(id=>{const e=r.querySelector('#'+id);if(e)e.addEventListener('input',kEx)});kEx();
    bindSeg(r,'at',v=>{const wasGold=type==='gold';type=v;r.querySelector('#certW').hidden=v!=='cert';r.querySelector('#cardW').hidden=v!=='card';
      if((v==='gold')!==wasGold){r.querySelector('#cc').innerHTML=curOpts(v==='gold'?'G21':BASE(),v==='gold');r.querySelector('#ccL').textContent=v==='gold'?t('karat'):t('currency');r.querySelector('#opL').textContent=v==='gold'?t('openingGrams'):t('opening')}});
    if(!isNew)r.querySelector('#del').onclick=()=>{
      if(S.tx.some(x=>x.acc===acc.id||x.toAcc===acc.id)){toast(t('accInUse'));return}
      {const u=[...S.recur.filter(r=>r.tpl.acc===acc.id||r.tpl.toAcc===acc.id).map(r=>r.tpl.note||catName(r.tpl.cat)),...S.inst.filter(o=>o.payWith===acc.id).map(o=>o.name),...S.goals.filter(g=>g.acc===acc.id).map(g=>g.name)];if(u.length){toast(t('accUsedBy')+' '+u.slice(0,3).join('، '),7000);return}}
      if(S.accounts.length<2){toast(t('accLast'));return}
      confirmSheet(t('confirmDel'),t('del'),()=>{S.accounts=S.accounts.filter(a=>a.id!==acc.id);if(S.defAcc===acc.id)S.defAcc=S.accounts[0].id;commit(t('deleted'))});
    };
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const nm=val(r,'nm');if(!nm){toast(t('needName'));return}
      const cc=val(r,'cc');
      if(S.accounts.some(a=>a.id!==acc.id&&a.name.trim()===nm&&a.currency===cc)){toast(t('accDup'));return}
      if(!isNew&&cc!==acc.currency&&S.tx.some(x=>x.acc===acc.id||x.toAcc===acc.id)){toast(t('accCurLocked'));return}
      const o={type,name:nm,currency:cc,opening:numv(r,'op'),group:val(r,'gp')};
      if(type==='card'){const d=x=>{const n=parseInt(val(r,x));return n>=1&&n<=31?n:''};Object.assign(o,{closeDay:d('kd'),dueDay:d('kp'),limit:numv(r,'kl')||0})}
      if(type==='cert')Object.assign(o,{rate:parseFloat(val(r,'cr'))||0,maturity:val(r,'ce')||'',payout:val(r,'cp')});
      let nid=acc.id;if(isNew){nid='a'+uid();S.accounts.push(Object.assign({id:nid},o))}else Object.assign(S.accounts.find(a=>a.id===acc.id),o);
      const ca=r.querySelector('#ca');
      if(isNew&&type==='cert'&&ca&&ca.value&&o.rate>0&&o.payout!=='maturity'){
        const n={monthly:12,quarterly:4,yearly:1}[o.payout],amt=Math.round(o.opening*o.rate/100/n*100)/100,dest=accOf(ca.value);
        const first=advance(TODAY,o.payout);
        S.recur.push({id:'r'+uid(),freq:o.payout,day:+first.slice(8,10),next:first,end:o.maturity||null,tpl:{type:'income',acc:dest.id,cat:'interest',amount:dest.currency===cc?amt:Math.round(amt*rateOf(cc)/(rateOf(dest.currency)||1)*100)/100,note:t('certReturn')+' · '+nm}});
      }
      closeSheet();commit(t('saved'));
      if(cc!==BASE()&&!rateOf(cc))updateRates(false);
    };
  });
}
function ratesForm(){
  const list=usedCurrencies();
  openSheet(t('rates'),`<form class="form" id="f">
    <p class="hint">${t('ratesHint')}</p>
    ${list.length?list.map(c=>`<label class="fld"><span>${isGold(c)?t('gramPrice')+' '+esc(curName(c)):'1 '+c+' ('+esc(curName(c))+')'} = ? ${esc(curSym(BASE()))}</span><input class="in-f num" inputmode="decimal" data-r="${c}" value="${S.rates[c]||''}"></label>`).join(''):`<p class="hint">${t('noForeign')}</p>`}
    <div class="foot"><button type="button" class="btn grow" id="up">${t('ratesUpdate')}</button><button class="btn pri grow">${t('save')}</button></div>
    ${S.ratesAt?`<p class="hint">${t('ratesAt')}: ${esc(dateOf(new Date(S.ratesAt))+' '+hmOf(new Date(S.ratesAt)))} · <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener" style="color:var(--accent)">ExchangeRate-API</a></p>`:''}
  </form>`,r=>{
    r.querySelector('#up').onclick=async()=>{S.goldManual=false;await updateRates(true);closeSheet();ratesForm()};
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();r.querySelectorAll('[data-r]').forEach(i=>{const v=parseFloat(i.value);if(v>0){if(isGold(i.dataset.r)&&v!==S.rates[i.dataset.r])S.goldManual=true;S.rates[i.dataset.r]=v}});closeSheet();commit(t('saved'))};
  });
}
function instForm(it){
  const isNew=!it;it=it||{name:'',monthly:'',currency:BASE(),group:'',count:12,start:TODAY_YM,paid:[]};
  openSheet(isNew?t('addInst'):it.name,`<form class="form" id="f">
    <label class="fld"><span>${t('name')}</span><input class="in-f" id="nm" value="${esc(it.name)}" placeholder="${S.lang==='en'?'e.g. Fridge':'مثلاً: تلاجة، عربية، موبايل'}"></label>${altFld(it)}
    <div class="two"><label class="fld"><span>${t('group')}</span><input class="in-f" id="gp" list="dl-og" value="${esc(it.group||'')}" placeholder="${t('groupHint')}">${datalist('dl-og',[...S.inst,...S.gam].map(o=>o.group))}</label>
    <label class="fld"><span>${t('payCat')}</span><select class="in-f" id="ic">${catOptsTree('expense',it.cat||'inst',false)}</select></label></div>
    <label class="fld"><span>${t('payWith')}</span><select class="in-f" id="pw"><option value="">${t('anyAcc')}</option>${S.accounts.map(a=>`<option value="${a.id}" ${a.id===it.payWith?'selected':''}>${esc(a.name)} · ${a.currency}</option>`).join('')}</select></label>
    <div class="two"><label class="fld"><span>${t('monthly')}</span><input class="in-f amt num" id="mo" inputmode="decimal" value="${it.monthly}"></label>
    <label class="fld"><span>${t('currency')}</span><select class="in-f" id="oc">${curOpts(it.currency||BASE())}</select></label></div>
    <div class="two"><label class="fld"><span>${t('count')}</span><input class="in-f num" id="ct" inputmode="numeric" value="${it.count}"></label>
    <label class="fld"><span>${t('startMonth')}</span><input class="in-f" type="month" id="st" value="${it.start}"></label></div>
    <label class="fld"><span>${t('dueDay')}</span><input class="in-f num" id="dd" inputmode="numeric" value="${it.dueDay||1}"></label>
    ${isNew?`<label class="fld"><span>${t('paidSoFar')}</span><input class="in-f num" id="pd" inputmode="numeric" value="0"></label>`:''}
    <div class="foot">${isNew?'':`<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div>
    ${!isNew&&it.paid.length?`<button type="button" class="btn block" id="undo">${t('undoLast')}</button>`:''}
  </form>`,r=>{
    if(!isNew){r.querySelector('#del').onclick=()=>confirmSheet(t('confirmDel'),t('del'),()=>{S.inst=S.inst.filter(x=>x.id!==it.id);commit(t('deleted'))});
      const u=r.querySelector('#undo');if(u)u.onclick=()=>{closeSheet();undoLast('inst',it.id)}}
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const nm=val(r,'nm'),mo=numv(r,'mo'),ct=Math.max(1,parseInt(val(r,'ct'))||1),st=val(r,'st')||TODAY_YM;
      if(!nm){toast(t('needName'));return}if(mo<=0){toast(t('needAmt'));return}
      if(isNew){const n=Math.min(ct,Math.max(0,parseInt(val(r,'pd'))||0));const o={id:uid(),name:nm,monthly:mo,currency:val(r,'oc'),group:val(r,'gp'),cat:val(r,'ic')||'inst',payWith:(r.querySelector('#pw')||{}).value||'',dueDay:Math.min(28,Math.max(1,parseInt(val(r,'dd'))||1)),count:ct,start:st,paid:[]};o.paid=instMonths(o).slice(0,n);S.inst.push(o)}
      else{const o=S.inst.find(x=>x.id===it.id);Object.assign(o,{name:nm,monthly:mo,currency:val(r,'oc'),group:val(r,'gp'),cat:val(r,'ic')||'inst',payWith:(r.querySelector('#pw')||{}).value||'',dueDay:Math.min(28,Math.max(1,parseInt(val(r,'dd'))||1)),count:ct,start:st});const ms=instMonths(o);o.paid=o.paid.filter(m=>ms.includes(m))}
      closeSheet();commit(t('saved'))};
  });
}
function gamForm(g){
  const isNew=!g;g=g||{name:'',share:'',currency:BASE(),group:'',members:10,myTurn:1,start:TODAY_YM,paid:[],received:false};
  openSheet(isNew?t('addGam'):g.name,`<form class="form" id="f">
    <label class="fld"><span>${t('name')}</span><input class="in-f" id="nm" value="${esc(g.name)}" placeholder="${S.lang==='en'?'e.g. Work circle':'مثلاً: جمعية الشغل'}"></label>${altFld(g)}
    <label class="fld"><span>${t('group')}</span><input class="in-f" id="gp" list="dl-og2" value="${esc(g.group||'')}" placeholder="${t('groupHint')}">${datalist('dl-og2',[...S.inst,...S.gam].map(o=>o.group))}</label>
    <div class="two"><label class="fld"><span>${t('share')}</span><input class="in-f amt num" id="sh" inputmode="decimal" value="${g.share}"></label>
    <label class="fld"><span>${t('currency')}</span><select class="in-f" id="oc">${curOpts(g.currency||BASE())}</select></label></div>
    <div class="two"><label class="fld"><span>${t('members')}</span><input class="in-f num" id="mb" inputmode="numeric" value="${g.members}"></label>
    <label class="fld"><span>${t('myTurn')}</span><input class="in-f num" id="tn" inputmode="numeric" value="${g.myTurn}"></label></div>
    <div class="two"><label class="fld"><span>${t('startMonth')}</span><input class="in-f" type="month" id="st" value="${g.start}"></label>
    <label class="fld"><span>${t('dueDay')}</span><input class="in-f num" id="dd" inputmode="numeric" value="${g.dueDay||1}"></label></div>
    ${isNew?`<label class="fld"><span>${t('paidSoFar')}</span><input class="in-f num" id="pd" inputmode="numeric" value="0"></label><label class="chk"><input type="checkbox" id="rc"> ${t('received')}</label>`:''}
    <div class="foot">${isNew?'':`<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div>
    ${!isNew&&g.paid.length?`<button type="button" class="btn block" id="undo">${t('undoLast')}</button>`:''}
  </form>`,r=>{
    if(!isNew){r.querySelector('#del').onclick=()=>confirmSheet(t('confirmDel'),t('del'),()=>{S.gam=S.gam.filter(x=>x.id!==g.id);commit(t('deleted'))});
      const u=r.querySelector('#undo');if(u)u.onclick=()=>{closeSheet();undoLast('gam',g.id)}}
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const nm=val(r,'nm'),sh=numv(r,'sh'),mb=Math.max(1,parseInt(val(r,'mb'))||1),tn=Math.min(mb,Math.max(1,parseInt(val(r,'tn'))||1)),st=val(r,'st')||TODAY_YM;
      if(!nm){toast(t('needName'));return}if(sh<=0){toast(t('needAmt'));return}
      if(isNew){const n=Math.min(mb,Math.max(0,parseInt(val(r,'pd'))||0));const o={id:uid(),name:nm,share:sh,currency:val(r,'oc'),group:val(r,'gp'),dueDay:Math.min(28,Math.max(1,parseInt(val(r,'dd'))||1)),members:mb,myTurn:tn,start:st,paid:[],received:r.querySelector('#rc').checked};o.paid=gamMonths(o).slice(0,n);S.gam.push(o)}
      else{const o=S.gam.find(x=>x.id===g.id);Object.assign(o,{name:nm,share:sh,currency:val(r,'oc'),group:val(r,'gp'),dueDay:Math.min(28,Math.max(1,parseInt(val(r,'dd'))||1)),members:mb,myTurn:tn,start:st});const ms=gamMonths(o);o.paid=o.paid.filter(m=>ms.includes(m))}
      closeSheet();commit(t('saved'))};
  });
}
function loanForm(l){
  const isNew=!l;l=l||{dir:'lent',person:'',amount:'',currency:BASE(),date:TODAY,note:'',pays:[]};let dir=l.dir;
  openSheet(isNew?t('addLoan'):l.person,`<form class="form" id="f">
    ${segHTML('dr',[['lent',t('lent')],['borrowed',t('borrowed')]],dir)}
    <div class="two"><label class="fld"><span>${t('person')}</span><input class="in-f" id="pr" list="dl-lp" value="${esc(l.person)}">${datalist('dl-lp',S.loans.map(x=>x.person))}</label>
    <label class="fld"><span>${t('group')}</span><input class="in-f" id="gp" list="dl-lg" value="${esc(l.group||'')}" placeholder="${t('groupHint')}">${datalist('dl-lg',S.loans.map(x=>x.group))}</label></div>
    <div class="two"><label class="fld"><span>${t('amount')}</span><input class="in-f amt num" id="amt" inputmode="decimal" value="${l.amount}"></label>
    <label class="fld"><span>${t('currency')}</span><select class="in-f" id="lc">${curOpts(l.currency||BASE())}</select></label></div>
    <div class="two"><label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${l.date}"></label>
    <label class="fld" id="ldW" ${l.plan==='inst'?'hidden':''}><span>${t('loanDue')}</span><input class="in-f" type="month" id="ld" value="${l.due||''}"></label></div>
    <label class="fld"><span id="laL">${dir==='borrowed'?t('loanIntoAcc'):t('loanFromAcc')}</span><select class="in-f" id="la"></select></label>
    ${isNew?'':(()=>{const ox=S.tx.find(x=>x.link&&x.link.k==='loanorig'&&x.link.id===l.id),want=loanOrigAmt(l);
      return (ox&&Math.abs(+ox.amount-want)>0.5?`<div class="banner" style="background:var(--warn-soft)"><span>⚠️ ${t('loanMismatch').replace('%t',fmt(+ox.amount)).replaceAll('%l',fmt(want)).replace('%d',fmt(Math.abs(+ox.amount-want)))}</span></div>`:'')+`<p class="hint" style="margin:-4px 0 0">${t('loanSyncHint')}</p>`})()}
    <div class="fld"><span>${t('loanPlan')}</span>${segHTML('lp',[['once',t('planOnce')],['inst',t('planInst')]],l.plan||'once')}</div>
    ${!isNew?`<div class="row" style="padding:0 2px"><div class="main"><span class="s">${t('loanPaidSoFar')} ${moneyC(loanPaid(l),l.currency)} · ${t('remaining')} ${moneyC(loanLeft(l),l.currency)}</span></div><button type="button" class="btn sm" id="topup">+ ${l.dir==='borrowed'?t('loanMoreB'):t('loanMoreL')}</button></div>`:''}
    ${(l.adds||[]).length?`<div class="list">${l.adds.map(z=>`<div class="row"><div class="main"><span class="t">+ ${moneyC(z.amount,l.currency)}</span><span class="s">${t('loanAdded')} · ${esc(dayLbl(z.date))}</span></div></div>`).join('')}</div>`:''}
    <div id="liW" ${l.plan==='inst'?'':'hidden'}><div class="two"><label class="fld"><span>${t('monthly')}</span><input class="in-f amt num" id="lia" inputmode="decimal" value="${l.instAmt||''}"></label>
    <label class="fld"><span>${t('instMonths')}</span><input class="in-f num" id="lic" inputmode="numeric" value=""></label></div>
    <label class="fld"><span>${t('instFrom')}</span><input class="in-f" type="month" id="lis" value="${l.instStart||ymAdd(TODAY_YM,1)}"></label></div>
    <p class="hint" id="liH" ${l.plan==='inst'?'':'hidden'}></p>
    <label class="fld"><span>${t('note')}</span><input class="in-f" id="nt" value="${esc(l.note)}"></label>
    ${!isNew&&l.pays.length?`<div class="list">${l.pays.map(p=>`<div class="row"><div class="main"><span class="t">${moneyC(p.amount,l.currency)}</span><span class="s">${esc(dayLbl(p.date))}</span></div><button type="button" class="btn sm danger" data-pay="${p.id}">${t('del')}</button></div>`).join('')}</div>`:''}
    <div class="foot">${isNew?'':`<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div>
  </form>`,r=>{
    const OX=isNew?null:S.tx.find(x=>x.link&&x.link.k==='loanorig'&&x.link.id===l.id);let first=true;
    const fillAcc=()=>{const sel=r.querySelector('#la');if(!sel)return;const cc=val(r,'lc')||BASE(),prev=first?(isNew?'':(OX?OX.acc:'')):sel.value,accs=S.accounts.filter(a=>a.currency===cc&&isLiquid(a)),def=(first&&!isNew)?prev:prev&&accs.some(a=>a.id===prev)?prev:(payAcc(cc)||(accs[0]||{}).id||'');first=false;
      sel.innerHTML=accs.map(a=>`<option value="${a.id}" ${a.id===def?'selected':''}>${esc(a.name)} · ${a.currency} · ${fmt(accBalance(a))}</option>`).join('')+`<option value="" ${accs.length?'':'selected'}>${t('loanNoAcc')}</option>`;
      r.querySelector('#laL').textContent=dir==='borrowed'?t('loanIntoAcc'):t('loanFromAcc')};
    bindSeg(r,'dr',v=>{dir=v;fillAcc()});let plan=l.plan||'once';fillAcc();r.querySelector('#lc').addEventListener('change',fillAcc);
    /* installments spread what is still left: total (with moves and drops) minus what was paid */
    const leftOf=()=>Math.max(0,Math.round((numv(r,'amt')+(isNew?0:loanAdj(l))-(isNew?0:loanPaid(l)))*100)/100);
    /* unchanged plan: show the months still open on the current schedule; changed plan: the new spread of what is left */
    const sameAsNow=()=>!isNew&&(l.plan||'once')==='inst'&&numv(r,'amt')===+l.amount&&numv(r,'lia')===+l.instAmt&&val(r,'lis')===l.instStart;
    const openMonths=()=>{let paid=loanPaid(l);return loanSched(l).filter(x=>{const take=Math.min(paid,x.amount);paid-=take;return x.amount-take>0.004})};
    const liHint=()=>{const a=leftOf(),q=numv(r,'lia');let n=q>0?Math.ceil(a/q-1e-9):0,last=ymAdd(val(r,'lis')||TODAY_YM,n-1),lastV=Math.round((a-q*(n-1))*100)/100;
      if(sameAsNow()){const om=openMonths();n=om.length;if(n){last=om[n-1].m;lastV=om[n-1].amount}}
      if(document.activeElement!==r.querySelector('#lic'))r.querySelector('#lic').value=n||'';
      r.querySelector('#liH').textContent=a>0&&q>0&&n>0?(isNew?'':t('instOfLeft').replace('%v',fmt(a))+' ')+t('instCount').replace('%n',n).replace('%m',monthLbl(last))+(lastV<q-0.004?' · '+t('lastInst')+' '+fmt(lastV):''):''};
    bindSeg(r,'lp',v=>{plan=v;r.querySelector('#liW').hidden=v!=='inst';r.querySelector('#liH').hidden=v!=='inst';r.querySelector('#ldW').hidden=v==='inst';liHint()});
    ['amt','lia','lis'].forEach(id=>r.querySelector('#'+id).addEventListener('input',liHint));
    r.querySelector('#lic').addEventListener('input',()=>{const n=Math.round(numv(r,'lic'));if(n>0){r.querySelector('#lia').value=Math.ceil(leftOf()/n*100)/100;liHint()}});liHint();
    if(!isNew)r.querySelector('#topup').onclick=()=>loanTopUp(l.id);
    r.querySelectorAll('[data-pay]').forEach(b=>b.onclick=()=>{const o=S.loans.find(x=>x.id===l.id);o.pays=o.pays.filter(p=>p.id!==b.dataset.pay);S.tx=S.tx.filter(x=>!(x.link&&x.link.k==='loan'&&x.link.pay===b.dataset.pay));save();render();loanForm(o)});
    if(!isNew)r.querySelector('#del').onclick=()=>confirmSheet(S.tx.some(x=>x.link&&x.link.k==='loanorig'&&x.link.id===l.id)?t('loanDelOrig'):t('confirmDel'),t('del'),()=>{S.loans=S.loans.filter(x=>x.id!==l.id);S.tx=S.tx.filter(x=>!(x.link&&x.link.k==='loanorig'&&x.link.id===l.id));commit(t('deleted'))});
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const pr=val(r,'pr'),a=numv(r,'amt');if(!pr){toast(t('needName'));return}if(a<=0){toast(t('needAmt'));return}
      const o={dir,person:pr,group:val(r,'gp'),amount:a,currency:val(r,'lc'),date:val(r,'dt')||TODAY,due:plan==='once'?(val(r,'ld')||''):'',plan,instAmt:plan==='inst'?numv(r,'lia'):0,instStart:plan==='inst'?(val(r,'lis')||ymAdd(TODAY_YM,1)):'',note:val(r,'nt')};
      if(plan==='inst'&&!(o.instAmt>0)){toast(t('needAmt'));return}
      if(isNew){const nl=Object.assign({id:uid(),pays:[]},o);S.loans.push(nl);const acc=val(r,'la');
        if(acc)S.tx.push({id:uid(),acc,type:dir==='borrowed'?'income':'expense',cat:dir==='borrowed'?'loanrecv':'loangive',amount:a,date:o.date,note:(dir==='borrowed'?t('borrowedFrom'):t('lentTo'))+' · '+pr+(o.note?' · '+o.note:''),link:{k:'loanorig',id:nl.id}})}
      else{const L=S.loans.find(x=>x.id===l.id);
        /* keep the money entry in step with the loan: same direction, account, date and person, amount moved by the change made here */
        {const acc=val(r,'la'),ox=S.tx.find(x=>x.link&&x.link.k==='loanorig'&&x.link.id===L.id),note=(dir==='borrowed'?t('borrowedFrom'):t('lentTo'))+' · '+pr+(o.note?' · '+o.note:'');
          const fields={acc,type:dir==='borrowed'?'income':'expense',cat:dir==='borrowed'?'loanrecv':'loangive',date:o.date,note};
          if(ox&&!acc){logTx('del',ox,null);S.tx=S.tx.filter(x=>x!==ox)}
          else if(ox){const before=Object.assign({},ox),amt=loanOrigAmt(L,a);if(amt<=0.004){toast(t('needAmt'));return}Object.assign(ox,fields,{amount:amt});logTx('edit',before,ox)}
          else if(acc){const amt=loanOrigAmt(L,a);if(amt<=0.004){toast(t('needAmt'));return}const nx=Object.assign({id:uid(),amount:amt,link:{k:'loanorig',id:L.id}},fields);S.tx.push(nx);logTx('add',null,nx)}}
        /* a new plan applies to what is left now: moves and drops are folded into the amount and what was already paid stays as paid */
        const replan=o.plan!==(L.plan||'once')||+o.amount!==+L.amount||(o.plan==='inst'&&(+o.instAmt!==+L.instAmt||o.instStart!==L.instStart))||(o.plan==='once'&&o.due!==(L.due||''));
        if(replan){o.folded=Math.round(((+L.folded||0)+loanAdj(L))*100)/100;o.amount=Math.round((o.amount+loanAdj(L))*100)/100;o.adj=[];o.instBase=o.plan==='inst'?Math.min(loanPaid(L),o.amount):0}
        Object.assign(L,o)}
      closeSheet();commit(t('saved'))};
  });
}
function loanTopUp(id){
  const l=S.loans.find(x=>x.id===id);if(!l)return;const cc=l.currency||BASE(),accs=S.accounts.filter(a=>a.currency===cc&&a.type!=='card');
  openSheet((l.dir==='borrowed'?t('loanMoreB'):t('loanMoreL'))+' · '+l.person,`<form class="form" id="f">
    <div class="two"><label class="fld"><span>${t('amount')}</span><input class="in-f amt num" id="amt" inputmode="decimal"></label>
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${TODAY}"></label></div>
    <label class="fld"><span>${l.dir==='borrowed'?t('loanIntoAcc'):t('loanFromAcc')}</span><select class="in-f" id="ac">${accs.map(a=>`<option value="${a.id}" ${a.id===payAcc(cc)?'selected':''}>${esc(a.name)}</option>`).join('')}<option value="">${t('loanNoAcc')}</option></select></label>
    <p class="hint">${t('loanMoreHint')}</p>
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const a=numv(r,'amt');if(!(a>0)){toast(t('needAmt'));return}const L=S.loans.find(x=>x.id===id),date=val(r,'dt')||TODAY,acc=val(r,'ac');
      if(acc){const tx={id:uid(),acc,type:L.dir==='borrowed'?'income':'expense',cat:L.dir==='borrowed'?'loanrecv':'loangive',amount:a,date,note:(L.dir==='borrowed'?t('loanMoreB'):t('loanMoreL'))+' · '+L.person};S.tx.push(tx);relink(tx,{k:'loanadd',id:L.id})}
      else{L.adds=(L.adds||[]).concat({id:uid(),amount:a,date});L.amount=Math.round((+L.amount+a)*100)/100}
      save();render();toast(t('loanMoreDone'));loanForm(L)}});
}
function repayForm(l){
  openSheet(t('repay')+' · '+l.person,`<form class="form" id="f">
    <label class="fld"><span>${t('amount')} (${t('remaining')}: ${fmt(loanLeft(l))} ${esc(curSym(l.currency||BASE()))})</span><input class="in-f amt num" id="amt" inputmode="decimal" value="${l.plan==='inst'?(Math.min(loanLeft(l),loanOwedUpTo(l,TODAY_YM)||+l.instAmt||loanLeft(l))):loanLeft(l)}"></label>
    <div class="two"><label class="fld"><span>${l.dir==='borrowed'?t('fromAcc'):t('toAcc')}</span><select class="in-f" id="ra"><option value="">${t('noAccount')}</option>${S.accounts.filter(a=>a.currency===(l.currency||BASE())).map(a=>`<option value="${a.id}" ${a.id===payAcc(l.currency||BASE())?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${TODAY}"></label></div>
    ${remBlock(TODAY_YM,true)}
    <p class="hint">${t('repayHint')}</p>
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    const dueNow=l.plan==='inst'?Math.min(loanLeft(l),loanOwedUpTo(l,TODAY_YM)||+l.instAmt||loanLeft(l)):loanLeft(l),getRem=bindRem(r,dueNow);
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const a=numv(r,'amt');if(a<=0){toast(t('needAmt'));return}
      const rr=getRem(),L=S.loans.find(x=>x.id===l.id);
      if(rr&&rr.act!=='keep'){L.adj=L.adj||[];L.adj.push({m:TODAY_YM,amount:-rr.rem});if(rr.act!=='drop')L.adj.push({m:rr.act,amount:rr.rem})}
      const pid=uid(),date=val(r,'dt')||TODAY,acc=val(r,'ra');S.loans.find(x=>x.id===l.id).pays.push({id:pid,amount:a,date});
      if(acc)S.tx.push({id:uid(),type:l.dir==='borrowed'?'expense':'income',acc,cat:l.dir==='borrowed'?'loanpay':'loanback',amount:a,date,note:t('repay')+' · '+l.person,link:{k:'loan',id:l.id,pay:pid}});
      closeSheet();commit(t('saved'))}});
}
function budgetForm(){
  openSheet(t('editBudget'),`<form class="form" id="f">${S.cats.expense.filter(c=>!c.sys).map(c=>`<label class="fld ${c.parent?'sub':''}"><span>${esc(c.parent?catPath(c.id):cName(c))}</span><input class="in-f num" inputmode="decimal" data-b="${c.id}" value="${S.budgets[c.id]||''}" placeholder="${t('noBudget')}"></label>`).join('')}
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const b={};r.querySelectorAll('[data-b]').forEach(i=>{const v=parseFloat(i.value);if(v>0)b[i.dataset.b]=v});S.budgets=b;closeSheet();commit(t('saved'))}});
}

