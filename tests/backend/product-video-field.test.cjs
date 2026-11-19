// window.CATEGORY_PRODUCTS normalization (product-utils.js normalizeProductEntry) must preserve
// the Product Manager's "YouTube ভিডিও লিংক" field (videoUrl) all the way through — the homepage
// "Watch & Shop" carousel (product-video-carousel.js) reads it from window.CATEGORY_PRODUCTS, not
// from the raw catalog file. A regression here silently makes every shoppable video disappear.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function load(products) {
  const ctx = { window: {}, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('product-config.js'), ctx);
  vm.runInContext(read('product-utils.js'), ctx);
  ctx.window.CATEGORY_PRODUCTS = JSON.parse(JSON.stringify(products));
  ctx.window.PRODUCT_LINKS_DATA = {};
  vm.runInContext(read('product-catalog-sync.js'), ctx);
  return ctx.window;
}

test('normalization keeps videoUrl on a product that has one', () => {
  const win = load({
    abaya: [{ id: 'A1', name: 'Test Abaya', image: '/images/a1.webp', price: 2000, sizes: ['Free'], videoUrl: 'https://www.youtube.com/watch?v=abc12345678' }],
  });
  const p = win.maCatalog.normalizeProductEntry(win.CATEGORY_PRODUCTS.abaya[0], 'abaya', 0);
  assert.equal(p.videoUrl, 'https://www.youtube.com/watch?v=abc12345678');
});

test('normalization leaves videoUrl out entirely when the product has none', () => {
  const win = load({
    abaya: [{ id: 'A2', name: 'No Video Abaya', image: '/images/a2.webp', price: 2000, sizes: ['Free'] }],
  });
  const p = win.maCatalog.normalizeProductEntry(win.CATEGORY_PRODUCTS.abaya[0], 'abaya', 0);
  assert.equal(p.videoUrl, undefined);
});

test('home-catalog-utils.min.js (the built bundle the browser actually loads) is in sync with product-utils.js', () => {
  // product-utils.js is bundled + minified into home-catalog-utils.min.js by
  // scripts/build-home-speed.mjs; index.html loads only the bundle. This guards
  // against editing the source and forgetting to rebuild it.
  const bundle = read('home-catalog-utils.min.js');
  assert.ok(bundle.includes('videoUrl'), 'home-catalog-utils.min.js must be rebuilt (node scripts/build-home-speed.mjs) after product-utils.js changes');
});
