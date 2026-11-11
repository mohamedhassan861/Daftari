/* ---------- currencies & accounts ---------- */
const CUR=[['EGP','جنيه مصري','Egyptian pound','ج.م'],['USD','دولار أمريكي','US dollar','$'],['EUR','يورو','Euro','€'],['SAR','ريال سعودي','Saudi riyal','ر.س'],
['AED','درهم إماراتي','UAE dirham','د.إ'],['KWD','دينار كويتي','Kuwaiti dinar','د.ك'],['QAR','ريال قطري','Qatari riyal','ر.ق'],['BHD','دينار بحريني','Bahraini dinar','د.ب'],
['OMR','ريال عماني','Omani rial','ر.ع'],['JOD','دينار أردني','Jordanian dinar','د.أ'],['GBP','جنيه إسترليني','British pound','£'],['TRY','ليرة تركية','Turkish lira','₺'],
['CHF','فرنك سويسري','Swiss franc','CHF'],['CAD','دولار كندي','Canadian dollar','C$'],['AUD','دولار أسترالي','Australian dollar','A$'],['CNY','يوان صيني','Chinese yuan','CN¥'],
['JPY','ين ياباني','Japanese yen','JP¥'],['INR','روبية هندية','Indian rupee','₹'],['MAD','درهم مغربي','Moroccan dirham','د.م'],['LYD','دينار ليبي','Libyan dinar','د.ل'],
['IQD','دينار عراقي','Iraqi dinar','د.ع'],['SDG','جنيه سوداني','Sudanese pound','ج.س'],['TND','دينار تونسي','Tunisian dinar','د.ت'],['DZD','دينار جزائري','Algerian dinar','د.ج'],
['G24','ذهب عيار 24 (بالجرام)','Gold 24K (grams)','جم ع24'],['G21','ذهب عيار 21 (بالجرام)','Gold 21K (grams)','جم ع21'],['G18','ذهب عيار 18 (بالجرام)','Gold 18K (grams)','جم ع18']];
const isGold=c=>/^G(24|21|18)$/.test(c||'');
const curInfo=c=>CUR.find(x=>x[0]===c)||[c,c,c,c];
const curSym=c=>{const i=curInfo(c);if(lng()==='en'){if(isGold(c))return 'g '+c.slice(1)+'K';if(/[\u0600-\u06FF]/.test(i[3]))return c}return i[3]};
const curName=c=>{const i=curInfo(c);return lng()==='en'?i[2]:i[1]};
const curOpts=(sel,gold)=>CUR.filter(x=>gold?isGold(x[0]):!isGold(x[0])||x[0]===sel).map(([c,ar,en])=>`<option value="${c}" ${c===sel?'selected':''}>${isGold(c)?'':c+' — '}${esc(lng()==='en'?en:ar)}</option>`).join('');
const BASE=()=>(S&&S.base)||'EGP';
const rateOf=c=>c===BASE()?1:(+((S.rates||{})[c])||0);
const ACC_TYPES=['cash','bank','wallet','card','gold','cert'];
const accOf=id=>S.accounts.find(a=>a.id===id)||S.accounts[0];
/* no fallback: an empty or unknown id means "no particular account" */
const accById=id=>id?S.accounts.find(a=>a.id===id)||null:null;
const curOfTx=x=>(accOf(x.acc)||{}).currency||BASE();
const toBase=(n,c)=>(+n||0)*rateOf(c);
/* the rate on a date: the last saved rate on or before it (today = current) */
function rateAt(c,d){if(c===BASE())return 1;if(!d||d>=TODAY)return rateOf(c);const H=S.rateHist||{},ks=Object.keys(H).filter(k=>H[k][c]>0).sort();
  let best=null;for(const k of ks){if(k<=d)best=k;else break}if(best)return H[best][c];return ks.length?H[ks[0]][c]:rateOf(c)}
const valAt=(a,d)=>accBalanceAt(a,d)*rateAt(a.currency,d);
/* a transfer is worth what left (or arrived in) the base-currency side; otherwise its own rate */
function xferBase(x){const a=accById(x.acc),b=accById(x.toAcc);if(a&&a.currency===BASE())return +x.amount||0;if(b&&b.currency===BASE())return +(x.toAmount??x.amount)||0;return (+x.amount||0)*(+x.rate||rateAt(a?a.currency:BASE(),x.date))}
const baseAmt=x=>{if(x.type==='transfer')return xferBase(x);const c=curOfTx(x);return c===BASE()?(+x.amount||0):(+x.amount||0)*(+x.rate||rateAt(c,x.date))};
const sumB=a=>a.reduce((v,x)=>v+baseAmt(x),0);
const multiCur=()=>S.accounts.some(a=>a.currency!==BASE())||S.loans.some(l=>l.currency&&l.currency!==BASE());
const moneyC=(n,c,cls)=>`<span class="num ${cls||''}">${fmt(n)}</span>${c&&c!==BASE()?` <small class="cur">${esc(curSym(c))}</small>`:''}`;
function accBalance(a){
  let b=+a.opening||0;
  for(const x of S.tx){
    if(x.type==='transfer'){if(x.acc===a.id)b-=+x.amount||0;if(x.toAcc===a.id)b+=+(x.toAmount??x.amount)||0}
    else if(x.acc===a.id)b+=x.type==='income'?+x.amount:-x.amount;
  }
  return b;
}
const accOpts=sel=>S.accounts.map(a=>`<option value="${a.id}" ${a.id===sel?'selected':''}>${esc(a.name)} · ${a.currency}</option>`).join('');
function payAcc(c){c=c||BASE();const d=accOf(S.defAcc);if(d&&d.currency===c)return d.id;const b=S.accounts.find(a=>a.currency===c);return b?b.id:null}
function missingRates(){const set=new Set();S.accounts.forEach(a=>{if(a.currency!==BASE()&&!rateOf(a.currency))set.add(a.currency)});S.loans.forEach(l=>{if(l.currency&&l.currency!==BASE()&&!rateOf(l.currency))set.add(l.currency)});return [...set]}
function usedCurrencies(){const set=new Set(['G21']);S.accounts.forEach(a=>set.add(a.currency));S.loans.forEach(l=>l.currency&&set.add(l.currency));set.delete(BASE());return [...set]}
function migrate(){
  if(!S.base)S.base='EGP';
  if(!Array.isArray(S.recur))S.recur=[];
  if(!Array.isArray(S.goals))S.goals=[];if(!Array.isArray(S.planAdj))S.planAdj=[];if(!S.closed)S.closed={};if(!S.planOver||typeof S.planOver!=='object')S.planOver={};if(!S.closeFrom)S.closeFrom=TODAY_YM;if(!Array.isArray(S.settles))S.settles=[];if(!Array.isArray(S.quick))S.quick=[];
  if(ACT==='me'&&!Array.isArray(S.ledgers))S.ledgers=[];
  if(!S.rk)S.rk=toB64(crypto.getRandomValues(new Uint8Array(32)));
  if(!S.rates||typeof S.rates!=='object')S.rates={};
  if(!Array.isArray(S.accounts)||!S.accounts.length)S.accounts=[{id:'cash',type:'cash',name:lng()==='en'?'Cash':'كاش',currency:S.base,opening:0}];
  const ids=new Set(S.accounts.map(a=>a.id));
  for(const x of S.tx)if(!x.acc||!ids.has(x.acc))x.acc=S.accounts[0].id;
  for(const l of S.loans)if(!l.currency)l.currency=S.base;
  for(const o of S.inst)if(!o.currency)o.currency=S.base;
  for(const o of S.gam)if(!o.currency)o.currency=S.base;
  const addCat=(ty,id,ar,en,sys,before)=>{if(!S.cats[ty].some(c=>c.id===id)){const i=S.cats[ty].findIndex(c=>c.id===before);S.cats[ty].splice(i<0?S.cats[ty].length:i,0,{id,ar,en,sys})}};
  addCat('expense','bankfees','رسوم ومصاريف بنكية','Bank fees',false,'inst');addCat('expense','adjust','فروقات تسوية','Reconciliation difference',true,'other');
  addCat('income','interest','فوايد وعوائد','Interest & returns',false,'gamin');
  addCat('expense','loanpay','سداد سلف','Loan repayments',true,'other');addCat('income','loanback','تحصيل سلف','Loan collections',true,'iother');addCat('income','loanrecv','سلف استلمتها','Loans received',true,'iother');addCat('expense','loangive','سلف ادّيتها','Loans given',true,'other');
  /* a "loan received" category made by the Excel import counted borrowed money as income: fold it into the loans category */
  if(S.zakat&&S.zakat.karat==='21'&&!S.zakat.karatSet)S.zakat.karat='24';
  {const ix=S.cats.income.findIndex(c=>c.id==='loanin');if(ix>=0&&!S.cats.income.some(c=>c.parent==='loanin')){const mv=x=>{if(x&&x.cat==='loanin')x.cat='loanrecv'};S.tx.forEach(mv);(S.planAdj||[]).forEach(mv);(S.recur||[]).forEach(r=>mv(r.tpl));S.cats.income.splice(ix,1)}}addCat('income','iadjust','فروقات تسوية','Reconciliation difference',true,'iother');
  if(!S.defAcc||!ids.has(S.defAcc))S.defAcc=S.accounts[0].id;
  {const cd=S.accounts.find(a=>a.type==='card');for(const o of S.inst)if(o.payWith===undefined)o.payWith=cd&&/كريديت|كارت|credit|card/i.test(o.name)?cd.id:''}
  if('currency' in S)delete S.currency;
}
/* exchange rates: free public API, no account data is sent */
async function updateRates(manual){
  try{
    const r=await fetch('https://open.er-api.com/v6/latest/'+BASE(),{cache:'no-store'});const j=await r.json();
    if(j.result!=='success'||!j.rates)throw new Error('rates');
    for(const c of CUR.map(x=>x[0]))if(c!==BASE()&&j.rates[c])S.rates[c]=Math.round(1/j.rates[c]*10000)/10000;
    let oz=j.rates.XAU?1/j.rates.XAU:0;
    /* the exchange-rate feed has no gold; take the ounce price from a free daily feed (two mirrors) */
    if(!oz&&!S.goldManual)for(const u of ['https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json','https://latest.currency-api.pages.dev/v1/currencies/xau.json']){try{const g=await (await fetch(u,{cache:'no-store'})).json();const v=g&&g.xau&&g.xau[BASE().toLowerCase()];if(v>0){oz=v;break}}catch(e){}}
    if(oz&&!S.goldManual){const g24=oz/31.1035;S.rates.G24=Math.round(g24*100)/100;S.rates.G21=Math.round(g24*21/24*100)/100;S.rates.G18=Math.round(g24*18/24*100)/100}
    S.rateHist=S.rateHist||{};const snap={};Object.keys(S.rates).forEach(c=>{if(+S.rates[c]>0)snap[c]=+S.rates[c]});S.rateHist[TODAY]=snap;
    const ks=Object.keys(S.rateHist).sort();while(ks.length>400)delete S.rateHist[ks.shift()];
    S.ratesAt=new Date().toISOString();commit(manual?t('ratesUpdated'):(oz?'':''));
  }catch(e){if(manual)toast(t('ratesFailed'))}
}
function maybeUpdateRates(){if(!S)return;if(!S.ratesAt||Date.now()-new Date(S.ratesAt).getTime()>864e5)updateRates(false)}

/* ---------- groups ---------- */
const DEF_ACC_GROUP={cash:['كاش','Cash'],bank:['بنوك','Banks'],wallet:['محافظ','Wallets'],card:['كروت','Cards'],gold:['ذهب','Gold'],cert:['شهادات وودائع','Certificates & deposits']};
const accGroup=a=>a.group||(DEF_ACC_GROUP[a.type]||DEF_ACC_GROUP.bank)[lng()==='en'?1:0];
const plainGroup=o=>o.group||t('noGroup');
function groupsOf(list,fn){const m=new Map();list.forEach(x=>{const k=fn(x);if(!m.has(k))m.set(k,[]);m.get(k).push(x)});return m}
const allTags=()=>[...new Set(S.tx.flatMap(x=>x.tags||[]))].sort();
const parseTags=v=>[...new Set(String(v||'').split(/[,،#\n]+/).map(x=>x.trim()).filter(Boolean))].slice(0,8);
const datalist=(id,vals)=>`<datalist id="${id}">${[...new Set(vals.filter(Boolean))].map(v=>`<option value="${esc(v)}"></option>`).join('')}</datalist>`;
/* category tree: a category may sit under one main category (two levels) */
const catTypeOf=id=>S.cats.income.some(c=>c.id===id)?'income':'expense';
const catParent=id=>cat(id).parent||null;
const catRoot=id=>catParent(id)||id;
const catKids=(ty,id)=>S.cats[ty].filter(c=>c.parent===id);
const catPath=id=>{const p=catParent(id);return p?catName(p)+' › '+catName(id):catName(id)};
const inCat=(x,id)=>x.cat===id||catParent(x.cat)===id;
const cName=c=>lng()==='en'?c.en:c.ar;
function catOptsTree(ty,sel,isNew){
  const show=c=>!(c.sys&&isNew&&!['other','iother','adjust','iadjust'].includes(c.id))||c.id===sel;
  return S.cats[ty].filter(c=>!c.parent).map(m=>{
    let h=show(m)?`<option value="${m.id}" ${m.id===sel?'selected':''}>${esc(cName(m))}</option>`:'';
    catKids(ty,m.id).forEach(k=>{if(show(k))h+=`<option value="${k.id}" ${k.id===sel?'selected':''}>   — ${esc(cName(k))}</option>`});
    return h}).join('');
}
function catForm(ty,c){
  const isNew=!c;c=c||{ar:'',en:'',parent:null,sys:false};
  const mains=S.cats[ty].filter(m=>!m.parent&&m.id!==c.id&&!m.sys);
  const hasKids=!isNew&&catKids(ty,c.id).length>0;
  openSheet(isNew?t('addCat'):cName(c),`<form class="form" id="f">
    <label class="fld"><span>${t('name')}</span><input class="in-f" id="nm" value="${esc(cName(c))}" ${c.sys?'disabled':''}></label>
    ${c.sys?'':`<label class="fld"><span>${t('altName')}</span><input class="in-f" id="nm2c" dir="${lng()==='en'?'rtl':'ltr'}" value="${esc(isNew?'':(lng()==='en'?c.ar:c.en)===cName(c)?'':(lng()==='en'?c.ar:c.en))}"></label>`}
    <label class="fld"><span>${t('underGroup')}</span><select class="in-f" id="pa" ${hasKids?'disabled':''}><option value="">${t('mainGroup')}</option>${mains.map(m=>`<option value="${m.id}" ${m.id===c.parent?'selected':''}>${esc(cName(m))}</option>`).join('')}</select></label>
    ${hasKids?`<p class="hint">${t('hasKids')}</p>`:''}
    <div class="foot">${isNew||c.sys?'':`<button type="button" class="btn danger" id="del">${t('del')}</button>`}<button class="btn pri grow">${t('save')}</button></div></form>`,r=>{
    if(!isNew)setTimeout(()=>{},0);else setTimeout(()=>r.querySelector('#nm').focus(),50);
    const d=r.querySelector('#del');if(d)d.onclick=()=>{const used=S.tx.some(x=>x.cat===c.id);confirmSheet(used?t('catInUse'):t('confirmDel'),t('del'),()=>{
      S.cats[ty].forEach(k=>{if(k.parent===c.id)k.parent=null});
      S.cats[ty]=S.cats[ty].filter(k=>k.id!==c.id);S.tx.forEach(x=>{if(x.cat===c.id)x.cat=c.parent||(ty==='expense'?'other':'iother')});delete S.budgets[c.id];commit(t('deleted'))})};
    r.querySelector('#f').onsubmit=e=>{e.preventDefault();const nm=val(r,'nm');if(!c.sys&&!nm){toast(t('needName'));return}const pa=r.querySelector('#pa').value||null;
      const n2=(r.querySelector('#nm2c')||{value:''}).value.trim(),L1=lng(),L2=L1==='en'?'ar':'en';
      if(isNew)S.cats[ty].splice(S.cats[ty].findIndex(k=>k.sys&&!k.parent&&['inst','gam','adjust','other','gamin','iadjust','iother'].includes(k.id)),0,{id:'c'+uid(),[L1]:nm,[L2]:n2||nm,sys:false,parent:pa});
      else{const o=S.cats[ty].find(k=>k.id===c.id);if(!c.sys){o[L1]=nm;o[L2]=n2||nm}if(!hasKids)o.parent=pa}
      closeSheet();commit(t('saved'))};
  });
}

