
const $=s=>document.querySelector(s);
function save(){
  if(typeof drv!=='undefined'&&!useWorker()&&drv.linked&&driveReady()&&!hasToken()&&Date.now()-tokenAsked>60000){
    tokenAsked=Date.now();requestToken('').then(()=>scheduleDrive()).catch(()=>{drv.needAuth=true;if(S)render()});
  }
  if(!KEYOBJ||!S)return;
  if(typeof ACT!=='undefined'&&ACT!=='me'){sharedSave();return}
  vaultSave(S);afterChange();writeReminders();
}
const money=(n,cls)=>`<span class="num ${cls||''}">${fmt(n)}</span>`;
