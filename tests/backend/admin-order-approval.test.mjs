import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAdminOrderApproval } from '../../functions/api/admin-order-approval.js';

function req(fields, origin) {
  return new Request('https://muslimabaya.com/api/admin-order-approval', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, origin ? { Origin: origin } : {}),
    body: new URLSearchParams(fields)
  });
}
function fakeDb() {
  return {
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async all() { return { results: [] }; },
        async first() {
          if (sql.includes('FROM order_inbox')) return null;
          return null;
        },
        async run() { return { meta: { changes: 0 } }; }
      };
    },
    async batch() { return [{ meta: { changes: 0 } }, { meta: { changes: 0 } }]; }
  };
}
const env = { ORDERS_DB: fakeDb(), GOOGLE_SA_JSON: '{}' };
const staff = { ok: true, role: 'staff', email: 'staff@example.test' };
const admin = { ok: true, role: 'admin', email: 'owner@example.test' };

test('approval API rejects non-POST requests', async () => {
  const r = await handleAdminOrderApproval(new Request('https://muslimabaya.com/api/admin-order-approval'), env);
  assert.equal(r.status, 405);
});
test('approval API rejects cross-origin writes', async () => {
  const r = await handleAdminOrderApproval(req({ Token: 'x' }, 'https://evil.example'), env);
  assert.equal(r.status, 403);
});
test('approval API requires a token', async () => {
  const r = await handleAdminOrderApproval(req({ Action: 'list' }), env);
  assert.equal(r.status, 401);
});
test('staff can read the queue', async () => {
  const r = await handleAdminOrderApproval(req({ Token: 'staff', Action: 'list' }), env, { verify: async () => staff });
  assert.equal(r.status, 200);
  assert.deepEqual((await r.json()).approvals, []);
});
test('staff cannot approve, reject, hold, assign, create, or reopen', async () => {
  for (const Action of ['approve', 'reject', 'hold', 'assign', 'create', 'reopen']) {
    const r = await handleAdminOrderApproval(req({ Token: 'staff', Action, ApprovalId: 'oa_x', OrderId: 'MA-1', AssignedTo: 'staff@example.test', ExpectedVersion: '1', Reason: 'review' }), env, { verify: async () => staff });
    assert.equal(r.status, 403, Action);
  }
});
test('manager role is not implicitly granted before the Admins role model supports it', async () => {
  const r = await handleAdminOrderApproval(req({ Token: 'manager', Action: 'approve', ApprovalId: 'oa_x', ExpectedVersion: '1' }), env, {
    verify: async () => ({ ok: true, role: 'manager', email: 'manager@example.test' })
  });
  assert.equal(r.status, 403);
});
test('admin cannot create an approval for an order that is not saved in order_inbox', async () => {
  const r = await handleAdminOrderApproval(req({ Token: 'admin', Action: 'create', OrderId: 'MA-NOT-SAVED' }), env, { verify: async () => admin });
  assert.equal(r.status, 404);
  assert.equal((await r.json()).error, 'SAVED_ORDER_NOT_FOUND');
});
test('approval API returns unavailable when D1 binding is absent', async () => {
  const r = await handleAdminOrderApproval(req({ Token: 'x' }), { GOOGLE_SA_JSON: '{}' }, { verify: async () => admin });
  assert.equal(r.status, 503);
});
