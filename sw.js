// Network first, cache as fallback, so updates show up right away and the app still opens offline.
const CACHE = 'daftari-v84';
const SHELL = ['./', './index.html', './config.js', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
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
    const due = list.filter(r => r.date >= today && r.date <= last && !shown[r.id + '@' + today]);
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
