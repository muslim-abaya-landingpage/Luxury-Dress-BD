const { test, expect } = require('@playwright/test');

// Mobile "Category" tab opens a mega-menu (Collections pills + a Subcategory
// accordion for Abaya), styled after a competitor's app. Covers: opening the
// panel, the default Abaya subcategory accordion, switching to a category
// with no subcategories, and that it still closes normally.

test.describe('mobile category mega-menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/index.html');
    await page.waitForSelector('#mobileMenuPanel');
  });

  test('opens with Collections pills and an Abaya subcategory accordion', async ({ page }) => {
    await page.locator('#mbn-category').click();
    await expect(page.locator('#mobileMenuPanel')).toHaveClass(/active/);

    const pills = page.locator('.mnp-collections .mnp-pill');
    await expect(pills.first()).toBeVisible();
    await expect(page.locator('.mnp-pill-active')).toContainText('ABAYA');

    const subcat = page.locator('#mnpSubcat');
    await expect(subcat).toBeVisible();
    await expect(subcat.locator('.mnp-subcat-all')).toContainText('ABAYA');
    // Karchupi has no live products right now, so (like the rest of the site's
    // nav) it is left out of the accordion rather than linking to an empty page.
    await expect(subcat.locator('.mnp-subcat-list li')).toHaveCount(1);
    await expect(subcat.locator('.mnp-subcat-list')).toContainText('EMBROIDERY');
  });

  test('switching to a category without subcategories replaces the accordion', async ({ page }) => {
    await page.locator('#mbn-category').click();
    await page.locator('.mnp-pill', { hasText: 'HIJAB' }).click();
    await expect(page.locator('.mnp-pill-active')).toContainText('HIJAB');
    const subcat = page.locator('#mnpSubcat');
    await expect(subcat.locator('.mnp-subcat-all')).toContainText('HIJAB');
    await expect(subcat.locator('.mnp-subcat-list')).toHaveCount(0);
  });

  test('subcategory link navigates to the real category page', async ({ page }) => {
    await page.locator('#mbn-category').click();
    await page.locator('#mnpSubcat .mnp-subcat-list a', { hasText: 'EMBROIDERY' }).click();
    await page.waitForURL(/\/embroidery/);
  });

  test('Information and WhatsApp support rows are present, and the panel closes', async ({ page }) => {
    await page.locator('#mbn-category').click();
    await expect(page.locator('.mnp-info-btn', { hasText: 'আমাদের সম্পর্কে' })).toHaveAttribute('href', /\/about/);
    await expect(page.locator('.mnp-info-btn', { hasText: 'সাহায্য ও সাপোর্ট' })).toHaveAttribute('href', /\/help/);
    await expect(page.locator('.mnp-help-card')).toHaveAttribute('href', /wa\.me/);

    await page.locator('.mnp-close').click();
    await expect(page.locator('#mobileMenuPanel')).not.toHaveClass(/active/);
  });
});
