// /_ma/view: the real "X people viewing this product now" counter. No random or fabricated
// number ever leaves the worker — only a count of distinct recent session heartbeats for that
// exact product, and old heartbeats stop counting (and get cleaned up) on their own.
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
  db.exec(fs.readFileSync(path.join(root, 'cloudflare-worker/schema-views.sql'), 'utf8'));
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

function req(body, { origin = 'https://muslimabaya.com' } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  return new Request('https://muslimabaya.com/_ma/view', { method: 'POST', headers, body: JSON.stringify(body) });
}

test('live view: a lone viewer counts as 1 (not hidden by the worker, the page hides it)', async () => {
  const DB = makeD1();
  const res = await worker.fetch(req({ productId: 'ABY-1', sessionId: 'sidA' }), { DB }, {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, viewing: 1 });
});

test('live view: two different sessions on the same product both count, a different product does not', async () => {
  const DB = makeD1();
  await worker.fetch(req({ productId: 'ABY-1', sessionId: 'sidA' }), { DB }, {});
  await worker.fetch(req({ productId: 'ABY-1', sessionId: 'sidB' }), { DB }, {});
  await worker.fetch(req({ productId: 'ABY-2', sessionId: 'sidC' }), { DB }, {});
  const res = await worker.fetch(req({ productId: 'ABY-1', sessionId: 'sidA' }), { DB }, {});
  assert.deepEqual(await res.json(), { ok: true, viewing: 2 }, 'ABY-2 must not be counted into ABY-1');
});

test('live view: a stale heartbeat (older than the active window) stops counting', async () => {
  const DB = makeD1();
  const now = Date.now();
  DB.raw.prepare('INSERT INTO product_live_views (session_id, product_id, last_seen) VALUES (?, ?, ?)')
    .run('sidOld', 'ABY-1', now - 5 * 60 * 1000); // 5 minutes ago — well past the ~90s active window
  const res = await worker.fetch(req({ productId: 'ABY-1', sessionId: 'sidA' }), { DB }, {});
  assert.deepEqual(await res.json(), { ok: true, viewing: 1 }, 'only the fresh ping counts, the 5-minute-old one does not');
});

test('live view: a repeated ping from the same session updates, not duplicates', async () => {
  const DB = makeD1();
  await worker.fetch(req({ productId: 'ABY-1', sessionId: 'sidA' }), { DB }, {});
  await worker.fetch(req({ productId: 'ABY-1', sessionId: 'sidA' }), { DB }, {});
  const row = DB.raw.prepare('SELECT COUNT(*) AS n FROM product_live_views WHERE product_id = ?').get('ABY-1');
  assert.equal(row.n, 1);
});

test('live view: bad input, no DB, or wrong Origin never errors — always a safe 0', async () => {
  const DB = makeD1();
  assert.deepEqual(await (await worker.fetch(req({ productId: '', sessionId: 'sidA' }), { DB }, {})).json(), { ok: true, viewing: 0 });
  assert.deepEqual(await (await worker.fetch(req({ productId: 'ABY-1', sessionId: '' }), { DB }, {})).json(), { ok: true, viewing: 0 });
  assert.deepEqual(await (await worker.fetch(req({ productId: 'ABY-1', sessionId: 'sidA' }), {}, {})).json(), { ok: true, viewing: 0 });
  const forbidden = await worker.fetch(req({ productId: 'ABY-1', sessionId: 'sidA' }, { origin: 'https://evil.example' }), { DB }, {});
  assert.equal(forbidden.status, 403);
});

test('live view: only POST is accepted', async () => {
  const DB = makeD1();
  const res = await worker.fetch(new Request('https://muslimabaya.com/_ma/view', { method: 'GET' }), { DB }, {});
  assert.equal(res.status, 405);
});
