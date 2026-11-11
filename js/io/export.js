
function loadXLSX(){if(window.XLSX)return Promise.resolve(window.XLSX);if(XLSXP)return XLSXP;
  XLSXP=new Promise((res,rej)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';sc.onload=()=>res(window.XLSX);sc.onerror=()=>{XLSXP=null;rej(new Error('xlsx'))};document.head.appendChild(sc)});return XLSXP}
async function deliverFile(blob,name){goingOut();
  let file=null;try{file=new File([blob],name,{type:blob.type})}catch(e){}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})&&/Android|iPhone|iPad/i.test(navigator.userAgent)){
    try{await navigator.share({files:[file],title:name});return}catch(e){if(e&&e.name==='AbortError')return}
  }
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);
}
const fileBase=title=>('daftari_'+title).replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'_').slice(0,60)+'_'+TODAY;
function exportSheet(d){
  const isD=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v),dmyTxt=v=>v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4);
  const clean=v=>typeof v==='string'?v.replace(/[\u2066-\u2069\u200E]/g,''):v,asTxt=rows=>rows.map(r=>r.map(v=>isD(v)?dmyTxt(v):clean(v))),asDate=rows=>rows.map(r=>r.map(v=>isD(v)?new Date(+v.slice(0,4),+v.slice(5,7)-1,+v.slice(8,10)):v));
  const asTxtKeep=rows=>rows.map(r=>r.map(v=>isD(v)?v:clean(v)));const D0=d;d=Object.assign({},D0,{rows:asTxt(D0.rows),foot:D0.foot&&asTxt(D0.foot),title:clean(D0.title),sub:isD(D0.sub)?dmyTxt(D0.sub):clean(D0.sub)});
  /* d: {title, sub, cols:[...], rows:[[...]], num:[col indexes], foot:[[...]]} */
  openSheet(t('export')+' · '+d.title,`<div class="form"><p class="hint">${esc(d.sub||'')} · ${d.rows.length} ${t('rowsWord')}</p>
    <button class="btn pri block" id="xx">Excel (.xlsx)</button><button class="btn block" id="xc">CSV</button><button class="btn block" id="xp">PDF</button>
    <p class="hint">${t('exportHint2')}</p></div>`,r=>{
    r.querySelector('#xc').onclick=()=>{const q=v=>{v=v==null?'':String(v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
      const lines=[[d.title],[d.sub||''],[],d.cols,...d.rows,...(d.foot||[])].map(r=>r.map(q).join(','));
      deliverFile(new Blob(['﻿'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'}),fileBase(d.title)+'.csv')};
    r.querySelector('#xx').onclick=async()=>{try{const X=await loadXLSX();
      const ws=X.utils.aoa_to_sheet([[d.title],[d.sub||''],[],d.cols,...asDate(asTxtKeep(D0.rows)),...asDate(asTxtKeep(D0.foot||[]))],{cellDates:true,dateNF:'dd/mm/yyyy'});ws['!cols']=d.cols.map((c,i)=>({wch:(d.num||[]).includes(i)?14:Math.max(12,Math.min(40,String(c).length+8))}));
      const wb=X.utils.book_new();wb.Workbook={Views:[{RTL:lng()!=='en'}]};X.utils.book_append_sheet(wb,ws,'Daftari');
      deliverFile(new Blob([X.write(wb,{type:'array',bookType:'xlsx'})],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),fileBase(d.title)+'.xlsx')}
      catch(e){toast(t('exportFail'))}};
    r.querySelector('#xp').onclick=()=>printDoc(d);
  });
}
function docHTML(d){
  const dir=lng()==='en'?'ltr':'rtl',cell=(v,i)=>`<td class="${(d.num||[]).includes(i)?'n':''}">${esc(v==null?'':(typeof v==='number'?fmt(v):v))}</td>`;
  const html=`<!doctype html><html lang="${lng()}" dir="${dir}"><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>
    @page{size:A4;margin:14mm}body{font-family:'IBM Plex Sans Arabic',Tahoma,Arial,sans-serif;color:#17201C;font-size:11px}
    h1{font-size:18px;margin:0 0 2px}p{margin:0 0 12px;color:#5B6962}table{width:100%;border-collapse:collapse}
    th{background:#E6EAE3;text-align:start;padding:6px;border:1px solid #D3DAD1;font-size:10.5px}td{padding:5px 6px;border:1px solid #D3DAD1;vertical-align:top}
    td.n{text-align:end;white-space:nowrap;direction:ltr;font-variant-numeric:tabular-nums}tfoot td{font-weight:700;background:#F2F4EF}.brand{float:${dir==='rtl'?'left':'right'};color:#1D6A50;font-weight:700}
  </style></head><body><div class="brand">${esc(t('app'))}</div><h1>${esc(d.title)}</h1><p>${esc(d.sub||'')} · ${esc(dateOf(new Date()))}</p>
  <table><thead><tr>${d.cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${d.rows.map(r=>`<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody>
  ${d.foot&&d.foot.length?`<tfoot>${d.foot.map(r=>`<tr>${r.map(cell).join('')}</tr>`).join('')}</tfoot>`:''}</table>${d.note?`<p style="margin-top:12px">${esc(d.note)}</p>`:''}</body></html>`;
  return html}
function printDoc(d){goingOut();const html=docHTML(d);
  let fr=document.getElementById('printFrame');if(fr)fr.remove();
  fr=document.createElement('iframe');fr.id='printFrame';fr.style.cssText='position:fixed;width:0;height:0;border:0;right:0;bottom:0';document.body.appendChild(fr);
  const w=fr.contentWindow;w.document.open();w.document.write(html);w.document.close();
  setTimeout(()=>{try{w.focus();w.print()}catch(e){const u=URL.createObjectURL(new Blob([html],{type:'text/html'}));window.open(u,'_blank')}},300);
}
function exportStmt(){
  const o=lastStmt;if(!o)return;
  const av=o.out.some(r=>r.av!=null),lim=o.acc&&+o.acc.limit||0;
  exportSheet({title:o.title,sub:o.sub+(o.cur&&o.cur!==BASE()?' · '+curName(o.cur):' · '+curName(BASE())),cols:[t('date'),t('desc'),t('dr'),t('cr'),t('balCol'),''].concat(av?[t('cardAvail')]:[]),num:av?[2,3,4,6]:[2,3,4],
    rows:o.out.map(r=>[r.date,r.desc,r.dr||'',r.cr||'',Math.abs(r.bal),r.lbl].concat(av?[r.av!=null?r.av:lim+Math.min(0,r.bal)]:[])),foot:[['',t('total'),o.tdr,o.tcr,Math.abs(o.bal),o.lblEnd].concat(av?[lim+Math.min(0,o.bal)]:[])]});
}
function exportTx(list,title){
  const rows=list.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(x=>{const a=accOf(x.acc),b=x.toAcc?accOf(x.toAcc):null;
    return [x.date,x.type==='income'?t('inc1'):x.type==='expense'?t('exp1'):t('transfer'),a.name,a.currency,x.type==='transfer'?(b?b.name+' '+b.currency:''):catPath(x.cat),x.note||'',+x.amount,x.type==='transfer'?'':Math.round(baseAmt(x)*100)/100]});
  exportSheet({title,sub:perLabel(),cols:[t('date'),t('typeCol'),t('account'),t('currency'),t('category'),t('note'),t('amount'),t('amount')+' ('+BASE()+')'],num:[6,7],rows});
}
