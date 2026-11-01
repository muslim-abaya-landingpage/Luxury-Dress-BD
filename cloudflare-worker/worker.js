// Muslim Abaya first-party tracking worker.
// Routes: muslimabaya.com/gtm.js*  (GTM loader, unchanged)
//         muslimabaya.com/_ma/*    (Meta Conversions API endpoint, added 2026-10-23)
//
// Secrets / vars (set in Cloudflare dashboard → Workers → white-lab-3589 → Settings → Variables and Secrets):
//   META_CAPI_TOKEN      (Secret)     Meta Conversions API access token. Without it, events are accepted and dropped.
//   META_TEST_EVENT_CODE (Text, opt.) e.g. TEST12345 — sends events to Events Manager → Test Events only.
//   MA_DEBUG             (Text, opt.) "1" makes /_ma/e return Meta's/TikTok's response (for testing). Remove afterwards.
//   TIKTOK_EAPI_TOKEN    (Secret)     TikTok Events API access token. Without it, TikTok sending is skipped.
//   TIKTOK_TEST_EVENT_CODE (Text, opt.) TikTok test event code — events go to TikTok's Test Events only.

const META_PIXEL_ID = '1465090315322833';
const META_API_VERSION = 'v26.0';
const ALLOWED_HOSTS = ['muslimabaya.com', 'www.muslimabaya.com', 'shop.muslimabaya.com'];
const ALLOWED_EVENTS = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'Lead'];
const MAX_BODY_BYTES = 16384;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/_ma/order') {
      return handleOrder(request, env, ctx);
    }
    if (path.startsWith('/_ma/')) {
      return handleEvent(request, env, ctx, url);
    }

    // Landing page order submit: same safety net as the main site (save first, retry later).
    if (url.hostname === 'shop.muslimabaya.com' && path === '/api/order' && request.method === 'POST') {
      return handleLandingOrder(request, env, ctx);
    }
    // Landing page (shop.muslimabaya.com, Cloudflare Pages): add the server-side relay script.
    if (url.hostname === 'shop.muslimabaya.com') {
      return serveLanding(request);
    }

    // ---------- original behaviour (unchanged) ----------
    const cookieHeader = request.headers.get('Cookie') || '';
    const cookies = {};
    cookieHeader.split(';').forEach((c) => { const idx = c.indexOf('='); if (idx > -1) { const k = c.slice(0, idx).trim(); const v = c.slice(idx + 1).trim(); if (k) cookies[k] = v; } });
    const setCookies = [];
    const twoYears = 63072000;
    function ensureCookie(name, value) { setCookies.push(name + '=' + value + '; Max-Age=' + twoYears + '; Path=/; Domain=.muslimabaya.com; Secure; SameSite=Lax'); }
    let fbp = cookies['_fbp'];
    if (!fbp) { fbp = 'fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 10000000000); }
    ensureCookie('_fbp', fbp);
    let fbc = cookies['_fbc'];
    const fbclid = url.searchParams.get('fbclid');
    if (fbclid) { fbc = 'fb.1.' + Date.now() + '.' + fbclid; }
    if (fbc) { ensureCookie('_fbc', fbc); }
    let resp;
    if (path === '/gtm.js') {
      const gtmUrl = 'https://www.googletagmanager.com/gtm.js' + url.search;
      const upstream = await fetch(gtmUrl, { headers: { 'User-Agent': request.headers.get('User-Agent') || '' } });
      resp = new Response(upstream.body, upstream);
      resp.headers.set('Cache-Control', 'public, max-age=300');
      resp.headers.set('Content-Type', 'application/javascript; charset=utf-8');
    } else if (path === '/gtag/js') {
      const gtagUrl = 'https://www.googletagmanager.com/gtag/js' + url.search;
      const upstream = await fetch(gtagUrl);
      resp = new Response(upstream.body, upstream);
    } else if (path === '/health') {
      resp = new Response(JSON.stringify({ ok: true, service: 'ma-track' }), { headers: { 'Content-Type': 'application/json' } });
    } else {
      resp = new Response('Not found', { status: 404 });
    }
    resp = new Response(resp.body, resp);
    for (const c of setCookies) { resp.headers.append('Set-Cookie', c); }
    resp.headers.set('Access-Control-Allow-Origin', 'https://muslimabaya.com');
    return resp;
  },

  // Cron trigger: deliver queued orders that could not reach the Apps Script yet.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processOrderQueue(env));
  }
};

// ---------------- Order safety net (added 2026-10-23) ----------------
// Checkout posts the order here instead of straight to the Apps Script. The order is
// saved in D1 first, then forwarded. If Google fails (error page, timeout, overload),
// the order stays queued and the cron retries it until the sheet accepts it, so a
// Google outage can no longer silently lose an order.
// D1 binding: DB. Optional secrets for alerts: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID.
// IP tracking & blocking (2026-10-24): every order attempt's IP is logged in order_ip_log and an
// order from a blocked IP (blocked_ips, managed from the admin order page) is refused. Schema:
// cloudflare-worker/schema-ip.sql. Any D1 error in this part lets the order through unchanged.

const ORDER_HOSTS = ['muslimabaya.com', 'www.muslimabaya.com'];
const ORDER_TARGET_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}\/exec$/;
const ORDER_EVENT_ID_RE = /^[A-Za-z0-9_.:-]{1,100}$/;
const ORDER_TIMEOUT_MS = 90000;
const ORDER_MAX_ATTEMPTS = 12;
const ORDER_MAX_PAYLOAD = 200000;

function textOut(body, status, extra) {
  const h = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' };
  if (extra) for (const k in extra) h[k] = extra[k];
  return new Response(body, { status: status || 200, headers: h });
}

function pairsToForm(pairs) {
  const fd = new FormData();
  for (const [k, v] of pairs) fd.append(k, v);
  return fd;
}

function pairValue(pairs, key) {
  const p = pairs.find((x) => x[0] === key);
  return p ? String(p[1]) : '';
}

// Returns {kind:'success'|'rejected'|'duplicate'|'transient', text, orderId}
async function forwardOrder(target, pairs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ORDER_TIMEOUT_MS);
  try {
    // Apps Script answers the POST with a 302 to script.googleusercontent.com, which must be
    // fetched with GET (as browsers do). Following it with POST makes Google return 400.
    let res = await fetch(target, { method: 'POST', body: pairsToForm(pairs), redirect: 'manual', signal: ctrl.signal });
    const loc = res.headers.get('Location');
    if (res.status >= 300 && res.status < 400 && loc) {
      res = await fetch(new URL(loc, target).toString(), { method: 'GET', redirect: 'follow', signal: ctrl.signal });
    }
    const text = String(await res.text() || '').trim();
    if (text.indexOf('Success') === 0) {
      const orderId = text.indexOf('|') !== -1 ? text.split('|')[1].trim() : '';
      return { kind: 'success', text, orderId };
    }
    if (text.indexOf('Error|') === 0) {
      if (text.indexOf('DUPLICATE_ORDER') !== -1) return { kind: 'duplicate', text };
      return { kind: 'rejected', text };
    }
    return { kind: 'transient', text: 'HTTP ' + res.status + ' ' + text.slice(0, 200) };
  } catch (e) {
    return { kind: 'transient', text: 'FETCH ' + String(e && e.name === 'AbortError' ? 'TIMEOUT' : e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

function backoffMs(attempts) {
  return Math.min(Math.pow(2, attempts), 60) * 60 * 1000; // 2,4,8,...,60 minutes
}

async function sendAlert(env, text) {
  console.log('order_alert', text.slice(0, 500));
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: text.slice(0, 3500) })
    });
  } catch (e) { console.log('telegram_error', String(e)); }
}

function orderSummary(row) {
  return 'নাম: ' + (row.name || '') + '\nফোন: ' + (row.phone || '') + '\nমোট: ৳' + (row.total || '') + '\nEventID: ' + row.event_id;
}

function orderSummaryFromPairs(eventId, pairs) {
  return orderSummary({ event_id: eventId, name: pairValue(pairs, 'Name'), phone: pairValue(pairs, 'Phone'), total: pairValue(pairs, 'Total') });
}

async function handleOrder(request, env, ctx) {
  if (request.method !== 'POST') return textOut('Method not allowed', 405, { Allow: 'POST' });
  const srcHost = hostOf(request.headers.get('Origin') || '') || hostOf(request.headers.get('Referer') || '');
  if (!ORDER_HOSTS.includes(srcHost)) return textOut('Forbidden', 403);
  if (!env.DB) return textOut('Order queue unavailable', 503);

  let form;
  try { form = await request.formData(); } catch (e) { return textOut('Bad request', 400); }
  const target = String(form.get('_ma_target') || '');
  if (!ORDER_TARGET_RE.test(target)) return textOut('Bad request', 400);
  const pairs = [];
  for (const [k, v] of form.entries()) if (k !== '_ma_target' && k !== 'ClientIP' && typeof v === 'string') pairs.push([k, v]);
  if (pairValue(pairs, 'RecordType') !== 'Order') return textOut('Bad request', 400);
  // Server-side tracking: the shopper's IP is only known here, so pass it on for the
  // confirmed-order Purchase event (Meta client_ip_address / TikTok context.ip).
  // A ClientIP sent by the browser is dropped above, so it cannot be spoofed.
  const shopperIp = String(request.headers.get('CF-Connecting-IP') || '').trim();
  if (/^[0-9A-Fa-f:.]{3,45}$/.test(shopperIp)) pairs.push(['ClientIP', shopperIp]);
  const eventId = pairValue(pairs, 'EventID');
  if (!ORDER_EVENT_ID_RE.test(eventId)) return textOut('Bad request', 400);
  const payload = JSON.stringify(pairs);
  if (payload.length > ORDER_MAX_PAYLOAD) return textOut('Payload too large', 413);

  const now = Date.now();
  const existing = await env.DB.prepare('SELECT status, attempts, order_id, last_response FROM order_inbox WHERE event_id = ?').bind(eventId).first();
  if (existing && existing.status === 'saved') {
    return textOut(existing.last_response && existing.last_response.indexOf('Success') === 0 ? existing.last_response : 'Success|' + (existing.order_id || ''));
  }
  const ipInfo = clientIpInfo(request);
  const ipBlock = await findIpBlock(env, ipInfo.ip, now);
  if (ipBlock) {
    const alertNeeded = await logOrderIp(env, eventId, ipInfo, pairs, 'blocked', now);
    if (alertNeeded) ctx.waitUntil(sendAlert(env, '⛔ ব্লক করা IP থেকে অর্ডারের চেষ্টা আটকানো হয়েছে।\n' + orderSummaryFromPairs(eventId, pairs) + '\nIP: ' + ipInfo.ip + (ipBlock.reason ? '\nব্লকের কারণ: ' + ipBlock.reason : '')));
    return textOut('Error|' + IP_BLOCKED_MESSAGE);
  }
  await logOrderIp(env, eventId, ipInfo, pairs, 'received', now);
  if (existing) {
    await env.DB.prepare("UPDATE order_inbox SET payload = ?, target = ?, status = 'sending', updated_at = ? WHERE event_id = ?")
      .bind(payload, target, now, eventId).run();
  } else {
    await env.DB.prepare("INSERT INTO order_inbox (event_id, created_at, updated_at, status, attempts, next_at, target, payload, name, phone, total) VALUES (?, ?, ?, 'sending', 0, 0, ?, ?, ?, ?, ?)")
      .bind(eventId, now, now, target, payload, pairValue(pairs, 'Name').slice(0, 120), pairValue(pairs, 'Phone').slice(0, 40), pairValue(pairs, 'Total').slice(0, 20)).run();
  }
  const priorAttempts = existing ? Number(existing.attempts) || 0 : 0;

  const r = await forwardOrder(target, pairs);
  const attempts = priorAttempts + 1;
  const done = Date.now();
  if (r.kind === 'success') {
    await env.DB.prepare("UPDATE order_inbox SET status = 'saved', attempts = ?, order_id = ?, last_response = ?, updated_at = ? WHERE event_id = ?")
      .bind(attempts, r.orderId || '', r.text, done, eventId).run();
    ctx.waitUntil(setOrderIpOutcome(env, eventId, 'saved', r.orderId));
    return textOut(r.text);
  }
  if (r.kind === 'duplicate' && priorAttempts > 0) {
    // The Apps Script sets its duplicate flag before writing the row, so this does
    // not prove the earlier attempt was saved — a human must check.
    await env.DB.prepare("UPDATE order_inbox SET status = 'needs_attention', attempts = ?, last_response = ?, updated_at = ? WHERE event_id = ?")
      .bind(attempts, r.text, done, eventId).run();
    ctx.waitUntil(sendAlert(env, '🔎 একটা অর্ডার শিটে আছে কিনা মিলিয়ে দেখুন (আগের চেষ্টার উত্তর আসেনি, এখন "ডুপ্লিকেট" বলছে)।\n' + orderSummaryFromPairs(eventId, pairs)));
    ctx.waitUntil(setOrderIpOutcome(env, eventId, 'needs_attention', ''));
    return textOut('Success|');
  }
  if (r.kind === 'rejected' || r.kind === 'duplicate') {
    await env.DB.prepare("UPDATE order_inbox SET status = 'rejected', attempts = ?, last_response = ?, updated_at = ? WHERE event_id = ?")
      .bind(attempts, r.text, done, eventId).run();
    ctx.waitUntil(setOrderIpOutcome(env, eventId, 'rejected', ''));
    return textOut(r.text);
  }
  // Google did not answer properly: keep the order and retry in the background.
  await env.DB.prepare("UPDATE order_inbox SET status = 'retry', attempts = ?, next_at = ?, last_response = ?, updated_at = ? WHERE event_id = ?")
    .bind(attempts, done + backoffMs(1), r.text, done, eventId).run();
  ctx.waitUntil(setOrderIpOutcome(env, eventId, 'queued', ''));
  return textOut('Success|', 200, { 'X-MA-Queued': '1' });
}

// ---------------- Landing page orders (added 2026-10-31) ----------------
// shop.muslimabaya.com posts its order form (urlencoded) to its own Pages Function /api/order,
// which writes it to the sheet. The live request is passed through to that function unchanged
// (so the customer's IP and headers reach it exactly as before); the Worker only keeps a copy in
// D1 first. The landing page treats only "Success|<id>" (HTTP 2xx) as success and "Error|..." as a
// real rejection; anything else (error page, timeout, crash) used to show the customer an error and
// the order was gone. Now such orders are kept and retried, and the customer gets a reference.
const LANDING_RETRY_URL = 'https://muslimabaya-shop-landing.pages.dev/api/order';
const LANDING_TARGET = 'landing:' + LANDING_RETRY_URL;

function classifyLanding(status, text) {
  text = String(text || '').trim();
  if (status >= 200 && status < 300 && text.indexOf('Success|') === 0 && text.slice(8).trim()) {
    return { kind: 'success', text, orderId: text.slice(8).trim() };
  }
  if (text.indexOf('Error|') === 0) {
    if (text.indexOf('DUPLICATE_ORDER') !== -1) return { kind: 'duplicate', text };
    return { kind: 'rejected', text };
  }
  return { kind: 'transient', text: 'HTTP ' + status + ' ' + text.slice(0, 200) };
}

async function forwardLandingRetry(pairs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ORDER_TIMEOUT_MS);
  try {
    const res = await fetch(LANDING_RETRY_URL, {
      // No Origin header: the landing Worker refuses a request whose Origin differs from its own
      // host (pages.dev here); a server-to-server request without Origin is accepted.
      method: 'POST', body: new URLSearchParams(pairs), signal: ctrl.signal
    });
    return classifyLanding(res.status, await res.text());
  } catch (e) {
    return { kind: 'transient', text: 'FETCH ' + String(e && e.name === 'AbortError' ? 'TIMEOUT' : e).slice(0, 200) };
  } finally {
    clearTimeout(timer);
  }
}

function landingRef(eventId) {
  return 'MA-' + String(eventId).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
}

async function handleLandingOrder(request, env, ctx) {
  // Anything unexpected here must never block an order: fall back to the plain pass-through.
  let pairs = null, eventId = '';
  try {
    const ct = request.headers.get('Content-Type') || '';
    if (env.DB && ct.indexOf('application/x-www-form-urlencoded') !== -1) {
      const raw = await request.clone().text();
      if (raw.length <= ORDER_MAX_PAYLOAD) {
        pairs = [...new URLSearchParams(raw).entries()];
        eventId = pairValue(pairs, 'EventID');
        if (!ORDER_EVENT_ID_RE.test(eventId)) pairs = null;
      }
    }
  } catch (e) { pairs = null; }
  if (!pairs) return fetch(request);

  const now = Date.now();
  let existing = null;
  try {
    existing = await env.DB.prepare('SELECT status, attempts, order_id, last_response FROM order_inbox WHERE event_id = ?').bind(eventId).first();
    if (existing && existing.status === 'saved' && existing.last_response) return textOut(existing.last_response);
    if (existing && existing.status === 'retry') return textOut('Success|' + landingRef(eventId), 200, { 'X-MA-Queued': '1' });
    const payload = JSON.stringify(pairs);
    if (existing) {
      await env.DB.prepare("UPDATE order_inbox SET payload = ?, target = ?, status = 'sending', updated_at = ? WHERE event_id = ?").bind(payload, LANDING_TARGET, now, eventId).run();
    } else {
      await env.DB.prepare("INSERT INTO order_inbox (event_id, created_at, updated_at, status, attempts, next_at, target, payload, name, phone, total) VALUES (?, ?, ?, 'sending', 0, 0, ?, ?, ?, ?, ?)")
        .bind(eventId, now, now, LANDING_TARGET, payload, pairValue(pairs, 'Name').slice(0, 120), pairValue(pairs, 'Phone').slice(0, 40), pairValue(pairs, 'Total').slice(0, 20)).run();
    }
  } catch (e) {
    console.log('landing_order_db_error', String(e).slice(0, 200));
    return fetch(request);
  }
  const attempts = (existing ? Number(existing.attempts) || 0 : 0) + 1;

  let res = null, text = '', r;
  try {
    res = await fetch(request);
    text = await res.text();
    r = classifyLanding(res.status, text);
  } catch (e) {
    r = { kind: 'transient', text: 'FETCH ' + String(e).slice(0, 200) };
  }
  const done = Date.now();
  const upd = (status, extraSql, binds) => env.DB.prepare('UPDATE order_inbox SET status = ?, attempts = ?, last_response = ?, updated_at = ?' + extraSql + ' WHERE event_id = ?')
    .bind(status, attempts, r.text, done, ...binds, eventId).run().catch((e) => console.log('landing_order_db_error', String(e).slice(0, 200)));

  if (r.kind === 'success') {
    ctx.waitUntil(upd('saved', ', order_id = ?', [r.orderId]));
  } else if (r.kind === 'rejected' || r.kind === 'duplicate') {
    ctx.waitUntil(upd('rejected', '', []));
  } else {
    await upd('retry', ', next_at = ?', [done + backoffMs(1)]);
    console.log('landing_order_queued', eventId, r.text.slice(0, 200));
    return textOut('Success|' + landingRef(eventId), 200, { 'X-MA-Queued': '1' });
  }
  // Return the landing function's own answer unchanged.
  const h = new Headers(res.headers);
  h.delete('Content-Length'); h.delete('Content-Encoding');
  return new Response(text, { status: res.status, headers: h });
}

async function processOrderQueue(env) {
  if (!env.DB) return;
  const now = Date.now();
  // A request that died mid-way leaves 'sending'; treat it as needing a retry.
  await env.DB.prepare("UPDATE order_inbox SET status = 'retry', next_at = ? WHERE status = 'sending' AND updated_at < ?")
    .bind(now, now - 5 * 60 * 1000).run();
  const due = await env.DB.prepare("SELECT * FROM order_inbox WHERE status = 'retry' AND next_at <= ? ORDER BY created_at LIMIT 10").bind(now).all();
  for (const row of (due.results || [])) {
    let pairs;
    try { pairs = JSON.parse(row.payload); } catch (e) { pairs = null; }
    if (!Array.isArray(pairs)) continue;
    const r = String(row.target || '').indexOf('landing:') === 0 ? await forwardLandingRetry(pairs) : await forwardOrder(row.target, pairs);
    const attempts = (Number(row.attempts) || 0) + 1;
    const t = Date.now();
    if (r.kind === 'success') {
      await env.DB.prepare("UPDATE order_inbox SET status = 'saved', attempts = ?, order_id = ?, last_response = ?, updated_at = ? WHERE event_id = ?")
        .bind(attempts, r.orderId || '', r.text, t, row.event_id).run();
      await setOrderIpOutcome(env, row.event_id, 'saved', r.orderId);
    } else if (r.kind === 'duplicate') {
      await env.DB.prepare("UPDATE order_inbox SET status = 'needs_attention', attempts = ?, last_response = ?, updated_at = ? WHERE event_id = ?")
        .bind(attempts, r.text, t, row.event_id).run();
      await sendAlert(env, '🔎 একটা অর্ডার শিটে আছে কিনা মিলিয়ে দেখুন (আগের চেষ্টার উত্তর আসেনি, এখন "ডুপ্লিকেট" বলছে)। না থাকলে গ্রাহককে ফোন করুন।\n' + orderSummary(row));
    } else if (r.kind === 'rejected') {
      // The customer was already told the order went through — a human must follow up.
      await env.DB.prepare("UPDATE order_inbox SET status = 'needs_attention', attempts = ?, last_response = ?, updated_at = ? WHERE event_id = ?")
        .bind(attempts, r.text, t, row.event_id).run();
      await sendAlert(env, '⚠️ একটা অর্ডার শিটে ঢোকেনি (Apps Script ফিরিয়ে দিয়েছে)। গ্রাহককে ফোন করুন।\n' + orderSummary(row) + '\nকারণ: ' + r.text);
    } else if (attempts >= ORDER_MAX_ATTEMPTS) {
      await env.DB.prepare("UPDATE order_inbox SET status = 'needs_attention', attempts = ?, last_response = ?, updated_at = ? WHERE event_id = ?")
        .bind(attempts, r.text, t, row.event_id).run();
      await sendAlert(env, '⚠️ একটা অর্ডার অনেকবার চেষ্টার পরও শিটে পাঠানো যায়নি। অর্ডারটা Cloudflare D1-এ নিরাপদে আছে।\n' + orderSummary(row) + '\nশেষ উত্তর: ' + r.text);
    } else {
      await env.DB.prepare("UPDATE order_inbox SET status = 'retry', attempts = ?, next_at = ?, last_response = ?, updated_at = ? WHERE event_id = ?")
        .bind(attempts, t + backoffMs(attempts), r.text, t, row.event_id).run();
    }
  }
  // Keep personal data only as long as needed.
  await env.DB.prepare("DELETE FROM order_inbox WHERE status IN ('saved', 'rejected') AND updated_at < ?").bind(now - 30 * 24 * 3600 * 1000).run();
  await cleanupIpTables(env, now);
}

// ---------------- IP tracking & blocking (added 2026-10-24) ----------------

const IP_BLOCKED_MESSAGE = 'দুঃখিত, এই ইন্টারনেট সংযোগ থেকে এখন অনলাইনে অর্ডার নেওয়া যাচ্ছে না। WhatsApp-এ অর্ডার করুন।';
const IP_LOG_KEEP_MS = 180 * 24 * 3600 * 1000;
const IP_ALERT_GAP_MS = 60 * 60 * 1000;

// ip-guard:begin
const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** Expands an IPv6 address to 8 lowercase groups without leading zeros, or returns null. */
function ipv6Groups(ip) {
  let s = String(ip || '').trim().toLowerCase();
  if (!s || s.indexOf(':') === -1 || !/^[0-9a-f:.]+$/.test(s)) return null;
  let tail = [];
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    if (!IPV4_RE.test(v4[1])) return null;
    const p = v4[1].split('.').map(Number);
    tail = [((p[0] << 8) | p[1]).toString(16), ((p[2] << 8) | p[3]).toString(16)];
    s = s.slice(0, -v4[1].length);
    if (s.endsWith(':') && !s.endsWith('::')) s = s.slice(0, -1);
  }
  const parts = s.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const rest = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const known = head.length + rest.length + tail.length;
  if (parts.length === 1 && known !== 8) return null;
  if (parts.length === 2 && known > 7) return null;
  const fill = parts.length === 2 ? new Array(8 - known).fill('0') : [];
  const groups = head.concat(fill, rest, tail);
  if (groups.length !== 8) return null;
  for (let i = 0; i < 8; i++) {
    if (!/^[0-9a-f]{1,4}$/.test(groups[i])) return null;
    groups[i] = parseInt(groups[i], 16).toString(16);
  }
  return groups;
}

/** Normalised address ("1.2.3.4", or IPv6 in full 8-group form), or '' when invalid. */
function normalizeIp(ip) {
  const s = String(ip || '').trim();
  if (IPV4_RE.test(s)) return s;
  const g = ipv6Groups(s);
  if (!g) return '';
  // IPv4-mapped IPv6 (::ffff:1.2.3.4) is the IPv4 address.
  if (g.slice(0, 5).every((x) => x === '0') && g[5] === 'ffff') {
    const a = parseInt(g[6], 16), b = parseInt(g[7], 16);
    return [a >> 8, a & 255, b >> 8, b & 255].join('.');
  }
  return g.join(':');
}

/** What a block stores: the IPv4 address itself, or the IPv6 /64 network ("2001:db8:0:1::/64"). */
function ipBlockKey(ip) {
  const n = normalizeIp(ip);
  if (!n) return '';
  if (n.indexOf(':') === -1) return n;
  return n.split(':').slice(0, 4).join(':') + '::/64';
}

/** Every stored block that would cover this address (exact address and, for IPv6, its /64). */
function ipBlockKeys(ip) {
  const n = normalizeIp(ip);
  if (!n) return [];
  const key = ipBlockKey(n);
  return key === n ? [n] : [n, key];
}

/** Bangladesh mobile number as 01XXXXXXXXX ('' when it is not one). */
function localPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 13 && d.indexOf('880') === 0) d = d.slice(2);
  else if (d.length === 10 && d.charAt(0) === '1') d = '0' + d;
  return /^01\d{9}$/.test(d) ? d : '';
}

/** Short device text from a User-Agent, e.g. "Android · Chrome". */
function deviceLabel(ua) {
  const s = String(ua || '');
  if (!s) return '';
  const os = /iPhone|iPad|iPod/.test(s) ? 'iPhone/iPad' : /Android/.test(s) ? 'Android' : /Windows/.test(s) ? 'Windows' : /Mac OS X/.test(s) ? 'Mac' : /Linux/.test(s) ? 'Linux' : 'অন্যান্য';
  const app = /FBAN|FBAV|FB_IAB/.test(s) ? 'Facebook app' : /Instagram/.test(s) ? 'Instagram app' : /musical_ly|TikTok|BytedanceWebview/.test(s) ? 'TikTok app'
    : /SamsungBrowser/.test(s) ? 'Samsung Internet' : /OPR\/|Opera/.test(s) ? 'Opera' : /Edg\//.test(s) ? 'Edge' : /CriOS|Chrome\//.test(s) ? 'Chrome'
    : /Firefox|FxiOS/.test(s) ? 'Firefox' : /Safari/.test(s) ? 'Safari' : 'Browser';
  return os + ' · ' + app;
}
// ip-guard:end

function clientIpInfo(request) {
  const cf = request.cf || {};
  return {
    ip: normalizeIp(request.headers.get('CF-Connecting-IP') || ''),
    country: String(cf.country || '').slice(0, 4),
    asn: Number(cf.asn) || null,
    asOrg: String(cf.asOrganization || '').slice(0, 120),
    ua: String(request.headers.get('User-Agent') || '').slice(0, 300)
  };
}

// The block that covers this IP, or null. A D1 problem must never stop an order, so errors -> null.
async function findIpBlock(env, ip, now) {
  const keys = ipBlockKeys(ip);
  if (!keys.length) return null;
  try {
    const marks = keys.map(() => '?').join(', ');
    return await env.DB.prepare('SELECT ip, reason, expires_at FROM blocked_ips WHERE ip IN (' + marks + ') AND (expires_at IS NULL OR expires_at > ?) LIMIT 1')
      .bind(...keys, now).first();
  } catch (e) {
    console.log('ip_block_check_error', String(e).slice(0, 200));
    return null;
  }
}

// Records the attempt. For a blocked attempt, returns true when no blocked attempt from this IP was
// logged in the last hour (so a retry loop sends one alert, not hundreds).
async function logOrderIp(env, eventId, info, pairs, outcome, now) {
  try {
    let alert = false;
    if (outcome === 'blocked') {
      const recent = await env.DB.prepare("SELECT 1 AS x FROM order_ip_log WHERE ip = ? AND outcome = 'blocked' AND created_at > ? LIMIT 1")
        .bind(info.ip, now - IP_ALERT_GAP_MS).first();
      alert = !recent;
    }
    await env.DB.prepare('INSERT INTO order_ip_log (event_id, created_at, ip, country, asn, as_org, user_agent, phone, name, total, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(event_id) DO UPDATE SET ip = excluded.ip, country = excluded.country, asn = excluded.asn, as_org = excluded.as_org, user_agent = excluded.user_agent, outcome = excluded.outcome')
      .bind(eventId, now, info.ip || null, info.country || null, info.asn, info.asOrg || null, info.ua || null,
        localPhone(pairValue(pairs, 'Phone')) || pairValue(pairs, 'Phone').slice(0, 40), pairValue(pairs, 'Name').slice(0, 120), pairValue(pairs, 'Total').slice(0, 20), outcome)
      .run();
    return alert;
  } catch (e) {
    console.log('ip_log_error', String(e).slice(0, 200));
    return false;
  }
}

async function setOrderIpOutcome(env, eventId, outcome, orderId) {
  try {
    await env.DB.prepare("UPDATE order_ip_log SET outcome = ?, order_id = COALESCE(NULLIF(?, ''), order_id) WHERE event_id = ?")
      .bind(outcome, String(orderId || ''), eventId).run();
  } catch (e) {
    console.log('ip_outcome_error', String(e).slice(0, 200));
  }
}

async function cleanupIpTables(env, now) {
  try {
    await env.DB.prepare('DELETE FROM order_ip_log WHERE created_at < ?').bind(now - IP_LOG_KEEP_MS).run();
    await env.DB.prepare('DELETE FROM blocked_ips WHERE expires_at IS NOT NULL AND expires_at < ?').bind(now).run();
  } catch (e) {
    console.log('ip_cleanup_error', String(e).slice(0, 200));
  }
}

// ---------------- Meta Conversions API ----------------

function noContent(extra) {
  const h = { 'Cache-Control': 'no-store' };
  if (extra) for (const k in extra) h[k] = extra[k];
  return new Response(null, { status: 204, headers: h });
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

function hostOf(value) {
  try { return new URL(value).hostname; } catch (e) { return ''; }
}

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((c) => {
    const i = c.indexOf('=');
    if (i > -1) { const k = c.slice(0, i).trim(); if (k) out[k] = c.slice(i + 1).trim(); }
  });
  return out;
}

async function sha256(value) {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const isHashed = (v) => /^[a-f0-9]{64}$/.test(v);

async function hashField(value, normalize) {
  if (value === undefined || value === null) return undefined;
  let v = String(value).trim();
  if (!v) return undefined;
  if (isHashed(v.toLowerCase())) return v.toLowerCase();
  v = normalize ? normalize(v) : v.toLowerCase();
  if (!v) return undefined;
  return sha256(v);
}

// Bangladesh numbers: 01XXXXXXXXX -> 8801XXXXXXXXX ; digits only, no '+'
function normalizePhone(v) {
  let d = String(v).replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 11 && d.charAt(0) === '0') d = '88' + d;
  if (d.length === 10 && d.charAt(0) === '1') d = '880' + d;
  return d;
}

function normalizeName(v) {
  return String(v).trim().toLowerCase().replace(/[\s.,'"\-]+/g, '');
}

function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

function cleanStr(v, max) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s.slice(0, max || 200) : undefined;
}

function cleanContents(list) {
  if (!Array.isArray(list)) return undefined;
  const out = [];
  for (const it of list.slice(0, 50)) {
    if (!it || typeof it !== 'object') continue;
    const id = cleanStr(it.id || it.item_id || it.content_id, 100);
    if (!id) continue;
    const c = { id };
    const q = parseInt(it.quantity, 10);
    if (q > 0) c.quantity = q;
    const p = num(it.item_price !== undefined ? it.item_price : it.price);
    if (p !== undefined) c.item_price = p;
    out.push(c);
  }
  return out.length ? out : undefined;
}

async function handleEvent(request, env, ctx, url) {
  if (url.pathname !== '/_ma/e') return new Response('Not found', { status: 404 });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });

  // Same-site check: Origin (or Referer) must be one of our hosts.
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const srcHost = hostOf(origin) || hostOf(referer);
  if (!ALLOWED_HOSTS.includes(srcHost)) return new Response('Forbidden', { status: 403 });

  const len = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (len > MAX_BODY_BYTES) return new Response('Payload too large', { status: 413 });
  let body;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return new Response('Payload too large', { status: 413 });
    body = JSON.parse(text);
  } catch (e) {
    return new Response('Bad request', { status: 400 });
  }
  if (!body || typeof body !== 'object') return new Response('Bad request', { status: 400 });

  const eventName = String(body.event_name || '');
  const eventId = cleanStr(body.event_id, 120);
  if (!ALLOWED_EVENTS.includes(eventName) || !eventId) return new Response('Bad request', { status: 400 });

  const debug = env.MA_DEBUG === '1';
  if (!env.META_CAPI_TOKEN) return debug ? json({ skipped: 'META_CAPI_TOKEN not set' }) : noContent({ 'X-MA-CAPI': 'no-token' });

  const cookies = parseCookies(request.headers.get('Cookie'));
  const u = body.user_data && typeof body.user_data === 'object' ? body.user_data : {};

  const userData = {
    client_ip_address: request.headers.get('CF-Connecting-IP') || undefined,
    client_user_agent: request.headers.get('User-Agent') || undefined,
    fbp: cleanStr(cookies['_fbp'] || u.fbp, 200),
    fbc: cleanStr(cookies['_fbc'] || u.fbc, 500)
  };
  const em = await hashField(u.em || u.email);
  const ph = await hashField(u.ph || u.phone, normalizePhone);
  const fn = await hashField(u.fn || u.first_name, normalizeName);
  const ln = await hashField(u.ln || u.last_name, normalizeName);
  const ext = await hashField(u.external_id, (v) => String(v).trim().toLowerCase());
  if (em) userData.em = [em];
  if (ph) userData.ph = [ph];
  if (fn) userData.fn = [fn];
  if (ln) userData.ln = [ln];
  if (ext) userData.external_id = [ext];
  if (em || ph) userData.country = [await sha256('bd')];
  for (const k of Object.keys(userData)) if (userData[k] === undefined) delete userData[k];

  const cd = body.custom_data && typeof body.custom_data === 'object' ? body.custom_data : {};
  const customData = {
    currency: cleanStr(cd.currency, 3) || 'BDT',
    value: num(cd.value),
    contents: cleanContents(cd.contents),
    content_type: cleanStr(cd.content_type, 20),
    order_id: cleanStr(cd.order_id, 120),
    num_items: num(cd.num_items)
  };
  if (customData.contents) customData.content_ids = customData.contents.map((c) => c.id);
  for (const k of Object.keys(customData)) if (customData[k] === undefined) delete customData[k];
  if (eventName === 'PageView' || eventName === 'Lead') { delete customData.currency; }

  let sourceUrl = cleanStr(body.event_source_url, 1000);
  if (!sourceUrl || !ALLOWED_HOSTS.includes(hostOf(sourceUrl))) sourceUrl = referer || undefined;

  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: sourceUrl,
    user_data: userData
  };
  if (Object.keys(customData).length) event.custom_data = customData;

  const payload = { data: [event] };
  if (env.META_TEST_EVENT_CODE) payload.test_event_code = env.META_TEST_EVENT_CODE;

  const pixelId = env.META_PIXEL_ID || META_PIXEL_ID;
  const endpoint = 'https://graph.facebook.com/' + META_API_VERSION + '/' + pixelId + '/events?access_token=' + encodeURIComponent(env.META_CAPI_TOKEN);
  const send = fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

  // TikTok Events API (only when its token is set and the browser sent a TikTok event_id)
  const ttReq = await buildTikTok(request, env, body, u, cookies, customData, sourceUrl);
  const ttSend = ttReq ? fetch(TIKTOK_ENDPOINT, ttReq) : null;

  if (debug) {
    const r = await send;
    let metaBody;
    try { metaBody = await r.json(); } catch (e) { metaBody = null; }
    let tiktok = null;
    if (ttSend) {
      const tr = await ttSend;
      let tb; try { tb = await tr.json(); } catch (e) { tb = null; }
      tiktok = { status: tr.status, body: tb, sent: JSON.parse(ttReq.body).data[0] };
      tiktok.sent = { event: tiktok.sent.event, event_id: tiktok.sent.event_id, user_keys: Object.keys(tiktok.sent.user), properties: tiktok.sent.properties };
    }
    return json({ meta_status: r.status, meta: metaBody, sent_event: { event_name: event.event_name, event_id: event.event_id, user_data_keys: Object.keys(userData), custom_data: event.custom_data }, tiktok });
  }

  // Success lines carry only the event name, event_id and Meta's counters (no customer data, no token),
  // so Workers Logs can show which events Meta accepted and match them with the browser Pixel's eventID.
  ctx.waitUntil(send.then((r) => r.text().then((t) => {
    if (!r.ok) return console.log('meta_capi_error', r.status, t.slice(0, 500));
    let b = {}; try { b = JSON.parse(t) || {}; } catch (e) {}
    console.log('meta_capi_ok', JSON.stringify({ event_name: eventName, event_id: eventId, events_received: b.events_received, fbtrace_id: b.fbtrace_id, test: !!env.META_TEST_EVENT_CODE }));
  })).catch((e) => console.log('meta_capi_fetch_error', String(e))));
  if (ttSend) {
    ctx.waitUntil(ttSend.then((r) => r.text().then((t) => {
      // TikTok answers HTTP 200 with a non-zero "code" on errors.
      let c = null; try { c = JSON.parse(t).code; } catch (e) {}
      if (!r.ok || c !== 0) console.log('tiktok_eapi_error', r.status, t.slice(0, 500));
      else console.log('tiktok_eapi_ok', JSON.stringify({ event_name: eventName, event_id: String(body.tt_event_id || '').slice(0, 120) }));
    })).catch((e) => console.log('tiktok_eapi_fetch_error', String(e))));
  }
  return noContent();
}

// ---------------- Landing page relay (shop.muslimabaya.com) ----------------
// The landing page's own code pushes every tracked event to dataLayer as
// {event:'view_item'|'add_to_cart'|'begin_checkout', value, items[], event_id}, and uses
// that same event_id for fbq eventID and ttq event_id. This script forwards those three
// events to /_ma/e so Meta CAPI + TikTok Events API get a deduplicated server copy.
// Not forwarded on purpose: page view (browser has no event_id), generate_lead (the
// page's own worker already sends Lead to Meta), purchase (Apps Script sends it on confirm).
const LANDING_RELAY = `(function(){try{
var MAP={view_item:'ViewContent',add_to_cart:'AddToCart',begin_checkout:'InitiateCheckout'};
var seen={};var idx=0;
function send(e){var n=MAP[e.event];if(!n||!e.event_id||seen[e.event_id+n])return;seen[e.event_id+n]=1;
var items=Array.isArray(e.items)?e.items:[];
var body={event_name:n,event_id:String(e.event_id),tt_event_id:String(e.event_id),event_source_url:location.href,referrer:document.referrer||undefined,
custom_data:{currency:e.currency||'BDT',value:Number(e.value)||0,content_type:'product',
contents:items.map(function(i){return{id:String(i.item_id||i.id||''),quantity:Number(i.quantity)||1,item_price:Number(i.price)||0}})}};
var p=JSON.stringify(body);
try{if(navigator.sendBeacon&&navigator.sendBeacon('/_ma/e',new Blob([p],{type:'application/json'})))return}catch(x){}
try{fetch('/_ma/e',{method:'POST',headers:{'Content-Type':'application/json'},body:p,keepalive:true})}catch(x){}}
function scan(){var dl=window.dataLayer;if(!dl||!dl.length)return;for(;idx<dl.length;idx++){var e=dl[idx];if(e&&typeof e==='object'&&!('length' in e)&&e.event)send(e)}}
setInterval(scan,700);window.addEventListener('pagehide',scan);
}catch(e){}})();`;

// Microsoft Clarity (free session recordings + heatmaps) for the landing page, same
// project as the main site (vxaqs8nk80). Skipped if the page already loads Clarity.
const LANDING_CLARITY = `(function(c,l,a,r,i,t,y){try{
if(l.querySelector('script[src*="clarity.ms/tag/"]'))return;
c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
c[a]("set","site","landing");
// Speed: insert Clarity after the page is shown (first touch/scroll or idle after load); the queue above keeps calls.
var go=function(){if(go.d)return;go.d=1;if(l.querySelector('script[src*="clarity.ms/tag/"]'))return;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);};
["pointerdown","keydown","touchstart","scroll"].forEach(function(e){c.addEventListener(e,go,{once:true,passive:true});});
c.addEventListener("load",function(){setTimeout(go,2500);},{once:true});
}catch(e){}})(window,document,"clarity","script","vxaqs8nk80");`;

async function serveLanding(request) {
  const resp = await fetch(request);
  try {
    const ct = resp.headers.get('Content-Type') || '';
    if (request.method !== 'GET' || !resp.ok || !ct.includes('text/html')) return resp;
    return new HTMLRewriter()
      .on('head', { element(el) { el.prepend('<script data-cfasync="false">' + LANDING_RELAY + '</script><script data-cfasync="false">' + LANDING_CLARITY + '</script>', { html: true }); } })
      .transform(resp);
  } catch (e) {
    return resp;
  }
}

// ---------------- TikTok Events API ----------------

const TIKTOK_PIXEL_ID = 'D6FK9GBC77UC649NNCP0';
const TIKTOK_ENDPOINT = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
// Our event name -> TikTok standard event (same names the site's own ttq code / GTM TT tags use)
const TIKTOK_EVENT_MAP = { ViewContent: 'ViewContent', AddToCart: 'AddToCart', InitiateCheckout: 'InitiateCheckout', Purchase: 'CompletePayment', Lead: 'SubmitForm' };

// TikTok wants E.164 with '+' before hashing, e.g. +8801712345678
function normalizePhoneE164(v) {
  const d = normalizePhone(v);
  return d ? '+' + d : '';
}

async function buildTikTok(request, env, body, u, cookies, customData, sourceUrl) {
  if (!env.TIKTOK_EAPI_TOKEN) return null;
  const ttEvent = TIKTOK_EVENT_MAP[body.event_name];
  const ttEventId = cleanStr(body.tt_event_id, 120);
  if (!ttEvent || !ttEventId) return null;

  const user = {
    ip: request.headers.get('CF-Connecting-IP') || undefined,
    user_agent: request.headers.get('User-Agent') || undefined,
    ttp: cleanStr(cookies['_ttp'], 200)
  };
  let ttclid = cookies['ttclid'];
  try { ttclid = new URL(sourceUrl || '').searchParams.get('ttclid') || ttclid; } catch (e) {}
  if (ttclid) user.ttclid = cleanStr(ttclid, 500);
  const email = await hashField(u.em || u.email);
  const phone = await hashField(u.ph || u.phone, normalizePhoneE164);
  const ext = await hashField(u.external_id, (v) => String(v).trim().toLowerCase());
  if (email) user.email = email;
  if (phone) user.phone = phone;
  if (ext) user.external_id = ext;
  for (const k of Object.keys(user)) if (user[k] === undefined) delete user[k];

  const properties = {};
  if (ttEvent !== 'SubmitForm') {
    properties.currency = customData.currency || 'BDT';
    if (customData.value !== undefined) properties.value = customData.value;
    if (customData.contents) {
      properties.contents = customData.contents.map((c) => {
        const o = { content_id: c.id, content_type: 'product' };
        if (c.quantity) o.quantity = c.quantity;
        if (c.item_price !== undefined) o.price = c.item_price;
        return o;
      });
    }
    properties.content_type = 'product';
    if (customData.order_id) properties.order_id = customData.order_id;
  }

  const page = {};
  if (sourceUrl) page.url = sourceUrl;
  const ref = cleanStr(body.referrer, 1000);
  if (ref) page.referrer = ref;

  const payload = {
    event_source: 'web',
    event_source_id: env.TIKTOK_PIXEL_ID || TIKTOK_PIXEL_ID,
    data: [{ event: ttEvent, event_time: Math.floor(Date.now() / 1000), event_id: ttEventId, user, page, properties }]
  };
  if (env.TIKTOK_TEST_EVENT_CODE) payload.test_event_code = env.TIKTOK_TEST_EVENT_CODE;
  return { method: 'POST', headers: { 'Content-Type': 'application/json', 'Access-Token': env.TIKTOK_EAPI_TOKEN }, body: JSON.stringify(payload) };
}
