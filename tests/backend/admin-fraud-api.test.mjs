import test from 'node:test';
import assert from 'node:assert/strict';
import { handleAdminFraud } from '../../functions/api/admin-fraud.js';

function request(fields, origin) {
  return new Request('https://muslimabaya.com/api/admin-fraud', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/x-www-form-urlencoded' }, origin ? { Origin: origin } : {}),
    body: new URLSearchParams(fields)
  });
}
const env = { ORDERS_DB: {}, GOOGLE_SA_JSON: '{}' };

test('fraud API rejects non-POST requests', async () => {
  const res = await handleAdminFraud(new Request('https://muslimabaya.com/api/admin-fraud'), env);
  assert.equal(res.status, 405);
});

test('fraud API rejects cross-origin writes', async () => {
  const res = await handleAdminFraud(request({ Token: 'x' }, 'https://evil.example'), env);
  assert.equal(res.status, 403);
});

test('fraud API requires a session token', async () => {
  const res = await handleAdminFraud(request({ Action: 'list' }), env);
  assert.equal(res.status, 401);
});

test('fraud API denies staff/non-owner sessions server-side', async () => {
  const res = await handleAdminFraud(request({ Token: 'staff-token', Action: 'list' }), env, {
    isOwner: async () => 'OWNER_ONLY'
  });
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'OWNER_ONLY');
});

test('fraud API returns unavailable when database binding is absent', async () => {
  const res = await handleAdminFraud(request({ Token: 'x' }), { GOOGLE_SA_JSON: '{}' });
  assert.equal(res.status, 503);
});
