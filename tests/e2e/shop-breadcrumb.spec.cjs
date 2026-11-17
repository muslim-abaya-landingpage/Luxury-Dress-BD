// Category page shows one breadcrumb per layout (phones showed both the mobile and the desktop copy).
const { test, expect } = require('@playwright/test');
for (const [name, width] of [['phone', 390], ['desktop', 1280]]) {
  test('category page: exactly one visible breadcrumb on ' + name, async ({ page }) => {
    await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/abaya');
    await expect(page.locator('.shop-breadcrumb').first()).toBeAttached();
    await expect(page.locator('.shop-breadcrumb:visible')).toHaveCount(1);
  });
}
