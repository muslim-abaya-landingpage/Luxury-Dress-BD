const { test, expect } = require('@playwright/test');

const TEST_CART = [
  {
    id: 'DR-01',
    name: 'Baby Pink Floral',
    price: 550,
    quantity: 1,
    image: 'images/Baby-Pink-Floral-Print.jpeg',
    category: 'premium-two-piece',
    selected: true,
  },
];

const API_GLOB = 'https://script.google.com/**';

function parseRequestFields(request) {
  const raw = request.postData() || '';
  const contentType = request.headers()['content-type'] || '';
  if (/application\/x-www-form-urlencoded/i.test(contentType)) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  const boundary = contentType.match(/boundary=([^;]+)/i)?.[1];
  if (!boundary) return Object.fromEntries(new URLSearchParams(raw));
  const fields = {};
  for (const part of raw.split(`--${boundary}`)) {
    const match = part.match(/name="([^"]+)"\r?\n(?:[^\r\n]*\r?\n)*\r?\n([\s\S]*?)\r?\n$/);
    if (match) fields[match[1]] = match[2];
  }
  return fields;
}

async function mockAppsScript(page, respondToOrder) {
  const orderRequests = [];
  await page.route(API_GLOB, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': '*',
        },
      });
    }
    const fields = request.method() === 'POST' ? parseRequestFields(request) : {};
    if (fields.RecordType === 'Order') {
      orderRequests.push(fields);
      const body = await respondToOrder(fields);
      return route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': '*',
        },
        body,
      });
    }
    const body = request.method() === 'GET' && new URL(request.url()).searchParams.get('RecordType') === 'OrderSchema'
      ? JSON.stringify({ ok: true, version: 'e2e-mock', columns: { size: 8, total: 9, orderId: 10, status: 11 } })
      : 'Muslim Abaya API OK';
    return route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      headers: { 'access-control-allow-origin': '*' },
      body,
    });
  });
  return orderRequests;
}

async function openCheckoutWithCart(page, cart = TEST_CART) {
  // The app mirrors this fixture to five storage keys; seed one canonical key before app scripts run.
  await page.addInitScript((items) => {
    if (sessionStorage.getItem('e2e-cart-seeded') !== '1') {
      localStorage.setItem('secured_checkout_cart', JSON.stringify(items));
      sessionStorage.setItem('e2e-cart-seeded', '1');
    }
  }, cart);
  await page.goto('/checkout.html');
  await expect.poll(() => page.evaluate(() => window.getSiteApiUrl?.() || '')).not.toBe('');
  await expect(page.locator('#orderSummary')).toBeVisible();
  await expect(page.locator('#userArea option[value="80"]')).toBeAttached({ timeout: 10_000 });
  await page.locator('#userArea').selectOption('80');
  await expect(page.locator('#userThana option').nth(1)).toBeAttached({ timeout: 10_000 });
}

async function fillValidDeliveryDetails(page) {
  await page.locator('#userName').fill('E2E Test Customer');
  await page.locator('#userPhone').fill('01712345678');
  await page.locator('#userEmail').fill('e2e@example.invalid');
  await page.locator('#userAddr').fill('House 12, Road 4, Mirpur, Dhaka');
  await page.locator('#userArea').selectOption('80');
  await expect(page.locator('#userThana option').nth(1)).toBeAttached();
  await page.locator('#userThana').selectOption({ index: 1 });
}

test.describe('Luxury Dress BD — integration / E2E', () => {
  test('critical storefront pages return successfully and render a title', async ({ page }) => {
    await mockAppsScript(page, async () => 'Success|E2E-NOT-USED');
    const paths = [
      '/index.html',
      '/abaya.html',
      '/category.html',
      '/product/DR-01.html',
      '/checkout.html',
      '/signin.html',
      '/signup.html',
      '/order-track.html',
      '/terms.html',
      '/privacy.html',
      '/refund.html',
    ];
    for (const path of paths) {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response, `${path} should return a document response`).not.toBeNull();
      expect(response.status(), `${path} HTTP status`).toBeLessThan(400);
      await expect.poll(() => page.title()).not.toBe('');
    }
  });

  test('checkout reads cart and calculates district delivery and free shipping at 3 items', async ({ page }) => {
    await mockAppsScript(page, async () => 'Success|E2E-NOT-USED');
    await openCheckoutWithCart(page, [
      { id: 'E2E-ITEM-1', name: 'E2E Fixture Dress', price: 550, quantity: 2, selected: true },
      { id: 'E2E-ITEM-2', name: 'Unselected Fixture Dress', price: 900, quantity: 2, selected: false },
    ]);

    await expect(page.locator('#side-subtotal')).toContainText('1,100');
    await page.locator('#userArea').selectOption('80');
    await expect(page.locator('#side-delivery')).toContainText('80');
    await expect(page.locator('#side-total')).toContainText('1,180');

    await page.locator('#orderSummary').getByRole('button', { name: 'Increase quantity' }).click();
    await expect(page.locator('#side-subtotal')).toContainText('1,650');
    await expect(page.locator('#side-delivery')).toContainText('0');
    await expect(page.locator('#side-total')).toContainText('1,650');
  });

  test('valid COD order posts expected fields to a mocked API, shows order ID, and clears cart', async ({ page }) => {
    const orders = await mockAppsScript(page, async () => 'Success|E2E-ORDER-0001');
    await openCheckoutWithCart(page);
    await fillValidDeliveryDetails(page);
    await page.locator('#agreeTerms').check({ force: true });
    await page.locator('#submitBtn').click();

    await expect(page).toHaveURL(/thank-you/);
    await expect(page.locator('#orderIdLine')).toContainText('E2E-ORDER-0001');
    expect(orders).toHaveLength(1);
    expect(orders[0].RecordType).toBe('Order');
    expect(orders[0].Name).toBe('E2E Test Customer');
    expect(orders[0].Phone).toBe('01712345678');
    expect(orders[0].District).toBe('ঢাকা');
    expect(orders[0].Thana).toBeTruthy();
    expect(orders[0].Quantity).toBe('1');
    expect(orders[0].Total).toBe('630'); // ৳550 item + ৳80 Dhaka delivery
    expect(orders[0].PaymentMethod).toBe('Cash On Delivery');
    expect(JSON.parse(orders[0].CartJSON)).toEqual([
      expect.objectContaining({ id: 'DR-01', qty: 1, price: 550 }),
    ]);
    expect(await page.evaluate(() => localStorage.getItem('secured_checkout_cart'))).toBeNull();
  });

  test('backend rejection leaves the order/cart recoverable and offers retry', async ({ page }) => {
    const orders = await mockAppsScript(page, async () => 'Error|Synthetic backend rejection');
    await openCheckoutWithCart(page);
    await fillValidDeliveryDetails(page);
    await page.locator('#agreeTerms').check({ force: true });
    await page.locator('#submitBtn').click();

    await expect(page.locator('#checkoutModal')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#checkoutModalTitle')).toHaveText('Order did not go through online');
    await expect(page.locator('#checkoutModalMessage')).toContainText('Synthetic backend rejection');
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    expect(orders).toHaveLength(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('secured_checkout_cart')).length)).toBe(1);
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.locator('#checkoutModal')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#submitBtn')).toBeEnabled();
  });

  test('required checkout details, Terms acceptance, and payment reference block submission', async ({ page }) => {
    const orders = await mockAppsScript(page, async () => 'Success|E2E-SHOULD-NOT-SEND');
    await openCheckoutWithCart(page);
    await page.locator('#submitBtn').click();
    await expect(page.locator('#checkoutModal')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.locator('#checkoutModalMessage')).toContainText('valid name');
    await page.getByRole('button', { name: 'OK' }).click();

    // Invalid client-side submissions must not consume the valid-order cooldown.
    await fillValidDeliveryDetails(page);
    await page.locator('#submitBtn').click();
    await expect(page.locator('#termsError')).toHaveClass(/show/);
    expect(orders).toHaveLength(0);

    await page.locator('#agreeTerms').check({ force: true });
    await page.locator('label.pm-option[data-pm="bkash"]').scrollIntoViewIfNeeded();
    await page.locator('label.pm-option[data-pm="bkash"]').click();
    await page.locator('#submitBtn').click();
    await expect(page.locator('#checkoutModalMessage')).toContainText('Transaction ID');
    expect(orders).toHaveLength(0);
    await page.getByRole('button', { name: 'OK' }).click();

    await page.locator('#paymentTxnId').fill('TXN-E2E-1234');
    await page.locator('#submitBtn').click();
    await expect(page).toHaveURL(/thank-you/);
    expect(orders).toHaveLength(1);
    expect(orders[0].PaymentMethod).toBe('bKash');
    expect(orders[0].TransactionID).toBe('TXN-E2E-1234');
  });

  test('admin order data is not exposed to an unauthenticated visitor', async ({ page }) => {
    await mockAppsScript(page, async () => 'Success|E2E-NOT-USED');
    await page.goto('/admin-orders.html');
    await expect(page).toHaveURL(/admin-login\.html\?next=/, { timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText('Customer phone');
  });

  test('checkout layout does not create horizontal overflow on a mobile viewport', async ({ page }) => {
    await mockAppsScript(page, async () => 'Success|E2E-NOT-USED');
    await page.setViewportSize({ width: 390, height: 844 });
    await openCheckoutWithCart(page);
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
});
