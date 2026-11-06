// Free-delivery progress in the cart drawer, and the order page's "অগ্রিম ডেলিভারি চার্জ" / "রিভিউ চান" WhatsApp buttons.
const { test, expect } = require('@playwright/test');

test('cart drawer tells how many more pieces make delivery free', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/');
  await page.waitForFunction(() => typeof window.renderCartList === 'function' && typeof window.persistStoreCart === 'function' && document.getElementById('cart-drawer-freeship'));
  const show = (l) => page.evaluate((x) => { window.persistStoreCart(x); window.openCartDrawer(); }, l);
  const box = page.locator('#cart-drawer-freeship');
  const line = (qty) => ({ id: 'ABY-1', name: 'Abaya', price: 1500, quantity: qty, category: 'abaya', image: '' });
  await show([]);
  await expect(box).toBeHidden();
  await show([line(1)]);
  await expect(box).toBeVisible();
  await expect(box).toContainText('আর ২টি পণ্য যোগ করলে');
  await page.screenshot({ path: 'test-results/cart-freeship-1.png' });
  await show([line(2)]);
  await expect(box).toContainText('আর ১টি পণ্য');
  await show([line(3)]);
  await expect(box).toContainText('ডেলিভারি একদম ফ্রি');
  await page.screenshot({ path: 'test-results/cart-freeship-3.png' });
  await show([line(2)]);
  await page.goto('/checkout.html');
  await expect(page.locator('#side-freeship')).toContainText('আর ১টি পণ্য');
  await page.locator('#side-freeship').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/checkout-freeship.png' });
  expect(errors).toEqual([]);
});

function adminMocks(order, history) {
  return async (page) => {
    await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript',
      body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin",name:"QA Owner"});}};' }));
    await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: [
      'window.MaAdmin={getSession:()=>({token:"t",role:"admin",name:"QA"}),verifySession:()=>Promise.resolve({ok:true,role:"admin"}),',
      ' cached:()=>null, markPendingSave:()=>{}, clearPendingSave:()=>{},',
      ' call:(type)=>{ if(type==="AdminOrderGet")return Promise.resolve({ok:true,order:' + JSON.stringify(order) + ',statuses:["Pending","Confirmed","Delivered"],couriers:["Steadfast"],history:' + JSON.stringify(history) + '});',
      '   return Promise.resolve({ok:true,staff:[]});}, logout:()=>{}};'].join('\n') }));
    await page.route('**/api/admin-ip', (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"order":null,"ips":[]}' }));
  };
}
const base = { row: 2, time: '01-11-2026 10:00', name: 'Nusrat', phone: '01711111111', qty: 1, charge: 130, address: 'Rajshahi',
  design: 'Abaya × 1', total: 1630, subtotal: 1500, orderId: 'MA-BOOST', items: ['Abaya × 1'], courierStatus: '', tracking: '',
  consignmentId: '', district: 'রাজশাহী', payment: 'Cash On Delivery', source: 'Website', adminNote: '', courierNote: '', advance: 0, discount: 0 };

test('new customer: advance-charge button is suggested; no review button before delivery', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await adminMocks(Object.assign({}, base, { status: 'Pending' }), { stats: { total: 1, delivered: 0, cancelled: 0, fake: 0, returned: 0 }, risk: 'low', successRate: null, recent: [] })(page);
  await page.goto('/admin-order.html?id=MA-BOOST');
  const adv = page.locator('#otWaAdvance');
  await expect(adv).toBeVisible();
  await expect(adv).toHaveClass(/ot-suggest/);
  await expect(adv).toHaveAttribute('title', /নতুন কাস্টমার/);
  const href = await adv.getAttribute('href');
  expect(decodeURIComponent(href)).toContain('ডেলিভারি চার্জ ৳130 অগ্রিম');
  await expect(page.locator('#otWaReview')).toBeHidden();
  await adv.scrollIntoViewIfNeeded(); await page.locator('.pn-actions-row').screenshot({ path: 'test-results/order-advance-button.png' });
  await page.fill('#fAdvance', '130');
  await adv.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
});

test('delivered order: review button opens WhatsApp with the Google review link', async ({ page }) => {
  await adminMocks(Object.assign({}, base, { status: 'Delivered' }), { stats: { total: 2, delivered: 2, cancelled: 0, fake: 0, returned: 0 }, risk: 'low', successRate: 100, recent: [] })(page);
  await page.goto('/admin-order.html?id=MA-BOOST');
  const rev = page.locator('#otWaReview');
  await expect(rev).toBeVisible();
  expect(decodeURIComponent(await rev.getAttribute('href'))).toContain('search.google.com/local/writereview?placeid=');
  await expect(page.locator('#otWaAdvance')).toBeHidden();
  await page.locator('.pn-actions-row').screenshot({ path: 'test-results/order-review-button.png' });
});
