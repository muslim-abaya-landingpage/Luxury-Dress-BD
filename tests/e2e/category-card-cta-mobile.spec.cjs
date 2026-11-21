// The "অর্ডার করুন" button on category cards must stay fully inside its card on every width, including
// sale cards (old + new price) in the narrow two-column phone grid where it used to be cut off.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|clarity\.ms|script\.google\.com|images\.muslimabaya/, (r) => r.fulfill({ status: 204, body: '' }));
});

for (const width of [320, 360, 414, 1024]) {
  for (const path of ['/premium-two-piece', '/kaftan', '/three-piece-dress', '/abaya', '/category']) {
    test(`${path} @${width}px: every order button stays inside its card`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await expect(page.locator('article.premium-card .card-cta').first()).toBeVisible();
      const bad = await page.evaluate(() => {
        const out = [];
        for (const btn of document.querySelectorAll('article.premium-card .card-cta')) {
          const card = btn.closest('article');
          if (!card.offsetParent) continue;
          const c = card.getBoundingClientRect(), b = btn.getBoundingClientRect();
          if (b.left < c.left - 0.5 || b.right > c.right + 0.5 || b.width < 60) out.push(card.getAttribute('data-pid') || '?');
        }
        return out;
      });
      expect(bad).toEqual([]);
    });
  }
}

test('phone: sale card shows price on one line and a full-width flat button under it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/premium-two-piece');
  const card = page.locator('article.premium-card:has(.ma-price-was)').first();
  await expect(card).toBeVisible();
  const m = await card.evaluate((el) => {
    const btn = el.querySelector('.card-cta'), price = el.querySelector('.card-price'), row = el.querySelector('.card-bottom-row');
    const b = btn.getBoundingClientRect(), p = price.getBoundingClientRect(), r = row.getBoundingClientRect();
    return { below: b.top >= p.bottom - 1, fill: b.width / r.width, radius: getComputedStyle(btn).borderTopLeftRadius };
  });
  expect(m.below).toBe(true);
  expect(m.fill).toBeGreaterThan(0.98);
  expect(m.radius).toBe('0px');
});
