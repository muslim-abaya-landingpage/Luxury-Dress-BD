/**
 * POST /_ma/admin/fraud — fraud review queue served by the Worker, which already holds the D1
 * database (binding DB) the reviews are written to and verifies the admin session with Apps Script.
 * Unlike /api/admin-fraud (Pages Function), it needs no Google service-account secret.
 *
 * Body (JSON): { token, action, ... }
 *   list       (owner)          { status, limit, cursor }
 *   detail     (owner)          { reviewId }
 *   decide     (owner)          { reviewId, status, reason, expectedVersion }
 *   order_risk (owner or staff) { orderIds: [...] } → latest review per order, for the orders list
 *
 * Nothing here changes an order's status, stock, payment or courier state.
 */

const MAX_BODY = 16384;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 50;
const MAX_ORDER_IDS = 300;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}

function safeReason(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .replace(/\b(?:\+?880)?1[3-9]\d{8}\b|\b01[3-9]\d{8}\b/g, '[redacted phone]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted IP]').trim().slice(0, 500);
}

function decodeCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(atob(String(value)));
    if (!Number.isFinite(parsed.createdAt) || typeof parsed.reviewId !== 'string') return null;
    return parsed;
  } catch (e) { return null; }
}

function encodeCursor(row) {
  return btoa(JSON.stringify({ createdAt: Number(row.created_at), reviewId: String(row.review_id) }));
}

function parseJson(text, fallback) {
  try { return JSON.parse(text || ''); } catch (e) { return fallback; }
}

export function safeReview(row) {
  if (!row) return null;
  const reasons = parseJson(row.reasons_json, []);
  const signals = parseJson(row.signals_json, {});
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

export async function handleFraudAdmin(request, env, verifyAdminToken, deps = {}) {
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  const db = env && env.DB;
  if (!db) return json({ ok: false, error: 'NO_DB' }, 503);

  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'TOO_LARGE' }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ ok: false, error: 'BAD_JSON' }, 400);
  } catch (e) { return json({ ok: false, error: 'BAD_JSON' }, 400); }

  const admin = await verifyAdminToken(env, String(body.token || ''));
  if (!admin || admin.ok === false) {
    return json({ ok: false, error: (admin && admin.error) || 'INVALID_TOKEN' }, (admin && admin.status) || 401);
  }
  const role = String(admin.role || '').toLowerCase();
  const isOwner = role === 'admin';
  const action = String(body.action || 'list');
  const now = deps.now ? deps.now() : Date.now();

  try {
    if (action === 'order_risk') {
      if (!isOwner && role !== 'staff') return json({ ok: false, error: 'NOT_ADMIN' }, 403);
      const ids = Array.from(new Set((Array.isArray(body.orderIds) ? body.orderIds : [])
        .map((id) => String(id || '').trim().slice(0, 80)).filter(Boolean))).slice(0, MAX_ORDER_IDS);
      if (!ids.length) return json({ ok: true, risks: {} });
      const risks = {};
      // D1 allows up to 100 bound parameters per query.
      for (let i = 0; i < ids.length; i += 90) {
        const chunk = ids.slice(i, i + 90);
        const result = await db.prepare(
          'SELECT order_id, risk_score, risk_level, review_status, reasons_json, created_at FROM fraud_reviews ' +
          'WHERE order_id IN (' + chunk.map(() => '?').join(',') + ') ORDER BY created_at ASC'
        ).bind(...chunk).all();
        for (const row of (result.results || [])) {
          const reasons = parseJson(row.reasons_json, []);
          risks[row.order_id] = {
            riskScore: Number(row.risk_score),
            riskLevel: row.risk_level,
            status: row.review_status,
            reasons: Array.isArray(reasons) ? reasons.slice(0, 3) : []
          };
        }
      }
      return json({ ok: true, risks });
    }

    if (!isOwner) return json({ ok: false, error: 'OWNER_ONLY' }, 403);
    const actorId = String(admin.email || admin.phone || 'owner').slice(0, 120);

    if (action === 'list') {
      const status = String(body.status || 'pending');
      if (!['pending', 'hold', 'cleared', 'rejected', 'all'].includes(status)) return json({ ok: false, error: 'INVALID_STATUS' }, 400);
      const limit = Math.max(1, Math.min(MAX_LIMIT, Number.parseInt(body.limit, 10) || DEFAULT_LIMIT));
      const cursor = decodeCursor(body.cursor);
      if (body.cursor && !cursor) return json({ ok: false, error: 'INVALID_CURSOR' }, 400);
      const where = [];
      const binds = [];
      if (status !== 'all') { where.push('review_status = ?'); binds.push(status); }
      if (cursor) {
        where.push('(created_at < ? OR (created_at = ? AND review_id < ?))');
        binds.push(cursor.createdAt, cursor.createdAt, cursor.reviewId);
      }
      binds.push(limit + 1);
      const result = await db.prepare('SELECT * FROM fraud_reviews ' + (where.length ? 'WHERE ' + where.join(' AND ') + ' ' : '') +
        'ORDER BY created_at DESC, review_id DESC LIMIT ?').bind(...binds).all();
      const rows = result.results || [];
      const page = rows.slice(0, limit);
      return json({ ok: true, reviews: page.map(safeReview), nextCursor: rows.length > limit && page.length ? encodeCursor(page[page.length - 1]) : null });
    }

    if (action === 'detail') {
      const id = String(body.reviewId || '').slice(0, 100);
      if (!id) return json({ ok: false, error: 'REVIEW_ID_REQUIRED' }, 400);
      const row = await db.prepare('SELECT * FROM fraud_reviews WHERE review_id = ?').bind(id).first();
      if (!row) return json({ ok: false, error: 'NOT_FOUND' }, 404);
      const events = await db.prepare('SELECT * FROM fraud_review_events WHERE review_id = ? ORDER BY created_at DESC, event_record_id DESC LIMIT 100').bind(id).all();
      return json({ ok: true, review: safeReview(row), history: (events.results || []).map(safeEvent) });
    }

    if (action === 'decide') {
      const id = String(body.reviewId || '').slice(0, 100);
      const next = String(body.status || '');
      const reason = safeReason(body.reason);
      const version = Number(body.expectedVersion);
      if (!id || !Number.isSafeInteger(version) || version < 1) return json({ ok: false, error: 'INVALID_INPUT' }, 400);
      if (!['cleared', 'rejected', 'hold', 'pending'].includes(next)) return json({ ok: false, error: 'INVALID_DECISION' }, 400);
      if ((next === 'rejected' || next === 'hold' || next === 'pending') && !reason) return json({ ok: false, error: 'REASON_REQUIRED' }, 400);
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
      const event = db.prepare(
        'INSERT INTO fraud_review_events (event_record_id, review_id, action, previous_status, new_status, actor_id, actor_role, reason, created_at) ' +
        'SELECT ?, review_id, ?, ?, ?, ?, ?, ?, ? FROM fraud_reviews WHERE review_id = ? AND version = ? AND review_status = ? AND changes() > 0'
      ).bind(crypto.randomUUID(), reopening ? 'reopened' : next, previous, next, actorId, 'owner', reason || null, now, id, version + 1, next);
      const results = await db.batch([update, event]);
      const changed = Number(results && results[0] && results[0].meta && results[0].meta.changes) || 0;
      if (!changed) return json({ ok: false, error: 'VERSION_CONFLICT' }, 409);
      const updated = await db.prepare('SELECT * FROM fraud_reviews WHERE review_id = ?').bind(id).first();
      return json({ ok: true, review: safeReview(updated) });
    }

    return json({ ok: false, error: 'UNSUPPORTED_ACTION' }, 400);
  } catch (err) {
    console.log('fraud_admin_error', String(err).slice(0, 160));
    return json({ ok: false, error: 'DB_ERROR' }, 503);
  }
}
