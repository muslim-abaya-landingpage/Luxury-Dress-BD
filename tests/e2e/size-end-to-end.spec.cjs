// Size Manager end to end (Stage 6): owner switches abaya on in D1 and publishes → the live middleware attaches
// the config to product-config.js → the customer picks measurements on the product page → checkout changes one
// → the cart line the checkout sends is priced by the Apps Script order check, which rebuilds the size text →
// that text finds the product's existing per-size stock row. Then the owner rolls back and the old pickers return.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DatabaseSync } = require('node:sqlite');

const root = path.join(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const NOW = Date.UTC(2026, 9, 30, 9, 0, 0);

function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => { const r = db.prepare(sql).get(...args); return r ? Object.assign({}, r) : null; },
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => Object.assign({}, r)) }),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    _run() { db.prepare(sql).run(...args); },
  });
  const d1 = { prepare: (sql) => stmt(sql), batch: async (list) => { db.exec('BEGIN'); try { list.forEach((s) => s._run()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return []; } };
  ['0001_size_manager.sql', '0002_size_manager_seed.sql'].forEach((f) => db.exec(read('migrations/d1/' + f)));
  return d1;
}

/** product-config.js exactly as the live middleware would serve it from this D1. */
async function servedProductConfig(d1) {
  const { serveLiveFile } = await import(path.join(root, 'functions/_lib/live-catalog.js'));
  const env = { STOCK_DB: d1, ASSETS: { fetch: async (req) => {
    const p = new URL(req.url).pathname.replace(/^\//, '');
    return p === 'product-config.js' ? new Response(read('product-config.js'), { headers: { ETag: '"s"' } }) : new Response('{}');
  } } };
  const res = await serveLiveFile(new Request('https://muslimabaya.com/product-config.js?v=1'), env, 'product-config.js', { cache: null });
  return { body: await res.text(), version: res.headers.get('X-MA-Size') };
}

const cartLines = (page) => page.evaluate(() => window.loadStoreCart({ readOnly: true }));

test('owner publishes abaya → customer orders with measurements → order check and stock agree; rollback restores', async ({ page }) => {
  const store = await import(path.join(root, 'functions/_lib/size-store.js'));
  const d1 = fakeD1();
  await store.saveCategory(d1, { category_key: 'abaya', template_id: 'abaya', enabled: true }, { now: NOW, actor: 'owner@test' });
  const published = await store.publish(d1, { now: NOW + 1, actor: 'owner@test', note: 'abaya on' });
  let served = await servedProductConfig(d1);
  expect(served.version).toBe(String(published));

  await page.route(/\/product-config\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: served.body }));
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));

  // Customer: product page.
  await page.goto('/product/ABY-MAROON-1');
  const fields = page.locator('.ma-sz .ma-sz-field');
  await expect(fields).toHaveCount(2);
  await fields.nth(0).locator('[data-sz-value]', { hasText: '44' }).click();
  await fields.nth(1).locator('[data-sz-value]', { hasText: '52' }).click();
  await page.locator('button[data-action="add"]').first().click();
  // Checkout: change the length.
  await page.goto('/checkout');
  await page.locator('#orderSummary select[data-sz-key="length"]').selectOption('54');
  await expect.poll(async () => (await cartLines(page))[0].size).toBe('Body 44 · Length 54');

  // What checkout.html sends as CartJSON for this line.
  const line = (await cartLines(page))[0];
  const sent = { id: line.id, name: line.name, qty: line.quantity, price: line.price, size: line.size, productType: line.productType || '',
    category: line.category, measurements: line.measurements.map((m) => ({ key: m.key, value: m.value })) };

  // Apps Script order check with the same published config (what /api/size-config returns).
  const active = (await store.readActive(d1));
  const gs = { console, Date, JSON, Number, String, Math, Array, Object, Error, isFinite,
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ ok: true, version: active.version, config: active.config }) }) } };
  vm.createContext(gs);
  vm.runInContext(read('apps-script/SizeCore.gs'), gs);
  vm.runInContext(read('apps-script/Operations.gs'), gs);
  const product = JSON.parse(read('catalog-validation.json')).products.find((p) => p.id === 'ABY-MAROON-1');
  const item = JSON.parse(JSON.stringify(sent));
  item.size = 'tampered by the browser';
  const total = gs.opsLinePrice_(item, JSON.parse(JSON.stringify(product)));
  expect(total).toBe(line.price * line.quantity);
  expect(item.size).toBe('Body 44 · Length 54');
  expect(item.sizeConfigVersion).toBe(active.version);

  // Stock: the existing per-size row written by the old pickers is the one this order reserves.
  const core = { console, Date, JSON, Number, String, Math, Array, Object, Error, isFinite, parseInt, parseFloat, RegExp };
  vm.createContext(core);
  vm.runInContext(read('apps-script/Code.gs'), core); // stock helpers only: no Google service is called here
  const reqs = core.stockRequirementsForCart_([item]);
  expect(reqs.map((r) => [r.productId, r.variant, r.qty])).toEqual([['ABY-MAROON-1', 'Body 44 · Length 54', line.quantity]]);
  const rows = [['Product ID', 'Name', 'Category', 'Variant'], ['ABY-MAROON-1', 'Maroon', 'abaya', 'Body 44 · Length 54']];
  expect(core.findStockVariantRowIndex_(rows, 'ABY-MAROON-1', reqs[0].variant)).toBe(2);

  // Owner rolls back to version 1 (everything off): the shop is back to the old pickers, byte-for-byte config.
  await store.rollback(d1, { version: 1, now: NOW + 2, actor: 'owner@test' });
  served = await servedProductConfig(d1);
  expect(served.body).toBe(read('product-config.js'));
  await page.goto('/product/ABY-MAROON-1');
  await expect(page.locator('.pqv-length-opt').first()).toBeVisible();
  await expect(page.locator('.ma-sz')).toHaveCount(0);
});
