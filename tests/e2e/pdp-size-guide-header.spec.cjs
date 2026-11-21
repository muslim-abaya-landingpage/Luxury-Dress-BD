// Product page: the Size Guide button never sits on a size label (e.g. "Palazzo Length" when Body / Dress Length /
// Palazzo Length are side by side), on phones or desktop. The breadcrumb stays on one line.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|clarity\.ms|script\.google\.com|images\.muslimabaya/, (r) => r.fulfill({ status: 204, body: '' }));
});

for (const width of [360, 390, 1024, 1280]) {
  for (const id of ['DR-01', 'DR-02', 'ABY-MAROON-1', 'premium-linen-kaftan']) {
    test(`${id} @${width}px: size guide does not cover any size label; breadcrumb is one line`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/product/' + id);
      const guide = page.locator('.pqv-muslim-abaya .pqv-size-chart-link').first();
      await expect(guide).toBeVisible();
      const r = await page.evaluate(() => {
        const g = document.querySelector('.pqv-muslim-abaya .pqv-size-chart-link').getBoundingClientRect();
        const hits = [];
        for (const l of document.querySelectorAll('.pqv-muslim-abaya .pqv-field-label')) {
          if (!l.offsetParent) continue;
          const rg = document.createRange(); rg.selectNodeContents(l); const t = rg.getBoundingClientRect();
          if (Math.min(t.right, g.right) - Math.max(t.left, g.left) > 1 && Math.min(t.bottom, g.bottom) - Math.max(t.top, g.top) > 1) hits.push(l.textContent.trim());
        }
        const crumbs = document.querySelector('.pqv-muslim-abaya .pqv-crumbs');
        return { hits, crumbH: crumbs.getBoundingClientRect().height, guideRight: g.right, vw: document.documentElement.clientWidth };
      });
      expect(r.hits).toEqual([]);
      expect(r.crumbH).toBeLessThan(24);
      expect(r.guideRight).toBeLessThanOrEqual(r.vw);
    });
  }
}

test('desktop top menu: no category hidden off the edge; 1024-1199px uses the ☰ menu', async ({ page }) => {
  for (const width of [1100, 1280, 1366]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/abaya');
    const r = await page.evaluate(() => {
      const nav = document.querySelector('.header-middle-nav .desktop-menu');
      const btn = document.querySelector('.header-middle-nav .nav-menu-btn');
      if (!nav.offsetParent) return { menu: false, btn: !!btn.offsetParent };
      return { menu: true, fits: nav.scrollWidth <= nav.clientWidth + 1 };
    });
    if (width < 1200) expect(r).toEqual({ menu: false, btn: true });
    else expect(r).toEqual({ menu: true, fits: true });
  }
});
