/* ---------- planned (expected) amounts per month, from everything the app already knows ---------- */
function planItems(m){
  const out=[],add=(type,cat,amount,o)=>{if(amount>0||(o&&o.src))out.push(Object.assign({type,cat,amount,date:m+'-01',acc:'',label:'',done:false},o||{}))};
  for(const r of S.recur||[]){const a=accOf(r.tpl.acc);if(!a||!['income','expense'].includes(r.tpl.type))continue;
    S.tx.filter(x=>x.rec===r.id&&x.date.slice(0,7)===m).forEach(x=>add(x.type,x.cat,baseAmt(x),{date:x.date,acc:x.acc,label:r.tpl.note,done:true}));
    let d=r.next,g=0;while(d&&(d.slice(0,7)<=m||(r.snooze&&r.snooze[d]&&r.snooze[d].slice(0,7)<=m))&&g++<400){if(r.end&&d>r.end)break;const de=(r.snooze&&r.snooze[d])||d;if(de.slice(0,7)===m)add(r.tpl.type,r.tpl.cat,toBase(+r.tpl.amount,a.currency),{date:de,acc:r.tpl.acc,label:r.tpl.note||catName(r.tpl.cat),src:'rec:'+r.id});d=advance(d,r.freq,r.day)}}
  S.inst.forEach(o=>instMonths(o).filter(x=>effM(o,x)===m).forEach(x=>add('expense',o.cat||'inst',toBase(+o.monthly-partOf(o,x)*(x!==m?1:0),o.currency||BASE()),{date:m+'-'+pad(Math.min(28,o.dueDay||1)),acc:o.payWith||'',label:o.name,done:o.paid.includes(x),src:'inst:'+o.id,ox:x,part:x===m?partOf(o,x):0})));
  S.gam.forEach(o=>{gamMonths(o).filter(x=>effM(o,x)===m).forEach(x=>add('expense','gam',toBase(+o.share,o.currency||BASE()),{date:m+'-'+pad(Math.min(28,o.dueDay||1)),label:o.name,done:o.paid.includes(x),src:'gam:'+o.id,ox:x,part:partOf(o,x)}));if(gamPayout(o)===m)add('income','gamin',toBase(o.share*o.members,o.currency||BASE()),{label:o.name,done:!!o.received,src:'gamr:'+o.id})});
  S.loans.forEach(l=>{const x=loanSched(l).find(z=>z.m===m);if(x)add(l.dir==='borrowed'?'expense':'income',l.dir==='borrowed'?'loanpay':'loanback',toBase(x.amount,l.currency||BASE()),{label:l.person,done:loanOwedUpTo(l,m)===0,src:'loan:'+l.id,owed:Math.max(0,loanOwedUpTo(l,m)-loanOwedUpTo(l,ymAdd(m,-1)))})});
  const has=new Set(out.filter(x=>x.type==='expense').map(x=>x.cat));
  Object.entries(S.budgets||{}).forEach(([c,v])=>{if(!has.has(c))add('expense',c,+v,{label:catName(c),src:'bud:'+c})});
  const ov=(S.planOver||{})[m]||{};out.forEach(x=>{if(x.src&&!x.done&&x.src in ov){x.base=x.amount;x.amount=+ov[x.src]}});
  (S.planAdj||[]).filter(a=>a.m===m).forEach(a=>add(a.type||'expense',a.cat,+a.amount,{label:a.label||catName(a.cat),acc:a.acc||'',date:a.acc?m+'-'+pad(Math.max(+TODAY.slice(8,10),1)).slice(-2):m+'-01'}));
  return out.filter(x=>x.amount>0||(x.src&&x.src in ov));
}
/* unpaid installments, gam'eya months and loan payments from earlier months: still due, counted from today */
function lateItems(m){
  if(m!==TODAY_YM)return [];const out=[];
  S.inst.forEach(o=>instMonths(o).filter(x=>effM(o,x)<m&&!o.paid.includes(x)).forEach(x=>{const v=+o.monthly-partOf(o,x);if(v>0.004)out.push({type:'expense',cat:o.cat||'inst',amount:toBase(v,o.currency||BASE()),date:TODAY,acc:o.payWith||'',label:o.name+' · '+t('lateFrom')+' '+monthLbl(effM(o,x)),done:false,src:'inst:'+o.id,late:1,part:0})}));
  S.gam.forEach(o=>{gamMonths(o).filter(x=>effM(o,x)<m&&!o.paid.includes(x)).forEach(x=>{const v=+o.share-partOf(o,x);if(v>0.004)out.push({type:'expense',cat:'gam',amount:toBase(v,o.currency||BASE()),date:TODAY,acc:'',label:o.name+' · '+t('lateFrom')+' '+monthLbl(x),done:false,src:'gam:'+o.id,late:1,part:0})});
    if(!o.received&&gamPayout(o)<m)out.push({type:'income',cat:'gamin',amount:toBase(o.share*o.members,o.currency||BASE()),date:TODAY,acc:'',label:o.name+' · '+t('lateFrom')+' '+monthLbl(gamPayout(o)),done:false,src:'gamr:'+o.id,late:1,part:0})});
  S.loans.forEach(l=>{const v=loanOwedUpTo(l,ymAdd(m,-1));if(v>0.004)out.push({type:l.dir==='borrowed'?'expense':'income',cat:l.dir==='borrowed'?'loanpay':'loanback',amount:toBase(v,l.currency||BASE()),date:TODAY,acc:'',label:l.person+' · '+t('lateWord'),done:false,src:'loan:'+l.id,late:1,owed:v})});
  return out;
}
const byRoot=(list,type,amt)=>{const o={};list.filter(x=>x.type===type).forEach(x=>{const k=catRoot(x.cat);o[k]=(o[k]||0)+amt(x)});return o};
function planVsActual(months){
  const P={income:{},expense:{},fin:{}},A={income:{},expense:{},fin:{}},L={};
  months.forEach(m=>{const cp=cashPlan(m),ca=cashActual(txOf(m));
    [[cp,P],[ca,A]].forEach(([src,dst])=>Object.entries(src).forEach(([k,x])=>{if(k.startsWith('x'))return;const ty=k.startsWith('fi:')||k.startsWith('fo:')?'fin':k.startsWith('in:')?'income':'expense',id=k.slice(k.indexOf(':')+1);const id2=ty==='fin'?k:id;dst[ty][id2]=(dst[ty][id2]||0)+x.v;L[id2]=x.label}))});
  return {P,A,L};
}
const isLiquid=a=>!!a&&['cash','bank','wallet'].includes(a.type);
const liqAll=date=>S.accounts.filter(isLiquid).reduce((v,a)=>v+valAt(a,date),0);
function cardDueFor(a,date){const [y,m,d]=date.split('-').map(Number);
  if(!a.closeDay)return dateIn(y,m+1,+(a.dueDay||5));
  const cd=+a.closeDay,dd=+(a.dueDay||cd),close=d<=cd?dateIn(y,m,cd):dateIn(y,m+1,cd),[cy,cm]=close.split('-').map(Number);return dateIn(cy,dd>cd?cm:cm+1,dd)}
/* actual money in and out of cash, bank and wallets, keyed by category (or by card for card payments) */
function cashActual(list){const r={};const put=(k,l,v)=>{if(!r[k])r[k]={label:l,v:0};r[k].v+=v};
  for(const x of list){const a=accOf(x.acc);if(!a)continue;const v=baseAmt(x);
    if(x.type==='transfer'){const b=accOf(x.toAcc);if(!b)continue;const la=isLiquid(a),lb=isLiquid(b);
      if(la&&!lb)put(b.type==='card'?'out:card:'+b.id:'xout:'+b.id,b.type==='card'?t('cardPayNote')+' · '+b.name:t('xferTo')+' '+b.name,v);
      else if(!la&&lb)put('xin:'+a.id,t('xferFrom')+' '+a.name,xferBase(x))}
    else if(isLiquid(a)){const rc=catRoot(x.cat),k=(FIN_CATS.has(rc)?(x.type==='income'?'fi:':'fo:'):(x.type==='income'?'in:':'out:'))+rc;put(k,catName(rc),v)}}
  return r}
function cashPlan(m){const r={};const put=(k,l,v)=>{if(v<=0.004)return;if(!r[k])r[k]={label:l,v:0};r[k].v+=v};
  for(let i=-3;i<=0;i++){const pm=ymAdd(m,i);for(const it of (i===0?planItems(pm).concat(lateItems(pm)):planItems(pm))){const a=accById(it.acc);
    if(a&&a.type==='card'){if(it.type==='expense'&&!it.done&&(it.date>=TODAY||pm===TODAY_YM)){const due=cardDueFor(a,it.date<TODAY?TODAY:it.date);if(due.slice(0,7)===m)put('out:card:'+a.id,t('cardPayNote')+' · '+a.name,it.amount)}}
    else if(i===0){const rc=catRoot(it.cat);put((FIN_CATS.has(rc)?(it.type==='income'?'fi:':'fo:'):(it.type==='income'?'in:':'out:'))+rc,catName(rc),it.amount)}}}
  cards().forEach(a=>{const c=cardInfo(a);if(!c.owed)return;
    const parts=a.closeDay?[[c.due,c.dueDate],[c.cycle,cardDueFor(a,c.nextClose)]]:[[c.owed,cardDueFor(a,TODAY)]];
    parts.forEach(([v,d])=>{if(v>0&&d){const dm=d.slice(0,7)<TODAY_YM?TODAY_YM:d.slice(0,7);if(dm===m)put('out:card:'+a.id,t('cardPayNote')+' · '+a.name,toBase(v,a.currency))}})});
  if(m<=TODAY_YM){const ac=cashActual(txOf(m));Object.entries(ac).filter(([k])=>k.startsWith('out:card:')).forEach(([k,x])=>put(k,x.label,x.v))}
  const ov=(S.planOver||{})[m]||{};cards().forEach(a=>{const k='out:card:'+a.id,src='card:'+a.id;if(src in ov){if(!r[k])r[k]={label:t('cardPayNote')+' · '+a.name,v:0};r[k].base=r[k].v;r[k].v=+ov[src]}});
  return r}
/* past months = actual; this month = the larger of actual and plan per line (card payments add up); later months = plan */
function monthCash(m){
  const act=cashActual(txOf(m));const sum=(o,p)=>Object.entries(o).filter(([k])=>k.startsWith(p)).reduce((v,[,x])=>v+x.v,0);
  const xn=o=>sum(o,'xin:')-sum(o,'xout:'),fn=o=>sum(o,'fi:')-sum(o,'fo:');
  const gr=o=>({fi:sum(o,'fi:'),fo:sum(o,'fo:'),xi:sum(o,'xin:'),xo:sum(o,'xout:')}),gre=rem=>{const z={fi:0,fo:0,xi:0,xo:0};rem.forEach(e=>{if(e.kind==='xfer')z[e.dir==='in'?'xi':'xo']+=e.amt;else if(e.fin)z[e.dir==='in'?'fi':'fo']+=e.amt});return z};
  if(m<TODAY_YM)return Object.assign({i:sum(act,'in:'),e:sum(act,'out:'),x:xn(act),f:fn(act),kind:'act',lines:act},gr(act));
  const pl=cashPlan(m);
  /* later months: the plan less what was already paid ahead, plus entries already recorded with a date in that month (moves between your accounts kept apart) */
  if(m>TODAY_YM){const rem=remainingPlan(m),rs=d=>rem.filter(e=>e.dir===d&&e.kind!=='xfer'&&!e.fin).reduce((v,e)=>v+e.amt,0),net=f=>rem.filter(f).reduce((v,e)=>v+(e.dir==='in'?e.amt:-e.amt),0);return Object.assign({i:rs('in'),e:rs('out'),x:net(e=>e.kind==='xfer'),f:net(e=>e.fin),kind:'plan',lines:pl},gre(rem))}
  /* this month: the row shows the plan as it is; the balance also takes into account where actual already went past the plan */
  const lines={},dev=[];new Set([...Object.keys(pl),...Object.keys(act)].filter(k=>!k.startsWith('x')&&!k.startsWith('f'))).forEach(k=>{const p=pl[k]?pl[k].v:0,a=act[k]?act[k].v:0;lines[k]={label:(pl[k]||act[k]).label,v:Math.max(p,a),a,p};if(a-p>0.5)dev.push({k,label:lines[k].label,v:a-p})});
  const sp=pfx=>Object.entries(lines).filter(([k])=>k.startsWith(pfx)).reduce((v,[,x])=>v+x.p,0);
  /* projected for the whole month = what already happened up to today + what is still to come (same calculation as "will the money last?") */
  const past=cashActual(txOf(m).filter(x=>x.date<=TODAY)),rem=remainingPlan(m),rs=d=>rem.filter(e=>e.dir===d&&e.kind!=='xfer'&&!e.fin).reduce((v,e)=>v+e.amt,0),rx=rem.filter(e=>e.kind==='xfer').reduce((v,e)=>v+(e.dir==='in'?e.amt:-e.amt),0),rf=rem.filter(e=>e.fin).reduce((v,e)=>v+(e.dir==='in'?e.amt:-e.amt),0);
  const g1=gr(past),g2=gre(rem);
  return {i:sp('in:'),e:sp('out:'),iMax:sum(past,'in:')+rs('in'),eMax:sum(past,'out:')+rs('out'),x:xn(past)+rx,f:fn(past)+rf,kind:'cur',lines,dev,fi:g1.fi+g2.fi,fo:g1.fo+g2.fo,xi:g1.xi+g2.xi,xo:g1.xo+g2.xo};
}
function fcMonthSheet(m){
  const r=monthCash(m),row=(l,v,c)=>`<div class="row"><div class="main"><span class="t">${esc(l)}</span></div><b class="amt ${c||''}">${money(v)}</b></div>`;
  const part=p=>Object.entries(r.lines).filter(([k])=>k.startsWith(p)).sort((a,b)=>b[1].v-a[1].v).map(([k,x])=>row(x.label+(r.kind==='cur'&&x.a?' ('+t('actual')+' '+fmt(x.a)+')':''),x.v,p==='in:'?'pos':'')).join('')||`<div class="empty">${t('noItems')}</div>`;
  const P=cashPlan(m),A=cashActual(txOf(m));
  const cmpSec=p=>{const keys=[...new Set([...Object.keys(P),...Object.keys(A)])].filter(k=>k.startsWith(p)).sort((a,b)=>Math.max((P[b]||{}).v||0,(A[b]||{}).v||0)-Math.max((P[a]||{}).v||0,(A[a]||{}).v||0));
    let tp=0,ta=0;const rows=keys.map(k=>{const pv=(P[k]||{}).v||0,av=(A[k]||{}).v||0;tp+=pv;ta+=av;const d=p==='in:'?av-pv:pv-av;
      return `<div class="cmp"><span>${esc((P[k]||A[k]).label)}</span><span>${money(pv)}</span><span>${money(av)}</span><b class="${d<-0.5?'neg':d>0.5?'pos':''}">${d>0.5?'+':''}${money(d)}</b></div>`}).join('');
    const d=p==='in:'?ta-tp:tp-ta;
    return {html:`<div class="grp"><span>${p==='in:'?t('cashIn'):t('cashOut')}</span></div>${rows||`<div class="empty">${t('noItems')}</div>`}<div class="cmp t"><span>${t('total')}</span><span>${money(tp)}</span><span>${money(ta)}</span><b class="${d<-0.5?'neg':d>0.5?'pos':''}">${d>0.5?'+':''}${money(d)}</b></div>`,tp,ta}};
  const CI=cmpSec('in:'),CO=cmpSec('out:'),np=CI.tp-CO.tp,na=CI.ta-CO.ta;
  const sumP=(o,p)=>Object.entries(o).filter(([k])=>k.startsWith(p)).reduce((v,[,x])=>v+x.v,0);
  const ai=sumP(A,'in:'),ao=sumP(A,'out:'),pi=sumP(P,'in:'),po=sumP(P,'out:');
  const three=(i,o,cls)=>`<div class="flowb"><div><span>${t('cashIn')}</span><b class="${cls?'':'pos'}">${money(i)}</b></div><div><span>${t('cashOut')}</span><b>${money(o)}</b></div><div><span>${t('netShort')}</span><b class="${i-o<0?'neg':'pos'}">${money(i-o)}</b></div></div>`;
  const fI=o=>sumP(o,'fi:')+sumP(o,'xin:'),fO=o=>sumP(o,'fo:')+sumP(o,'xout:'),frow=o=>fI(o)+fO(o)>0.5?`<div class="ln" style="padding:0 12px 6px;font-size:12px"><span>${t('ofWhich')} 🤝 ${t('finTitle')} / ⇄ ${t('xferShort')}</span><b>${fI(o)>0.5?'+'+money(fI(o)):''}${fI(o)>0.5&&fO(o)>0.5?' · ':''}${fO(o)>0.5?'−'+money(fO(o)):''}</b></div>`:'';
  const ax=sumP(A,'xin:')-sumP(A,'xout:'),xrow=Math.abs(ax)>0.5?`<div class="ln" style="padding:0 12px 6px"><span>⇄ ${t('xferNet')}</span><b>${ax>0?'+':'−'}${money(Math.abs(ax))}</b></div>`:'';
  const lines=o=>{const L=Object.entries(o).filter(([k])=>!k.startsWith('x')&&!k.startsWith('f')).sort((a,b)=>b[1].v-a[1].v);return L.length?`<details><summary>${t('showLines')} ›</summary>${L.map(([k,x])=>`<div class="ln"><span>${k.startsWith('in:')?'+':'−'} ${esc(x.label)}</span><b class="${k.startsWith('in:')?'pos':''}">${money(x.v)}</b></div>`).join('')}</details>`:''};
  const sg=(v,goodUp)=>{const c=Math.abs(v)<0.5?'':(v>0)===goodUp?'pos':'neg';return `<b class="${c}">${v>0.5?'+':''}${money(v)}</b>`};
  openSheet(monthLbl(m),`<div class="form">
    <div class="blk act"><div class="blk-h"><span>● ${t('actual')}</span><small class="muted">${m>TODAY_YM?t('notYet'):t('cashBanks')}</small></div>${three(ai+fI(A),ao+fO(A))}${frow(A)}${lines(A)}</div>
    <div class="blk plan"><div class="blk-h"><span>● ${t('planned')}</span><small class="muted">${t('cashBanks')}</small></div>${three(pi+fI(P),po+fO(P))}${frow(P)}${lines(P)}</div>
    ${m>=TODAY_YM?(()=>{const sr=fcSeries(m),me=sr[sr.length-1],nowBal=liqAll(TODAY),curRem=remainingPlan(TODAY_YM).reduce((v,e)=>v+(e.dir==='in'?e.amt:-e.amt),0);
      const steps=[`<div class="ln"><span>${t('nowHave')} (${esc(shortDate(TODAY))})</span><b>${money(nowBal)}</b></div>`];let run=nowBal;
      const lines=mm=>monthLines(mm).map(e=>`<div class="ln" style="padding-inline-start:14px;font-size:12px"><span>${e.dir==='in'?'+':'−'} ${esc(e.label)}</span><b class="${e.dir==='in'?'pos':''}">${money(e.amt)}</b></div>`).join('');
      const step=(lbl,n,mm)=>`<details class="ln" style="display:block"><summary style="display:flex;justify-content:space-between;gap:8px;color:inherit;font-size:13px"><span>${n<0?'−':'+'} ${lbl} ›</span><b class="${n<0?'neg':'pos'}">${money(Math.abs(n))}</b></summary>${lines(mm)}</details>`;
      if(m>TODAY_YM){run+=curRem;steps.push(step(t('restOf')+' '+esc(monthLbl(TODAY_YM)),curRem,TODAY_YM));
        sr.slice(1,-1).forEach(x=>{const n=x.i-x.e+(x.x||0)+(x.f||0);run+=n;steps.push(step(t('gapW')+' '+esc(monthLbl(x.m)),n,x.m))})}
      steps.push(`<div class="ln"><span><b>= ${m>TODAY_YM?t('availStart')+' '+esc(monthLbl(m)):t('nowHave')}</b></span><b>${money(m>TODAY_YM?me.open:nowBal)}</b></div>`);
      const net=me.bal-me.open;
      return `<div class="blk plan"><div class="blk-h"><span>● ${t('availEnd')}</span></div>
        <div class="flowb"><div><span>${t('carried')}</span><b class="${me.open<0?'neg':''}">${money(me.open)}</b></div><div><span>${net<0?'−':'+'} ${t('gapW')}</span><b class="${net<0?'neg':'pos'}">${money(Math.abs(net))}</b></div><div><span>= ${t('availEnd')}</span><b class="${me.bal<0?'neg':''}">${money(me.bal)}</b></div></div>
        <details><summary>${t('whereFrom')} ›</summary>${steps.join('')}</details></div>`})():''}
    <div class="blk"><div class="blk-h"><span>${t('diffActPlan')}</span></div><div class="flowb"><div><span>${t('cashIn')}</span>${sg(ai-pi,true)}</div><div><span>${t('cashOut')}</span>${sg(ao-po,false)}</div><div><span>${t('netShort')}</span>${sg((ai-ao)-(pi-po),true)}</div></div></div>
    <div class="blk plan" style="padding-bottom:8px"><div class="blk-h"><span>✎ ${t('editPlan')}</span></div>
    ${(()=>{const adj=(S.planAdj||[]).map((a,i)=>({a,i})).filter(z=>z.a.m===m);const tin=adj.filter(z=>z.a.type==='income').reduce((v,z)=>v+(+z.a.amount),0),tout=adj.filter(z=>z.a.type!=='income').reduce((v,z)=>v+(+z.a.amount),0);return adj.length?`<div class="grp"><span>${t('extraPlan')}</span></div><div class="flowb" style="border-top:0;padding:6px 12px"><div><span>${t('cashIn')}</span><b class="pos">${money(tin)}</b></div><div><span>${t('cashOut')}</span><b>${money(tout)}</b></div><div><span>${t('netShort')}</span><b class="${tin-tout<0?'neg':'pos'}">${money(tin-tout)}</b></div></div><div class="list">${adj.map(({a,i})=>`<div class="row tap" data-adje="${i}"><div class="main"><span class="t">${esc(a.label||catName(a.cat))} ›</span><span class="s">${a.type==='income'?t('inc1'):t('exp1')}</span></div><b class="amt ${a.type==='income'?'pos':''}">${money(a.amount)}</b><button type="button" class="btn sm danger" data-adj="${i}">${t('del')}</button></div>`).join('')}</div>`:''})()}
    ${(()=>{const cp=cashPlan(m),it=planItems(m).filter(x=>x.src&&!x.done).map(x=>{const a=accById(x.acc);return a&&a.type==='card'?Object.assign(x,{onCard:a,payD:cardDueFor(a,x.date<TODAY?TODAY:x.date),payM:cardDueFor(a,x.date<TODAY?TODAY:x.date).slice(0,7)}):x}).concat(cards().filter(a=>cp['out:card:'+a.id]).map(a=>{const z=cp['out:card:'+a.id];return {type:'expense',cat:'other',amount:z.v,base:z.base,label:z.label,src:'card:'+a.id,card:1}}));const tin=it.filter(x=>x.type==='income').reduce((v,x)=>v+x.amount,0),tout=it.filter(x=>x.type!=='income'&&!x.onCard).reduce((v,x)=>v+x.amount,0);return it.length?`<div class="grp"><span>${t('planLines')}</span></div><div class="flowb" style="border-top:0;padding:6px 12px"><div><span>${t('cashIn')}</span><b class="pos">${money(tin)}</b></div><div><span>${t('cashOut')}</span><b>${money(tout)}</b></div><div><span>${t('netShort')}</span><b class="${tin-tout<0?'neg':'pos'}">${money(tin-tout)}</b></div></div><div class="list">${it.map(x=>`<div class="row tap" data-pe="${esc(x.src)}" data-pl="${esc(x.label)}" data-pv="${x.amount}" data-pb="${x.base??x.amount}"><div class="main"><span class="t">${esc(x.label)}${x.base!=null?' ✎':''} ›</span><span class="s">${x.card?t('cardPayLine'):x.onCard?'💳 '+esc(x.onCard.name)+' · '+t('paidIn')+' '+esc(shortDate(x.payD))+(x.onCard.closeDay?'':' ⚠️'):(x.type==='income'?t('inc1'):t('exp1'))+' · '+esc(catName(catRoot(x.cat)))}${x.base!=null?' · '+t('usually')+' '+fmt(x.base):''}</span></div><b class="amt ${x.type==='income'?'pos':''}">${money(x.amount)}</b></div>`).join('')}</div><p class="hint">${t('planLinesHint')}</p>`:''})()}
    <div style="padding:0 10px"><button type="button" class="btn block" id="adjAdd">+ ${t('addPlan')}</button></div></div>
    <p class="hint">${t('fcMonthHint')}</p></div>`,rr=>{
    rr.querySelectorAll('[data-adj]').forEach(b=>b.onclick=e=>{e.stopPropagation();S.planAdj.splice(+b.dataset.adj,1);commit(t('deleted'));fcMonthSheet(m)});
    rr.querySelectorAll('[data-adje]').forEach(el=>el.onclick=()=>planAdjForm(m,+el.dataset.adje));
    rr.querySelector('#adjAdd').onclick=()=>planAdjForm(m);
    rr.querySelectorAll('[data-pe]').forEach(el=>el.onclick=()=>planEditForm(m,el.dataset.pe,el.dataset.pl,+el.dataset.pv,+el.dataset.pb));
  });
}
function planEditForm(m,src,label,amount,base){
  const [kind,id]=src.split(/:(.+)/),canOn=kind==='rec'||kind==='bud',has=src in ((S.planOver||{})[m]||{});
  openSheet(label+' · '+monthLbl(m),`<form class="form" id="f"><p class="hint">${t('usually')}: ${fmt(base)}</p>
    <label class="fld"><span>${t('amount')} (${t('zeroSkip')})</span><input class="in-f amt num" id="ev" inputmode="decimal" value="${amount}"></label>
    ${canOn?`<label class="fld"><span>${t('applyTo')}</span><select class="in-f" id="es"><option value="one">${t('thisMonthOnly')}</option><option value="on">${t('fromThisOn')}</option></select></label>`:''}
    <div class="foot">${has?`<button type="button" class="btn grow" id="eReset">${t('resetPlan')}</button>`:''}<button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    const back=()=>{commit(t('saved'));fcMonthSheet(m)};
    const rs=r.querySelector('#eReset');if(rs)rs.onclick=()=>{delete S.planOver[m][src];back()};
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const raw=val(r,'ev'),v=raw===''?0:numv(r,'ev');if(v<0){toast(t('needAmt'));return}
      const scope=canOn?val(r,'es'):'one';
      if(scope==='on'&&kind==='rec'){const rc=S.recur.find(x=>x.id===id);if(rc){
          if(rc.next.slice(0,7)>=m){rc.tpl.amount=v}
          else{let d=rc.next;while(d.slice(0,7)<m)d=advance(d,rc.freq,rc.day);const nr=JSON.parse(JSON.stringify(rc));nr.id='r'+uid();nr.next=d;nr.tpl.amount=v;rc.end=dayBefore(d);S.recur.push(nr)}
          Object.keys(S.planOver).forEach(k=>{if(k>=m)delete S.planOver[k][src]});if(v===0){const z=S.recur.find(x=>x.id===id);if(z&&z.next.slice(0,7)>=m)z.end=dayBefore(z.next)}}}
      else if(scope==='on'&&kind==='bud'){for(let i=0;i<36;i++){const k=ymAdd(m,i);(S.planOver[k]=S.planOver[k]||{})[src]=v}}
      else{(S.planOver[m]=S.planOver[m]||{})[src]=v}
      back()};
  });
}
function planAdjForm(m,idx){
  const ed=idx!=null?S.planAdj[idx]:null;let ty=ed?(ed.type||'expense'):'expense';
  openSheet((ed?t('edit'):t('addPlan'))+' · '+monthLbl(m),`<form class="form" id="f">${segHTML('pa',[['expense',t('exp1')],['income',t('inc1')]],ty)}
    <label class="fld"><span>${t('category')}</span><select class="in-f" id="pc">${catOptsTree(ty,ed?ed.cat:'',false)}</select></label>
    <label class="fld"><span>${t('amount')}</span><input class="in-f amt num" id="pv" inputmode="decimal" placeholder="0" value="${ed?ed.amount:''}"></label>
    <label class="fld"><span>${t('note')}</span><input class="in-f" id="pn" value="${ed?esc(ed.label&&ed.label!==catName(ed.cat)?ed.label:''):''}"></label>
    <label class="fld"><span>${t('payWith')}</span><select class="in-f" id="pa2"><option value="">${t('cashOrBank')}</option>${cards().map(a=>`<option value="${a.id}" ${ed&&ed.acc===a.id?'selected':''}>💳 ${esc(a.name)}</option>`).join('')}</select></label>
    <label class="fld" ${ed?'hidden':''}><span>${t('repeatFor')}</span><select class="in-f" id="pr">${[1,2,3,6,12].map(n=>`<option value="${n}">${n===1?t('thisMonthOnly'):n+' '+t('monthsW')}</option>`).join('')}</select></label>
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    bindSeg(r,'pa',v=>{ty=v;r.querySelector('#pc').innerHTML=catOptsTree(v,'',false)});
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const v=numv(r,'pv');if(!(v>0)){toast(t('needAmt'));return}
      const n=+val(r,'pr')||1,cat=val(r,'pc'),note=val(r,'pn');
      const acc=ty==='expense'?val(r,'pa2'):'';
      if(ed)Object.assign(ed,{type:ty,cat,amount:v,acc,label:note||catName(cat)});else for(let i=0;i<n;i++)S.planAdj.push({m:ymAdd(m,i),type:ty,cat,amount:v,acc,label:note||catName(cat)});
      commit(t('saved'));fcMonthSheet(m)};
  });
}

