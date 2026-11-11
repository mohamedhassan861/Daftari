
function stmtSheet(o){
  /* kinds: acc → balance = opening + in − out (معايا/عليا); person → out − in (ليك/عليك); flow → running total */
  o.rows.sort(byDate);
  let bal=o.opening||0,tdr=0,tcr=0;
  const lbl=v=>o.kind==='acc'?(v>=0?t('crBal'):t('drBal')):o.kind==='person'?(v>0.004?t('drPerson'):v<-0.004?t('crPerson'):t('settledBal')):'';
  const out=[],lim=o.acc&&o.acc.type==='card'&&+o.acc.limit>0?+o.acc.limit:0,avail=v=>lim?lim+Math.min(0,v)+Math.max(0,v):null,dm=d=>d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4);
  const isCard=o.acc&&o.acc.type==='card';
  const balTxt=v=>isCard?`<span class="balaft">${v<0?t('stOwe'):t('stCredit')} ${fmt(Math.abs(v))}</span>${lim?` · <span class="gnum">${t('cardAvail')} ${fmt(avail(v))}</span>`:''}`
    :o.kind==='person'?`<span class="balaft">${t('balCol')} ${fmt(Math.abs(v))} · ${esc(lbl(v).split(' · ').pop())}</span>`:`<span class="balaft">${o.kind==='flow'?t('total'):t('balCol')} ${v<0?'−':''}${fmt(Math.abs(v))}</span>`;
  const body=o.rows.map(r=>{tdr+=r.dr||0;tcr+=r.cr||0;
    bal=o.kind==='acc'?bal+(r.cr||0)-(r.dr||0):o.kind==='person'?bal+(r.dr||0)-(r.cr||0):bal+(r.dr||0)+(r.cr||0);
    out.push({date:r.date,desc:r.desc,dr:r.dr,cr:r.cr,bal,lbl:lbl(bal),av:avail(bal)});
    return `<div class="row srow ${r.tx?'tap':''}" ${r.tx?`data-sact="tx" data-id="${r.tx}"`:''}><div class="main"><span class="t">${esc(r.desc)}</span><span class="s">${esc(dm(r.date))}</span><span class="s">${balTxt(bal)}</span></div><b class="amt ${r.cr?'pos':'neg'}">${r.cr?'+'+fmt(r.cr):'−'+fmt(r.dr||0)}</b></div>`}).join('');
  const sym=esc(curSym(o.cur||BASE()));
  lastStmt=Object.assign({},o,{out,tdr,tcr,bal,lblEnd:lbl(bal)});
  if(o.kind!=='flow')out.unshift({date:'',desc:t('openBal'),dr:'',cr:'',bal:o.opening||0,lbl:lbl(o.opening||0)});
  openSheet(o.title,`<div class="form stmtf">
    <div class="stmtbar"><span class="hint" style="margin:0">${esc(o.sub||'')}${o.cur&&o.cur!==BASE()?' · '+esc(curName(o.cur)):''}</span><button type="button" class="btn sm" data-sact="export">⤓ ${t('export')}</button></div>
    <div class="sumgrid stmtsum">
      ${o.kind==='flow'?'':`<div><span class="label">${t('openBal')}</span><b class="num">${fmt(Math.abs(o.opening||0))} <small class="cur">${sym}</small></b><span class="label">${lbl(o.opening||0)}</span></div>`}
      <div><span class="label">${t('totDr')}</span><b class="num">${fmt(tdr)} <small class="cur">${sym}</small></b></div>
      <div><span class="label">${t('totCr')}</span><b class="num">${fmt(tcr)} <small class="cur">${sym}</small></b></div>
      <div><span class="label">${o.kind==='flow'?(o.totalLabel||t('total')):t('closeBal')}</span><b class="num">${fmt(Math.abs(bal))} <small class="cur">${sym}</small></b>${o.kind==='flow'?'':`<span class="label">${lbl(bal)}</span>`}</div>
      ${o.extra||''}
    </div>
    ${o.kind==='acc'?`<p class="hint" data-eq="1" style="margin:0">${t('stmtEq')}: ${fmt(o.opening||0)} + ${fmt(tcr)} − ${fmt(tdr)} = <b>${fmt(bal)}</b></p>`:o.kind==='person'?`<p class="hint" data-eq="1" style="margin:0">${t('stmtEqP')}: ${fmt(o.opening||0)} + ${fmt(tdr)} − ${fmt(tcr)} = <b>${fmt(bal)}</b></p>`:''}
    ${o.acc?`<button type="button" class="btn sm" style="align-self:flex-start" data-sact="recon" data-id="${o.acc.id}">⚖️ ${t('reconcile')}</button>`:''}
    <div class="list stmtl">${o.kind!=='flow'?`<div class="row srow open"><div class="main"><span class="t">${t('openBal')}</span><span class="s">${balTxt(o.opening||0)}</span></div></div>`:''}${body||`<div class="empty">${t('noMoves')}</div>`}</div>
  </div>`);
}
function finHTML(tx){const f=tx.filter(x=>x.type!=='transfer'&&isFin(x));if(!f.length)return '';const fi=sumB(f.filter(x=>x.type==='income')),fo=sumB(f.filter(x=>x.type==='expense'));
  return `<div class="row tap" data-act="stmtFin" style="padding:6px 14px 10px"><div class="main"><span class="t" style="font-size:13px">🤝 ${t('finTitle')} ›</span><span class="s">${t('finHint')}</span></div><span class="muted" style="font-size:12px;text-align:end">${t('finIn')} <b class="pos">${money(fi)}</b><br>${t('finOut')} <b>${money(fo)}</b></span></div>`}
function catGroupSheet(ty,id){
  const kids=catKids(ty,id),tx=txIn().filter(x=>x.type===ty);
  const direct=sumB(tx.filter(x=>x.cat===id)),tot=sumB(tx.filter(x=>inCat(x,id)));
  const row=(cid,label,v,cls)=>`<div class="row tap ${cls||''}" data-sact="cat" data-id="${cid}"><div class="main"><span class="t">${esc(label)}</span></div><b class="amt">${money(v)}</b></div>`;
  openSheet(catName(id),`<div class="form"><p class="hint">${perLabel()} · ${t('total')}: ${fmt(tot)} ${esc(curSym(BASE()))}</p><div class="list">
    ${row(id,t('allOf')+' '+catName(id),tot)}
    ${kids.map(k=>row(k.id,cName(k),sumB(tx.filter(x=>x.cat===k.id)),'sub')).join('')}
    ${direct?row(id,catName(id)+' ('+t('direct')+')',direct,'sub'):''}
  </div></div>`);
}
function oblStmt(k,id){
  const o=(k==='inst'?S.inst:S.gam).find(x=>x.id===id);if(!o)return;const cc=o.currency||BASE(),per1=oblPer(k,o),rows=[];
  const linked=S.tx.filter(x=>x.link&&x.link.id===id&&(x.link.k===k||(k==='gam'&&x.link.k==='gamr')));
  const covered=new Set();
  linked.forEach(x=>{if(x.link.k==='gamr'){rows.push({date:x.date,desc:t('payout'),dr:0,cr:+x.amount,tx:x.id});return}
    const al=x.link.alloc||(x.link.ym?{[x.link.ym]:per1}:{});Object.keys(al).forEach(m=>covered.add(m));
    rows.push({date:x.date,desc:t('payFor')+' '+Object.keys(al).map(monthLbl).join('، '),dr:+x.amount,cr:0,tx:x.id})});
  const wv=o.waived||{};
  o.paid.filter(m=>!covered.has(m)).forEach(m=>{const v=Math.round((per1-(+wv[m]||0))*100)/100;if(v>0.004)rows.push({date:m+'-01',desc:t('payFor')+' '+monthLbl(m)+' ('+t('beforeApp')+')',dr:v,cr:0})});
  Object.entries(o.part||{}).filter(([m])=>!o.paid.includes(m)&&!covered.has(m)&&+o.part[m]>0).forEach(([m,v])=>rows.push({date:m+'-01',desc:t('partPaid')+' · '+monthLbl(m)+' ('+t('beforeApp')+')',dr:+v,cr:0}));
  if(k==='gam'&&o.received&&!linked.some(x=>x.link.k==='gamr'))rows.push({date:gamPayout(o)+'-01',desc:t('payout'),dr:0,cr:o.share*o.members});
  const total=per1*oblMonths(k,o).length;
  stmtSheet({title:o.name,sub:(k==='inst'?t('installments'):t('gameyas'))+' · '+plainGroup(o),cur:cc,kind:'flow',rows,totalLabel:t('paidLbl'),
    extra:`<div><span class="label">${t('total')}</span><b class="num">${fmt(total)}</b></div><div><span class="label">${t('remaining')}</span><b class="num">${fmt(oblLeft(k,o))}</b></div>${oblWaived(k,o)>0.004?`<div><span class="label">${t('waivedLbl')}</span><b class="num">${fmt(oblWaived(k,o))}</b></div>`:''}`});
}
/* reconcile: book balance vs actual */
function recForm(a){
  const book=accBalance(a),same=S.accounts.filter(x=>x.id!==a.id&&x.currency===a.currency),bankish=a.type==='bank'||a.type==='card',isC=a.type==='card';let neg=!isC&&book<0;
  openSheet(t('reconcile')+' · '+a.name+' '+a.currency,`<form class="form" id="f">
    <div class="sumgrid"><div><span class="label">${isC?t('reconCardBook'):t('bookBal')}</span><b class="num">${fmt(isC?-book:book)} <small class="cur">${esc(curSym(a.currency))}</small></b></div><div><span class="label">${t('diff')}</span><b class="num" id="df">—</b></div></div>
    <label class="fld"><span>${isC?t('reconCardAct'):t('actualBal')}</span><span style="display:flex;gap:8px">${isC?'':`<button type="button" class="btn" id="sg" style="min-width:56px;font-size:20px" aria-label="sign">${neg?'−':'+'}</button>`}<input class="in-f amt num" id="ac" inputmode="decimal" autocomplete="off" style="flex:1"></span></label>
    ${isC?`<p class="hint" style="margin:0">${t('reconCardTip')}</p>`:`<p class="hint" style="margin:0">${t('reconSignTip')}</p>`}
    <div id="opts" class="form" hidden>
      <p class="hint" id="dh"></p>
      ${same.length?segHTML('how',[['cat',t('postCat')],['tr',t('postTr')]],'cat'):''}
      <label class="fld" id="catW"><span>${t('category')}</span><select class="in-f" id="rc"></select></label>
      ${same.length?`<label class="fld" id="trW" hidden><span id="trL"></span><select class="in-f" id="ra">${same.map(x=>`<option value="${x.id}">${esc(x.name)} · ${x.currency}</option>`).join('')}</select></label>`:''}
      <label class="fld"><span>${t('note')}</span><input class="in-f" id="nt" value="${esc(t('recNote'))}"></label>
    </div>
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    let how='cat',diff=0;const $r=q=>r.querySelector(q);
    if(same.length)bindSeg(r,'how',v=>{how=v;$r('#catW').hidden=v!=='cat';$r('#trW').hidden=v!=='tr'});
    const sg=$r('#sg');if(sg)sg.onclick=()=>{neg=!neg;sg.textContent=neg?'−':'+';upd()};
    const upd=()=>{const v=normDigits($r('#ac').value.trim()).replace(/,/g,'');if(v===''){$r('#df').textContent='—';$r('#opts').hidden=true;return}
      let n=Math.abs(parseFloat(v.replace(/^[-−]/,''))||0);if(/^[-−]/.test(v)&&!isC&&!neg){neg=true;if(sg)sg.textContent='−'}const target=isC?-n:(neg?-n:n);
      diff=Math.round((target-book)*100)/100;
      {const dd=isC?-diff:diff;$r('#df').textContent=diff===0?t('matched'):(dd>0?'+':'−')+fmt(Math.abs(dd))}
      $r('#opts').hidden=diff===0;if(diff===0)return;
      const ty=diff<0?'expense':'income',def=diff<0?(bankish?'bankfees':'adjust'):(bankish?'interest':'iadjust');
      $r('#dh').textContent=isC?(diff<0?t('reconCardMore'):t('reconCardLess')):(diff<0?t('diffLess'):t('diffMore'));
      $r('#rc').innerHTML=catOptsTree(ty,def,true);
      if(same.length)$r('#trL').textContent=diff<0?t('wentTo'):t('cameFrom');
    };
    $r('#ac').oninput=upd;setTimeout(()=>$r('#ac').focus(),50);
    $r('#f').onsubmit=e=>{e.preventDefault();upd();if($r('#ac').value.trim()===''){toast(t('needAmt'));return}
      if(diff===0){closeSheet();toast(t('matched'));return}
      const amt=Math.abs(diff),note=val(r,'nt');
      if(how==='tr'){const o=val(r,'ra');S.tx.push(diff<0?{id:uid(),type:'transfer',acc:a.id,toAcc:o,amount:amt,toAmount:amt,cat:'transfer',date:TODAY,note}:{id:uid(),type:'transfer',acc:o,toAcc:a.id,amount:amt,toAmount:amt,cat:'transfer',date:TODAY,note})}
      else S.tx.push({id:uid(),type:diff<0?'expense':'income',acc:a.id,cat:val(r,'rc'),amount:amt,date:TODAY,note});
      closeSheet();commit(t('saved'));
    };
  });
}
/* month-end reconciliation: the balance the bank app / your wallet / the card statement shows against the book, for all accounts at once */
/* the order of groups (banks, cash, cards…) and of the accounts inside each one; it is the order of S.accounts */
/* one ordering screen for everything: groups move with ▲▼, and so do the items inside each group; saving rewrites the array order */
function orderSheet(title,G,save,hint){
  const btn=(act,i,j,dis,lbl)=>`<button type="button" class="btn sm" data-o="${act}" data-i="${i}" data-j="${j}" ${dis?'disabled style="opacity:.35"':''}>${lbl}</button>`,one=G.length<2;
  const draw=r=>{r.querySelector('#ol').innerHTML=G.map((g,i)=>(one&&!g.g?'':`<div class="grp" style="display:flex;align-items:center;gap:6px"><span style="flex:1">${esc(g.g)}</span>${one?'':btn('gu',i,0,i===0,'▲')+btn('gd',i,0,i===G.length-1,'▼')}</div>`)+
    g.items.map((x,j)=>`<div class="row" style="gap:6px"><div class="main"><span class="t">${esc(x.n)}</span>${x.s?`<span class="s">${esc(x.s)}</span>`:''}</div>${btn('nu',i,j,j===0,'▲')}${btn('nd',i,j,j===g.items.length-1,'▼')}</div>`).join('')).join('')};
  openSheet(t('reorder')+' · '+title,`<div class="form"><p class="hint">${hint||t('reorderHint2')}</p><div class="list" id="ol"></div><div class="foot"><button type="button" class="btn pri grow" id="os">${t('save')}</button></div></div>`,r=>{
    draw(r);
    r.querySelector('#ol').onclick=e=>{const b=e.target.closest('[data-o]');if(!b||b.disabled)return;const i=+b.dataset.i,j=+b.dataset.j,sw=(a,x,y)=>{[a[x],a[y]]=[a[y],a[x]]};
      if(b.dataset.o==='gu')sw(G,i,i-1);else if(b.dataset.o==='gd')sw(G,i,i+1);else if(b.dataset.o==='nu')sw(G[i].items,j,j-1);else sw(G[i].items,j,j+1);draw(r)};
    r.querySelector('#os').onclick=()=>{save(G.flatMap(g=>(g.ids||[]).concat(g.items.flatMap(x=>x.ids))));closeSheet();commit(t('saved'))};
  });
}
function accOrderSheet(){
  const G=[...groupsOf(S.accounts,accGroup)].map(([g,accs])=>({g,items:[...groupsOf(accs,a=>a.name)].map(([n,l])=>({n,s:l.map(a=>a.currency).join(' · '),ids:l.map(a=>a.id)}))}));
  orderSheet(t('accounts'),G,ids=>{S.accounts=byRank(S.accounts,ids,a=>a.id)},t('reorderHint'));
}
function catOrderSheet(ty){
  const G=S.cats[ty].filter(c=>!c.parent).map(m=>({g:cName(m),ids:[m.id],items:catKids(ty,m.id).map(k=>({n:cName(k),ids:[k.id]}))}));
  orderSheet(t('cats')+' · '+t(ty),G,ids=>{S.cats[ty]=byRank(S.cats[ty],ids,c=>c.id)},t('reorderCatHint'));
}
function oblOrderSheet(k){
  const L=k==='inst'?S.inst:k==='gam'?S.gam:k==='loan'?S.loans:S.goals,nm=o=>k==='loan'?o.person:o.name,sub=o=>k==='loan'?(o.dir==='lent'?t('lentTo'):t('borrowedFrom'))+' · '+fmt(+o.amount):'';
  const G=k==='goal'?[{g:'',items:L.map(o=>({n:nm(o),ids:[o.id]}))}]:[...groupsOf(L,plainGroup)].map(([g,l])=>({g,items:l.map(o=>({n:nm(o),s:sub(o),ids:[o.id]}))}));
  orderSheet({inst:t('installments'),gam:t('gameyas'),loan:t('loans'),goal:t('goals')}[k],G,ids=>{const v=byRank(L,ids,o=>o.id);if(k==='inst')S.inst=v;else if(k==='gam')S.gam=v;else if(k==='loan')S.loans=v;else S.goals=v});
}
function reconAllSheet(){
  const accs=S.accounts.filter(a=>isLiquid(a)||a.type==='card'),isC=a=>a.type==='card';
  const shown=a=>isC(a)?-accBalance(a):accBalance(a),lastOf=a=>(S.recons||[]).filter(r=>r.acc===a.id).slice(-1)[0];
  const defCat=(a,d)=>d<0?(a.type==='cash'?'adjust':'bankfees'):(a.type==='bank'?'interest':'iadjust');
  openSheet(t('reconAll'),`<form class="form" id="f"><p class="hint">${t('reconAllHint')}</p>
    <div class="list">${accs.map(a=>{const l=lastOf(a);return `<div class="row" style="flex-wrap:wrap;gap:6px" data-r="${a.id}">
      <div class="main" style="min-width:55%"><span class="t">${esc(a.name)} <small class="muted">${esc(a.currency)}</small></span>
      <span class="s">${isC(a)?t('reconCardBook'):t('bookBal')}: <b class="num">${fmt(shown(a))}</b></span>${l?'<span class="s">'+t('reconLast')+' '+esc(l.date.slice(8,10)+'/'+l.date.slice(5,7)+'/'+l.date.slice(0,4))+(Math.abs(l.diff)>0.004?' ('+(l.diff>0?'+':'−')+fmt(Math.abs(l.diff))+')':' ✓')+'</span>':''}</div>
      <input class="in-f num" style="flex:1;min-width:110px" inputmode="decimal" autocomplete="off" data-in="${a.id}" placeholder="${isC(a)?t('reconCardAct'):t('actualBal')}">
      <span class="s" style="flex-basis:100%" data-d="${a.id}"></span>
      <select class="in-f" data-c="${a.id}" hidden style="flex-basis:100%"></select></div>`}).join('')}</div>
    <div class="foot"><button class="btn pri grow">${t('reconSave')}</button></div>
    ${(S.recons||[]).length?`<details><summary>${t('reconHist')} ›</summary><div class="list">${(S.recons||[]).slice(-30).reverse().map(r=>{const a=accById(r.acc);return `<div class="row"><div class="main"><span class="t">${esc(a?a.name+' '+a.currency:'—')}</span><span class="s">${esc(shortDate(r.date))} · ${t('bookBal')} ${fmt(r.book)} · ${t('actualBal')} ${fmt(r.actual)}</span></div><b class="amt ${Math.abs(r.diff)<0.005?'pos':'neg'}">${Math.abs(r.diff)<0.005?'✓':(r.diff>0?'+':'−')+fmt(Math.abs(r.diff))}</b></div>`}).join('')}</div></details>`:''}</form>`,r=>{
    const diffOf=a=>{const i=r.querySelector(`[data-in="${a.id}"]`),v=i.value.trim();if(v==='')return null;const n=parseFloat(normDigits(v).replace(/,/g,''));if(isNaN(n))return null;
      const target=isC(a)?-n:n;return Math.round((target-accBalance(a))*100)/100};
    accs.forEach(a=>{const i=r.querySelector(`[data-in="${a.id}"]`),dEl=r.querySelector(`[data-d="${a.id}"]`),sel=r.querySelector(`[data-c="${a.id}"]`);
      i.oninput=()=>{const d=diffOf(a);if(d===null){dEl.textContent='';sel.hidden=true;return}
        if(Math.abs(d)<0.005){dEl.innerHTML=`<span class="pos">✓ ${t('matched')}</span>`;sel.hidden=true;return}
        const more=isC(a)?d<0:d>0;const dd=isC(a)?-d:d;dEl.innerHTML=`<span class="neg">${t('diff')}: ${dd>0?'+':'−'}${fmt(Math.abs(dd))}</span> · ${isC(a)?(more?t('reconCardMore'):t('reconCardLess')):(more?t('diffMore'):t('diffLess'))}`;
        const ty=d<0?'expense':'income',want=sel.dataset.ty!==ty;if(want){sel.innerHTML=catOptsTree(ty,defCat(a,d),true);sel.dataset.ty=ty}sel.hidden=false}});
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();let n=0,adj=0;S.recons=S.recons||[];
      accs.forEach(a=>{const d=diffOf(a);if(d===null)return;n++;const book=shown(a),actual=book+(isC(a)?-d:d),rec={id:uid(),date:TODAY,acc:a.id,book,actual,diff:isC(a)?-d:d};
        if(Math.abs(d)>=0.005){const sel=r.querySelector(`[data-c="${a.id}"]`),tx={id:uid(),type:d<0?'expense':'income',acc:a.id,cat:sel.value||defCat(a,d),amount:Math.abs(d),date:TODAY,note:t('recNote')};S.tx.push(tx);rec.tx=tx.id;adj++}
        S.recons.push(rec)});
      if(!n){toast(t('needAmt'));return}
      S.recons=S.recons.slice(-200);closeSheet();commit(adj?t('reconDoneAdj').replace('%n',adj):t('reconDoneOk'));
    };
  });
}
