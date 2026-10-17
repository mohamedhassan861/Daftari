// Daftari auth helper — a Cloudflare Worker.
// 1) Swaps a Google sign-in code or a refresh token for a short access token (stores nothing).
// 2) Keeps a list of who signed up (email, name, dates) in the D1 database bound as DB.
// 3) Sends a daily wake-up push (no content) so the app can show its own reminders.
//    Needs a Cron Trigger on this Worker (e.g. "0 6 * * *" = 9:00 Cairo time).
// The Google client secret lives in the Worker's encrypted secret GOOGLE_CLIENT_SECRET.

const ALLOWED_ORIGIN = 'https://mohamedhassan861.github.io';
const GOOGLE_CLIENT_ID = '309872061893-l5h4g0ldu1m7do7cqpih8b1jokk0pce0.apps.googleusercontent.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ADMINS = ['mohamed.hassan861@gmail.com', 'icomic.eg@gmail.com'];

const cors = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
};

function reply(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// Who is this token for? Checks it was issued to Daftari, then reads the verified email.
async function whoIs(accessToken) {
  if (typeof accessToken !== 'string' || !accessToken) return null;
  const info = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(accessToken));
  if (!info.ok) return null;
  const ti = await info.json();
  if (ti.aud !== GOOGLE_CLIENT_ID && ti.azp !== GOOGLE_CLIENT_ID) return null;
  const u = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
  if (!u.ok) return null;
  const p = await u.json();
  if (!p.email || p.email_verified === false) return null;
  return { email: String(p.email).toLowerCase(), name: String(p.name || '').slice(0, 120) };
}

// ---- Web Push (VAPID) without payload: the phone decides what to show ----
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function vapidKeys(env) {
  const row = await env.DB.prepare("SELECT v FROM kv WHERE k = 'vapid'").first();
  if (row) return JSON.parse(row.v);
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const keys = { priv: await crypto.subtle.exportKey('jwk', kp.privateKey), pub: b64u(await crypto.subtle.exportKey('raw', kp.publicKey)) };
  await env.DB.prepare("INSERT OR IGNORE INTO kv (k, v) VALUES ('vapid', ?1)").bind(JSON.stringify(keys)).run();
  return JSON.parse((await env.DB.prepare("SELECT v FROM kv WHERE k = 'vapid'").first()).v);
}
async function vapidHeader(endpoint, keys) {
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:' + ADMINS[0] });
  const key = await crypto.subtle.importKey('jwk', keys.priv, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned));
  return 'vapid t=' + unsigned + '.' + b64u(sig) + ', k=' + keys.pub;
}
// Minutes past midnight right now in a user's own time zone.
function localMinutes(tz, now) {
  try {
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    return (+p.find(x => x.type === 'hour').value) * 60 + (+p.find(x => x.type === 'minute').value);
  } catch { return -1; }
}

// Runs every 15 minutes; wakes only the phones whose chosen reminder time falls in this quarter hour.
async function sendAll(env, now = new Date()) {
  const keys = await vapidKeys(env);
  const { results } = await env.DB.prepare('SELECT endpoint, hm, tz FROM push_subs').all();
  for (const { endpoint, hm, tz } of results) {
    const m = localMinutes(tz || 'Africa/Cairo', now);
    if (m < 0 || Math.floor(m / 15) !== Math.floor((hm ?? 540) / 15)) continue;
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { TTL: '3600', Urgency: 'normal', Authorization: await vapidHeader(endpoint, keys), 'Content-Length': '0' } });
      if (r.status === 404 || r.status === 410) await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?1').bind(endpoint).run();
    } catch (e) { /* try again next time */ }
  }
}

export default {
  async scheduled(event, env, ctx) { if (env.DB) ctx.waitUntil(sendAll(env)); },
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.headers.get('Origin') !== ALLOWED_ORIGIN) return reply({ error: 'forbidden_origin' }, 403);
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

    let body;
    try { body = await request.json(); } catch { return reply({ error: 'bad_json' }, 400); }
    const path = new URL(request.url).pathname;

    // ---- reminders ----
    if (path.startsWith('/push/')) {
      if (!env.DB) return reply({ error: 'db_not_configured' }, 500);
      if (path === '/push/key') return reply({ key: (await vapidKeys(env)).pub }, 200);
      const sub = body.sub || {};
      if (typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || sub.endpoint.length > 1000) return reply({ error: 'bad_sub' }, 400);
      if (path === '/push/subscribe') {
        const hm = Number.isInteger(body.hm) && body.hm >= 0 && body.hm < 1440 ? body.hm : 540;
        const tz = typeof body.tz === 'string' && /^[A-Za-z_+\-\/0-9]{1,64}$/.test(body.tz) && localMinutes(body.tz, new Date()) >= 0 ? body.tz : 'Africa/Cairo';
        await env.DB.prepare('INSERT INTO push_subs (endpoint, sub, created, hm, tz) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(endpoint) DO UPDATE SET sub = excluded.sub, hm = excluded.hm, tz = excluded.tz')
          .bind(sub.endpoint, JSON.stringify(sub).slice(0, 4000), new Date().toISOString(), hm, tz).run();
        return reply({ ok: true }, 200);
      }
      if (path === '/push/unsubscribe') {
        await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?1').bind(sub.endpoint).run();
        return reply({ ok: true }, 200);
      }
      if (path === '/push/test') {
        const keys = await vapidKeys(env);
        const r = await fetch(sub.endpoint, { method: 'POST', headers: { TTL: '600', Authorization: await vapidHeader(sub.endpoint, keys), 'Content-Length': '0' } });
        return reply({ ok: r.ok, status: r.status }, 200);
      }
      return reply({ error: 'not_found' }, 404);
    }

    // ---- sign-up list ----
    if (path === '/register' || path === '/users' || path === '/unregister') {
      if (!env.DB) return reply({ error: 'db_not_configured' }, 500);
      const who = await whoIs(body.access_token);
      if (!who) return reply({ error: 'invalid_token' }, 401);
      const now = new Date().toISOString();
      if (path === '/register') {
        const lang = body.lang === 'en' ? 'en' : 'ar';
        await env.DB.prepare(
          'INSERT INTO users (email, name, lang, first_seen, last_seen, opens) VALUES (?1, ?2, ?3, ?4, ?4, 1) ' +
          'ON CONFLICT(email) DO UPDATE SET name = excluded.name, lang = excluded.lang, last_seen = excluded.last_seen, opens = users.opens + 1'
        ).bind(who.email, who.name, lang, now).run();
        return reply({ ok: true, email: who.email, name: who.name, admin: ADMINS.includes(who.email) }, 200);
      }
      if (path === '/unregister') {
        await env.DB.prepare('DELETE FROM users WHERE email = ?1').bind(who.email).run();
        return reply({ ok: true }, 200);
      }
      if (!ADMINS.includes(who.email)) return reply({ error: 'not_admin' }, 403);
      const { results } = await env.DB.prepare('SELECT email, name, lang, first_seen, last_seen, opens FROM users ORDER BY first_seen DESC').all();
      return reply({ users: results }, 200);
    }

    // ---- Google token exchange ----
    if (!env.GOOGLE_CLIENT_SECRET) return reply({ error: 'server_not_configured' }, 500);
    const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET });
    if (path === '/exchange' && typeof body.code === 'string') {
      params.set('grant_type', 'authorization_code');
      params.set('code', body.code);
      params.set('redirect_uri', 'postmessage');
    } else if (path === '/refresh' && typeof body.refresh_token === 'string') {
      params.set('grant_type', 'refresh_token');
      params.set('refresh_token', body.refresh_token);
    } else {
      return reply({ error: 'not_found' }, 404);
    }
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const g = await r.json().catch(() => ({}));
    const out = {};
    for (const k of ['access_token', 'expires_in', 'refresh_token', 'scope', 'error', 'error_description']) {
      if (g[k] !== undefined) out[k] = g[k];
    }
    return reply(out, r.status);
  },
};
