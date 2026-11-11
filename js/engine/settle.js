

/* ---------- who owes whom in a shared ledger ---------- */
const myEmail=()=>(REG&&REG.email)||drv.email||'';
const shortName=e=>String(e||'').split('@')[0];
function ledgerMembers(){const set=new Set([...(S.members||[]),...S.tx.map(x=>x.paidBy||x.by).filter(Boolean)]);if(myEmail())set.add(myEmail());return [...set]}
function splitBalances(){
  const E=perRange()[1],mem=ledgerMembers(),bal={};mem.forEach(m=>bal[m]={paid:0,share:0,net:0});
  S.tx.filter(x=>x.type==='expense'&&x.date<=E).forEach(x=>{const payer=x.paidBy||x.by;if(!payer||!bal[payer])return;const v=baseAmt(x);bal[payer].paid+=v;
    if(x.split==='self')bal[payer].share+=v;else mem.forEach(m=>bal[m].share+=v/mem.length)});
  (S.settles||[]).filter(z=>!z.date||z.date<=E).forEach(z=>{if(bal[z.from])bal[z.from].paid+=+z.amount;if(bal[z.to])bal[z.to].paid-=+z.amount});
  mem.forEach(m=>bal[m].net=bal[m].paid-bal[m].share);
  /* simplest set of payments to settle */
  const debt=mem.filter(m=>bal[m].net<-0.5).map(m=>({m,v:-bal[m].net})),cred=mem.filter(m=>bal[m].net>0.5).map(m=>({m,v:bal[m].net})),plan=[];
  let i=0,j=0;while(i<debt.length&&j<cred.length){const v=Math.min(debt[i].v,cred[j].v);plan.push({from:debt[i].m,to:cred[j].m,v});debt[i].v-=v;cred[j].v-=v;if(debt[i].v<0.5)i++;if(cred[j].v<0.5)j++}
  return {mem,bal,plan};
}
