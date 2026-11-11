/* ---------- quick entry: plain-language text, voice and shared bank messages ---------- */
const AR_DIG='٠١٢٣٤٥٦٧٨٩',FA_DIG='۰۱۲۳۴۵۶۷۸۹';
const normDigits=x=>String(x||'').replace(/[٠-٩]/g,d=>AR_DIG.indexOf(d)).replace(/[۰-۹]/g,d=>FA_DIG.indexOf(d)).replace(/٫/g,'.').replace(/٬/g,',');
const KW_CAT=[[/بنزين|وقود|سولار|غاز طبيعي|fuel|petrol|gas station|اوبر|أوبر|uber|careem|كريم|تاكسي|مواصلات|مترو|ميكروباص/i,'transport'],
  [/عيش|خضار|فاكهة|فاكهه|سوبر ?ماركت|هايبر|بقالة|بقاله|كارفور|carrefour|سبينيس|spinneys|مطعم|اكل|أكل|طلبات|talabat|ماكدونالدز|كافيه|قهوة|grocer|restaurant|food/i,'food'],
  [/كهربا|كهرباء|مياه|ميه|غاز|فاتورة|فاتوره|انترنت|إنترنت|نت|باقة|باقه|we |اتصالات|اورنج|أورانج|فودافون فاتورة|bill|electric|water/i,'bills'],
  [/دكتور|طبيب|صيدلية|صيدليه|دوا|دواء|علاج|مستشفى|تحاليل|pharmacy|doctor|hospital/i,'health'],
  [/مدرسة|مدرسه|دروس|درس|كورس|جامعة|مصاريف دراسية|school|course|tuition/i,'edu'],[/لبس|هدوم|جزمة|جزمه|كوتشي|clothes|shoes/i,'clothes'],
  [/ايجار|إيجار|rent/i,'rent'],[/هدية|هديه|عيدية|عيديه|فرح|gift/i,'gifts'],[/صدقة|صدقه|زكاة|زكاه|تبرع|charity|zakat/i,'charity'],[/صيانة|صيانه|سباك|كهربائي|نقاش|repair/i,'house'],
  [/مرتب|راتب|salary|payroll/i,'salary'],[/حافز|مكافأة|مكافاة|بونص|bonus/i,'bonus'],[/فوايد|فوائد|عائد|interest/i,'interest']];
const KW_IN=/قبضت|استلمت|جالي|جالى|اتحول لي|اتحولي|حولولي|إيداع|ايداع|اضافة|إضافة|دائن|credited|received|deposit|refund|استرداد|مرتجع|تم استلام|incoming/i;
const KW_OUT=/صرفت|دفعت|اشتريت|خصم|سحب|شراء|مدين|debited|purchase|paid|withdraw|spent|تم دفع|سداد|charged/i;
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
let pendingShare=null;
(function(){try{const sp=new URLSearchParams(location.search);const txt=[sp.get('title'),sp.get('text')].filter(Boolean).join(' ').trim();if(txt){pendingShare=txt;history.replaceState(null,'',location.pathname)}}catch(e){}})();
const SpeechRec=window.SpeechRecognition||window.webkitSpeechRecognition;
function listen(cb){
  if(!SpeechRec){toast(t('noVoice'));return}goingOut();
  const r=new SpeechRec();r.lang=lng()==='en'?'en-US':'ar-EG';r.interimResults=false;r.maxAlternatives=1;
  let got=false;
  r.onresult=e=>{got=true;toastOff(t('listening'));cb(e.results[0][0].transcript)};
  r.onerror=e=>{got=true;const c=e&&e.error;toast(c==='not-allowed'||c==='service-not-allowed'?t('micDenied'):c==='network'?t('voiceNet'):c==='aborted'?t('voiceStop'):t('voiceFail'))};
  r.onend=()=>{if(!got)toast(t('voiceFail'));else toastOff(t('listening'))};
  try{r.start();toast(t('listening'),0)}catch(e){toast(t('voiceFail'))}
}
function quickFromText(text){const p=parseEntry(text);if(!p||!p.amount){toast(t('parseFail'));txForm(null,'',p?{note:p.note}:{});return}txForm(null,'',p)}

