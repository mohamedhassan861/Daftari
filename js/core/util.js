/* Small shared helpers: ids, escaping, month arithmetic, dates, number formatting, base64. */
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]
    );
  const pad = n => String(n).padStart(2, '0');
  const ymAdd = (ym, n) => {
    let [y, m] = ym.split('-').map(Number);
    m += n;
    y += Math.floor((m - 1) / 12);
    m = ((((m - 1) % 12) + 12) % 12) + 1;
    return y + '-' + pad(m);
  };
  const ymDiff = (a, b) => {
    const [y1, m1] = a.split('-').map(Number),
      [y2, m2] = b.split('-').map(Number);
    return (y2 - y1) * 12 + (m2 - m1);
  };
  const lng = () => (S && S.lang) || LANG;
  const t = k => (T[k] || [k, k])[lng() === 'en' ? 1 : 0];
  const toB64 = buf => {
    const u = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  /* ---------- helpers ---------- */
  const L = () => (S.lang === 'en' ? 'en-GB' : 'ar-EG-u-nu-latn');
  const fmt = n => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US', {maximumFractionDigits: 2});
  const monthLbl = ym => {
    const [y, m] = ym.split('-').map(Number);
    return new Intl.DateTimeFormat(L(), {month: 'long', year: 'numeric'}).format(new Date(y, m - 1, 1));
  };
  const monthShort = ym => {
    const [y, m] = ym.split('-').map(Number);
    return new Intl.DateTimeFormat(L(), {month: 'short'}).format(new Date(y, m - 1, 1));
  };
  const wdOf = dt => new Intl.DateTimeFormat(L(), {weekday: 'short'}).format(dt);
  const dmyOf = dt => '\u200E' + pad(dt.getDate()) + '/' + pad(dt.getMonth() + 1) + '/' + dt.getFullYear() + '\u200E';
  const dateOf = dt => wdOf(dt) + ' ' + dmyOf(dt);
  const hmOf = dt => pad(dt.getHours()) + ':' + pad(dt.getMinutes());
  const dsDate = ds => {
    const [y, m, d] = ds.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const dayLbl = ds => dateOf(dsDate(ds));
  const initial = s => (s || '?').trim().charAt(0);
  const sum = a => a.reduce((x, y) => x + (+y.amount || 0), 0);

  /* ---------- statements (كشف حساب): مدين = خارج/مصروف, دائن = داخل/توريد ---------- */
  const byDate = (a, b) => a.date.localeCompare(b.date) || (a.ord || 0) - (b.ord || 0);
  const shortDate = ds => dateOf(dsDate(ds));
  const normDigits = x =>
    String(x || '')
      .replace(/[٠-٩]/g, d => AR_DIG.indexOf(d))
      .replace(/[۰-۹]/g, d => FA_DIG.indexOf(d))
      .replace(/٫/g, '.')
      .replace(/٬/g, ',');
  const dOf = s => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };
  const iso = d => d.toISOString().slice(0, 10);
  const colLbl = (m, n) => (n > 6 ? (m.endsWith('-01') ? '1/' + m.slice(2, 4) : String(+m.slice(5))) : monthShort(m));
  const numv = (r, id) => parseFloat(val(r, id).replace(/,/g, '')) || 0;
  const dayBefore = d => iso(new Date(dOf(d).getTime() - 864e5));
  const monthEnd = ym => {
    const [y, m] = ym.split('-').map(Number);
    return ym + '-' + pad(new Date(y, m, 0).getDate());
  };

  /* ---------- backup ---------- */
  const fileStamp = () => {
    const d = new Date();
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      '_' +
      pad(d.getHours()) +
      '-' +
      pad(d.getMinutes()) +
      '-' +
      pad(d.getSeconds())
    );
  };
  const toB64u = b => toB64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const fromB64u = x => fromB64(x.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (x.length % 4)) % 4));
  const hmStr = m => pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  const userTZ = () => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
    } catch (e) {
      return 'Africa/Cairo';
    }
  };
  const keyBytes = k =>
    Uint8Array.from(atob(k.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (k.length % 4)) % 4)), c =>
      c.charCodeAt(0)
    );
