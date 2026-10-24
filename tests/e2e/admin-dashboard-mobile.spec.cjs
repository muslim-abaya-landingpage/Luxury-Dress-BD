const { test, expect } = require('@playwright/test');

const ORDERS = Array.from({ length: 12 }, (_, i) => ({
  row: 60 - i, time: `${String(10 + i).padStart(2, '0')}-10-2026 12:00`, name: 'Customer With A Fairly Long Name ' + i, phone: '0171111111' + (i % 3),
  qty: 2, charge: 70, address: 'House 12, Road 7, Mirpur 10, Dhaka', design: '1. Premium Black Hafeza Set (Full Set) (Body 42 · Length 52) × 1\n2. Elegant Grey Leaf Print Kurti × 1',
  total: 2885, orderId: 'MA-202610' + String(10 + i) + '-47' + i, status: i % 4 ? 'Confirmed' : 'Delivered', tracking: i % 2 ? 'SFR2610' + i : '',
  courierStatus: i % 2 ? 'partial_delivered' : '', district: 'ঢাকা', payment: 'Cash On Delivery',
}));

async function stub(page, { inboxDelayMs = 0 } = {}) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin",name:"Owner"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: `
    var ORDERS = ${JSON.stringify(ORDERS)};
    window.MaAdmin = {
      getSession: function () { return { token: 't', role: 'admin', name: 'Owner', email: 'owner@example.com' }; },
      verifySession: function () { return Promise.resolve(this.getSession()); },
      cached: function () { return null; },
      fetchOrders: function () { return Promise.resolve({ ok: true, orders: ORDERS, count: ORDERS.length }); },
      getStockVariants: function () { return Promise.resolve({ ok: true, defaultThreshold: 5, items: [
        { productId: 'P-LOW', productName: 'Black Abaya', variant: 'M', tracked: true, available: 2, threshold: 3, status: 'LOW' }] }); },
      inboxCall: function () { return new Promise(function (ok) { setTimeout(function () { ok({ ok: true, stats: { unread: 0 }, contacts: [] }); }, ${inboxDelayMs}); }); },
      call: function () { return Promise.resolve({ ok: true, orders: ORDERS, counts: { all: ORDERS.length } }); },
      getAnalyticsV2: function () { return Promise.resolve({ ok: true, summary: { totalOrders: 0 }, salesByMonth: [], topProducts: [], sourceBreakdown: [] }); },
      logout: function () {}
    };` }));
}

test('dashboard on a phone: nothing wider than the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await stub(page);
  await page.goto('/admin-dashboard.html');
  await expect(page.locator('#admOrdersBody .dz-order').first()).toBeVisible();
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll('body *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[hidden],details:not([open])'); })
      .slice(0, 8).map((el) => el.tagName + '#' + el.id + '.' + String(el.className).split(' ')[0] + ' right=' + Math.round(el.getBoundingClientRect().right));
    return { scrollW: document.documentElement.scrollWidth, vw, wide };
  });
  expect(m.wide).toEqual([]);
  expect(m.scrollW).toBeLessThanOrEqual(m.vw);
});

test('stock alerts appear without waiting for the slower inbox', async ({ page }) => {
  await stub(page, { inboxDelayMs: 4000 });
  await page.goto('/admin-dashboard.html');
  await expect(page.locator('#admStockAlerts')).toContainText('Black Abaya', { timeout: 2500 });
  // The loading label may be English and can disappear before this assertion runs.
  // Stock must appear promptly; the following assertion verifies the settled inbox result.
  await expect(page.locator('#admInboxAlerts')).toContainText('অপঠিত মেসেজ নেই', { timeout: 6000 });
});
