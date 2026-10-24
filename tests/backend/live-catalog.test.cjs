// Instant live catalog: an owner save is served to visitors at once from D1, and the site falls back to
// the deployed files as soon as the deploy that contains the save is live (or whenever anything fails).
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '../..');
const lib = (f) => import(path.join(root, 'functions', f));
const NOW = Date.UTC(2026, 9, 21, 6, 0, 0);
const SHA = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(20, 7)]);

/** Minimal D1 stand-in on node:sqlite (prepare/bind/first/run/batch). */
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

function memCache() {
  const m = new Map();
  return { match: async (r) => { const v = m.get(r.url); return v ? new Response(v) : undefined; }, put: async (r, res) => { m.set(r.url, await res.text()); }, _m: m };
}

function assetsFor(files, deployed) {
  return {
    fetch: async (req) => {
      const p = new URL(req.url).pathname.replace(/^\//, '');
      if (p === 'live-build.json') return new Response(JSON.stringify(deployed));
      if (p === 'abaya') return new Response('<html lang="en"><head><title>Abaya</title><link rel="canonical" href="x"></head><body data-shop-category="abaya"><script src="config.js"></script><div id="list"></div></body></html>');
      if (files[p] != null) return new Response(files[p], { headers: { 'Cache-Control': 'public, max-age=300', ETag: '"static"' } });
      return new Response('<html>home</html>');
    },
  };
}

const STATIC = {
  'category-products.js': 'window.CATEGORY_PRODUCTS = {abaya: [{id: "OLD-1", name: "Old", image: "/images/old.webp"}]};',
  'product-links-data.js': 'window.PRODUCT_LINKS_DATA = {};',
  'product-catalog-sections.js': 'window.CATALOG_SECTIONS = [];',
  'product-config.js': 'window.SITE_LINKS = {};',
  'catalog-validation.json': '{"version":1,"releaseSha":"' + OLD + '"}',
};
const SAVED = Object.assign({}, STATIC, {
  'category-products.js': 'window.CATEGORY_PRODUCTS = {abaya: [{id: "OLD-1", name: "Old", price: 1200, image: "/images/old.webp"}, {id: "NEW-1", name: "New", image: "images/uploads/new-1.webp"}]};',
});

async function signedEnv(db) {
  const { _resetTokenCache } = await lib('_lib/google-auth.js');
  const { _resetMetaCache } = await lib('_lib/sheet-snapshot.js');
  _resetTokenCache(); _resetMetaCache();
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = JSON.stringify({ client_email: 'reader@proj.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const serial = (d) => (d.getTime() + 6 * 3600000 - Date.UTC(1899, 11, 30)) / 86400000;
  const fmt = (n) => { const d = new Date(Math.round(n * 86400000) + Date.UTC(1899, 11, 30)); const p = (x) => String(x).padStart(2, '0'); return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`; };
  const DATE_COLS = { Sessions: [4, 5], Admins: [6] };
  const sheets = {
    Sessions: [['Token', 'Email', 'Phone', 'Name', 'CreatedAt', 'ExpiresAt', 'Role'],
      ['tok-owner', 'owner@example.com', '01700000000', 'Owner', serial(new Date(NOW - 3600000)), serial(new Date(Date.UTC(2100, 0, 1))), 'admin'],
      ['tok-staff', 'staff@example.com', '01800000000', 'Staff', serial(new Date(NOW - 3600000)), serial(new Date(Date.UTC(2100, 0, 1))), 'staff']],
    Admins: [['Email', 'Phone', 'Name', 'PasswordHash', 'Salt', 'Status', 'CreatedAt', 'Role', 'UpdatedAt'],
      ['owner@example.com', '01700000000', 'Owner', 'h', 's', 'active', serial(new Date(NOW - 9e9)), 'admin'],
      ['staff@example.com', '01800000000', 'Staff', 'h', 's', 'active', serial(new Date(NOW - 9e9)), 'staff']],
  };
  const fakeFetch = async (url) => {
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) return ok({ access_token: 'AT', expires_in: 3600 });
    if (/values:batchGet/.test(url)) {
      const asked = new URL(url).searchParams.getAll('ranges').map((r) => r.replace(/^'|'$/g, ''));
      const formatted = /FORMATTED_VALUE/.test(url) && !/UNFORMATTED/.test(url);
      return ok({ valueRanges: asked.map((n) => ({ values: sheets[n].map((row, r) => row.map((v, c) => (r && formatted && DATE_COLS[n].includes(c) ? fmt(v) : formatted ? String(v) : v))) })) });
    }
    return ok({ spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/S/edit', properties: { timeZone: 'Asia/Dhaka' },
      sheets: Object.keys(sheets).map((n, i) => ({ properties: { title: n, sheetId: i + 1, gridProperties: { rowCount: 100, columnCount: 20 } } })) });
  };
  return { env: { GOOGLE_SA_JSON: sa, SHEET_ID: 'S', STOCK_DB: db }, fakeFetch };
}

function payload(token, over = {}) {
  return Object.assign({
    Token: token, sha: SHA,
    files: { 'category-products.js': SAVED['category-products.js'], 'product-links-data.js': SAVED['product-links-data.js'], 'product-catalog-sections.js': SAVED['product-catalog-sections.js'], 'product-config.js': SAVED['product-config.js'] },
    validation: JSON.stringify({ version: 1, releaseSha: SHA, sources: [], sourceSha256: 'c'.repeat(64), products: [{ id: 'NEW-1' }] }),
    index: { 'OLD-1': 'abaya', 'NEW-1': 'abaya' }, names: { 'NEW-1': 'New' },
    assets: [{ path: 'images/uploads/new-1.webp', content: WEBP.toString('base64') }],
  }, over);
}

test('pending rule: a save shows until a deploy that contains it (or anything newer) is live', async () => {
  const { isPending } = await lib('_lib/live-catalog.js');
  const state = { sha: SHA, savedAt: NOW, files: {} };
  assert.equal(isPending(state, { sha: OLD, commitTime: NOW / 1000 - 60, history: [OLD] }), true);
  assert.equal(isPending(state, { sha: SHA, commitTime: NOW / 1000 - 1, history: [SHA] }), false, 'its own deploy');
  assert.equal(isPending(state, { sha: 'd'.repeat(40), commitTime: NOW / 1000 - 1, history: ['d'.repeat(40), SHA] }), false, 'a later commit on top of it');
  assert.equal(isPending(state, { sha: 'e'.repeat(40), commitTime: NOW / 1000 + 30, history: [] }), false, 'a newer commit (history unknown)');
  assert.equal(isPending(null, { sha: OLD }), false);
  assert.equal(isPending({ sha: 'bad', files: {} }, { sha: OLD }), false);
});

test('owner save goes live at once; photos, verbatim copies, new product page, then back to static', async () => {
  const { handleLivePublish } = await lib('api/live-publish.js');
  const live = await lib('_lib/live-catalog.js');
  const db = fakeD1();
  const { env, fakeFetch } = await signedEnv(db);
  const cache = memCache();
  const post = (body, headers = {}) => new Request('https://muslimabaya.com/api/live-publish', { method: 'POST', body: JSON.stringify(body), headers });

  // Staff, bad token and foreign origin are refused; nothing is stored.
  assert.equal((await handleLivePublish(post(payload('tok-staff')), env, { fetch: fakeFetch, now: () => NOW, cache })).status, 403);
  assert.equal((await handleLivePublish(post(payload('nope')), env, { fetch: fakeFetch, now: () => NOW, cache })).status, 401);
  assert.equal((await handleLivePublish(post(payload('tok-owner'), { Origin: 'https://evil.example' }), env, { fetch: fakeFetch, now: () => NOW, cache })).status, 403);
  assert.equal((await handleLivePublish(post(payload('tok-owner', { sha: 'x' })), env, { fetch: fakeFetch, now: () => NOW, cache })).status, 400);
  assert.equal((await handleLivePublish(post(payload('tok-owner', { assets: [{ path: '../x.webp', content: 'QQ==' }] })), env, { fetch: fakeFetch, now: () => NOW, cache })).status, 400);

  const res = await handleLivePublish(post(payload('tok-owner')), env, { fetch: fakeFetch, now: () => NOW, cache });
  const body = await res.json();
  assert.equal(res.status, 200, JSON.stringify(body));
  assert.deepEqual([body.ok, body.photos], [true, 1]);

  live._resetDeployedMemo();
  env.ASSETS = assetsFor(STATIC, { sha: OLD, commitTime: NOW / 1000 - 600, history: [OLD] });
  const get = (p, headers = {}) => new Request('https://muslimabaya.com/' + p, { headers });
  const deps = { cache };

  const site = await live.serveLiveFile(get('category-products.js?v=123'), env, 'category-products.js', deps);
  const text = await site.text();
  assert.equal(site.headers.get('X-MA-Live'), '1');
  assert.match(text, /price: 1200/, 'the saved price is served before the deploy');
  assert.match(text, /"\/api\/live-img\/images\/uploads\/new-1\.webp"/, 'new photo points at its live copy');
  assert.equal(site.headers.get('Cache-Control'), 'no-store');
  const again = await live.serveLiveFile(get('category-products.js?v=123', { 'If-None-Match': site.headers.get('ETag') }), env, 'category-products.js', deps);
  assert.equal(again.status, 304);

  const verbatim = await (await live.serveLiveFile(get('category-products.js?catalog_check=1'), env, 'category-products.js', deps)).text();
  assert.equal(verbatim, SAVED['category-products.js'], 'order price check and admin get the exact committed text');
  const validation = JSON.parse(await (await live.serveLiveFile(get('catalog-validation.json'), env, 'catalog-validation.json', deps)).text());
  assert.equal(validation.releaseSha, SHA);

  const row = db._db.prepare('SELECT ctype, length(data) AS n FROM live_assets WHERE path = ?').get('images/uploads/new-1.webp');
  assert.deepEqual([row.ctype, row.n], ['image/webp', WEBP.length]);

  const next = () => env.ASSETS.fetch(new Request('https://muslimabaya.com/product/NEW-1'));
  const page = await live.serveProductPage(get('product/NEW-1'), env, 'NEW-1', next);
  const html = await page.text();
  assert.match(html, /data-product-id="NEW-1"/);
  assert.match(html, /<title>New \| Muslim Abaya Bangladesh<\/title>/);
  assert.match(html, /src="\/config\.js"/);

  // The deploy containing the save is live: static files again, with no long browser cache.
  live._resetDeployedMemo();
  env.ASSETS = assetsFor(SAVED, { sha: SHA, commitTime: NOW / 1000 - 5, history: [SHA, OLD] });
  const after = await live.serveLiveFile(get('category-products.js?v=124'), env, 'category-products.js', deps);
  assert.equal(after.headers.get('X-MA-Live'), null);
  assert.equal(after.headers.get('Cache-Control'), 'no-cache');
  assert.equal(await after.text(), SAVED['category-products.js']);
});

test('no D1 / broken D1 / nothing saved: the site behaves exactly as before', async () => {
  const live = await lib('_lib/live-catalog.js');
  live._resetDeployedMemo();
  const get = (p) => new Request('https://muslimabaya.com/' + p);
  const ASSETS = assetsFor(STATIC, { sha: OLD, commitTime: 1, history: [OLD] });
  for (const env of [{ ASSETS }, { ASSETS, STOCK_DB: { prepare() { throw new Error('down'); } } }, { ASSETS, STOCK_DB: fakeD1() }]) {
    const res = await live.serveLiveFile(get('category-products.js'), env, 'category-products.js', { cache: null });
    assert.equal(await res.text(), STATIC['category-products.js']);
    assert.equal(res.headers.get('X-MA-Live'), null);
  }
});
