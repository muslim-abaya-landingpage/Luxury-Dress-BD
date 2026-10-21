const { test, expect } = require('@playwright/test');

async function stub(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null}};' }));
}

test('product list looks like WordPress Products and shows dates from the catalog', async ({ page }) => {
  await stub(page);
  await page.goto('/product-manager.html');
  await expect(page.locator('.pm-wp-title')).toHaveText('Products');
  await expect(page.locator('#pmAllRows tr')).toHaveCount(20);
  for (const head of ['Name', 'SKU', 'Stock', 'Price', 'Categories', 'Tags', 'Date']) await expect(page.locator('.pm-wp-table thead')).toContainText(head);
  await expect(page.locator('#pmAllRows tr').first().locator('.column-date')).toContainText(/Published\s*\w{3} \d{1,2}, 20\d\d/);
  await expect(page.locator('#pmPagerTop')).toContainText('items');
});

test('edit screen: name, description, product data tabs, tags, brand, featured, category', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  await expect(page.locator('.pm-wp-edit .pm-wp-title')).toHaveText('Edit product');
  await expect(page.locator('.pm-wp-name')).toHaveValue('Maroon Abaya Set');
  for (const box of ['Publish', 'Product categories', 'Product tags', 'Product brand', 'Product image', 'Product gallery', 'Product description']) await expect(page.locator('.pm-wp-box-title', { hasText: box }).first()).toBeVisible();
  await page.click('[data-etab="inventory"]');
  await expect(page.locator('[data-epanel="inventory"]')).toBeVisible();
  await expect(page.locator('[data-epanel="general"]')).toBeHidden();
  await page.fill('#pmEditTagInput', 'eid, black abaya');
  await page.press('#pmEditTagInput', 'Enter');
  await expect(page.locator('.pm-wp-tags li')).toHaveCount(2);
  await page.fill('[data-ef="brand"]', 'Muslim Abaya');
  await page.check('[data-ef="featured"]');
  await page.fill('[data-ef="detailNote"]', 'Dubai cherry fabric, full set');
  await expect(page.locator('#pmEditNote')).toHaveClass(/is-dirty/);
  await page.click('#pmEditBack');
  const first = page.locator('#pmAllRows tr').first();
  await expect(first.locator('.column-tags')).toContainText('eid');
  await expect(first.locator('.column-brand')).toContainText('Muslim Abaya');
  await expect(first.locator('.pm-star')).toHaveAttribute('aria-pressed', 'true');
  // tag link filters the list
  await first.locator('.column-tags .pm-row-link', { hasText: 'eid' }).click();
  await expect(page.locator('#pmAllRows tr')).toHaveCount(1);
});
