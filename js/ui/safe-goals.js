
function safeSheet(){
  const x=safeToSpend(),row=(l,v,c)=>`<div class="row"><div class="main"><span class="t">${l}</span></div><b class="amt ${c||''}">${money(v)}</b></div>`;
  openSheet(t('safeTitle'),`<div class="form"><div class="list">
    ${row(t('safeLiquid'),x.liquid)}${row(t('safeObl'),-x.obl,x.obl?'neg':'')}${row(t('safeRec'),-x.recOut,x.recOut?'neg':'')}${x.goals?row(t('safeGoals'),-x.goals,'neg'):''}
    <div class="row"><div class="main"><span class="t"><b>${t('safeTitle')}</b></span><span class="s">${fmt(x.perDay)} ${esc(curSym(BASE()))} ${t('perDay')} · ${x.daysLeft} ${t('daysLeft')}</span></div><b class="amt ${x.safe<0?'neg':'pos'}">${money(x.safe)}</b></div>
    </div><div class="list">${x.goals?row(t('goalsKeep'),x.goals):''}${row(t('budStill'),-x.bud,x.bud?'neg':'')}${x.other?row(t('otherOut'),-x.other,'neg'):''}${x.recIn?row(t('inToEnd'),x.recIn,'pos'):''}
    <div class="row mend"><div class="main"><span class="t">${t('safeToEnd')}</span><span class="s">${esc(shortDate(monthEnd(TODAY_YM)))}</span></div><b class="amt balaft">${money(x.end)}</b></div></div><p class="hint">${t('safeHint')}</p></div>`);
}
function goalForm(g){
  const isNew=!g;g=g||{name:'',target:'',currency:BASE(),due:'',acc:'',saved:[]};
  openSheet(isNew?t('addGoal'):g.name,`<form class="form" id="f">
    <label class="fld"><span>${t('goalName')}</span><input class="in-f" id="nm" value="${esc(g.name)}" placeholder="${t('goalNameHint')}"></label>${altFld(g)}
    <div class="two"><label class="fld"><span>${t('goalTarget')}</span><input class="in-f amt num" id="tg" inputmode="decimal" value="${g.target}"></label>
    <label class="fld"><span>${t('currency')}</span><select class="in-f" id="gc">${curOpts(g.currency||BASE())}</select></label></div>
    <label class="fld"><span>${t('goalDue')}</span><input class="in-f" type="date" id="du" value="${g.due||''}"></label>
    <label class="fld"><span>${t('goalAcc')}</span><select class="in-f" id="ga"><option value="">${t('goalManual')}</option>${accOpts(g.acc||'').replace(/ selected/g,'')}</select></label>
    <div class="foot">${isNew?'':`<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    if(g.acc)r.querySelector('#ga').value=g.acc;
    if(!isNew)r.querySelector('#del').onclick=()=>confirmSheet(t('confirmDel'),t('del'),()=>{S.goals=S.goals.filter(x=>x.id!==g.id);commit(t('deleted'))});
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const nm=val(r,'nm'),tg=numv(r,'tg');if(!nm){toast(t('needName'));return}if(tg<=0){toast(t('needAmt'));return}
      const o={name:nm,target:tg,currency:val(r,'gc'),due:val(r,'du'),acc:val(r,'ga')};
      if(isNew)S.goals.push(Object.assign({id:'g'+uid(),saved:[]},o));else Object.assign(S.goals.find(x=>x.id===g.id),o);closeSheet();commit(t('saved'))};
  });
}
function goalAddForm(g){
  openSheet(t('goalAdd')+' · '+g.name,`<form class="form" id="f"><label class="fld"><span>${t('amount')} (${esc(curName(g.currency||BASE()))})</span><input class="in-f amt num" id="amt" inputmode="decimal"></label>
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${TODAY}"></label><div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    setTimeout(()=>r.querySelector('#amt').focus(),60);
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const a=numv(r,'amt');if(!(a>0)){toast(t('needAmt'));return}const o=S.goals.find(x=>x.id===g.id);o.saved=o.saved||[];o.saved.push({id:uid(),amount:a,date:val(r,'dt')||TODAY});closeSheet();commit(t('saved'))};
  });
}
function goalsBody(){
  const LGo=oblList('goal');return `<p class="hint">${t('goalsHint')}</p>`+(LGo.length?LGo.map(g=>{const sv=goalSaved(g),p=Math.min(1,sv/(+g.target||1)),mo=goalMonthly(g),cc=g.currency||BASE();
    return `<div class="card"><div class="hd"><h3>${esc(g.name)}</h3>${p>=1?`<span class="pill ok">${t('goalDone')}</span>`:g.due?`<span class="pill">${esc(shortDate(g.due))}</span>`:''}</div>
      <div class="kv"><div><span class="label">${t('goalTarget')}</span><b>${moneyC(g.target,cc)}</b></div><div><span class="label">${t('goalSavedL')}</span><b>${moneyC(sv,cc)}</b></div><div><span class="label">${t('remaining')}</span><b>${moneyC(Math.max(0,g.target-sv),cc)}</b></div></div>
      <div class="bar"><i style="width:${p*100}%"></i></div>
      <span class="muted">${g.acc?t('goalLinked')+' '+esc(accOf(g.acc).name):''}${mo?(g.acc?' · ':'')+t('goalPerMonth')+' '+fmt(mo)+' '+esc(curSym(cc)):''}</span>
      <div class="acts">${g.acc?'':`<button class="btn sm pri" data-act="goalAdd" data-id="${g.id}">${t('goalAdd')}</button>`}<button class="btn sm" data-act="editGoal" data-id="${g.id}">${t('edit')}</button></div></div>`}).join(''):`<div class="list"><div class="empty">${t('noItems')}</div></div>`);
}
