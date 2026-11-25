import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTrackingAdmin, resolveTrackingProfile, claimTrackingEvent, releaseTrackingEvent, logTrackingEvent, decryptTrackingToken } from '../../cloudflare-worker/tracking-admin.js';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;

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
      metaAccessToken: '', tiktokAccessToken: '', config: { advancedMatching: ['em', 'ph', 'not_allowed'], events: { Purchase: true } }
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


test('domain resolver returns only enabled mapped profile fields', async () => {
  const db = {
    prepare(sql) {
      assert.match(sql, /tracking_domains d JOIN tracking_profiles p/);
      return { bind(host) { assert.equal(host, 'shop.example.com'); return this; }, async first() {
        return { id: 4, profile_key: 'client-a', name: 'Client A', meta_pixel_id: '1234567890',
          tiktok_pixel_id: 'abcdefghij', meta_token_ciphertext: 'cipher', tiktok_token_ciphertext: '',
          enabled: 1, config_json: JSON.stringify({ advancedMatching: ['em'], events: { Purchase: false } }) };
      } };
    }
  };
  const profile = await resolveTrackingProfile('SHOP.EXAMPLE.COM.', { DB: db });
  assert.equal(profile.key, 'client-a');
  assert.equal(profile.metaPixelId, '1234567890');
  assert.equal(profile.metaTokenCiphertext, 'cipher');
  assert.deepEqual(profile.config.advancedMatching, ['em']);
  assert.equal(profile.config.events.Purchase, false);
});

test('domain resolver refuses malformed hostnames without querying D1', async () => {
  let called = false;
  const result = await resolveTrackingProfile('https://example.com/path', { DB: { prepare() { called = true; } } });
  assert.equal(result, null);
  assert.equal(called, false);
});

test('provider event claim uses unique profile/provider/event key', async () => {
  const calls = [];
  const env = { DB: { prepare(sql) { return { bind(...values) { calls.push({ sql, values }); return this; }, async run() { return { meta: { changes: 1 } }; } }; } } };
  const claimed = await claimTrackingEvent(env, 9, 'meta', 'evt-123');
  assert.equal(claimed, true);
  assert.match(calls[0].sql, /INSERT OR IGNORE/);
  assert.equal(calls[0].values[0], '9:meta:evt-123');
  assert.equal(calls[0].values[2], 'meta');
});

test('event logs store only allow-listed operational metadata', async () => {
  let inserted;
  const env = { DB: { prepare(sql) { return { bind(...values) { inserted = { sql, values }; return this; }, async run() { return {}; } }; } } };
  await logTrackingEvent(env, { profileId: 2, hostname: 'shop.example.com', provider: 'meta',
    eventName: 'Purchase', eventId: 'evt-1', status: 'failed', httpStatus: 400,
    errorCode: 'META_API_ERROR', traceId: 'trace-1', email: 'private@example.com', phone: '01700000000' });
  assert.match(inserted.sql, /details_json/);
  assert.equal(inserted.values.includes('private@example.com'), false);
  assert.equal(inserted.values.includes('01700000000'), false);
  assert.equal(inserted.values[4], 'evt-1');
});

test('AES-GCM encrypted tracking token decrypts only with the configured 32-byte key', async () => {
  const rawKey = webcrypto.getRandomValues(new Uint8Array(32));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await webcrypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode('test-provider-token'));
  const toBase64 = (bytes) => Buffer.from(bytes).toString('base64');
  const ciphertext = 'v1.' + toBase64(iv) + '.' + toBase64(new Uint8Array(encrypted));
  const token = await decryptTrackingToken(ciphertext, { TRACKING_ENCRYPTION_KEY: toBase64(rawKey) });
  assert.equal(token, 'test-provider-token');
  await assert.rejects(() => decryptTrackingToken(ciphertext, { TRACKING_ENCRYPTION_KEY: toBase64(new Uint8Array(32)) }));
});


test('failed delivery can release its dedup claim for retry', async () => {
  let deleted;
  const env = { DB: { prepare(sql) { assert.match(sql, /DELETE FROM tracking_event_dedup/); return { bind(key) { deleted = key; return this; }, async run() { return {}; } }; } } };
  await releaseTrackingEvent(env, 3, 'meta', 'event-retry');
  assert.equal(deleted, '3:meta:event-retry');
});
