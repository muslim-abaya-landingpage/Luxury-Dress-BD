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

test('shopping guide: site header/footer, size helper follows the product size rules, topics are dropdowns', async ({ page }) => {
  await page.route(/facebook|gtag|doubleclick|cloudflareinsights|googletagmanager|clarity|tiktok|script\.google/, (r) => r.abort());
  await page.goto('/shopping-guide.html');
  await expect(page.locator('#site-header-mount .header-announcement-bar, #site-header-mount header, #site-header-mount nav').first()).toBeAttached();
  await expect(page.locator('#site-footer-mount *').first()).toBeAttached();
  await expect(page.locator('.sg-faq details')).toHaveCount(4);
  await expect(page.locator('.sg-faq details[open]')).toHaveCount(0);
  await page.fill('#sgBody', '44.5');
  await page.fill('#sgLength', '51');
  await page.click('#sgForm button');
  await expect(page.locator('#sgResult')).toContainText('46');
  await expect(page.locator('#sgResult')).toContainText('Medium - 52');
  await page.fill('#sgBody', '48');
  await page.fill('#sgLength', '60');
  await page.click('#sgForm button');
  await expect(page.locator('#sgResult')).toContainText('Custom Size');
  await page.click('#exchange summary');
  await page.click('#size summary');
  await expect(page.locator('#exchange')).not.toHaveAttribute('open', '');
  await expect(page.locator('#size')).toHaveAttribute('open', '');
});
