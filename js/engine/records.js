
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
