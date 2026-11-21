/**
 * POST /api/admin-fraud — Owner-only fraud review queue and append-only history.
 * D1 binding: ORDERS_DB (same ma-orders database used by /api/admin-ip).
 *
 * Actions: list, detail, decide. This endpoint never changes order status, stock,
 * payment or courier state. All decisions use optimistic version locking.
 */
import { isOwner } from '../_lib/owner-auth.js';

const MAX_BODY = 8192;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(atob(value));
    if (!Number.isFinite(parsed.createdAt) || typeof parsed.reviewId !== 'string') return null;
    return parsed;
  } catch (e) { return null; }
}

function encodeCursor(row) {
  return btoa(JSON.stringify({ createdAt: Number(row.created_at), reviewId: String(row.review_id) }));
}

function safeReview(row) {
  if (!row) return null;
  let reasons = [], signals = {};
  try { reasons = JSON.parse(row.reasons_json || '[]'); } catch (e) {}
  try { signals = JSON.parse(row.signals_json || '{}'); } catch (e) {}
  return {
    reviewId: row.review_id,
    eventId: row.event_id,
    orderId: row.order_id || '',
    riskScore: Number(row.risk_score),
    riskLevel: row.risk_level,
    riskAction: row.risk_action,
    reasons: Array.isArray(reasons) ? reasons : [],
    signals: signals && typeof signals === 'object' && !Array.isArray(signals) ? signals : {},
    status: row.review_status,
    reviewerId: row.reviewer_id || '',
    reviewerRole: row.reviewer_role || '',
    decisionAt: row.decision_at == null ? null : Number(row.decision_at),
    decisionReason: row.decision_reason || '',
    version: Number(row.version),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at)
  };
}

function safeEvent(row) {
  return {
    eventId: row.event_record_id,
    action: row.action,
    previousStatus: row.previous_status || '',
    newStatus: row.new_status,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    reason: row.reason || '',
    createdAt: Number(row.created_at)
  };
}

export async function handleAdminFraud(request, env, deps = {}) {
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  const db = env && env.ORDERS_DB;
  if (!db || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);

  let params;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'TOO_LARGE' }, 413);
    params = Object.fromEntries(new URLSearchParams(raw).entries());
  } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }

  if (!params.Token) return json({ ok: false, error: 'NO_TOKEN' }, 401);
  let auth;
  try {
    const check = deps.isOwner || isOwner;
    auth = await check(params.Token, env, deps.fetch || fetch, deps.now ? deps.now() : Date.now());
  } catch (e) {
    return json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503);
  }
  if (auth) return json({ ok: false, error: auth === 'OWNER_ONLY' ? 'OWNER_ONLY' : 'NOT_LOGGED_IN' }, 403);

  const actorId = String(params.ActorId || 'owner').slice(0, 120);
  const now = deps.now ? deps.now() : Date.now();
  const action = String(params.Action || 'list');

  try {
    if (action === 'list') {
      const status = String(params.Status || 'pending');
      if (!['pending', 'hold', 'cleared', 'rejected', 'all'].includes(status)) {
        return json({ ok: false, error: 'INVALID_STATUS' }, 400);
      }
      const limit = Math.max(1, Math.min(MAX_LIMIT, Number.parseInt(params.Limit, 10) || DEFAULT_LIMIT));
      const cursor = decodeCursor(params.Cursor);
      if (params.Cursor && !cursor) return json({ ok: false, error: 'INVALID_CURSOR' }, 400);
      const where = [];
      const binds = [];
      if (status !== 'all') { where.push('review_status = ?'); binds.push(status); }
      if (cursor) {
        where.push('(created_at < ? OR (created_at = ? AND review_id < ?))');
        binds.push(cursor.createdAt, cursor.createdAt, cursor.reviewId);
      }
      const sql = 'SELECT * FROM fraud_reviews ' + (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') +
        'ORDER BY created_at DESC, review_id DESC LIMIT ?';
      binds.push(limit + 1);
      const result = await db.prepare(sql).bind(...binds).all();
      const rows = result.results || [];
      const hasMore = rows.length > limit;
      const page = rows.slice(0, limit);
      return json({
        ok: true,
        reviews: page.map(safeReview),
        nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : null
      });
    }

    if (action === 'detail') {
      const id = String(params.ReviewId || '').slice(0, 100);
      if (!id) return json({ ok: false, error: 'REVIEW_ID_REQUIRED' }, 400);
      const row = await db.prepare('SELECT * FROM fraud_reviews WHERE review_id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'NOT_FOUND' }, 404);
      const events = await db.prepare(
        'SELECT * FROM fraud_review_events WHERE review_id = ? ORDER BY created_at DESC, event_record_id DESC LIMIT 100'
      ).bind(id).all();
      return json({ ok: true, review: safeReview(row), history: (events.results || []).map(safeEvent) });
    }

    if (action === 'decide') {
      const id = String(params.ReviewId || '').slice(0, 100);
      const next = String(params.Status || '');
      const reason = String(params.Reason || '').trim().slice(0, 500);
      const version = Number(params.ExpectedVersion);
      if (!id || !Number.isSafeInteger(version) || version < 1) return json({ ok: false, error: 'INVALID_INPUT' }, 400);
      if (!['cleared', 'rejected', 'hold', 'pending'].includes(next)) return json({ ok: false, error: 'INVALID_DECISION' }, 400);
      if ((next === 'rejected' || next === 'hold' || next === 'pending') && !reason) {
        return json({ ok: false, error: 'REASON_REQUIRED' }, 400);
      }
      const current = await db.prepare('SELECT review_status, version FROM fraud_reviews WHERE review_id = ?').bind(id).first();
      if (!current) return json({ ok: false, error: 'NOT_FOUND' }, 404);
      const previous = current.review_status;
      const reopening = next === 'pending' && ['cleared', 'rejected'].includes(previous);
      const allowed = (previous === 'pending' && ['cleared', 'rejected', 'hold'].includes(next)) ||
        (previous === 'hold' && ['cleared', 'rejected'].includes(next)) || reopening;
      if (!allowed) return json({ ok: false, error: 'INVALID_TRANSITION' }, 409);

      const update = db.prepare(
        'UPDATE fraud_reviews SET review_status = ?, reviewer_id = ?, reviewer_role = ?, decision_at = ?, decision_reason = ?, version = version + 1, updated_at = ? ' +
        'WHERE review_id = ? AND version = ? AND review_status = ?'
      ).bind(next, actorId, 'owner', now, reason || null, now, id, version, previous);
      const eventAction = reopening ? 'reopened' : next;
      const event = db.prepare(
        'INSERT INTO fraud_review_events (event_record_id, review_id, action, previous_status, new_status, actor_id, actor_role, reason, created_at) ' +
        'SELECT ?, review_id, ?, ?, ?, ?, ?, ?, ? FROM fraud_reviews WHERE review_id = ? AND version = ? AND review_status = ?'
      ).bind(crypto.randomUUID(), eventAction, previous, next, actorId, 'owner', reason || null, now, id, version + 1, next);
      const results = await db.batch([update, event]);
      const changed = Number(results && results[0] && results[0].meta && results[0].meta.changes) || 0;
      if (!changed) return json({ ok: false, error: 'VERSION_CONFLICT' }, 409);
      const updated = await db.prepare('SELECT * FROM fraud_reviews WHERE review_id = ?').bind(id).first();
      return json({ ok: true, review: safeReview(updated) });
    }

    return json({ ok: false, error: 'UNSUPPORTED_ACTION' }, 400);
  } catch (err) {
    return json({ ok: false, error: 'DB_ERROR' }, 503);
  }
}

export const onRequestPost = ({ request, env }) => handleAdminFraud(request, env);
