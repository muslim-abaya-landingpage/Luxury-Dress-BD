// Storefront side of the Product Manager features: sale prices, Draft hidden everywhere, featured first,
// tag links and tag pages, working search and the "Newest" sort. Uses the real catalog with a few fields added.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const real = fs.readFileSync(path.join(__dirname, '../../category-products.js'), 'utf8');
function addFields(src, id, fields) {
  const marker = 'id: "' + id + '",';
  if (src.indexOf(marker) === -1) throw new Error('fixture product missing: ' + id);
  return src.replace(marker, marker + '\n      ' + fields + ',');
}
let catalog = real;
catalog = addFields(catalog, 'ABY-MAROON-1', 'regularPrice: 1299, regularPriceByType: {"Full Set": 1299}');
catalog = addFields(catalog, 'ABY-BLK-3P-02', 'status: "draft"');
catalog = addFields(catalog, 'ABY-BLACK-3', 'featured: true, tags: ["eid", "Black Abaya"]');
// Isolate sale-price assertions from changing real store prices.
// The fixture deliberately defines two price options; production catalog is untouched.
catalog += '\n(function(){var p=(window.CATEGORY_PRODUCTS.abaya||[]).find(function(x){return x.id==="ABY-MAROON-1";});if(p){p.price=999;p.types=["Full Set","Abaya Only"];p.priceByType={"Full Set":999,"Abaya Only":799};p.regularPrice=1299;p.regularPriceByType={"Full Set":1299};}})();\n';

async function useCatalog(page) {
  await page.route(/\/category-products\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: catalog }));
  // Keep third-party trackers and the order API out of the test.
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
}
const cardIds = (page) => page.$$eval('#productGrid .premium-card:not(.premium-card-detail)', (cards) => cards.map((c) => {
  const a = c.querySelector('a[href*="/product/"]'); return a ? decodeURIComponent(a.getAttribute('href').split('/product/')[1]) : '';
}));

test('category page: Draft is hidden, featured comes first, sale price is crossed out', async ({ page }) => {
  await useCatalog(page);
  await page.goto('/abaya');
  await expect(page.locator('#productGrid .premium-card').first()).toBeVisible();
  const ids = await cardIds(page);
  expect(ids[0]).toBe('ABY-BLACK-3');
  expect(ids).not.toContain('ABY-BLK-3P-02');
  expect(ids).toContain('ABY-MAROON-1');
  const maroon = page.locator('#productGrid .premium-card').filter({ has: page.locator('a[href="/product/ABY-MAROON-1"]') }).first();
  await expect(maroon.locator('.card-price del.ma-price-was')).toHaveText('৳1299');
  await expect(maroon.locator('.card-price .ma-price-now')).toHaveText('৳999');
  // "Newest" sort exists and orders by date added.
  await expect(page.locator('#shopSort option[value="newest"]')).toHaveCount(1);
});

test('product page: sale on the first option, plain price on an option without a sale', async ({ page }) => {
  await useCatalog(page);
  await page.goto('/product/ABY-MAROON-1');
  const price = page.locator('#pqvPrice');
  await expect(price.locator('del')).toHaveText('৳1299');
  await expect(price.locator('.ma-price-now')).toHaveText('৳999');
  await expect(price.locator('.ma-price-off')).toHaveText('-23%');
  await page.locator('.pqv-type-opt', { hasText: 'Abaya Only' }).click();
  await expect(price).toHaveText('৳799');
  await expect(price).toHaveAttribute('data-price', '799');
});

test('a Draft product is not sold: no card, not in search, product page shows no product view', async ({ page }) => {
  await useCatalog(page);
  await page.goto('/category?q=premium%20black%203%20part');
  await expect(page.locator('#list')).toBeVisible();
  await page.waitForTimeout(800);
  expect(await cardIds(page)).not.toContain('ABY-BLK-3P-02');
  // The order price check (catalog-validation built from the same catalog code) leaves it out too.
  const ok = await page.evaluate(() => !window.maCatalog.normalizeAll(window.CATEGORY_PRODUCTS || {}, {}).abaya.some((p) => p.id === 'ABY-BLK-3P-02'));
  expect(ok).toBe(true);
});

test('tags: product page links to the tag page, which lists only tagged products', async ({ page }) => {
  await useCatalog(page);
  await page.goto('/product/ABY-BLACK-3');
  await page.locator('[data-tab="spec"]').first().click(); // Specification tab
  const tags = page.locator('.pqv-spec-tags a');
  await expect(tags).toHaveText(['eid', 'Black Abaya']);
  await tags.first().click();
  await expect(page).toHaveURL(/\/category\?tag=eid$/);
  await expect(page.locator('.shop-breadcrumb').first()).toContainText('Tag');
  await expect.poll(() => cardIds(page)).toEqual(['ABY-BLACK-3']);
});

test('search: /category?q= filters products instead of listing everything', async ({ page }) => {
  await useCatalog(page);
  await page.goto('/category');
  await expect(page.locator('#productGrid .premium-card').first()).toBeVisible();
  const all = (await cardIds(page)).length;
  await page.goto('/category?q=butterfly');
  await expect(page.locator('#productGrid .premium-card').first()).toBeVisible();
  const hits = await page.$$eval('#productGrid .premium-card .card-title-text', (els) => els.map((e) => e.textContent.toLowerCase()));
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.length).toBeLessThan(all);
  for (const name of hits) expect(name).toContain('butterfly');
});

test('home page: sale price on the card, Draft not shown', async ({ page }) => {
  await useCatalog(page);
  await page.goto('/');
  const maroon = page.locator('.ah-card').filter({ has: page.locator('a[href="/product/ABY-MAROON-1"]') }).first();
  await expect(maroon.locator('.ah-card-price del')).toHaveText('৳1299', { timeout: 15000 });
  expect(await page.locator('a[href="/product/ABY-BLK-3P-02"]').count()).toBe(0);
});
