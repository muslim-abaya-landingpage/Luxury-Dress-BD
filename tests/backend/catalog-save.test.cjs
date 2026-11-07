// /api/catalog-save: one request commits the catalog to GitHub (never overwriting a newer change) and makes it live in D1.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '../..');
const lib = (f) => import(path.join(root, 'functions', f));
const NOW = Date.UTC(2026, 10, 7, 0, 30, 0);
const FILES = ['category-products.js', 'product-links-data.js', 'product-catalog-sections.js', 'product-config.js'];
const sha = (c) => c.repeat(40);

function fakeD1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => { const r = db.prepare(sql).get(...args); return r ? Object.assign({}, r) : null; },
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    _run() { db.prepare(sql).run(...args); },
  });
  return { prepare: (sql) => stmt(sql), batch: async (list) => { list.forEach((s) => s._run()); return []; }, _db: db };
}

/** GitHub stand-in: main points at commit c1 whose tree holds the 4 catalog files. */
function fakeGitHub(opts = {}) {
  const calls = [];
  const state = { head: sha('c'), tree: sha('t'), files: Object.fromEntries(FILES.map((f, i) => [f, sha(String(i))])) };
  const fetchImpl = async (url, init = {}) => {
    const u = new URL(url); const method = init.method || 'GET';
    const p = u.pathname.replace('/repos/muslim-abaya-landingpage/Luxury-Dress-BD/', '');
    calls.push(method + ' ' + p);
    assert.equal(init.headers.Authorization, 'Bearer gh-token');
    const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
    if (method === 'GET' && p === 'git/ref/heads/main') return ok({ object: { sha: state.head } });
    if (method === 'GET' && p === 'git/commits/' + state.head) return ok({ tree: { sha: state.tree } });
    if (method === 'GET' && p === 'git/trees/' + state.tree) return ok({ tree: FILES.map((f) => ({ path: f, sha: state.files[f] })).concat([{ path: 'index.html', sha: sha('9') }]) });
    if (method === 'POST' && p === 'git/trees') {
      const body = JSON.parse(init.body);
      assert.equal(body.base_tree, state.tree);
      state.lastTree = body.tree;
      return ok({ sha: sha('n'), tree: body.tree.map((e, i) => ({ path: e.path, sha: sha('abcd'[i]) })) });
    }
    if (method === 'POST' && p === 'git/commits') {
      const body = JSON.parse(init.body);
      assert.deepEqual(body.parents, [state.head]);
      return ok({ sha: sha('e') });
    }
    if (method === 'PATCH' && p === 'git/refs/heads/main') {
      const body = JSON.parse(init.body);
      assert.equal(body.force, false);
      if (opts.raceOnPatch) return new Response('{"message":"Update is not a fast forward"}', { status: 422 });
      state.head = body.sha;
      return ok({ object: { sha: body.sha } });
    }
    return new Response('not found', { status: 404 });
  };
  return { fetchImpl, calls, state };
}

function validation() {
  return JSON.stringify({ version: 1, releaseSha: sha('0'), sources: [], sourceSha256: sha('f').slice(0, 64).padEnd(64, 'f'), products: [{ id: 'NEW-1', category: 'abaya', price: 1350 }] });
}
function body(extra = {}) {
  const gh = fakeGitHub();
  return Object.assign({
    Token: 'tok-owner',
    requestId: 'req-0123456789abcdef',
    baseShas: Object.fromEntries(FILES.map((f, i) => [f, sha(String(i))])),
    files: FILES.map((f) => ({ path: f, content: '// new ' + f })),
    validation: validation(),
    index: { 'NEW-1': 'abaya' },
    names: { 'NEW-1': 'New abaya' },
  }, extra, { _gh: gh });
}
function req(payload, headers = {}) {
  const clean = Object.assign({}, payload); delete clean._gh;
  return new Request('https://muslimabaya.com/api/catalog-save', { method: 'POST', headers: Object.assign({ Origin: 'https://muslimabaya.com', 'Content-Type': 'application/json' }, headers), body: JSON.stringify(clean) });
}
const owner = { authorize: async (t) => (t === 'tok-owner' ? '' : 'OWNER_ONLY'), now: () => NOW, cache: null };

test('without the GitHub token it answers NOT_CONFIGURED so the panel keeps using Apps Script', async () => {
  const { handleCatalogSave } = await lib('api/catalog-save.js');
  const r = await handleCatalogSave(req(body()), { STOCK_DB: fakeD1(), GOOGLE_SA_JSON: 'x' }, owner);
  assert.equal(r.status, 503);
  assert.equal((await r.json()).error, 'NOT_CONFIGURED');
});

test('owner save: one commit with the 4 files on top of main, then live in D1 with the new commit stamped', async () => {
  const { handleCatalogSave } = await lib('api/catalog-save.js');
  const p = body(); const db = fakeD1();
  const r = await handleCatalogSave(req(p), { STOCK_DB: db, GOOGLE_SA_JSON: 'x', GITHUB_TOKEN: 'gh-token' }, Object.assign({ fetch: p._gh.fetchImpl }, owner));
  const out = await r.json();
  assert.equal(r.status, 200, JSON.stringify(out));
  assert.equal(out.ok, true);
  assert.equal(out.sha, sha('e'));
  assert.equal(out.live, true);
  assert.deepEqual(Object.keys(out.shas).sort(), FILES.slice().sort());
  assert.deepEqual(p._gh.calls, ['GET git/ref/heads/main', 'GET git/commits/' + sha('c'), 'GET git/trees/' + sha('t'), 'POST git/trees', 'POST git/commits', 'PATCH git/refs/heads/main']);
  assert.deepEqual(p._gh.state.lastTree.map((e) => e.path).sort(), FILES.slice().sort());
  const row = db._db.prepare("SELECT v FROM live_catalog WHERE k = 'state'").get();
  const state = JSON.parse(row.v);
  assert.equal(state.sha, sha('e'));
  assert.equal(JSON.parse(state.validation).releaseSha, sha('e'));
  assert.equal(state.files['category-products.js'], '// new category-products.js');
  assert.equal(state.index['NEW-1'], 'abaya');
});

test('a retry of the same request returns the first result without a second commit; a changed body is refused', async () => {
  const { handleCatalogSave } = await lib('api/catalog-save.js');
  const p = body(); const db = fakeD1();
  const env = { STOCK_DB: db, GOOGLE_SA_JSON: 'x', GITHUB_TOKEN: 'gh-token' };
  const deps = Object.assign({ fetch: p._gh.fetchImpl }, owner);
  const first = await (await handleCatalogSave(req(p), env, deps)).json();
  const writes = () => p._gh.calls.filter((c) => !c.startsWith('GET ')).length;
  const before = writes();
  const again = await (await handleCatalogSave(req(p), env, deps)).json();
  assert.deepEqual(again, first);
  // GitHub is read in parallel with the owner check, but a retry never writes a second commit.
  assert.equal(writes(), before);
  const changed = Object.assign({}, p, { files: p.files.map((f) => ({ path: f.path, content: f.content + ' changed' })) });
  const r = await handleCatalogSave(req(changed), env, deps);
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error, 'REQUEST_CHANGED');
});

test('catalog changed elsewhere since the panel loaded it: CATALOG_CONFLICT, nothing committed or made live', async () => {
  const { handleCatalogSave } = await lib('api/catalog-save.js');
  const p = body(); const db = fakeD1();
  p.baseShas['category-products.js'] = sha('7');
  const r = await handleCatalogSave(req(p), { STOCK_DB: db, GOOGLE_SA_JSON: 'x', GITHUB_TOKEN: 'gh-token' }, Object.assign({ fetch: p._gh.fetchImpl }, owner));
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error, 'CATALOG_CONFLICT');
  assert.ok(!p._gh.calls.some((c) => c.startsWith('POST') || c.startsWith('PATCH')));
  assert.throws(() => db._db.prepare("SELECT v FROM live_catalog WHERE k = 'state'").get());
});

test('another save moved main between our read and our update: GitHub refuses the fast-forward, reported as a conflict', async () => {
  const { handleCatalogSave } = await lib('api/catalog-save.js');
  const p = body(); const gh = fakeGitHub({ raceOnPatch: true });
  const r = await handleCatalogSave(req(p), { STOCK_DB: fakeD1(), GOOGLE_SA_JSON: 'x', GITHUB_TOKEN: 'gh-token' }, Object.assign({ fetch: gh.fetchImpl }, owner));
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error, 'CATALOG_CONFLICT');
});

test('refuses staff, other sites, missing files, stale base and photo bytes', async () => {
  const { handleCatalogSave } = await lib('api/catalog-save.js');
  const env = { STOCK_DB: fakeD1(), GOOGLE_SA_JSON: 'x', GITHUB_TOKEN: 'gh-token' };
  const deps = Object.assign({ fetch: async () => assert.fail('must not reach GitHub') }, owner);
  assert.equal((await handleCatalogSave(req(body({ Token: 'tok-staff' })), env, deps)).status, 403);
  assert.equal((await handleCatalogSave(req(body(), { Origin: 'https://evil.example' }), env, deps)).status, 403);
  const three = body(); three.files = three.files.slice(0, 3);
  assert.equal((await (await handleCatalogSave(req(three), env, deps)).json()).error, 'CATALOG_FILES_REQUIRED');
  const stale = body(); stale.baseShas = {};
  assert.equal((await (await handleCatalogSave(req(stale), env, deps)).json()).error, 'CATALOG_REFRESH_REQUIRED');
  const photo = body({ assets: [{ path: 'images/uploads/a.webp', content: 'AAAA' }] });
  assert.equal((await (await handleCatalogSave(req(photo), env, deps)).json()).error, 'R2_REQUIRED');
});

test('an unknown login never writes to GitHub, even though the reads start alongside the owner check', async () => {
  const { handleCatalogSave } = await lib('api/catalog-save.js');
  const p = body({ Token: 'tok-stranger' });
  const r = await handleCatalogSave(req(p), { STOCK_DB: fakeD1(), GOOGLE_SA_JSON: 'x', GITHUB_TOKEN: 'gh-token' }, Object.assign({ fetch: p._gh.fetchImpl }, owner));
  assert.equal(r.status, 403);
  await new Promise((res) => setTimeout(res, 20));
  assert.equal(p._gh.calls.filter((c) => !c.startsWith('GET ')).length, 0);
});

test('/api/catalog-state: owner gets head + catalog SHAs from GitHub; others get nothing', async () => {
  const { handleCatalogState } = await lib('api/catalog-state.js');
  const gh = fakeGitHub();
  const env = { GOOGLE_SA_JSON: 'x', GITHUB_TOKEN: 'gh-token' };
  const mk = (t) => new Request('https://muslimabaya.com/api/catalog-state', { method: 'POST', headers: { Origin: 'https://muslimabaya.com' }, body: JSON.stringify({ Token: t }) });
  const r = await (await handleCatalogState(mk('tok-owner'), env, Object.assign({ fetch: gh.fetchImpl }, owner))).json();
  assert.equal(r.ok, true);
  assert.equal(r.version, 1);
  assert.equal(r.head, gh.state.head);
  assert.deepEqual(r.shas, gh.state.files);
  const bad = await handleCatalogState(mk('tok-stranger'), env, Object.assign({ fetch: gh.fetchImpl }, owner));
  assert.equal(bad.status, 403);
  assert.equal((await bad.json()).head, undefined);
  const off = await handleCatalogState(mk('tok-owner'), { GOOGLE_SA_JSON: 'x' }, owner);
  assert.equal((await off.json()).error, 'NOT_CONFIGURED');
});

test('owner check is shared between Worker instances for 3 minutes (Cache API); failures are never stored', async () => {
  const { isOwnerCached, _resetOwnerCache } = await lib('_lib/owner-auth.js');
  const store = new Map();
  globalThis.caches = { default: {
    match: async (req) => (store.has(req.url) ? new Response(store.get(req.url)) : undefined),
    put: async (req, res) => { store.set(req.url, await res.text()); },
  } };
  try {
    let reads = 0;
    const check = async () => { reads++; return ''; };
    assert.equal(await isOwnerCached('tok-a', NOW, check), '');
    _resetOwnerCache(); // a different Worker instance: no in-memory copy
    assert.equal(await isOwnerCached('tok-a', NOW, check), '');
    assert.equal(reads, 1, 'second instance used the shared result');
    assert.ok([...store.keys()].every((k) => !k.includes('tok-a')), 'the token itself is never a cache key');
    let bad = 0;
    const deny = async () => { bad++; return 'NOT_LOGGED_IN'; };
    assert.equal(await isOwnerCached('tok-b', NOW, deny), 'NOT_LOGGED_IN');
    _resetOwnerCache();
    assert.equal(await isOwnerCached('tok-b', NOW, deny), 'NOT_LOGGED_IN');
    assert.equal(bad, 2, 'a failed check is asked again');
  } finally { delete globalThis.caches; }
});
