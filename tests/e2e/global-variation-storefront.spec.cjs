// End-to-end purchasable Global Attribute variation: storefront → cart → checkout → mocked order.
// All catalog and Apps Script endpoints are intercepted; this test never creates a live order or changes stock.
const { test, expect } = require('@playwright/test');

const PRODUCT_ID = 'E2E-GLOBAL-VAR-1';
const ATTRIBUTE = { id: 'fabric-type', name: 'Fabric Type', variation: true, visible: true,
  terms: [{ id: 'cotton', name: 'Cotton' }, { id: 'linen', name: 'Linen' }] };
const VARIATIONS = [
  { size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'cotton', name: 'Fabric Type', term: 'Cotton' }], sku: 'E2E-KURTI-COTTON', price: 1200 },
  { size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'linen', name: 'Fabric Type', term: 'Linen' }], sku: 'E2E-KURTI-LINEN', price: 1450 }
];
const PRODUCT = { id: PRODUCT_ID, name: 'E2E Global Variation Kurti', category: 'tops-kurti', kind: 'simple',
  productType: 'simple', price: 900, image: '/images/Baby-Pink-Floral-Print.jpeg', sizes: ['M'],
  globalAttributes: [ATTRIBUTE], variations: VARIATIONS };

async function installFixture(page) {
  await page.route('**/category-products.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()) + '\n;window.CATEGORY_PRODUCTS=window.CATEGORY_PRODUCTS||{};window.CATEGORY_PRODUCTS["tops-kurti"]=window.CATEGORY_PRODUCTS["tops-kurti"]||[];window.CATEGORY_PRODUCTS["tops-kurti"].push(' + JSON.stringify(PRODUCT) + ');';
    await route.fulfill({ response, body });
  });
  await page.route('**/catalog-validation.json*', async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    data.products = (data.products || []).filter((p) => p.id !== PRODUCT_ID);
    data.products.push({ id: PRODUCT_ID, name: PRODUCT.name, category: 'tops-kurti', price: 900,
      sizes: ['M'], globalAttributes: [ATTRIBUTE], variations: VARIATIONS });
    await route.fulfill({ response, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|clarity\.ms/, (route) => route.fulfill({ status: 204, body: '' }));
}

async function mockOrderApi(page) {
  const orders = [];
  await page.route(/script\.google\.com/, async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': '*' } });
    const fields = {};
    if (req.method() === 'POST') {
      const raw = req.postData() || '';
      new URLSearchParams(raw).forEach((v, k) => { fields[k] = v; });
    }
    if (fields.RecordType === 'Order') {
      orders.push(fields);
      return route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: 'Success|E2E-GLOBAL-VAR-ORDER' });
    }
    const body = req.method() === 'GET' && new URL(req.url()).searchParams.get('RecordType') === 'OrderSchema'
      ? JSON.stringify({ ok: true, version: 'e2e-mock', columns: { size: 8, total: 9, orderId: 10, status: 11 } }) : 'Muslim Abaya API OK';
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
  });
  return orders;
}

test('Global Attribute variation keeps its own SKU and price through cart and mocked checkout order', async ({ page }) => {
  await installFixture(page);
  const orders = await mockOrderApi(page);
  await page.goto('/product.html?id=' + PRODUCT_ID);
  await expect(page.locator('#pdGlobalAttributeGroup')).toBeVisible();
  await expect(page.locator('#pdGlobalAttributeGroup [data-global-term="cotton"]')).toBeVisible();
  await page.locator('#pdGlobalAttributeGroup [data-global-term="linen"]').click();
  await expect(page.locator('#pdPrice')).toContainText('1,450');
  await page.locator('#pdAddCart').click();

  const cartLine = await page.evaluate(() => window.loadStoreCart({ readOnly: true }).find((line) => line.id === 'E2E-GLOBAL-VAR-1'));
  expect(cartLine).toMatchObject({ id: PRODUCT_ID, price: 1450, variationSku: 'E2E-KURTI-LINEN' });
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
  expect(lines[0]).toMatchObject({ id: PRODUCT_ID, qty: 1, price: 1450, variationSku: 'E2E-KURTI-LINEN' });
  expect(lines[0].globalAttributes).toEqual([{ id: 'fabric-type', termId: 'linen', name: 'Fabric Type', term: 'Linen' }]);
  expect(orders[0].Total).toBe('1530'); // ৳1450 item + ৳80 Dhaka delivery
  expect(await page.evaluate(() => localStorage.getItem('secured_checkout_cart'))).toBeNull();
});
