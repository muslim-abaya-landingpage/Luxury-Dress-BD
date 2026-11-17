// Wishlist (♥): hearts on shop/home cards and the product page, saved in the browser, counted in the bottom bar,
// listed on /wishlist with remove.
const { test, expect } = require('@playwright/test');
const block = (page) => page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));

test('heart on a category card saves the product; bottom bar shows the count; /wishlist lists it and can remove it', async ({ page }) => {
  await block(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/abaya');
  const heart = page.locator('#productGrid .premium-card .ma-wish').first();
  await expect(heart).toBeVisible();
  const id = await heart.getAttribute('data-wish-id');
  expect(id).toBeTruthy();
  await expect(page).toHaveURL(/\/abaya/);
  await heart.click();
  await expect(heart).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/\/abaya/); // the heart does not open the product
  await expect(page.locator('#mbn-wish-count')).toHaveText('1');
  await expect(page.locator('#maWishNote')).toContainText('পছন্দের তালিকায় রাখা হয়েছে');

  await page.locator('#mobile-bottom-nav [data-mbn-route="wishlist"]').click();
  await expect(page).toHaveURL(/\/wishlist/);
  const card = page.locator('.wl-card');
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute('data-pid', id);
  await expect(card.locator('.wl-name')).toHaveAttribute('href', '/product/' + encodeURIComponent(id));
  const radius = await card.evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).toBe('0px');
  await card.locator('.wl-remove').click();
  await expect(page.locator('.wl-card')).toHaveCount(0);
  await expect(page.locator('#wlEmpty')).toBeVisible();
  await expect(page.locator('#mbn-wish-count')).toBeHidden();
});

test('product page has a "পছন্দের তালিকায় রাখুন" button that stays in step with the cards', async ({ page }) => {
  await block(page);
  await page.goto('/product/ABY-MAROON-1');
  const btn = page.locator('.ma-wish-inline');
  await expect(btn).toContainText('পছন্দের তালিকায় রাখুন');
  await btn.click();
  await expect(btn).toContainText('পছন্দের তালিকায় আছে');
  expect(await page.evaluate(() => window.maWishlist.list())).toEqual(['ABY-MAROON-1']);
  await page.goto('/');
  const homeHeart = page.locator('article.ah-card[data-pid="ABY-MAROON-1"] .ma-wish').first();
  await expect(homeHeart).toHaveAttribute('aria-pressed', 'true');
});
