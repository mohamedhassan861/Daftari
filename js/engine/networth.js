

/* ---------- safe to spend this month ---------- */
function safeToSpend(){
  const liquid=liqAll(TODAY),ev=remainingPlan(TODAY_YM),sm=f=>ev.filter(f).reduce((v,e)=>v+e.amt,0);
  const obl=sm(e=>e.dir==='out'&&['inst','gam','loan','card','adj','tx','xfer'].includes(e.kind)),recOut=sm(e=>e.dir==='out'&&e.kind==='rec'),recIn=sm(e=>e.dir==='in');
  const goals=S.goals.reduce((v,g)=>v+toBase(goalMonthly(g),g.currency||BASE()),0);
  const safe=liquid-obl-recOut-goals;
  const last=new Date(+TODAY.slice(0,4),+TODAY.slice(5,7),0).getDate(),daysLeft=last-+TODAY.slice(8,10)+1;
  const bud=sm(e=>e.dir==='out'&&e.kind==='bud'),other=sm(e=>e.dir==='out'&&!['inst','gam','loan','card','adj','tx','xfer','rec','bud'].includes(e.kind));
  return {liquid,obl,recOut,recIn,goals,safe,bud,other,end:safe+goals+recIn-bud-other,daysLeft,perDay:safe>0?safe/daysLeft:0};
}

/* ---------- savings goals ---------- */
const goalSaved=g=>g.acc&&S.accounts.some(a=>a.id===g.acc)?Math.max(0,accBalance(accOf(g.acc))):(g.saved||[]).reduce((v,p)=>v+(+p.amount||0),0);
function goalMonthly(g){const left=Math.max(0,(+g.target||0)-goalSaved(g));if(!left||!g.due)return 0;const months=Math.max(1,ymDiff(TODAY_YM,g.due.slice(0,7))+(g.due.slice(8,10)>=TODAY.slice(8,10)?1:0));return left/months}
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
function zakatCalc(){
  const z=S.zakat=Object.assign({karat:'24',gold:true,recv:true,debt:true},S.zakat||{});
  const price=rateOf('G'+z.karat),nisab=85*price;
  let cash=0,gold=0;S.accounts.forEach(a=>{const v=valAt(a,TODAY);if(v<=0)return;if(a.type==='gold')gold+=v;else cash+=v});
  const recv=S.loans.filter(l=>l.dir==='lent').reduce((v,l)=>v+toBase(loanLeftAt(l,TODAY),l.currency||BASE()),0),debt=S.loans.filter(l=>l.dir==='borrowed').reduce((v,l)=>v+toBase(loanLeftAt(l,TODAY),l.currency||BASE()),0);
  const base=cash+(z.gold?gold:0)+(z.recv?recv:0)-(z.debt?debt:0);return {price,nisab,cash,gold:z.gold?gold:0,recv,debt,recvOn:z.recv,debtOn:z.debt,base,due:price&&base>=nisab};
}
