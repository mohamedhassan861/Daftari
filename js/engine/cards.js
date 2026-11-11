

/* ---------- credit cards: statement close day, payment day, what is due ---------- */
const dateIn=(y,m,d)=>{while(m<1){m+=12;y--}while(m>12){m-=12;y++}return y+'-'+pad(m)+'-'+pad(Math.min(d,new Date(y,m,0).getDate()))};
function cardInfo(a,at){
  const lim=at||'9999-12-31';at=at||TODAY;const owed=Math.max(0,-(lim===at?accBalanceAt(a,at):accBalance(a)));if(!a.closeDay)return {owed,due:0};
  const cd=+a.closeDay,dd=+(a.dueDay||cd),y=+at.slice(0,4),m=+at.slice(5,7);
  let close=dateIn(y,m,cd);if(close>at)close=dateIn(y,m-1,cd);
  const [cy,cm]=close.split('-').map(Number);let dueDate=dateIn(cy,dd>cd?cm:cm+1,dd);if(a.defer&&a.defer.close===close)dueDate=a.defer.to;
  const stmt=Math.max(0,-accBalanceAt(a,close)),paid=S.tx.filter(x=>x.date>close&&x.date<=lim&&((x.type==='transfer'&&x.toAcc===a.id)||(x.type==='income'&&x.acc===a.id))).reduce((v,x)=>v+(+(x.type==='transfer'?(x.toAmount??x.amount):x.amount)||0),0);
  const due=Math.max(0,Math.round((stmt-paid)*100)/100);
  return {owed,due,dueDate,close,nextClose:dateIn(cy,cm+1,cd),cycle:Math.max(0,owed-due)};
}
const cards=()=>S.accounts.filter(a=>a.type==='card');
/* the card's statements: the one building up now, the last closed one and the one before; tap one to see its purchases */
function cardCycles(a){const cd=+a.closeDay;if(!cd)return [];const c=cardInfo(a),dd=+(a.dueDay||cd);
  const dueOf=C=>{if(a.defer&&a.defer.close===C)return a.defer.to;const [y,m]=C.split('-').map(Number);return dateIn(y,dd>cd?m:m+1,dd)};
  const prevOf=C=>{const [y,m]=C.split('-').map(Number);return dateIn(y,m-1,cd)};
  return [c.nextClose,c.close,prevOf(c.close)].map((C,i)=>{const P=prevOf(C),list=S.tx.filter(x=>x.acc===a.id&&x.date>P&&x.date<=C&&(x.type==='expense'||x.type==='transfer'));
    return {C,P,due:dueOf(C),open:i===0,cur:i===1,left:i===1?c.due:0,list,sum:list.reduce((v,x)=>v+(+x.amount||0),0)}})}
function cardDueFor(a,date){const [y,m,d]=date.split('-').map(Number);
  if(!a.closeDay)return dateIn(y,m+1,+(a.dueDay||5));
  const cd=+a.closeDay,dd=+(a.dueDay||cd),close=d<=cd?dateIn(y,m,cd):dateIn(y,m+1,cd),[cy,cm]=close.split('-').map(Number);return dateIn(cy,dd>cd?cm:cm+1,dd)}
