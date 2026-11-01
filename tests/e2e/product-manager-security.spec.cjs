const { test, expect } = require('@playwright/test');

async function open(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};'
  }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: 'window.MaAdmin={getSession:function(){return {token:"test",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null}};'
  }));
  await page.goto('/product-manager.html');
}

test('category labels render as text and generated keys remain URL-safe', async ({ page }) => {
  await open(page);
  await page.click('#pmManageCats');
  const payload = '<img src=x onerror="window.__pmCategoryXss=1">';
  await page.click('#pmAddCategory');
  await page.fill('#pmCatMenu', payload);

  await expect(page.locator('#pmCatKey')).toHaveAttribute('readonly', '');
  await expect(page.locator('#pmCatKey')).toHaveValue(/^[a-z0-9_-]+$/i);
  await page.click('#pmCatSave');

  const category = page.locator('#pmCatList .pm-cat-btn').filter({ hasText: payload });
  await expect(category).toHaveCount(1);
  await expect(category.locator('img')).toHaveCount(0);
  await expect(page.locator('#pmMain h2 img')).toHaveCount(0);
  expect(await page.evaluate(() => window.__pmCategoryXss)).toBeUndefined();
  expect(await page.locator('#pmMain h2').textContent()).toContain(payload);
  await expect(page.locator('#pmMain .pl-section-meta')).toContainText(/\/category\?category=[a-z0-9-]+$/);
});
