

/* ---------- closing a month: confirm what was final, move what is still expected ---------- */
function closeRows(m){
  const rows=[];
  [['inst',S.inst],['gam',S.gam]].forEach(([k,l])=>l.forEach(o=>oblMonths(k,o).filter(x=>effM(o,x)===m&&!o.paid.includes(x)).forEach(x=>rows.push({kind:'obl',k,id:o.id,x,label:o.name,plan:oblPer(k,o),act:partOf(o,x),cur:o.currency||BASE()}))));
  S.loans.forEach(l=>{const sc=loanSched(l).find(z=>z.m===m);const owe=loanOwedUpTo(l,m);if(sc&&owe>0)rows.push({kind:'loan',id:l.id,label:l.person,plan:sc.amount,act:Math.max(0,sc.amount-Math.min(owe,sc.amount)),cur:l.currency||BASE()})});
  const tx=txOf(m);
  Object.entries(S.budgets||{}).forEach(([c,v])=>{const a=sumB(tx.filter(x=>x.type==='expense'&&(x.cat===c||catRoot(x.cat)===c)));if(a<+v-0.5)rows.push({kind:'bud',cat:c,label:catName(c),plan:+v,act:a,cur:BASE()})});
  (S.planAdj||[]).filter(a=>a.m===m).forEach(a=>{const act=sumB(tx.filter(x=>x.type==='expense'&&(x.cat===a.cat||catRoot(x.cat)===a.cat)));if(act<+a.amount-0.5&&!rows.some(r=>r.kind==='bud'&&r.cat===a.cat))rows.push({kind:'bud',cat:a.cat,label:a.label||catName(a.cat),plan:+a.amount,act,cur:BASE()})});
  return rows;
}
const monthNetPL=m=>{const x=txOf(m);return sumB(x.filter(y=>y.type==='income'&&isPL(y)))-sumB(x.filter(y=>y.type==='expense'&&isPL(y)))};
const monthCashNet=m=>liqAll(monthEnd(m))-liqAll(monthEnd(ymAdd(m,-1)));
