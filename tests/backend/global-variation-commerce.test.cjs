// Global Product Attributes marked as variations must match and price consistently
// across the product catalog, cart repricer, Apps Script order server and stock ledger.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function grab(source, name) {
  const start = source.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
}

const product = {
  id: 'FABRIC-VAR-1', name: 'Fabric Variation Kurti', category: 'tops-kurti', kind: 'simple',
  price: 900, sizes: ['M', 'L'], bodySizes: [], bodyLabel: '', lengths: [],
  dressLengths: [], palazzoLengths: [], lengthLabel: '', custom: [],
  globalAttributes: [{ id: 'fabric-type', name: 'Fabric Type', variation: true, terms: [
    { id: 'cotton', name: 'Cotton' }, { id: 'linen', name: 'Linen' }
  ] }],
  variations: [
    { size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'cotton', name: 'Fabric Type', term: 'Cotton' }], sku: 'FAB-M-COTTON', price: 1200 },
    { size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'linen', name: 'Fabric Type', term: 'Linen' }], sku: 'FAB-M-LINEN', price: 1400 }
  ]
};

function orderServer() {
  const source = read('apps-script/Operations.gs');
  const ctx = vm.createContext({});
  vm.runInContext(['opsNorm_', 'opsVariation_', 'opsSaleOff_', 'opsLinePrice_'].map((n) => grab(source, n)).join('\n'), ctx);
  return ctx;
}
function cartClient() {
  const ctx = vm.createContext({ window: {}, setTimeout, clearTimeout });
  vm.runInContext(read('cart-reprice.js'), ctx);
  return ctx.window;
}
function catalogClient() {
  const w = { location: { origin: 'https://muslimabaya.com', pathname: '/' } };
  w.window = w;
  const ctx = vm.createContext(w);
  ['product-config.js', 'product-utils.js'].forEach((f) => vm.runInContext(read(f), ctx));
  return w;
}

test('order server and cart repricer charge the selected global term price', () => {
  const server = orderServer();
  const cart = cartClient();
  const cotton = { qty: 1, size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'cotton' }] };
  const linen = { qty: 2, size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'linen' }] };
  assert.equal(server.opsLinePrice_(Object.assign({}, cotton), product), 1200);
  assert.equal(server.opsLinePrice_(Object.assign({}, linen), product), 2800);
  assert.equal(cart.maServerUnitPrice(cotton, product), 1200);
  assert.equal(cart.maServerUnitPrice(linen, product), 1400);
});

test('a required global variation cannot fall back to the base product price', () => {
  const server = orderServer();
  const cart = cartClient();
  assert.throws(() => server.opsLinePrice_({ qty: 1, size: 'M' }, product), /VARIATION_UNAVAILABLE/);
  assert.equal(cart.maServerUnitPrice({ size: 'M' }, product), null);
  assert.equal(server.opsVariation_(product, { size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'unknown' }] }), null);
});

test('catalog cleaning preserves variation terms, SKU and exact term matching', () => {
  const w = catalogClient();
  const clean = w.maCatalog.cleanVariations(product.variations);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].sku, 'FAB-M-COTTON');
  assert.deepEqual(JSON.parse(JSON.stringify(clean[0].globalAttributes)), [
    { id: 'fabric-type', termId: 'cotton', name: 'Fabric Type', term: 'Cotton' }
  ]);
  assert.equal(w.maCatalog.variationFor(product, { size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'cotton' }] }).sku, 'FAB-M-COTTON');
  assert.equal(w.maCatalog.variationFor(product, { size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'linen' }] }).sku, 'FAB-M-LINEN');
  assert.equal(w.maCatalog.variationFor(product, { size: 'M' }), null);
});

test('stock ledger uses an exact global-term key and never mixes term stock', () => {
  const source = read('apps-script/Code.gs');
  const ctx = vm.createContext({});
  const names = ['normStockVariant_', 'stockVariantCompareKey_', 'colorSizeStockVariant_', 'stockSizePartCandidates_', 'cartItemVariantKey_', 'cartItemStockCandidates_'];
  vm.runInContext(names.map((n) => grab(source, n)).join('\n'), ctx);
  const line = { color: 'Navy', size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'cotton' }] };
  const key = ctx.cartItemVariantKey_(line);
  assert.equal(key, 'Navy · M · Global[fabric-type=cotton]');
  assert.deepEqual(Array.from(ctx.cartItemStockCandidates_(line)), [key]);
  const typed = ctx.cartItemVariantKey_(Object.assign({}, line, { productType: 'Full Set' }));
  assert.equal(typed, 'Navy · M · Type[Full Set] · Global[fabric-type=cotton]');

  const w = catalogClient();
  const stockProduct = { stockVariants: {
    'Navy · M · Global[fabric-type=cotton]': { tracked: true, available: 3 },
    'Navy · M · Global[fabric-type=linen]': { tracked: true, available: 8 }
  } };
  assert.equal(w.maCatalog.getStockQty(stockProduct, key, 'Navy'), 3);
  assert.equal(w.maCatalog.getStockQty(stockProduct, 'Navy · M · Global[fabric-type=linen]', 'Navy'), 8);
});
