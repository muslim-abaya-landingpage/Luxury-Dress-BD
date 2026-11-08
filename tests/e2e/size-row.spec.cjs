// Product page size choices: Body | Dress length | Palazzo length in one row of equal cards (max 3),
// with Custom Size and Size Chart on their own line below.
const { test, expect } = require('@playwright/test');

for (const width of [1280, 390]) {
  test('two-piece size cards share one row at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook/, (r) => r.fulfill({ status: 204, body: '' }));
    await page.goto('/product/DR-9');
    const cards = page.locator('.pqv-size-grid > .pqv-field');
    await expect(cards).toHaveCount(3);
    await expect(page.locator('.pqv-size-grid > .pqv-field .pqv-field-label')).toHaveText(['Body Size', 'Dress Length', 'Palazzo Length']);
    const boxes = await cards.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    expect(new Set(boxes.map((b) => Math.round(b.top))).size).toBe(1);
    expect(Math.max(...boxes.map((b) => b.width)) - Math.min(...boxes.map((b) => b.width))).toBeLessThan(2);
    const pills = await page.locator('.pqv-size-grid > .pqv-field .pqv-opt-btn').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(pills).size).toBe(1);
    const tools = await page.locator('.pqv-size-tools').boundingBox();
    expect(tools.y).toBeGreaterThan(Math.max(...boxes.map((b) => b.bottom)) - 1);
    await expect(page.locator('.pqv-size-tools [data-pqv-custom-size]')).toBeVisible();
    await expect(page.locator('.pqv-size-tools [data-pqv-size-chart]')).toBeVisible();
  });
}
