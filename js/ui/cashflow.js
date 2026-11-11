
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
/* one line of a breakdown: label, amount, and where tapping it goes */
function whyLine(x){const go=x.w?`data-act="why" data-w="${x.w}"`:x.act?`data-act="${x.act}" ${x.ty?`data-ty="${x.ty}"`:''} ${x.id?`data-id="${x.id}"`:''}`:'';
  return `<div class="row ${go?'tap':''}" ${go} ${x.total?'data-total="1"':''} style="padding:7px 12px"><div class="main"><span class="t" style="${x.strong?'font-weight:700':''}">${x.l}${go?' ›':''}</span>${x.s?`<span class="s">${x.s}</span>`:''}</div><b class="amt ${x.v<0?'neg':x.strong||x.plain?'':'pos'}">${x.strong||x.plain?money(x.v):(x.v<0?'− ':'+ ')+money(Math.abs(x.v))}</b></div>`}
function bridgeHTML(){
  const P=perCash(),rows=bridgeLines().map(whyLine).join('');
  return `<details class="box" data-k="bridge"><summary><h2>${t('perSummary')} <small class="muted" style="font-size:12px;font-weight:400">${t('cashBanks')}</small></h2><div class="sumline"><div>${P.fut?t('projStart'):t('openBal')}<b><span class="why" data-act="why" data-w="opening">${money(P.o)}</span></b></div><div>${t('movesNet')}<b class="${P.c-P.o<0?'neg':'pos'}"><span class="why" data-act="why" data-w="moves">${P.c-P.o<0?'− ':'+ '}${money(Math.abs(P.c-P.o))}</span></b></div><div>${P.proj?t('projEndS'):t('closeBal')}<b class="${P.c<0?'neg':''}"><span class="why" data-act="why" data-w="availEnd">${money(P.c)}</span></b></div></div></summary><div class="list">${rows}</div><p class="hint">${t('bridgeHint')}</p></details>`;
}
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
function vSet(){
  const chip=(ty,c)=>`<button class="chip" style="padding:4px 12px;background:none;cursor:pointer" data-act="editCat" data-ty="${ty}" data-id="${c.id}">${esc(cName(c))}</button>`;
  const chips=ty=>S.cats[ty].filter(c=>!c.parent).map(m=>{const kids=catKids(ty,m.id),op=catOpen.has(ty+m.id);
    return `<div class="row catrow"><button type="button" class="main tap" style="text-align:start;background:none;border:0;padding:0;font:inherit;color:inherit" data-act="editCat" data-ty="${ty}" data-id="${m.id}"><span class="t">${esc(cName(m))}${m.sys?' <small class="muted">🔒</small>':''}</span></button>${kids.length?`<button type="button" class="btn sm" data-act="catKidsT" data-id="${ty+m.id}">${kids.length} ${t('subW')} ${op?'▾':'▸'}</button>`:''}</div>${op?kids.map(k=>`<div class="row catrow sub"><button type="button" class="main tap" style="text-align:start;background:none;border:0;padding:0;font:inherit;color:inherit" data-act="editCat" data-ty="${ty}" data-id="${k.id}"><span class="t">↳ ${esc(cName(k))}</span></button></div>`).join(''):''}`}).join('');
  return `<section class="sec"><div class="sec-h"><h2>⚙️ ${t('general')}</h2><span class="muted">${esc(BASE())} · ${S.lang==='en'?'English':'عربي'}</span></div><div class="list">
    <div class="setrow"><span>${t('lang')}</span>${segHTML('lg',[['ar','عربي'],['en','English']],S.lang)}</div>
    <div class="setrow"><span>${t('baseCur')}</span><select class="in-f" id="cur" style="max-width:60%">${curOpts(BASE())}</select></div>
    <div class="setrow"><span>${t('defAcc')}</span><select class="in-f" id="defAcc" style="max-width:60%">${accOpts(S.defAcc)}</select></div>
  </div></section>
  ${ratesHTML()}
  ${S.quick.length?`<section class="sec"><div class="sec-h"><h2>${t('quickList')}</h2></div><div class="list"><div class="chips">${S.quick.map(q=>`<span class="chip">${esc(q.note||catName(q.cat))} · ${fmt(q.amount)}<button data-act="delQuick" data-id="${q.id}" aria-label="${t('del')}">×</button></span>`).join('')}</div></div></section>`:''}
  <section class="sec"><div class="sec-h"><h2>${t('cats')} · ${t('expense')}</h2><span class="muted">${S.cats.expense.filter(c=>!c.parent).length} · ${S.cats.expense.filter(c=>c.parent).length} ${t('subW')}</span></div><div class="list">${chips('expense')}<div class="row"><button class="link" data-act="addCat" data-ty="expense">+ ${t('addCat')}</button><button class="btn sm" data-act="catOrder" data-ty="expense" style="margin-inline-start:auto">↕ ${t('reorder')}</button></div></div></section>
  <section class="sec"><div class="sec-h"><h2>${t('cats')} · ${t('income')}</h2><span class="muted">${S.cats.income.filter(c=>!c.parent).length} · ${S.cats.income.filter(c=>c.parent).length} ${t('subW')}</span></div><div class="list">${chips('income')}<div class="row"><button class="link" data-act="addCat" data-ty="income">+ ${t('addCat')}</button><button class="btn sm" data-act="catOrder" data-ty="income" style="margin-inline-start:auto">↕ ${t('reorder')}</button></div></div></section>
  <section class="sec"><div class="sec-h"><h2>${t('account')}</h2></div><div class="list">
    <div class="setrow"><span>${REG?`<span dir="ltr">${esc(REG.email)}</span>`:t('notReg')}</span>${REG?`<button class="btn sm danger" data-act="unreg">${t('unreg')}</button>`:`<button class="btn sm pri" data-act="reg">${t('regBtn')}</button>`}</div>
    ${driveConfigured()?`<div class="setrow"><span>Google Drive</span>${drv.linked?`<span class="pill ok">${t('linkedOk')}</span>`:`<button class="btn sm pri" data-act="driveLink">${t('driveLink')}</button>`}</div>`:''}
    ${REG&&REG.admin?`<div class="setrow"><span>${t('usersHint2')}</span><button class="btn sm pri" data-act="users">${t('users')}</button></div>`:''}
  </div></section>
  <section class="sec"><div class="sec-h"><h2>Google Drive</h2><span class="pill ${drv.linked?'ok':''}">${drv.linked?t('driveLinked'):t('driveOff')}</span></div>
    <p class="hint">${driveConfigured()?t('driveHint'):t('driveNotSetup')}</p>
    ${driveConfigured()?(drv.linked?`<div class="list"><div class="setrow stack"><span class="label">${t('driveAccount')}</span><b class="num" dir="ltr" style="align-self:stretch;text-align:start;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${drv.email?esc(drv.email):`<span class="muted" style="font-weight:400">${t('loading')}</span>`}</b></div></div>
      <p class="hint">${t('msHint')}</p><div class="acts"><button class="btn" data-act="monthSum">${t('msBtn')}</button></div>
      <div class="acts"><button class="btn" data-act="driveRestore">${t('driveRestore')}</button><button class="btn" data-act="driveSwitch">${t('driveSwitch')}</button><button class="btn danger" data-act="driveUnlink">${t('driveUnlink')}</button></div>
      <p class="hint">${t('driveLast')}: ${esc(driveLastLbl())} · ${t('driveKeep')}</p>`:`<div class="acts"><button class="btn pri" data-act="driveLink">${t('driveLink')}</button></div>`):''}
  </section>
  <section class="sec"><button class="btn block" data-act="shareApp">${t('shareApp')}</button></section>
  ${installEvt?`<section class="sec"><button class="btn pri block" data-act="install">${t('install')}</button></section>`:''}
  <section class="sec"><div class="sec-h"><h2>${t('remindersT')}</h2><span class="pill ${pushOn()?'ok':''}">${pushOn()?t('on'):t('off')}</span></div>
    <p class="hint">${pushSupported()?t('remHint'):t('pushUnsupported')}</p>
    ${pushSupported()?(()=>{const rt=remTime();return `<div class="two"><label class="fld"><span>${t('remAt')}</span><input class="in-f num" type="time" step="900" id="remHm" value="${hmStr(rt.hm)}"></label>
      <label class="fld"><span>${t('remLead')}</span><select class="in-f" id="remLead">${[0,1,2,3,7].map(d=>`<option value="${d}" ${rt.lead===d?'selected':''}>${t('lead'+d)}</option>`).join('')}</select></label></div>`})():''}
    ${pushSupported()?`<div class="acts">${pushOn()?`<button class="btn" data-act="pushTest">${t('pushTestBtn')}</button><button class="btn danger" data-act="pushOff">${t('turnOff')}</button>`:`<button class="btn pri" data-act="pushOn">${t('turnOn')}</button>`}</div>`:''}
    ${(()=>{const u=upcomingReminders(PS).slice(0,4);return u.length?`<div class="list">${u.map(x=>`<div class="row"><div class="main"><span class="t">${esc(x.title)}</span><span class="s">${esc(shortDate(x.date))} · ${esc(x.body)}</span></div></div>`).join('')}</div>`:''})()}
  </section>
  <section class="sec"><div class="sec-h"><h2>${t('security')}</h2></div><p class="hint">${t('autoLockHint')}</p>
    <div class="list"><div class="setrow"><span>${t('bioOn')}</span>${bioInfo()?`<button class="btn sm danger" data-act="bioOff">${t('turnOff')}</button>`:`<button class="btn sm pri" data-act="bioOn">${t('turnOn')}</button>`}</div></div>
    <div class="acts"><button class="btn" data-act="changePin">${t('changePin')}</button><button class="btn" data-act="lockNow">${t('lockNow')}</button></div></section>
  <section class="sec"><div class="sec-h"><h2>${t('backup')}</h2><span class="muted">${t('lastBackup')}: ${esc(lastBackupLbl())}</span></div>
    <p class="hint">${t('storageHint')} ${t('encHint')}</p>
    <div class="list">
      <label class="setrow chk" style="justify-content:space-between"><span>${t('autoDl')}<br><span class="hint">${t('autoDlHint')}</span></span><input type="checkbox" id="autoDl" ${S.autoDl?'checked':''}></label>
    </div>
    ${drv.linked?'':`<button class="btn block" data-act="shareDrive">${t('shareDrive')}</button>
    <p class="hint">${t('shareHint')}</p>`}
    <div class="acts"><button class="btn" data-act="export">${t('dlNow')}</button><button class="btn" data-act="copyBackup">${t('copyText')}</button><button class="btn" data-act="import">${t('importB')}</button><button class="btn" data-act="importX">${t('importX')}</button></div>
    <button class="btn block" data-act="reviewExport" style="margin-top:8px">🔍 ${t('reviewExport')}</button></section>
  <section class="sec"><div class="sec-h"><h2>🧾 ${t('logT')}</h2><span class="muted">${(S.log||[]).length}</span></div><p class="hint">${t('logHint')}</p>
    <div class="list">${(S.log||[]).slice(-60).reverse().map(l=>{const x=l.a||l.b,lb={add:t('logAdd'),edit:t('logEdit'),del:t('logDel')}[l.act];const ch=l.act==='edit'&&l.b&&l.a?[l.b.a!==l.a.a?fmt(l.b.a)+' → '+fmt(l.a.a):'',l.b.d!==l.a.d?shortDate(l.b.d)+' → '+shortDate(l.a.d):'',l.b.c!==l.a.c?catName(l.b.c)+' → '+catName(l.a.c):'',l.b.acc!==l.a.acc?((accById(l.b.acc)||{}).name||'')+' → '+((accById(l.a.acc)||{}).name||''):''].filter(Boolean).join(' · '):'';
      return `<div class="row ${l.act!=='del'&&S.tx.some(y=>y.id===l.id)?'tap':''}" ${l.act!=='del'&&S.tx.some(y=>y.id===l.id)?`data-act="openTx" data-id="${l.id}"`:''} style="padding:6px 12px"><div class="main"><span class="t" style="font-size:13px">${lb} · ${esc(x.n||catName(x.c))}</span><span class="s">${esc(dateOf(new Date(l.at)))} ${hmOf(new Date(l.at))}${ch?' · '+esc(ch):' · '+esc(shortDate(x.d))}</span></div><b class="amt ${l.act==='del'?'neg':''}">${fmt(x.a)}</b></div>`}).join('')||`<div class="empty">${t('noItems')}</div>`}</div></section>
  <section class="sec"><button class="btn danger block" data-act="reset">${t('reset')}</button></section>
  <p class="hint" style="text-align:center">Daftari v${APP_VER} · <button class="link" data-act="appUpdate" style="font-size:inherit">${t('appUpdate')}</button> · <a href="privacy.html" style="color:var(--accent)">${lng()==='en'?'Privacy policy':'سياسة الخصوصية'}</a></p>`;
}
