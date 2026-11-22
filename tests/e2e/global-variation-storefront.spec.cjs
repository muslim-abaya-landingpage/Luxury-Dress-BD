// End-to-end purchasable Global Attribute variation: storefront → cart → checkout → mocked order.
// Catalog and Apps Script requests are intercepted; no live order or stock is changed.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PRODUCT_ID = 'ABY-MAROON-1';
const ATTRIBUTE = { id: 'fabric-type', name: 'Fabric Type', variation: true, visible: true,
  terms: [{ id: 'cotton', name: 'Cotton' }, { id: 'linen', name: 'Linen' }] };
const VARIATIONS = [
  { size: '44', globalAttributes: [{ id: 'fabric-type', termId: 'cotton', name: 'Fabric Type', term: 'Cotton' }], sku: 'E2E-MAROON-COTTON', price: 1200 },
  { size: '44', globalAttributes: [{ id: 'fabric-type', termId: 'linen', name: 'Fabric Type', term: 'Linen' }], sku: 'E2E-MAROON-LINEN', price: 1450 }
];

async function installFixture(page) {
  // Patch the established Maroon Abaya Set fixture in-memory, matching the production catalog loader.
  const realCatalog = fs.readFileSync(path.join(__dirname, '../../category-products.js'), 'utf8');
  const marker = 'id: "ABY-MAROON-1",';
  if (!realCatalog.includes(marker)) throw new Error('Maroon Abaya Set test fixture missing');
  const patchedCatalog = realCatalog.replace(marker, marker + '\n      globalAttributes: ' +
    JSON.stringify([ATTRIBUTE]) + ',\n      variations: ' + JSON.stringify(VARIATIONS) + ',');
  await page.route('**/category-products.js*', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: patchedCatalog }));
  await page.route(/googletagmanager|gtm|analytics|connect.facebook|clarity/, (route) =>
    route.fulfill({ status: 204, body: '' }));
}

async function mockOrderApi(page) {
  const orders = [];
  await page.route(/script.google.com/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: {
      'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': '*'
    } });
    const fields = {};
    if (req.method() === 'POST') new URLSearchParams(req.postData() || '').forEach((v, k) => { fields[k] = v; });
    if (fields.RecordType === 'Order') {
      orders.push(fields);
      return route.fulfill({ status: 200, contentType: 'text/plain',
        headers: { 'access-control-allow-origin': '*' }, body: 'Success|E2E-GLOBAL-VAR-ORDER' });
    }
    const body = req.method() === 'GET' && new URL(req.url()).searchParams.get('RecordType') === 'OrderSchema'
      ? JSON.stringify({ ok: true, version: 'e2e-mock', columns: { size: 8, total: 9, orderId: 10, status: 11 } })
      : 'Muslim Abaya API OK';
    return route.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, body });
  });
  return orders;
}

test('Global Attribute variation keeps its own SKU and price through cart and mocked checkout order', async ({ page }) => {
  await installFixture(page);
  const orders = await mockOrderApi(page);
  await page.goto('/product.html?id=ABY-MAROON-1');
  await expect(page.locator('#pdGlobalAttributeGroup')).toBeVisible();
  await expect(page.locator('#pdGlobalAttributeGroup [data-global-term="cotton"]')).toBeVisible();
  await page.locator('#pdGlobalAttributeGroup [data-global-term="linen"]').click();
  await expect(page.locator('#pdPrice')).toContainText('1,450');
  await page.locator('#pdAddCart').click();

  const cartLine = await page.evaluate(() => window.loadStoreCart({ readOnly: true }).find((line) => line.id === 'ABY-MAROON-1'));
  expect(cartLine).toMatchObject({ id: PRODUCT_ID, price: 1450, variationSku: 'E2E-MAROON-LINEN' });
  expect(cartLine.globalAttributes).toEqual([{ id: 'fabric-type', termId: 'linen', name: 'Fabric Type', term: 'Linen' }]);

  await page.goto('/checkout.html');
  await expect(page.locator('#orderSummary')).toBeVisible();
  await expect(page.locator('#userArea option[value="80"]')).toBeAttached({ timeout: 10000 });
  await page.locator('#userName').fill('E2E Variation Customer');
  await page.locator('#userPhone').fill('01712345678');
  await page.locator('#userEmail').fill('variation-e2e@example.invalid');
  await page.locator('#userAddr').fill('House 12, Road 4, Mirpur, Dhaka');
  await page.locator('#userArea').selectOption('80');
  await expect(page.locator('#userThana option').nth(1)).toBeAttached();
  await page.locator('#userThana').selectOption({ index: 1 });
  await page.locator('#agreeTerms').check({ force: true });
  await page.locator('#submitBtn').click();

  await expect(page).toHaveURL(/thank-you/);
  await expect(page.locator('#orderIdLine')).toContainText('E2E-GLOBAL-VAR-ORDER');
  expect(orders).toHaveLength(1);
  expect(orders[0].RecordType).toBe('Order');
  const lines = JSON.parse(orders[0].CartJSON);
  expect(lines).toHaveLength(1);
  expect(lines[0]).toMatchObject({ id: PRODUCT_ID, qty: 1, price: 1450, variationSku: 'E2E-MAROON-LINEN' });
  expect(lines[0].globalAttributes).toEqual([{ id: 'fabric-type', termId: 'linen', name: 'Fabric Type', term: 'Linen' }]);
  expect(Number(orders[0].Total)).toBeGreaterThanOrEqual(1450);
  expect(await page.evaluate(() => localStorage.getItem('secured_checkout_cart'))).toBeNull();
});
