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

test('attributes: add and remove whole attributes and single values, reorder values, custom attribute', async ({ page }) => {
  await open(page);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click(); // ABY-MAROON-1, sizes 44–56
  const id = await page.locator('[data-ef="id"]').inputValue();
  await page.click('[data-etab="attributes"]');
  const sizes = page.locator('[data-attr="sizes"] .pm-attr-values li');
  await expect(sizes).toHaveCount(7);
  await page.locator('[data-attr-del="sizes"][data-i="0"]').click(); // remove 44
  await page.locator('[data-attr-move="sizes"][data-i="0"][data-dir="1"]').click(); // 46 ↔ 48
  await page.fill('[data-attr-new="sizes"]', '58, 46');
  await page.keyboard.press('Enter'); // 46 is already there: only 58 is added
  await expect(sizes).toHaveCount(7);
  await page.selectOption('#pmAttrPick', 'sleeveSizes');
  await page.click('#pmAttrAdd');
  await page.fill('[data-attr-new="sleeveSizes"]', '22, 23');
  await page.click('[data-attr-add-val="sleeveSizes"]');
  await page.selectOption('#pmAttrPick', 'custom');
  await page.click('#pmAttrAdd');
  await page.fill('[data-attr-name="0"]', 'Work');
  await page.fill('[data-attr-new="c0"]', 'Stone, Embroidery');
  await page.click('[data-attr-add-val="c0"]');
  await page.click('#pmEditBarSave');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  let e = entry(await productsFile(page), id);
  expect(e).toContain('sizes: ["48", "46", "50", "52", "54", "56", "58"]');
  expect(e).toContain('sleeveSizes: ["22","23"]');
  expect(e).toContain('attributes: [{"name":"Work","values":["Stone","Embroidery"]}]');
  // Remove whole attributes.
  await page.click('[data-attr-remove="sleeveSizes"]');
  await page.click('[data-attr-remove="c0"]');
  await expect(page.locator('#pmAttrPick option[value="sleeveSizes"]')).toHaveCount(1);
  await page.evaluate(() => { window.__published = null; });
  await page.click('#pmEditBarSave');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  e = entry(await productsFile(page), id);
  expect(e).not.toContain('sleeveSizes');
  expect(e).not.toContain('attributes:');
});

test('product type: a simple product becomes variable and back; abaya always stays variable; picker suggests the category’s attributes', async ({ page }) => {
  await open(page);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click(); // abaya
  await expect(page.locator('#pmProductType option[value="simple"]')).toBeDisabled();
  await page.click('[data-etab="attributes"]');
  await expect(page.locator('#pmAttrPick optgroup').first()).toHaveAttribute('label', /Abaya/);
  await expect(page.locator('#pmAttrPick optgroup').first().locator('option[value="palazzoLengths"]')).toHaveCount(0);
  await page.click('#pmEditBack');
  await page.fill('#pmAllSearch', 'panjabi');
  await page.click('#pmAllSearchBtn');
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  const id = await page.locator('[data-ef="id"]').inputValue();
  const price = await page.locator('[data-ef="regular"]').inputValue();
  await page.selectOption('#pmProductType', 'variable');
  await expect(page.locator('[data-epanel="variations"]')).toBeVisible();
  await expect(page.locator('[data-ef="varRegular:Standard"]')).toHaveValue(price);
  await page.fill('[data-opt-name="Standard"]', 'M'); await page.press('[data-opt-name="Standard"]', 'Enter');
  await page.fill('#pmOptName', 'XL'); await page.fill('#pmOptPrice', '1500'); await page.click('#pmOptAdd');
  await page.click('#pmEditBarSave');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  let e = entry(await productsFile(page), id);
  expect(e).toContain('types: ["M", "XL"]');
  expect(e).toContain('"XL": 1500');
  page.removeAllListeners('dialog'); page.on('dialog', (d) => d.accept());
  await page.selectOption('#pmProductType', 'simple');
  await expect(page.locator('[data-ef="regular"]')).toHaveValue(price);
  await page.evaluate(() => { window.__published = null; });
  await page.click('#pmEditBarSave');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  e = entry(await productsFile(page), id);
  expect(e).not.toContain('types:');
  expect(e).not.toContain('priceByType');
});

function answerPromptsInOrder(page, answers) {
  const queue = answers.slice();
  page.removeAllListeners('dialog');
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? queue.shift() : undefined));
}
const listOf = (e, key) => { const m = new RegExp(key + ': (\\[[^\\]]*\\])').exec(e); return m ? JSON.parse(m[1]) : null; };

test('attributes: the category size set fills missing values in one click, without duplicates', async ({ page }) => {
  await open(page);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click(); // abaya, sizes 44–56
  const id = await page.locator('[data-ef="id"]').inputValue();
  await page.click('[data-etab="attributes"]');
  await page.locator('[data-attr-del="sizes"][data-i="0"]').click(); // remove 44
  await expect(page.locator('[data-attr="sizes"] .pm-attr-values li')).toHaveCount(6);
  await expect(page.locator('.pm-attr-preset small')).toContainText('Size 44, 46, 48, 50, 52, 54, 56');
  await page.click('#pmAttrPreset');
  await expect(page.locator('[data-attr="sizes"] .pm-attr-values li')).toHaveCount(7);
  await page.click('#pmEditBarSave');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  expect(listOf(entry(await productsFile(page), id), 'sizes')).toEqual(['46', '48', '50', '52', '54', '56', '44']);
  // Two-piece: Dress length 38/40/42 + Palazzo 38/40.
  await page.click('#pmEditBack');
  await page.selectOption('#pmOverviewCategory', 'premium-two-piece');
  await page.click('#pmFilterBtn');
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  const id2 = await page.locator('[data-ef="id"]').inputValue();
  await page.click('[data-etab="attributes"]');
  await page.click('#pmAttrPreset');
  await expect(page.locator('[data-attr="dressLengths"]')).toBeVisible();
  await page.evaluate(() => { window.__published = null; });
  await page.click('#pmEditBarSave');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  const e2 = entry(await productsFile(page), id2);
  const dress = listOf(e2, 'dressLengths');
  expect(dress).toEqual(expect.arrayContaining(['38', '40', '42']));
  expect(new Set(dress).size).toBe(dress.length); // no duplicates
  expect(listOf(e2, 'palazzoLengths')).toEqual(expect.arrayContaining(['38', '40']));
});

test('bulk edit: add and remove attribute values on many products at once', async ({ page }) => {
  await open(page);
  const rows = page.locator('#pmAllRows tr');
  const ids = [];
  for (const i of [0, 1]) {
    await rows.nth(i).locator('.pm-row-title').click();
    ids.push(await page.locator('[data-ef="id"]').inputValue());
    await page.click('#pmEditBack');
  }
  await rows.nth(0).locator('.pm-overview-check').check();
  await rows.nth(1).locator('.pm-overview-check').check();
  answerPromptsInOrder(page, ['1', '58']);
  await page.selectOption('#pmBulkAction', 'attradd');
  await page.click('#pmBulkApply');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  let file = await productsFile(page);
  for (const id of ids) {
    const s = listOf(entry(file, id), 'sizes');
    expect(s.filter((v) => v === '58')).toHaveLength(1);
  }
  await page.evaluate(() => { window.__published = null; });
  await rows.nth(0).locator('.pm-overview-check').check();
  await rows.nth(1).locator('.pm-overview-check').check();
  answerPromptsInOrder(page, ['1', '58, 44']);
  await page.selectOption('#pmBulkAction', 'attrremove');
  await page.click('#pmBulkApply');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  file = await productsFile(page);
  for (const id of ids) {
    const s = listOf(entry(file, id), 'sizes');
    expect(s).not.toContain('58');
    expect(s).not.toContain('44');
  }
});

test('admin menu: same WooCommerce-style menu on every admin page; Add New Product and Categories open from the menu', async ({ page }) => {
  const fs = require('fs');
  const pages = ['admin-dashboard', 'admin-orders', 'admin-order', 'admin-operations', 'admin-inbox', 'admin-order-new', 'product-manager', 'product-links', 'admin-links', 'stock-analytics', 'admin-staff', 'admin-growth'];
  const menus = pages.map((p) => (fs.readFileSync(p + '.html', 'utf8').match(/<nav class="adm-sidebar-nav"[\s\S]*?<\/nav>/) || [''])[0].replace(/ is-current| has-current| open| aria-current="page"/g, ''));
  menus.forEach((m, i) => { expect(m, pages[i]).toBe(menus[0]); });
  expect(menus[0]).toContain('href="product-manager.html#add-new"');
  await open(page);
  await page.goto('/product-manager.html#categories');
  await page.waitForTimeout(500);
  await expect(page).not.toHaveURL(/#categories/);
  await expect(page.locator('#pmAllRows')).toHaveCount(0); // the category screen replaced the list
});
