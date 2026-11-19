// /_ma/repeat: the checkout page's "স্বাগতম, আবার এসেছেন" note. Only a boolean leaves the
// worker — never a name, a count, or anything else about the phone's order history.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const worker = (await import(path.join(root, 'cloudflare-worker/worker.js'))).default;

function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(root, 'cloudflare-worker/schema-ip.sql'), 'utf8'));
  const prep = (sql) => {
    let args = [];
    const api = {
      bind(...a) { args = a.map((v) => (v === undefined ? null : v)); return api; },
      async first() { return db.prepare(sql).get(...args) || null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { db.prepare(sql).run(...args); return { success: true }; },
    };
    return api;
  };
  return { prepare: prep, raw: db };
}

function req(phone, { origin = 'https://muslimabaya.com' } = {}) {
  const headers = {};
  if (origin) headers.Origin = origin;
  return new Request('https://muslimabaya.com/_ma/repeat?phone=' + encodeURIComponent(phone), { headers });
}

test('repeat check: true only for a phone with a past non-blocked order', async () => {
  const DB = makeD1();
  DB.raw.prepare('INSERT INTO order_ip_log (event_id, created_at, ip, phone, outcome) VALUES (?, ?, ?, ?, ?)')
    .run('e1', Date.now() - 86400000, '1.2.3.4', '01711111111', 'saved');
  DB.raw.prepare('INSERT INTO order_ip_log (event_id, created_at, ip, phone, outcome) VALUES (?, ?, ?, ?, ?)')
    .run('e2', Date.now() - 86400000, '1.2.3.5', '01822222222', 'blocked');

  const known = await worker.fetch(req('01711111111'), { DB }, {});
  assert.equal(known.status, 200);
  assert.deepEqual(await known.json(), { ok: true, repeat: true });

  const onlyBlocked = await worker.fetch(req('01822222222'), { DB }, {});
  assert.deepEqual(await onlyBlocked.json(), { ok: true, repeat: false }, 'a blocked attempt does not count as a real customer');

  const unknown = await worker.fetch(req('01933333333'), { DB }, {});
  assert.deepEqual(await unknown.json(), { ok: true, repeat: false });
});

test('repeat check: bad or missing phone returns false, never an error', async () => {
  const DB = makeD1();
  assert.deepEqual(await (await worker.fetch(req('not-a-phone'), { DB }, {})).json(), { ok: true, repeat: false });
  assert.deepEqual(await (await worker.fetch(req(''), { DB }, {})).json(), { ok: true, repeat: false });
});

test('repeat check: rejects a request whose Origin is not the storefront', async () => {
  const DB = makeD1();
  const res = await worker.fetch(req('01711111111', { origin: 'https://evil.example' }), { DB }, {});
  assert.equal(res.status, 403);
});

test('repeat check: only GET is allowed', async () => {
  const DB = makeD1();
  const res = await worker.fetch(new Request('https://muslimabaya.com/_ma/repeat?phone=01711111111', { method: 'POST', headers: { Origin: 'https://muslimabaya.com' } }), { DB }, {});
  assert.equal(res.status, 405);
});

test('repeat check: never throws when D1 is unavailable', async () => {
  const res = await worker.fetch(req('01711111111'), {}, {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, repeat: false });
});
