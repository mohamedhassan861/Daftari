const APP_VER='0.97';
setTimeout(()=>{const sp=document.getElementById('splash');if(sp)sp.remove()},2200);
(function(){
'use strict';
const KEY='daftar-elbeit-v1';
const $=s=>document.querySelector(s);
const uid=()=>Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const now=new Date();
const TODAY=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-'+pad(now.getDate());
const TODAY_YM=TODAY.slice(0,7);
const ymAdd=(ym,n)=>{let [y,m]=ym.split('-').map(Number);m+=n;y+=Math.floor((m-1)/12);m=((m-1)%12+12)%12+1;return y+'-'+pad(m)};
const ymDiff=(a,b)=>{const [y1,m1]=a.split('-').map(Number),[y2,m2]=b.split('-').map(Number);return (y2-y1)*12+(m2-m1)};

