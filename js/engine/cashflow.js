

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
/* expected cash events from today up to date d (same list the forecast uses) */
function evsUpTo(d,from){const out=[];if(d<=TODAY)return out;for(let m=TODAY_YM;m<=d.slice(0,7);m=ymAdd(m,1))remainingPlan(m).forEach(e=>{if(e.date<=d&&(!from||e.date>=from))out.push(Object.assign({m},e))});return out}
const fcHorizon=()=>{const endY=(+TODAY.slice(0,4)+1)+'-12';let m=TODAY_YM,n=0;while(m<endY&&n<35){m=ymAdd(m,1);n++}return m};
function monthSummary(m){
  const s0=m+'-01',open=liqAll(dayBefore(s0)),close=liqAll(monthEnd(m)>TODAY?TODAY:monthEnd(m)),ca=cashActual(txOf(m).filter(x=>x.date<=TODAY)),rows=[];
  const grp=(p,sign)=>Object.entries(ca).filter(([k])=>k.startsWith(p)).sort((a,b)=>b[1].v-a[1].v).map(([,x])=>['   '+x.label,sign*Math.round(x.v)]);
  const sm=p=>Object.entries(ca).filter(([k])=>k.startsWith(p)).reduce((v,[,x])=>v+x.v,0);
  const ii=sm('in:'),oo=sm('out:'),fi=sm('fi:')-sm('fo:'),xx=sm('xin:')-sm('xout:'),fx=close-open-(ii-oo)-fi-xx;
  rows.push([t('msOpen'),Math.round(open)],[t('msIn'),Math.round(ii)],...grp('in:',1),[t('msOut'),-Math.round(oo)],...grp('out:',-1));
  if(Math.abs(fi)>=1)rows.push([t('msFin'),Math.round(fi)]);if(Math.abs(xx)>=1)rows.push([t('msX'),Math.round(xx)]);if(Math.abs(fx)>=1)rows.push([t('msFx'),Math.round(fx)]);
  return {title:t('msTitle').replace('%m',monthLbl(m)),sub:BASE(),cols:[t('item'),t('amount')],rows,num:[1],foot:[[t('msClose'),Math.round(close)],[t('msNW'),Math.round(netWorth(monthEnd(m)>TODAY?TODAY:monthEnd(m)).net)]]};
}
