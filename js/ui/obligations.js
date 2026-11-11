
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

function commit(msg){applyAlt();save();render();if(msg)toast(msg)}function toast(m,ms){const el=$('#toast');el.textContent=m;el.hidden=false;el.onclick=()=>{el.hidden=true};clearTimeout(tt);if(ms===0)return;tt=setTimeout(()=>el.hidden=true,ms||Math.max(3500,String(m).length*90))}
const toastOff=m=>{const el=$('#toast');if(!m||el.textContent===m)el.hidden=true};
