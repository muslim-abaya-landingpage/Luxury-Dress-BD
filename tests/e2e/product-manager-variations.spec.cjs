// Product Manager → Edit product → Variations tab (WooCommerce-style variable products).
const { test, expect } = require('@playwright/test');

async function stub(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: 'window.__stockCommits=[];window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null},' +
      'getStockVariants:function(){return Promise.resolve({ok:true,items:[{productId:"ABY-MAROON-1",variant:"Body 42 · Length 50",tracked:true,available:7}]})},' +
      'commitStockCsv:function(rows){window.__stockCommits.push(rows);return Promise.resolve({ok:true,applied:rows.length,skipped:0})}};'
  }));
}

async function openMaroon(page) {
  await stub(page);
  page.on('dialog', (d) => d.accept(d.message().indexOf('Regular price') === 0 ? '1600' : undefined));
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true, publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } }); });
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  await expect(page.locator('.pm-wp-name')).toHaveValue('Maroon Abaya Set');
  await page.click('[data-etab="variations"]');
  await expect(page.locator('[data-epanel="variations"] .pmv')).toBeVisible();
}

test('generate variations, set prices / sale / off, bulk price, and publish them', async ({ page }) => {
  await openMaroon(page);
  await expect(page.locator('.pmv-empty')).toContainText('No variations yet');
  await page.click('[data-pmv-act="generate"]');
  // 2 options × 3 body sizes × 7 lengths
  const rows = page.locator('.pmv tbody tr');
  await expect(rows).toHaveCount(42);
  await expect(page.locator('.pmv-count')).toHaveText('42 variations');
  await expect(page.locator('#pmEditNote')).toHaveClass(/is-dirty/);
  // Stock loaded from the stock panel lands on the matching colour·size row.
  await expect(page.locator('[data-pmv-stock="Body 42 · Length 50"]')).toHaveValue('7');

  const first = rows.first();
  await first.locator('[data-pmv="regular"]').fill('1800');
  await first.locator('[data-pmv="regular"]').blur();
  await first.locator('[data-pmv="sale"]').fill('1650');
  await first.locator('[data-pmv="sale"]').blur();
  await rows.nth(1).locator('[data-pmv="enabled"]').uncheck();
  await expect(rows.nth(1)).toHaveClass(/is-off/);

  // Bulk: regular price for all (dialog answers 1600); a sale price that is no longer below it is dropped.
  await page.selectOption('[data-pmv-bulk]', 'regular');
  await page.click('[data-pmv-act="bulk"]');
  await expect(rows.nth(5).locator('[data-pmv="regular"]')).toHaveValue('1600');
  await expect(rows.first().locator('[data-pmv="sale"]')).toHaveValue('');
  await rows.first().locator('[data-pmv="sale"]').fill('1500');
  await rows.first().locator('[data-pmv="sale"]').blur();
  await expect(rows.first().locator('[data-pmv="sale"]')).toHaveValue('1500');

  // Generating again keeps the edited rows and adds nothing.
  await page.click('[data-pmv-act="generate"]');
  await expect(rows).toHaveCount(42);
  await expect(page.locator('[data-pmv-msg]')).toContainText('already exist');

  await page.click('#pmEditBarSave');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const start = file.indexOf('"ABY-MAROON-1"');
  const block = file.slice(start, file.indexOf('\n    }', start));
  expect(block).toContain('variations: [');
  expect(block).toMatch(/"size":"Body 42 · Length 44"[^}]*"price":1500,"regularPrice":1600/);
  expect(block).toMatch(/"enabled":false/);
  expect(block).toMatch(/"sku":"ABY-MAROON-1-/);
});

test('stock edits are saved to the stock panel; delete-all brings the product back to simple pricing', async ({ page }) => {
  await openMaroon(page);
  await page.click('[data-pmv-act="generate"]');
  const input = page.locator('[data-pmv-stock="Body 44 · Length 52"]');
  await input.fill('3');
  await page.click('[data-pmv-act="stock"]');
  await expect(page.locator('[data-pmv-stockmsg]')).toContainText('Stock saved for 1');
  const commits = await page.evaluate(() => window.__stockCommits);
  expect(commits).toEqual([[{ productId: 'ABY-MAROON-1', productName: 'Maroon Abaya Set', category: 'abaya', variant: 'Body 44 · Length 52', qty: 3, reason: 'Product Manager variations' }]]);
  await page.selectOption('[data-pmv-bulk]', 'delete');
  await page.click('[data-pmv-act="bulk"]');
  await expect(page.locator('.pmv tbody tr')).toHaveCount(0);
  await expect(page.locator('.pmv-empty')).toBeVisible();
});
