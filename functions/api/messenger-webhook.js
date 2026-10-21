/**
 * Messenger webhook relay: https://muslimabaya.com/api/messenger-webhook
 *
 * Meta needs a plain 200 answer within a few seconds. Apps Script web apps answer with a 302 redirect
 * and can be slow, so Meta may reject or disable the subscription. This relay:
 *   GET  (verification)  → asks Apps Script (which holds MSGR_VERIFY_TOKEN) and returns the challenge with 200.
 *   POST (messages)      → answers 200 at once and hands the unchanged body to Apps Script in the background.
 * Optional: set MSGR_APP_SECRET (Cloudflare secret) to reject payloads without a valid X-Hub-Signature-256.
 */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZv7KU0JMY90576HoRF8wtHmEgW2ggkTxAoQKjO6on1cactlDgJDhoRLndCh3kK_hz/exec';
const MAX_BODY = 1024 * 1024;

function text(body, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function validSignature(secret, rawBody, header) {
  const m = /^sha256=([0-9a-f]{64})$/i.exec(String(header || ''));
  if (!m) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const want = m[1].toLowerCase();
  let diff = sig.length ^ want.length;
  for (let i = 0; i < Math.min(sig.length, want.length); i++) diff |= sig.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

export async function handleMessengerWebhook(request, env = {}, ctx = { waitUntil() {} }, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const target = env.APPS_SCRIPT_URL || APPS_SCRIPT_URL;
  const url = new URL(request.url);

  if (request.method === 'GET') {
    if (url.searchParams.get('hub.mode') !== 'subscribe') return text('Messenger webhook relay OK');
    const challenge = url.searchParams.get('hub.challenge') || '';
    if (!challenge || challenge.length > 200) return text('bad request', 400);
    try {
      const res = await fetchImpl(target + url.search, { redirect: 'follow' });
      const answer = (await res.text()).trim();
      // Apps Script returns the challenge only when hub.verify_token matches its MSGR_VERIFY_TOKEN.
      return answer === challenge ? text(challenge) : text('forbidden', 403);
    } catch (e) {
      return text('upstream error', 502);
    }
  }

  if (request.method === 'POST') {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return text('too large', 413);
    if (env.MSGR_APP_SECRET && !(await validSignature(env.MSGR_APP_SECRET, raw, request.headers.get('X-Hub-Signature-256')))) {
      return text('bad signature', 403);
    }
    let body;
    try { body = JSON.parse(raw); } catch (e) { return text('bad json', 400); }
    if (!body || body.object !== 'page') return text('ignored');
    ctx.waitUntil(fetchImpl(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw, redirect: 'follow' }).catch(() => {}));
    return text('EVENT_RECEIVED');
  }

  return text('method not allowed', 405);
}

export const onRequest = ({ request, env, waitUntil }) => handleMessengerWebhook(request, env, { waitUntil });
