// Owner-only persistent global product attributes registry.
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

function fakeD1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, args = []) => ({
    bind: (...values) => stmt(sql, values),
    first: async () => { const row = db.prepare(sql).get(...args); return row ? { ...row } : null; },
    run: async () => { const result = db.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
  });
  return { prepare: (sql) => stmt(sql), _db: db };
}
async function setup() {
  const mod = await import(path.join(root, 'functions/api/global-attributes.js'));
  const db = fakeD1();
  const env = { STOCK_DB: db, GOOGLE_SA_JSON: '{}' };
  const call = (payload, auth = '') => mod.handleGlobalAttributes(new Request('https://muslimabaya.com/api/global-attributes', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://muslimabaya.com' },
    body: JSON.stringify({ Token: 'session', ...payload }),
  }), env, { authorize: async () => auth, now: () => 123456 });
  return { call, db };
}
test('global attributes are persisted separately with optimistic revisions', async () => {
  const { call } = await setup();
  const empty = await call({ action: 'read' });
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json()).attributes, []);
  const attributes = [{ id: 'fabric', name: 'Fabric', terms: [{ id: 'linen', name: 'Linen' }, { id: 'cotton', name: 'Cotton' }], variation: true, visible: true }];
  const saved = await call({ action: 'save', revision: 0, attributes });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).revision, 1);
  const loaded = await call({ action: 'read' });
  assert.deepEqual((await loaded.json()).attributes, attributes);
  assert.equal((await call({ action: 'save', revision: 0, attributes: [] })).status, 409);
});
test('global attribute registry rejects reserved IDs and duplicate terms', async () => {
  const { call } = await setup();
  assert.equal((await call({ action: 'save', revision: 0, attributes: [{ id: 'color', name: 'Shade', terms: [] }] })).status, 400);
  assert.equal((await call({ action: 'save', revision: 0, attributes: [{ id: 'fabric', name: 'Fabric', terms: [{ id: 'cotton', name: 'Cotton' }, { id: 'cotton-2', name: 'cotton' }] }] })).status, 400);
});
test('global attribute registry requires owner authorization and same-origin requests', async () => {
  const { call } = await setup();
  assert.equal((await call({ action: 'read' }, 'OWNER_ONLY')).status, 403);
  const mod = await import(path.join(root, 'functions/api/global-attributes.js'));
  const req = new Request('https://muslimabaya.com/api/global-attributes', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ Token: 'session', action: 'read' }) });
  assert.equal((await mod.handleGlobalAttributes(req, { STOCK_DB: fakeD1(), GOOGLE_SA_JSON: '{}' }, { authorize: async () => '' })).status, 403);
});
