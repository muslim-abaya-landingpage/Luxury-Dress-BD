// Size Manager (Stage 4): the published size configuration reaches the shop inside product-config.js (no extra
// request), only while something is switched on; the shop helper resolves fields like the order check does;
// cart lines keep the measurement choices. Runs on node:sqlite as a D1 stand-in.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '../..');
const lib = (f) => import(path.join(root, 'functions', f));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const NOW = Date.UTC(2026, 9, 30, 8, 0, 0);
const CONFIG_JS = 'window.SITE_LINKS = {};';

function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => { const r = db.prepare(sql).get(...args); return r ? Object.assign({}, r) : null; },
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => Object.assign({}, r)) }),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    _run() { db.prepare(sql).run(...args); },
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => {
      db.exec('BEGIN');
      try { list.forEach((s) => s._run()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      return [];
    },
    _db: db,
  };
}
const seeded = () => {
  const d1 = fakeD1();
  ['0001_size_manager.sql', '0002_size_manager_seed.sql'].forEach((f) => d1._db.exec(read('migrations/d1/' + f)));
  return d1;
};

function env(db) {
  return {
    STOCK_DB: db,
    ASSETS: {
      fetch: async (req) => {
        const p = new URL(req.url).pathname.replace(/^\//, '');
        if (p === 'live-build.json') return new Response('{}');
        if (p === 'product-config.js') {
          if (req.headers.get('If-None-Match') === '"static"') return new Response(null, { status: 304, headers: { ETag: '"static"' } });
          return new Response(CONFIG_JS, { headers: { ETag: '"static"' } });
        }
        return new Response('window.X = 1;', { headers: { ETag: '"other"' } });
      },
    },
  };
}
const noCache = { cache: null };
const get = (url, headers) => new Request('https://muslimabaya.com/' + url, { headers: headers || {} });

async function switchOn(db, category) {
  const store = await lib('_lib/size-store.js');
  await store.saveCategory(db, { category_key: category, template_id: category, enabled: true }, { now: NOW, actor: 'owner@test' });
  await store.publish(db, { now: NOW + 1, actor: 'owner@test', note: 'on' });
}

function runPage(config, files) {
  const ctx = { window: {}, console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  ['product-config.js', 'product-utils.js', 'size-core.js', 'size-storefront.js'].concat(files || []).forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  // vm contexts run size-core / size-storefront against `this` (the context), the browser against window.
  ['maSizeCore', 'maSizeStore'].forEach((k) => { if (!ctx.window[k] && ctx[k]) ctx.window[k] = ctx[k]; });
  ctx.window.MA_SIZE_CONFIG = config;
  ctx.MA_SIZE_CONFIG = config;
  ctx.getSizeLegacySlots = ctx.window.getSizeLegacySlots;
  return ctx;
}

test('nothing switched on: product-config.js is served exactly as before (same body, ETag and 304)', async () => {
  const { serveLiveFile } = await lib('_lib/live-catalog.js');
  const db = seeded();
  const res = await serveLiveFile(get('product-config.js?v=1'), env(db), 'product-config.js', noCache);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), CONFIG_JS);
  assert.equal(res.headers.get('ETag'), '"static"');
  assert.equal(res.headers.get('X-MA-Size'), null);
  const again = await serveLiveFile(get('product-config.js?v=1', { 'If-None-Match': '"static"' }), env(db), 'product-config.js', noCache);
  assert.equal(again.status, 304);
  // No tables, no D1: unchanged too.
  const bare = await serveLiveFile(get('product-config.js'), env(fakeD1()), 'product-config.js', noCache);
  assert.equal(await bare.text(), CONFIG_JS);
  const none = await serveLiveFile(get('product-config.js'), { ASSETS: env(db).ASSETS }, 'product-config.js', noCache);
  assert.equal(await none.text(), CONFIG_JS);
});

test('a category switched on: the published config rides along with product-config.js only', async () => {
  const { serveLiveFile } = await lib('_lib/live-catalog.js');
  const db = seeded();
  await switchOn(db, 'abaya');
  const res = await serveLiveFile(get('product-config.js?v=1'), env(db), 'product-config.js', noCache);
  const body = await res.text();
  assert.ok(body.startsWith(CONFIG_JS));
  assert.equal(res.headers.get('X-MA-Size'), '2');
  assert.match(res.headers.get('Cache-Control'), /no-cache/);
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(body, ctx);
  const cfg = ctx.window.MA_SIZE_CONFIG;
  assert.equal(cfg.version, 2);
  assert.equal(cfg.categories.abaya.enabled, true);
  assert.deepEqual(Object.keys(cfg.templates), ['abaya'], 'only templates something switched on can reach');
  assert.ok(!('kaftan' in cfg.categories) && !('karchupi' in cfg.categories));
  // Its own ETag; a matching revalidation is a 304.
  const etag = res.headers.get('ETag');
  assert.match(etag, /^"sz-[0-9a-f]+"$/);
  const again = await serveLiveFile(get('product-config.js?v=1', { 'If-None-Match': etag }), env(db), 'product-config.js', noCache);
  assert.equal(again.status, 304);
  const stale = await serveLiveFile(get('product-config.js?v=1', { 'If-None-Match': '"static"' }), env(db), 'product-config.js', noCache);
  assert.equal(stale.status, 200, 'a copy cached before the switch-on is replaced');
  assert.match(await stale.text(), /MA_SIZE_CONFIG/);
  // Verbatim reads (order check hash, admin publisher) and the other catalog files never carry it.
  for (const q of ['catalog_check=1', 'live=1', 'catalog=abc', 'publish=1']) {
    const v = await serveLiveFile(get('product-config.js?' + q), env(db), 'product-config.js', noCache);
    assert.equal(await v.text(), CONFIG_JS, q);
  }
  const other = await serveLiveFile(get('category-products.js'), env(db), 'category-products.js', noCache);
  assert.equal(await other.text(), 'window.X = 1;');
  // Markup in labels can never close the script.
  const { sizeConfigScript } = await lib('_lib/size-carrier.js');
  assert.ok(!sizeConfigScript({ a: '</script><script>alert(1)</script>' }).includes('</script'));
});

test('the attached config is cached per edge location and pruned to what is switched on', async () => {
  const { loadStorefrontSizeConfig, storefrontConfig } = await lib('_lib/size-carrier.js');
  const db = seeded();
  await switchOn(db, 'panjabi');
  const m = new Map();
  const cache = { match: async (r) => (m.has(r.url) ? new Response(m.get(r.url)) : undefined), put: async (r, res) => { m.set(r.url, await res.text()); } };
  const first = await loadStorefrontSizeConfig({ STOCK_DB: db }, 'https://muslimabaya.com', { cache });
  assert.deepEqual(Object.keys(first.templates), ['panjabi']);
  const second = await loadStorefrontSizeConfig({ STOCK_DB: { prepare() { throw new Error('should be cached'); } } }, 'https://muslimabaya.com', { cache });
  assert.deepEqual(second, first);
  // A product switched on inside a category that is off brings its category templates along.
  const cfg = { version: 3, categories: { abaya: { template: 'abaya', enabled: false }, hijab: { template: 'hijab', enabled: false } },
    templates: { abaya: { id: 'abaya', fields: [] }, hijab: { id: 'hijab', fields: [] }, extra: { id: 'extra', fields: [] } },
    products: { 'P-1': { enabled: true } } };
  assert.deepEqual(Object.keys(storefrontConfig(cfg).templates).sort(), ['abaya', 'hijab']);
  assert.equal(storefrontConfig(Object.assign({}, cfg, { products: {} })), null);
});

test('shop helper: same fields as the order check; old pickers when off, for Kaftan/Karchupi, and with per-size stock', async () => {
  const { storefrontConfig } = await lib('_lib/size-carrier.js');
  const store = await lib('_lib/size-store.js');
  const db = seeded();
  for (const c of ['abaya', 'cover-up', 'premium-two-piece', 'tops-kurti', 'embroidery', 'hijab', 'panjabi', 'three-piece-dress']) {
    await store.saveCategory(db, { category_key: c, template_id: c, enabled: true }, { now: NOW, actor: 'owner@test' });
  }
  await store.publish(db, { now: NOW + 1, actor: 'owner@test' });
  const published = (await store.readActive(db)).config;
  const cfg = storefrontConfig(published);
  const page = runPage(cfg, ['category-products.js', 'product-links-data.js', 'product-catalog-sync.js']);
  const w = page.window;
  const catalog = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, w.PRODUCT_LINKS_DATA || {}, { includeUnpublished: true });
  // Order check side: SizeCore.gs with the catalog-validation sizeLegacy data.
  const gs = {};
  vm.createContext(gs);
  vm.runInContext(read('apps-script/SizeCore.gs'), gs);
  const validation = JSON.parse(read('catalog-validation.json'));
  const byId = new Map(validation.products.map((p) => [p.id, p]));
  let compared = 0;
  Object.keys(catalog).forEach((category) => catalog[category].forEach((p) => {
    if (!byId.has(p.id)) return;
    const v = byId.get(p.id);
    const shop = w.maSizeStore.resolveFor(Object.assign({}, p, { stockVariants: null }), category);
    const server = gs.maSizeCore.resolve(published, { id: v.id, category: v.category, sizeLegacy: v.sizeLegacy || {} });
    assert.deepEqual(JSON.parse(JSON.stringify(shop)), JSON.parse(JSON.stringify(server)), p.id);
    if (category === 'kaftan' || category === 'karchupi') assert.equal(shop, null, p.id);
    compared++;
  }));
  assert.ok(compared > 20, 'compared ' + compared + ' products');
  const abaya = catalog.abaya[0];
  assert.ok(w.maSizeStore.resolveFor(abaya, 'abaya'));
  // Per-size stock rows are keyed by the old size text: keep the old pickers. A whole-product pool is fine.
  assert.equal(w.maSizeStore.resolveFor(Object.assign({}, abaya, { stockVariants: { 'Body 46 · Length 54': { tracked: true, available: 2 } } }), 'abaya'), null);
  assert.ok(w.maSizeStore.resolveFor(Object.assign({}, abaya, { stockVariants: { _default: { tracked: true, available: 5 } } }), 'abaya'));
  // No published config on the page: old pickers.
  w.MA_SIZE_CONFIG = undefined;
  page.MA_SIZE_CONFIG = undefined;
  assert.equal(w.maSizeStore.resolveFor(abaya, 'abaya'), null);
});

test('cart keeps cleaned measurement choices; checkout sends key/value; old lines are unchanged', () => {
  const html = read('checkout.html');
  assert.match(html, /measurements: Array\.isArray\(item\.measurements\)/);
  const store = {};
  const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const ctx = { window: {}, localStorage: ls, sessionStorage: ls, console, setTimeout: () => 0, clearTimeout() {}, addEventListener() {}, dispatchEvent() {},
    location: { href: 'https://muslimabaya.com/', pathname: '/', search: '' },
    document: { addEventListener() {}, readyState: 'complete', querySelector: () => null, querySelectorAll: () => [], getElementById: () => null }, CustomEvent: function () {} };
  ctx.window = Object.assign(ctx, { window: ctx });
  vm.createContext(ctx);
  vm.runInContext(read('cart-utils.js'), ctx);
  const add = ctx.addOrMergeStoreCartItem;
  const base = { id: 'X-1', name: 'Test', price: 1000, quantity: 1, category: 'abaya' };
  const withM = add([], Object.assign({}, base, { size: 'Body 46 · Length 54', measurements: [
    { key: 'body', label: 'Body', value: '46', custom: false },
    { key: 'BAD KEY', value: '1' },
    { key: 'length', label: 'Length', value: ' 54 ', custom: false, extra: 'dropped' }] }));
  assert.deepEqual(JSON.parse(JSON.stringify(withM[0].measurements)), [
    { key: 'body', label: 'Body', value: '46', custom: false }, { key: 'length', label: 'Length', value: '54', custom: false }]);
  const old = add([], Object.assign({}, base, { size: 'Body 46 · Length 54' }));
  assert.equal('measurements' in old[0], false);
});
