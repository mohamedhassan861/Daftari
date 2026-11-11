

/* ---------- import from Excel / CSV ---------- */
function parseCSV(text){
  text=text.replace(/^﻿/,'');const first=text.split(/\r?\n/)[0]||'',delim=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':(first.includes('\t')?'\t':',');
  const rows=[];let row=[],f='',q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=c}
    else if(c==='"')q=true;else if(c===delim){row.push(f);f=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f=''}else f+=c}
  if(f||row.length){row.push(f);rows.push(row)}
  return rows.filter(r=>r.some(v=>String(v).trim()!==''));
}
function parseDateAny(v){
  if(v==null||v==='')return null;if(typeof v==='number'&&v>20000&&v<80000)return iso(new Date(Date.UTC(1899,11,30)+v*864e5));
  const x=normDigits(String(v)).trim();let m;
  if((m=x.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/)))return m[1]+'-'+pad(+m[2])+'-'+pad(+m[3]);
  if((m=x.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))){const y=m[3].length===2?'20'+m[3]:m[3];return y+'-'+pad(+m[2])+'-'+pad(+m[1])}
  const d=new Date(x);return isNaN(d)?null:iso(new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())));
}
const numAny=v=>{if(typeof v==='number')return v;const x=normDigits(String(v||'')).replace(/[^\d.,\-()]/g,'').replace(/,/g,'');if(!x)return NaN;const neg=/^\(.*\)$/.test(x)||x.startsWith('-');return (neg?-1:1)*parseFloat(x.replace(/[()\-]/g,''))};
function importForm(){
  openSheet(t('importX'),`<div class="form"><p class="hint">${t('importXHint')}</p><label class="fld"><span>${t('chooseFile')}</span><input class="in-f" type="file" id="xf" accept=".csv,.txt,.xlsx,.xls"></label><div id="map"></div></div>`,r=>{
    r.querySelector('#xf').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;let rows=[];
      try{if(/\.xlsx?$/i.test(f.name)){const X=await loadXLSX();const wb=X.read(await f.arrayBuffer(),{type:'array'});rows=X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true,defval:''})}
        else rows=parseCSV(await f.text())}catch(e){toast(t('badFile'));return}
      const hi=Math.max(0,rows.findIndex(rw=>rw.filter(v=>typeof v==='string'&&v.trim()&&isNaN(numAny(v))).length>=2));
      const head=(rows[hi]||[]).map(v=>String(v).trim()),data=rows.slice(hi+1);
      const guess=rx=>head.findIndex(h=>rx.test(h));
      const cols={date:guess(/date|تاريخ/i),amount:guess(/amount|مبلغ|قيمة|قيمه|value/i),debit:guess(/debit|مدين|withdraw|سحب|out|مصروف/i),credit:guess(/credit|دائن|deposit|ايداع|إيداع|in$|إيراد|ايراد/i),
        cat:guess(/category|بند|تصنيف|نوع المصروف/i),acc:guess(/account|حساب|بنك|wallet/i),note:guess(/note|desc|بيان|ملاحظ|وصف|details|تفاصيل/i),type:guess(/^type$|^النوع$/i)};
      const sel=(k,label,opt)=>`<label class="fld"><span>${label}</span><select class="in-f" data-c="${k}"><option value="-1">${opt?t('noneCol'):'—'}</option>${head.map((h,i)=>`<option value="${i}" ${cols[k]===i?'selected':''}>${esc(h||('#'+(i+1)))}</option>`).join('')}</select></label>`;
      r.querySelector('#map').innerHTML=`<p class="hint">${data.length} ${t('rowsWord')}</p>
        <div class="two">${sel('date',t('date'))}${sel('amount',t('amount'),1)}</div>
        <div class="two">${sel('debit',t('dr')+' / '+t('exp1'),1)}${sel('credit',t('cr')+' / '+t('inc1'),1)}</div>
        <div class="two">${sel('cat',t('category'),1)}${sel('acc',t('account'),1)}</div>
        <div class="two">${sel('note',t('note'),1)}${sel('type',t('typeCol'),1)}</div>
        <div class="two"><label class="fld"><span>${t('defAccImp')}</span><select class="in-f" id="da">${accOpts(S.defAcc)}</select></label>
        <label class="fld"><span>${t('posIs')}</span><select class="in-f" id="ps"><option value="expense">${t('exp1')}</option><option value="income">${t('inc1')}</option></select></label></div>
        <label class="chk"><input type="checkbox" id="nc" checked> ${t('makeCats')}</label><label class="chk"><input type="checkbox" id="dp" checked> ${t('skipDup')}</label>
        <button type="button" class="btn pri block" id="go">${t('importNow')}</button>`;
      r.querySelector('#go').onclick=()=>{
        const c={};r.querySelectorAll('[data-c]').forEach(x=>c[x.dataset.c]=+x.value);if(c.date<0||(c.amount<0&&c.debit<0&&c.credit<0)){toast(t('needCols'));return}
        const posType=r.querySelector('#ps').value,defAcc=r.querySelector('#da').value,mk=r.querySelector('#nc').checked,dup=r.querySelector('#dp').checked;
        const seen=new Set(S.tx.map(x=>x.date+'|'+x.amount+'|'+(x.note||'')));let n=0,skipped=0;
        const findCat=(ty,name)=>{if(!name)return ty==='expense'?'other':'iother';const nm=String(name).trim(),low=nm.toLowerCase();let c2=S.cats[ty].find(k=>k.ar===nm||k.en.toLowerCase()===low);
          if(!c2&&mk){c2={id:'c'+uid(),ar:nm,en:nm,sys:false};S.cats[ty].splice(Math.max(0,S.cats[ty].findIndex(k=>k.sys)),0,c2)}return c2?c2.id:(ty==='expense'?'other':'iother')};
        const findAcc=name=>{if(!name)return defAcc;const low=String(name).trim().toLowerCase();const a=S.accounts.find(x=>x.name.toLowerCase()===low);return a?a.id:defAcc};
        data.forEach(rw=>{const date=parseDateAny(rw[c.date]);if(!date){skipped++;return}
          let amt=NaN,type=posType;
          if(c.debit>=0&&numAny(rw[c.debit])>0){amt=numAny(rw[c.debit]);type='expense'}else if(c.credit>=0&&numAny(rw[c.credit])>0){amt=numAny(rw[c.credit]);type='income'}
          else if(c.amount>=0){amt=numAny(rw[c.amount]);if(amt<0){type='expense';amt=-amt}}
          if(c.type>=0){const tv=String(rw[c.type]).toLowerCase();if(/income|ايراد|إيراد|دخل|دائن/.test(tv))type='income';else if(/expense|مصروف|مدين|صرف/.test(tv))type='expense'}
          if(!(amt>0)){skipped++;return}
          const note=c.note>=0?String(rw[c.note]||'').trim():'';const key=date+'|'+amt+'|'+note;if(dup&&seen.has(key)){skipped++;return}seen.add(key);
          S.tx.push({id:uid(),type,acc:c.acc>=0?findAcc(rw[c.acc]):defAcc,cat:findCat(type,c.cat>=0?rw[c.cat]:''),amount:Math.round(amt*100)/100,date,note});n++});
        closeSheet();commit(t('imported')+' '+n+(skipped?' · '+t('skippedN')+' '+skipped:''));
      };
    };
  });
}
