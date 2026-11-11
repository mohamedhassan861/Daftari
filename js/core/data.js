/* ---------- data ---------- */
const DEF_CATS={
 expense:[['food','أكل وبقالة','Groceries & food'],['bills','فواتير (كهربا، مياه، غاز، نت)','Bills & utilities'],['rent','إيجار','Rent'],['transport','مواصلات وبنزين','Transport & fuel'],['edu','تعليم ومدارس','Education'],['health','صحة وعلاج','Health'],['clothes','لبس','Clothing'],['house','البيت والصيانة','Home & repairs'],['personal','مصروف شخصي','Personal'],['gifts','هدايا ومناسبات','Gifts & occasions'],['charity','صدقات وزكاة','Charity & zakat'],['inst','أقساط','Installments',1],['gam','جمعيات','Gam\'eya payments',1],['other','أخرى','Other',1]],
 income:[['salary','مرتب','Salary'],['bonus','حوافز ومكافآت','Bonuses'],['side','دخل إضافي','Side income'],['gamin','قبض جمعية','Gam\'eya payout',1],['iother','أخرى','Other',1]]
};
const mkCats=()=>({expense:DEF_CATS.expense.map(([id,ar,en,sys])=>({id,ar,en,sys:!!sys})),income:DEF_CATS.income.map(([id,ar,en,sys])=>({id,ar,en,sys:!!sys}))});
const blank=()=>({v:1,lang:'ar',base:'EGP',rates:{},accounts:[],cats:mkCats(),tx:[],inst:[],gam:[],loans:[],budgets:{},sample:false});

function seed(){
  const s=blank(); s.sample=true;
  const d=(ym,day)=>ym+'-'+pad(day);
  const add=(type,cat,amount,date,note)=>s.tx.push({id:uid(),type,cat,amount,date,note:note||''});
  for(let i=-4;i<=0;i++){
    const ym=ymAdd(TODAY_YM,i), last=i===0?Math.max(1,now.getDate()):28;
    const dd=n=>d(ym,Math.min(n,last));
    add('income','salary',25000,dd(1),'');
    if(i%2===0) add('income','side',3500,dd(12),'شغل فريلانس');
    add('expense','food',1850+((i+5)*137)%600,dd(3),'هايبر');
    add('expense','food',920+((i+5)*91)%300,dd(14),'خضار وفاكهة');
    add('expense','bills_e',1400+((i+5)*53)%250,dd(5),'');
    add('expense','bills_n',450,dd(6),'');
    add('expense','transport',1100+((i+5)*71)%400,dd(9),'بنزين');
    add('expense','edu',1200,dd(2),'مصاريف دروس');
    add('expense','personal',600,dd(18),'');
    if(i===-2) add('expense','clothes',2300,dd(20),'لبس المدارس');
    if(i===-1) add('expense','health',850,dd(16),'كشف ودوا');
  }
  const ac={id:uid(),name:'تكييف',monthly:1500,count:12,start:ymAdd(TODAY_YM,-5),paid:[]};
  for(let i=0;i<5;i++){const ym=ymAdd(ac.start,i);ac.paid.push(ym);s.tx.push({id:uid(),type:'expense',cat:'inst',amount:1500,date:ym+'-05',note:'تكييف',link:{k:'inst',id:ac.id,ym}})}
  s.inst.push(ac);
  const g={id:uid(),name:'جمعية الشغل',share:2000,members:10,myTurn:7,start:ymAdd(TODAY_YM,-4),paid:[],received:false};
  for(let i=0;i<4;i++){const ym=ymAdd(g.start,i);g.paid.push(ym);s.tx.push({id:uid(),type:'expense',cat:'gam',amount:2000,date:ym+'-01',note:g.name,link:{k:'gam',id:g.id,ym}})}
  s.gam.push(g);
  s.loans.push({id:uid(),dir:'lent',person:'أحمد',amount:3000,date:d(ymAdd(TODAY_YM,-2),10),note:'',pays:[{id:uid(),amount:1000,date:d(ymAdd(TODAY_YM,-1),10)}]});
  s.loans.push({id:uid(),dir:'borrowed',person:'خالي',amount:5000,date:d(ymAdd(TODAY_YM,-3),2),note:'مصاريف المدرسة',pays:[]});
  s.budgets={food:3500,transport:1500,personal:800};
  s.cats.expense.splice(2,0,{id:'bills_e',ar:'كهربا وغاز',en:'Power & gas',sys:false,parent:'bills'},{id:'bills_n',ar:'نت وموبايل',en:'Internet & mobile',sys:false,parent:'bills'});
  s.loans[0].group='الأصحاب';s.loans[1].group='العيلة';s.inst[0].group='البيت';s.gam[0].group='الشغل';
  s.base='EGP';s.rates={USD:48.5,EUR:52.5,SAR:12.9,G24:5150,G21:4500,G18:3860};
  s.accounts=[{id:'cash',type:'cash',name:'كاش',currency:'EGP',opening:30000},{id:'nbe',type:'bank',name:'البنك الأهلي',currency:'EGP',opening:40000},{id:'cib-usd',type:'bank',name:'CIB',currency:'USD',opening:1500},{id:'cib-egp',type:'bank',name:'CIB',currency:'EGP',opening:8000}];
  s.tx.forEach(x=>{x.acc=['food','transport','personal'].includes(x.cat)?'cash':'nbe'});s.defAcc='cash';
  return s;
}

let S=null;

/* ---------- encryption (PBKDF2 + AES-GCM, all on the device) ---------- */
const VAULT='daftar-elbeit-vault', ITER=310000;
const te=new TextEncoder(), td=new TextDecoder();
const toB64=buf=>{const u=new Uint8Array(buf);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
const fromB64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function derive(pin,salt,iter){
  const base=await crypto.subtle.importKey('raw',te.encode(pin),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:iter,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function seal(key,obj){const iv=crypto.getRandomValues(new Uint8Array(12));const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,te.encode(JSON.stringify(obj)));return{iv:toB64(iv),ct:toB64(ct)}}
async function unseal(key,iv,ct){const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromB64(iv)},key,fromB64(ct));return JSON.parse(td.decode(pt))}
let KEYOBJ=null, SALT=null;
const readVault=()=>{try{return JSON.parse(localStorage.getItem(VAULT)||'null')}catch(e){return null}};
let saving=Promise.resolve();
let tokenAsked=0;
function save(){
  if(typeof drv!=='undefined'&&!useWorker()&&drv.linked&&driveReady()&&!hasToken()&&Date.now()-tokenAsked>60000){
    tokenAsked=Date.now();requestToken('').then(()=>scheduleDrive()).catch(()=>{drv.needAuth=true;if(S)render()});
  }
  if(!KEYOBJ||!S)return;
  if(typeof ACT!=='undefined'&&ACT!=='me'){sharedSave();return}
  vaultSave(S);afterChange();writeReminders();
}
function vaultSave(obj){
  if(!KEYOBJ||!obj)return;const snap=JSON.parse(JSON.stringify(obj));const key=KEYOBJ,salt=SALT;
  saving=saving.then(async()=>{const {iv,ct}=await seal(key,snap);try{localStorage.setItem(VAULT,JSON.stringify({v:2,salt:toB64(salt),iter:ITER,iv,ct}));localStorage.setItem('daftar-elbeit-lang',snap.lang)}catch(e){}}).catch(()=>{});
}

/* ---------- helpers ---------- */
const L=()=>S.lang==='en'?'en-GB':'ar-EG-u-nu-latn';
const fmt=n=>(Math.round((+n||0)*100)/100).toLocaleString('en-US',{maximumFractionDigits:2});
const money=(n,cls)=>`<span class="num ${cls||''}">${fmt(n)}</span>`;
const monthLbl=ym=>{const [y,m]=ym.split('-').map(Number);return new Intl.DateTimeFormat(L(),{month:'long',year:'numeric'}).format(new Date(y,m-1,1))};
const monthShort=ym=>{const [y,m]=ym.split('-').map(Number);return new Intl.DateTimeFormat(L(),{month:'short'}).format(new Date(y,m-1,1))};
const wdOf=dt=>new Intl.DateTimeFormat(L(),{weekday:'short'}).format(dt);
const dmyOf=dt=>'\u200E'+pad(dt.getDate())+'/'+pad(dt.getMonth()+1)+'/'+dt.getFullYear()+'\u200E';
const dateOf=dt=>wdOf(dt)+' '+dmyOf(dt);
const hmOf=dt=>pad(dt.getHours())+':'+pad(dt.getMinutes());
const dsDate=ds=>{const [y,m,d]=ds.split('-').map(Number);return new Date(y,m-1,d)};
const dayLbl=ds=>dateOf(dsDate(ds));
const allCats=()=>[...S.cats.expense,...S.cats.income];
const cat=id=>allCats().find(c=>c.id===id)||{id,ar:'أخرى',en:'Other'};
const catName=id=>{const c=cat(id);return S.lang==='en'?c.en:c.ar};
const initial=s=>(s||'?').trim().charAt(0);
const sum=a=>a.reduce((x,y)=>x+(+y.amount||0),0);
const txOf=ym=>S.tx.filter(x=>x.date.slice(0,7)===ym);
const loanPaid=l=>sum(l.pays);
/* a loan repaid in monthly installments: [{m, amount}] from the start month until the amount is covered */
function loanSched(l){
  const base=loanSched0(l);if(!(l.adj&&l.adj.length))return base;
  const mm={};base.forEach(x=>mm[x.m]=(mm[x.m]||0)+x.amount);l.adj.forEach(x=>mm[x.m]=(mm[x.m]||0)+(+x.amount||0));
  return Object.keys(mm).sort().map(m=>({m,amount:Math.round(mm[m]*100)/100})).filter(x=>Math.abs(x.amount)>0.004);
}
function loanSched0(l){
  if(l.plan==='inst'&&+l.instAmt>0&&l.instStart){const base=Math.min(Math.max(0,+l.instBase||0),+l.amount),out=[];if(base>0.004){const lm=(l.date||l.instStart).slice(0,7);out.push({m:lm<l.instStart?lm:ymAdd(l.instStart,-1),amount:Math.round(base*100)/100})}let left=+l.amount-base,m=l.instStart,g=0;while(left>0.004&&g++<600){const v=Math.min(+l.instAmt,left);out.push({m,amount:Math.round(v*100)/100});left-=v;m=ymAdd(m,1)}return out}
  return l.due?[{m:l.due,amount:+l.amount}]:[];
}
/* still owed on the schedule up to month m (payments cover the earliest months first) */
const loanOwedUpTo=(l,m)=>Math.max(0,Math.round((loanSched(l).filter(x=>x.m<=m).reduce((v,x)=>v+x.amount,0)-loanPaid(l))*100)/100);
const loanAdj=l=>(l.adj||[]).reduce((v,x)=>v+(+x.amount||0),0);
const loanOrigAmt=(l,amt)=>Math.round(((amt??+l.amount)-sum(l.adds||[])-(+l.folded||0))*100)/100;
const loanLeft=l=>Math.max(0,l.amount+loanAdj(l)-loanPaid(l));

