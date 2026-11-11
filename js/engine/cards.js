/* ---------- credit cards: statement close day, payment day, what is due ---------- */
const dateIn=(y,m,d)=>{while(m<1){m+=12;y--}while(m>12){m-=12;y++}return y+'-'+pad(m)+'-'+pad(Math.min(d,new Date(y,m,0).getDate()))};
function cardInfo(a,at){
  const lim=at||'9999-12-31';at=at||TODAY;const owed=Math.max(0,-(lim===at?accBalanceAt(a,at):accBalance(a)));if(!a.closeDay)return {owed,due:0};
  const cd=+a.closeDay,dd=+(a.dueDay||cd),y=+at.slice(0,4),m=+at.slice(5,7);
  let close=dateIn(y,m,cd);if(close>at)close=dateIn(y,m-1,cd);
  const [cy,cm]=close.split('-').map(Number);let dueDate=dateIn(cy,dd>cd?cm:cm+1,dd);if(a.defer&&a.defer.close===close)dueDate=a.defer.to;
  const stmt=Math.max(0,-accBalanceAt(a,close)),paid=S.tx.filter(x=>x.date>close&&x.date<=lim&&((x.type==='transfer'&&x.toAcc===a.id)||(x.type==='income'&&x.acc===a.id))).reduce((v,x)=>v+(+(x.type==='transfer'?(x.toAmount??x.amount):x.amount)||0),0);
  const due=Math.max(0,Math.round((stmt-paid)*100)/100);
  return {owed,due,dueDate,close,nextClose:dateIn(cy,cm+1,cd),cycle:Math.max(0,owed-due)};
}
const cards=()=>S.accounts.filter(a=>a.type==='card');
function cardsBody(){
  const list=oblList('card');
  const PEc=perRange()[1];return `<p class="hint">${t('cardsHint')}</p>`+(list.length?list.map(a=>{const c=cardInfo(a,PEc),sym=curSym(a.currency);
    return `<div class="card"><div class="hd tap" data-act="stmtAcc" data-id="${a.id}"><div><h3>${esc(a.name)} ›</h3><span class="muted">${a.closeDay?`${t('closeDay')} ${a.closeDay} · ${t('payDay')} ${a.dueDay||a.closeDay}`:t('cardNoDays')}</span></div>${c.owed?`<span class="pill warn">${t('iOwe')}</span>`:`<span class="pill ok">${t('settled')}</span>`}</div>
      <div class="kv"><div><span class="label">${t('cardOwed')}</span><b class="${c.owed?'neg':''}">${fmt(c.owed)} <small>${esc(sym)}</small></b></div><div><span class="label">${t('cardDue')}${c.dueDate?' '+esc(shortDate(c.dueDate)):''}</span><b>${fmt(c.due)} <small>${esc(sym)}</small></b></div><div><span class="label">${t('cardCycle')}</span><b>${fmt(c.cycle)} <small>${esc(sym)}</small></b></div></div>
      ${a.limit?`<div class="bar"><i class="${c.owed/a.limit>=.8?'warn':''}" style="width:${Math.min(100,c.owed/a.limit*100)}%"></i></div><span class="muted">${t('cardLimit')}: ${fmt(a.limit)} · ${t('cardAvail')}: ${fmt(Math.max(0,a.limit-c.owed))}</span>`:''}
      ${cardStmtsHTML(a,c)}
      <div class="acts">${c.owed?`<button class="btn sm pri" data-act="payCard" data-id="${a.id}">${t('pay')}</button>`:''}<button class="btn sm" data-act="stmtAcc" data-id="${a.id}">${t('statement')}</button><button class="btn sm" data-act="editAcc" data-id="${a.id}">${t('edit')}</button></div></div>`}).join(''):`<div class="list"><div class="empty">${t('noCards')}</div></div>`);
}
/* the card's statements: the one building up now, the last closed one and the one before; tap one to see its purchases */
function cardCycles(a){const cd=+a.closeDay;if(!cd)return [];const c=cardInfo(a),dd=+(a.dueDay||cd);
  const dueOf=C=>{if(a.defer&&a.defer.close===C)return a.defer.to;const [y,m]=C.split('-').map(Number);return dateIn(y,dd>cd?m:m+1,dd)};
  const prevOf=C=>{const [y,m]=C.split('-').map(Number);return dateIn(y,m-1,cd)};
  return [c.nextClose,c.close,prevOf(c.close)].map((C,i)=>{const P=prevOf(C),list=S.tx.filter(x=>x.acc===a.id&&x.date>P&&x.date<=C&&(x.type==='expense'||x.type==='transfer'));
    return {C,P,due:dueOf(C),open:i===0,cur:i===1,left:i===1?c.due:0,list,sum:list.reduce((v,x)=>v+(+x.amount||0),0)}})}
function cardStmtsHTML(a,c){const cy=cardCycles(a);if(!cy.length)return '';const sym=curSym(a.currency);
  return `<div class="list cst"><div class="grp"><span>${t('cStmts')}</span></div>${cy.map(s=>`<div class="row tap" data-act="why" data-w="cst:${a.id}:${s.C}"><div class="main"><span class="t">${esc((s.open?t('cStOpen'):s.cur?t('cStDue'):t('cStPrev')).replace('%c',s.C.slice(8,10)+'/'+s.C.slice(5,7)))}</span><span class="s">${esc(t('cStPay').replace('%d',s.due.slice(8,10)+'/'+s.due.slice(5,7)))} · ${s.list.length?s.list.length+' '+t('rowsWord'):t('cStNone')}${s.cur?' · '+(s.left>0.5?`<span class="neg">${t('cStLeft').replace('%v',fmt(s.left))}</span>`:`<span class="pos">${t('cStPaid')}</span>`):''}</span></div><b class="amt">${fmt(s.sum)} <small>${esc(sym)}</small></b></div>`).join('')}</div>`}
function payCard(id){const a=accById(id);if(!a)return;const c=cardInfo(a),due=c.due||c.owed;
  const froms=S.accounts.filter(x=>x.id!==a.id&&x.currency===a.currency&&isLiquid(x)),def=(froms.find(x=>x.type==='bank')||froms[0]||{}).id;
  if(!froms.length){toast(t('needAccCur')+' '+a.currency);return}
  openSheet(t('pay')+' · '+a.name,`<form class="form" id="f">
    <div class="sumgrid"><div><span class="label">${t('cardDue')}${c.dueDate?' '+esc(shortDate(c.dueDate)):''}</span><b class="num">${fmt(c.due)}</b></div><div><span class="label">${t('cardOwed')}</span><b class="num">${fmt(c.owed)}</b></div></div>
    <label class="fld"><span>${t('amountPaid')}</span><input class="in-f amt num" id="amt" inputmode="decimal" value="${due}"></label>
    <div class="two"><label class="fld"><span>${t('fromAcc')}</span><select class="in-f" id="acc">${froms.map(x=>`<option value="${x.id}" ${x.id===def?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${TODAY}"></label></div>
    ${remBlock(c.dueDate?c.dueDate.slice(0,7):TODAY_YM,false)}
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    const getRem=c.due>0?bindRem(r,c.due):()=>null;
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const v=numv(r,'amt');if(v<=0){toast(t('needAmt'));return}
      const rr=getRem();if(rr&&rr.act!=='keep'&&c.close)a.defer={close:c.close,to:rr.act+'-'+pad(Math.min(28,+(a.dueDay||5)))};
      S.tx.push({id:uid(),type:'transfer',acc:val(r,'acc'),toAcc:a.id,amount:v,toAmount:v,date:val(r,'dt')||TODAY,note:t('cardPayNote')+' · '+a.name,cat:'transfer'});
      closeSheet();commit(t('saved'))}});
}

let oblF=new Set(),oblC=new Set(),oblQ='';
/* figures for one installment / gam'eya over the period chosen at the top */
function oblStats(k,o){
  const [PA,PE]=perRange(),am=PA.slice(0,7),em=PE.slice(0,7),per=oblPer(k,o),ms=oblMonths(k,o),cc=o.currency||BASE();
  let due=0,late=0;ms.forEach(m=>{if(o.paid.includes(m))return;const v=per-partOf(o,m),e=effM(o,m);if(e<am)late+=v;else if(e<=em)due+=v});
  const lk=S.tx.filter(x=>x.link&&x.link.k===k&&x.link.id===o.id),sumIn=(a,b)=>lk.filter(x=>x.date>=a&&x.date<=b).reduce((v,x)=>v+(+x.amount||0),0);
  const paidP=sumIn(PA,PE),paidCum=oblPaidReal(k,o,PE);
  const B=v=>toBase(v,cc);return {due:B(due),late:B(late),paidP:B(paidP),paidCum:B(paidCum),left:B(oblLeftAt(k,o,PE)),total:B(per*ms.length),waived:B(oblWaived(k,o))};
}
const payType=o=>{const a=accById(o.payWith)||accById(S.defAcc);return a&&a.type==='card'?'card':a&&a.type==='cash'?'cash':'bank'};
function oblStatus(k,o){
  if(k==='loan'){const em=perRange()[1].slice(0,7);return loanLeft(o)<=0.004?'done':loanOwedUpTo(o,ymAdd(TODAY_YM,-1))>0.004?'late':loanOwedUpTo(o,em)>0.004?'due':''}
  if(oblLeft(k,o)<=0.004)return 'done';
  if(oblMonths(k,o).some(m=>!o.paid.includes(m)&&effM(o,m)<TODAY_YM))return 'late';
  const st=oblStats(k,o);return st.due>0.004?'due':'';
}
/* search and the filter chips (same kind: any of them; different kinds: all of them) */
function oblBase(k){const q=oblQ.trim().toLowerCase(),has=x=>!q||x.toLowerCase().includes(q);
  const kinds={};oblC.forEach(c=>{const [g,v]=c.split(':');(kinds[g]=kinds[g]||[]).push(v)});
  const chip=(k2,o)=>Object.entries(kinds).every(([g,vs])=>g==='st'?vs.includes(oblStatus(k2,o)):g==='pay'?vs.includes(payType(o)):g==='grp'?vs.includes(o.group||''):true);
  if(k==='inst')return S.inst.filter(o=>has([o.name,o.note,o.group,catName(o.cat||'inst')].join(' '))&&chip('inst',o));
  if(k==='gam')return S.gam.filter(o=>has([o.name,o.note,o.group].join(' '))&&chip('gam',o));
  if(k==='loan')return S.loans.filter(l=>has([l.person,l.note,l.group].join(' '))&&chip('loan',l));
  if(k==='card')return cards().filter(a=>has(a.name));
  if(k==='goal')return S.goals.filter(g=>has([g.name,g.note].join(' ')));
  return [];}
/* tapping totals narrows the list further (any of the totals you picked) */
const oblDone=(k,o)=>{const E=perRange()[1];return k==='inst'||k==='gam'?oblLeftAt(k,o,E)<0.5:k==='loan'?loanLeftAt(o,E)<0.5:false};
function oblList(k){const L0=oblBase(k),L=oblF.size||oblQ||SHOW_DONE['t'+k]?L0:L0.filter(o=>!oblDone(k,o));if(!oblF.size)return L;const E=perRange()[1];
  return L.filter(o=>{
    if(k==='inst'||k==='gam'){const st=oblStats(k,o);return (oblF.has('due')&&st.due+st.late>0.004)||(oblF.has('paid')&&st.paidP>0.004)||(oblF.has('left')&&st.left>0.004)}
    if(k==='loan'){const v=loanLeftAt(o,E);return (oblF.has('lent')&&o.dir==='lent'&&v>0.004)||(oblF.has('borrowed')&&o.dir==='borrowed'&&v>0.004)}
    if(k==='card'){const c=cardInfo(o,E);return (oblF.has('owed')&&c.owed>0)||(oblF.has('cdue')&&c.due>0)}
    return true})}
function oblSum(){
  const [PA,PE]=perRange(),endLbl=dmyOf(dsDate(PE)).replace(/\/\d{4}/,'');
  const box=(...cells)=>`<div class="totbar">${cells.map(([l,v,cl,f,sm,wk])=>`<div class="${f?'tap':''} ${f&&oblF.has(f)?'on':''}" ${f?`data-of="${f}"`:''}><span class="label">${l}${f&&oblF.has(f)?' ✓':''}${wk?` <button type="button" class="info" data-act="why" data-w="${wk}" aria-label="details">ⓘ</button>`:''}</span><b class="${cl||''}">${typeof v==='string'?esc(v):fmt(Math.round(v))}</b>${sm?`<small class="muted" style="font-size:11px;line-height:1.3">${sm}</small>`:''}</div>`).join('')}</div>`;
  if(oblTab==='inst'||oblTab==='gam'){const L=oblBase(oblTab);if(!(oblTab==='inst'?S.inst:S.gam).length)return '';const T={due:0,late:0,paidP:0,paidCum:0,left:0,total:0};L.forEach(o=>{const st=oblStats(oblTab,o);for(const x in T)T[x]+=st[x]});
    return box([t('dueLbl'),T.due,'','due',T.late>0.5?t('plusLate')+' '+fmt(Math.round(T.late)):t('noLate'),'oDue'],[t('paidLbl'),T.paidP,'','paid',t('sinceStart')+' '+esc(endLbl)+': '+fmt(Math.round(T.paidCum)),'oPaid'],[t('remaining'),T.left,'neg','left',t('ofTotal')+' '+fmt(Math.round(T.total))+(T.waived>0.5?' · '+t('waivedLbl')+' '+fmt(Math.round(T.waived)):''),'oLeft'])}
  if(oblTab==='loan'){if(!S.loans.length)return '';const L=oblBase('loan'),sm=d=>L.filter(l=>l.dir===d),left=d=>sm(d).reduce((v,l)=>v+toBase(loanLeftAt(l,PE),l.currency||BASE()),0),paidP=d=>sm(d).reduce((v,l)=>v+toBase(l.pays.filter(p=>p.date>=PA&&p.date<=PE).reduce((a,p)=>a+(+p.amount||0),0),l.currency||BASE()),0);
    const r=left('lent'),p=left('borrowed');return box([t('owedToMe'),r,'pos','lent',t('gotInPer')+' '+fmt(Math.round(paidP('lent'))),'lLent'],[t('iOwe'),p,'neg','borrowed',t('paidInPer')+' '+fmt(Math.round(paidP('borrowed'))),'lBorrowed'],[t('netShort'),r-p,r-p<0?'neg':'pos','','','lNet'])}
  if(oblTab==='card'){const cs=cards();if(!cs.length)return '';const inf=cs.map(a=>({a,c:cardInfo(a,PE)}));const nd=inf.map(z=>z.c.dueDate).filter(Boolean).sort()[0];
    const paid=cs.reduce((v,a)=>v+S.tx.filter(x=>x.date>=PA&&x.date<=PE&&((x.type==='transfer'&&x.toAcc===a.id)||(x.type==='income'&&x.acc===a.id))).reduce((s2,x)=>s2+toBase(+(x.type==='transfer'?(x.toAmount??x.amount):x.amount)||0,a.currency),0),0);
    return box([t('cardsOwe'),inf.reduce((v,z)=>v+toBase(z.c.owed,z.a.currency),0),'neg','owed',t('paidInPer')+' '+fmt(Math.round(paid)),'cardsOwe'],[t('cardDue'),inf.reduce((v,z)=>v+toBase(z.c.due||0,z.a.currency),0),'','cdue','','cDue'],[t('nextPay')+(nd?' · '+wdOf(dsDate(nd)):''),nd?'‎'+nd.slice(8,10)+'/'+nd.slice(5,7)+'‎':'—'])}
  return '';
}
/* the chip row: status, how it is paid, group */
function oblChips(){
  if(!['inst','gam','loan'].includes(oblTab))return '';
  const all=oblTab==='inst'?S.inst:oblTab==='gam'?S.gam:S.loans;if(!all.length)return '';
  const ch=(id,l)=>`<button type="button" class="balchip ${oblC.has(id)?'on':''}" data-oc="${id}">${esc(l)}</button>`;
  const st=[['st:late',t('overdue')],['st:due',t('dueThisPer')],['st:done',t('done')]].map(([i,l])=>ch(i,l)).join('');
  const pays=oblTab==='loan'?'':[...new Set(all.map(payType))].map(p=>ch('pay:'+p,{cash:t('payCash'),bank:t('payBank'),card:t('payCard')}[p])).join('');
  const gs=[...new Set(all.map(o=>o.group||'').filter(Boolean))].map(g=>ch('grp:'+g,g)).join('');
  return `<div class="qchips" style="margin-top:0;flex-wrap:wrap">${st}${pays?'<span class="muted" style="align-self:center">·</span>'+pays:''}${gs?'<span class="muted" style="align-self:center">·</span>'+gs:''}</div>`;
}
function vObl(){
  if(oblTab==='rec')oblTab='inst';
  let body='';
  if(oblTab==='inst'){
    const PEo=perRange()[1];const LI=oblList('inst');body=LI.length?LI.map(it=>{const n=it.paid.length,nx=instNext(it),pd=oblPaidReal('inst',it,PEo),lf=oblLeftAt('inst',it,PEo),wv=oblWaived('inst',it),p=(it.monthly*it.count-lf)/(it.monthly*it.count);
      const late=instMonths(it).filter(m=>m<TODAY_YM&&!it.paid.includes(m)).length;
      return `<div class="card"><div class="hd tap" data-act="stmtObl" data-k="inst" data-id="${it.id}"><h3>${esc(it.name)} ›</h3>${nx?(late?`<span class="pill neg">${t('overdue')} ${late}</span>`:''):`<span class="pill ok">${t('done')}</span>`}</div>
      <div class="kv"><div><span class="label">${t('monthly')}</span><b>${moneyC(it.monthly,it.currency)}</b></div><div><span class="label">${t('paidLbl')}</span><b>${moneyC(pd,it.currency)}</b></div><div><span class="label">${t('remaining')}</span><b>${moneyC(lf,it.currency)}</b></div></div>${wv>0.004?`<span class="muted">${t('waivedLbl')}: ${moneyC(wv,it.currency)}</span>`:''}
      <div class="bar"><i style="width:${p*100}%"></i></div>
      <div class="hd"><span class="muted"><span class="num">${n} / ${it.count}</span> · ${nx?t('next')+': '+esc(monthLbl(nx)):''}</span></div>
      <div class="acts">${nx?`<button class="btn sm pri" data-act="payInst" data-id="${it.id}">${t('pay')}</button>`:''}<button class="btn sm" data-act="stmtObl" data-k="inst" data-id="${it.id}">${t('statement')}</button><button class="btn sm" data-act="editInst" data-id="${it.id}">${t('edit')}</button></div></div>`}).join(''):`<div class="list"><div class="empty">${t('noItems')}</div></div>`;
  }else if(oblTab==='gam'){
    const PEg=perRange()[1];const LG=oblList('gam');body=LG.length?LG.map(g=>{const n=g.paid.length,nx=gamNext(g),po=gamPayout(g),pd=oblPaidReal('gam',g,PEg),lfg=oblLeftAt('gam',g,PEg);
      return `<div class="card"><div class="hd tap" data-act="stmtObl" data-k="gam" data-id="${g.id}"><h3>${esc(g.name)} ›</h3>${g.received?`<span class="pill ok">${t('received')}</span>`:`<span class="pill">${t('turnOf')}: ${esc(monthLbl(po))}</span>`}</div>
      <div class="kv"><div><span class="label">${t('share')}</span><b>${moneyC(g.share,g.currency)}</b></div><div><span class="label">${t('payout')}</span><b>${moneyC(g.share*g.members,g.currency)}</b></div><div><span class="label">${t('remaining')}</span><b>${moneyC(lfg,g.currency)}</b></div></div>
      <div class="bar"><i style="width:${(g.share*g.members-lfg)/(g.share*g.members)*100}%"></i></div>
      <div class="hd"><span class="muted"><span class="num">${n} / ${g.members}</span>${nx?' · '+t('next')+': '+esc(monthLbl(nx)):''}</span></div>
      <div class="acts">${nx?`<button class="btn sm pri" data-act="payGam" data-id="${g.id}">${t('pay')}</button>`:''}${!g.received?`<button class="btn sm" data-act="recvGam" data-id="${g.id}">${t('collectPay')}</button>`:''}<button class="btn sm" data-act="stmtObl" data-k="gam" data-id="${g.id}">${t('statement')}</button><button class="btn sm" data-act="editGam" data-id="${g.id}">${t('edit')}</button></div></div>`}).join(''):`<div class="list"><div class="empty">${t('noItems')}</div></div>`;
  }else{
    const PEl=perRange()[1];body=`<p class="hint">${t('loansHint')}</p>`+(oblList('loan').length?[...oblList('loan')].sort((a,b)=>(loanLeft(a)===0)-(loanLeft(b)===0)).map(l=>{const left=loanLeftAt(l,PEl),pd=l.pays.filter(p=>p.date<=PEl).reduce((v,p)=>v+(+p.amount||0),0);
      return `<div class="card"><div class="hd tap" data-act="stmtPerson" data-name="${esc(l.person)}"><div><h3>${esc(l.person)} ›</h3><span class="muted">${l.dir==='lent'?t('lent'):t('borrowed')} · ${esc(dayLbl(l.date))}${left&&l.plan==='inst'&&l.instAmt?' · '+fmt(l.instAmt)+' '+t('perMonthFrom')+' '+esc(monthLbl(l.instStart)):l.due&&left?' · '+t('loanDue')+': '+esc(monthLbl(l.due)):''}</span></div>${left===0?`<span class="pill ok">${t('settled')}</span>`:`<span class="pill ${l.dir==='lent'?'ok':'warn'}">${l.dir==='lent'?t('owedToMe'):t('iOwe')}</span>`}</div>
      <div class="kv"><div><span class="label">${t('amount')}</span><b>${moneyC(l.amount,l.currency)}</b></div><div><span class="label">${t('paidLbl')}</span><b>${moneyC(pd,l.currency)}</b></div><div><span class="label">${t('remaining')}</span><b class="${left&&l.dir==='borrowed'?'neg':''}">${moneyC(left,l.currency)}</b></div></div>
      <div class="bar"><i style="width:${Math.min(100,pd/l.amount*100)}%"></i></div>
      ${l.note?`<span class="muted">${esc(l.note)}</span>`:''}
      <div class="acts">${left?`<button class="btn sm pri" data-act="repay" data-id="${l.id}">${t('repay')}</button>`:''}<button class="btn sm" data-act="stmtPerson" data-name="${esc(l.person)}">${t('statement')}</button><button class="btn sm" data-act="editLoan" data-id="${l.id}">${t('edit')}</button></div></div>`}).join(''):`<div class="list"><div class="empty">${t('noItems')}</div></div>`);
  }
  if(oblTab==='goal')body=goalsBody();
  if(oblTab==='card')body=cardsBody();
  if(oblTab==='gam')body=`<button class="btn block" data-act="gamCalc">🧮 ${t('gamCalc')}</button>`+body;
  if(false){
    body=`<p class="hint">${t('recHint')}</p>`+(S.recur.length?`<div class="list">${S.recur.map(r=>{const a=accOf(r.tpl.acc);return `<div class="row tap" data-act="editRec" data-id="${r.id}"><div class="glyph">↻</div>
      <div class="main"><span class="t">${esc(r.tpl.note||(r.tpl.type==='transfer'?t('transfer'):catPath(r.tpl.cat)))}</span><span class="s">${freqName(r.freq)} · ${t('nextOn')}: ${esc(shortDate(r.next))} · ${esc(a?a.name:'')}</span></div>
      <b class="amt ${r.tpl.type==='income'?'pos':''}">${moneyC(r.tpl.amount,a?a.currency:BASE())}</b></div><div class="row sub"><button class="link" data-act="stmtRec" data-id="${r.id}">${t('statement')} ›</button></div>`}).join('')}</div>`:`<div class="list"><div class="empty">${t('noItems')}</div></div>`);
  }
  const addLbl={inst:t('addInst'),gam:t('addGam'),loan:t('addLoan'),rec:t('addRec'),goal:t('addGoal'),card:t('addCard')}[oblTab];
  return `<div class="stickbar">${segHTML('obf',[['inst',t('installments')],['gam',t('gameyas')],['card',t('cardsT')],['loan',t('loans')],['goal',t('goals')]],oblTab)}${oblSum()}
    <div class="search"><div class="qbox"><input class="in-f" id="oq" placeholder="${t('oblSearch')}" value="${esc(oblQ)}" autocomplete="off">${oblQ?`<button class="qx" id="oqx" type="button" aria-label="clear">✕</button>`:''}</div></div>
    ${oblChips()}
    ${oblF.size||oblC.size||oblQ?`<button class="link" id="ofx" style="align-self:flex-start">✕ ${t('clearFilters')}</button>`:''}</div>${body}${['inst','gam','loan','goal'].includes(oblTab)&&oblBase(oblTab).length>1?`<button class="btn block" data-act="oblOrder">↕ ${t('reorder')}</button>`:''}${(()=>{if(!['inst','gam','loan'].includes(oblTab)||oblF.size||oblQ)return '';const n=oblBase(oblTab).filter(o=>oblDone(oblTab,o)).length;return n?`<button class="link" style="align-self:center;margin:4px 0" data-act="showDone" data-id="t${oblTab}">${SHOW_DONE['t'+oblTab]?t('hideDone'):t('showDone').replace('%n',n)}</button>`:''})()}<button class="btn block" data-act="addObl">+ ${addLbl}</button>`;
}
const dayBefore=d=>iso(new Date(dOf(d).getTime()-864e5));
const monthEnd=ym=>{const [y,m]=ym.split('-').map(Number);return ym+'-'+pad(new Date(y,m,0).getDate())};
const balAll=date=>S.accounts.reduce((v,a)=>v+valAt(a,date),0);
function accBalanceAt(a,date){let b=+a.opening||0;for(const x of S.tx){if(x.date>date)continue;
  if(x.type==='transfer'){if(x.acc===a.id)b-=+x.amount||0;if(x.toAcc===a.id)b+=+(x.toAmount??x.amount)||0}else if(x.acc===a.id)b+=x.type==='income'?+x.amount:-x.amount}return b}
/* remaining on an installment/gam'eya as it stood on a date: add back linked payments made after it */
const oblLeftAt=(k,o,date)=>date>=TODAY?oblLeft(k,o):oblLeft(k,o)+S.tx.filter(x=>x.link&&x.link.k===k&&x.link.id===o.id&&x.date>date).reduce((v,x)=>v+(+x.amount||0),0);
const goalSavedAt=(g,date)=>g.acc&&S.accounts.some(a=>a.id===g.acc)?Math.max(0,accBalanceAt(accOf(g.acc),date)):(g.saved||[]).filter(p=>!p.date||p.date<=date).reduce((v,p)=>v+(+p.amount||0),0);
const loanLeftAt=(l,date)=>l.date>date?0:Math.max(0,l.amount+loanAdj(l)-l.pays.filter(p=>p.date<=date).reduce((v,p)=>v+(+p.amount||0),0));
function netWorth(date){
  date=date||TODAY;let assets=0,neg=0;
  S.accounts.forEach(a=>{const v=valAt(a,date);if(v>=0)assets+=v;else neg+=v});
  const recv=S.loans.filter(l=>l.dir==='lent').reduce((v,l)=>v+toBase(loanLeftAt(l,date),l.currency||BASE()),0);
  const pay=S.loans.filter(l=>l.dir==='borrowed').reduce((v,l)=>v+toBase(loanLeftAt(l,date),l.currency||BASE()),0);
  const ym=date.slice(0,7),obl=S.inst.reduce((v,o)=>v+toBase(oblLeftAt('inst',o,date),o.currency||BASE()),0),oblDue=S.inst.reduce((v,o)=>v+toBase(Math.min(owedUpTo('inst',o,ym),oblLeftAt('inst',o,date)),o.currency||BASE()),0);
  let gam=0;S.gam.forEach(o=>{const rx=S.tx.find(x=>x.link&&x.link.k==='gamr'&&x.link.id===o.id),got=rx?rx.date<=date:(o.received&&gamPayout(o)<=ym);gam+=toBase(oblPaidReal('gam',o,date)-(got?o.share*o.members:0),o.currency||BASE())});
  return {assets,neg,recv,pay,obl,oblDue,oblLater:obl-oblDue,gam,net:assets+neg+recv-pay-obl+gam};
}
function netWorthHTML(){
  const PE=perRange()[1],n=netWorth(PE),ms=Array.from({length:12},(_,i)=>ymAdd(TODAY_YM,i-11)).map(m=>{const end=m===TODAY_YM?TODAY:ymAdd(m,1)+'-01';const d=m===TODAY_YM?TODAY:iso(new Date(dOf(end).getTime()-864e5));return{m,v:netWorth(d).net}});
  const top=Math.max(1,...ms.map(o=>Math.abs(o.v))),row=(l,v,c)=>`<div class="row"><div class="main"><span class="t">${l}</span></div><b class="amt ${c||''}">${money(v)}</b></div>`;
  return `<details class="box" id="nw" data-k="nw"><summary><h2>${t('netWorth')} <small class="muted" style="font-size:12px;font-weight:400">${t('asOf')} ${esc(dmyOf(dsDate(PE)))}</small></h2><span class="sumv ${n.net<0?'neg':''}"><span class="why" data-act="why" data-w="nw">${money(n.net)}</span> <small>${esc(curSym(BASE()))}</small></span></summary>
    <div class="slip"><div class="net"><span class="label">${t('netWorth')} ${t('asOf')} ${esc(dmyOf(dsDate(PE)))}</span><span class="big ${n.net<0?'neg':''}"><span class="why" data-act="why" data-w="nw">${money(n.net)}</span><small>${esc(curSym(BASE()))}</small></span></div></div>
    <div class="list">${row(t('nwAssets'),n.assets)}${n.neg?row(t('nwNeg'),n.neg,'neg'):''}${row(t('owedToMe'),n.recv,'pos')}${row(t('iOwe'),-n.pay,n.pay?'neg':'')}${row(t('nwObl'),-n.obl,n.obl?'neg':'')}${n.obl?`<div class="row" style="padding-top:0"><div class="main"><span class="s">${t('nwOblSplit').replace('%d',fmt(Math.round(n.oblDue))).replace('%l',fmt(Math.round(n.oblLater)))}</span></div></div>`:''}${Math.abs(n.gam)>0.5?row(t('nwGam'),n.gam,n.gam<0?'neg':'pos'):''}</div>
    <div class="list"><div class="cols" dir="ltr" style="grid-template-columns:repeat(12,minmax(18px,1fr))">${(lng()==='ar'?[...ms].reverse():ms).map(o=>`<div class="c" title="${esc(monthLbl(o.m))}: ${fmt(o.v)}"><i class="${o.v<0?'b':'a'}" style="width:60%;max-width:20px;height:${Math.abs(o.v)/top*100}%"></i></div>`).join('')}</div>
    <div class="colsx" dir="ltr" style="grid-template-columns:repeat(12,minmax(18px,1fr))">${(lng()==='ar'?[...ms].reverse():ms).map(o=>`<span>${esc(colLbl(o.m,ms.length))}</span>`).join('')}</div>
    <p class="hint" style="padding:0 14px 12px">${t('nwHint')}</p></div></details>`;
}
function zakatCalc(){
  const z=S.zakat=Object.assign({karat:'24',gold:true,recv:true,debt:true},S.zakat||{});
  const price=rateOf('G'+z.karat),nisab=85*price;
  let cash=0,gold=0;S.accounts.forEach(a=>{const v=valAt(a,TODAY);if(v<=0)return;if(a.type==='gold')gold+=v;else cash+=v});
  const recv=S.loans.filter(l=>l.dir==='lent').reduce((v,l)=>v+toBase(loanLeftAt(l,TODAY),l.currency||BASE()),0),debt=S.loans.filter(l=>l.dir==='borrowed').reduce((v,l)=>v+toBase(loanLeftAt(l,TODAY),l.currency||BASE()),0);
  const base=cash+(z.gold?gold:0)+(z.recv?recv:0)-(z.debt?debt:0);return {price,nisab,cash,gold:z.gold?gold:0,recv,debt,recvOn:z.recv,debtOn:z.debt,base,due:price&&base>=nisab};
}
function zakatHTML(){
  const z=S.zakat=Object.assign({karat:'24',gold:true,recv:true,debt:true},S.zakat||{});
  const price=rateOf('G'+z.karat),nisab=85*price;
  let cash=0,gold=0;S.accounts.forEach(a=>{const v=toBase(accBalance(a),a.currency);if(v<=0)return;if(a.type==='gold')gold+=v;else cash+=v});
  const recv=S.loans.filter(l=>l.dir==='lent').reduce((v,l)=>v+toBase(loanLeft(l),l.currency||BASE()),0),debt=S.loans.filter(l=>l.dir==='borrowed').reduce((v,l)=>v+toBase(loanLeft(l),l.currency||BASE()),0);
  const base=cash+(z.gold?gold:0)+(z.recv?recv:0)-(z.debt?debt:0),due=price&&base>=nisab;
  const row=(l,v)=>`<div class="row"><div class="main"><span class="t">${l}</span></div><b class="amt">${money(v)}</b></div>`;
  return `<details class="box" id="zk" data-k="zk"><summary><h2>${t('zakat')} <small class="muted" style="font-size:12px;font-weight:400">${t('asOfToday')}</small></h2><span class="sumv">${price?`<span class="why" data-act="why" data-w="zakat">${money(due?base*0.025:0)}</span>`:'—'} <small>${esc(curSym(BASE()))}</small></span></summary>
    <div class="list">
      <div class="setrow"><span>${t('nisabKarat')}</span><select class="in-f" id="zkK" style="max-width:40%"><option value="21" ${z.karat==='21'?'selected':''}>${t('k21')}</option><option value="24" ${z.karat==='24'?'selected':''}>${t('k24')}</option></select></div>
      <label class="setrow chk" style="justify-content:space-between"><span>${t('zkGold')}</span><input type="checkbox" id="zkG" ${z.gold?'checked':''}></label>
      <label class="setrow chk" style="justify-content:space-between"><span>${t('zkRecv')}</span><input type="checkbox" id="zkR" ${z.recv?'checked':''}></label>
      <label class="setrow chk" style="justify-content:space-between"><span>${t('zkDebt')}</span><input type="checkbox" id="zkD" ${z.debt?'checked':''}></label>
    </div>
    ${price?`<div class="list">${row(t('zkCash'),cash)}${z.gold?row(t('zkGoldVal'),gold):''}${z.recv?row(t('owedToMe'),recv):''}${z.debt?row(t('iOwe'),-debt):''}
      <div class="row"><div class="main"><span class="t"><b>${t('zkBase')}</b></span></div><b class="amt">${money(base)}</b></div>
      <div class="row"><div class="main"><span class="t">${t('nisab')}</span><span class="s">85 ${t('gram')} × ${fmt(price)}</span></div><b class="amt">${money(nisab)}</b></div></div>
      <div class="slip"><div class="net"><span class="label">${due?t('zkDue'):t('zkNotDue')}</span><span class="big">${money(due?base*0.025:0)}<small>${esc(curSym(BASE()))}</small></span></div></div>`
    :`<div class="banner"><span>${t('needGoldPrice')}</span><button class="btn sm pri" data-act="rates">${t('rates')}</button></div>`}
    <p class="hint">${t('zkNote')}</p></details>`;
}
function tagsHTML(){
  const tx=txIn().filter(x=>x.type==='expense'&&x.tags&&x.tags.length);if(!tx.length)return '';
  const by=new Map();tx.forEach(x=>x.tags.forEach(g=>by.set(g,(by.get(g)||0)+baseAmt(x))));const rows=[...by].sort((a,b)=>b[1]-a[1]);
  return `<details class="box" open><summary><h2>${t('byTag')}</h2></summary><div class="list">${rows.map(([g,v])=>`<div class="catbar tile" data-act="stmtTag" data-name="${esc(g)}"><div class="l"><span>#${esc(g)}</span><span>${fmt(v)}</span></div><div class="bar"><i style="width:${v/rows[0][1]*100}%;background:var(--neg)"></i></div></div>`).join('')}</div></details>`;
}

