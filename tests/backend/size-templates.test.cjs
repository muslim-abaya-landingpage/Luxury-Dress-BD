// Size Manager (Stage 2): category size templates in product-config.js, resolved by maSizeTemplates in
// product-utils.js and checked again on the server by opsTemplateSize_ in apps-script/Operations.gs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
// Values made inside the vm sandbox have other Array/Object prototypes; compare them as plain data.
const eq = (actual, expected, msg) => assert.deepEqual(plain(actual), plain(expected), msg);
const SOURCES = ['product-config.js', 'product-utils.js', 'category-products.js', 'product-links-data.js', 'product-catalog-sync.js'];

// The live catalog files, optionally with the size templates changed before the catalog code runs.
function load(editConfig) {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(read('product-config.js'), ctx);
  if (editConfig) editConfig(ctx.window.SITE_LINKS);
  SOURCES.slice(1).forEach((f) => vm.runInContext(read(f), ctx));
  vm.runInContext(read('catalog-validation-core.js'), ctx);
  return ctx.window;
}
const enableAll = (cfg) => Object.values(cfg.sizeTemplates.categories).forEach((c) => { c.enabled = true; });

function loadOps(catalogProducts) {
  const c = { console, Date, JSON, Number, String, Math, Array, Object, Error, isFinite };
  vm.createContext(c);
  vm.runInContext(read('apps-script/Operations.gs'), c);
  c.opsCatalog_ = () => ({ products: plain(catalogProducts) });
  c.validateCouponCode_ = () => ({ ok: false });
  return c;
}

test('all 8 categories have a template, every one switched off', () => {
  const w = load();
  const cfg = w.SITE_LINKS.sizeTemplates;
  const cats = ['abaya', 'cover-up', 'premium-two-piece', 'tops-kurti', 'embroidery', 'hijab', 'panjabi', 'three-piece-dress'];
  eq(Object.keys(cfg.categories).sort(), cats.slice().sort());
  cats.forEach((k) => {
    assert.equal(cfg.categories[k].enabled, false, k);
    assert.ok(cfg.templates[cfg.categories[k].template], k + ' template exists');
    cfg.templates[cfg.categories[k].template].fields.forEach((f) => assert.match(f.key, /^[a-z0-9_]{1,40}$/));
  });
  eq(cfg.templates.abaya.fields.map((f) => f.key), ['body', 'length'], 'Abaya has no top/bottom fields');
});

test('while templates are off, the order-check data is exactly what it was without them', () => {
  const withTemplates = load().__maBuildValidationProducts(load());
  const w = load((cfg) => { delete cfg.sizeTemplates; });
  eq(plain(withTemplates), plain(w.__maBuildValidationProducts(w)));
  assert.ok(!plain(withTemplates).some((p) => p.sizeFields), 'no product gets sizeFields while off');
});

test('switching a category on keeps every existing product\'s own sizes', () => {
  const w = load(enableAll);
  const catalog = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, w.PRODUCT_LINKS_DATA || {});
  let checked = 0;
  Object.keys(catalog).forEach((cat) => {
    if (!w.SITE_LINKS.sizeTemplates.categories[cat]) return; // Kaftan / Karchupi are not part of the Size Manager
    catalog[cat].forEach((p) => {
      const r = w.maSizeTemplates.resolve(p, cat);
      assert.ok(r, p.id + ' resolves');
      const byKey = Object.fromEntries(r.fields.map((f) => [f.key, f.options.map((o) => o.value)]));
      if (w.isAbayaProduct(p, cat)) {
        const c = w.getAbayaSizeConfig(p);
        eq(byKey.body, plain(c.bodySizes || [c.bodySizeLabel]), p.id + ' body');
        eq(byKey.length, plain(p.lengthSizes || p.sizes), p.id + ' length');
      } else if (w.isTwoPieceProduct(p, cat)) {
        const c = w.getTwoPieceSizeConfig(p);
        eq(byKey.top, plain(c.bodySizes && c.bodySizes.length ? c.bodySizes : p.sizes), p.id + ' top');
        eq(byKey.top_length, plain(c.dressLengths || [c.lengthSizeLabel]), p.id + ' length');
        eq(byKey.sleeve, c.sleeveSizes ? plain(c.sleeveSizes) : undefined, p.id + ' sleeve');
        eq(byKey.bottom, c.palazzoLengths ? plain(c.palazzoLengths) : undefined, p.id + ' bottom');
      } else {
        const first = r.fields[0];
        eq(first.options.map((o) => o.value), plain(p.sizes), p.id + ' size');
        assert.equal(r.fields.length, 1, p.id + ' gets no new fields');
      }
      checked++;
    });
  });
  assert.ok(checked >= 70, 'checked ' + checked + ' products');
});

test('new products (with sizeTemplate) get the template defaults and per-product overrides', () => {
  const w = load(enableAll);
  const tp = w.maSizeTemplates.resolve({ id: 'N1', sizeTemplate: {} }, 'three-piece-dress');
  eq(tp.fields.map((f) => f.key), ['top', 'top_length', 'bottom', 'dupatta']);
  eq(tp.fields[0].options.map((o) => o.value), ['36', '38', '40', '42', '44', '46']);
  assert.equal(tp.fields[3].required, false);
  assert.equal(tp.fields[3].allowCustom, true);

  const o = w.maSizeTemplates.resolve({ id: 'N2', sizeTemplate: { fields: {
    top: { label: 'Kameez', options: ['40', '42'] }, bottom: { enabled: false }, top_length: { required: false }
  } } }, 'three-piece-dress');
  eq(o.fields.map((f) => f.key), ['top', 'top_length', 'dupatta']);
  assert.equal(o.fields[0].label, 'Kameez');
  eq(o.fields[0].options.map((x) => x.value), ['40', '42']);
  assert.equal(o.fields[1].required, false);

  // A product can use another template (Embroidery using the Abaya one) or switch itself on/off.
  const e = w.maSizeTemplates.resolve({ id: 'N3', sizeTemplate: { template: 'abaya' } }, 'embroidery');
  assert.equal(e.templateId, 'abaya');
  const off = load();
  assert.equal(off.maSizeTemplates.resolve({ id: 'N4', sizeTemplate: {} }, 'hijab'), null, 'category off');
  assert.ok(off.maSizeTemplates.resolve({ id: 'N5', sizeTemplate: { enabled: true } }, 'hijab'), 'product switched on');
  const hijab = off.maSizeTemplates.resolve({ id: 'N5', sizeTemplate: { enabled: true } }, 'hijab');
  assert.equal(hijab.fields[0]['default'], 'Free Size');
});

test('validate: required, allowed values, custom values, unknown fields', () => {
  const w = load(enableAll);
  const st = w.maSizeTemplates;
  const r = st.resolve({ id: 'N1', sizeTemplate: {} }, 'three-piece-dress');
  const ok = st.validate(r, [{ key: 'top', value: '40' }, { key: 'top_length', value: '42' }, { key: 'bottom', value: '38' }]);
  assert.equal(ok.ok, true);
  assert.equal(ok.size, 'জামা 40 · Top Length 42 · পায়জামা / প্লাজু 38');
  assert.equal(st.variantKey(ok.measurements), 'top=40|top_length=42|bottom=38');

  const miss = st.validate(r, { top: '40', bottom: '38' });
  eq(plain(miss.errors), [{ key: 'top_length', code: 'REQUIRED' }]);
  eq(plain(st.validate(r, { top: '41', top_length: '42', bottom: '38' }).errors), [{ key: 'top', code: 'INVALID' }]);
  eq(plain(st.validate(r, { top: '40', top_length: '42', bottom: '38', color: 'red' }).errors), [{ key: 'color', code: 'UNKNOWN' }]);
  const custom = st.validate(r, { top: '40', top_length: '42', bottom: '38', dupatta: '2.5 গজ' });
  assert.equal(custom.ok, true);
  assert.equal(custom.measurements[3].custom, true);
  for (const bad of ['<script>', 'x'.repeat(41), 'a\\b']) {
    assert.equal(st.validate(r, { top: '40', top_length: '42', bottom: '38', dupatta: bad }).ok, false, bad);
  }
  // Renaming a label changes the text only, never the key.
  const renamed = st.resolve({ id: 'N2', sizeTemplate: { fields: { top: { label: 'Kameez' } } } }, 'three-piece-dress');
  const v = st.validate(renamed, { top: '40', top_length: '42', bottom: '38' });
  assert.equal(v.measurements[0].key, 'top');
  assert.equal(st.variantKey(v.measurements), 'top=40|top_length=42|bottom=38');
  // Panjabi shows its measurements in the option label.
  const pj = st.resolve({ id: 'N6', sizeTemplate: {} }, 'panjabi');
  assert.equal(st.validate(pj, { size: 'xl' }).size, 'Size XL (Length 44" • Body 46")');
});

test('server (Operations.gs) accepts and rejects the same choices as the browser', () => {
  const w = load((cfg) => { enableAll(cfg); });
  // A test product that uses the template defaults, with the server data built the same way as the real catalog.
  w.CATEGORY_PRODUCTS['three-piece-dress'] = [{ id: 'TPD-TEST', name: 'Test Three Piece', image: '/images/t.webp', price: 1500, sizes: ['38'], sizeTemplate: {} }];
  const products = w.__maBuildValidationProducts(w);
  const p = plain(products).find((x) => x.id === 'TPD-TEST');
  assert.equal(p.sizeTemplate, 'three-piece-dress');
  const ops = loadOps(products);
  const resolved = { fields: p.sizeFields };

  const cases = [
    [{ top: '40', top_length: '42', bottom: '38' }, true],
    [{ top: '40', top_length: '42', bottom: '38', dupatta: 'standard' }, true],
    [{ top: '40', top_length: '42', bottom: '38', dupatta: '2.5 গজ' }, true],
    [{ top: '40', bottom: '38' }, false],
    [{ top: '99', top_length: '42', bottom: '38' }, false],
    [{ top: '40', top_length: '42', bottom: '38', extra: '1' }, false],
    [{ top: '40', top_length: '42', bottom: '38', dupatta: '<b>' }, false]
  ];
  for (const [choice, good] of cases) {
    const measurements = Object.entries(choice).map(([key, value]) => ({ key, value }));
    const browser = w.maSizeTemplates.validate(resolved, measurements);
    assert.equal(browser.ok, good, 'browser ' + JSON.stringify(choice));
    const it = { id: 'TPD-TEST', qty: 2, price: 1, size: 'anything', measurements: plain(measurements) };
    if (good) {
      assert.equal(ops.opsLinePrice_(it, p), 3000);
      assert.equal(it.size, browser.size, 'server rebuilds the same size text');
      eq(plain(it.measurements), plain(browser.measurements));
    } else {
      assert.throws(() => ops.opsLinePrice_(it, p), /MEASUREMENT/, JSON.stringify(choice));
    }
  }
  assert.throws(() => ops.opsLinePrice_({ id: 'TPD-TEST', qty: 1, size: 'x', measurements: [{ key: 'top', value: '40' }, { key: 'top', value: '42' }] }, p), /INVALID_MEASUREMENT/);
  // Old carts (size text only) still go through the old check for the same product.
  assert.equal(ops.opsLinePrice_({ id: 'TPD-TEST', qty: 1, size: '38' }, p), 1500);
  assert.throws(() => ops.opsLinePrice_({ id: 'TPD-TEST', qty: 1, size: '99' }, p), /INVALID_SIZE/);
});

test('order intake keeps measurement choices from CartJSON (bounded)', () => {
  const src = read('apps-script/Code.gs');
  const start = src.indexOf('function validateOrderInput_(e) {');
  const body = src.slice(start, src.indexOf('\n}\n', start) + 3);
  const c = { Date, JSON, Number, String, Math, Array, Error, parseInt, parseFloat };
  vm.createContext(c);
  vm.runInContext(body, c);
  c.param_ = (e, k) => e.parameter[k] || '';
  c.normalizePhone_ = (v) => String(v);
  c.formatOrderDesignLines_ = (lines) => lines.join('\n');
  const cart = [
    { id: 'A', qty: 1, size: 'x', measurements: [{ key: 'top', value: '40' }, { key: 'k'.repeat(60), value: 'v'.repeat(100) }].concat(Array(20).fill({ key: 'z', value: '1' })) },
    { id: 'B', qty: 1, size: '38' }
  ];
  const e = { parameter: { SiteTs: String(Date.now() - 5000), Name: 'Rahima', Phone: '01712345678', Address: 'House 1, Road 2, Dhaka',
    Quantity: '2', Total: '1500', Design: 'x', CartJSON: JSON.stringify(cart) } };
  const out = plain(c.validateOrderInput_(e));
  assert.equal(out.cartItems[0].measurements.length, 12);
  eq(out.cartItems[0].measurements[0], { key: 'top', value: '40' });
  assert.equal(out.cartItems[0].measurements[1].key.length, 40);
  assert.equal(out.cartItems[0].measurements[1].value.length, 80);
  assert.equal('measurements' in out.cartItems[1], false, 'old cart lines are stored exactly as before');
});
