// WooCommerce-style product variations: the order server (Operations.gs opsVariation_/opsLinePrice_)
// and the checkout cart (cart-reprice.js) must pick the same variation and charge the same price,
// and product-utils.js must keep only clean variation data.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

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
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(['opsNorm_', 'opsVariation_', 'opsLinePrice_'].map(grab).join('\n'), ctx);
  return ctx;
}

function client() {
  const ctx = { window: {}, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'cart-reprice.js'), 'utf8'), ctx);
  return ctx.window;
}

const abaya = {
  id: 'AB-V', name: 'Variation Abaya', category: 'abaya', kind: 'abaya', price: 1500,
  prices: { 'Full Set': 1500, 'Abaya Only': 1200 },
  sizes: ['50', '52', '54', '56'], bodySizes: ['46'], bodyLabel: '46', lengths: ['50', '52', '54', '56'],
  dressLengths: [], palazzoLengths: [], lengthLabel: '', custom: [{ length: 57, lengthExtra: 0, width: 47, widthExtra: 0 }],
  variations: [
    { size: 'Length 56', price: 1650 },
    { type: 'Full Set', size: 'Length 56', price: 1850 },
    { color: 'navy-blue', size: 'Body 46 · Length 54', price: 1700 },
    { size: 'Length 52', enabled: false },
    { type: 'Abaya Only', price: 1100 }
  ]
};

const simple = {
  id: 'KT-V', name: 'Variation Kurti', category: 'tops-kurti', kind: 'simple', price: 900,
  sizes: ['M', 'L', 'XL'], bodySizes: [], bodyLabel: '', lengths: [], dressLengths: [], palazzoLengths: [], lengthLabel: '', custom: [],
  variations: [{ size: 'XL', price: 990 }, { color: 'Black', size: 'L', price: 950 }]
};

const cases = [
  // [product, line, expected unit price or null when the order is refused]
  [abaya, { productType: 'Full Set', size: 'Body 46 · Length 50' }, 1500],
  [abaya, { productType: 'Full Set', size: 'Body 46 · Length 56' }, 1850],
  [abaya, { productType: 'Abaya Only', size: 'Body 46 · Length 56' }, 1650],
  [abaya, { productType: 'Abaya Only', size: 'Body 46 · Length 50' }, 1100],
  [abaya, { productType: 'Full Set', color: 'navy-blue', size: 'Body 46 · Length 54' }, 1700],
  [abaya, { productType: 'Full Set', color: 'black', size: 'Body 46 · Length 54' }, 1500],
  [abaya, { productType: 'Full Set', size: 'Body 46 · Length 52' }, null],
  [abaya, { productType: 'Full Set', size: 'Custom (L:57 / W:47)' }, 1500],
  [simple, { size: 'XL' }, 990],
  [simple, { size: 'L', color: 'black' }, 950],
  [simple, { size: 'L', color: 'red' }, 900],
  [simple, { size: 'M' }, 900]
];

test('order server picks the most specific variation and refuses a switched-off one', () => {
  const c = server();
  cases.forEach(([p, line, want]) => {
    const it = Object.assign({ qty: 1 }, line);
    if (want == null) assert.throws(() => c.opsLinePrice_(it, p), /VARIATION_UNAVAILABLE/, JSON.stringify(line));
    else assert.equal(c.opsLinePrice_(it, p), want, JSON.stringify(line));
  });
  const two = { qty: 2, productType: 'Full Set', size: 'Body 46 · Length 56' };
  assert.equal(c.opsLinePrice_(two, abaya), 3700);
  assert.equal(two.price, 1850, 'server overwrites the client unit price');
});

test('checkout cart charges exactly what the order server charges', () => {
  const w = client();
  cases.forEach(([p, line, want]) => assert.equal(w.maServerUnitPrice(line, p), want, JSON.stringify(line)));
});

test('products without variations price exactly as before', () => {
  const c = server();
  const plain = Object.assign({}, abaya);
  delete plain.variations;
  assert.equal(c.opsLinePrice_({ qty: 1, productType: 'Full Set', size: 'Body 46 · Length 56' }, plain), 1500);
  assert.equal(c.opsLinePrice_({ qty: 1, productType: 'Abaya Only', size: 'Body 46 · Length 52' }, plain), 1200);
});

test('product-utils keeps clean variations and validation data drops SKU/photo/sale price', () => {
  const w = { location: { origin: 'https://muslimabaya.com', pathname: '/' } };
  w.window = w;
  const ctx = vm.createContext(w);
  ['product-config.js', 'product-utils.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx));
  const clean = w.maCatalog.cleanVariations([
    { size: ' Length  56 ', price: '1650', regularPrice: 1800, sku: 'AB-V-56', image: '/images/a.webp' },
    { color: 'navy', price: 1200, regularPrice: 1000 },
    { size: '52', enabled: false, price: 0 },
    { price: 999 },
    null, 'bad'
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(clean)), [
    { size: 'Length 56', sku: 'AB-V-56', image: '/images/a.webp', price: 1650, regularPrice: 1800 },
    { color: 'navy', price: 1200 },
    { size: '52', enabled: false }
  ]);
  const n = w.maCatalog.normalizeProductEntry({ id: 'X', name: 'X', price: 900, variations: [{ size: 'M', price: 950 }] }, 'tops-kurti', 0);
  assert.deepEqual(JSON.parse(JSON.stringify(n.variations)), [{ size: 'M', price: 950 }]);
});

test('product page (product-utils variationFor) picks the same variation as the order server', () => {
  const w = { location: { origin: 'https://muslimabaya.com', pathname: '/' } };
  w.window = w;
  const ctx = vm.createContext(w);
  ['product-config.js', 'product-utils.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx));
  const c = server();
  cases.forEach(([p, line]) => {
    assert.equal(JSON.stringify(w.maCatalog.variationFor(p, line)), JSON.stringify(c.opsVariation_(p, line)), JSON.stringify(line));
  });
});
