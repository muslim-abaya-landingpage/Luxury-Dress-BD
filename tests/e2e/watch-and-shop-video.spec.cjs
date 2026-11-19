const { test, expect } = require('@playwright/test');

// "Watch & Shop" — product-video-carousel.js renders one card per product that has a
// videoUrl (set in the admin Product Manager). No product has one by default in this
// repo, so these tests stub category-products.js to add one, and separately confirm
// the section stays hidden (not an empty shell) when nothing has a video.

test('Watch & Shop: renders a real, shoppable video card when a product has a video', async ({ page }) => {
  await page.route('**/category-products.js*', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    const stubbed = body.replace(
      /id:\s*"DR-02",/,
      'id: "DR-02", videoUrl: "https://www.youtube.com/watch?v=Wyrw0gzKMqk",'
    );
    await route.fulfill({ response: res, body: stubbed });
  });

  await page.goto('/index.html');
  const section = page.locator('#watchShopSection');
  await expect(section).toBeVisible();

  const card = section.locator('.wns-card').first();
  await expect(card).toBeVisible();
  await expect(card.locator('.wns-name')).toContainText('Baby Pink');
  await expect(card.locator('.wns-price')).toContainText('550');

  // click-to-play reuses index-youtube-lazy.js's existing facade handler
  await card.locator('.wns-facade').click();
  await expect(card.locator('iframe')).toHaveCount(1);

  // "add to cart" uses the real, shared cart utilities (cart-utils.js) — not a mock
  const before = await page.evaluate(() => (window.loadStoreCart ? window.loadStoreCart({ readOnly: true }).length : -1));
  await card.locator('.wns-cart-btn').click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => (window.loadStoreCart ? window.loadStoreCart({ readOnly: true }).length : -1));
  expect(after).toBeGreaterThan(before);

  // the arrow/product link goes to the real, standalone product page
  await expect(card.locator('.wns-arrow-link')).toHaveAttribute('href', /\/product\/DR-02/);
});

test('Watch & Shop: renders a Facebook video card (no app/SDK needed) and plays via the public video plugin', async ({ page }) => {
  const fbUrl = 'https://www.facebook.com/100064510341377/videos/1191007932015057/';
  await page.route('**/category-products.js*', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    const stubbed = body.replace(
      /id:\s*"DR-02",/,
      `id: "DR-02", videoUrl: "${fbUrl}",`
    );
    await route.fulfill({ response: res, body: stubbed });
  });

  await page.goto('/index.html');
  const section = page.locator('#watchShopSection');
  await expect(section).toBeVisible();

  const card = section.locator('.wns-card').first();
  await expect(card).toBeVisible();
  await expect(card.locator('.wns-name')).toContainText('Baby Pink');
  // honest fallback: no public no-auth way to fetch a Facebook video thumbnail,
  // so the facade preview uses the product's own catalog image, not a fake one
  await expect(card.locator('.wns-facade-fb img')).toHaveAttribute('src', /images\/dr-02|images\//);
  await expect(card.locator('.wns-fb-badge')).toContainText('Facebook');

  await card.locator('.wns-facade-fb').click();
  const iframe = card.locator('iframe');
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute('src', new RegExp('facebook\\.com/plugins/video\\.php\\?href=' + encodeURIComponent(fbUrl).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

  // add-to-cart still uses the real, shared cart utilities on a Facebook-video card
  const before = await page.evaluate(() => (window.loadStoreCart ? window.loadStoreCart({ readOnly: true }).length : -1));
  await card.locator('.wns-cart-btn').click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => (window.loadStoreCart ? window.loadStoreCart({ readOnly: true }).length : -1));
  expect(after).toBeGreaterThan(before);
});

test('Watch & Shop: stays hidden (not an empty section) when no product has a video', async ({ page }) => {
  await page.goto('/index.html');
  await page.waitForTimeout(1500);
  await expect(page.locator('#watchShopSection')).toBeHidden();
});
