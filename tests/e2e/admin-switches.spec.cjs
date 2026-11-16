// Admin: on/off settings are shown as switches (role=switch); row/category pick boxes stay checkboxes.
const { test, expect } = require('@playwright/test');
async function stub(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null}};' }));
}
test('product edit: Virtual / Downloadable / Track stock / Sold individually / Reviews / Featured are switches that still work', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await expect(page.locator('#pmAllRows tr').first()).toBeVisible();
  expect(await page.evaluate(() => document.querySelectorAll('.pm-wp-list input[type=checkbox].ma-switch-pill').length)).toBe(0); // row pick boxes stay checkboxes
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  await expect(page.locator('.pm-wp-edit .pm-wp-title')).toHaveText('Edit product');
  for (const ef of ['virtual', 'downloadable', 'manageStock', 'soldIndividually', 'reviewsAllowed', 'featured']) {
    await expect(page.locator('input[data-ef="' + ef + '"]')).toHaveAttribute('role', 'switch');
  }
  await expect(page.locator('input[data-cat-check]').first()).not.toHaveAttribute('role', 'switch');
  await page.getByText('Inventory', { exact: true }).first().click();
  const sw = page.locator('#pmManageStock');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).not.toBeChecked();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByText('Stock status', { exact: true })).toBeVisible(); // the page's own logic still ran
  await sw.focus(); await page.keyboard.press('Space');
  await expect(sw).toBeChecked();
  const look = await sw.evaluate((el) => { const s = getComputedStyle(el); return { w: s.width, appearance: s.appearance, bg: s.backgroundColor }; });
  expect(look.w).toBe('38px'); expect(look.appearance).toBe('none'); expect(look.bg).toBe('rgb(0, 163, 42)');
});
