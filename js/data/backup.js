
const backupName=()=>'daftari_'+fileStamp()+'.json';
function lastBackupLbl(){let v=null;try{v=localStorage.getItem('daftar-elbeit-lastbackup')}catch(e){}
  if(!v)return t('never');return dateOf(new Date(v))+' '+hmOf(new Date(v))}
function markBackup(){try{localStorage.setItem('daftar-elbeit-lastbackup',new Date().toISOString())}catch(e){}}
async function makeBackup(){
  await saving;const {iv,ct}=await seal(KEYOBJ,PS||S);
  return JSON.stringify({app:'daftar-elbeit',enc:1,v:2,created:new Date().toISOString(),salt:toB64(SALT),iter:ITER,iv,ct});
}
async function getDownloads(){try{return window.claude&&window.claude.use?await window.claude.use('downloads'):null}catch(e){return null}}
function markChange(){try{localStorage.setItem(LASTCHG,new Date().toISOString())}catch(e){}}
function backupDue(){
  let lc=null,lb=null;try{lc=localStorage.getItem(LASTCHG);lb=localStorage.getItem('daftar-elbeit-lastbackup')}catch(e){}
  if(!lc)return false;if(!lb)return Date.now()-new Date(lc).getTime()>3600e3;
  return new Date(lc)>new Date(lb)&&Date.now()-new Date(lb).getTime()>864e5;
}
