// Variable product with no price of its own: Publish takes the lowest enabled variation price; with no price
// anywhere a published product gets a clear message, a draft is left alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const w = { };
w.window = w;
vm.createContext(w);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../product-publish-utils.js'), 'utf8'), w);
const fill = (products, published = () => true) => w.MaProductPublishUtils.fillVariablePrices(products, published);

test('no product price: takes the lowest enabled variation price', () => {
  const p = { id: 'KM-1', name: 'Leopard set', price: 0, variations: [{ size: '48', price: 950 }, { size: '50', price: 900, enabled: false }, { size: '52', price: 1000 }] };
  fill({ k: [p] });
  assert.equal(p.price, 950);
});

test('a product price that is already set is kept', () => {
  const p = { id: 'KM-2', price: 1200, variations: [{ price: 900 }] };
  fill({ k: [p] });
  assert.equal(p.price, 1200);
});

test('no price anywhere: published → clear message; draft → left alone', () => {
  const p = { id: 'KM-3', name: 'লেপার্ড সেট', price: 0, variations: [{ size: '48' }, { size: '50' }] };
  assert.throws(() => fill({ k: [p] }), /Price ৳/);
  assert.doesNotThrow(() => fill({ k: [p] }, () => false));
  assert.equal(p.price, 0);
});

test('simple products are not touched', () => {
  const p = { id: 'S-1', price: 0 };
  assert.doesNotThrow(() => fill({ k: [p] }));
  assert.equal(p.price, 0);
});
