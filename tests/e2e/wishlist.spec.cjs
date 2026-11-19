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

test('card heart sits in the image top-right as a white circle (Anzaar style) and cards show no "In Stock"', async ({ page }) => {
  await block(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const url of ['/', '/abaya']) {
    await page.goto(url);
    const card = page.locator('article.ah-card, article.premium-card').filter({ has: page.locator('.ma-wish') }).first();
    const heart = card.locator('.ma-wish');
    await expect(heart).toBeVisible();
    const geo = await heart.evaluate((b) => {
      const host = b.parentElement.getBoundingClientRect(), r = b.getBoundingClientRect(), cs = getComputedStyle(b);
      return { top: r.top - host.top, right: host.right - r.right, bottomGap: host.bottom - r.bottom, radius: cs.borderRadius, bg: cs.backgroundColor, w: r.width };
    });
    expect(geo.top).toBeLessThan(20);
    expect(geo.right).toBeLessThan(20);
    expect(geo.bottomGap).toBeGreaterThan(100);
    expect(geo.radius).toBe('50%');
    expect(geo.bg).toBe('rgb(255, 255, 255)');
    expect(geo.w).toBe(30);
    await heart.hover();
    await expect.poll(() => heart.evaluate((b) => getComputedStyle(b, '::after').opacity)).toBe('1');
    expect(await heart.evaluate((b) => getComputedStyle(b, '::after').content)).toBe('"Wishlist"');
    const cardsText = await page.locator('article.ah-card, article.premium-card').evaluateAll((els) => els.map((e) => e.innerText).join('\n'));
    expect(cardsText).not.toMatch(/In Stock/i);
    await expect(page.locator('article .product-instock-badge')).toHaveCount(0);
  }
});
