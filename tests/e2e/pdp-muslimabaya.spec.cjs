// Muslim Abaya product page layout (owner's request, Nov 2026), with flat corners:
// breadcrumb, category badge, title, note + price row, colour swatches with "Color: <name>", sizes on the right
// with Size Guide, Qty, Add to Cart + Buy Now only, "Your impression" tap-to-rate, description/spec accordion,
// heart + "01 / 02" counter on the big photo. No "In Stock", wholesale, Send Message or Jump to Description.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const real = fs.readFileSync(path.join(__dirname, '../../category-products.js'), 'utf8');
const catalog = real + '\n(function(){var p=(window.CATEGORY_PRODUCTS.abaya||[]).find(function(x){return x.id==="ABY-MAROON-1";});if(p){' +
  'p.colorLabel="Maroon, Navy";p.color="maroon";p.colorVariants=[{color:"maroon",colorLabel:"Maroon",image:p.image},{color:"navy",colorLabel:"Navy",image:(window.CATEGORY_PRODUCTS.abaya.find(function(x){return x.id==="ABY-BLACK-3";})||{}).image}];' +
  'p.images=[p.colorVariants[1].image];}})();\n';

async function open(page, width) {
  await page.setViewportSize({ width, height: 900 });
  await page.route(/\/category-products\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: catalog }));
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com|\/api\/stock/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto('/product/ABY-MAROON-1');
  await expect(page.locator('#pqvTitle')).toHaveText('Maroon Abaya Set');
}

test('desktop: product page layout pieces are there, flat, in order; removed pieces are gone', async ({ page }) => {
  await open(page, 1280);
  const crumbs = page.locator('.pqv-crumbs');
  await expect(crumbs).toContainText('Home');
  await expect(crumbs.locator('.pqv-crumb-here')).toHaveText('Maroon Abaya Set');
  await expect(page.locator('.pqv-badge-dark')).toBeVisible();
  await expect(page.locator('.pqv-price-row .pqv-price')).toBeVisible();

  // colours: swatches, the label names the chosen one
  await expect(page.locator('.pqv-color-opt.pqv-swatch')).toHaveCount(2);
  await expect(page.locator('.pqv-color-name')).toHaveText('Maroon');
  await page.locator('.pqv-color-opt[data-color-label="Navy"]').click();
  await expect(page.locator('.pqv-color-name')).toHaveText('Navy');
  await expect(page.locator('.pqv-counter')).toHaveText('02 / 02'); // Navy's photo is the 2nd one
  await page.locator('.pqv-color-opt[data-color-label="Maroon"]').click();
  await expect(page.locator('.pqv-color-name')).toHaveText('Maroon');

  // sizes sit to the right of colour / qty, with Size Guide at the top of that column
  const left = await page.locator('.pqv-config-left').boundingBox();
  const right = await page.locator('.pqv-config-right').boundingBox();
  expect(right.x).toBeGreaterThan(left.x + left.width - 1);
  await expect(page.locator('.pqv-config-right [data-pqv-size-chart]')).toContainText('Size Guide');
  await expect(page.locator('.pqv-config-left #pqvQty')).toBeVisible();

  // only two buttons
  await expect(page.locator('.pqv-actions-row .pqv-act:visible')).toHaveCount(2);
  await expect(page.locator('.pqv-act-buy')).toContainText('Buy Now');
  await expect(page.locator('.pqv-act-msg:visible, .pqv-wholesale, .pqv-jump-desc:visible, .pqv-panel-back:visible')).toHaveCount(0);
  await expect(page.locator('.pqv-stock')).toBeHidden(); // "In Stock" is not shown
  expect(await page.locator('.pqv-panel').innerText()).not.toMatch(/In Stock/i);

  // flat corners on the main pieces
  for (const sel of ['.pqv-main', '.pqv-opt-btn', '.pqv-act-cart', '.pqv-act-buy', '.pqv-impression', '.pqv-acc-item']) {
    expect(await page.locator(sel).first().evaluate((e) => getComputedStyle(e).borderRadius), sel).toBe('0px');
  }

  // heart + counter on the big photo
  const heart = page.locator('.pqv-main .ma-wish');
  await expect(heart).toBeVisible();
  await expect(page.locator('.ma-wish-inline')).toHaveCount(0);
  await expect(page.locator('.pqv-counter')).toHaveText('01 / 02');
  await page.locator('.pqv-thumb').nth(1).click();
  await expect(page.locator('.pqv-counter')).toHaveText('02 / 02');

  // four info boxes; one open at a time; texts from our own policy + delivery settings
  const items = page.locator('.pqv-acc-item');
  await expect(items.locator('summary')).toHaveText(['01. Product Description', '02. Fabric & Care', '03. Exchange, Return & Refund', '04. Delivery Details']);
  await expect(items.nth(0)).toHaveAttribute('open', '');
  await items.nth(2).locator('summary').click();
  await expect(items.nth(2)).toHaveAttribute('open', '');
  await expect(items.nth(0)).not.toHaveAttribute('open', '');
  await expect(items.nth(2)).toContainText('24 hours');
  await expect(items.nth(2).locator('a')).toHaveAttribute('href', /refund/);
  expect(await items.nth(2).evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('2px');
  expect(await items.nth(0).evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe('1px');
  await items.nth(3).locator('summary').click();
  await expect(items.nth(3)).toContainText('Inside Dhaka');
  const fees = await page.evaluate(() => window.maDelivery.settings());
  await expect(items.nth(3)).toContainText('৳' + fees.dhaka);
  await expect(items.nth(3)).toContainText('৳' + fees.outside);
  await expect(items.nth(2)).not.toHaveAttribute('open', '');

  // tap to rate → review form opens with that rating picked
  await page.locator('[data-pqv-rate="4"]').click();
  await expect(page.locator('.pqv-imp-star.is-lit')).toHaveCount(4);
  await expect(page.locator('.pqv-reviews input[name="rating"]')).toHaveValue('4');
  await expect(page.locator('.pqv-impression [data-ma-review-form]')).toBeVisible();
  // no separate reviews block lower down, and no "no reviews yet" text
  await expect(page.locator('.pqv-reviews-section, .pqv-reviews-title')).toHaveCount(0);
  await expect(page.locator('.pqv-reviews-count:visible')).toHaveCount(0);
  await expect(page.locator('[data-ma-review-toggle]:visible')).toHaveCount(0);
});

test('phone: options stack in one column and nothing overflows the screen', async ({ page }) => {
  await open(page, 390);
  const left = await page.locator('.pqv-config-left').boundingBox();
  const right = await page.locator('.pqv-config-right').boundingBox();
  expect(right.y).toBeGreaterThan(left.y + left.height - 1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('.pqv-act-cart')).toBeVisible();
  await expect(page.locator('.pqv-act-buy')).toBeVisible();
});
