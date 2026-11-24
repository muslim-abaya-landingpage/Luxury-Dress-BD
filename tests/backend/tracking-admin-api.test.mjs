import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTrackingAdmin } from '../../cloudflare-worker/tracking-admin.js';

function makeDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      return {
        values: [],
        bind(...values) { this.values = values; return this; },
        async first() {
          calls.push({ method: 'first', sql, values: this.values });
          if (sql.includes('SELECT id FROM tracking_profiles')) return null;
          if (sql.includes('SELECT id FROM tracking_profiles WHERE id')) return { id: this.values[0] };
          return null;
        },
        async all() {
          calls.push({ method: 'all', sql, values: this.values });
          return { results: [] };
        },
        async run() {
          calls.push({ method: 'run', sql, values: this.values });
          return { meta: { last_row_id: 12 } };
        }
      };
    }
  };
}

const verify = async (_env, token) => token === 'valid-session' ? { email: 'owner@example.test' } : null;

test('tracking admin API rejects unauthenticated requests', async () => {
  const response = await handleTrackingAdmin(
    new Request('https://muslimabaya.com/_ma/admin/tracking'),
    { DB: makeDb() },
    new URL('https://muslimabaya.com/_ma/admin/tracking'),
    verify
  );
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'INVALID_TOKEN');
});

test('tracking admin API returns a safe profile view without token values', async () => {
  const db = makeDb();
  const url = new URL('https://muslimabaya.com/_ma/admin/tracking');
  const request = new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: 'valid-session', action: 'list' }) });
  const response = await handleTrackingAdmin(request, { DB: db }, url, verify);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.profiles, []);
  assert.deepEqual(body.summary, []);
});

test('profile save validates keys and pixel IDs before writing', async () => {
  const db = makeDb();
  const url = new URL('https://muslimabaya.com/_ma/admin/tracking');
  const request = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'valid-session', action: 'profile.save', key: 'bad key', name: 'Test', metaPixelId: '123' })
  });
  const response = await handleTrackingAdmin(request, { DB: db }, url, verify);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'INVALID_PROFILE');
  assert.equal(db.calls.length, 0);
});

test('profile save creates a profile without exposing credentials', async () => {
  const db = makeDb();
  const url = new URL('https://muslimabaya.com/_ma/admin/tracking');
  const request = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 'valid-session', action: 'profile.save', key: 'muslim-abaya',
      name: 'MUSLIM ABAYA', metaPixelId: '1141629002088045',
      config: { advancedMatching: ['em', 'ph', 'not_allowed'], events: { Purchase: true } }
    })
  });
  const response = await handleTrackingAdmin(request, { DB: db }, url, verify);
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.id, 12);
  const insert = db.calls.find((call) => call.sql.includes('INSERT INTO tracking_profiles'));
  assert.ok(insert);
  assert.equal(insert.values[0], 'muslim-abaya');
  assert.equal(insert.values[4], null);
  assert.equal(JSON.parse(insert.values[7]).advancedMatching.includes('not_allowed'), false);
});

test('domain mapping rejects protocol, path and malformed hostnames', async () => {
  const db = makeDb();
  const url = new URL('https://muslimabaya.com/_ma/admin/tracking');
  const request = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'valid-session', action: 'domain.add', profileId: 1, hostname: 'https://example.com/path' })
  });
  const response = await handleTrackingAdmin(request, { DB: db }, url, verify);
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'INVALID_DOMAIN_MAPPING');
  assert.equal(db.calls.length, 0);
});

test('saving an access token fails closed until the encryption secret is configured', async () => {
  const db = makeDb();
  const url = new URL('https://muslimabaya.com/_ma/admin/tracking');
  const request = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: 'valid-session', action: 'profile.save', key: 'encrypted-profile',
      name: 'Encrypted Profile', metaAccessToken: 'example-token-value-long-enough'
    })
  });
  const response = await handleTrackingAdmin(request, { DB: db }, url, verify);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'TRACKING_ENCRYPTION_KEY_MISSING');
  assert.equal(db.calls.length, 0);
});
