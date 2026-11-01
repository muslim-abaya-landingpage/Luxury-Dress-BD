// Storefront side of Product Manager variations: the product page shows the chosen variation's own
// price (with its sale), the cart charges it, and a switched-off variation cannot be added.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const real = fs.readFileSync(path.join(__dirname, '../../category-products.js'), 'utf8');
const marker = 'id: "ABY-MAROON-1",';
if (real.indexOf(marker) === -1) throw new Error('fixture product missing');
const catalog = real.replace(marker, marker + '\n      variations: [{size: "Length 56", price: 1450, regularPrice: 1600}, {type: "Abaya Only", size: "Length 52", enabled: false}],');

async function useCatalog(page) {
  await page.route(/\/category-products\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: catalog }));
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
}
const cart = (page) => page.evaluate(() => (typeof window.loadStoreCart === 'function' ? window.loadStoreCart({ readOnly: true }) : []));

test('product page: variation price and sale, cart charges it, switched-off variation is blocked', async ({ page }) => {
  await useCatalog(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product/ABY-MAROON-1');
  const root = page.locator('.pqv-muslim-abaya').first();
  const price = root.locator('#pqvPrice');
  await expect(price).toBeVisible();
  await root.locator('.pqv-length-opt[data-length-value="56"]').first().click();
  await expect(price.locator('del')).toHaveText('৳1600');
  await expect(price.locator('.ma-price-now')).toHaveText('৳1450');
  await expect(price).toHaveAttribute('data-price', '1450');
  await root.locator('.pqv-act-cart[data-product-idx]:not(.pqv-wholesale-add)').first().click();
  await expect.poll(async () => (await cart(page)).length).toBe(1);
  const line = (await cart(page))[0];
  expect(line.price).toBe(1450);
  expect(line.size).toMatch(/Length 56$/);

  // Start again (the cart drawer is open now).
  await page.goto('/product/ABY-MAROON-1');
  await root.locator('.pqv-length-opt[data-length-value="50"]').first().click();
  await expect(price).toHaveAttribute('data-price', '1250');
  await root.locator('.pqv-type-opt', { hasText: 'Abaya Only' }).first().click();
  await root.locator('.pqv-length-opt[data-length-value="52"]').first().click();
  await expect(root.locator('.pqv-act-cart[data-product-idx]:not(.pqv-wholesale-add)').first()).toBeDisabled();
  await expect(root.locator('.pqv-act-cart[data-product-idx]:not(.pqv-wholesale-add)').first()).toHaveText('Unavailable');
  await root.locator('.pqv-length-opt[data-length-value="54"]').first().click();
  await expect(root.locator('.pqv-act-cart[data-product-idx]:not(.pqv-wholesale-add)').first()).toBeEnabled();
  await expect(price).toHaveAttribute('data-price', '1000');
});
