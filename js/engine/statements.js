
function accStmt(id){
  const a=accOf(id),[from,to]=perRange();let open=+a.opening||0;const rows=[];
  [...S.tx].sort(byDate).forEach(x=>{
    let dr=0,cr=0,desc;
    if(x.type==='transfer'){
      if(x.acc===a.id){const b=accOf(x.toAcc);dr=+x.amount;desc=t('transfer')+' ← '+(b?b.name+' '+b.currency:'')}
      else if(x.toAcc===a.id){const b=accOf(x.acc);cr=+(x.toAmount??x.amount);desc=t('transfer')+' → '+(b?b.name+' '+b.currency:'')}
      else return;
    }else if(x.acc===a.id){if(x.type==='income')cr=+x.amount;else dr=+x.amount;desc=catPath(x.cat)}
    else return;
    if(x.note)desc+=' · '+x.note;
    if(x.date<from){open+=cr-dr;return}if(x.date>to)return;
    rows.push({date:x.date,desc,dr,cr,tx:x.id});
  });
  stmtSheet({title:a.name+' · '+a.currency,sub:accGroup(a)+' · '+perLabel(),cur:a.currency,kind:'acc',opening:open,rows,acc:a});
}
const isFin=x=>FIN_CATS.has(catRoot(x.cat));
const isPL=x=>(x.type==='income'||x.type==='expense')&&!isFin(x);
function flowRows(list){return list.map(x=>{const a=accOf(x.acc),v=baseAmt(x);let desc=catPath(x.cat)+(x.note?' · '+x.note:'')+' · '+a.name;
  if(a.currency!==BASE())desc+=' ('+fmt(x.amount)+' '+curSym(a.currency)+')';
  return {date:x.date,desc,dr:x.type==='expense'?v:0,cr:x.type==='income'?v:0,tx:x.id}})}
function catStmt(id){const ty=catTypeOf(id);stmtSheet({title:catPath(id),sub:(ty==='expense'?t('expense'):t('income'))+' · '+perLabel(),cur:BASE(),kind:'flow',rows:flowRows(txIn().filter(x=>x.type===ty&&inCat(x,id)))})}
function flowStmt(ty){
  if(ty==='fin'){stmtSheet({title:t('finTitle'),sub:perLabel(),cur:BASE(),kind:'acc',opening:0,rows:flowRows(txIn().filter(x=>x.type!=='transfer'&&isFin(x)))});return}
  if(ty==='net'){stmtSheet({title:per.mode==='month'?t('net'):t('netPer'),sub:perLabel(),cur:BASE(),kind:'acc',opening:0,rows:flowRows(txIn().filter(isPL))});return}
  stmtSheet({title:ty==='expense'?t('expense'):t('income'),sub:perLabel(),cur:BASE(),kind:'flow',rows:flowRows(txIn().filter(x=>x.type===ty&&isPL(x)))});
}
function personStmt(name){
  const ls=S.loans.filter(l=>l.person===name),one=new Set(ls.map(l=>l.currency||BASE())).size===1,cc=one?(ls[0].currency||BASE()):BASE();
  const cv=(v,l)=>one?+v:toBase(v,l.currency||BASE());const rows=[];
  ls.forEach(l=>{
    rows.push({date:l.date,desc:(l.dir==='lent'?t('lentTo'):t('borrowedFrom'))+(l.note?' · '+l.note:''),dr:l.dir==='lent'?cv(l.amount,l):0,cr:l.dir==='borrowed'?cv(l.amount,l):0,ord:0});
    l.pays.forEach(p=>rows.push({date:p.date,desc:l.dir==='lent'?t('repayFrom'):t('repayTo'),dr:l.dir==='borrowed'?cv(p.amount,l):0,cr:l.dir==='lent'?cv(p.amount,l):0,ord:1}));
  });
  stmtSheet({title:name,sub:plainGroup(ls[0]||{})+' · '+t('allTime'),cur:cc,kind:'person',opening:0,rows});
}
const byRank=(arr,ids,key)=>{const rank=new Map(ids.map((id,k)=>[id,k]));return arr.slice().sort((a,b)=>(rank.get(key(a))??1e9)-(rank.get(key(b))??1e9))};

function budgetState(){
  const tx=txIn().filter(x=>x.type==='expense'),f=perFactor();
  return Object.entries(S.budgets).map(([id,l])=>{const lim=Math.round(l*f),sp=sumB(tx.filter(x=>inCat(x,id)));return{id,lim,sp,p:sp/lim}});
}
function txFiltered(){
  let tx=txIn();if(txFilter!=='all')tx=tx.filter(x=>x.type===txFilter);
  if(txCat)tx=tx.filter(x=>inCat(x,txCat));
  if(txAcc)tx=tx.filter(x=>x.acc===txAcc||x.toAcc===txAcc);
  if(txTag)tx=tx.filter(x=>(x.tags||[]).includes(txTag));
  if(txDay)tx=tx.filter(x=>x.date===txDay);
  if(txQuery){const q=txQuery.toLowerCase();tx=tx.filter(x=>((x.note||'')+' '+catPath(x.cat)+' '+x.amount+' '+(accOf(x.acc)||{}).name+' '+(x.tags||[]).join(' ')).toLowerCase().includes(q))}
  return tx;
}
