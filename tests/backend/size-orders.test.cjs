// Size Manager (Stage 5): cart, checkout and order. Per-size stock rows keep matching, the order check rides
// out a short outage of the size API, and the shop's quick-add paths send products with fields to their page.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));
const catalog = JSON.parse(read('catalog-validation.json'));

async function templates() {
  const { DEFAULT_TEMPLATES } = await import(path.join(root, 'functions/_lib/size-defaults.js'));
  const out = {};
  DEFAULT_TEMPLATES.forEach((t) => { out[t.id] = t; });
  return out;
}

function shop(config) {
  const ctx = { window: {}, console };
  ctx.window.window = ctx.window;
  vm.createContext(ctx);
  ['product-config.js', 'product-utils.js', 'size-core.js', 'size-storefront.js'].forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
  ctx.window.MA_SIZE_CONFIG = config;
  return ctx.window;
}

test('per-size stock: the new fields are used only when every tracked row is a size text they produce', async () => {
  const cfg = { version: 3, categories: { abaya: { template: 'abaya', enabled: true }, 'tops-kurti': { template: 'tops-kurti', enabled: true } }, templates: await templates(), products: {} };
  const s = shop(cfg).maSizeStore;
  const abaya = { id: 'ABY-T', category: 'abaya', bodySizes: ['42', '44', '46'], lengthSizes: ['50', '52'] };
  // Abaya rows use the old text, which is exactly what the fields produce → fields shown.
  const rows = { 'Body 46 · Length 52': { tracked: true, available: 2 }, 'body 42 ·  length 50': { tracked: true, available: 1 }, _default: { tracked: true, available: 9 } };
  const r = s.resolveFor(Object.assign({}, abaya, { stockVariants: rows }), 'abaya');
  assert.ok(r);
  assert.equal(s.sizeTexts(r, 400).length, 6);
  // A row the fields can never produce → old pickers, so its stock still matches.
  assert.equal(s.resolveFor(Object.assign({}, abaya, { stockVariants: { 'Free Size': { tracked: true, available: 2 } } }), 'abaya'), null);
  // Untracked rows do not matter.
  assert.ok(s.resolveFor(Object.assign({}, abaya, { stockVariants: { 'Free Size': { tracked: false } } }), 'abaya'));
  // A required typed field cannot be listed → per-size stock keeps the old pickers.
  cfg.products['KURTI-X'] = { enabled: true, template: 'chest', useTemplate: true };
  cfg.templates.chest = { id: 'chest', fields: [{ key: 'chest', label_en: 'Chest', required: true, enabled: true, allowCustom: true, options: [] }] };
  const kurti = { id: 'KURTI-X', category: 'tops-kurti', sizes: ['38'] };
  assert.ok(s.resolveFor(kurti, 'tops-kurti'));
  assert.equal(s.resolveFor(Object.assign({}, kurti, { stockVariants: { 'Chest 38': { tracked: true, available: 1 } } }), 'tops-kurti'), null);
});

test('order check: the size text it rebuilds for an abaya is the stock row key', async () => {
  const tpl = await templates();
  const config = { version: 4, categories: { abaya: { template: 'abaya', enabled: true } }, templates: tpl, products: {} };
  const c = { console, Date, JSON, Number, String, Math, Array, Object, Error, isFinite,
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ ok: true, version: 4, config }) }) } };
  vm.createContext(c);
  vm.runInContext(read('apps-script/SizeCore.gs'), c);
  vm.runInContext(read('apps-script/Operations.gs'), c);
  const p = plain(catalog.products.find((x) => x.id === 'ABY-MAROON-1'));
  const it = { id: p.id, qty: 1, price: 1, size: 'whatever', productType: Object.keys(p.prices || {})[0] || '',
    measurements: [{ key: 'body', value: '46' }, { key: 'length', value: '54' }] };
  c.opsLinePrice_(it, p);
  assert.equal(it.size, 'Body 46 · Length 54');
  // Same text the old pickers wrote, so an existing stock row "Body 46 · Length 54" is found.
  const shopSide = shop(config).maSizeCore.validate(shop(config).maSizeStore.resolveFor(Object.assign({}, p, { bodySizes: p.sizeLegacy.body, lengthSizes: p.sizeLegacy.length }), 'abaya'), { body: '46', length: '54' });
  assert.equal(shopSide.size, it.size);
});

test('order check rides out a short outage of the size API with the last copy (6 h), then fails safely', () => {
  const store = {};
  let status = 200;
  const config = { version: 9, categories: {}, templates: {}, products: {} };
  const c = { console, Date, JSON, Number, String, Math, Array, Object, Error, isFinite,
    CacheService: { getScriptCache: () => ({ get: (k) => (k in store ? store[k].v : null), put: (k, v, ttl) => { store[k] = { v, ttl }; } }) },
    UrlFetchApp: { fetch: () => { if (status === 0) throw new Error('DNS'); return { getResponseCode: () => status, getContentText: () => JSON.stringify({ ok: true, version: 9, config }) }; } } };
  vm.createContext(c);
  vm.runInContext(read('apps-script/SizeCore.gs'), c);
  vm.runInContext(read('apps-script/Operations.gs'), c);
  assert.equal(c.opsSizeConfig_().version, 9);
  assert.equal(store.ops_size_config_v1.ttl, 60);
  assert.equal(store.ops_size_config_last.ttl, 21600);
  delete store.ops_size_config_v1; // the short copy expired
  status = 500;
  assert.equal(c.opsSizeConfig_().version, 9);
  status = 0;
  assert.equal(c.opsSizeConfig_().version, 9);
  delete store.ops_size_config_last;
  assert.throws(() => c.opsSizeConfig_(), /SIZE_CONFIG_UNAVAILABLE/);
});

test('quick-add paths send products with fields to their page; checkout can change measurements', () => {
  for (const [file, re] of [
    ['index-home-muslim-abaya.js', /maSizeStore\.resolveFor\(p, sec\.key\)[\s\S]{0,120}\/product\//],
    ['cart-drawer.js', /maSizeStore\.resolveFor\(product, categoryKey\)[\s\S]{0,120}\/product\//],
    ['category-renderer.js', /function pqvHomeAddToCart[\s\S]{0,260}shopSizeTemplate\(p, sec\.key\)/],
    ['checkout.html', /maSizeStore\.resolveFor\(p\.product, p\.category\)/],
    ['checkout.html', /data-cart-action="measure"/],
  ]) assert.match(read(file), re, file);
  // The homepage bundle is rebuilt from its sources; the homepage loads the size scripts.
  const bundle = read('home-render.min.js');
  assert.match(bundle, /maSizeStore/);
  assert.match(read('index.html'), /home-catalog-utils\.min\.js[^\n]*\n<script defer src="size-core\.js"><\/script>\n<script defer src="size-storefront\.js">/);
});

test('security: "__proto__" is never a measurement key (store, shop and order check)', async () => {
  const store = await import(path.join(root, 'functions/_lib/size-store.js'));
  const tpl = (key) => ({ id: 'x-tpl', name_bn: '', name_en: 'X', fields: [{ key, label_bn: '', label_en: 'A', required: true, enabled: true, allowCustom: false, default: '', legacy: [], options: [{ value: '1', label_bn: '', label_en: '' }] }] });
  assert.throws(() => store.validateTemplate(tpl('__proto__')), /BAD_FIELD_KEY/);
  assert.doesNotThrow(() => store.validateTemplate(tpl('proto_ok')));
  const c = {};
  vm.createContext(c);
  vm.runInContext(read('apps-script/SizeCore.gs'), c);
  const resolved = { templateId: 't', version: 1, fields: [{ key: 'body', label: 'Body', required: true, allowCustom: false, options: [{ value: '46', label: '46' }], default: '' }] };
  const r = c.maSizeCore.validate(resolved, JSON.parse('{"__proto__": "x", "body": "46"}'));
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.code === 'MALFORMED'));
  assert.ok(Array.isArray(r.measurements));
  const arr = c.maSizeCore.validate(resolved, [{ key: '__proto__', value: { polluted: true } }, { key: 'body', value: '46' }]);
  assert.equal(arr.ok, false);
  assert.equal(({}).polluted, undefined);
});
