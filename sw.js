// Network first, cache as fallback, so updates show up right away and the app still opens offline.
const CACHE = 'daftari-v107';
const SHELL = ["./", "./index.html", "./config.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./js/boot.js?v=1.00", "./css/app-1.css?v=1.00", "./css/app-2.css?v=1.00", "./css/app-3.css?v=1.00", "./css/app-4.css?v=1.00", "./css/app-5.css?v=1.00", "./css/app-6.css?v=1.00", "./css/app-7.css?v=1.00", "./css/app-8.css?v=1.00", "./js/core/start.js?v=1.00", "./js/core/util.js?v=1.00", "./js/data/store.js?v=1.00", "./js/data/backup.js?v=1.00", "./js/engine/accounts.js?v=1.00", "./js/engine/loans.js?v=1.00", "./js/engine/currency.js?v=1.00", "./js/engine/recurring.js?v=1.00", "./js/engine/statements.js?v=1.00", "./js/engine/quick-parse.js?v=1.00", "./js/engine/networth.js?v=1.00", "./js/engine/period.js?v=1.00", "./js/engine/obligations.js?v=1.00", "./js/engine/records.js?v=1.00", "./js/engine/cards.js?v=1.00", "./js/engine/plan-1.js?v=1.00", "./js/engine/plan-2.js?v=1.00", "./js/engine/close-month.js?v=1.00", "./js/engine/cashflow-1.js?v=1.00", "./js/engine/cashflow-2.js?v=1.00", "./js/engine/why-1.js?v=1.00", "./js/engine/why-2.js?v=1.00", "./js/engine/why-3.js?v=1.00", "./js/engine/reminders.js?v=1.00", "./js/engine/settle.js?v=1.00", "./js/io/export.js?v=1.00", "./js/io/import.js?v=1.00", "./js/ui/app.js?v=1.00", "./js/ui/accounts.js?v=1.00", "./js/ui/recurring.js?v=1.00", "./js/ui/statements-1.js?v=1.00", "./js/ui/statements-2.js?v=1.00", "./js/ui/quick.js?v=1.00", "./js/ui/safe-goals.js?v=1.00", "./js/ui/gam-calc.js?v=1.00", "./js/ui/obligations.js?v=1.00", "./js/ui/sheet.js?v=1.00", "./js/ui/forms-1.js?v=1.00", "./js/ui/forms-2.js?v=1.00", "./js/ui/forms-3.js?v=1.00", "./js/ui/forms-4.js?v=1.00", "./js/ui/forms-5.js?v=1.00", "./js/ui/views-1.js?v=1.00", "./js/ui/views-2.js?v=1.00", "./js/ui/cards-1.js?v=1.00", "./js/ui/cards-2.js?v=1.00", "./js/ui/plan-1.js?v=1.00", "./js/ui/plan-2.js?v=1.00", "./js/ui/close-month.js?v=1.00", "./js/ui/cashflow-1.js?v=1.00", "./js/ui/cashflow-2.js?v=1.00", "./js/ui/render-1.js?v=1.00", "./js/ui/render-2.js?v=1.00", "./js/ui/render-3.js?v=1.00", "./js/ui/backup.js?v=1.00", "./js/sync/drive-1.js?v=1.00", "./js/sync/drive-2.js?v=1.00", "./js/sync/receipts.js?v=1.00", "./js/sync/shared-1.js?v=1.00", "./js/sync/shared-2.js?v=1.00", "./js/sync/shared-3.js?v=1.00", "./js/sync/signup.js?v=1.00", "./js/sync/reminders.js?v=1.00", "./js/sync/settle.js?v=1.00", "./js/security/lock-1.js?v=1.00", "./js/security/lock-2.js?v=1.00", "./js/security/lock-3.js?v=1.00", "./js/core/today.js?v=1.00", "./js/core/strings-1.js?v=1.00", "./js/core/strings-2.js?v=1.00", "./js/core/strings-3.js?v=1.00", "./js/core/strings-4.js?v=1.00", "./js/core/strings-5.js?v=1.00", "./js/core/setup-1.js?v=1.00", "./js/core/setup-2.js?v=1.00", "./js/core/startup.js?v=1.00"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('version.json')) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' }).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// ---- reminders: the server only wakes us; the list of due items is written by the app ----
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('daftari-sw', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbGet = async (k) => { const db = await idb(); return new Promise(res => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); }); };
const idbSet = async (k, v) => { const db = await idb(); return new Promise(res => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); };
const localDay = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    const list = (await idbGet('reminders')) || [], shown = (await idbGet('shown')) || {};
    const lead = +((await idbGet('lead')) ?? 1), now = new Date(), today = localDay(now), last = localDay(new Date(now.getTime() + lead * 864e5));
    const due = list.filter(r => r.date >= today && (r.from ? r.from <= today : r.date <= last) && !shown[r.id + '@' + today]);
    const title = (await idbGet('title')) || 'دفتري';
    if (!due.length) { if ((await idbGet('test')) === 1) { await idbSet('test', 0); return self.registration.showNotification(title, { body: '✓', tag: 'daftari-test', icon: 'icon-192.png', badge: 'icon-192.png' }); } return; }
    for (const r of due.slice(0, 5)) {
      shown[r.id + '@' + today] = 1;
      await self.registration.showNotification(r.title || title, { body: r.body || '', tag: r.id, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } });
    }
    const cut = localDay(new Date(now.getTime() - 30 * 864e5));
    for (const k of Object.keys(shown)) if (k.slice(-10) < cut) delete shown[k];
    await idbSet('shown', shown);
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => { for (const c of cs) { if ('focus' in c) return c.focus(); } return self.clients.openWindow('./'); }));
});
