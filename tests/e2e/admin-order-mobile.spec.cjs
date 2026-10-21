const { test, expect } = require('@playwright/test');

const ORDER = { row: 52, time: '11-10-2026 12:29:00', name: 'Nahid Nahar', phone: '01886928517', qty: 3, charge: 0,
  address: 'House 12, Road 7, Block C, Mirpur 10, Dhaka 1216, near the big mosque', design: '1. Elegant Purple Floral Kurti (Size 38) × 1\n2. Premium Black Hafeza Set (Full Set) (Body 42 · Length 52) × 1\n3. Elegant Grey Leaf Print Kurti (Size 38) × 1',
  size: '1. 38\n2. Body 42 · Length 52\n3. 38', items: ['Elegant Purple Floral Kurti (Size 38) × 1', 'Premium Black Hafeza Set (Full Set) (Body 42 · Length 52) × 1', 'Elegant Grey Leaf Print Kurti (Size 38) × 1'],
  total: 2885, subtotal: 2885, couponCode: '', couponDiscount: 0, discount: 0, advance: 0, due: 2885, orderId: 'MA-20261011-4777', status: 'Delivered',
  tracking: 'SFR261012ST3714249BD', consignmentId: '12345678', courierStatus: 'delivered', district: 'ঢাকা', payment: 'Cash On Delivery', txn: '',
  customerNote: '', adminNote: '[কারণ: none] call before delivery', courierNote: '', assignedTo: '', source: 'Website', courier: 'Steadfast', blocked: false };

async function stub(page, delayMs) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin",name:"Owner"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: `
    window.__calls = [];
    window.MaAdmin = {
      cached: function (type) { return window.__seed && type === 'AdminOrderList' ? window.__seed : null; },
      call: function (type, f) { window.__calls.push(type);
        var res = type === 'AdminOrderGet' ? { ok: true, order: ${JSON.stringify(ORDER)}, prevId: 'MA-PREV', nextId: 'MA-NEXT',
          history: { stats: { total: 2, delivered: 2, cancelled: 0, fake: 0, returned: 0 }, recent: [] }, statuses: ['Pending','Confirmed','Shipped','Delivered','Cancelled','Fake'], couriers: ['Steadfast'] }
          : type === 'AdminOrderStaff' ? { ok: true, staff: ['Rafi'] } : type === 'AdminCourierTracking' ? { ok: true, courierStatus: 'delivered', events: [] } : { ok: true };
        return new Promise(function (ok) { setTimeout(function () { ok(res); }, ${delayMs || 0}); });
      } };` }));
}

test('order edit page on a phone: no sideways scroll, big tap targets, no iOS zoom on inputs', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stub(page, 0);
  await page.goto('/admin-order.html?id=MA-20261011-4777');
  await expect(page.locator('#oGrid')).toBeVisible();
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed'; })
      .slice(0, 8).map(el => el.tagName + '#' + el.id + '.' + String(el.className).split(' ')[0] + ' right=' + Math.round(el.getBoundingClientRect().right));
    const small = [...document.querySelectorAll('#oGrid button, #oGrid a.pn-btn, .pn-head button, .pn-head a')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height < 40; })
      .map(el => (el.id || el.textContent.trim().slice(0, 20)) + ' h=' + Math.round(el.getBoundingClientRect().height));
    const tinyInputs = [...document.querySelectorAll('#oGrid input, #oGrid select, #oGrid textarea')].filter(el => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map(el => el.id + ' ' + getComputedStyle(el).fontSize);
    return { scrollW: document.documentElement.scrollWidth, vw, wide, small, tinyInputs };
  });
  await page.screenshot({ path: '/tmp/claude-0/mob/order-mobile.png', fullPage: true });
  expect(m.scrollW).toBeLessThanOrEqual(m.vw);
  expect(m.tinyInputs).toEqual([]);
  expect(m.small).toEqual([]);

  // Items: own qty and own size per line
  await expect(page.locator('.wo-items-table tbody tr').nth(1)).toContainText('× 1');
  await expect(page.locator('.wo-items-table tbody tr').nth(1)).toContainText('Size: Body 42 · Length 52');
  await expect(page.locator('.wo-items-table tbody tr').nth(0)).not.toContainText('Body 42');

  // Save stays reachable halfway down the page
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight / 2));
  await page.waitForTimeout(150);
  const save = await page.locator('#btnSave').boundingBox();
  expect(save.y + save.height).toBeLessThanOrEqual(844);
  expect(save.y).toBeGreaterThan(700);

  // Every card uses the full width
  const widths = await page.evaluate(() => [...document.querySelectorAll('#oGrid .pn-card')].filter(c => c.offsetParent).map(c => Math.round(c.getBoundingClientRect().width)));
  expect(Math.min(...widths)).toBe(Math.max(...widths));

  // Status/pricing come before items on a phone
  const order = await page.evaluate(() => ['wo-general-card', 'wo-details-card', 'wo-pricing-card', 'wo-items-card'].map(c => document.querySelector('.' + c).getBoundingClientRect().top));
  expect(order).toEqual([...order].sort((a, b) => a - b));
});

test('order page shows the cached list row instantly and stays locked until live data arrives', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stub(page, 1500);
  await page.addInitScript((o) => { window.__seed = { orders: [Object.assign({}, o, { name: 'Cached Name' })], statuses: ['Pending', 'Delivered'] }; }, ORDER);
  await page.goto('/admin-order.html?id=MA-20261011-4777');
  await expect(page.locator('#oGrid')).toBeVisible({ timeout: 1000 });
  await expect(page.locator('#fName')).toHaveValue('Cached Name');
  await expect(page.locator('#fName')).toBeDisabled();
  await expect(page.locator('#btnSave')).toBeDisabled();
  await expect(page.locator('#oStaleNote')).toBeVisible();
  await expect(page.locator('#fName')).toHaveValue('Nahid Nahar', { timeout: 5000 });
  await expect(page.locator('#fName')).toBeEnabled();
  await expect(page.locator('#btnSave')).toBeEnabled();
  await expect(page.locator('#oStaleNote')).toBeHidden();
});
