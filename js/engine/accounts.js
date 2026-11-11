
const allCats=()=>[...S.cats.expense,...S.cats.income];
const cat=id=>allCats().find(c=>c.id===id)||{id,ar:'أخرى',en:'Other'};
const catName=id=>{const c=cat(id);return S.lang==='en'?c.en:c.ar};
const txOf=ym=>S.tx.filter(x=>x.date.slice(0,7)===ym);
const accOf=id=>S.accounts.find(a=>a.id===id)||S.accounts[0];
/* no fallback: an empty or unknown id means "no particular account" */
const accById=id=>id?S.accounts.find(a=>a.id===id)||null:null;
function accBalance(a){
  let b=+a.opening||0;
  for(const x of S.tx){
    if(x.type==='transfer'){if(x.acc===a.id)b-=+x.amount||0;if(x.toAcc===a.id)b+=+(x.toAmount??x.amount)||0}
    else if(x.acc===a.id)b+=x.type==='income'?+x.amount:-x.amount;
  }
  return b;
}
const accGroup=a=>a.group||(DEF_ACC_GROUP[a.type]||DEF_ACC_GROUP.bank)[lng()==='en'?1:0];
const plainGroup=o=>o.group||t('noGroup');
function groupsOf(list,fn){const m=new Map();list.forEach(x=>{const k=fn(x);if(!m.has(k))m.set(k,[]);m.get(k).push(x)});return m}
const allTags=()=>[...new Set(S.tx.flatMap(x=>x.tags||[]))].sort();
const parseTags=v=>[...new Set(String(v||'').split(/[,،#\n]+/).map(x=>x.trim()).filter(Boolean))].slice(0,8);
/* category tree: a category may sit under one main category (two levels) */
const catTypeOf=id=>S.cats.income.some(c=>c.id===id)?'income':'expense';
const catParent=id=>cat(id).parent||null;
const catRoot=id=>catParent(id)||id;
const catKids=(ty,id)=>S.cats[ty].filter(c=>c.parent===id);
const catPath=id=>{const p=catParent(id);return p?catName(p)+' › '+catName(id):catName(id)};
const inCat=(x,id)=>x.cat===id||catParent(x.cat)===id;
const cName=c=>lng()==='en'?c.en:c.ar;
