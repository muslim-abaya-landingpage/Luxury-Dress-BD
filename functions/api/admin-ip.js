/**
 * POST /api/admin-ip — IP information and IP blocking for the admin order page.
 *
 * Login: the same admin/staff session token the panel already uses, verified with the Apps Script's own
 * verifyAdminSession_ (functions/_lib/gs-core.js) against the Sessions/Admins tabs read through the
 * read-only service account — exactly as /api/admin-read does.
 * Data: D1 database ma-orders (binding ORDERS_DB), written by the order Worker (cloudflare-worker/worker.js).
 *
 * Actions (form field Action):
 *   lookup   OrderId and/or Phone → the order's IP, network, device; other phone numbers seen on those IPs
 *   block    Ip, Reason, Days (1 | 7 | 30 | 0 = permanent) → blocks the IPv4 address / IPv6 /64 network
 *   unblock  Ip (an address or a stored /64 key)
 *   list     currently blocked IPs
 */
import { createCore } from '../_lib/gs-core.js';
import { buildEnv } from '../_lib/sheets-shim.js';
import { loadSnapshot } from '../_lib/sheet-snapshot.js';
import { getAccessToken } from '../_lib/google-auth.js';
import { normalizeIp, ipBlockKey, ipBlockKeys, localPhone, deviceLabel } from '../_lib/ip-guard.js';

const DEFAULT_SHEET_ID = '1kHt7Bdd4OnpX0jb1ApBXMZIIYqvmv5q2EyOnPV9HJKo';
const AUTH_SHEETS = ['Sessions', 'Admins'];
const FIELDS = ['Action', 'Token', 'OrderId', 'Phone', 'Ip', 'Reason', 'Days'];
const DAY = 24 * 3600 * 1000;
const ALLOWED_DAYS = [1, 7, 30, 0];
const LOOKBACK_PHONE_MS = 180 * DAY;
const LOOKBACK_SHARED_MS = 30 * DAY;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function defaultVerify(env, token, fetchImpl, nowMs) {
  const access = await getAccessToken(env.GOOGLE_SA_JSON, fetchImpl, nowMs);
  const snapshot = await loadSnapshot({ spreadsheetId: env.SHEET_ID || DEFAULT_SHEET_ID, token: access, sheets: AUTH_SHEETS, fetchImpl, nowMs });
  return createCore(buildEnv(snapshot)).verifyAdminSession_(token);
}

function blockView(row) {
  return row ? { key: row.ip, reason: row.reason || '', by: row.created_by || '', since: row.created_at, expiresAt: row.expires_at == null ? null : row.expires_at } : null;
}

async function activeBlock(db, ip, now) {
  const keys = ipBlockKeys(ip);
  if (!keys.length) return null;
  return db.prepare('SELECT * FROM blocked_ips WHERE ip IN (' + keys.map(() => '?').join(', ') + ') AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC LIMIT 1')
    .bind(...keys, now).first();
}

async function lookup(db, params, now) {
  const orderId = String(params.OrderId || '').slice(0, 60);
  const phone = localPhone(params.Phone);
  let orderRow = null;
  if (orderId) {
    orderRow = await db.prepare('SELECT * FROM order_ip_log WHERE order_id = ? ORDER BY created_at DESC LIMIT 1').bind(orderId).first();
  }
  const ips = [];
  if (orderRow && orderRow.ip) ips.push(orderRow.ip);
  let phoneIps = [];
  if (phone) {
    const r = await db.prepare('SELECT ip, COUNT(*) AS n, MAX(created_at) AS last FROM order_ip_log WHERE phone = ? AND ip IS NOT NULL AND created_at > ? GROUP BY ip ORDER BY last DESC LIMIT 5')
      .bind(phone, now - LOOKBACK_PHONE_MS).all();
    phoneIps = r.results || [];
    phoneIps.forEach((x) => { if (ips.indexOf(x.ip) === -1) ips.push(x.ip); });
  }
  const out = [];
  for (const ip of ips.slice(0, 5)) {
    const others = await db.prepare('SELECT phone, COUNT(*) AS n, MAX(created_at) AS last, SUM(CASE WHEN outcome = \'blocked\' THEN 1 ELSE 0 END) AS blocked FROM order_ip_log ' +
      'WHERE ip = ? AND created_at > ? AND phone IS NOT NULL AND phone != ? GROUP BY phone ORDER BY last DESC LIMIT 10')
      .bind(ip, now - LOOKBACK_SHARED_MS, phone || '').all();
    const total = await db.prepare('SELECT COUNT(*) AS n FROM order_ip_log WHERE ip = ? AND created_at > ?').bind(ip, now - LOOKBACK_SHARED_MS).first();
    const own = phoneIps.find((x) => x.ip === ip);
    out.push({
      ip,
      blockKey: ipBlockKey(ip),
      blocked: blockView(await activeBlock(db, ip, now)),
      ordersFromIp30d: total ? Number(total.n) || 0 : 0,
      ordersByThisPhone: own ? Number(own.n) || 0 : 0,
      otherPhones: (others.results || []).map((x) => ({ phone: x.phone, orders: Number(x.n) || 0, last: x.last, blockedAttempts: Number(x.blocked) || 0 })),
    });
  }
  return {
    ok: true,
    order: orderRow ? {
      ip: orderRow.ip || '', country: orderRow.country || '', network: orderRow.as_org || '', asn: orderRow.asn || null,
      device: deviceLabel(orderRow.user_agent), time: orderRow.created_at, outcome: orderRow.outcome || '',
    } : null,
    ips: out,
  };
}

/** Pure handler (tests inject verify/now). */
export async function handleAdminIp(request, env, deps = {}) {
  const nowMs = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  const db = env && env.ORDERS_DB;
  if (!db || (!env.GOOGLE_SA_JSON && !deps.verify)) return json({ ok: false, error: 'NOT_CONFIGURED', message: 'IP তথ্যের সংযোগ এখনো চালু হয়নি।' }, 503);

  let params;
  try {
    const text = await request.text();
    if (text.length > 8192) return json({ ok: false, error: 'TOO_LARGE' }, 413);
    const form = new URLSearchParams(text);
    params = {};
    FIELDS.forEach((k) => { if (form.has(k)) params[k] = String(form.get(k) || '').trim(); });
  } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  if (!params.Token) return json({ ok: false, error: 'NO_TOKEN', message: 'আবার লগ ইন করুন।' }, 401);

  let who;
  try {
    who = deps.verify ? await deps.verify(params.Token) : await defaultVerify(env, params.Token, deps.fetch || fetch, nowMs);
  } catch (err) {
    return json({ ok: false, error: 'AUTH_UNAVAILABLE', message: 'লগইন যাচাই করা যায়নি, একটু পরে চেষ্টা করুন।' }, 503);
  }
  if (!who || who.ok !== true || (who.role !== 'admin' && who.role !== 'staff')) {
    return json({ ok: false, error: (who && who.error) || 'NOT_ADMIN', message: (who && who.message) || 'অ্যাডমিন লগইন প্রয়োজন।' }, 401);
  }

  try {
    const action = params.Action || 'lookup';
    if (action === 'lookup') return json(await lookup(db, params, nowMs));

    if (action === 'list') {
      const r = await db.prepare('SELECT * FROM blocked_ips WHERE expires_at IS NULL OR expires_at > ? ORDER BY created_at DESC LIMIT 200').bind(nowMs).all();
      return json({ ok: true, blocked: (r.results || []).map(blockView) });
    }

    if (action === 'block') {
      const key = ipBlockKey(params.Ip);
      if (!key) return json({ ok: false, error: 'INVALID_IP', message: 'সঠিক IP নয়।' }, 400);
      const days = Number(params.Days === undefined || params.Days === '' ? 7 : params.Days);
      if (ALLOWED_DAYS.indexOf(days) === -1) return json({ ok: false, error: 'INVALID_DAYS', message: 'মেয়াদ ১, ৭, ৩০ দিন বা স্থায়ী হতে পারে।' }, 400);
      const expiresAt = days === 0 ? null : nowMs + days * DAY;
      const by = String(who.email || who.name || who.role || 'admin').slice(0, 100);
      await db.prepare('INSERT INTO blocked_ips (ip, reason, created_at, created_by, expires_at) VALUES (?, ?, ?, ?, ?) ' +
        'ON CONFLICT(ip) DO UPDATE SET reason = excluded.reason, created_at = excluded.created_at, created_by = excluded.created_by, expires_at = excluded.expires_at')
        .bind(key, String(params.Reason || '').slice(0, 200), nowMs, by, expiresAt).run();
      return json({ ok: true, blocked: blockView(await activeBlock(db, normalizeIp(params.Ip), nowMs)) });
    }

    if (action === 'unblock') {
      const raw = String(params.Ip || '').trim().toLowerCase();
      const keys = /::\/64$/.test(raw) ? [raw] : ipBlockKeys(raw).concat(ipBlockKey(raw) ? [ipBlockKey(raw)] : []);
      if (!keys.length) return json({ ok: false, error: 'INVALID_IP', message: 'সঠিক IP নয়।' }, 400);
      await db.prepare('DELETE FROM blocked_ips WHERE ip IN (' + keys.map(() => '?').join(', ') + ')').bind(...keys).run();
      return json({ ok: true, blocked: null });
    }

    return json({ ok: false, error: 'UNSUPPORTED' }, 400);
  } catch (err) {
    return json({ ok: false, error: 'DB_ERROR', message: 'IP ডাটাবেস থেকে উত্তর আসেনি।', reason: String(err && err.message || err).slice(0, 80) }, 503);
  }
}

export const onRequestPost = ({ request, env }) => handleAdminIp(request, env);
