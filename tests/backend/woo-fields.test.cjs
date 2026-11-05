// WooCommerce fields from Product Manager → Edit product, as the website and the order server use them:
// status / visibility / publish date, catalog visibility, menu order, extra categories, backorders,
// sold individually, virtual products and the description HTML cleaning.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
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
    let depth = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') depth++;
      else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
    }
    throw new Error('missing ' + name);
  };
  const ctx = vm.createContext({});
  vm.runInContext(['opsNorm_', 'opsVariation_', 'opsSaleOff_', 'opsLinePrice_', 'opsAllVirtual_'].map(grab).join('\n'), ctx);
  return ctx;
}
const base = (id, extra) => Object.assign({ id, name: 'Product ' + id, image: '/images/' + id + '.webp', price: 900, sizes: ['M', 'L'] }, extra || {});
const dhaka = (ms) => new Date(ms + 6 * 3600000).toISOString().slice(0, 16);

test('Pending, Private and Scheduled products are not on the website; a past publish date is', () => {
  const w = site();
  w.CATEGORY_PRODUCTS = {
    'tops-kurti': [base('A'), base('B', { status: 'pending' }), base('C', { visibility: 'private' }),
      base('D', { publishDate: dhaka(Date.now() + 86400000) }), base('E', { publishDate: dhaka(Date.now() - 86400000) }), base('F', { visibility: 'password', postPassword: 'x' })]
  };
  const shop = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, {});
  assert.deepEqual([...shop['tops-kurti'].map((p) => p.id)], ['A', 'E', 'F']);
  const orderable = [...w.__maBuildValidationProducts(w).map((p) => p.id)].sort();
  assert.deepEqual(orderable, ['A', 'D', 'E', 'F'], 'scheduled products can be ordered as soon as they go live');
});

test('Catalog visibility: shop only / search only / hidden', () => {
  const w = site();
  const m = w.maCatalog;
  const p = (v) => m.normalizeProductEntry(base('X', { catalogVisibility: v }), 'tops-kurti', 0);
  assert.equal(m.listable(p(undefined), 'shop'), true);
  assert.equal(m.listable(p('catalog'), 'shop'), true); assert.equal(m.listable(p('catalog'), 'search'), false);
  assert.equal(m.listable(p('search'), 'shop'), false); assert.equal(m.listable(p('search'), 'search'), true);
  assert.equal(m.listable(p('hidden'), 'shop'), false); assert.equal(m.listable(p('hidden'), 'search'), false);
  assert.equal(w.maSearch.productMatches(p('hidden'), 'tops-kurti', {}, 'product'), false);
  assert.equal(w.maSearch.productMatches(p('search'), 'tops-kurti', {}, 'product'), true);
});

test('Menu order sorts the category (featured first), and extra categories list the product there too', () => {
  const w = site();
  w.CATEGORY_PRODUCTS = {
    'tops-kurti': [base('A', { menuOrder: 5 }), base('B', { menuOrder: -1 }), base('C', { featured: true, menuOrder: 9, extraCategories: ['panjabi'] })],
    panjabi: [base('P')]
  };
  const shop = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, {});
  assert.deepEqual([...shop['tops-kurti'].map((p) => p.id)], ['C', 'B', 'A']);
  assert.deepEqual([...shop.panjabi.map((p) => p.id)], ['P', 'C']);
  assert.equal(shop.panjabi[1]._extraCategory, true);
  assert.equal(w.__maBuildValidationProducts(w).filter((p) => p.id === 'C').length, 1, 'order data has the product once');
});

test('Backorders: "On backorder" or Allow backorders keeps a product orderable at 0 stock', () => {
  const w = site();
  const n = (extra) => w.maCatalog.normalizeProductEntry(base('X', extra), 'tops-kurti', 0);
  assert.equal(w.maCatalog.isInStock(n({ stock: 0 })), false);
  assert.equal(w.maCatalog.isInStock(n({ stock: 0, backorders: 'notify' })), true);
  assert.equal(w.maCatalog.getStockStatus(n({ stockStatus: 'onbackorder' })).label, 'Available on backorder');
  assert.equal(w.maCatalog.isInStock(n({ stockStatus: 'onbackorder', inStock: false })), false, 'Out of stock switch still wins');
});

test('Order server: sold individually allows 1 per order; all-virtual carts have no delivery charge', () => {
  const w = site(), c = server();
  w.CATEGORY_PRODUCTS = { 'tops-kurti': [base('S', { soldIndividually: true }), base('V', { virtual: true }), base('N')] };
  const rows = w.__maBuildValidationProducts(w);
  const S = rows.find((r) => r.id === 'S');
  assert.equal(S.soldIndividually, true);
  assert.equal(c.opsLinePrice_({ qty: 1, size: 'M' }, S), 900);
  assert.throws(() => c.opsLinePrice_({ qty: 2, size: 'M' }, S), /SOLD_INDIVIDUALLY/);
  c.opsCatalog_ = () => ({ products: rows });
  assert.equal(c.opsAllVirtual_([{ id: 'V', qty: 1 }]), true);
  assert.equal(c.opsAllVirtual_([{ id: 'V', qty: 1 }, { id: 'N', qty: 1 }]), false);
  c.opsCatalog_ = () => { throw new Error('CATALOG_UNAVAILABLE'); };
  assert.equal(c.opsAllVirtual_([{ id: 'V', qty: 1 }]), false, 'unknown → normal delivery charge');
});

test('New fields are kept by the catalog; downloads need a web link', () => {
  const w = site();
  const p = w.maCatalog.normalizeProductEntry(base('X', {
    sku: ' MA-1 ', gtin: '123', upsells: ['A', ''], crossSells: ['B'], weight: '0.5', purchaseNote: 'Thanks', reviewsAllowed: false,
    productType: 'external', externalUrl: 'https://example.com', buttonText: 'Buy', downloads: [{ name: 'Guide', file: 'https://x.test/a.pdf' }, { file: 'javascript:alert(1)' }]
  }), 'tops-kurti', 0);
  assert.equal(p.sku, 'MA-1'); assert.deepEqual([...p.upsells], ['A']); assert.equal(p.weight, 0.5);
  assert.equal(p.reviewsAllowed, false); assert.equal(p.productType, 'external');
  assert.deepEqual(JSON.parse(JSON.stringify(p.downloads)), [{ name: 'Guide', file: 'https://x.test/a.pdf' }]);
});
