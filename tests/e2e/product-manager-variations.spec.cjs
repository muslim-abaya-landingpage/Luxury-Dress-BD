// Product Manager → Edit product: WooCommerce-style product type, Attributes and Variations panels.
const { test, expect } = require('@playwright/test');

async function stub(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: 'window.__stockCommits=[];window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null},' +
      'getStockVariants:function(){return Promise.resolve({ok:true,items:[{productId:"ABY-MAROON-1",variant:"Length 54",tracked:true,available:7}]})},' +
      'commitStockCsv:function(rows){window.__stockCommits.push(rows);return Promise.resolve({ok:true,applied:rows.length,skipped:0})}};'
  }));
}

async function openMaroon(page, answers) {
  await stub(page);
  page.on('dialog', (d) => {
    const m = d.message();
    const hit = Object.keys(answers || {}).find((k) => m.indexOf(k) !== -1);
    d.accept(hit ? answers[hit] : undefined);
  });
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true, publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } }); });
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  await expect(page.locator('.pm-wp-name')).toHaveValue('Maroon Abaya Set');
}

async function publishedBlock(page) {
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const start = file.indexOf('"ABY-MAROON-1"');
  return file.slice(start, file.indexOf('\n    }', start));
}

test('product type, attributes with "Used for variations", generate, edit variation cards and publish', async ({ page }) => {
  await openMaroon(page, { 'regular prices by': '10%' });
  // Simple product: no Variations tab, like WooCommerce.
  await expect(page.locator('#pmProductType')).toHaveValue('simple');
  await expect(page.locator('[data-etab="variations"]')).toHaveCount(0);
  await page.selectOption('#pmProductType', 'variable');
  await expect(page.locator('[data-etab="variations"]')).toBeVisible();
  await expect(page.locator('[data-epanel="attributes"]')).toBeVisible();

  // Attributes: one box per attribute; Long values edited with "|", Option not used for variations.
  const mount = page.locator('#pmAttrMount');
  await expect(mount.locator('.pmw-box-head b')).toHaveText(['Option', 'Color', 'Body', 'Long']);
  await expect(mount.locator('[data-pa="used"][data-id="body"]')).not.toBeChecked();
  await expect(mount.locator('[data-pa="used"][data-id="length"]')).toBeChecked();
  await mount.locator('[data-pa="values"][data-id="length"]').fill('50 | 52 | 54 | 56');
  await mount.locator('[data-pa="used"][data-id="type"]').uncheck();
  await mount.locator('[data-pa="save"]').click();
  await expect(page.locator('[data-ef="sizes"]')).toHaveValue('50, 52, 54, 56');

  // Variations: generate one per Long value (4), WooCommerce cards.
  await page.click('[data-etab="variations"]');
  const vars = page.locator('[data-epanel="variations"] .pmw-var');
  await expect(page.locator('.pmw-empty')).toContainText('Long');
  await page.click('[data-pv="generate"]');
  await expect(vars).toHaveCount(4);
  await expect(vars.nth(0).locator('.pmw-id')).toHaveText('#1');
  await expect(vars.nth(0).locator('[data-pv="attr"]')).toHaveValue('Length 50');
  await expect(vars.nth(0).locator('[data-pv="attr"] option').first()).toHaveText('Any Long…');

  await vars.nth(0).locator('[data-pv="edit"]').click();
  const c1 = vars.nth(0);
  await c1.locator('[data-pv="regular"]').fill('1800');
  await c1.locator('[data-pv="regular"]').blur();
  await c1.locator('[data-pv="sale"]').fill('1650');
  await c1.locator('[data-pv="sale"]').blur();
  await c1.locator('[data-pv="picker"]').click();
  await c1.locator('[data-pv="pick"]').first().click();
  await expect(c1.locator('.pmw-img img')).toBeVisible();

  await vars.nth(1).locator('[data-pv="edit"]').click();
  await vars.nth(1).locator('[data-pv="enabled"]').uncheck();
  await expect(vars.nth(1)).toHaveClass(/is-off/);

  // Counted stock loads into Manage stock; another variation can switch to Out of stock.
  await vars.nth(2).locator('[data-pv="edit"]').click();
  await expect(vars.nth(2).locator('[data-pv="manage"]')).toBeChecked();
  await expect(vars.nth(2).locator('[data-pv="stock"]')).toHaveValue('7');
  await vars.nth(3).locator('[data-pv="edit"]').click();
  await vars.nth(3).locator('[data-pv="status"]').selectOption('outofstock');
  await expect(vars.nth(3).locator('.pmw-var-head')).toContainText('Out of stock');
  await vars.nth(3).locator('[data-pv="manage"]').check();
  await vars.nth(3).locator('[data-pv="stock"]').fill('5');

  // Bulk: increase regular prices by 10% (the first variation 1800 → 1980, keeping its 1650 sale).
  await page.selectOption('[data-pv="bulk"]', 'regular-up');
  await expect(vars.nth(0).locator('[data-pv="regular"]')).toHaveValue('1980');
  await expect(vars.nth(0).locator('[data-pv="sale"]')).toHaveValue('1650');

  await page.click('#pmEditBarSave');
  const block = await publishedBlock(page);
  await expect(page.locator('#pmEditNote')).toContainText('Stock saved for 1');
  expect(block).toContain('variations: [');
  expect(block).toMatch(/"size":"Length 50"[^}]*"price":1650,"regularPrice":1980/);
  expect(block).toMatch(/"size":"Length 52"[^}]*"enabled":false/);
  expect(block).toMatch(/"size":"Length 56"[^}]*"stockStatus":"outofstock"/);
  expect(block).toContain('variationAttributes: ["length"]');
  expect(block).toContain('productType: "variable"');
  const commits = await page.evaluate(() => window.__stockCommits);
  expect(commits).toEqual([[{ productId: 'ABY-MAROON-1', productName: 'Maroon Abaya Set', category: 'abaya', variant: 'Length 56', qty: 5, reason: 'Product Manager variations' }]]);
});

test('Add manually, remove, and switching back to a simple product removes the variations', async ({ page }) => {
  await openMaroon(page);
  await page.selectOption('#pmProductType', 'variable');
  await page.click('[data-etab="variations"]');
  await page.click('[data-pv="generate"]');
  const vars = page.locator('[data-epanel="variations"] .pmw-var');
  await expect(vars).toHaveCount(14); // 2 options × 7 lengths (Body is off for abaya)
  await vars.nth(0).locator('[data-pv="del"]').click();
  await expect(vars).toHaveCount(13);
  await page.click('[data-pv="add"]');
  await expect(vars).toHaveCount(14);
  await expect(vars.nth(13).locator('[data-pv="attr"]').first()).toHaveValue('');
  await page.selectOption('#pmProductType', 'simple');
  await expect(page.locator('[data-etab="variations"]')).toHaveCount(0);
  await page.click('#pmEditBarSave');
  const block = await publishedBlock(page);
  expect(block).not.toContain('variations');
});

test('ticks changed on Attributes are kept when opening Variations without pressing Save attributes', async ({ page }) => {
  await openMaroon(page);
  await page.selectOption('#pmProductType', 'variable');
  const mount = page.locator('#pmAttrMount');
  await mount.locator('[data-pa="used"][data-id="type"]').uncheck();
  await mount.locator('[data-pa="values"][data-id="length"]').fill('50 | 52');
  await page.click('[data-etab="variations"]');
  await expect(page.locator('[data-epanel="variations"]')).toBeVisible();
  await expect(page.locator('#pmEditNote')).toContainText('Attributes saved automatically');
  await page.click('[data-pv="generate"]');
  await expect(page.locator('[data-epanel="variations"] .pmw-var')).toHaveCount(2); // Long 50, 52 only
});
