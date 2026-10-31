// Smart Product Upload, stage 4: automatic product link, search listing and photo descriptions (alt text).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const w = { location: { protocol: 'https:' } };
w.window = w;
vm.createContext(w);
['product-publish-utils.js', 'product-utils.js'].forEach((f) => vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), w));
const U = w.MaProductPublishUtils;

test('link from the name: lower case, hyphens, at most 50 characters, empty for a Bangla-only name', () => {
  assert.equal(U.slug('Navy Chiffon Abaya (Set)'), 'navy-chiffon-abaya-set');
  assert.equal(U.slug('  Hijab — 2 Piece  '), 'hijab-2-piece');
  assert.equal(U.slug('কালো বোরকা'), '');
  assert.equal(U.slug('কালো Abaya'), 'abaya');
  const long = U.slug('Premium Dubai Cherry Nida Abaya With Hijab Niqab And Matching Gloves Set');
  assert.ok(long.length <= 50 && !long.endsWith('-'), long);
});

test('search listing: title up to 60 and description up to 160 characters, with price and delivery', () => {
  const r = U.seo({ name: 'Navy Chiffon Abaya Set', colorLabel: 'Navy, Black', fabric: 'Premium Chiffon', price: 1450,
    detailNote: 'Soft flowing chiffon with hijab and niqab. Machine wash cold.' });
  assert.equal(r.title, 'Navy Chiffon Abaya Set | Muslim Abaya');
  assert.equal(r.description, 'Navy Chiffon Abaya Set. Color: Navy, Black. Fabric: Premium Chiffon. Soft flowing chiffon with hijab and niqab. ৳1450. Cash on delivery across Bangladesh.');
  const long = U.seo({ name: 'Long Name '.repeat(8), price: 990, detailNote: 'word '.repeat(80) });
  assert.ok(long.title.length <= 60, long.title);
  assert.ok(long.description.length <= 160, String(long.description.length));
  assert.ok(long.description.endsWith('৳990. Cash on delivery across Bangladesh.'));
  assert.equal(U.seo({ name: 'নীল বোরকা', price: 1200, detailNote: 'নরম কাপড়। মেশিনে ধোয়া যায়।' }).description, 'নীল বোরকা. নরম কাপড়। ৳1200. Cash on delivery across Bangladesh.');
});

test('photo description: name, the colour shown in that photo, fabric; later photos are numbered', () => {
  const alt = w.maCatalog.imageAlt;
  const p = { name: 'Two Colour Abaya', fabric: 'Nida', colorLabel: 'Navy, Maroon',
    colorVariants: [{ color: 'navy', colorLabel: 'Navy', image: 'images/uploads/ab-1.webp' }, { color: 'maroon', colorLabel: 'Maroon', image: 'images/uploads/ab-2.webp' }] };
  assert.equal(alt(p, '/images/uploads/ab-2.webp?v=3', 1), 'Two Colour Abaya – Maroon – Nida (photo 2)');
  assert.equal(alt(p, 'https://muslimabaya.com/images/uploads/ab-1.webp', 0), 'Two Colour Abaya – Navy – Nida');
  assert.equal(alt(p, 'images/uploads/other.webp', 2), 'Two Colour Abaya – Nida (photo 3)');
  assert.equal(alt({ name: 'Black Hijab', colorLabel: 'Black', fabric: '' }, 'x.webp', 0), 'Black Hijab – Black');
  assert.equal(alt({ name: 'Mixed', colorLabel: 'Multiple colors' }, 'x.webp', 0), 'Mixed');
  assert.equal(alt(null, 'x', 0), '');
});

test('category pages carry a pre-built product list (links + ItemList) so search engines see products without JavaScript', () => {
  const abaya = fs.readFileSync(path.join(root, 'abaya.html'), 'utf8');
  const m = /<div id="list"><!--ma-static-list-->([\s\S]*?)<!--\/ma-static-list--><\/div>/.exec(abaya);
  assert.ok(m, 'abaya.html has the static list');
  assert.match(m[1], /<h1 class="ma-static-h1">[^<]+<\/h1>/);
  assert.match(m[1], /<a href="\/product\/[A-Za-z0-9_-]+">/);
  assert.doesNotMatch(m[1], /<script/i);
  assert.match(abaya, /"@type":"CollectionPage"[\s\S]*"@type":"ItemList"/);
  // Product pages are built from abaya.html but must never inherit the category list.
  const prod = fs.readFileSync(path.join(root, 'product', 'ABY-MAROON-1.html'), 'utf8');
  assert.ok(!prod.includes('ma-static-list'), 'product page has no category list');
  assert.ok(prod.includes('<div id="list"><article>'), 'product page keeps its own article');
});
