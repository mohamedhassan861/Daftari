

/* ---------- receipt photos: shrunk, encrypted on the phone, stored in the Drive folder ---------- */
async function rcptKey(){if(!S.rk)S.rk=toB64(crypto.getRandomValues(new Uint8Array(32)));return crypto.subtle.importKey('raw',fromB64(S.rk),'AES-GCM',false,['encrypt','decrypt'])}
async function shrinkImage(file){
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
    const k=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return await new Promise(res=>c.toBlob(b=>res(b),'image/jpeg',0.8));
  }finally{URL.revokeObjectURL(url)}
}
async function uploadReceipt(tx,file){
  if(!drv.linked){toast(t('rcptNeedDrive'));return}
  try{
    if(!(await ensureAccess())){toast(t('driveNeedAuth'));drv.needAuth=true;render();return}
    const jpg=await shrinkImage(file),iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},await rcptKey(),await jpg.arrayBuffer());
    const folder=await ensureFolder(),bd='rc'+uid(),meta=JSON.stringify({name:'receipt_'+tx.id+'.bin',parents:[folder],mimeType:'application/octet-stream'});
    const body=new Blob(['--'+bd+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+meta+'\r\n--'+bd+'\r\nContent-Type: application/octet-stream\r\n\r\n',iv,new Uint8Array(ct),'\r\n--'+bd+'--']);
    const j=await (await gfetch(GAPI+'/upload/drive/v3/files?uploadType=multipart&fields=id',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+bd},body})).json();
    const x=S.tx.find(v=>v.id===tx.id);if(x){if(x.rcpt)gfetch('/drive/v3/files/'+x.rcpt,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})}).catch(()=>{});x.rcpt=j.id;commit(t('rcptSaved'))}
  }catch(e){toast(t('rcptFail'))}
}
async function showReceipt(id){
  const x=S.tx.find(v=>v.id===id);if(!x||!x.rcpt)return;
  try{if(!(await ensureAccess())){if(useWorker())await authorize(false);else await requestToken('')}
    const buf=new Uint8Array(await (await gfetch('/drive/v3/files/'+x.rcpt+'?alt=media')).arrayBuffer());
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:buf.slice(0,12)},await rcptKey(),buf.slice(12));
    const u=URL.createObjectURL(new Blob([pt],{type:'image/jpeg'}));
    openSheet(t('receipt'),`<div class="form"><img src="${u}" alt="" style="width:100%;border-radius:12px"><button type="button" class="btn block" data-sact="tx" data-id="${x.id}">${t('back')}</button></div>`);
  }catch(e){toast(t('rcptFail'))}
}
