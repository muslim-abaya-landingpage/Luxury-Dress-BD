/**
 * POST /api/admin-order-approval — order approval queue and append-only history.
 * D1 binding: ORDERS_DB (ma-orders).
 *
 * Approval is intentionally separate from operational Order Status. This endpoint
 * never updates Online Order, stock, courier, payment, or Meta CAPI state.
 * Existing roles are admin/staff. Staff are read-only; admin can decide/assign/reopen.
 * A Manager role is not enabled until the existing Admins role model supports it.
 */
import { createCore } from '../_lib/gs-core.js';
import { buildEnv } from '../_lib/sheets-shim.js';
import { loadSnapshot } from '../_lib/sheet-snapshot.js';
import { getAccessToken } from '../_lib/google-auth.js';

const DEFAULT_SHEET_ID = '1kHt7Bdd4OnpX0jb1ApBXMZIIYqvmv5q2EyOnPV9HJKo';
const AUTH_SHEETS = ['Sessions', 'Admins'];
const MAX_BODY = 8192;
const MAX_LIMIT = 50;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}
function clean(value, max = 160) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
}
function safeReason(value) {
  return clean(value, 500)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted email]')
    .replace(/\b(?:\+?880)?1[3-9]\d{8}\b|\b01[3-9]\d{8}\b/g, '[redacted phone]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[redacted IP]');
}
async function authContext(env, token, fetchImpl, nowMs) {
  const access = await getAccessToken(env.GOOGLE_SA_JSON, fetchImpl, nowMs);
  const snapshot = await loadSnapshot({
    spreadsheetId: env.SHEET_ID || DEFAULT_SHEET_ID,
    token: access,
    sheets: AUTH_SHEETS,
    fetchImpl,
    nowMs
  });
  const core = createCore(buildEnv(snapshot));
  const who = core.verifyAdminSession_(token);
  if (!who || !who.ok) return { error: 'NOT_LOGGED_IN' };
  if (who.role !== 'admin' && who.role !== 'staff') return { error: 'NOT_ADMIN' };
  return { who, snapshot };
}
function actor(context) {
  const who = context.who;
  return {
    id: clean(who.email || who.phone || who.name || 'admin', 160),
    role: who.role === 'admin' ? 'admin' : 'staff'
  };
}
function canWrite(context) { return context.who.role === 'admin'; }
function activeAssignee(snapshot, target) {
  const wanted = clean(target, 160).toLowerCase();
  const rows = snapshot && snapshot.sheets && snapshot.sheets.Admins && snapshot.sheets.Admins.values || [];
  return rows.slice(1).some((row) => {
    const status = clean(row[5] || 'active', 30).toLowerCase();
    const role = clean(row[7] || 'admin', 30).toLowerCase();
    return status !== 'blocked' && status !== 'disabled' &&
      (role === 'admin' || role === 'staff') &&
      [row[0], row[1], row[2]].some((v) => clean(v, 160).toLowerCase() === wanted);
  });
}
function eventInsert(db, approvalId, action, previous, next, who, assignedTo, reason, now) {
  return db.prepare(
    'INSERT INTO order_approval_events (event_id, approval_id, action, previous_status, new_status, actor_id, actor_role, assigned_to, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), approvalId, action, previous, next, who.id, who.role, assignedTo || null, reason || null, now);
}

export async function handleAdminOrderApproval(request, env, deps = {}) {
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  const db = env && env.ORDERS_DB;
  if (!db || (!env.GOOGLE_SA_JSON && !deps.verify)) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);

  let params;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ ok: false, error: 'TOO_LARGE' }, 413);
    params = Object.fromEntries(new URLSearchParams(raw).entries());
  } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  if (!params.Token) return json({ ok: false, error: 'NO_TOKEN' }, 401);

  let context;
  try {
    if (deps.verify) {
      const who = await deps.verify(params.Token);
      context = who && who.ok ? { who, snapshot: deps.snapshot || { sheets: { Admins: { values: [] } } } } : { error: 'NOT_LOGGED_IN' };
    } else context = await authContext(env, params.Token, deps.fetch || fetch, now);
  } catch (e) { return json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503); }
  if (context.error) return json({ ok: false, error: context.error }, 401);
  if (!['admin', 'staff'].includes(context.who.role)) return json({ ok: false, error: 'NOT_ADMIN' }, 403);

  const who = actor(context);
  const action = clean(params.Action || 'list', 30);
  try {
    if (action === 'create') {
      if (!canWrite(context)) return json({ ok: false, error: 'FORBIDDEN' }, 403);
      const orderId = clean(params.OrderId, 80);
      if (!orderId) return json({ ok: false, error: 'ORDER_ID_REQUIRED' }, 400);
      const source = await db.prepare("SELECT order_id FROM order_inbox WHERE order_id = ? AND status = 'saved' LIMIT 1").bind(orderId).first();
      if (!source) return json({ ok: false, error: 'SAVED_ORDER_NOT_FOUND' }, 404);
      const approvalId = 'oa_' + crypto.randomUUID();
      await db.batch([
        db.prepare("INSERT OR IGNORE INTO order_approvals (approval_id, order_id, approval_status, version, created_at, updated_at) VALUES (?, ?, 'pending', 1, ?, ?)")
          .bind(approvalId, orderId, now, now),
        db.prepare("INSERT INTO order_approval_events (event_id, approval_id, action, previous_status, new_status, actor_id, actor_role, created_at) SELECT ?, approval_id, 'created', NULL, 'pending', ?, ?, ? FROM order_approvals WHERE order_id = ? AND NOT EXISTS (SELECT 1 FROM order_approval_events WHERE event_id = ?)")
          .bind('created:' + orderId, who.id, who.role, now, orderId, 'created:' + orderId)
      ]);
      const row = await db.prepare('SELECT * FROM order_approvals WHERE order_id = ?').bind(orderId).first();
      return json({ ok: true, approval: row, created: row && row.approval_id === approvalId });
    }

    if (action === 'list') {
      const status = clean(params.Status || 'pending', 20);
      if (!['pending', 'approved', 'rejected', 'hold', 'all'].includes(status)) return json({ ok: false, error: 'INVALID_STATUS' }, 400);
      const limit = Math.max(1, Math.min(MAX_LIMIT, Number.parseInt(params.Limit, 10) || 25));
      const where = status === 'all' ? '' : 'WHERE a.approval_status = ?';
      const stmt = db.prepare(
        'SELECT a.*, o.name, o.phone, o.total, o.created_at AS order_created_at FROM order_approvals a LEFT JOIN order_inbox o ON o.order_id = a.order_id ' +
        where + ' ORDER BY a.created_at DESC, a.approval_id DESC LIMIT ?'
      );
      const result = status === 'all' ? await stmt.bind(limit).all() : await stmt.bind(status, limit).all();
      return json({ ok: true, approvals: result.results || [] });
    }

    if (action === 'detail' || action === 'history') {
      const id = clean(params.ApprovalId, 100);
      if (!id) return json({ ok: false, error: 'APPROVAL_ID_REQUIRED' }, 400);
      const approval = await db.prepare('SELECT * FROM order_approvals WHERE approval_id = ?').bind(id).first();
      if (!approval) return json({ ok: false, error: 'NOT_FOUND' }, 404);
      const events = await db.prepare('SELECT * FROM order_approval_events WHERE approval_id = ? ORDER BY created_at DESC, event_id DESC LIMIT 100').bind(id).all();
      return json({ ok: true, approval, history: events.results || [] });
    }

    if (action === 'assign') {
      if (!canWrite(context)) return json({ ok: false, error: 'FORBIDDEN' }, 403);
      const id = clean(params.ApprovalId, 100);
      const target = clean(params.AssignedTo, 160);
      const version = Number(params.ExpectedVersion);
      if (!id || !target || !Number.isSafeInteger(version) || version < 1) return json({ ok: false, error: 'INVALID_INPUT' }, 400);
      if (!activeAssignee(context.snapshot, target)) return json({ ok: false, error: 'ASSIGNEE_NOT_ACTIVE' }, 400);
      const current = await db.prepare('SELECT approval_status, version FROM order_approvals WHERE approval_id = ?').bind(id).first();
      if (!current) return json({ ok: false, error: 'NOT_FOUND' }, 404);
      if (current.approval_status !== 'pending' && current.approval_status !== 'hold') return json({ ok: false, error: 'INVALID_TRANSITION' }, 409);
      const update = db.prepare('UPDATE order_approvals SET assigned_to = ?, version = version + 1, updated_at = ? WHERE approval_id = ? AND version = ?')
        .bind(target, now, id, version);
      const event = db.prepare("INSERT INTO order_approval_events (event_id, approval_id, action, previous_status, new_status, actor_id, actor_role, assigned_to, created_at) SELECT ?, approval_id, 'assigned', ?, ?, ?, ?, ?, ? FROM order_approvals WHERE approval_id = ? AND version = ? AND changes() > 0")
        .bind(crypto.randomUUID(), current.approval_status, current.approval_status, who.id, who.role, target, now, id, version + 1);
      const results = await db.batch([update, event]);
      if (!(Number(results[0] && results[0].meta && results[0].meta.changes) > 0)) return json({ ok: false, error: 'VERSION_CONFLICT' }, 409);
      const row = await db.prepare('SELECT * FROM order_approvals WHERE approval_id = ?').bind(id).first();
      return json({ ok: true, approval: row });
    }

    if (['approve', 'reject', 'hold', 'reopen'].includes(action)) {
      if (!canWrite(context)) return json({ ok: false, error: 'FORBIDDEN' }, 403);
      if (action === 'reopen' && who.role !== 'admin') return json({ ok: false, error: 'OWNER_ONLY' }, 403);
      const id = clean(params.ApprovalId, 100);
      const version = Number(params.ExpectedVersion);
      const reason = safeReason(params.Reason);
      if (!id || !Number.isSafeInteger(version) || version < 1) return json({ ok: false, error: 'INVALID_INPUT' }, 400);
      if (['reject', 'hold', 'reopen'].includes(action) && !reason) return json({ ok: false, error: 'REASON_REQUIRED' }, 400);
      const current = await db.prepare('SELECT approval_status, version FROM order_approvals WHERE approval_id = ?').bind(id).first();
      if (!current) return json({ ok: false, error: 'NOT_FOUND' }, 404);
      const next = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action === 'hold' ? 'hold' : 'pending';
      const previous = current.approval_status;
      const allowed = (previous === 'pending' && ['approved', 'rejected', 'hold'].includes(next)) ||
        (previous === 'hold' && ['approved', 'rejected'].includes(next)) ||
        (previous === 'approved' || previous === 'rejected') && next === 'pending';
      if (!allowed) return json({ ok: false, error: 'INVALID_TRANSITION' }, 409);
      const update = db.prepare('UPDATE order_approvals SET approval_status = ?, approved_by = ?, reviewer_role = ?, decision_reason = ?, reviewed_at = ?, version = version + 1, updated_at = ? WHERE approval_id = ? AND version = ? AND approval_status = ?')
        .bind(next, who.id, who.role, reason || null, now, now, id, version, previous);
      const event = db.prepare('INSERT INTO order_approval_events (event_id, approval_id, action, previous_status, new_status, actor_id, actor_role, reason, created_at) SELECT ?, approval_id, ?, ?, ?, ?, ?, ?, ? FROM order_approvals WHERE approval_id = ? AND version = ? AND approval_status = ? AND changes() > 0')
        .bind(crypto.randomUUID(), action === 'reopen' ? 'reopened' : next, previous, next, who.id, who.role, reason || null, now, id, version + 1, next);
      const results = await db.batch([update, event]);
      if (!(Number(results[0] && results[0].meta && results[0].meta.changes) > 0)) return json({ ok: false, error: 'VERSION_CONFLICT' }, 409);
      const row = await db.prepare('SELECT * FROM order_approvals WHERE approval_id = ?').bind(id).first();
      return json({ ok: true, approval: row });
    }
    return json({ ok: false, error: 'UNSUPPORTED_ACTION' }, 400);
  } catch (e) { return json({ ok: false, error: 'DB_ERROR' }, 503); }
}
export const onRequestPost = ({ request, env }) => handleAdminOrderApproval(request, env);
