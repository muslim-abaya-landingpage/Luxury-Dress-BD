const { test, expect } = require('@playwright/test');

async function stubAdmin(page, calls) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/admin-panel.js*', (r) => r.fulfill({ contentType: 'application/javascript', body:
    'window.MaPanel={init:function(){return Promise.resolve({ok:true});},toast:function(m,b){window.__toast=m;},esc:function(s){return String(s);}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: `
    window.MaAdmin = { call: function (type, f) {
      window.__calls.push([type, JSON.parse(JSON.stringify(f || {}))]);
      if (type === 'AdminOrderList') return Promise.resolve({ orders: [{ phone: '01711111111', name: 'Rahima Akter', address: 'House 3, Road 2, Mirpur 10', district: 'ঢাকা' }] });
      if (type === 'AdminCouponCheck') return Promise.resolve({ ok: true, discount: 100 });
      if (type === 'AdminOrderCreate') return Promise.resolve({ ok: true, orderId: 'MA-20261021-1234', row: 60, status: 'Confirmed' });
      if (type === 'AdminOrderGet') return Promise.resolve({ ok: true, order: { orderId: 'MA-20261021-1234' } });
      if (type === 'AdminSendCourier') return Promise.resolve({ ok: true });
      return Promise.resolve({ ok: true });
    } }; window.__calls = [];` }));
}

test('new order page: customer lookup, add item, coupon, create + send to courier', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? 'EID10' : undefined));
  await stubAdmin(page);
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto('/admin-order-new.html');
  await expect(page.locator('h1')).toHaveText('Add new order');
  await expect(page.locator('#noBillView')).toContainText('No billing address set.');

  // pick an existing customer → billing + shipping filled, Dhaka charge 80
  await expect.poll(() => page.locator('#noCustList option').count()).toBe(1);
  await page.fill('#noCustomer', 'Rahima Akter · 01711111111');
  await page.locator('#noCustomer').dispatchEvent('change');
  await expect(page.locator('#noBillView')).toContainText('01711111111');
  await expect(page.locator('#noShipView')).toContainText('Mirpur 10');
  await expect(page.locator('#noShipping')).toHaveValue('80');

  // add a catalogue product
  await page.click('#noAddBtn');
  const label = await page.locator('#noProdList option').first().getAttribute('value');
  await page.fill('#noProdSearch', label);
  await page.locator('#noProdSearch').dispatchEvent('change');
  await expect(page.locator('#noProdPick')).toBeVisible();
  await page.locator('#noSize').selectOption({ index: 1 });
  await page.fill('#noItemPrice', '1000');
  await page.click('#noAddPicked');
  await expect(page.locator('#noItems tr')).toHaveCount(1);
  await expect(page.locator('#noSub')).toHaveText('৳1,000');

  await page.click('#noCouponBtn');
  await expect(page.locator('#noCouponRow')).toBeVisible();
  await page.fill('#noAdvance', '200');
  await page.locator('#noAdvance').dispatchEvent('input');
  await expect(page.locator('#noTotal')).toHaveText('৳980');
  await expect(page.locator('#noDue')).toHaveText('৳780');
  await page.screenshot({ path: 'test-results/new-order-page.png', fullPage: true });

  await page.selectOption('#noStatus', 'Confirmed');
  await page.selectOption('#noAction', 'courier');
  await page.click('#noCreate');
  await expect(page.locator('#noStatusMsg')).toContainText('MA-20261021-1234');
  const calls = await page.evaluate(() => window.__calls.map((c) => c[0]));
  expect(calls.filter((c) => /Create|Update|Courier/.test(c))).toEqual(['AdminOrderCreate', 'AdminSendCourier']);
  const create = await page.evaluate(() => window.__calls.find((c) => c[0] === 'AdminOrderCreate')[1]);
  expect([create.Charge, create.Phone, create.Status, create.Advance, create.CouponCode]).toEqual([80, '01711111111', 'Confirmed', 200, 'EID10']);
  const items = JSON.parse(create.ItemsJSON);
  expect(items.length).toBe(1);
  expect(items[0].price).toBe(1000);
  expect(items[0].id).not.toBe('');
  expect(errors).toEqual([]);
});

test('new order page refuses to create without required details', async ({ page }) => {
  await stubAdmin(page);
  await page.goto('/admin-order-new.html');
  await page.click('#noCreate');
  await expect(page.locator('#noStatusMsg')).toContainText('নাম');
  expect(await page.evaluate(() => window.__calls.some((c) => c[0] === 'AdminOrderCreate'))).toBe(false);
});
