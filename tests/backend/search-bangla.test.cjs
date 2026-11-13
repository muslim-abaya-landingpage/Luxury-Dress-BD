// Site search for Bangladeshi shoppers: Bangla words and common spellings find the right products, and the
// matching category comes first (an abaya tagged "টু-পিস ড্রেস" must not push real two-pieces down).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function load() {
  const ctx = { console, document: undefined };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('product-config.js'), ctx);
  vm.runInContext(read('product-utils.js'), ctx);
  vm.runInContext(read('product-catalog-sections.js'), ctx);
  return ctx;
}
const P = (id, name, extra = {}) => Object.assign({ id, name, price: 500, status: 'publish' }, extra);
const shop = {
  abaya: [P('A1', 'Maroon Abaya Set', { tags: ['টু-পিস ড্রেস', 'বোরখা'] }), P('A2', 'Safa Sate Borka')],
  'premium-two-piece': [P('T1', 'Baby Pink Floral Print Women\'s Two-Piece Set')],
  'tops-kurti': [P('K1', 'Elegant Grey Leaf Print Kurti')],
  panjabi: [P('PJ1', 'Premium White Panjabi')],
  hijab: [P('H1', 'Premium Short Khimar Hijab')],
  'three-piece-dress': [P('TH1', 'Premium Cotton Three Piece')],
};
const ids = (w, q) => [...w.maSearch.collectProducts(shop, q, {})].map((p) => p.id);

test('Bangla and other spellings find the same products', () => {
  const w = load();
  for (const q of ['পাঞ্জাবি', 'পাঞ্জাবী', 'punjabi', 'panjabi']) assert.deepEqual(ids(w, q), ['PJ1'], q);
  for (const q of ['থ্রি পিস', 'three piece', '3 piece']) assert.deepEqual(ids(w, q), ['TH1'], q);
  for (const q of ['কুর্তি', 'kurti']) assert.deepEqual(ids(w, q), ['K1'], q);
  for (const q of ['হিজাব', 'hijab', 'khimar']) assert.deepEqual(ids(w, q), ['H1'], q);
  for (const q of ['burka', 'burqa', 'বোরকা', 'borka', 'আবায়া', 'abaya']) assert.deepEqual(ids(w, q).sort(), ['A1', 'A2'], q);
});

test('the matching category comes first: "টু পিস" shows the two-piece before an abaya tagged টু-পিস', () => {
  const w = load();
  for (const q of ['টু পিস', 'two piece', 'two-piece', '2 piece']) {
    const got = ids(w, q);
    assert.equal(got[0], 'T1', q + ' → ' + got.join(','));
  }
});

test('ordinary searches still work as before', () => {
  const w = load();
  assert.deepEqual(ids(w, 'maroon'), ['A1']);
  assert.deepEqual(ids(w, 'grey leaf'), ['K1']);
  assert.deepEqual(ids(w, 'nothing like this'), []);
});
