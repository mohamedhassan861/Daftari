
function xferOf(raw,low){
  const byType=ty=>S.accounts.find(a=>a.type===ty),bank=()=>byType('bank'),cash=()=>byType('cash'),card=()=>byType('card');
  /* accounts named in the text, in the order they appear (by name, or by words like كاش / البنك / الكارت) */
  const hits=[];S.accounts.forEach(a=>{const i=a.name?low.indexOf(a.name.toLowerCase()):-1;if(i>=0)hits.push({a,i})});
  const word=(rx,a)=>{const m=raw.match(rx);if(m&&a&&!hits.some(h=>h.a.id===a.id))hits.push({a,i:m.index})};
  word(/كاش|نقدي|نقدا|نقداً|cash/i,cash());word(/البنك|بنك|الحساب البنكي|bank/i,bank());word(/الكارت|الفيزا|الكريديت|كريدت|credit|card/i,card());
  hits.sort((x,y)=>x.i-y.i);
  if(/سحب.{0,12}(نقد|كاش|atm|صراف|ماكين)|atm|صراف آلي|ماكينة/i.test(raw)){const from=(hits.find(h=>h.a.type==='bank')||{}).a||bank();return {from:from&&from.id,to:(cash()||{}).id}}
  if(/(ايداع|إيداع).{0,10}(نقد|كاش)/i.test(raw)){const to=(hits.find(h=>h.a.type==='bank')||{}).a||bank();return {from:(cash()||{}).id,to:to&&to.id}}
  if(/(سداد|سددت|دفعت).{0,15}(الكارت|الفيزا|الكريديت|كريدت|credit card)/i.test(raw)&&card()){const from=(hits.find(h=>h.a.type!=='card')||{}).a||bank()||accOf(S.defAcc);return {from:from&&from.id,to:card().id}}
  if(/حولت|حوّلت|تحويل|نقلت|سحبت/i.test(raw)&&hits.length>=2){const m=raw.match(/من\s*(\S+)/),fromH=m?hits.find(h=>h.i>=m.index&&h.i<=m.index+m[0].length+2):null,from=fromH||hits[0],to=hits.find(h=>h!==from);return {from:from.a.id,to:to.a.id}}
  return null;
}
function parseEntry(text){
  const raw=normDigits(text).replace(/\s+/g,' ').trim();if(!raw)return null;
  /* amounts, skipping ones labelled as the remaining balance */
  const re=/(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?/g;let m,amount=0;
  while((m=re.exec(raw))){const before=raw.slice(Math.max(0,m.index-18),m.index);if(/رصيد|balance|available|المتاح|متاح/i.test(before))continue;
    const v=parseFloat(m[1].replace(/,/g,'')+(m[2]?'.'+m[2]:''));if(v>0&&!(m[1].length>=8&&!m[1].includes(','))){amount=v;break}}
  const type=KW_IN.test(raw)&&!/صرفت|دفعت|اشتريت/.test(raw)?'income':'expense';
  const low=raw.toLowerCase();
  let acc=null;S.accounts.slice().sort((a,b)=>b.name.length-a.name.length).forEach(a=>{if(!acc&&a.name&&low.includes(a.name.toLowerCase()))acc=a});
  if(!acc&&/فودافون كاش|vodafone cash/i.test(raw))acc=S.accounts.find(a=>/فودافون|vodafone/i.test(a.name));
  if(!acc&&/كاش|cash|نقدي/i.test(raw))acc=S.accounts.find(a=>a.type==='cash');
  let cat=null;const cands=S.cats[type].slice().sort((a,b)=>cName(b).length-cName(a).length);
  for(const c of cands){const n=[c.ar,c.en].filter(Boolean);if(n.some(w=>w.length>2&&low.includes(w.toLowerCase()))){cat=c.id;break}}
  if(!cat)for(const [rx,id] of KW_CAT){if(rx.test(raw)&&S.cats[type].some(c=>c.id===id)){cat=id;break}}
  /* prefer a sub-category whose name appears */
  if(cat)for(const k of catKids(type,cat))if(low.includes(cName(k).toLowerCase())){cat=k.id;break}
  /* moves between your own accounts: "حولت 5000 من البنك للكاش", ATM withdrawals, cash deposits, card payments */
  const xf=xferOf(raw,low);if(xf&&xf.from&&xf.to&&xf.from!==xf.to){const nt=raw.replace(re,' ').replace(/جنيه|جنيها|ج\.م|EGP|LE|جم/gi,' ').replace(/\s+/g,' ').trim().slice(0,60);return {type:'transfer',amount,acc:xf.from,toAcc:xf.to,cat:'transfer',note:nt}}
  let note=raw.replace(/(رصيد|balance|available|المتاح).*$/i,'').replace(re,' ').replace(/جنيه|جنيها|ج\.م|EGP|LE|L\.E|جم|دولار|USD|\$|يورو|EUR|ريال|SAR/gi,' ').replace(/\s+/g,' ').trim();
  if(note.length>60)note=note.slice(0,60)+'…';
  return {type,amount,acc:(acc||accOf(S.defAcc)).id,cat:cat||(type==='expense'?'other':'iother'),note};
}
