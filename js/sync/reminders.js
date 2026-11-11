/* Phone notifications for reminders. */
  /* ---------- reminders: the app writes upcoming due items; a daily push wakes the phone to show them ---------- */
  const pIdb = () =>
    new Promise((res, rej) => {
      const r = indexedDB.open('daftari-sw', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  const pSet = async (k, v) => {
    try {
      const db = await pIdb();
      await new Promise(res => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(v, k);
        tx.oncomplete = res;
        tx.onerror = res;
      });
    } catch (e) {}
  };
  const pGet = async k => {
    try {
      const db = await pIdb();
      return await new Promise(res => {
        const q = db.transaction('kv').objectStore('kv').get(k);
        q.onsuccess = () => res(q.result);
        q.onerror = () => res(undefined);
      });
    } catch (e) {
      return undefined;
    }
  };
  /* updating while open: keep the session for one reload only (a one-time key that cannot be read out, valid 60 seconds, deleted on use) */
  async function keepSession() {
    try {
      if (!PINMEM) return;
      await saving;
      const k = await crypto.subtle.generateKey({name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']),
        iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, k, new TextEncoder().encode(PINMEM));
      await pSet('resume', {k, iv, ct, at: Date.now()});
    } catch (e) {}
  }
  async function takeSession() {
    try {
      const r = await pGet('resume');
      if (!r) return null;
      await pSet('resume', null);
      if (Date.now() - r.at > 60000 || Date.now() < r.at) return null;
      return new TextDecoder().decode(await crypto.subtle.decrypt({name: 'AES-GCM', iv: r.iv}, r.k, r.ct));
    } catch (e) {
      return null;
    }
  }
  function writeReminders() {
    if (!('indexedDB' in window) || !PS) return;
    pSet('reminders', upcomingReminders(PS));
    pSet('title', t('app'));
    pSet('lead', remTime().lead);
  }
  const remTime = () => {
    let o = null;
    try {
      o = JSON.parse(localStorage.getItem(REMT_KEY) || 'null');
    } catch (e) {}
    return Object.assign({hm: 540, lead: 1}, o || {});
  };
  async function remTimeSave(hm, lead) {
    const o = {hm, lead};
    try {
      localStorage.setItem(REMT_KEY, JSON.stringify(o));
    } catch (e) {}
    pSet('lead', lead);
    if (pushOn()) {
      try {
        const reg = await navigator.serviceWorker.ready,
          sub = await reg.pushManager.getSubscription();
        if (sub) await workerPost('/push/subscribe', {sub: sub.toJSON(), hm, tz: userTZ()});
      } catch (e) {
        toast(t('pushFail'));
        return;
      }
    }
    toast(t('saved'));
  }
  const pushOn = () => {
    try {
      return localStorage.getItem('daftari-push') === '1';
    } catch (e) {
      return false;
    }
  };
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  async function pushEnable() {
    if (!pushSupported()) {
      toast(t('pushUnsupported'));
      return;
    }
    try {
      if ((await Notification.requestPermission()) !== 'granted') {
        toast(t('pushDenied'));
        return;
      }
      const reg = await navigator.serviceWorker.ready,
        {key} = await workerPost('/push/key', {});
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: keyBytes(key)});
      const rt = remTime();
      await workerPost('/push/subscribe', {sub: sub.toJSON(), hm: rt.hm, tz: userTZ()});
      pSet('lead', rt.lead);
      try {
        localStorage.setItem('daftari-push', '1');
      } catch (e) {}
      writeReminders();
      toast(t('pushOnMsg'));
      render();
    } catch (e) {
      toast(t('pushFail'));
    }
  }
  async function pushDisable() {
    try {
      const reg = await navigator.serviceWorker.ready,
        sub = await reg.pushManager.getSubscription();
      if (sub) {
        await workerPost('/push/unsubscribe', {sub: sub.toJSON()}).catch(() => {});
        await sub.unsubscribe();
      }
    } catch (e) {}
    try {
      localStorage.removeItem('daftari-push');
    } catch (e) {}
    render();
  }
  async function pushSub() {
    if (!pushSupported()) throw new Error('unsupported');
    if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted')
      throw new Error('denied');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const {key} = await workerPost('/push/key', {});
      sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: keyBytes(key)});
    }
    const rt = remTime();
    await workerPost('/push/subscribe', {sub: sub.toJSON(), hm: rt.hm, tz: userTZ()});
    try {
      localStorage.setItem('daftari-push', '1');
    } catch (e) {}
    return {reg, sub};
  }
  async function pushTest() {
    let step = 'sub';
    try {
      const {reg, sub} = await pushSub();
      step = 'local';
      await reg.showNotification(t('app'), {
        body: t('pushLocalOk'),
        tag: 'daftari-local-test',
        icon: 'icon-192.png',
        badge: 'icon-192.png'
      });
      step = 'server';
      await pSet('test', 1);
      const r = await workerPost('/push/test', {sub: sub.toJSON()});
      if (!r.ok) {
        if (r.status === 404 || r.status === 410) {
          await sub.unsubscribe().catch(() => {});
          await pushSub();
          toast(t('pushRenewed'), 6000);
          return;
        }
        throw new Error('push ' + r.status);
      }
      toast(t('pushSent'), 6000);
    } catch (e) {
      const m = String((e && e.message) || e);
      toast(
        m === 'denied'
          ? t('pushDenied')
          : m === 'unsupported'
            ? t('pushUnsupported')
            : t('pushFailAt')
                .replace(
                  '%s',
                  step === 'sub' ? t('pushStepSub') : step === 'local' ? t('pushStepLocal') : t('pushStepServer')
                )
                .replace('%e', m),
        8000
      );
    }
  }
  /* if reminders are on but this phone lost its subscription (or the server list was cleared), sign it up again quietly */
  async function pushKeep() {
    try {
      if (!pushOn() || !pushSupported() || Notification.permission !== 'granted') return;
      await pushSub();
    } catch (e) {}
  }
