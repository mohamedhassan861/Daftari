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
function splitHTML(){
  if(ACT==='me')return '';const {mem,bal,plan}=splitBalances();if(mem.length<2)return '';
  return `<details class="box" open><summary><h2>${t('splitTitle')}</h2></summary><div class="list">
    ${mem.map(m=>`<div class="row"><div class="glyph ${bal[m].net>0?'in':''}">${esc(initial(shortName(m)))}</div><div class="main"><span class="t">${esc(shortName(m))}${m===myEmail()?' ('+t('you')+')':''}</span><span class="s">${t('paidLbl')} ${fmt(bal[m].paid)} · ${t('shareOf')} ${fmt(bal[m].share)}</span></div><b class="amt ${bal[m].net<0?'neg':bal[m].net>0?'pos':''}">${bal[m].net>0?'+':''}${fmt(Math.round(bal[m].net))}</b></div>`).join('')}
    ${plan.map(p=>`<div class="row sub"><div class="main"><span class="t">${esc(shortName(p.from))} ← ${esc(shortName(p.to))}</span></div><b class="amt">${fmt(Math.round(p.v))}</b><button class="btn sm" data-act="settle" data-from="${esc(p.from)}" data-to="${esc(p.to)}" data-v="${Math.round(p.v)}">${t('settleBtn')}</button></div>`).join('')}
  </div><p class="hint">${t('splitHint')}</p></details>`;
}
function settleForm(from,to,v){
  const mem=ledgerMembers(),o=m=>mem.map(x=>`<option value="${esc(x)}" ${x===m?'selected':''}>${esc(shortName(x))}</option>`).join('');
  openSheet(t('settleBtn'),`<form class="form" id="f"><div class="two"><label class="fld"><span>${t('fromWho')}</span><select class="in-f" id="sf">${o(from)}</select></label><label class="fld"><span>${t('toWho')}</span><select class="in-f" id="st2">${o(to)}</select></label></div>
    <label class="fld"><span>${t('amount')} (${esc(curName(BASE()))})</span><input class="in-f amt num" id="amt" inputmode="decimal" value="${v||''}"></label><div class="foot"><button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const a=numv(r,'amt');if(!(a>0)){toast(t('needAmt'));return}const f2=val(r,'sf'),t2=val(r,'st2');if(f2===t2){toast(t('sameAcc'));return}
      S.settles=S.settles||[];S.settles.push({id:'z'+uid(),from:f2,to:t2,amount:a,date:TODAY,by:myEmail()});closeSheet();commit(t('saved'))};
  });
}

