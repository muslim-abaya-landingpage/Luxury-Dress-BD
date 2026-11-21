// Top of the homepage: "Muslim Abaya" intro (with Arabic), the 12 newest products as a card deck with a
// numbered list, arrows + 01 / 12 counter, and the two offer strips (free delivery, track order).
const { test, expect } = require('@playwright/test');

async function open(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|clarity|images\.muslimabaya\.com/, (r) => r.abort());
  await page.goto('/');
  await expect(page.locator('#msBoard')).toHaveClass(/is-ready/);
}

test('intro, 12 newest products, counter and list stay in step', async ({ page }) => {
  await open(page, 1280);
  await expect(page.locator('h1.ms-big')).toHaveText('Muslim Abaya');
  await expect(page.locator('.ms-intro-slide.is-active .ms-ar')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('#homeHero')).toHaveCount(0); // the old full-width banner is gone
  const n = await page.locator('.ms-card').count();
  expect(n).toBe(12);
  await expect(page.locator('.ms-li')).toHaveCount(12);
  // newest first (dateAdded), out-of-stock products left out
  const order = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('.ms-card')].map((a) => a.getAttribute('href').split('/product/')[1]);
    const all = [].concat(...Object.values(window.CATEGORY_PRODUCTS));
    const t = (id) => Date.parse((all.find((p) => encodeURIComponent(p.id) === id) || {}).dateAdded || '') || 0;
    return ids.map(t);
  });
  for (let i = 1; i < order.length; i++) expect(order[i - 1]).toBeGreaterThanOrEqual(order[i]);
  await expect(page.locator('.ms-count')).toHaveText('01 / 12');
  await expect(page.locator('.ms-card.is-active')).toHaveAttribute('data-i', '0');
  await page.click('.ms-arrow[data-ms-go="1"]');
  await expect(page.locator('.ms-count')).toHaveText('02 / 12');
  await expect(page.locator('.ms-li.is-active')).toHaveAttribute('data-i', '1');
  await page.click('.ms-arrow[data-ms-go="-1"]');
  await page.click('.ms-arrow[data-ms-go="-1"]');
  await expect(page.locator('.ms-count')).toHaveText('12 / 12'); // wraps round
  await page.locator('.ms-li[data-i="4"]').click();
  await expect(page.locator('.ms-count')).toHaveText('05 / 12');
  await expect(page.locator('.ms-card.is-active')).toHaveAttribute('data-i', '4');
  // flat corners on the cards and strips
  expect(await page.locator('.ms-card').first().evaluate((e) => getComputedStyle(e).borderRadius)).toBe('0px');
  await expect(page.locator('.ms-story .home-promo-tile')).toHaveCount(2);
  await expect(page.locator('.ms-story .home-promo-tile').nth(0)).toContainText(/free delivery/i);
  await expect(page.locator('.ms-story .home-promo-tile').nth(1)).toHaveAttribute('href', '/order-track');
});

test('clicking the front card opens its product; clicking a tilted card only brings it forward', async ({ page }) => {
  await open(page, 1280);
  const next = await page.locator('.ms-card.is-next').boundingBox();
  await page.mouse.click(next.x + next.width - 12, next.y + next.height / 2); // its visible right edge
  await expect(page.locator('.ms-count')).toHaveText('02 / 12');
  const href = await page.locator('.ms-card.is-active').getAttribute('href');
  await page.locator('.ms-card.is-active').click();
  await expect(page).toHaveURL(new RegExp(href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$'));
});

test('phone: no list, deck fits, nothing sticks out sideways, swipe moves on', async ({ page }) => {
  await open(page, 390);
  await expect(page.locator('.ms-list')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  const box = await page.locator('.ms-deck').boundingBox();
  await page.dispatchEvent('.ms-deck', 'touchstart', { touches: [{ identifier: 1, clientX: box.x + 250, clientY: box.y + 100 }], changedTouches: [{ identifier: 1, clientX: box.x + 250, clientY: box.y + 100 }] });
  await page.dispatchEvent('.ms-deck', 'touchend', { touches: [], changedTouches: [{ identifier: 1, clientX: box.x + 80, clientY: box.y + 105 }] });
  await expect(page.locator('.ms-count')).toHaveText('02 / 12');
});

test('phone: sections like the reference — big title, "VIEW ALL →" below, two cards side by side, Explore collection button', async ({ page }) => {
  await open(page, 360);
  const sec = page.locator('#homeSections .home-section').first();
  await sec.scrollIntoViewIfNeeded();
  const title = await sec.locator('.home-section-title').boundingBox();
  const view = await sec.locator('.home-section-viewall').boundingBox();
  expect(view.y).toBeGreaterThan(title.y + title.height - 1); // under the title, not beside it
  expect(Math.abs(view.x - title.x)).toBeLessThan(4); // both left-aligned
  expect(await sec.locator('.home-section-viewall').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  const cards = sec.locator('.home-row > .ah-card');
  const a = await cards.nth(0).boundingBox();
  const b = await cards.nth(1).boundingBox();
  expect(Math.abs(a.y - b.y)).toBeLessThan(2); // side by side
  expect(a.width).toBeLessThan(200);
  await expect(sec.locator('.home-row-arrow.next')).toBeHidden();
  const explore = sec.locator('.home-section-explore');
  await expect(explore).toBeVisible();
  await expect(explore).toHaveAttribute('href', /\/abaya$|\/[a-z-]+$/);
  // deck card about two-thirds of the screen, neighbours peeking on both sides
  await page.evaluate(() => window.scrollTo(0, 0));
  const front = await page.locator('.ms-card.is-active').boundingBox();
  expect(front.width / 360).toBeGreaterThan(0.55);
  expect(front.width / 360).toBeLessThan(0.72);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test('desktop: Explore collection button stays hidden, View All stays beside the title', async ({ page }) => {
  await open(page, 1280);
  const sec = page.locator('#homeSections .home-section').first();
  await expect(sec.locator('.home-section-explore')).toBeHidden();
  const title = await sec.locator('.home-section-title').boundingBox();
  const view = await sec.locator('.home-section-viewall').boundingBox();
  expect(view.x).toBeGreaterThan(title.x + title.width);
});
