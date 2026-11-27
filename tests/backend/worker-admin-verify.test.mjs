// The Worker's admin check must report the real reason (rate limit, outage) instead of INVALID_TOKEN,
// and must re-check every time so a blocked staff account loses access immediately.
import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAdminToken } from '../../cloudflare-worker/worker.js';

const reply = (obj) => async () => new Response(JSON.stringify(obj));

test('rate limit from Apps Script is reported as RATE_LIMIT (429), not INVALID_TOKEN', async () => {
  const v = await verifyAdminToken({}, 'tok-rl', { fetch: reply({ ok: false, error: 'RATE_LIMIT' }) });
  assert.deepEqual([v.ok, v.error, v.status], [false, 'RATE_LIMIT', 429]);
});

test('a real bad token stays INVALID_TOKEN (401)', async () => {
  const v = await verifyAdminToken({}, 'tok-bad', { fetch: reply({ ok: false, error: 'INVALID_TOKEN' }) });
  assert.deepEqual([v.error, v.status], ['INVALID_TOKEN', 401]);
});

test('network failure is VERIFY_UNAVAILABLE (503)', async () => {
  const v = await verifyAdminToken({}, 'tok-net', { fetch: async () => { throw new Error('down'); } });
  assert.deepEqual([v.error, v.status], ['VERIFY_UNAVAILABLE', 503]);
});

test('every check asks Apps Script again, so a revoked staff token fails at once', async () => {
  let ok = true, calls = 0;
  const f = async () => { calls++; return new Response(JSON.stringify(ok ? { ok: true, role: 'staff' } : { ok: false, error: 'BLOCKED' })); };
  assert.equal((await verifyAdminToken({}, 'tok-staff', { fetch: f })).ok, true);
  ok = false;
  const v = await verifyAdminToken({}, 'tok-staff', { fetch: f });
  assert.deepEqual([v.ok, v.error, v.status, calls], [false, 'BLOCKED', 401, 2]);
});
