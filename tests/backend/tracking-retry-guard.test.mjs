import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { processTrackingRetryQueue } from '../../cloudflare-worker/worker.js';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

async function encryptedPayload(payload, keyBytes) {
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await webcrypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const encrypted = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const b64 = (value) => Buffer.from(value).toString('base64');
  return 'v1.' + b64(iv) + '.' + b64(new Uint8Array(encrypted));
}

function makeDb(row, domainEnabled) {
  const updates = [];
  const logs = [];
  const db = {
    updates,
    logs,
    prepare(sql) {
      let values = [];
      return {
        bind(...args) { values = args; return this; },
        async all() {
          if (sql.includes('FROM tracking_event_queue q JOIN tracking_profiles')) return { results: [row] };
          return { results: [] };
        },
        async first() {
          if (sql.includes('FROM tracking_domains')) return domainEnabled ? { id: 21 } : null;
          return null;
        },
        async run() {
          updates.push({ sql, values });
          if (sql.includes('INSERT INTO tracking_event_log')) logs.push({ sql, values });
          if (sql.includes("SET status = 'processing'")) return { meta: { changes: 1 } };
          return { meta: { changes: 1 } };
        }
      };
    }
  };
  return db;
}

for (const scenario of [
  { name: 'disabled profile', profileEnabled: 0, domainEnabled: true, config: { events: { Purchase: true } }, reason: 'PROFILE_DISABLED' },
  { name: 'unmapped or disabled domain', profileEnabled: 1, domainEnabled: false, config: { events: { Purchase: true } }, reason: 'DOMAIN_NOT_MAPPED' },
  { name: 'disabled event switch', profileEnabled: 1, domainEnabled: true, config: { events: { Purchase: false } }, reason: 'EVENT_DISABLED' }
]) {
  test('retry guard skips provider dispatch when ' + scenario.name, async () => {
    const rawKey = webcrypto.getRandomValues(new Uint8Array(32));
    const key = Buffer.from(rawKey).toString('base64');
    const payload = {
      hostname: 'shop.example.com.',
      eventName: 'Purchase',
      body: JSON.stringify({ data: [{ event_name: 'Purchase' }] })
    };
    const row = {
      id: 77, profile_id: 8, provider: 'meta', event_id: 'evt-retry-guard',
      encrypted_payload: await encryptedPayload(payload, rawKey),
      attempt_count: 0, meta_pixel_id: '1234567890', tiktok_pixel_id: '',
      meta_token_ciphertext: 'not-needed', tiktok_token_ciphertext: '',
      profile_enabled: scenario.profileEnabled, config_json: JSON.stringify(scenario.config)
    };
    const DB = makeDb(row, scenario.domainEnabled);
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = async () => { fetchCalls += 1; throw new Error('Provider fetch must not occur for skipped events'); };
    try {
      await processTrackingRetryQueue({ DB, TRACKING_ENCRYPTION_KEY: key });
    } finally {
      globalThis.fetch = originalFetch;
    }
    assert.equal(fetchCalls, 0, 'disabled or unmapped retry must never call a provider');
    const dead = DB.updates.find((item) => item.sql.includes("SET status = 'dead'"));
    assert.ok(dead, 'queue item should be moved to dead state');
    assert.equal(dead.values[0], scenario.reason);
    assert.ok(DB.updates.some((item) => item.sql.includes('DELETE FROM tracking_event_dedup')), 'dedup claim should be released');
    const log = DB.logs[0];
    assert.ok(log, 'skip should be written to the operational event log');
    assert.equal(log.values[5], 'skipped');
    assert.equal(log.values[7], scenario.reason);
  });
}
