// Product Manager — more WooCommerce parity: short description, Linked Products (upsells), Advanced → menu order,
// low-stock threshold and the Bulk Edit actions (sale % off, featured, add tags, move to category).
// Publishing is stubbed; the published category-products.js is checked.
const { test, expect } = require('@playwright/test');

async function open(page, { fail = false } = {}) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null}};' }));
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate((fail) => {
    window.__published = null;
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true,
      publish: (files) => { if (fail) return Promise.reject(new Error('offline')); window.__published = files; return Promise.resolve({ ok: true }); } });
  }, fail);
}
const productsFile = (page) => page.evaluate(() => window.__published && window.__published.find((f) => f.path === 'category-products.js').content);
const entry = (file, id) => { const i = file.indexOf('id: "' + id + '"'); const j = file.indexOf('\n    }', i); return i === -1 ? '' : file.slice(i, j); };
function answerPrompts(page, answer) { page.removeAllListeners('dialog'); page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? answer : undefined)); }

test('edit screen: short description, upsells, menu order and low-stock threshold are saved', async ({ page }) => {
  await open(page);
  const rows = page.locator('#pmAllRows tr');
  const otherSku = (await rows.nth(2).locator('.column-sku').textContent()).trim();
  await rows.first().locator('.pm-row-title').click();
  const id = await page.locator('[data-ef="id"]').inputValue();
  await page.fill('#pmShortDesc', '  Soft Dubai cherry,   ready to ship ');
  await page.click('[data-etab="inventory"]');
  await page.fill('[data-ef="stock"]', '3');
  await page.fill('[data-ef="lowStockAmount"]', '5');
  await page.click('[data-etab="linked"]');
  await page.fill('#pmUpsellInput', otherSku);
  await page.click('#pmUpsellAdd');
  await expect(page.locator('#pmUpsellList')).toContainText(otherSku);
  await page.fill('#pmUpsellInput', id); // a product cannot be its own upsell
  await page.click('#pmUpsellAdd');
  await expect(page.locator('#pmUpsellList li')).toHaveCount(1);
  await page.click('[data-etab="advanced"]');
  await page.fill('[data-ef="menuOrder"]', '-2');
  await page.click('#pmEditBarSave');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  const e = entry(await productsFile(page), id);
  expect(e).toContain('shortDescription: "Soft Dubai cherry, ready to ship"');
  expect(e).toContain('upsellIds: ["' + otherSku + '"]');
  expect(e).toContain('menuOrder: -2');
  expect(e).toContain('lowStockAmount: 5');
  await page.click('#pmEditBack');
  await expect(page.locator('#pmAllRows tr').first().locator('.column-stock')).toHaveText('Low stock (3)');
  await page.click('[data-overview-stock="low"]');
  await expect(page.locator('#pmAllRows tr')).toHaveCount(1);
});

test('bulk edit: sale % off on every option, then featured and new tags, saved at once', async ({ page }) => {
  await open(page);
  const row = page.locator('#pmAllRows tr').first(); // ABY-MAROON-1: Full Set 1250 / Abaya Only 1000
  await row.locator('.pm-overview-check').check();
  answerPrompts(page, '20');
  await page.selectOption('#pmBulkAction', 'sale');
  await page.click('#pmBulkApply');
  await expect.poll(async () => entry((await productsFile(page)) || '', 'ABY-MAROON-1')).toContain('regularPriceByType');
  let e = entry(await productsFile(page), 'ABY-MAROON-1');
  expect(e).toMatch(/"Full Set Borka, Hijab\+ Niqab": 1000/);
  expect(e).toMatch(/regularPriceByType: \{"Full Set Borka, Hijab\+ Niqab":1250,"Abaya Only":1000\}/);
  expect(e).toContain('price: 1000');
  await page.locator('#pmAllRows tr').first().locator('.pm-overview-check').check();
  answerPrompts(page, 'eid, Abaya');
  await page.selectOption('#pmBulkAction', 'tags');
  await page.click('#pmBulkApply');
  await expect.poll(async () => entry((await productsFile(page)) || '', 'ABY-MAROON-1')).toContain('"eid"');
  e = entry(await productsFile(page), 'ABY-MAROON-1');
  expect((e.match(/"Abaya"/g) || []).length).toBe(1); // no duplicate tag
  await page.locator('#pmAllRows tr').first().locator('.pm-overview-check').check();
  await page.selectOption('#pmBulkAction', 'feature');
  await page.click('#pmBulkApply');
  await expect.poll(async () => entry((await productsFile(page)) || '', 'ABY-MAROON-1')).toContain('featured: true');
});

test('bulk edit: move to another category; a failed save changes nothing', async ({ page }) => {
  await open(page, { fail: true });
  const row = page.locator('#pmAllRows tr').first();
  await row.locator('.pm-overview-check').check();
  answerPrompts(page, '3'); // third category
  await page.selectOption('#pmBulkAction', 'category');
  await page.click('#pmBulkApply');
  await expect(page.locator('#pmAllRows tr').first().locator('.column-cats')).toContainText('Abaya');
  await page.evaluate(() => { window.MaCatalogPublisher.publish = (files) => { window.__published = files; return Promise.resolve({ ok: true }); }; });
  await page.locator('#pmAllRows tr').first().locator('.pm-overview-check').check();
  await page.selectOption('#pmBulkAction', 'category');
  await page.click('#pmBulkApply');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  const file = await productsFile(page);
  const target = await page.evaluate(() => window.CATALOG_SECTIONS[2].key);
  const start = file.indexOf('"' + target + '": [') !== -1 ? file.indexOf('"' + target + '": [') : file.indexOf(target + ': [');
  expect(start).toBeGreaterThan(-1);
  expect(file.indexOf('id: "ABY-MAROON-1"')).toBeGreaterThan(start);
});
