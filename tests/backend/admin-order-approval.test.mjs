import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { handleAdminOrderApproval } from '../../functions/api/admin-order-approval.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const migration = fs.readFileSync(path.join(root, 'cloudflare-worker/schema-order-approval.sql'), 'utf8');

function req(fields, origin) {
  return new Request('https://muslimabaya.com/api/admin-order-approval', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, origin ? { Origin: origin } : {}),
    body: new URLSearchParams(fields)
  });
}
function d1(db) {
  return {
    prepare(sql) {
      const statement = { sql, values: [] };
      statement.bind = (...values) => { statement.values = values; return statement; };
      statement.first = async () => db.prepare(sql).get(...statement.values) || null;
      statement.all = async () => ({ results: db.prepare(sql).all(...statement.values) });
      statement.run = async () => {
        const result = db.prepare(sql).run(...statement.values);
        return { meta: { changes: Number(result.changes) } };
      };
      return statement;
    },
    async batch(statements) {
      db.exec('BEGIN');
      try {
        const results = statements.map((statement) => {
          const result = db.prepare(statement.sql).run(...statement.values);
          return { meta: { changes: Number(result.changes) } };
        });
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
  };
}
function makeEnv() {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  raw.exec(`CREATE TABLE order_inbox (
    event_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0,
    target TEXT NOT NULL DEFAULT '', payload TEXT NOT NULL DEFAULT '', name TEXT, phone TEXT,
    total TEXT, order_id TEXT, last_response TEXT
  )`);
  raw.exec(migration);
  return { raw, ORDERS_DB: d1(raw), GOOGLE_SA_JSON: '{}' };
}
const staff = { ok: true, role: 'staff', email: 'staff@example.test' };
const admin = { ok: true, role: 'admin', email: 'admin@example.test' };
const ownerRoleSnapshot = {
  sheets: { Admins: { values: [
    ['Email', 'Phone', 'Name', 'PasswordHash', 'Salt', 'Status', 'CreatedAt', 'Role', 'UpdatedAt'],
    ['admin@example.test', '01700000000', 'Admin', '', '', 'active', '', 'admin', '']
  ] } }
};
let testClock = 1000;
async function call(env, fields, who = admin, snapshot = ownerRoleSnapshot) {
  return handleAdminOrderApproval(req(Object.assign({ Token: 'session' }, fields)), env, {
    verify: async () => who,
    snapshot,
    now: () => ++testClock
  });
}
function savedOrder(env, orderId = 'MA-2026-0001') {
  env.raw.prepare("INSERT INTO order_inbox (event_id, created_at, updated_at, status, target, payload, name, phone, total, order_id) VALUES (?, ?, ?, 'saved', ?, ?, ?, ?, ?, ?)")
    .run('evt-' + orderId, 100, 100, 'target', '{}', 'Test Customer', '01700000000', '1200', orderId);
}
function count(env, table) {
  return env.raw.prepare('SELECT COUNT(*) AS n FROM ' + table).get().n;
}

test('approval API rejects non-POST requests', async () => {
  const env = makeEnv();
  const r = await handleAdminOrderApproval(new Request('https://muslimabaya.com/api/admin-order-approval'), env);
  assert.equal(r.status, 405);
});
test('approval API rejects cross-origin writes', async () => {
  const env = makeEnv();
  const r = await call(env, { Action: 'list' }, staff);
  // same-origin baseline
  assert.equal(r.status, 200);
  const cross = await handleAdminOrderApproval(req({ Token: 'x', Action: 'list' }, 'https://evil.example'), env, { verify: async () => staff });
  assert.equal(cross.status, 403);
});
test('approval API requires a token', async () => {
  const env = makeEnv();
  const r = await handleAdminOrderApproval(req({ Action: 'list' }), env, { verify: async () => staff });
  assert.equal(r.status, 401);
});
test('staff can read the queue but cannot mutate any approval state', async () => {
  const env = makeEnv();
  savedOrder(env);
  const created = await call(env, { Action: 'create', OrderId: 'MA-2026-0001' });
  assert.equal(created.status, 200);
  const read = await call(env, { Action: 'list', Status: 'all' }, staff);
  assert.equal(read.status, 200);
  for (const Action of ['approve', 'reject', 'hold', 'assign', 'create', 'reopen']) {
    const r = await call(env, { Action, ApprovalId: 'oa_x', OrderId: 'MA-2026-0001', AssignedTo: 'staff@example.test', ExpectedVersion: '1', Reason: 'review' }, staff);
    assert.equal(r.status, 403, Action);
  }
});
test('manager role is denied until the Admins role model supports it', async () => {
  const env = makeEnv();
  const r = await call(env, { Action: 'approve', ApprovalId: 'oa_x', ExpectedVersion: '1' }, { ok: true, role: 'manager', email: 'manager@example.test' });
  assert.equal(r.status, 403);
});
test('admin cannot create an approval for an order that is not saved in order_inbox', async () => {
  const env = makeEnv();
  const r = await call(env, { Action: 'create', OrderId: 'MA-NOT-SAVED' });
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error, 'SAVED_ORDER_NOT_FOUND');
});
test('create is idempotent and writes exactly one created event', async () => {
  const env = makeEnv();
  savedOrder(env);
  const first = await call(env, { Action: 'create', OrderId: 'MA-2026-0001' });
  const firstBody = await first.json();
  assert.equal(first.status, 200);
  assert.equal(firstBody.created, true);
  const second = await call(env, { Action: 'create', OrderId: 'MA-2026-0001' });
  const secondBody = await second.json();
  assert.equal(second.status, 200);
  assert.equal(secondBody.created, false);
  assert.equal(count(env, 'order_approvals'), 1);
  assert.equal(count(env, 'order_approval_events'), 1);
});
test('assign and approve use optimistic versioning and append audit events', async () => {
  const env = makeEnv();
  savedOrder(env);
  const created = await call(env, { Action: 'create', OrderId: 'MA-2026-0001' });
  const approvalId = (await created.json()).approval.approval_id;
  const assigned = await call(env, { Action: 'assign', ApprovalId: approvalId, AssignedTo: 'staff@example.test', ExpectedVersion: '1' });
  assert.equal(assigned.status, 200);
  const assignedRow = (await assigned.json()).approval;
  assert.equal(assignedRow.assigned_to, 'staff@example.test');
  assert.equal(assignedRow.version, 2);
  const stale = await call(env, { Action: 'approve', ApprovalId: approvalId, ExpectedVersion: '1' });
  assert.equal(stale.status, 409);
  const approved = await call(env, { Action: 'approve', ApprovalId: approvalId, ExpectedVersion: '2' });
  assert.equal(approved.status, 200);
  const approvedRow = (await approved.json()).approval;
  assert.equal(approvedRow.approval_status, 'approved');
  assert.equal(approvedRow.version, 3);
  const history = await call(env, { Action: 'history', ApprovalId: approvalId });
  assert.equal(history.status, 200);
  const events = (await history.json()).history;
  assert.deepEqual(events.map((event) => event.action), ['approved', 'assigned', 'created']);
});
test('reject and hold require a reason and invalid transitions are rejected', async () => {
  const env = makeEnv();
  savedOrder(env);
  const created = await call(env, { Action: 'create', OrderId: 'MA-2026-0001' });
  const id = (await created.json()).approval.approval_id;
  const noReason = await call(env, { Action: 'hold', ApprovalId: id, ExpectedVersion: '1' });
  assert.equal(noReason.status, 400);
  const held = await call(env, { Action: 'hold', ApprovalId: id, ExpectedVersion: '1', Reason: 'Need manual review' });
  assert.equal(held.status, 200);
  const rejected = await call(env, { Action: 'reject', ApprovalId: id, ExpectedVersion: '2', Reason: 'Unable to verify order' });
  assert.equal(rejected.status, 200);
  const approveAgain = await call(env, { Action: 'approve', ApprovalId: id, ExpectedVersion: '3' });
  assert.equal(approveAgain.status, 409);
});
test('Owner-only reopen remains disabled because the current role model cannot identify a distinct Owner', async () => {
  const env = makeEnv();
  savedOrder(env);
  const created = await call(env, { Action: 'create', OrderId: 'MA-2026-0001' });
  const id = (await created.json()).approval.approval_id;
  const rejected = await call(env, { Action: 'reject', ApprovalId: id, ExpectedVersion: '1', Reason: 'Test' });
  assert.equal(rejected.status, 200);
  const reopen = await call(env, { Action: 'reopen', ApprovalId: id, ExpectedVersion: '2', Reason: 'Owner review' });
  assert.equal(reopen.status, 403);
  assert.equal((await reopen.json()).error, 'OWNER_ROLE_NOT_CONFIGURED');
});
test('approval operations never mutate the saved operational order or its status', async () => {
  const env = makeEnv();
  savedOrder(env);
  const before = env.raw.prepare('SELECT * FROM order_inbox WHERE order_id = ?').get('MA-2026-0001');
  const created = await call(env, { Action: 'create', OrderId: 'MA-2026-0001' });
  const id = (await created.json()).approval.approval_id;
  await call(env, { Action: 'assign', ApprovalId: id, AssignedTo: 'staff@example.test', ExpectedVersion: '1' });
  await call(env, { Action: 'approve', ApprovalId: id, ExpectedVersion: '2' });
  const after = env.raw.prepare('SELECT * FROM order_inbox WHERE order_id = ?').get('MA-2026-0001');
  assert.deepEqual(after, before);
  assert.equal(count(env, 'order_approvals'), 1);
});
test('approval audit events are append-only at the D1 schema layer', async () => {
  const env = makeEnv();
  savedOrder(env);
  const created = await call(env, { Action: 'create', OrderId: 'MA-2026-0001' });
  const id = (await created.json()).approval.approval_id;
  const eventId = env.raw.prepare('SELECT event_id FROM order_approval_events WHERE approval_id = ?').get(id).event_id;
  assert.throws(() => env.raw.prepare('UPDATE order_approval_events SET reason = ? WHERE event_id = ?').run('tampered', eventId), /APPEND_ONLY/);
  assert.throws(() => env.raw.prepare('DELETE FROM order_approval_events WHERE event_id = ?').run(eventId), /APPEND_ONLY/);
});
test('approval API returns unavailable when D1 binding is absent', async () => {
  const r = await handleAdminOrderApproval(req({ Token: 'x' }), { GOOGLE_SA_JSON: '{}' }, { verify: async () => admin });
  assert.equal(r.status, 503);
});
