
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
