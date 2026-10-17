// Daftari auth helper — a Cloudflare Worker.
// It only swaps a Google sign-in code or a refresh token for a short access token.
// It stores nothing and logs nothing. The Google client secret lives in the
// Worker's encrypted secret GOOGLE_CLIENT_SECRET, never in this file.

const ALLOWED_ORIGIN = 'https://mohamedhassan861.github.io';
const GOOGLE_CLIENT_ID = '309872061893-l5h4g0ldu1m7do7cqpih8b1jokk0pce0.apps.googleusercontent.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.headers.get('Origin') !== ALLOWED_ORIGIN) return reply({ error: 'forbidden_origin' }, 403);
    if (request.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
    if (!env.GOOGLE_CLIENT_SECRET) return reply({ error: 'server_not_configured' }, 500);

    let body;
    try { body = await request.json(); } catch { return reply({ error: 'bad_json' }, 400); }

    const params = new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET });
    const path = new URL(request.url).pathname;

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
