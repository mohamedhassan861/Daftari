
function listen(cb){
  if(!SpeechRec){toast(t('noVoice'));return}goingOut();
  const r=new SpeechRec();r.lang=lng()==='en'?'en-US':'ar-EG';r.interimResults=false;r.maxAlternatives=1;
  let got=false;
  r.onresult=e=>{got=true;toastOff(t('listening'));cb(e.results[0][0].transcript)};
  r.onerror=e=>{got=true;const c=e&&e.error;toast(c==='not-allowed'||c==='service-not-allowed'?t('micDenied'):c==='network'?t('voiceNet'):c==='aborted'?t('voiceStop'):t('voiceFail'))};
  r.onend=()=>{if(!got)toast(t('voiceFail'));else toastOff(t('listening'))};
  try{r.start();toast(t('listening'),0)}catch(e){toast(t('voiceFail'))}
}
function quickFromText(text){const p=parseEntry(text);if(!p||!p.amount){toast(t('parseFail'));txForm(null,'',p?{note:p.note}:{});return}txForm(null,'',p)}
