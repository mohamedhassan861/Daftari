/* ---------- obligations logic ---------- */
const instMonths=it=>Array.from({length:it.count},(_,i)=>ymAdd(it.start,i));
const instNext=it=>instMonths(it).find(m=>!it.paid.includes(m))||null;
const gamMonths=g=>Array.from({length:g.members},(_,i)=>ymAdd(g.start,i));
const gamNext=g=>gamMonths(g).find(m=>!g.paid.includes(m))||null;
const gamPayout=g=>ymAdd(g.start,g.myTurn-1);

const oblPer=(k,o)=>k==='inst'?+o.monthly:+o.share;
const oblMonths=(k,o)=>k==='inst'?instMonths(o):gamMonths(o);
const partOf=(o,m)=>+((o.part||{})[m]||0);
const paidAmt=(k,o)=>o.paid.length*oblPer(k,o)+Object.entries(o.part||{}).filter(([m])=>!o.paid.includes(m)).reduce((v,[,a])=>v+(+a||0),0);
/* cancelled rests are recorded when you choose "cancel the rest"; money paid = marked paid/partly paid less what was cancelled */
const oblWaived=(k,o)=>Math.round(Object.entries(o.waived||{}).filter(([m])=>o.paid.includes(m)).reduce((v,[,a])=>v+(+a||0),0)*100)/100;
function oblPaidReal(k,o,upto){const after=upto?S.tx.filter(x=>x.link&&x.link.k===k&&x.link.id===o.id&&x.date>upto).reduce((v,x)=>v+(+x.amount||0),0):0;return Math.max(0,paidAmt(k,o)-oblWaived(k,o)-after)}
const oblLeft=(k,o)=>oblPer(k,o)*oblMonths(k,o).length-paidAmt(k,o);
/* what is still owed for months up to ym */
const effM=(o,m)=>(o.moved&&o.moved[m])||m;
function owedUpTo(k,o,ym){return oblMonths(k,o).filter(m=>effM(o,m)<=ym&&!o.paid.includes(m)).reduce((v,m)=>v+oblPer(k,o)-partOf(o,m),0)}
function dueFor(ym){
  const out=[];
  [['inst',S.inst],['gam',S.gam]].forEach(([k,list])=>list.forEach(o=>{
    const un=oblMonths(k,o).filter(m=>effM(o,m)<=ym&&!o.paid.includes(m));
    if(un.length)out.push({k,id:o.id,name:o.name,cur:o.currency,amount:owedUpTo(k,o,ym),late:un.filter(m=>effM(o,m)<ym).length,ym:effM(o,un[0]),partial:un.some(m=>partOf(o,m)>0)});
    if(k==='gam'&&!o.received&&gamPayout(o)<=ym)out.push({k:'gamr',id:o.id,name:o.name,cur:o.currency,amount:o.share*o.members,late:0,ym:gamPayout(o)});
  }));
  return out;
}
/* spread a payment over the oldest unpaid months */
function allocate(k,o,amt){
  const per=oblPer(k,o),alloc={};o.part=o.part||{};
  for(const m of oblMonths(k,o).slice().sort((a,b)=>effM(o,a).localeCompare(effM(o,b))||a.localeCompare(b))){
    if(amt<=0.004)break;if(o.paid.includes(m))continue;
    const take=Math.min(per-partOf(o,m),amt);if(take<=0)continue;
    alloc[m]=Math.round(take*100)/100;o.part[m]=partOf(o,m)+take;amt-=take;
    if(o.part[m]>=per-0.004){o.paid.push(m);delete o.part[m]}
  }
  return alloc;
}
function remBlock(ym,allowDrop){
  const base=ym>TODAY_YM?ym:TODAY_YM,opts=Array.from({length:6},(_,i)=>ymAdd(base,i+1));
  return `<div id="remW" class="blk" hidden style="padding-bottom:8px"><div class="blk-h"><span>${t('remQ')}</span><b id="remV"></b></div><div style="padding:0 12px">
    <select class="in-f" id="remA"><option value="keep">${t('remKeep')}</option>${opts.map(x=>`<option value="${x}">${t('moveTo')} ${esc(monthLbl(x))}</option>`).join('')}${allowDrop?`<option value="drop">${t('remDrop')}</option>`:''}</select></div></div>`;
}
function bindRem(r,due){const w=r.querySelector('#remW'),v=r.querySelector('#remV'),rem=()=>Math.round((due-numv(r,'amt'))*100)/100;
  const upd=()=>{const x=rem();w.hidden=!(numv(r,'amt')>0&&x>0.004);v.textContent=fmt(x)};r.querySelector('#amt').addEventListener('input',upd);upd();
  return ()=>{const x=rem();return x>0.004?{rem:x,act:val(r,'remA')}:null}}
function payForm(k,id,recv){
  const list=k==='inst'?S.inst:S.gam,o=list.find(x=>x.id===id);if(!o)return;
  const cc=o.currency||BASE(),accs=S.accounts.filter(a=>a.currency===cc);
  if(!accs.length){toast(t('needAccCur')+' '+cc);return}
  const left=recv?o.share*o.members:Math.round(oblLeft(k,o)*100)/100;
  const def=recv?left:Math.round((owedUpTo(k,o,cur>TODAY_YM?cur:TODAY_YM)||Math.min(oblPer(k,o)-partOf(o,oblMonths(k,o).find(m=>!o.paid.includes(m))||''),left))*100)/100;
  const pa=(o.payWith&&accs.some(a=>a.id===o.payWith))?o.payWith:(payAcc(cc)||accs[0].id);
  openSheet((recv?t('collectPay'):t('pay'))+' · '+o.name,`<form class="form" id="f">
    ${recv?'':`<div class="sumgrid"><div><span class="label">${t('dueNow')}</span><b class="num">${fmt(def)} <small class="cur">${esc(curSym(cc))}</small></b></div><div><span class="label">${t('remainingAll')}</span><b class="num">${fmt(left)} <small class="cur">${esc(curSym(cc))}</small></b></div></div>`}
    <label class="fld"><span>${t('amountPaid')} (${esc(curName(cc))})</span><input class="in-f amt num" id="amt" inputmode="decimal" value="${def}"></label>
    <label class="fld"><span>${recv?t('toAcc'):t('fromAcc')}</span><select class="in-f" id="acc">${accs.map(a=>`<option value="${a.id}" ${a.id===pa?'selected':''}>${esc(a.name)} · ${a.currency}</option>`).join('')}</select></label>
    <label class="fld"><span>${t('date')}</span><input class="in-f" type="date" id="dt" value="${TODAY}"></label>
    ${recv?'':remBlock(cur>TODAY_YM?cur:TODAY_YM,true)}
    <div class="foot"><button class="btn pri grow">${t('save')}</button></div>
    ${recv||def<=0.004?'':`<button type="button" class="btn block" id="wv" style="color:var(--neg)">✕ ${t('waiveBtn').replace('%v',fmt(def))}</button>${left>def+0.004?`<button type="button" class="btn block" id="wvA" style="color:var(--neg)">✕ ${t('waiveAll').replace('%v',fmt(left))}</button>`:''}<p class="hint" style="margin:0">${t('waiveHint')}</p>`}</form>`,r=>{
    const doW=all=>{const ym=cur>TODAY_YM?cur:TODAY_YM,ms=oblMonths(k,o).filter(m=>(all||effM(o,m)<=ym)&&!o.paid.includes(m));if(!ms.length)return;const amt=all?left:def;
      confirmSheet(t('waiveQ').replace('%v',fmt(amt)).replace('%n',o.name),t('waiveYes'),()=>{
        ms.forEach(m=>{o.waived=o.waived||{};o.waived[m]=Math.round((oblPer(k,o)-partOf(o,m))*100)/100;o.paid.push(m);if(o.part)delete o.part[m]});
        logTx('waive',null,{date:TODAY,type:'waive',amount:amt,cat:k,note:o.name+' · '+ms.map(monthShort).join('، ')});commit(t('waivedDone'))})};
    const wv=r.querySelector('#wv');if(wv)wv.onclick=()=>doW(false);const wa=r.querySelector('#wvA');if(wa)wa.onclick=()=>doW(true);
    setTimeout(()=>r.querySelector('#amt').select(),60);const getRem=recv?()=>null:bindRem(r,def);
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();let a=numv(r,'amt');if(a<=0){toast(t('needAmt'));return}
      const acc=val(r,'acc'),date=val(r,'dt')||TODAY;
      if(recv){o.received=true;S.tx.push({id:uid(),acc,type:'income',cat:'gamin',amount:a,date,note:o.name,link:{k:'gamr',id}})}
      else{if(a>left+0.004){toast(t('overLeft')+' '+fmt(left));return}
        const alloc=allocate(k,o,a),ms=Object.keys(alloc),rr=getRem(),ym=cur>TODAY_YM?cur:TODAY_YM;
        if(rr&&rr.act!=='keep')oblMonths(k,o).filter(m=>effM(o,m)<=ym&&!o.paid.includes(m)).forEach(m=>{if(rr.act==='drop'){o.waived=o.waived||{};o.waived[m]=Math.round((oblPer(k,o)-partOf(o,m))*100)/100;o.paid.push(m);if(o.part)delete o.part[m]}else{o.moved=o.moved||{};o.moved[m]=rr.act}});
        S.tx.push({id:uid(),acc,type:'expense',cat:(o.cat&&S.cats.expense.some(c=>c.id===o.cat)?o.cat:k),amount:a,date,note:o.name+' · '+ms.map(monthShort).join('، ')+(ms.length===1&&alloc[ms[0]]<oblPer(k,o)-0.004?' ('+t('partial')+')':''),link:{k,id,alloc}})}
      closeSheet();commit(t('saved'))};
  });
}
function payInst(id){payForm('inst',id)}
function payGam(id){payForm('gam',id)}
function recvGam(id){const g=S.gam.find(x=>x.id===id);if(!g||g.received)return;payForm('gam',id,true)}
function relink(tx,lk){
  unlink(Object.assign({},tx,{link:lk}));
  if(lk.k==='inst'||lk.k==='gam'){const o=(lk.k==='inst'?S.inst:S.gam).find(x=>x.id===lk.id);if(!o||tx.type!=='expense'){delete tx.link;return}tx.link={k:lk.k,id:lk.id,alloc:allocate(lk.k,o,+tx.amount)}}
  else if(lk.k==='loan'){const l=S.loans.find(x=>x.id===lk.id);if(!l||tx.type==='transfer'){delete tx.link;return}const p={id:lk.pay||uid(),amount:+tx.amount,date:tx.date};l.pays.push(p);tx.link={k:'loan',id:l.id,pay:p.id}}
  else if(lk.k==='loanadd'){const l=S.loans.find(x=>x.id===lk.id);if(!l||tx.type==='transfer'){delete tx.link;return}const a={id:lk.add||uid(),amount:+tx.amount,date:tx.date};l.adds=(l.adds||[]).concat(a);l.amount=Math.round((+l.amount+a.amount)*100)/100;tx.link={k:'loanadd',id:l.id,add:a.id}}
  else if(lk.k==='gamr'){const g=S.gam.find(x=>x.id===lk.id);if(g&&tx.type==='income')g.received=true;else delete tx.link}
  else if(lk.k==='loanorig'){if(S.loans.some(x=>x.id===lk.id)&&tx.type!=='transfer')tx.link={k:'loanorig',id:lk.id};else delete tx.link}
}
function unlink(tx){if(!tx.link)return;const l=tx.link;
  if(l.k==='loan'){const o=S.loans.find(x=>x.id===l.id);if(o)o.pays=o.pays.filter(p=>p.id!==l.pay);return}
  if(l.k==='loanadd'){const o=S.loans.find(x=>x.id===l.id);if(o){const a=(o.adds||[]).find(z=>z.id===l.add);if(a){o.amount=Math.round((+o.amount-(+a.amount||0))*100)/100;o.adds=o.adds.filter(z=>z.id!==l.add)}}return}
  if(l.k==='gamr'){const g=S.gam.find(x=>x.id===l.id);if(g)g.received=false;return}
  if(l.k==='loanorig')return;
  const o=(l.k==='inst'?S.inst:S.gam).find(x=>x.id===l.id);if(!o)return;
  const per=oblPer(l.k,o),alloc=l.alloc||(l.ym?{[l.ym]:per}:{});o.part=o.part||{};
  for(const [m,v] of Object.entries(alloc)){
    let have=o.paid.includes(m)?per:partOf(o,m);o.paid=o.paid.filter(x=>x!==m);
    have=Math.round((have-v)*100)/100;if(have>0.004)o.part[m]=have;else delete o.part[m];
  }
}
const logTx=(act,before,after)=>{S.log=S.log||[];const sm=x=>x?{d:x.date,ty:x.type,a:+x.amount,c:x.cat,acc:x.acc,to:x.toAcc,n:(x.note||'').slice(0,60)}:null;S.log.push({at:new Date().toISOString(),act,id:(after||before).id,b:sm(before),a:sm(after)});if(S.log.length>500)S.log.splice(0,S.log.length-500)};
function delTx(id){const tx=S.tx.find(x=>x.id===id);if(!tx)return;logTx('del',tx,null);unlink(tx);if(tx.rcpt&&typeof gToken!=='undefined'&&hasToken())gfetch('/drive/v3/files/'+tx.rcpt,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})}).catch(()=>{});S.tx=S.tx.filter(x=>x.id!==id)}
function undoLast(kind,id){
  const o=(kind==='inst'?S.inst:S.gam).find(x=>x.id===id);if(!o)return;
  const linked=S.tx.filter(x=>x.link&&x.link.k===kind&&x.link.id===id).sort((a,b)=>a.date.localeCompare(b.date));
  if(linked.length)delTx(linked[linked.length-1].id);
  else if(o.paid.length){const sorted=[...o.paid].sort();o.paid=o.paid.filter(m=>m!==sorted[sorted.length-1])}
  commit(t('deleted'));
}

function commit(msg){applyAlt();save();render();if(msg)toast(msg)}
let tt;function toast(m,ms){const el=$('#toast');el.textContent=m;el.hidden=false;el.onclick=()=>{el.hidden=true};clearTimeout(tt);if(ms===0)return;tt=setTimeout(()=>el.hidden=true,ms||Math.max(3500,String(m).length*90))}
const toastOff=m=>{const el=$('#toast');if(!m||el.textContent===m)el.hidden=true};

