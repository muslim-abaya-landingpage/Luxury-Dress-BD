// The Worker's admin check must report the real reason (rate limit, outage) instead of INVALID_TOKEN,
// and must not call Apps Script again for a token it verified moments ago.
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAdminToken, adminVerifyCache } from '../../cloudflare-worker/worker.js';

const reply = (obj) => async () => new Response(JSON.stringify(obj));

test('rate limit from Apps Script is reported as RATE_LIMIT (429), not INVALID_TOKEN', async () => {
  adminVerifyCache.clear();
  const v = await verifyAdminToken({}, 'tok-rl', { fetch: reply({ ok: false, error: 'RATE_LIMIT' }) });
  assert.deepEqual([v.ok, v.error, v.status], [false, 'RATE_LIMIT', 429]);
});

test('a real bad token stays INVALID_TOKEN (401)', async () => {
  adminVerifyCache.clear();
  const v = await verifyAdminToken({}, 'tok-bad', { fetch: reply({ ok: false, error: 'INVALID_TOKEN' }) });
  assert.deepEqual([v.error, v.status], ['INVALID_TOKEN', 401]);
});

test('network failure is VERIFY_UNAVAILABLE (503)', async () => {
  adminVerifyCache.clear();
  const v = await verifyAdminToken({}, 'tok-net', { fetch: async () => { throw new Error('down'); } });
  assert.deepEqual([v.error, v.status], ['VERIFY_UNAVAILABLE', 503]);
});

test('a verified token is reused for 2 minutes without another Apps Script call', async () => {
  adminVerifyCache.clear();
  let calls = 0;
  const f = async () => { calls++; return new Response(JSON.stringify({ ok: true, role: 'admin', email: 'a@example.test' })); };
  let t = 1000;
  const now = () => t;
  assert.equal((await verifyAdminToken({}, 'tok-ok', { fetch: f, now })).ok, true);
  t += 60000;
  assert.equal((await verifyAdminToken({}, 'tok-ok', { fetch: f, now })).ok, true);
  assert.equal(calls, 1);
  t += 120000;
  await verifyAdminToken({}, 'tok-ok', { fetch: f, now });
  assert.equal(calls, 2);
});
