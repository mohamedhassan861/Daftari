/* Daftari loader.
   The app is kept in several files so each part can be read and reviewed on its own, but it still runs as ONE script:
   the parts are fetched in order, joined and run together. That keeps everything inside the single private closure the
   app has always used, so the decrypted data, the PIN and the keys never become globals that other scripts on the page
   (such as Google's sign-in script) could read. The order below matters. */
(function(){
  var V='0.97';
  var FILES=[
    "core/start.js",
    "core/strings.js",
    "core/data.js",
    "core/accounts.js",
    "engine/recurring.js",
    "io/export.js",
    "engine/statements.js",
    "ui/quick.js",
    "engine/safe-goals.js",
    "ui/gam-calc.js",
    "engine/obligations.js",
    "ui/sheet.js",
    "ui/forms.js",
    "ui/views.js",
    "engine/cards.js",
    "engine/plan.js",
    "engine/close-month.js",
    "engine/cashflow-1.js",
    "engine/cashflow-2.js",
    "ui/render.js",
    "core/backup.js",
    "sync/drive.js",
    "sync/receipts.js",
    "sync/shared.js",
    "sync/signup.js",
    "sync/reminders.js",
    "io/import.js",
    "sync/settle.js",
    "security/lock.js"
  ];
  /* the app's own registration waits for the page "load" event, which fires before the parts arrive; register here */
  if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
  Promise.all(FILES.map(function(f){return fetch('js/'+f+'?v='+V).then(function(r){if(!r.ok)throw new Error(f);return r.text()})}))
    .then(function(parts){var s=document.createElement('script');s.textContent=parts.join('');document.body.appendChild(s)})
    .catch(function(){var p=document.createElement('p');p.style.cssText='position:fixed;inset:auto 0 40% 0;text-align:center;padding:20px;font-family:system-ui;z-index:99999;background:#fff;color:#17201C';
      p.textContent='\u062a\u0639\u0630\u0651\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0628\u0631\u0646\u0627\u0645\u062c. \u0627\u062a\u0623\u0643\u062f \u0645\u0646 \u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a \u0648\u0627\u0641\u062a\u062d\u0647 \u062a\u0627\u0646\u064a. \u00b7 The app could not load; check the connection and open it again.';document.body.appendChild(p)});
})();
