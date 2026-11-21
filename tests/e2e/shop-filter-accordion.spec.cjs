// Category/shop sidebar filter sections: each section's header is its own
// collapse/expand toggle, independent of the others, on both desktop and the mobile drawer.
const { test, expect } = require('@playwright/test');

test('desktop: each filter section collapses on its own, the others stay open', async ({ page }) => {
  await page.goto('/abaya');
  await page.waitForSelector('.product-grid > .card');
  const sidebar = page.locator('.shop-sidebar');
  const priceSection = sidebar.locator('.sidebar-filter-price');
  const colorSection = sidebar.locator('.sidebar-filter-colors');

  await expect(priceSection.locator('.price-slider-wrap')).toBeVisible();
  await expect(colorSection.locator('.color-filter-list')).toBeVisible();

  await priceSection.locator('[data-filter-toggle]').click();
  await expect(priceSection).toHaveClass(/is-collapsed/);
  await expect(priceSection.locator('.price-slider-wrap')).toBeHidden();
  await expect(colorSection).not.toHaveClass(/is-collapsed/);
  await expect(colorSection.locator('.color-filter-list')).toBeVisible();

  await priceSection.locator('[data-filter-toggle]').click();
  await expect(priceSection).not.toHaveClass(/is-collapsed/);
  await expect(priceSection.locator('.price-slider-wrap')).toBeVisible();
});

test('mobile: a filter section can be collapsed inside the open drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/abaya');
  await page.waitForSelector('.product-grid > .card');
  await page.locator('#shopFilterOpen').click();
  const sizeSection = page.locator('.sidebar-filter-sizes');
  await expect(sizeSection.locator('.filter-check-list')).toBeVisible();
  await sizeSection.locator('[data-filter-toggle]').click();
  await expect(sizeSection).toHaveClass(/is-collapsed/);
  await expect(sizeSection.locator('.filter-check-list')).toBeHidden();
});

test('a checkbox still filters the grid after its section was collapsed and reopened', async ({ page }) => {
  await page.goto('/abaya');
  await page.waitForSelector('.product-grid > .card');
  const colorSection = page.locator('.shop-sidebar .sidebar-filter-colors');
  await colorSection.locator('[data-filter-toggle]').click();
  await colorSection.locator('[data-filter-toggle]').click();
  const checkbox = colorSection.locator('.color-filter-check').first();
  await expect(checkbox).toBeVisible();
  const before = await page.locator('#productGrid .premium-card:visible').count();
  await checkbox.check();
  await page.waitForTimeout(300);
  const after = await page.locator('#productGrid .premium-card:visible').count();
  expect(after).toBeLessThanOrEqual(before);
});

test('desktop master switch and a section toggle still work on the All Categories page', async ({ page }) => {
  // /category merges every category into one grid, via a different code path than a single
  // category page. The switch and section toggles must keep working there too.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/category.html');
  await page.waitForSelector('#shopFilterOpen');
  await page.waitForSelector('.product-grid .premium-card, .filter-empty');

  await expect(page.locator('.shop-filter-switch-state')).toHaveText('ON');
  await expect(page.locator('.shop-sidebar-col')).toBeVisible();

  const priceSection = page.locator('.shop-sidebar .sidebar-filter-price');
  await priceSection.locator('[data-filter-toggle]').click();
  await expect(priceSection).toHaveClass(/is-collapsed/);

  await page.locator('#shopFilterOpen').click();
  await expect(page.locator('.shop-filter-switch-state')).toHaveText('OFF');
  await expect(page.locator('.shop-sidebar-col')).toBeHidden();

  await page.locator('#shopFilterOpen').click();
  await expect(page.locator('.shop-filter-switch-state')).toHaveText('ON');
  await expect(page.locator('.shop-sidebar-col')).toBeVisible();
});
