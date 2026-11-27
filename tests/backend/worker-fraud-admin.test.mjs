// Fraud review queue served by the Worker (/_ma/admin/fraud): owner-only queue actions, staff may read
// per-order risk for the orders list, and nothing works without a verified admin session.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handleFraudAdmin } from '../../cloudflare-worker/fraud-admin.js';

// Minimal D1 stand-in on top of SQLite.
function d1() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(new URL('../../cloudflare-worker/schema-fraud-review.sql', import.meta.url), 'utf8'));
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    all: async () => ({ results: db.prepare(sql).all(...args) }),
    first: async () => db.prepare(sql).get(...args) || null,
    run: async () => { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; },
  });
  return {
    raw: db,
    prepare: (sql) => stmt(sql),
    batch: async (list) => { const out = []; for (const s of list) out.push(await s.run()); return out; },
  };
}

function seed(db) {
  const ins = db.raw.prepare("INSERT INTO fraud_reviews (review_id, event_id, order_id, risk_score, risk_level, risk_action, reasons_json, signals_json, review_status, version, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
  ins.run('fr_1', 'ev1', 'MA-1', 70, 'high', 'manual_review', JSON.stringify(['VPN/proxy network']), '{}', 'pending', 1, 1000, 1000);
  ins.run('fr_2', 'ev2', 'MA-2', 40, 'review', 'challenge', JSON.stringify(['same phone repeated']), '{}', 'cleared', 2, 2000, 2000);
}

const verify = async (_env, token) => token === 'owner' ? { ok: true, role: 'admin', email: 'owner@example.test' }
  : token === 'staff' ? { ok: true, role: 'staff', email: 'staff@example.test' }
  : token === 'busy' ? { ok: false, error: 'RATE_LIMIT', status: 429 }
  : { ok: false, error: 'INVALID_TOKEN', status: 401 };

const call = (env, body, origin) => handleFraudAdmin(new Request('https://muslimabaya.com/_ma/admin/fraud', {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, origin ? { Origin: origin } : {}), body: JSON.stringify(body),
}), env, verify, { now: () => 5000 });

test('rejects cross-origin calls and bad or rate-limited sessions with the real reason', async () => {
  const env = { DB: d1() };
  assert.equal((await call(env, { token: 'owner' }, 'https://evil.example')).status, 403);
  const bad = await call(env, { token: 'nope', action: 'list' });
  assert.deepEqual([bad.status, (await bad.json()).error], [401, 'INVALID_TOKEN']);
  const busy = await call(env, { token: 'busy', action: 'list' });
  assert.deepEqual([busy.status, (await busy.json()).error], [429, 'RATE_LIMIT']);
});

test('owner can list and decide; staff cannot', async () => {
  const env = { DB: d1() }; seed(env.DB);
  const list = await (await call(env, { token: 'owner', action: 'list', status: 'all' })).json();
  assert.deepEqual(list.reviews.map((r) => r.reviewId), ['fr_2', 'fr_1']);
  const staff = await call(env, { token: 'staff', action: 'list' });
  assert.deepEqual([staff.status, (await staff.json()).error], [403, 'OWNER_ONLY']);
  const decided = await (await call(env, { token: 'owner', action: 'decide', reviewId: 'fr_1', status: 'rejected', reason: 'fake address', expectedVersion: 1 })).json();
  assert.equal(decided.review.status, 'rejected');
  const detail = await (await call(env, { token: 'owner', action: 'detail', reviewId: 'fr_1' })).json();
  assert.equal(detail.history[0].newStatus, 'rejected');
  const stale = await call(env, { token: 'owner', action: 'decide', reviewId: 'fr_1', status: 'pending', reason: 'x', expectedVersion: 1 });
  assert.equal(stale.status, 409);
});

test('order_risk returns per-order risk for staff and owner, and nothing for unknown orders', async () => {
  const env = { DB: d1() }; seed(env.DB);
  const res = await (await call(env, { token: 'staff', action: 'order_risk', orderIds: ['MA-1', 'MA-2', 'MA-9'] })).json();
  assert.equal(res.ok, true);
  assert.deepEqual(Object.keys(res.risks).sort(), ['MA-1', 'MA-2']);
  assert.deepEqual([res.risks['MA-1'].riskScore, res.risks['MA-1'].status], [70, 'pending']);
  assert.deepEqual(res.risks['MA-1'].reasons, ['VPN/proxy network']);
});
