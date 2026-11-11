

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
function payInst(id){payForm('inst',id)}
function payGam(id){payForm('gam',id)}
function recvGam(id){const g=S.gam.find(x=>x.id===id);if(!g||g.received)return;payForm('gam',id,true)}
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
