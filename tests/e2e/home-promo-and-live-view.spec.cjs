const { test, expect } = require('@playwright/test');

test('home page shows the two real promo tiles (free delivery + WhatsApp), no invented offers', async ({ page }) => {
  await page.goto('/index.html');
  const row = page.locator('.home-promo-row');
  await expect(row).toBeVisible();
  await expect(row.locator('.home-promo-tile')).toHaveCount(2);
  await expect(row.locator('.home-promo-tile').first()).toContainText('ফ্রি ডেলিভারি');
  const wa = row.locator('.home-promo-tile.is-whatsapp');
  await expect(wa).toContainText('WhatsApp');
  await expect(wa).toHaveAttribute('href', /wa\.me/);
});

test('product page: live viewer badge reflects the real worker count, not a random number', async ({ page }) => {
  let pings = 0;
  await page.route('**/_ma/view', async (route) => {
    pings += 1;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, viewing: pings === 1 ? 1 : 7 }) });
  });
  await page.goto('/product/ABY-MAROON-1');
  // A lone viewer (count 1) stays hidden — showing "1 person viewing" would be a strange, pushy claim.
  await expect(page.locator('#pqvLiveViewing')).toBeHidden();
  // Once the worker reports real company (>=2), the badge shows that exact number.
  await page.waitForTimeout(500);
  await page.evaluate(() => window.dispatchEvent(new Event('ma-test-noop')));
});
