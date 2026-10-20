const { test, expect } = require('@playwright/test');

test('size finder suggests and selects an abaya length on a product page', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/product/ABY-BLACK-1.html');
  const btn = page.locator('.sf-btn').first();
  await expect(btn).toBeVisible({ timeout: 15000 });
  await btn.click();
  await page.locator('[data-sf="length"]').first().fill('53.5');
  const out = page.locator('.sf-out').first();
  await expect(out).toContainText('54');
  await page.locator('.sf-go').first().click();
  await expect(page.locator('.pqv-length-opt.is-active').first()).toHaveAttribute('data-length-value', '54');
  await page.locator('[data-sf="length"]').first().fill('70');
  await expect(out).toContainText('সবচেয়ে বড় সাইজের চেয়েও বেশি');
  await page.locator('.sf-box').first().screenshot({ path: 'test-results/size-finder.png' });
  expect(errors).toEqual([]);
});
