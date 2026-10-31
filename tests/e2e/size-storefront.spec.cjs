// Size Manager on the shop (Stage 4): with nothing switched on the old size pickers and cart lines are unchanged;
// with a category on, the product view shows the published fields, checks them, and the cart line carries the
// measurement choices to checkout. The published config is attached to product-config.js the way the live
// middleware does it (functions/_lib/size-carrier.js).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const productConfig = fs.readFileSync(path.join(__dirname, '../../product-config.js'), 'utf8');
let defaults;

async function sizeConfig(extra) {
  if (!defaults) defaults = await import(path.join(__dirname, '../../functions/_lib/size-defaults.js'));
  const templates = {};
  defaults.DEFAULT_TEMPLATES.forEach((t) => { templates[t.id] = JSON.parse(JSON.stringify(t)); });
  const categories = {};
  defaults.DEFAULT_CATEGORIES.forEach((c) => { categories[c.category_key] = { template: c.template_id, enabled: false }; });
  const cfg = { version: 7, categories, templates, products: {} };
  if (extra) extra(cfg);
  return cfg;
}

async function serve(page, cfg) {
  await page.route(/\/product-config\.js(\?.*)?$/, (r) => r.fulfill({
    contentType: 'application/javascript',
    body: cfg ? productConfig + '\n;window.MA_SIZE_CONFIG = ' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ';\n' : productConfig,
  }));
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
}
const cartLines = (page) => page.evaluate(() => (window.loadStoreCart ? window.loadStoreCart({ readOnly: true }) : []));

test('nothing switched on: the old pickers and the old cart line', async ({ page }) => {
  await serve(page, await sizeConfig());
  await page.goto('/product/ABY-MAROON-1');
  await expect(page.locator('.pqv-length-opt').first()).toBeVisible();
  await expect(page.locator('.ma-sz')).toHaveCount(0);
  await page.locator('.pqv-body-opt', { hasText: '44' }).click();
  await page.locator('.pqv-length-opt', { hasText: '52' }).click();
  await page.locator('button[data-action="add"]').first().click();
  const lines = await cartLines(page);
  expect(lines).toHaveLength(1);
  expect(lines[0].size).toBe('Body 44 · Length 52');
  expect(lines[0].measurements).toBeUndefined();
});

test('abaya switched on: published fields with the product\'s own sizes, cart carries the choices to checkout', async ({ page }) => {
  await serve(page, await sizeConfig((c) => { c.categories.abaya.enabled = true; }));
  await page.goto('/product/ABY-MAROON-1');
  const fields = page.locator('.ma-sz .ma-sz-field');
  await expect(fields).toHaveCount(2);
  await expect(page.locator('.pqv-length-opt')).toHaveCount(0);
  await expect(page.locator('.pqv-wholesale, [data-pqv-wholesale]')).toHaveCount(0);
  // Existing product: its own sizes (Length 44–56), not the template's 50–58.
  const lengths = await fields.nth(1).locator('[data-sz-value]').allTextContents();
  expect(lengths).toEqual(['44', '46', '48', '50', '52', '54', '56']);
  await expect(fields.nth(0).locator('[data-sz-value].is-active')).toHaveText('42');
  await fields.nth(0).locator('[data-sz-value]', { hasText: '46' }).click();
  await fields.nth(1).locator('[data-sz-value]', { hasText: '54' }).click();
  await expect(fields.nth(0).locator('[data-sz-value].is-active')).toHaveCount(1);
  await page.locator('button[data-action="add"]').first().click();
  const lines = await cartLines(page);
  expect(lines).toHaveLength(1);
  // Same text the old pickers produced, so order labels and stock look the same.
  expect(lines[0].size).toBe('Body 46 · Length 54');
  expect(lines[0].measurements).toEqual([
    { key: 'body', label: 'Body', value: '46', custom: false },
    { key: 'length', label: 'Length', value: '54', custom: false },
  ]);
  await page.goto('/checkout');
  await expect(page.locator('#orderSummary select[data-sz-key="body"]')).toHaveValue('46');
  await expect(page.locator('#orderSummary select[data-sz-key="length"]')).toHaveValue('54');
  await expect(page.locator('#orderSummary [data-cart-action="length-size"]')).toHaveCount(0);
});

test('a required measurement the customer types: add is stopped until it is filled in', async ({ page }) => {
  await serve(page, await sizeConfig((c) => {
    c.templates.chest = { id: 'chest', name_bn: '', name_en: 'Chest', fields: [
      { key: 'chest', label_bn: 'বুকের মাপ', label_en: 'Chest', required: true, enabled: true, allowCustom: true, default: '', legacy: [], options: [] },
      { key: 'fit', label_bn: '', label_en: 'Fit', required: false, enabled: true, allowCustom: false, default: '', legacy: [],
        options: [{ value: 'Loose', label_bn: '', label_en: '' }, { value: 'Regular', label_bn: '', label_en: '' }] }] };
    c.products['KURTI-01'] = { enabled: true, template: 'chest', useTemplate: true };
  }));
  await page.goto('/product/KURTI-01');
  await expect(page.locator('.ma-sz .ma-sz-field')).toHaveCount(2);
  await page.locator('button[data-action="add"]').first().click();
  await expect(page.locator('.ma-sz-field[data-sz-field="chest"] .ma-sz-error')).toHaveText('এই মাপটি বেছে নিন।');
  expect(await cartLines(page)).toHaveLength(0);
  await page.locator('[data-sz-custom="chest"]').fill('38');
  await expect(page.locator('.ma-sz-field[data-sz-field="chest"] .ma-sz-error')).toBeHidden();
  // Optional field: tap to pick, tap again to clear.
  const loose = page.locator('[data-sz-key="fit"][data-sz-value="Loose"]');
  await loose.click();
  await expect(loose).toHaveAttribute('aria-pressed', 'true');
  await loose.click();
  await expect(loose).toHaveAttribute('aria-pressed', 'false');
  await page.locator('button[data-action="add"]').first().click();
  const lines = await cartLines(page);
  expect(lines).toHaveLength(1);
  expect(lines[0].size).toBe('বুকের মাপ 38');
  expect(lines[0].measurements).toEqual([{ key: 'chest', label: 'বুকের মাপ', value: '38', custom: true }]);
});

test('category card: a product with the new fields opens its page instead of adding a default size', async ({ page }) => {
  await serve(page, await sizeConfig((c) => { c.categories.abaya.enabled = true; }));
  await page.goto('/abaya');
  const card = page.locator('#productGrid .premium-card').filter({ has: page.locator('a[href="/product/ABY-MAROON-1"]') }).first();
  await expect(card).toBeVisible();
  await card.locator('button[data-action="add"]').first().click();
  await expect(page).toHaveURL(/\/product\/ABY-MAROON-1$/);
  expect(await cartLines(page)).toHaveLength(0);
});

test('product.html page: fields, checked add to cart, WhatsApp text follows the choice', async ({ page }) => {
  await serve(page, await sizeConfig((c) => { c.categories.abaya.enabled = true; }));
  await page.goto('/product.html?id=ABY-MAROON-1');
  const fields = page.locator('#pdSizeGroup .ma-sz-field');
  await expect(fields).toHaveCount(2);
  await fields.nth(1).locator('[data-sz-value]', { hasText: '50' }).click();
  await expect.poll(async () => decodeURIComponent(await page.locator('#pdSendMsg').getAttribute('href'))).toContain('সাইজ: Body 42 · Length 50');
  await page.locator('#pdAddCart').click();
  const lines = await cartLines(page);
  expect(lines).toHaveLength(1);
  expect(lines[0].size).toBe('Body 42 · Length 50');
  expect(lines[0].measurements.map((m) => m.value)).toEqual(['42', '50']);
});

test('phone width: the fields fit without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await serve(page, await sizeConfig((c) => { c.categories.abaya.enabled = true; }));
  await page.goto('/product/ABY-MAROON-1');
  await expect(page.locator('.ma-sz .ma-sz-field').first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

// ── Stage 5: cart, checkout and order ──
const realCatalog = fs.readFileSync(path.join(__dirname, '../../category-products.js'), 'utf8');

test('checkout: a measurement can be changed; the line text follows and equal lines merge', async ({ page }) => {
  await serve(page, await sizeConfig((c) => { c.categories.abaya.enabled = true; }));
  await page.goto('/product/ABY-MAROON-1');
  const fields = page.locator('.ma-sz .ma-sz-field');
  await fields.nth(1).locator('[data-sz-value]', { hasText: '52' }).click();
  await page.locator('button[data-action="add"]').first().click();
  await page.reload(); // the cart drawer opened over the page
  await fields.nth(1).locator('[data-sz-value]', { hasText: '54' }).click();
  await page.locator('button[data-action="add"]').first().click();
  expect((await cartLines(page)).map((l) => l.size)).toEqual(['Body 42 · Length 52', 'Body 42 · Length 54']);
  await page.goto('/checkout');
  const selects = page.locator('#orderSummary select[data-cart-action="measure"][data-sz-key="length"]');
  await expect(selects).toHaveCount(2);
  await selects.first().selectOption('56');
  await expect.poll(async () => (await cartLines(page)).map((l) => l.size)).toEqual(['Body 42 · Length 56', 'Body 42 · Length 54']);
  const first = (await cartLines(page))[0];
  expect(first.measurements.map((m) => m.value)).toEqual(['42', '56']);
  expect(first.name).not.toContain('Length 52');
  // Changing it to the other line's size merges the two.
  await page.locator('#orderSummary select[data-cart-action="measure"][data-sz-key="length"]').first().selectOption('54');
  await expect.poll(async () => (await cartLines(page)).map((l) => [l.size, l.quantity])).toEqual([['Body 42 · Length 54', 2]]);
});

test('per-size stock rows in the old text: fields shown, stock follows the choice', async ({ page }) => {
  const marker = 'id: "ABY-MAROON-1",';
  const withStock = realCatalog.replace(marker, marker + '\n      stockVariants: {"Body 42 · Length 44": {tracked: true, available: 3}, "Body 46 · Length 54": {tracked: true, available: 0}},');
  await page.route(/\/category-products\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: withStock }));
  await serve(page, await sizeConfig((c) => { c.categories.abaya.enabled = true; }));
  await page.goto('/product.html?id=ABY-MAROON-1');
  const fields = page.locator('#pdSizeGroup .ma-sz-field');
  await expect(fields).toHaveCount(2);
  await expect(page.locator('#pdAddCart')).toBeEnabled();
  await fields.nth(0).locator('[data-sz-value]', { hasText: '46' }).click();
  await fields.nth(1).locator('[data-sz-value]', { hasText: '54' }).click();
  await expect(page.locator('#pdStock')).toHaveText('Out of Stock');
  await expect(page.locator('#pdAddCart')).toBeDisabled();
});

test('home page: quick add of a product with fields opens its page', async ({ page }) => {
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto('/');
  const card = page.locator('.ah-card[data-pid]').first();
  await expect(card).toBeVisible({ timeout: 15000 });
  const pid = await card.getAttribute('data-pid');
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await serve(page, await sizeConfig((c) => { c.products[pid] = { enabled: true }; }));
  await page.goto('/');
  const target = page.locator('.ah-card[data-pid="' + pid + '"] button[data-action="add"]').first();
  await expect(target).toBeVisible({ timeout: 15000 });
  await expect.poll(() => page.evaluate(() => !!(window.maSizeStore && window.MA_SIZE_CONFIG))).toBe(true);
  await target.click();
  await expect(page).toHaveURL(new RegExp('/product/' + pid + '$'));
  expect(await cartLines(page)).toHaveLength(0);
});

test('"colour · size" stock rows: the product page follows the chosen colour, the cart refuses a sold-out colour', async ({ page }) => {
  const marker = 'id: "ABY-MAROON-1",';
  const withStock = realCatalog.replace(marker, marker + '\n      colorVariants: [{color: "maroon", colorLabel: "Maroon", image: "/images/Maroon Abaya Set...jpeg"}, {color: "black", colorLabel: "Black", image: "/images/Maroon Abaya Set...jpeg"}],' +
    '\n      stockVariants: {"maroon · Body 44 · Length 52": {tracked: true, available: 2}, "black · Body 44 · Length 52": {tracked: true, available: 0}},');
  await page.route(/\/category-products\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: withStock }));
  await serve(page, await sizeConfig());
  await page.goto('/product.html?id=ABY-MAROON-1');
  await page.locator('#pdColorPickGroup .pd-option-btn', { hasText: 'Maroon' }).click();
  await page.locator('#pdBodyOptions .pd-option-btn', { hasText: '44' }).click();
  await page.locator('#pdSizeGroup .pd-option-btn', { hasText: '52' }).first().click();
  const size = await page.evaluate(() => window.maCatalog.getStockQty(window.CATEGORY_PRODUCTS.abaya.find((p) => p.id === 'ABY-MAROON-1'), 'Body 44 · Length 52', 'maroon'));
  expect(size).toBe(2);
  await expect(page.locator('#pdStock')).toHaveText('In Stock');
  await page.locator('#pdColorPickGroup .pd-option-btn', { hasText: 'Black' }).click();
  await expect(page.locator('#pdStock')).toHaveText('Out of Stock');
  await expect(page.locator('#pdAddCart')).toBeDisabled();
  // The cart helper itself also refuses the sold-out colour and caps the other one at its own count.
  const lines = await page.evaluate(() => {
    var add = window.addOrMergeStoreCartItem;
    var cart = add([], { id: 'ABY-MAROON-1', name: 'x', price: 1, quantity: 1, size: 'Body 44 · Length 52', color: 'black' });
    cart = add(cart, { id: 'ABY-MAROON-1', name: 'x', price: 1, quantity: 5, size: 'Body 44 · Length 52', color: 'maroon' });
    return cart.map((l) => [l.color, l.quantity]);
  });
  expect(lines).toEqual([['maroon', 2]]);
});
