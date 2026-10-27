// WooCommerce-style catalog features: Draft/Trash hidden everywhere (incl. the order price check), photos
// stay on the right product, featured first, sale prices, tag search, CSV export/import and publish validation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
// Values created inside the vm sandbox have other Array/Object prototypes; compare them as plain data.
const eq = (actual, expected, msg) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, msg);

function load(products, links) {
  const ctx = { window: {}, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('product-config.js'), ctx);
  vm.runInContext(read('product-utils.js'), ctx);
  ctx.window.CATEGORY_PRODUCTS = JSON.parse(JSON.stringify(products));
  ctx.window.PRODUCT_LINKS_DATA = links || {};
  vm.runInContext(read('product-catalog-sync.js'), ctx);
  vm.runInContext(read('catalog-validation-core.js'), ctx);
  vm.runInContext(read('product-publish-utils.js'), ctx);
  vm.runInContext(read('product-csv.js'), ctx);
  return ctx.window;
}

const P = (id, extra) => Object.assign({ id, name: 'Product ' + id, image: '/images/' + id + '.webp', price: 1000, sizes: ['M'] }, extra || {});
const fixture = {
  'tops-kurti': [
    P('K1'),
    P('K2', { status: 'draft' }),
    P('K3', { featured: true, tags: ['eid', 'Black Abaya'], brand: 'Muslim Abaya' }),
    P('K4', { status: 'trash', trashedAt: '2026-10-20' }),
    P('K5', { price: 1200, regularPrice: 1500, dateAdded: '2026-10-01' }),
  ],
};
const links = { 'tops-kurti': ['/images/link-K1.webp', '/images/link-K2.webp', '/images/link-K3.webp', '/images/link-K4.webp', '/images/link-K5.webp'] };

test('storefront catalog hides Draft and Trash; Product Manager mode keeps them', () => {
  const w = load(fixture, links);
  const shop = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, w.PRODUCT_LINKS_DATA);
  eq(shop['tops-kurti'].map((p) => p.id), ['K3', 'K1', 'K5']); // featured K3 first, rest in order
  const all = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, w.PRODUCT_LINKS_DATA, { includeUnpublished: true });
  eq(all['tops-kurti'].map((p) => p.id), ['K1', 'K2', 'K3', 'K4', 'K5']); // editor order untouched
  assert.equal(all['tops-kurti'][1].status, 'draft');
});

test('photos from product-links-data stay on the right product when a draft sits in between', () => {
  const w = load(fixture, links);
  const shop = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, w.PRODUCT_LINKS_DATA);
  const byId = Object.fromEntries(shop['tops-kurti'].map((p) => [p.id, p.image]));
  assert.match(byId.K3, /link-K3\.webp$/);
  assert.match(byId.K5, /link-K5\.webp$/);
});

test('order price check (catalog-validation) does not contain Draft or Trash products', () => {
  const w = load(fixture, links);
  const ids = w.__maBuildValidationProducts(w).map((p) => p.id).sort();
  eq(ids, ['K1', 'K3', 'K5']);
});

test('sale price: struck-through regular price only when it is higher than the selling price', () => {
  const w = load(fixture, links);
  const k5 = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, {})['tops-kurti'].find((p) => p.id === 'K5');
  assert.equal(k5.regularPrice, 1500);
  eq({ ...w.maGetSaleInfo(k5) }, { regular: 1500, sale: 1200, percent: 20 });
  assert.match(w.maFormatPriceHtml(k5), /<del class="ma-price-was"[^>]*>৳1500<\/del> <span class="ma-price-now">৳1200<\/span>/);
  assert.equal(w.maFormatPriceHtml({ price: 900, regularPrice: 800 }), '৳900'); // not a sale
  const opt = { price: 1650, priceByType: { 'Full Set': 1650, 'Abaya Only': 1350 }, regularPriceByType: { 'Abaya Only': 1500 } };
  assert.equal(w.maGetSaleInfo(opt, 'Abaya Only', 1350).regular, 1500);
  assert.equal(w.maGetSaleInfo(opt, 'Full Set', 1650), null);
  // A regular price that is not higher is dropped while normalising.
  const flat = w.maCatalog.normalizeAll({ x: [P('Z', { price: 900, regularPrice: 900 })] }, {});
  assert.equal(flat.x[0].regularPrice, undefined);
});

test('site search finds products by tag, brand and name; ?tag= matches whole tags only', () => {
  const w = load(fixture, links);
  const shop = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, {});
  eq(w.maSearch.collectProducts(shop, 'eid', {}).map((p) => p.id), ['K3']);
  eq(w.maSearch.collectProducts(shop, 'muslim abaya', {}).map((p) => p.id), ['K3']);
  eq(w.maSearch.collectProducts(shop, 'product k5', {}).map((p) => p.id), ['K5']);
  eq(w.maSearch.collectProductsByTag(shop, 'black abaya').map((p) => p.id), ['K3']);
  eq(w.maSearch.collectProductsByTag(shop, 'black').map((p) => p.id), []);
  eq(w.maSearch.collectProducts(shop, 'product k2', {}).map((p) => p.id), []); // draft never found
});

test('publish validation rejects a bad status or a non-whole before-sale price', () => {
  const w = load(fixture, links);
  const V = w.MaProductPublishUtils.validateCatalog;
  assert.doesNotThrow(() => V(JSON.parse(JSON.stringify(fixture))));
  assert.throws(() => V({ a: [P('A1', { status: 'hidden' })] }), /status/);
  assert.throws(() => V({ a: [P('A1', { regularPrice: 'abc' })] }), /before-sale/);
  assert.throws(() => V({ a: [P('A1', { regularPriceByType: { 'Full Set': 0 } })] }), /before-sale/);
  assert.throws(() => V({ a: [P('A1', { seoTitle: 'x'.repeat(121) })] }), /SEO/);
});

const sections = [{ key: 'abaya', menu: 'ABAYA', menuBn: 'আবায়া' }, { key: 'tops-kurti', menu: 'TOPS/KURTI', menuBn: 'টপস/কুর্তি' }];

test('CSV export: one row per product incl. Draft/Trash, Excel-safe text, round-trips through the parser', () => {
  const w = load(fixture, links);
  // A1 has no own option order: its category's order (Full Set first) decides, whatever order the prices are stored in.
  const products = { abaya: [P('A1', { name: '=HYPERLINK("x")', price: 1650, priceByType: { 'Abaya Only': 1350, 'Full Set': 1650 }, regularPriceByType: { 'Abaya Only': 1500 }, detailNote: 'Line one, "quoted"\nline two', bodySizes: ['42', '44'], sleeveSizes: ['22', '23'], dressLengths: ['52', '54'], palazzoLengths: ['38', '40'] })], 'tops-kurti': JSON.parse(JSON.stringify(fixture['tops-kurti'])) };
  const metaFor = (key) => (key === 'abaya' ? { types: ['Full Set', 'Abaya Only'] } : null);
  const csv = w.MaProductCsv.exportCsv(products, sections, { metaFor });
  assert.ok(csv.startsWith('﻿SKU,Name,Category,Status'));
  const rows = w.MaProductCsv.parseCsv(csv);
  assert.equal(rows.length, 1 + 6);
  const head = rows[0];
  const a1 = rows[1];
  assert.equal(a1[head.indexOf('Name')], '\'=HYPERLINK("x")'); // formula neutralised
  assert.equal(a1[head.indexOf('Option prices')], 'Full Set=1650 | Abaya Only=1350');
  assert.equal(a1[head.indexOf('Option before-sale prices')], 'Abaya Only=1500');
  assert.equal(a1[head.indexOf('Description')], 'Line one, "quoted"\nline two');
  assert.equal(a1[head.indexOf('Body sizes')], '42, 44');
  assert.equal(a1[head.indexOf('Sleeve sizes')], '22, 23');
  assert.equal(a1[head.indexOf('Dress lengths')], '52, 54');
  assert.equal(a1[head.indexOf('Pajama/Palazzo lengths')], '38, 40');
  eq(rows.slice(2).map((r) => r[head.indexOf('Status')]), ['Published', 'Draft', 'Published', 'Trash', 'Published']);
  // Importing the unchanged export changes nothing.
  const plan = w.MaProductCsv.planImport(csv, products, sections, { today: '2026-10-24', metaFor });
  eq({ u: plan.updates.length, c: plan.created.length, e: plan.errors.length }, { u: 0, c: 0, e: 0 });
  eq(plan.staged.abaya[0].price, 1650);
  eq(plan.staged.abaya[0].bodySizes, ['42', '44']);
  eq(plan.staged.abaya[0].sleeveSizes, ['22', '23']);
  eq(plan.staged.abaya[0].dressLengths, ['52', '54']);
  eq(plan.staged.abaya[0].palazzoLengths, ['38', '40']);
  assert.equal(plan.staged.abaya[0].types, undefined);
});

test('CSV import: updates by SKU, empty cells keep values, new products need the basics, bad rows are reported', () => {
  const w = load(fixture, links);
  const products = JSON.parse(JSON.stringify({ abaya: [], 'tops-kurti': fixture['tops-kurti'] }));
  const before = JSON.stringify(products);
  const csv = [
    'SKU,Name,Category,Status,Price,Before-sale price,Tags,Featured,Stock,SEO title',
    'K1,,,,1100,1400,"eid, sale",yes,5,Eid Kurti Sale',
    'K2,,,Published,,,,,,',
    'K5,,ABAYA,,,,,,out,',
    'NEW-1,New Abaya,abaya,Draft,1800,,,,,',
    'NEW-2,New Abaya Two,abaya,,1800,,,,,',
    'bad sku!,x,abaya,,10,,,,,',
    'K3,,,Hidden,,,,,,',
  ].join('\n').replace('NEW-1,New Abaya,abaya,Draft,1800', 'NEW-1,New Abaya,abaya,Draft,1800');
  const withImage = csv.replace('SKU,Name,Category,Status,Price,Before-sale price,Tags,Featured,Stock,SEO title', 'SKU,Name,Category,Status,Price,Before-sale price,Tags,Featured,Stock,SEO title,Image')
    .split('\n').map((l, i) => (i === 0 ? l : l + (l.startsWith('NEW-1') ? ',/images/new1.webp' : ','))).join('\n');
  const plan = w.MaProductCsv.planImport(withImage, products, sections, {
    today: '2026-10-24',
    newProduct: (sec) => ({ name: 'x', price: 1, image: '', sizes: ['44'], category: sec.key }),
  });
  assert.equal(JSON.stringify(products), before, 'the plan must not touch the live catalog');
  const k1 = plan.staged['tops-kurti'].find((p) => p.id === 'K1');
  eq({ price: k1.price, regularPrice: k1.regularPrice, featured: k1.featured, stock: k1.stock, seoTitle: k1.seoTitle, tags: [...k1.tags] },
    { price: 1100, regularPrice: 1400, featured: true, stock: 5, seoTitle: 'Eid Kurti Sale', tags: ['eid', 'sale'] });
  assert.equal(k1.name, 'Product K1'); // empty cell = unchanged
  assert.equal(plan.staged['tops-kurti'].find((p) => p.id === 'K2').status, undefined); // published
  const k5 = plan.staged.abaya.find((p) => p.id === 'K5');
  assert.ok(k5 && k5.inStock === false, 'K5 moved to abaya and marked out of stock');
  const n1 = plan.staged.abaya.find((p) => p.id === 'NEW-1');
  eq({ name: n1.name, price: n1.price, status: n1.status, image: n1.image, dateAdded: n1.dateAdded },
    { name: 'New Abaya', price: 1800, status: 'draft', image: '/images/new1.webp', dateAdded: '2026-10-24' });
  assert.equal(plan.created.length, 1);
  const lines = plan.errors.map((e) => e.line + ':' + e.message).join(' | ');
  assert.match(lines, /6:New product NEW-2 needs an Image URL/);
  assert.match(lines, /7:SKU "bad sku!" is not valid/);
  assert.match(lines, /8:Status must be Published, Draft or Trash/);
  eq(plan.updates.find((u) => u.sku === 'K1').fields.sort(), ['Before-sale price', 'Featured', 'Price', 'SEO title', 'Stock', 'Tags'].sort());
  assert.ok(plan.updates.find((u) => u.sku === 'K5').fields.includes('Category'));
});

test('product pages: SEO title/description override, and pages of unpublished products are removed at build', () => {
  const src = read('scripts/build-product-seo.mjs');
  assert.match(src, /String\(p\.seoTitle \|\| ''\)\.trim\(\) \|\|/);
  assert.match(src, /String\(p\.seoDescription \|\| ''\)\.trim\(\) \|\|/);
  assert.match(src, /data-seo-managed="full"'\) && html\.includes\('data-product-id="' \+ m\[1\]/);
});

test('Product Manager loads Draft/Trash, every other page does not', () => {
  const html = read('product-manager.html');
  const flag = html.indexOf('window.MA_CATALOG_INCLUDE_UNPUBLISHED = true');
  const loader = html.indexOf('<script src="product-catalog-loader.js');
  assert.ok(flag > 0 && flag < loader, 'flag must be set before the catalog loader runs');
  assert.match(read('product-catalog-loader.js'), /includeUnpublished: !!window\.MA_CATALOG_INCLUDE_UNPUBLISHED/);
});

test('the real catalog survives CSV export → import unchanged (byte for byte)', () => {
  const ctx = { window: {}, console };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['product-config.js', 'product-utils.js', 'category-products.js', 'product-links-data.js', 'product-catalog-sync.js', 'product-csv.js']) vm.runInContext(read(f), ctx);
  const w = ctx.window;
  const raw = JSON.parse(JSON.stringify(w.CATEGORY_PRODUCTS));
  // Same rule as Product Manager's getCategoryTypeMeta.
  const metaFor = (k) => { const c = w.SITE_LINKS.defaults.byCategory && w.SITE_LINKS.defaults.byCategory[k]; return c && Array.isArray(c.types) && c.types.length >= 2 ? { types: c.types.slice() } : null; };
  const csv = w.MaProductCsv.exportCsv(raw, w.CATALOG_SECTIONS, { metaFor });
  const plan = w.MaProductCsv.planImport(csv, raw, w.CATALOG_SECTIONS, { today: '2026-10-24', metaFor });
  eq({ updates: plan.updates.length, created: plan.created.length, errors: plan.errors.length }, { updates: 0, created: 0, errors: 0 });
  assert.equal(JSON.stringify(plan.staged), JSON.stringify(raw));
  assert.equal(w.MaProductCsv.parseCsv(csv).length - 1, Object.values(raw).reduce((n, l) => n + l.length, 0));
});
