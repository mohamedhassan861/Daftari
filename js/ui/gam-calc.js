

/* ---------- gam'eya calculator: what each turn is worth against a savings rate ---------- */
function gamCalc(){
  openSheet(t('gamCalc'),`<form class="form" id="f">
    <div class="two"><label class="fld"><span>${t('share')}</span><input class="in-f num" id="sh" inputmode="decimal" value="2000"></label>
    <label class="fld"><span>${t('members')}</span><input class="in-f num" id="mb" inputmode="numeric" value="10"></label></div>
    <label class="fld"><span>${t('altRate')}</span><input class="in-f num" id="rt" inputmode="decimal" value="20"></label>
    <div id="out"></div><p class="hint">${t('gamCalcHint')}</p></form>`,r=>{
    const calc=()=>{const sh=numv(r,'sh'),n=Math.max(2,Math.min(60,parseInt(val(r,'mb'))||0)),rt=(parseFloat(val(r,'rt'))||0)/100/12;
      if(!sh||!n){r.querySelector('#out').innerHTML='';return}
      const pv=k=>{let v=sh*n/Math.pow(1+rt,k-1);for(let m=0;m<n;m++)v-=sh/Math.pow(1+rt,m);return v};
      const rows=Array.from({length:n},(_,i)=>({k:i+1,v:pv(i+1)}));const best=rows.reduce((a,b)=>b.v>a.v?b:a);
      r.querySelector('#out').innerHTML=`<div class="tblw"><table class="stmt"><thead><tr><th>${t('turnCol')}</th><th>${t('payoutMonth')}</th><th>${t('vsSaving')}</th></tr></thead><tbody>${rows.map(o=>`<tr><td>${o.k}</td><td class="d">${t('monthN')} ${o.k}</td><td class="n ${o.v>=0?'pos':'neg'}">${o.v>=0?'+':'−'}${fmt(Math.abs(Math.round(o.v)))}</td></tr>`).join('')}</tbody></table></div>
        <p class="hint">${t('gamTotal')}: ${fmt(sh*n)} · ${t('gamBest')} ${best.k}</p>`};
    r.querySelectorAll('input').forEach(i=>i.oninput=calc);calc();
    r.querySelector('#f').onsubmit=e=>e.preventDefault();
  });
}
function periodForm(){
  let mode=per.mode;const y=+cur.slice(0,4),m=+cur.slice(5,7),ty=+TODAY.slice(0,4);
  const years=[...new Set(S.tx.map(x=>+x.date.slice(0,4)))];const y0=Math.min(ty-5,...years),y1=Math.max(ty+1,...years);
  const yOpts=Array.from({length:y1-y0+1},(_,i)=>y1-i).map(v=>`<option value="${v}" ${v===y?'selected':''}>${v}</option>`).join('');
  const mOpts=Array.from({length:12},(_,i)=>i+1).map(v=>`<option value="${v}" ${v===m?'selected':''}>${esc(new Intl.DateTimeFormat(L(),{month:'long'}).format(new Date(2026,v-1,1)))}</option>`).join('');
  const qn=lng()==='en'?['Q1 (Jan–Mar)','Q2 (Apr–Jun)','Q3 (Jul–Sep)','Q4 (Oct–Dec)']:['الربع الأول (يناير–مارس)','الربع التاني (أبريل–يونيو)','الربع التالت (يوليو–سبتمبر)','الربع الرابع (أكتوبر–ديسمبر)'];
  const hn=lng()==='en'?['H1 (Jan–Jun)','H2 (Jul–Dec)']:['النص الأول (يناير–يونيو)','النص التاني (يوليو–ديسمبر)'];
  const opts=[['month',t('pMonth')],['quarter',t('pQuarter')],['half',t('pHalf')],['year',t('pYear')],['custom',t('pCustom')]];
  openSheet(t('period'),`<form class="form" id="f">
    <div class="seg" id="pm" style="flex-wrap:wrap">${opts.map(([v,l])=>`<button type="button" data-v="${v}" class="${v===mode?'on':''}">${esc(l)}</button>`).join('')}</div>
    <div class="two" id="pick">
      <label class="fld" id="wm"><span>${t('pMonth')}</span><select class="in-f" id="sm">${mOpts}</select></label>
      <label class="fld" id="wq"><span>${t('pQuarter')}</span><select class="in-f" id="sq">${qn.map((l,i)=>`<option value="${i+1}" ${Math.floor((m-1)/3)===i?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="fld" id="wh"><span>${t('pHalf')}</span><select class="in-f" id="sh">${hn.map((l,i)=>`<option value="${i+1}" ${(m<=6?0:1)===i?'selected':''}>${l}</option>`).join('')}</select></label>
      <label class="fld" id="wy"><span>${t('pYear')}</span><select class="in-f" id="sy">${yOpts}</select></label>
    </div>
    <div id="pc">
      <div class="qchips" style="padding:0 0 8px;flex-wrap:wrap;overflow:visible">${[['qLastM',t('qLastM')],['qThisM',t('qThisM')],['qNextM',t('qNextM')],['q3M',t('q3M')],['qN3M',t('qN3M')],['qYTD',t('qYTD')],['qRestY',t('qRestY')]].map(([v,l])=>`<button type="button" class="balchip" data-q="${v}">${esc(l)}</button>`).join('')}</div>
      ${['f','t'].map(w=>{const [yy,mm,dd]=((w==='f'?per.from:per.to)||TODAY).split('-').map(Number);return `<div class="fld"><span>${w==='f'?t('pFrom'):t('pTo')}</span><div class="dmy" style="display:grid;grid-template-columns:minmax(0,.8fr) minmax(0,1.6fr) minmax(0,1fr);gap:6px">
        <select class="in-f" id="p${w}d">${Array.from({length:31},(_,i)=>`<option value="${i+1}" ${i+1===dd?'selected':''}>${i+1}</option>`).join('')}</select>
        <select class="in-f" id="p${w}m">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===mm?'selected':''}>${esc(new Intl.DateTimeFormat(L(),{month:'long'}).format(new Date(2026,i,1)))}</option>`).join('')}</select>
        <select class="in-f" id="p${w}y">${Array.from({length:y1-y0+1},(_,i)=>y1-i).map(v=>`<option value="${v}" ${v===yy?'selected':''}>${v}</option>`).join('')}</select></div></div>`}).join('')}
    </div>
    <div class="foot"><button type="button" class="btn grow" id="pnow">${t('pNow')}</button><button class="btn pri grow">${t('apply')}</button></div>
  </form>`,r=>{
    const $r=q=>r.querySelector(q);
    const show=()=>{$r('#pick').hidden=mode==='custom';$r('#pc').hidden=mode!=='custom';$r('#wm').hidden=mode!=='month';$r('#wq').hidden=mode!=='quarter';$r('#wh').hidden=mode!=='half'};
    bindSeg(r,'pm',v=>{mode=v;show()});show();
    const getD=w=>{const y=+$r('#p'+w+'y').value,m=+$r('#p'+w+'m').value,d=Math.min(+$r('#p'+w+'d').value,new Date(y,m,0).getDate());return y+'-'+pad(m)+'-'+pad(d)};
    const setD=(w,ds)=>{const [y,m,d]=ds.split('-').map(Number);const ys=$r('#p'+w+'y');if(![...ys.options].some(o=>+o.value===y))ys.add(new Option(y,y));ys.value=y;$r('#p'+w+'m').value=m;$r('#p'+w+'d').value=d};
    ['f','t'].forEach(w=>['m','y'].forEach(z=>$r('#p'+w+z).addEventListener('change',()=>setD(w,getD(w)))));
    r.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const q=b.dataset.q,lm=ymAdd(TODAY_YM,-1);
      const nm=ymAdd(TODAY_YM,1),[f,to]=q==='qThisM'?[TODAY_YM+'-01',monthEnd(TODAY_YM)]:q==='qLastM'?[lm+'-01',monthEnd(lm)]:q==='qNextM'?[nm+'-01',monthEnd(nm)]:q==='q3M'?[ymAdd(TODAY_YM,-2)+'-01',monthEnd(TODAY_YM)]:q==='qN3M'?[nm+'-01',monthEnd(ymAdd(TODAY_YM,3))]:q==='qRestY'?[TODAY,TODAY.slice(0,4)+'-12-31']:[TODAY.slice(0,4)+'-01-01',TODAY];
      setD('f',f);setD('t',to)});
    $r('#pnow').onclick=()=>{per.mode=mode;cur=TODAY_YM;if(mode==='custom'){per.from=TODAY_YM+'-01';per.to=TODAY}closeSheet();render()};
    $r('#f').onsubmit=e=>{e.preventDefault();per.mode=mode;const yy=$r('#sy').value;
      if(mode==='custom'){const a=getD('f'),b=getD('t');per.from=a<=b?a:b;per.to=a<=b?b:a}
      else cur=yy+'-'+pad(mode==='month'?+$r('#sm').value:mode==='quarter'?(+$r('#sq').value-1)*3+1:mode==='half'?(+$r('#sh').value===1?1:7):1);
      closeSheet();render()};
  });
}
/* share the app link */
async function shareApp(){
  const url=location.origin+location.pathname.replace(/index\.html$/,'');
  const data={title:t('app'),text:t('shareText'),url};
  try{if(navigator.share){await navigator.share(data);return}}catch(e){if(e&&e.name==='AbortError')return}
  try{await navigator.clipboard.writeText(url);toast(t('linkCopied'))}catch(e){openSheet(t('shareApp'),`<div class="form"><input class="in-f" readonly value="${esc(url)}" id="lk"></div>`,r=>{const i=r.querySelector('#lk');i.focus();i.select()})}
}
