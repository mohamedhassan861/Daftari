
const parseFreq=f=>{const m=/^(\d+):([dwmy])$/.exec(FREQ_OLD[f]||f||'');return m?{n:Math.max(1,+m[1]),u:m[2]}:{n:1,u:'m'}};
function advance(date,freq,day){
  const d=dOf(date),{n,u}=parseFreq(freq);
  if(u==='d'||u==='w')return iso(new Date(d.getTime()+n*(u==='w'?7:1)*864e5));
  let y=d.getUTCFullYear(),m=d.getUTCMonth()+(u==='y'?12*n:n);y+=Math.floor(m/12);m=m%12;
  const last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return iso(new Date(Date.UTC(y,m,Math.min(day||d.getUTCDate(),last))));
}
/* repeats are never recorded by themselves: on their day (or the day you postponed them to) they wait on the home screen for record / postpone / skip */
const recEff=r=>(r.snooze&&r.snooze[r.next])||r.next;
const recAdvance=r=>{if(r.snooze)delete r.snooze[r.next];if(r.ack)delete r.ack[r.next];r.next=advance(r.next,r.freq,r.day)};
const recLead=r=>r.lead!=null?+r.lead:remTime().lead,recFrom=r=>iso(new Date(dOf(recEff(r)).getTime()-recLead(r)*864e5));
function runRecurring(){
  if(!S||!Array.isArray(S.recur))return 0;let ch=0;
  for(const r of S.recur){let g=0;
    /* a month planned at zero, or an entry already recorded for that date, closes that occurrence */
    while(r.next<=TODAY&&g++<500){if(r.end&&r.next>r.end)break;const ovm=((S.planOver||{})[r.next.slice(0,7)]||{})['rec:'+r.id];
      if(ovm===0||S.tx.some(x=>x.id==='R'+r.id+'_'+r.next)){recAdvance(r);ch++}else break}}
  if(ch)save();return 0;
}
function recPending(){return (S&&S.recur||[]).filter(r=>(!r.end||r.next<=r.end)&&recEff(r)<=TODAY&&S.accounts.some(a=>a.id===r.tpl.acc)).sort((a,b)=>recEff(a).localeCompare(recEff(b)))}
function recQueue(){if(!S||ACT!=='me')return [];return (S.recur||[]).filter(r=>(!r.end||r.next<=r.end)&&S.accounts.some(a=>a.id===r.tpl.acc)&&!REC_LATER.has(r.id+r.next)).map(r=>{const e=recEff(r);return e<=TODAY?{r,due:true}:(recFrom(r)<=TODAY&&!(r.ack&&r.ack[r.next]))?{r,due:false}:null}).filter(Boolean).sort((a,b)=>recEff(a.r).localeCompare(recEff(b.r)))}
const freqName=f=>{if(!f)return '';const {n,u}=parseFreq(f),i=lng()==='en';
  const W={d:['يوم','يومين','أيام','day','days'],w:['أسبوع','أسبوعين','أسابيع','week','weeks'],m:['شهر','شهرين','شهور','month','months'],y:['سنة','سنتين','سنين','year','years']}[u];
  if(i)return n===1?'Every '+W[3]:'Every '+n+' '+W[4];
  return n===1?'كل '+W[0]:n===2?'كل '+W[1]:n<=10?'كل '+n+' '+W[2]:'كل '+n+' '+W[0]};
