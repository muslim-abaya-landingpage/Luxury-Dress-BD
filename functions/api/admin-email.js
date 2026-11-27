/**
 * POST /api/admin-email — email blocking for the admin order page.
 *
 * Login: the same admin/staff session token the panel already uses, verified the same lightweight way
 * as the tracking Worker and the browser itself (functions/_lib/admin-verify.js) — one HTTPS call to the
 * Apps Script backend, no Google service-account secret needed.
 * Data: D1 database ma-orders (binding ORDERS_DB), written by the order Worker (cloudflare-worker/worker.js).
 *
 * Actions (form field Action):
 *   check    Email → is this email currently blocked, and why
 *   block    Email, Reason, Days (1 | 7 | 30 | 0 = permanent) → blocks the email address
 *   unblock  Email
 *   list     currently blocked emails
 */
import { verifyAdminSession } from '../_lib/admin-verify.js';
import { normalizeEmail } from '../_lib/email-guard.js';

const FIELDS = ['Action', 'Token', 'Email', 'Reason', 'Days'];
const DAY = 24 * 3600 * 1000;
const ALLOWED_DAYS = [1, 7, 30, 0];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function defaultVerify(env, token, fetchImpl) {
  return verifyAdminSession(token, env, fetchImpl);
}

function blockView(row) {
  return row ? { email: row.email, reason: row.reason || '', by: row.created_by || '', since: row.created_at, expiresAt: row.expires_at == null ? null : row.expires_at } : null;
}

async function activeBlock(db, email, now) {
  if (!email) return null;
  return db.prepare('SELECT * FROM blocked_emails WHERE email = ? AND (expires_at IS NULL OR expires_at > ?) LIMIT 1').bind(email, now).first();
}

/** Pure handler (tests inject verify/now). */
export async function handleAdminEmail(request, env, deps = {}) {
  const nowMs = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  const db = env && env.ORDERS_DB;
  if (!db) return json({ ok: false, error: 'NOT_CONFIGURED', message: 'ইমেইল ব্লকের সংযোগ এখনো চালু হয়নি।' }, 503);

  let params;
  try {
    const text = await request.text();
    if (text.length > 4096) return json({ ok: false, error: 'TOO_LARGE' }, 413);
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
    const action = params.Action || 'check';

    if (action === 'check') {
      const email = normalizeEmail(params.Email);
      if (!email) return json({ ok: false, error: 'INVALID_EMAIL', message: 'সঠিক ইমেইল নয়।' }, 400);
      return json({ ok: true, email, blocked: blockView(await activeBlock(db, email, nowMs)) });
    }

    if (action === 'list') {
      const r = await db.prepare('SELECT * FROM blocked_emails WHERE expires_at IS NULL OR expires_at > ? ORDER BY created_at DESC LIMIT 200').bind(nowMs).all();
      return json({ ok: true, blocked: (r.results || []).map(blockView) });
    }

    if (action === 'block') {
      const email = normalizeEmail(params.Email);
      if (!email) return json({ ok: false, error: 'INVALID_EMAIL', message: 'সঠিক ইমেইল নয়।' }, 400);
      const days = Number(params.Days === undefined || params.Days === '' ? 7 : params.Days);
      if (ALLOWED_DAYS.indexOf(days) === -1) return json({ ok: false, error: 'INVALID_DAYS', message: 'মেয়াদ ১, ৭, ৩০ দিন বা স্থায়ী হতে পারে।' }, 400);
      const expiresAt = days === 0 ? null : nowMs + days * DAY;
      const by = String(who.email || who.name || who.role || 'admin').slice(0, 100);
      await db.prepare('INSERT INTO blocked_emails (email, reason, created_at, created_by, expires_at) VALUES (?, ?, ?, ?, ?) ' +
        'ON CONFLICT(email) DO UPDATE SET reason = excluded.reason, created_at = excluded.created_at, created_by = excluded.created_by, expires_at = excluded.expires_at')
        .bind(email, String(params.Reason || '').slice(0, 200), nowMs, by, expiresAt).run();
      return json({ ok: true, blocked: blockView(await activeBlock(db, email, nowMs)) });
    }

    if (action === 'unblock') {
      const email = normalizeEmail(params.Email);
      if (!email) return json({ ok: false, error: 'INVALID_EMAIL', message: 'সঠিক ইমেইল নয়।' }, 400);
      await db.prepare('DELETE FROM blocked_emails WHERE email = ?').bind(email).run();
      return json({ ok: true, blocked: null });
    }

    return json({ ok: false, error: 'UNSUPPORTED' }, 400);
  } catch (err) {
    return json({ ok: false, error: 'DB_ERROR', message: 'ইমেইল ডাটাবেস থেকে উত্তর আসেনি।', reason: String(err && err.message || err).slice(0, 80) }, 503);
  }
}

export const onRequestPost = ({ request, env }) => handleAdminEmail(request, env);
