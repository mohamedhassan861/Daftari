/* ---------- will the money last? day by day from today to the end of next month ---------- */
/* what is still to come in month m: each plan line minus what already happened on it, card bills, and entries dated later this month */
function remainingPlan(m){
  const out=[],push=(date,amt,label,dir,kind,fin)=>{if(amt>0.5)out.push({date:date<TODAY?TODAY:date,amt:Math.round(amt),label,dir,kind,fin:!!fin})};
  const tx=txOf(m),mStart=m+'-01',mEnd=monthEnd(m);
  /* actual entries on cash & banks use up the plan line by line: same category first, then a plan made on a whole group */
  const leaf={};tx.forEach(x=>{const a=accById(x.acc);if(!isLiquid(a)||!['income','expense'].includes(x.type)||(x.link&&['inst','gam','loan','gamr'].includes(x.link.k)))return;const k=x.type+'|'+x.cat;leaf[k]=(leaf[k]||0)+baseAmt(x)});
  const isObl=it=>it.src&&/^(inst|gam|gamr|loan):/.test(it.src);
  const items=planItems(m).concat(lateItems(m)).filter(it=>{const a=accById(it.acc);return !(a&&a.type==='card')}).sort((a,b)=>(a.src&&a.src.startsWith('bud:'))-(b.src&&b.src.startsWith('bud:'))||(a.date||'').localeCompare(b.date||''));
  items.forEach(it=>{if(isObl(it)){it.rem=it.done?0:it.src.startsWith('loan:')?Math.min(it.amount,it.owed??it.amount):it.amount-(it.part||0);return}const k=it.type+'|'+it.cat,u=Math.min(it.amount,leaf[k]||0);leaf[k]=(leaf[k]||0)-u;it.rem=it.amount-u});
  items.forEach(it=>{if(it.rem<=0.5||isObl(it))return;const r=catRoot(it.cat);for(const k of Object.keys(leaf)){const [ty,c]=k.split('|');if(ty!==it.type||catRoot(c)!==r||leaf[k]<=0||(it.cat!==r&&c!==r))continue;const u=Math.min(it.rem,leaf[k]);leaf[k]-=u;it.rem-=u;if(it.rem<=0.5)break}});
  /* spending put on a credit card also uses up the month's limit for its category: the money leaves later, as the card payment, so it is not counted twice */
  const leafC={};tx.forEach(x=>{const ac=accById(x.acc);if(!ac||ac.type!=='card'||x.type!=='expense'||(x.link&&['inst','gam','loan','gamr'].includes(x.link.k)))return;const k='expense|'+x.cat;leafC[k]=(leafC[k]||0)+baseAmt(x)});
  items.forEach(it=>{if(it.rem<=0.5||!(it.src&&it.src.startsWith('bud:')))return;const r=catRoot(it.cat);
    for(const k of Object.keys(leafC)){const c=k.split('|')[1];if(leafC[k]<=0||!(c===it.cat||(catRoot(c)===r&&(it.cat===r||c===r))))continue;const u=Math.min(it.rem,leafC[k]);leafC[k]-=u;it.rem-=u;if(it.rem<=0.5)break}});
  for(const it of items){if(it.rem<=0.5||it.done)continue;
    const label=it.label||catName(it.cat),dir=it.type==='income'?'in':'out',kind=it.src?it.src.split(':')[0]:'adj';
    if(kind==='bud'){
      /* what is left of a monthly budget is set aside from the start of the month (or today): one line per category */
      push(mStart<TODAY?TODAY:mStart,it.rem,t('budLeft')+' '+label+' · '+monthLbl(m),'out','bud');continue}
    push(it.date&&it.date.slice(0,7)===m?it.date:mStart,it.rem,label,dir,kind,FIN_CATS.has(catRoot(it.cat)))}
  /* entries already recorded with a later date this month */
  tx.filter(x=>x.date>TODAY).forEach(x=>{const a=accById(x.acc),label=x.note||catName(x.cat);
    if(x.type==='transfer'){const b=accById(x.toAcc),la=isLiquid(a),lb=isLiquid(b);if(la&&!lb)push(x.date,baseAmt(x),label,'out',b&&b.type==='card'?'tx':'xfer');else if(!la&&lb)push(x.date,toBase(+(x.toAmount??x.amount),b.currency),label,'in','xfer')}
    else if(isLiquid(a))push(x.date,baseAmt(x),label,x.type==='income'?'in':'out','tx',FIN_CATS.has(catRoot(x.cat)))});
  const cp=cashPlan(m),ca=cashActual(tx);
  cards().forEach(a=>{const k='out:card:'+a.id,p=(cp[k]||{}).v||0,done=(ca[k]||{}).v||0,rem=p-done;if(rem<=0.5)return;
    const c=cardInfo(a),d=c.dueDate&&c.dueDate.slice(0,7)===m?c.dueDate:dateIn(+m.slice(0,4),+m.slice(5,7),+(a.dueDay||a.closeDay||28));push(d,toBase(rem,a.currency),t('cardPayNote')+' · '+a.name,'out','card')});
  return out;
}
/* will the money last? day by day from today to the end of next month */
function cashTimeline(toYm,exact){
  const last=exact&&toYm?(toYm>ymAdd(TODAY_YM,12)?ymAdd(TODAY_YM,12):toYm<TODAY_YM?TODAY_YM:toYm):toYm&&toYm>ymAdd(TODAY_YM,1)?(toYm>ymAdd(TODAY_YM,12)?ymAdd(TODAY_YM,12):toYm):ymAdd(TODAY_YM,1),months=[];for(let m=TODAY_YM;m<=last;m=ymAdd(m,1))months.push(m);
  const ev=months.flatMap(m=>remainingPlan(m));
  ev.sort((a,b)=>a.date.localeCompare(b.date)||(a.dir==='in'?-1:1));
  let bal=Math.round(liqAll(TODAY));const start=bal;let low=null,first=null;
  ev.forEach(e=>{bal+=e.dir==='in'?e.amt:-e.amt;e.bal=bal;if(bal<-0.5&&!first&&e.dir==='out')first=e;if(!low||bal<low.bal)low=e});
  const mEnd={};let b2=start;months.forEach(m=>{ev.filter(e=>e.date.slice(0,7)===m).forEach(e=>b2+=e.dir==='in'?e.amt:-e.amt);mEnd[m]=b2});
  return {start,ev,first,low,end:bal,months,mEnd,last};
}
const shortDays=()=>Math.max(1,+((S&&S.shortDays)||7));
function shortAlert(){if(!S||ACT!=='me')return null;const tl=cashTimeline();if(!tl.first)return null;
  const days=Math.round((dOf(tl.first.date)-dOf(TODAY))/864e5);return days<=shortDays()?Object.assign({days,need:-tl.low.bal},tl.first):null}
function cashSheet(){
  const PE=perRange()[1],selYm=PE.slice(0,7)>TODAY_YM?PE.slice(0,7):TODAY_YM;
  const tl=cashTimeline(selYm,true);let shown=false;const totOut=tl.ev.filter(e=>e.dir==='out').reduce((v,e)=>v+e.amt,0),lowMatters=tl.low&&tl.low.bal<tl.mEnd[selYm]-0.5;
  const grouped=[];tl.ev.forEach(e=>{const g=grouped[grouped.length-1];if(g&&g.date===e.date&&g.label===e.label&&g.dir===e.dir){g.amt+=e.amt;g.bal=e.bal}else grouped.push(Object.assign({},e))});
  const rows=grouped;
  const noDays=cards().filter(a=>!a.closeDay);
  openSheet(t('willLast'),`<div class="form">${noDays.length?`<div class="banner"><span>${t('cardSetDays')}</span><button class="btn sm" data-act="goCards">${t('edit')}</button></div>`:''}
    <div class="blk ${tl.first?'':'act'}"><div class="blk-h"><span>${tl.first?'⚠️ '+t('notEnough'):'✓ '+t('enoughTo').replace('%m',monthLbl(tl.last))}</span></div>
      <div class="flowb"><div><span>${t('nowHave')}</span><b>${money(tl.start)}</b><span>${esc(shortDate(TODAY))}</span></div><div><span>${t('leftAtEnd')} ${esc(monthLbl(selYm))}</span><b class="${tl.mEnd[selYm]<0?'neg':''}">${money(tl.mEnd[selYm])}</b><span>${esc(shortDate(monthEnd(selYm)))}</span></div>${lowMatters?`<div><span>${t('lowestBal')}</span><b class="${tl.low.bal<0?'neg':''}">${money(tl.low.bal)}</b><span>${esc(shortDate(tl.low.date))}</span></div>`:`<div><span>${t('willGoOut')}</span><b>${money(totOut)}</b><span>${t('inclFin')}</span></div>`}</div>${lowMatters?`<p class="hint" style="padding:0 14px">${t('lowWhy').replace('%v',fmt(tl.low.bal)).replace('%d',shortDate(tl.low.date))}</p>`:''}
      ${tl.first?`<p class="hint" style="padding:0 14px">${t('shortMsg').replace('%d',shortDate(tl.first.date)).replace('%l',tl.first.label).replace('%n',fmt(-tl.low.bal))}</p>`:''}</div>
    <label class="fld"><span>${t('warnBefore')}</span><select class="in-f" id="sd">${[3,5,7,10,14,21,30].map(n=>`<option value="${n}" ${n===shortDays()?'selected':''}>${n} ${t('daysW')}</option>`).join('')}</select></label>
    <div class="list">${tl.months.map(m=>{const mr=rows.filter(e=>e.date.slice(0,7)===m),mi=mr.filter(e=>e.dir==='in').reduce((v,e)=>v+e.amt,0),mo=mr.filter(e=>e.dir==='out').reduce((v,e)=>v+e.amt,0);
      return `<div class="grp mhead"><span>${esc(monthLbl(m))}</span><span class="muted" style="font-weight:400">${mi?'<span class="pos">+'+fmt(mi)+'</span> · ':''}−${fmt(mo)}</span></div>${mr.map(e=>{const bad=e.bal<-0.5;const h=bad&&!shown;if(bad)shown=true;return `${h?`<div class="grp" style="color:var(--neg)"><span>${t('notCovered')}</span></div>`:''}<div class="row"><div class="main"><span class="t">${e.dir==='in'?'+ ':'− '}${esc(e.label)}</span><span class="s">${esc(shortDate(e.date))} · <span class="balaft">${t('balAfter')} <b class="${bad?'neg':''}">${fmt(e.bal)}</b></span></span></div><b class="amt ${e.dir==='in'?'pos':bad?'neg':''}">${money(e.amt)}</b></div>`}).join('')||`<div class="empty">${t('noItems')}</div>`}<div class="row mend"><div class="main"><span class="t">${t('leftAtEnd')} ${esc(monthLbl(m))}</span><span class="s">${esc(shortDate(monthEnd(m)))}</span></div><b class="amt balaft ${tl.mEnd[m]<0?'neg':''}">${money(tl.mEnd[m])}</b></div>`}).join('')}</div>
    <p class="hint">${t('willLastHint')}</p></div>`,r=>{r.querySelector('#sd').onchange=e=>{S.shortDays=+e.target.value;commit(t('saved'));cashSheet()}});
}

/* month by month: available money at the end of each month, from this month on */
/* what goes in and out of cash & banks in a month: obligations one by one, monthly spending and recurring income summed */
function monthLines(m){
  let ev;
  if(m>=TODAY_YM)ev=remainingPlan(m);
  else{ev=planItems(m).filter(it=>{const a=accById(it.acc);return !(a&&a.type==='card')&&!it.done}).map(it=>({label:it.label||catName(it.cat),amt:it.amount,dir:it.type==='income'?'in':'out',kind:it.src?it.src.split(':')[0]:'adj'}));
    const cp=cashPlan(m);cards().forEach(a=>{const x=cp['out:card:'+a.id];if(x&&x.v>0.5)ev.push({label:x.label,amt:x.v,dir:'out',kind:'card'})})}
  const out=[],agg={};ev.forEach(e=>{if(e.kind==='bud'||e.kind==='rec'){const k=e.dir+e.kind;if(!agg[k])agg[k]={label:e.dir==='in'?t('regularIn'):e.kind==='bud'?t('monthlySpend'):t('regularOut'),amt:0,dir:e.dir};agg[k].amt+=e.amt}else out.push(e)});
  return [...Object.values(agg),...out].sort((a,b)=>(a.dir==='in'?0:1)-(b.dir==='in'?0:1)||b.amt-a.amt);
}
/* planned cash in/out still to come from today up to date d: whole future months use the month plan (as in the forecast), a part month uses the dated plan lines */
function projFlows(d){
  let i=0,o=0,fi=0,fo=0,xi=0,xo=0;if(d<=TODAY)return {i,o,x:0,f:0,fi,fo,xi,xo};
  for(let m=TODAY_YM;m<=d.slice(0,7);m=ymAdd(m,1))
    remainingPlan(m).forEach(e=>{if(e.date>d)return;const inn=e.dir==='in';if(e.kind==='xfer'){if(inn)xi+=e.amt;else xo+=e.amt}else if(e.fin){if(inn)fi+=e.amt;else fo+=e.amt}else if(inn)i+=e.amt;else o+=e.amt});
  return {i,o,x:xi-xo,f:fi-fo,fi,fo,xi,xo};
}
/* cash & banks over the period: actual up to today, plan after it */
/* one sentence for the chosen period: start, in, out, loans/transfers, end; plus the lowest point ahead. Same figures as the boxes below. */
function glanceHTML(){
  if(ACT!=='me')return '';const P=perCash(),lbl=perLabel(),N=(v,c)=>`<b class="${c||(v<0?'neg':'gnum')}">${fmt(Math.round(v))}</b>`;
  const fxT=Math.abs(P.fx)>=1?t('sumFx').replace('%v',N(P.fx)):'';let line='';
  if(P.fut)line=t('sumFut').replace('%m',esc(lbl)).replace('%a',N(P.o)).replace('%i',N(P.gi,'pos')).replace('%o',N(P.go,'gneg')).replace('%f','').replace('%c',N(P.c));
  else if(P.proj){const pp=projFlows(P.b);line=t('sumNow').replace('%a',N(P.now))+' '+t('sumCur').replace('%m',esc(lbl)).replace('%i',N(pp.i+pp.fi+pp.xi,'pos')).replace('%o',N(pp.o+pp.fo+pp.xo,'gneg')).replace('%f','').replace('%c',N(P.c))}
  else line=t('sumPast').replace('%m',esc(lbl)).replace('%a',N(P.o)).replace('%i',N(P.gi,'pos')).replace('%o',N(P.go,'gneg')).replace('%f',fxT).replace('%c',N(P.c));
  let low='';if(P.proj||P.fut||perRange()[1]>=TODAY){const tl=cashTimeline(ymAdd(TODAY_YM,2));if(tl.low)low=`<span class="gl2">${t('sumLow').replace('%v',N(tl.low.bal)).replace('%d',esc(shortDate(tl.low.date)))}</span>`}
  return `<div class="glance tap" data-act="glance" data-id="${P.proj||P.fut?'c':'w'}"><span class="gl1">${line}</span>${low}</div>`;
}
function perCash(){
  const [a,b]=perRange(),proj=b>TODAY,now=liqAll(TODAY);
  const G=(r,pi,po,fi,fo,xi,xo)=>Object.assign(r,{fIn:fi,fOut:fo,xIn:xi,xOut:xo,gi:r.ai+pi+fi+xi,go:r.ao+po+fo+xo});
  if(a>TODAY){const p0=projFlows(dayBefore(a)),p1=projFlows(b),o=now+p0.i-p0.o+p0.x+p0.f,pi=p1.i-p0.i,po=p1.o-p0.o,xf=p1.x-p0.x,fz=p1.f-p0.f;return G({a,b,proj,fut:true,o,ai:0,ao:0,xf,fz,f0:0,pi,po,c:o+pi-po+xf+fz,now,fx:0},pi,po,p1.fi-p0.fi,p1.fo-p0.fo,p1.xi-p0.xi,p1.xo-p0.xo)}
  const o=liqAll(dayBefore(a)),cf=cashActual(S.tx.filter(x=>x.date>=a&&x.date<=(proj?TODAY:b))),sm=p=>Object.entries(cf).filter(([k])=>k.startsWith(p)).reduce((v,[,x])=>v+x.v,0);
  const ai=sm('in:'),ao=sm('out:'),xf0=sm('xin:')-sm('xout:'),f0=sm('fi:')-sm('fo:'),endA=proj?now:liqAll(b),p=proj?projFlows(b):{i:0,o:0,x:0,f:0},xf=xf0+p.x,fz=f0+p.f;
  return G({a,b,proj,fut:false,o,ai,ao,xf,xf0,fz,f0,pi:p.i,po:p.o,c:endA+p.i-p.o+p.x+p.f,now,fx:endA-o-(ai-ao)-xf0-f0},p.i,p.o,sm('fi:')+(p.fi||0),sm('fo:')+(p.fo||0),sm('xin:')+(p.xi||0),sm('xout:')+(p.xo||0));
}
function fcSeries(endM){
  const out=[];let bal=liqAll(monthEnd(ymAdd(TODAY_YM,-1)));
  for(let m=TODAY_YM;m<=endM&&out.length<60;m=ymAdd(m,1)){const r=monthCash(m),open=bal;r.gi=(r.kind==='cur'?r.iMax:r.i)+(r.fi||0)+(r.xi||0);r.go=(r.kind==='cur'?r.eMax:r.e)+(r.fo||0)+(r.xo||0);bal+=(r.kind==='cur'?r.iMax-r.eMax:r.i-r.e)+(r.x||0)+(r.f||0);out.push(Object.assign({m,open,bal},r))}
  return out;
}
function planHTML(){
  const months=perMonths(),{P,A,L}=planVsActual(months);
  const sec=ty=>{const keys=[...new Set([...Object.keys(P[ty]),...Object.keys(A[ty])])].sort((a,b)=>Math.max(P[ty][b]||0,A[ty][b]||0)-Math.max(P[ty][a]||0,A[ty][a]||0));
    let tp=0,ta=0;const rows=keys.map(k=>{const p=P[ty][k]||0,a=A[ty][k]||0;tp+=p;ta+=a;const d=ty==='income'?a-p:p-a;
      return `<div class="cmp tap" data-act="${k.startsWith('card:')?'stmtAcc':k==='xfer'?'':'planCat'}" data-id="${k.startsWith('card:')?k.slice(5):k}" data-ty="${ty}"><span>${esc(L[k]||catName(k))} ›</span><span>${money(p)}</span><span>${money(a)}</span><b class="${d<-0.5?'neg':d>0.5?'pos':''}">${d>0.5?'+':''}${money(d)}</b></div>`}).join('');
    const d=ty==='income'?ta-tp:tp-ta;
    return {html:`<div class="grp"><span>${ty==='income'?t('income'):t('expense')}</span></div>${rows||`<div class="empty">${t('noItems')}</div>`}<div class="cmp t"><span>${t('total')}</span><span>${money(tp)}</span><span>${money(ta)}</span><b class="${d<-0.5?'neg':d>0.5?'pos':''}">${d>0.5?'+':''}${money(d)}</b></div>`,tp,ta}};
  const I=sec('income'),E=sec('expense'),np=I.tp-E.tp,na=I.ta-E.ta;
  const fk=[...new Set([...Object.keys(P.fin),...Object.keys(A.fin)])],sg=k=>k.startsWith('fi:')?1:-1;let fp=0,fa=0;
  const FR=fk.map(k=>{const p=sg(k)*(P.fin[k]||0),a=sg(k)*(A.fin[k]||0);fp+=p;fa+=a;const d=a-p;return `<div class="cmp"><span>${sg(k)>0?'+':'−'} ${esc(L[k]||'')}</span><span>${money(p)}</span><span>${money(a)}</span><b class="${d<-0.5?'neg':d>0.5?'pos':''}">${d>0.5?'+':''}${money(d)}</b></div>`}).join('');
  const FH=fk.length?`<div class="grp"><span>🤝 ${t('finTitle')}</span><small class="muted" style="font-weight:400">${t('finHint')}</small></div>${FR}<div class="cmp t"><span>${t('total')}</span><span>${money(fp)}</span><span>${money(fa)}</span><b class="${fa-fp<-0.5?'neg':fa-fp>0.5?'pos':''}">${fa-fp>0.5?'+':''}${money(fa-fp)}</b></div>`:'';
  const start=TODAY_YM,endY=(+TODAY.slice(0,4)+1)+'-12',horizon=[];for(let m=start;m<=endY&&horizon.length<36;m=ymAdd(m,1))horizon.push(m);
  const fc=fcSeries(horizon[horizon.length-1]||start);
  const cm=per.mode==='month'?cur:ymAdd(TODAY_YM,-1);
  const dN=na-np;
  return `<details class="box" data-k="pva"><summary><h2>${t('planVsAct')}</h2><div class="sumline"><div>${t('cashIn')} · ${t('actual')}<b class="pos"><span class="why" data-act="why" data-w="pvaIn">${money(I.ta)}</span></b><small>${t('planned')} ${money(I.tp)}</small></div><div>${t('cashOut')} · ${t('actual')}<b><span class="why" data-act="why" data-w="pvaOut">${money(E.ta)}</span></b><small>${t('planned')} ${money(E.tp)}</small></div><div>${t('netShort')}<b class="${na<0?'neg':''}"><span class="why" data-act="why" data-w="pvaNet">${money(na)}</span></b><small>${t('planned')} ${money(np)}</small><small class="${dN<-0.5?'neg':dN>0.5?'pos':''}">${Math.abs(dN)<0.5?t('asPlanned'):(dN>0?t('betterBy'):t('worseBy'))+' '+fmt(Math.round(Math.abs(dN)))}</small></div></div>${fk.length?`<div class="sumline" style="grid-template-columns:1fr"><div>🤝 ${t('finTitle')} <small>${t('finHint')}</small><b class="${fa<0?'neg':'pos'}"><span class="why" data-act="why" data-w="pvaFin">${fa<0?'− ':'+ '}${money(Math.abs(fa))}</span></b><small>${t('planned')} ${fp<0?'− ':'+ '}${money(Math.abs(fp))}</small></div></div>`:''}</summary>${cm<=TODAY_YM?`<button class="btn block" data-act="closeMonth" data-m="${cm}" style="margin:8px 0">${S.closed[cm]?'✓ ':''}${t('closeTitle')} · ${esc(monthLbl(cm))}</button>`:''}<div class="list">
    <div class="cmp h"><span>${t('category')}</span><span>${t('planned')}</span><span>${t('actual')}</span><span>${t('variance')}</span></div>
    ${I.html}${E.html}
    <div class="cmp t"><span>${t('netShort')}</span><span>${money(np)}</span><span>${money(na)}</span><b class="${na-np<-0.5?'neg':na-np>0.5?'pos':''}">${na-np>0.5?'+':''}${money(na-np)}</b></div>
    ${FH}${fk.length?`<div class="cmp t"><span>${t('cashNetAll')}</span><span>${money(np+fp)}</span><span>${money(na+fa)}</span><b class="${na+fa-np-fp<-0.5?'neg':na+fa-np-fp>0.5?'pos':''}">${na+fa-np-fp>0.5?'+':''}${money(na+fa-np-fp)}</b></div>`:''}</div><p class="hint">${t('planHint')}</p></details>
  <button class="btn block" data-act="cashSheet" style="margin:6px 0">${(()=>{const a=cashTimeline();return a.first?'⚠️ '+t('willLast')+' · '+t('notEnough'):'✓ '+t('willLast')})()}</button>
  ${fc.length?`<details class="box" data-k="fc"><summary><h2>${t('forecastT')} <small class="muted" style="font-size:12px;font-weight:400">${t('fromToday')}</small></h2>
    ${(()=>{const low=fc.reduce((a,r)=>r.bal<a.bal?r:a,fc[0]),firstGap=fc.find(r=>r.gi-r.go<-0.5);return `<div class="flowb sumline" style="border-top:0;padding:0"><div><span>${t('lowestBal')}</span><b class="${low.bal<0?'neg':''}"><span class="why" data-act="why" data-w="fcLow">${money(low.bal)}</span></b><span>${esc(monthLbl(low.m))}</span></div><div><span>${t('firstGap')}</span><b class="${firstGap?'neg':'pos'}">${firstGap?`<span class="why" data-act="why" data-w="fcGap">${money(firstGap.gi-firstGap.go)}</span>`:'—'}</b><span>${firstGap?esc(monthLbl(firstGap.m)):t('noGap')}</span></div><div><span>${t('endBal')}</span><b class="${fc[fc.length-1].bal<0?'neg':''}"><span class="why" data-act="why" data-w="fcEnd">${money(fc[fc.length-1].bal)}</span></b><span>${esc(monthLbl(fc[fc.length-1].m))}</span></div></div>`})()}</summary><div class="list">
    ${cards().some(a=>!a.closeDay)?`<p class="hint" style="padding:6px 14px;margin:0">${t('cardSetDays')}</p>`:''}
    <div class="cmp h fc"><span>${t('monthW')}</span><span>${t('cashIn')}</span><span>${t('cashOut')}</span><span>${t('gapW')}</span><span>${t('availEnd')}</span></div>
    ${fc.map(r=>`<div class="cmp fc tap" data-act="fcMonth" data-m="${r.m}"><span>${esc(monthShort(r.m))} ${r.m.slice(2,4)}${r.kind==='cur'?' •':''}</span><span class="pos">${money(r.gi)}</span><span>${money(r.go)}</span><b class="${r.gi-r.go<0?'neg':'pos'}">${money(r.gi-r.go)}</b><b class="${r.bal<0?'neg':''}">${money(r.bal)}</b></div>${(r.fi||0)+(r.fo||0)+(r.xi||0)+(r.xo||0)>0.5?`<div class="cmp fc" style="font-size:11px"><span style="grid-column:1/5;white-space:normal">↳ ${t('ofWhich')} 🤝 ${t('finTitle')}: ${(r.fi||0)>0.5?'+'+fmt(Math.round(r.fi)):''}${(r.fi||0)>0.5&&(r.fo||0)>0.5?' / ':''}${(r.fo||0)>0.5?'−'+fmt(Math.round(r.fo)):''}${(r.xi||0)+(r.xo||0)>0.5?' · ⇄ '+t('xferShort')+': '+((r.xi||0)>0.5?'+'+fmt(Math.round(r.xi)):'')+((r.xo||0)>0.5?' −'+fmt(Math.round(r.xo)):''):''}</span><b></b></div>`:''}${r.dev&&r.dev.length?`<div class="cmp fc" style="font-size:11px"><span style="grid-column:1/5;white-space:normal">↳ ${t('overPlan')}: ${r.dev.map(d=>esc(d.label)+' '+(d.k.startsWith('in:')?'+':'−')+fmt(d.v)).join('، ')}</span><b></b></div>`:''}`).join('')}
    </div><p class="hint">${t('forecastHint')}</p></details>`:''}`;
}

/* cash & banks over the period, from the opening to the closing, line by line */
function fxGain(PA,PE,only){let tot=0;const rows=[];const b0=dayBefore(PA);
  S.accounts.filter(a=>a.currency!==BASE()&&(!only||only(a))).forEach(a=>{let flow=0;S.tx.forEach(x=>{if(x.date<PA||x.date>PE)return;
      if(x.type==='transfer'){if(x.acc===a.id)flow-=xferBase(x);if(x.toAcc===a.id)flow+=xferBase(x)}else if(x.acc===a.id)flow+=(x.type==='income'?1:-1)*baseAmt(x)});
    const g=valAt(a,PE)-valAt(a,b0)-flow;if(Math.abs(g)>=0.5){tot+=g;rows.push({a,g,open:valAt(a,b0),close:valAt(a,PE),flow})}});
  return {tot,rows}}
function bridgeLines(){
  const P=perCash(),[PA,PE]=perRange(),to=P.proj?TODAY:PE,W=P.fut?[]:S.tx.filter(x=>x.date>=PA&&x.date<=to);
  const sm=f=>W.filter(f).reduce((v,x)=>v+baseAmt(x),0),liq=x=>isLiquid(accById(x.acc));
  const inc=sm(x=>x.type==='income'&&isPL(x)),exp=sm(x=>x.type==='expense'&&isPL(x)),fi=sm(x=>x.type==='income'&&isFin(x)),fo=sm(x=>x.type==='expense'&&isFin(x));
  const offCash=sm(x=>x.type==='expense'&&!liq(x))-sm(x=>x.type==='income'&&!liq(x));
  const ca=cashActual(W),cardPay=Object.entries(ca).filter(([k])=>k.startsWith('out:card:')).reduce((v,[,x])=>v+x.v,0);
  const L=(l,v,o)=>Object.assign({l,v},o||{}),endA=P.fut?P.o:P.proj?P.now:P.c;
  const out=P.fut?[L(t('projStart'),P.o,{strong:1,w:'opening'}),L(t('expIn'),P.gi,{w:'cashIn',s:P.fIn+P.xIn>0.5?t('ofWhich')+' '+t('finTitle')+' '+fmt(Math.round(P.fIn))+(P.xIn>0.5?' · '+t('xferShort')+' '+fmt(Math.round(P.xIn)):''):''}),L(t('expOut'),-P.go,{w:'cashOut',s:P.fOut+P.xOut>0.5?t('ofWhich')+' '+t('finTitle')+' '+fmt(Math.round(P.fOut))+(P.xOut>0.5?' · '+t('xferShort')+' '+fmt(Math.round(P.xOut)):''):''}),L(t('projEndS'),P.c,{strong:1,total:1})]
   :[L(t('openBal'),P.o,{strong:1,w:'opening'}),L(t('income'),inc,{act:'stmtFlow',ty:'income'}),L(t('expense'),-exp,{act:'stmtFlow',ty:'expense'}),L(t('finTitle'),fi-fo,{act:'stmtFin'}),L(t('cardSpendNotPaid'),offCash,{act:'goCards'}),L(t('cardPayNote'),-cardPay,{w:'cardPays'}),L(t('xferNet'),P.xf0,{w:'xferAct'}),L(t('fxDiff'),P.fx)]
     .concat(P.proj?[L(t('availNow'),endA,{strong:1,w:'availNow'}),L(t('restExpected'),P.c-endA,{w:'rest'}),L(t('projEndS'),P.c,{strong:1,total:1})]:[L(t('closeBal'),P.c,{strong:1,total:1,w:'closing'})]);
  return out.filter(x=>x.strong||Math.abs(x.v)>=0.5);
}
/* one line of a breakdown: label, amount, and where tapping it goes */
function whyLine(x){const go=x.w?`data-act="why" data-w="${x.w}"`:x.act?`data-act="${x.act}" ${x.ty?`data-ty="${x.ty}"`:''} ${x.id?`data-id="${x.id}"`:''}`:'';
  return `<div class="row ${go?'tap':''}" ${go} ${x.total?'data-total="1"':''} style="padding:7px 12px"><div class="main"><span class="t" style="${x.strong?'font-weight:700':''}">${x.l}${go?' ›':''}</span>${x.s?`<span class="s">${x.s}</span>`:''}</div><b class="amt ${x.v<0?'neg':x.strong||x.plain?'':'pos'}">${x.strong||x.plain?money(x.v):(x.v<0?'− ':'+ ')+money(Math.abs(x.v))}</b></div>`}
function bridgeHTML(){
  const P=perCash(),rows=bridgeLines().map(whyLine).join('');
  return `<details class="box" data-k="bridge"><summary><h2>${t('perSummary')} <small class="muted" style="font-size:12px;font-weight:400">${t('cashBanks')}</small></h2><div class="sumline"><div>${P.fut?t('projStart'):t('openBal')}<b><span class="why" data-act="why" data-w="opening">${money(P.o)}</span></b></div><div>${t('movesNet')}<b class="${P.c-P.o<0?'neg':'pos'}"><span class="why" data-act="why" data-w="moves">${P.c-P.o<0?'− ':'+ '}${money(Math.abs(P.c-P.o))}</span></b></div><div>${P.proj?t('projEndS'):t('closeBal')}<b class="${P.c<0?'neg':''}"><span class="why" data-act="why" data-w="availEnd">${money(P.c)}</span></b></div></div></summary><div class="list">${rows}</div><p class="hint">${t('bridgeHint')}</p></details>`;
}
/* expected cash events from today up to date d (same list the forecast uses) */
function evsUpTo(d,from){const out=[];if(d<=TODAY)return out;for(let m=TODAY_YM;m<=d.slice(0,7);m=ymAdd(m,1))remainingPlan(m).forEach(e=>{if(e.date<=d&&(!from||e.date>=from))out.push(Object.assign({m},e))});return out}
/* where a number comes from: the sum line by line, the entries behind it, and where to see them */
function whyData(k){
  if(k.startsWith('cst:')){const [,id,C]=k.split(':'),a=accById(id);if(!a)return null;const s=cardCycles(a).find(x=>x.C===C);if(!s)return null;
    return {title:a.name+' · '+t('statement'),sub:dmyOf(dsDate(iso(new Date(dOf(s.P).getTime()+864e5))))+' → '+dmyOf(dsDate(s.C))+' · '+t('payDay')+' '+dmyOf(dsDate(s.due)),lines:[{l:t('total'),v:toBase(s.sum,a.currency),strong:1,total:1}],rows:s.list.map(x=>({d:x.date,l:(x.note||(x.type==='transfer'?t('transfer'):catPath(x.cat))),v:-toBase(+x.amount||0,a.currency),act:'openTx',id:x.id})),go:{act:'stmtAcc',id:a.id,l:t('statement')}}}
  const P=perCash(),[PA,PE]=perRange(),to=P.proj?TODAY:PE,W=P.fut?[]:S.tx.filter(x=>x.date>=PA&&x.date<=to),L=(l,v,o)=>Object.assign({l,v},o||{});
  const accLines=d=>S.accounts.filter(isLiquid).map(a=>L(a.name,toBase(accBalanceAt(a,d),a.currency),{plain:1,act:'stmtAcc',id:a.id,s:a.currency!==BASE()?fmt(accBalanceAt(a,d))+' '+a.currency:''}));
  const txRow=(x,v)=>({d:x.date,l:(x.note||(x.type==='transfer'?t('transfer'):catPath(x.cat)))+' · '+((accById(x.acc)||{}).name||''),v,act:'openTx',id:x.id});
  const evRow=e=>({d:e.date,l:e.label,v:e.dir==='in'?e.amt:-e.amt,exp:1});
  const liq=x=>isLiquid(accById(x.acc)),fut=P.fut?evsUpTo(PE,PA):P.proj?evsUpTo(PE):[];
  const sub=(P.fut?t('expWord'):perLabel())+' · '+t('cashBanks');
  switch(k){
  case 'availEnd':return {title:P.proj?t('projEndS'):t('closeBal'),sub,lines:bridgeLines(),go:P.proj?{act:'cashSheet',l:t('willLast')}:{act:'goAcc',l:t('accounts')}};
  case 'availNow':return {title:t('availNow'),sub:dmyOf(dsDate(TODAY)),lines:accLines(TODAY).concat([L(t('total'),liqAll(TODAY),{strong:1,total:1})]),go:{act:'goAcc',l:t('accounts')}};
  case 'closing':return {title:t('closeBal'),sub:dmyOf(dsDate(PE)),lines:accLines(PE).concat([L(t('total'),liqAll(PE),{strong:1,total:1})]),go:{act:'goAcc',l:t('accounts')}};
  case 'opening':if(P.fut){const p0=projFlows(dayBefore(PA));return {title:t('projStart'),sub:dmyOf(dsDate(dayBefore(PA))),lines:[L(t('availNow'),P.now,{strong:1,w:'availNow'}),L(t('expIn'),p0.i),L(t('expOut'),-p0.o),L(t('finTitle'),p0.f),L(t('xferNet'),p0.x),L(t('projStart'),P.o,{strong:1,total:1})].filter(x=>x.strong||Math.abs(x.v)>=0.5),rows:evsUpTo(dayBefore(PA)).map(evRow),go:{act:'cashSheet',l:t('willLast')}}}
    return {title:t('openBal'),sub:dmyOf(dsDate(dayBefore(PA))),lines:accLines(dayBefore(PA)).concat([L(t('total'),P.o,{strong:1,total:1})]),go:{act:'goAcc',l:t('accounts')}};
  case 'cashIn':case 'cashOut':{const inn=k==='cashIn',act=W.filter(x=>liq(x)&&(inn?x.type==='income':x.type==='expense')).map(x=>txRow(x,inn?baseAmt(x):-baseAmt(x)))
      .concat(W.filter(x=>x.type==='transfer'&&(inn?!liq(x)&&isLiquid(accById(x.toAcc)):liq(x)&&!isLiquid(accById(x.toAcc)))).map(x=>txRow(x,inn?toBase(+(x.toAmount??x.amount),(accById(x.toAcc)||{}).currency):-baseAmt(x))));
    const ex=fut.filter(e=>e.dir===(inn?'in':'out')).map(evRow),sg=inn?1:-1;
    return {title:inn?t('cashIn'):t('cashOut'),sub,lines:[L(inn?t('plIn'):t('plOut'),sg*(inn?P.ai+P.pi:P.ao+P.po),{plain:1}),L(t('finTitle'),sg*(inn?P.fIn:P.fOut),{plain:1,w:'finCash'}),L(t('xferShort'),sg*(inn?P.xIn:P.xOut),{plain:1,w:'xferCash'}),L(t('total'),sg*(inn?P.gi:P.go),{strong:1,total:1})].filter(x=>x.strong||Math.abs(x.v)>=0.5),rows:act.concat(ex).sort((a,b)=>(a.d||'').localeCompare(b.d||'')),note:t('cashVsPL')}}
  case 'finCash':{const act=W.filter(x=>liq(x)&&isFin(x)).map(x=>txRow(x,x.type==='income'?baseAmt(x):-baseAmt(x))),ex=fut.filter(e=>e.fin).map(evRow);
    return {title:t('finTitle'),sub,lines:[L(t('actWord'),P.f0||0),L(t('expWord'),(P.fz||0)-(P.f0||0)),L(t('total'),P.fz||0,{strong:1,total:1})].filter(x=>x.strong||Math.abs(x.v)>=0.5),rows:act.concat(ex),go:{act:'stmtFin',l:t('statement')}}}
  case 'moves':{const ls=bridgeLines().filter(x=>!x.strong);return {title:t('movesNet'),sub,lines:ls.concat([L(t('movesNet'),P.c-P.o,{strong:1,total:1})])}}
  case 'xferAct':{const r=W.filter(x=>x.type==='transfer'&&liq(x)!==isLiquid(accById(x.toAcc))&&(accById(x.toAcc)||{}).type!=='card').map(x=>txRow(x,liq(x)?-baseAmt(x):toBase(+(x.toAmount??x.amount),(accById(x.toAcc)||{}).currency)));return {title:t('xferNet'),sub,lines:[L(t('total'),P.xf0,{strong:1,total:1})],rows:r}}
  case 'xferCash':{const act=W.filter(x=>x.type==='transfer'&&liq(x)!==isLiquid(accById(x.toAcc))&&(accById(x.toAcc)||{}).type!=='card').map(x=>txRow(x,liq(x)?-baseAmt(x):toBase(+(x.toAmount??x.amount),(accById(x.toAcc)||{}).currency))),ex=fut.filter(e=>e.kind==='xfer').map(evRow);
    return {title:t('xferNet'),sub,lines:[L(t('total'),P.xf,{strong:1,total:1})],rows:act.concat(ex)}}
  case 'cardPays':{const r=W.filter(x=>x.type==='transfer'&&liq(x)&&(accById(x.toAcc)||{}).type==='card').map(x=>txRow(x,-baseAmt(x)));return {title:t('cardPayNote'),sub,lines:[L(t('total'),r.reduce((v,x)=>v+x.v,0),{strong:1,total:1})],rows:r,go:{act:'goCards',l:t('cardsT')}}}
  case 'rest':{const ev=fut.filter(e=>e.date>TODAY||e.date===TODAY);return {title:t('restExpected'),sub:dmyOf(dsDate(TODAY))+' → '+dmyOf(dsDate(PE)),lines:[L(t('expIn'),P.pi),L(t('expOut'),-P.po),L(t('finTitle'),(P.fz||0)-(P.f0||0)),L(t('xferNet'),P.xf-(P.xf0||0)),L(t('total'),P.c-P.now,{strong:1,total:1})].filter(x=>x.strong||Math.abs(x.v)>=0.5),rows:ev.map(evRow),go:{act:'cashSheet',l:t('willLast')}}}
  case 'safe':{const x=safeToSpend(),ev=remainingPlan(TODAY_YM).filter(e=>e.dir==='out'&&['inst','gam','loan','card','adj','tx','xfer','rec'].includes(e.kind));
    return {title:t('safeTitle'),sub:dmyOf(dsDate(TODAY))+' → '+dmyOf(dsDate(monthEnd(TODAY_YM))),lines:[L(t('availNow'),x.liquid,{strong:1,w:'availNow'}),L(t('safeObl'),-x.obl),L(t('safeRec'),-x.recOut),L(t('goals'),-x.goals,{act:'goGoals'}),L(t('safeTitle'),x.safe,{strong:1,total:1}),L(t('goalsKeep'),x.goals),L(t('budStill'),-x.bud),L(t('otherOut'),-x.other),L(t('inToEnd'),x.recIn),L(t('safeToEnd'),x.end,{strong:1,total:1})].filter(y=>y.strong||Math.abs(y.v)>=0.5),rows:ev.map(evRow),note:t('safeWhyNote'),go:{act:'safe',l:t('details')}}}
  case 'cardsOwe':{const r=cards().map(a=>{const c=cardInfo(a,PE);return L(a.name,-toBase(c.owed,a.currency),{plain:1,act:'stmtAcc',id:a.id,s:c.due?t('cardDue')+' '+fmt(c.due)+' · '+esc(shortDate(c.dueDate)):''})}).filter(x=>Math.abs(x.v)>=0.5);
    return {title:t('cardsOwe'),sub:dmyOf(dsDate(PE)),lines:r.concat([L(t('total'),r.reduce((v,x)=>v+x.v,0),{strong:1,total:1})]),go:{act:'goCards',l:t('cardsT')}}}
  case 'nw':{const n=netWorth(PE);return {title:t('netWorth'),sub:dmyOf(dsDate(PE)),lines:[L(t('nwAssets'),n.assets,{w:'nwAcc'}),L(t('nwNeg'),n.neg,{w:'nwAcc'}),L(t('owedToMe'),n.recv,{act:'goLoans'}),L(t('iOwe'),-n.pay,{act:'goLoans'}),L(t('nwObl'),-n.obl,{act:'goInst',s:t('nwOblSplit').replace('%d',fmt(Math.round(n.oblDue))).replace('%l',fmt(Math.round(n.oblLater)))}),L(t('nwGam'),n.gam,{act:'goGam'}),L(t('netWorth'),n.net,{strong:1,total:1})].filter(x=>x.strong||Math.abs(x.v)>=0.5),note:t('nwHint')}}
  case 'nwAcc':case 'accTot':{const r=S.accounts.map(a=>L(a.name,toBase(accBalanceAt(a,PE),a.currency),{plain:1,act:'stmtAcc',id:a.id,s:a.currency!==BASE()?fmt(accBalanceAt(a,PE))+' '+a.currency:''}));return {title:t('accounts'),sub:dmyOf(dsDate(PE)),lines:r.concat([L(t('total'),r.reduce((v,x)=>v+x.v,0),{strong:1,total:1})])}}
  case 'pvaIn':case 'pvaOut':case 'pvaNet':case 'pvaFin':{const {P:Pp,A}=planVsActual(perMonths()),Lb=x=>catName(x);
    const grp=ty=>[...new Set([...Object.keys(Pp[ty]),...Object.keys(A[ty])])].map(c=>({c,p:Pp[ty][c]||0,a:A[ty][c]||0}));
    const sumA=ty=>grp(ty).reduce((v,x)=>v+x.a,0),sumP=ty=>grp(ty).reduce((v,x)=>v+x.p,0);
    if(k==='pvaNet')return {title:t('netShort'),sub:perLabel()+' · '+t('cashBanks'),lines:[L(t('cashIn'),sumA('income'),{w:'pvaIn',s:t('planned')+' '+fmt(sumP('income'))}),L(t('cashOut'),-sumA('expense'),{w:'pvaOut',s:t('planned')+' '+fmt(sumP('expense'))}),L(t('netShort'),sumA('income')-sumA('expense'),{strong:1,total:1,s:t('planned')+' '+fmt(sumP('income')-sumP('expense'))})]};
    if(k==='pvaFin'){const g=grp('fin').map(x=>({...x,sg:x.c.startsWith('fi:')?1:-1}));return {title:t('finTitle'),sub:perLabel(),lines:g.map(x=>L((Pp.fin[x.c]!=null||A.fin[x.c]!=null)?(x.sg>0?'+ ':'− ')+catName(x.c.slice(3)):'',x.sg*x.a,{s:t('planned')+' '+fmt(x.p),act:'stmtFin'})).concat([L(t('total'),g.reduce((v,x)=>v+x.sg*x.a,0),{strong:1,total:1,s:t('planned')+' '+fmt(g.reduce((v,x)=>v+x.sg*x.p,0))})])}}
    const ty=k==='pvaIn'?'income':'expense',sg=ty==='income'?1:-1,g=grp(ty).sort((a,b)=>b.a-a.a);
    return {title:(ty==='income'?t('cashIn'):t('cashOut'))+' · '+t('actual'),sub:perLabel()+' · '+t('cashBanks'),lines:g.map(x=>L(x.c.startsWith('card:')?t('cardPayNote')+' · '+((accById(x.c.slice(5))||{}).name||''):Lb(x.c),sg*x.a,{s:t('planned')+' '+fmt(x.p),act:x.c.startsWith('card:')?'stmtAcc':'planCat',id:x.c.startsWith('card:')?x.c.slice(5):x.c,ty})).concat([L(t('total'),sg*sumA(ty),{strong:1,total:1,s:t('planned')+' '+fmt(sumP(ty))})])}}
  case 'fcEnd':case 'fcLow':{const sr=fcSeries(fcHorizon()),tgt=k==='fcEnd'?sr[sr.length-1]:sr.reduce((a,r)=>r.bal<a.bal?r:a,sr[0]);const ls=[L(t('availNow'),liqAll(TODAY),{strong:1,w:'availNow'})];
    for(const r of sr){let n,si,so;if(r.kind==='cur'){const ev=remainingPlan(r.m),sm=f=>ev.filter(f).reduce((v,e)=>v+e.amt,0);si=sm(e=>e.dir==='in'&&e.kind!=='xfer'&&!e.fin);so=sm(e=>e.dir==='out'&&e.kind!=='xfer'&&!e.fin);n=r.bal-liqAll(TODAY)}else{si=r.i;so=r.e;n=r.bal-r.open}
      ls.push(L((r.kind==='cur'?t('restOf')+' ':'')+monthLbl(r.m),n,{act:'fcMonth',id:r.m,s:t('cashIn')+' '+fmt(Math.round(si))+' · '+t('cashOut')+' '+fmt(Math.round(so))+(Math.abs(n-(si-so))>0.5?' · '+t('finTitle')+'/'+t('transfers')+' '+fmt(Math.round(n-(si-so))):'')}));if(r.m===tgt.m)break}
    ls.push(L(k==='fcEnd'?t('endBal'):t('lowestBal'),tgt.bal,{strong:1,total:1}));return {title:k==='fcEnd'?t('endBal'):t('lowestBal'),sub:monthLbl(tgt.m)+' · '+t('fromToday'),lines:ls,go:{act:'cashSheet',l:t('willLast')}}}
  case 'fcGap':{const sr=fcSeries(fcHorizon()),r=sr.find(z=>z.gi-z.go<-0.5);if(!r)return null;return {title:t('firstGap'),sub:monthLbl(r.m),lines:[L(t('cashIn'),r.gi),L(t('cashOut'),-r.go),L(t('gapW'),r.gi-r.go,{strong:1,total:1})],go:{act:'fcMonth',id:r.m,l:monthLbl(r.m)},note:t('gapNote')}}
  case 'catExp':case 'catInc':{const ty=k==='catExp'?'expense':'income',by=new Map();txIn().filter(x=>x.type===ty&&isPL(x)).forEach(x=>{const c=catRoot(x.cat);by.set(c,(by.get(c)||0)+baseAmt(x))});
    const r=[...by].sort((a,b)=>b[1]-a[1]).map(([c,v])=>L(catName(c),v,{plain:1,act:catKids(ty,c).length?'catGroup':'stmtCat',id:c,ty}));return {title:ty==='expense'?t('expByCat'):t('incByCat'),sub:perLabel(),lines:r.concat([L(t('total'),r.reduce((v,x)=>v+x.v,0),{strong:1,total:1})]),go:{act:'stmtFlow',l:t('statement')}}}
  case 'avgIn':case 'avgOut':case 'avgNet':{const ml=per.mode==='month'?Array.from({length:6},(_,i)=>ymAdd(cur,i-5)):perMonths().slice(-24),ms=ml.map(m=>{const x=txOf(m);return {m,i:sumB(x.filter(y=>y.type==='income'&&isPL(y))),e:sumB(x.filter(y=>y.type==='expense'&&isPL(y)))}});
    const f=o=>k==='avgIn'?o.i:k==='avgOut'?o.e:o.i-o.e,tot=ms.reduce((v,o)=>v+f(o),0);
    return {title:k==='avgIn'?t('avgIn'):k==='avgOut'?t('avgOut'):t('netShort'),sub:monthLbl(ml[0])+' → '+monthLbl(ml[ml.length-1]),lines:ms.map(o=>L(monthLbl(o.m),f(o),{plain:1})).concat([L(t('total'),tot,{plain:1}),L(t('avgW')+' ÷ '+ms.length,Math.round(tot/ms.length),{strong:1,total:1})])}}
  case 'zakat':{const z=zakatCalc();if(!z.price)return null;return {title:t('zakat'),sub:t('asOfToday'),lines:[L(t('zkCash'),z.cash,{w:'nwAcc'}),z.gold?L(t('zkGoldVal'),z.gold):null,z.recvOn?L(t('owedToMe'),z.recv,{act:'goLoans'}):null,z.debtOn?L(t('iOwe'),-z.debt,{act:'goLoans'}):null,L(t('zkBase'),z.base,{strong:1}),L(t('nisab')+' (85 '+t('gram')+' × '+fmt(z.price)+')',z.nisab,{plain:1}),L(z.due?'× 2.5%':t('zkNotDue'),z.due?z.base*0.025:0,{strong:1,total:1})].filter(Boolean)}}
  case 'oDue':case 'oPaid':case 'oLeft':{const kk=oblTab==='gam'?'gam':'inst',L0=oblBase(kk),f=k==='oDue'?(st=>st.due+st.late):k==='oPaid'?(st=>st.paidP):(st=>st.left);
    const r=L0.map(o=>{const st=oblStats(kk,o);return L(o.name,f(st),{plain:1,act:'stmtObl',id:o.id,ty:kk,s:k==='oDue'?(st.late>0.5?t('plusLate')+' '+fmt(Math.round(st.late)):''):k==='oPaid'?t('sinceStart')+': '+fmt(Math.round(st.paidCum)):t('ofTotal')+' '+fmt(Math.round(st.total))+(st.waived>0.5?' · '+t('waivedLbl')+' '+fmt(Math.round(st.waived)):'')})}).filter(x=>Math.abs(x.v)>=0.5);
    const tot=r.reduce((v,x)=>v+x.v,0);return {title:(kk==='inst'?t('installments'):t('gameyas'))+' · '+(k==='oDue'?t('dueLbl'):k==='oPaid'?t('paidLbl'):t('remaining')),sub:perLabel(),lines:r.concat([L(t('total'),tot,{strong:1,total:1})]),note:k==='oDue'?t('dueWhyNote'):k==='oPaid'?t('paidWhyNote'):t('leftWhyNote')}}
  case 'lLent':case 'lBorrowed':case 'lNet':{const L0=oblBase('loan'),r=L0.filter(l=>k==='lNet'||l.dir===(k==='lLent'?'lent':'borrowed')).map(l=>L(l.person+(l.note?' · '+l.note:''),(l.dir==='lent'?1:-1)*(k==='lNet'?1:(l.dir==='lent'?1:-1))*toBase(loanLeftAt(l,PE),l.currency||BASE()),{plain:1,act:'stmtPerson',id:l.person})).filter(x=>Math.abs(x.v)>=0.5);
    return {title:k==='lLent'?t('owedToMe'):k==='lBorrowed'?t('iOwe'):t('netShort'),sub:dmyOf(dsDate(PE)),lines:r.concat([L(t('total'),r.reduce((v,x)=>v+x.v,0),{strong:1,total:1})])}}
  case 'cDue':{const r=cards().map(a=>{const c=cardInfo(a,PE);return L(a.name,toBase(c.due||0,a.currency),{plain:1,act:'stmtAcc',id:a.id,s:c.dueDate?t('nextPay')+' '+shortDate(c.dueDate)+(c.close?' · '+t('closeDay')+' '+shortDate(c.close):''):''})}).filter(x=>Math.abs(x.v)>=0.5);return {title:t('cardDue'),sub:dmyOf(dsDate(PE)),lines:r.concat([L(t('total'),r.reduce((v,x)=>v+x.v,0),{strong:1,total:1})]),note:t('cDueNote')}}
  case 'fx':{const g=fxGain(PA,P.proj?TODAY:PE);return {title:t('fxTitle'),sub:perLabel(),lines:g.rows.map(r=>L(r.a.name+' ('+r.a.currency+')',r.g,{act:'stmtAcc',id:r.a.id,s:t('fxRow').replace('%o',fmt(Math.round(r.open))).replace('%f',fmt(Math.round(r.flow))).replace('%c',fmt(Math.round(r.close)))})).concat([L(t('total'),g.tot,{strong:1,total:1})]),note:t('fxNote')}}
  case 'due':{const DM=PE.slice(0,7),r=[];dueFor(DM).filter(d=>d.k!=='gamr').forEach(d=>r.push(L(d.name,-toBase(d.amount,d.cur||BASE()),{plain:1,act:d.k==='inst'?'payInst':'payGam',id:d.id,s:(d.k==='inst'?t('installments'):t('gameyas'))+' · '+monthLbl(d.ym)})));
    return {title:t('dueLbl'),sub:t('dueUntil')+' '+monthLbl(DM),lines:r.concat([L(t('total'),r.reduce((v,x)=>v+x.v,0),{strong:1,total:1})]),note:t('dueWhyNote')}}
  }
  return null;
}
const fcHorizon=()=>{const endY=(+TODAY.slice(0,4)+1)+'-12';let m=TODAY_YM,n=0;while(m<endY&&n<35){m=ymAdd(m,1);n++}return m};
function whySheet(k){const o=whyData(k);if(!o){toast(t('noDetails'));return}
  const rows=(o.rows||[]).slice().sort((a,b)=>(a.d||'').localeCompare(b.d||''));
  openSheet(o.title,`<div class="form">${o.sub?`<p class="hint">${o.sub}</p>`:''}
    <div class="list">${o.lines.map(whyLine).join('')}</div>
    ${rows.length?`<div class="grp" style="border-radius:12px 12px 0 0"><span>${t('whyRows')} (${rows.length})</span></div><div class="list" style="border-radius:0 0 12px 12px">${rows.slice(0,300).map(r=>`<div class="row ${r.act?'tap':''}" ${r.act?`data-act="${r.act}" data-id="${r.id}"`:''} style="padding:6px 12px"><div class="main"><span class="t" style="font-size:13px">${esc(r.l)}${r.act?' ›':''}</span><span class="s">${esc(shortDate(r.d))}${r.exp?' · '+t('expWord'):''}</span></div><b class="amt ${r.v<0?'neg':'pos'}">${r.v<0?'− ':'+ '}${money(Math.abs(r.v))}</b></div>`).join('')}</div>`:''}
    ${o.go?`<button type="button" class="btn block" data-act="${o.go.act}" ${o.go.id?`data-id="${o.go.id}"`:''}>${o.go.l} ›</button>`:''}
    ${o.note?`<p class="hint">${o.note}</p>`:''}</div>`);
}
function vRep(){
  const tx=txIn(),exp=tx.filter(x=>x.type==='expense'&&isPL(x)),inc=sumB(tx.filter(x=>x.type==='income'&&isPL(x))),te=sumB(exp),bf=perFactor(),B=id=>S.budgets[id]?Math.round(S.budgets[id]*bf):0;
  const by={};exp.forEach(x=>{const k=catRoot(x.cat);by[k]=(by[k]||0)+baseAmt(x)});
  Object.keys(S.budgets).forEach(k=>{if(!(k in by))by[k]=0});
  const rows=Object.entries(by).sort((a,b)=>b[1]-a[1]);const mx=Math.max(1,...rows.map(r=>Math.max(r[1],B(r[0]))));
  const mlist=per.mode==='month'?Array.from({length:6},(_,i)=>ymAdd(cur,i-5)):perMonths().slice(-24);
  const ms=mlist.map(m=>{const x=txOf(m);return{m,i:sumB(x.filter(y=>y.type==='income'&&isPL(y))),e:sumB(x.filter(y=>y.type==='expense'&&isPL(y)))}});
  const top=Math.max(1,...ms.map(o=>Math.max(o.i,o.e)));
  return `${bridgeHTML()}<section class="slip"><div class="split"><div class="tile" data-act="stmtFlow" data-ty="income"><span class="label">${t('income')} ›</span><span class="mid pos">${money(inc)}</span></div><div class="tile" data-act="stmtFlow" data-ty="expense"><span class="label">${t('expense')} ›</span><span class="mid">${money(te)}</span></div></div>
    <div class="perf"></div><div class="net tile" data-act="stmtFlow" data-ty="net"><span class="label">${t('net')} ›</span><span class="mid ${inc-te<0?'neg':''}">${money(inc-te)} <small class="muted">${esc(curSym(BASE()))}</small></span></div>${finHTML(tx)}${(()=>{const [a,b]=perRange(),g=fxGain(a,b>TODAY?TODAY:b);return Math.abs(g.tot)>=0.5?`<div class="row tap" data-act="why" data-w="fx" style="padding:6px 14px 10px"><div class="main"><span class="t" style="font-size:13px">💱 ${t('fxTitle')} ›</span><span class="s">${t('fxHint')}</span></div><b class="amt ${g.tot<0?'neg':'pos'}">${g.tot<0?'− ':'+ '}${money(Math.abs(g.tot))}</b></div>`:''})()}</section>
  ${planHTML()}
  <details class="box" data-k="byCat"><summary><h2>${t('byCat')}</h2><span class="sumv"><span class="why" data-act="why" data-w="catExp">${money(te)}</span> <small>${esc(curSym(BASE()))}</small></span></summary><div class="acts" style="justify-content:flex-end"><button class="link" data-act="exportCats">⤓ ${t('export')}</button> · <button class="link" data-act="budget">${t('budget')}</button></div>
    <div class="list">${rows.length?rows.map(([id,v])=>{const lim=B(id),p=lim?v/lim:0;
      return `<div class="catbar tile" data-act="${catKids('expense',id).length?'catGroup':'stmtCat'}" data-id="${id}" data-ty="expense"><div class="l"><span>${esc(catName(id))}${catKids('expense',id).length?' ›':''}</span><span>${money(v)}${lim?` <span class="muted">/ ${money(lim)}</span>`:''} <span class="muted num">${te?Math.round(v/te*100):0}%</span></span></div>
      <div class="bar"><i class="${lim?(p>=1?'neg':p>=.8?'warn':''):''}" style="width:${lim?Math.min(100,p*100):v/mx*100}%"></i></div></div>`}).join(''):`<div class="empty">${t('noTx')}</div>`}</div></details>
  <details class="box" data-k="byMonth"><summary><h2>${per.mode==='month'?t('sixMonths'):t('byMonth')}</h2>${(()=>{const n=ms.length||1,ai=ms.reduce((v,o)=>v+o.i,0)/n,ae=ms.reduce((v,o)=>v+o.e,0)/n;return `<div class="sumline"><div>${t('avgIn')}<b class="pos"><span class="why" data-act="why" data-w="avgIn">${money(Math.round(ai))}</span></b></div><div>${t('avgOut')}<b><span class="why" data-act="why" data-w="avgOut">${money(Math.round(ae))}</span></b></div><div>${t('netShort')}<b class="${ai-ae<0?'neg':''}"><span class="why" data-act="why" data-w="avgNet">${money(Math.round(ai-ae))}</span></b></div></div>`})()}</summary>
    <div class="list" style="overflow-x:auto"><div class="cols" dir="ltr" style="grid-template-columns:repeat(${ms.length},minmax(18px,1fr))">${(S.lang==='ar'?[...ms].reverse():ms).map(o=>`<div class="c" title="${esc(monthLbl(o.m))}"><i class="a" style="height:${o.i/top*100}%"></i><i class="b" style="height:${o.e/top*100}%"></i></div>`).join('')}</div>
    <div class="colsx" dir="ltr" style="grid-template-columns:repeat(${ms.length},minmax(18px,1fr))">${(S.lang==='ar'?[...ms].reverse():ms).map(o=>`<span style="${per.mode==='month'&&o.m===cur?'color:var(--ink);font-weight:600':''}">${esc(colLbl(o.m,ms.length))}</span>`).join('')}</div>
    <div class="legend"><span style="--c:var(--accent)">${t('income')}</span><span style="--c:var(--neg)">${t('expense')}</span></div></div></details>
  ${catTotalsHTML('income')}
  ${tagsHTML()}
  ${netWorthHTML()}${zakatHTML()}`;
}
/* today's rates and a day-by-day list (from the saved daily rates) */
function ratesHTML(){
  const H=S.rateHist||{},days=Object.keys(H).sort().reverse().slice(0,60),cs=['USD','SAR','EUR','G21','G24'].filter(c=>c!==BASE()),nm=c=>isGold(c)?t('goldG')+' '+c.slice(1):c;
  const usd=d=>(H[d]||{}).USD||0,cell=(d,c)=>{const v=(H[d]||{})[c];return v?fmt(v):'—'};
  const now=c=>S.rates[c]?fmt(S.rates[c]):'—',g21u=S.rates.G21&&S.rates.USD?fmt(Math.round(S.rates.G21/S.rates.USD*100)/100):'—';
  return `<section class="sec"><div class="sec-h"><h2>💱 ${t('ratesT')}</h2><span class="muted">$ ${now('USD')} · ${t('goldG')} 21: ${now('G21')}</span></div>
    <p class="hint">${t('ratesHint')} ${S.ratesAt?t('ratesAtL')+' '+esc(dateOf(new Date(S.ratesAt)))+' '+hmOf(new Date(S.ratesAt)):''}${S.goldManual?' · '+t('goldManualOn'):''}</p>
    <div class="list"><div class="cmp h" style="grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr))"><span>${t('item')}</span><span>${esc(BASE())}</span><span>$</span></div>
      ${cs.map(c=>`<div class="cmp" style="grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr))"><span>${esc(nm(c))}${isGold(c)?' / '+t('gram'):''}</span><b>${now(c)}</b><span>${c==='USD'?'1':S.rates[c]&&S.rates.USD?fmt(Math.round(S.rates[c]/S.rates.USD*10000)/10000):'—'}</span></div>`).join('')}</div>
    ${S.rates.G24?(()=>{const g=S.rates.G24,u=S.rates.USD||0,gk=k=>S.rates['G'+k]||g*k/24,row=(l,v,s2)=>`<div class="cmp" style="grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr))"><span>${l}${s2?`<small class="muted" style="display:block;font-size:11px">${s2}</small>`:''}</span><b>${fmt(Math.round(v))}</b><span>${u?fmt(Math.round(v/u*100)/100):'—'}</span></div>`;
      return `<div class="grp" style="margin-top:8px;border-radius:12px 12px 0 0"><span>🪙 ${t('goldPrices')}</span></div><div class="list" style="border-radius:0 0 12px 12px">
        <div class="cmp h" style="grid-template-columns:minmax(0,1.2fr) repeat(2,minmax(0,1fr))"><span>${t('item')}</span><span>${esc(BASE())}</span><span>$</span></div>
        <div class="grp"><span>${t('perGram')}</span></div>
        ${[24,21,18,14].map(k=>row(t('goldK').replace('%k',k),gk(k))).join('')}
        ${row(t('ounce'),g*31.1035,'31.1 '+t('gram')+' · '+t('goldK').replace('%k',24))}
        <div class="grp"><span>${t('goldPound')} · ${t('goldK').replace('%k',21)}</span></div>
        ${row(t('goldPoundQ'),gk(21)*2,'2 '+t('gram'))}${row(t('goldPoundHalf'),gk(21)*4,'4 '+t('gram'))}${row(t('goldPound'),gk(21)*8,'8 '+t('gram'))}${row(t('goldPound5'),gk(21)*40,'40 '+t('gram'))}
        <div class="grp"><span>${t('bar').replace('%w','').trim()} · ${t('goldK').replace('%k',24)}</span></div>
        ${[0.25,0.5,1,2.5,5,10,15.55,20,25,31.1,50,100,250,1000].map(w=>row(w===31.1?t('barOz'):t('bar').replace('%w',w>=1000?'1 '+t('kilo'):w+' '+t('gram')),g*w,w===31.1?'31.1 '+t('gram'):'')).join('')}
      </div><p class="hint">${t('goldRawNote')}</p>`})():''}
    <div class="acts"><button class="btn sm pri" data-act="ratesNow">↻ ${t('ratesNow')}</button><button class="btn sm" data-act="rates">✎ ${t('ratesManual')}</button></div>
    ${days.length?`<div class="tblw" style="max-height:50vh"><table class="stmt"><thead><tr><th>${t('date')}</th>${cs.map(c=>`<th>${esc(nm(c))}</th>`).join('')}<th>${t('goldG')} 21 $</th></tr></thead><tbody>${days.map(d=>`<tr><td class="d">${esc(shortDate(d))}</td>${cs.map(c=>`<td class="n">${cell(d,c)}</td>`).join('')}<td class="n">${(H[d]||{}).G21&&usd(d)?fmt(Math.round(H[d].G21/usd(d)*100)/100):'—'}</td></tr>`).join('')}</tbody></table></div>`:`<p class="hint">${t('ratesNoHist')}</p>`}
    <p class="hint">${t('ratesMidNote')}</p></section>`;
}
let catOpen=new Set();
