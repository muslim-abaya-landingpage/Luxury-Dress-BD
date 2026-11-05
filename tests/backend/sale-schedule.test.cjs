// WooCommerce-style sale schedule (Product Manager → General → "Schedule"): saleFrom / saleTo dates.
// Inside the dates the sale prices apply; outside them the regular prices. The website (product-utils.js),
// the order data (catalog-validation-core.js), the order server (Operations.gs opsLinePrice_) and the
// checkout cart (cart-reprice.js) must all agree.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const DAY = 86400000;
const dhakaDate = (ms) => new Date(ms + 6 * 3600000).toISOString().slice(0, 10);
const today = dhakaDate(Date.now());
const yesterday = dhakaDate(Date.now() - DAY);
const tomorrow = dhakaDate(Date.now() + DAY);
const lastWeek = dhakaDate(Date.now() - 7 * DAY);

function site() {
  const w = { location: { origin: 'https://muslimabaya.com', pathname: '/' } };
  w.window = w;
  const ctx = vm.createContext(w);
  ['product-config.js', 'product-utils.js', 'catalog-validation-core.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx));
  return w;
}

function server() {
  const src = fs.readFileSync(path.join(root, 'apps-script/Operations.gs'), 'utf8');
  const grab = (name) => {
    const i = src.indexOf('function ' + name + '(');
    if (i < 0) throw new Error('missing ' + name);
    let depth = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') depth++;
      else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
    }
    throw new Error('missing ' + name);
  };
  const ctx = vm.createContext({});
  vm.runInContext(['opsNorm_', 'opsVariation_', 'opsSaleOff_', 'opsLinePrice_'].map(grab).join('\n'), ctx);
  return ctx;
}

function cart() {
  const ctx = { window: {}, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'cart-reprice.js'), 'utf8'), ctx);
  return ctx.window;
}

const kurti = (from, to) => ({
  id: 'KT-S', name: 'Sale Kurti', image: '/images/k.webp', price: 800, regularPrice: 1000, sizes: ['M', 'L'],
  saleFrom: from, saleTo: to, variations: [{ size: 'L', price: 850, regularPrice: 1100 }]
});
const abaya = (from, to) => ({
  id: 'AB-S', name: 'Sale Abaya', image: '/images/a.webp', price: 1200, regularPrice: 1500, sizes: ['50', '52'], bodySizes: ['46'],
  types: ['Full Set', 'Abaya Only'], priceByType: { 'Full Set': 1200, 'Abaya Only': 900 },
  regularPriceByType: { 'Full Set': 1500, 'Abaya Only': 1000 }, saleFrom: from, saleTo: to
});

test('website shows the sale only between the dates (Bangladesh time, whole days)', () => {
  const w = site();
  const norm = (p, cat) => w.maCatalog.normalizeProductEntry(JSON.parse(JSON.stringify(p)), cat, 0);
  const on = norm(kurti(yesterday, tomorrow), 'tops-kurti');
  assert.equal(on.price, 800); assert.equal(on.regularPrice, 1000);
  assert.equal(on.variations[0].price, 850);
  const todayOnly = norm(kurti(today, today), 'tops-kurti');
  assert.equal(todayOnly.price, 800, 'a one-day sale runs all of today');
  const before = norm(kurti(tomorrow, ''), 'tops-kurti');
  assert.equal(before.price, 1000); assert.equal(before.regularPrice, undefined);
  assert.equal(before.variations[0].price, 1100); assert.equal(before.variations[0].regularPrice, undefined);
  const ended = norm(abaya(lastWeek, yesterday), 'abaya');
  assert.equal(ended.price, 1500);
  assert.deepEqual({ ...ended.priceByType }, { 'Full Set': 1500, 'Abaya Only': 1000 });
  assert.equal(ended.regularPriceByType, undefined);
  assert.equal(w.maCatalog.getSaleInfo(ended, 'Full Set', ended.priceByType['Full Set']), null, 'no crossed-out price after the sale');
  const raw = abaya(lastWeek, yesterday);
  norm(raw, 'abaya');
  assert.equal(raw.priceByType['Full Set'], 1200, 'the saved catalog entry is never changed');
});

test('products without dates behave exactly as before', () => {
  const w = site();
  const p = kurti('', '');
  delete p.saleFrom; delete p.saleTo;
  const n = w.maCatalog.normalizeProductEntry(p, 'tops-kurti', 0);
  assert.equal(n.price, 800); assert.equal(n.regularPrice, 1000);
  assert.equal(n._saleRaw, undefined); assert.equal(n.saleFrom, undefined);
});

test('order data keeps sale prices, regular prices and the dates, whenever it is built', () => {
  const w = site();
  w.CATEGORY_PRODUCTS = { 'tops-kurti': [kurti(lastWeek, yesterday)], abaya: [abaya(tomorrow, '')] };
  const rows = w.__maBuildValidationProducts(w);
  const k = rows.find((r) => r.id === 'KT-S'), a = rows.find((r) => r.id === 'AB-S');
  assert.equal(k.price, 800); assert.equal(k.regularPrice, 1000);
  assert.equal(k.saleTo, Date.parse(yesterday + 'T23:59:59.999+06:00'));
  assert.deepEqual(JSON.parse(JSON.stringify(k.variations)), [{ size: 'L', price: 850, regularPrice: 1100 }]);
  assert.deepEqual({ ...a.prices }, { 'Full Set': 1200, 'Abaya Only': 900 });
  assert.deepEqual({ ...a.regularPrices }, { 'Full Set': 1500, 'Abaya Only': 1000 });
  assert.equal(a.saleFrom, Date.parse(tomorrow + 'T00:00:00+06:00'));
});

test('order server and checkout charge the sale price inside the dates and the regular price outside', () => {
  const w = site(), c = server(), cartW = cart();
  const cases = [
    [kurti(yesterday, tomorrow), 'tops-kurti', { size: 'M' }, 800],
    [kurti(yesterday, tomorrow), 'tops-kurti', { size: 'L' }, 850],
    [kurti(lastWeek, yesterday), 'tops-kurti', { size: 'M' }, 1000],
    [kurti(lastWeek, yesterday), 'tops-kurti', { size: 'L' }, 1100],
    [kurti(tomorrow, ''), 'tops-kurti', { size: 'M' }, 1000],
    [abaya(yesterday, ''), 'abaya', { productType: 'Abaya Only', size: 'Body 46 · Length 50' }, 900],
    [abaya(tomorrow, ''), 'abaya', { productType: 'Abaya Only', size: 'Body 46 · Length 50' }, 1000],
    [abaya(lastWeek, yesterday), 'abaya', { productType: 'Full Set', size: 'Body 46 · Length 52' }, 1500]
  ];
  cases.forEach(([p, cat, line, want]) => {
    w.CATEGORY_PRODUCTS = { [cat]: [p] };
    const row = w.__maBuildValidationProducts(w)[0];
    const shown = w.maCatalog.normalizeProductEntry(JSON.parse(JSON.stringify(p)), cat, 0);
    const label = p.id + ' ' + p.saleFrom + '→' + p.saleTo + ' ' + JSON.stringify(line);
    assert.equal(c.opsLinePrice_(Object.assign({ qty: 1 }, line), row), want, 'server ' + label);
    assert.equal(cartW.maServerUnitPrice(line, row), want, 'cart ' + label);
    const v = w.maCatalog.variationFor(shown, line);
    const sitePrice = v && v.price ? v.price : line.productType ? shown.priceByType[line.productType] : shown.price;
    assert.equal(sitePrice, want, 'website ' + label);
  });
});

test('publish refuses bad sale dates', () => {
  const w = site();
  vm.runInContext(fs.readFileSync(path.join(root, 'product-publish-utils.js'), 'utf8'), vm.createContext(w));
  const ok = { abaya: [abaya(yesterday, tomorrow)] };
  w.MaProductPublishUtils.validateCatalog(ok);
  assert.throws(() => w.MaProductPublishUtils.validateCatalog({ abaya: [abaya('5/11/2026', '')] }), /YYYY-MM-DD/);
  assert.throws(() => w.MaProductPublishUtils.validateCatalog({ abaya: [abaya(tomorrow, yesterday)] }), /before the start/);
});
