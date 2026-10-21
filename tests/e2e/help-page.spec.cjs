const { test, expect } = require('@playwright/test');

test('help page: every FAQ shown is in the structured data, links work, no sideways scroll on phones', async ({ page, request }) => {
  await page.route(/facebook|gtag|doubleclick|cloudflareinsights|googletagmanager|clarity|tiktok|script\.google/, (r) => r.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/help.html');
  const data = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent());
  const faq = data['@graph'].find((n) => n['@type'] === 'FAQPage').mainEntity.map((q) => q.name);
  const shown = await page.locator('.hp-faq summary').allInnerTexts();
  expect(shown.map((s) => s.trim())).toEqual(faq);
  await page.locator('.hp-faq summary').first().click();
  await expect(page.locator('.hp-faq details').first()).toHaveAttribute('open', '');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect((await request.get(new URL(og).pathname)).status()).toBe(200);
});

test('shopping guide: site header/footer, no size section, three dropdown topics that match the structured data', async ({ page }) => {
  await page.route(/facebook|gtag|doubleclick|cloudflareinsights|googletagmanager|clarity|tiktok|script\.google/, (r) => r.abort());
  await page.goto('/shopping-guide.html');
  await expect(page.locator('#site-footer-mount *').first()).toBeAttached();
  await expect(page.locator('#sgForm, #size')).toHaveCount(0);
  await expect(page.locator('.sg-faq details')).toHaveCount(3);
  const data = JSON.parse(await page.locator('script[type="application/ld+json"]').first().textContent());
  const faq = data['@graph'].find((n) => n['@type'] === 'FAQPage').mainEntity.map((q) => q.name);
  expect(faq).toEqual((await page.locator('.sg-faq summary').allInnerTexts()).map((t) => t.trim()));
  await page.click('#exchange summary');
  await page.click('#set summary');
  await expect(page.locator('#exchange')).not.toHaveAttribute('open', '');
  await expect(page.locator('#set')).toHaveAttribute('open', '');
});
