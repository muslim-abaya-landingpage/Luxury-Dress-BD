// The size written on an order must match what the product page shows. A free-size two-piece (no length
// choice on the page) once went to checkout as "Length 50" — an abaya length — instead of 37-38 inch.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|clarity\.ms|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
});

for (const id of ['DR-02', 'DR-03']) {
  test(id + ': Buy Now sends the length shown on the page (37-38 inch), never the abaya length 50', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/product/' + id);
    await expect(page.getByText('37-38 inch').first()).toBeVisible();
    await page.locator('[data-action="buy-now"]:visible, #pdBuyNow:visible').first().click();
    const size = page.locator('.ma-cop').getByText(/সাইজ:/).first();
    await expect(size).toContainText('Length 37-38 inch');
    await expect(size).not.toContainText('Length 50');
  });
}

test('abaya: Buy Now still sends the chosen abaya length', async ({ page }) => {
  await page.goto('/product/ABY-MAROON-1');
  await page.locator('[data-action="buy-now"]:visible, #pdBuyNow:visible').first().click();
  await expect(page.locator('.ma-cop').getByText(/সাইজ:/).first()).toContainText(/Length \d\d/);
});

test('order form: the total says it has no delivery charge until a district is chosen', async ({ page }) => {
  await page.goto('/product/DR-02');
  await page.locator('[data-action="buy-now"]:visible, #pdBuyNow:visible').first().click();
  const label = page.locator('.ma-cop [data-cop-totallabel]');
  await expect(label).toHaveText('সর্বমোট (ডেলিভারি চার্জ ছাড়া)');
  await page.selectOption('#ma-cop-district', { index: 1 });
  await expect(label).toHaveText('সর্বমোট');
  await expect(page.locator('.ma-cop [data-cop-fee]')).toContainText('৳');
});

test('product page order button is in Bangla, like the product cards', async ({ page }) => {
  await page.goto('/product/DR-02');
  await expect(page.locator('[data-action="buy-now"]:visible, #pdBuyNow:visible').first()).toContainText('অর্ডার করুন');
});
