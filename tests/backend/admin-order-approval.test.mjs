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
const db = {};
const env = { ORDERS_DB: db, GOOGLE_SA_JSON: '{}' };
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
test('staff can read queue but cannot approve or assign', async () => {
  const read = await handleAdminOrderApproval(req({ Token: 'staff', Action: 'list' }), env, { verify: async () => staff });
  assert.equal(read.status, 503); // D1 fake is intentionally absent for this route; auth was accepted.
  const write = await handleAdminOrderApproval(req({ Token: 'staff', Action: 'approve', ApprovalId: 'oa_x', ExpectedVersion: '1' }), env, { verify: async () => staff });
  assert.equal(write.status, 403);
});
test('admin approval API rejects unknown manager role rather than granting implied access', async () => {
  const r = await handleAdminOrderApproval(req({ Token: 'manager', Action: 'approve', ApprovalId: 'oa_x', ExpectedVersion: '1' }), env, {
    verify: async () => ({ ok: true, role: 'manager', email: 'manager@example.test' })
  });
  assert.equal(r.status, 403);
});
test('approval API returns unavailable when D1 binding is absent', async () => {
  const r = await handleAdminOrderApproval(req({ Token: 'x' }), { GOOGLE_SA_JSON: '{}' }, { verify: async () => admin });
  assert.equal(r.status, 503);
});
