// Admin order page: hold banner for risky orders, IP card, IP block/unblock, and the confirm guard
// before Confirmed / Send to Steadfast. Admin API and /api/admin-ip are mocked.
const { test, expect } = require('@playwright/test');

const order = {
  row: 2, time: '24-10-2026 01:00', name: 'Risky Buyer', phone: '01711111111', qty: 1, charge: 70,
  address: 'House 1, Road 2, Dhaka', design: 'Abaya × 1', total: 1650, subtotal: 1580, orderId: 'MA-IP-TEST',
  status: 'Pending', items: ['Abaya × 1'], courierStatus: '', tracking: '', consignmentId: '', district: 'ঢাকা',
  payment: 'Cash On Delivery', source: 'Website', adminNote: '', courierNote: '', advance: 0, discount: 0,
};

async function mockAdmin(page, { risk = 'high', ipLookup }) {
  const history = { stats: { total: 3, delivered: 1, cancelled: 1, fake: 1, returned: 0 }, risk, successRate: 33, recent: [] };
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript',
    body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin",name:"QA Owner"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: [
    'window.__calls=[];window.MaAdmin={',
    ' getSession:()=>({token:"tok-123",role:"admin",name:"QA Owner"}),',
    ' verifySession:()=>Promise.resolve({ok:true,role:"admin",name:"QA Owner"}),',
    ' cached:()=>null, markPendingSave:()=>{}, clearPendingSave:()=>{},',
    ' call:(type,f)=>{window.__calls.push(type);',
    '   if(type==="AdminOrderGet")return Promise.resolve({ok:true,order:' + JSON.stringify(order) + ',statuses:["Pending","Confirmed","Cancelled"],couriers:["Steadfast"],history:' + JSON.stringify(history) + '});',
    '   if(type==="AdminOrderUpdate")return Promise.resolve({ok:true,order:Object.assign({},' + JSON.stringify(order) + ',{status:f.Status})});',
    '   return Promise.resolve({ok:true,staff:[]});},',
    ' logout:()=>{}};'].join('\n') }));
  const ipCalls = [];
  await page.route('**/api/admin-ip', async (route) => {
    const p = Object.fromEntries(new URLSearchParams(route.request().postData() || ''));
    ipCalls.push(p);
    let body = ipLookup;
    if (p.Action === 'block') body = { ok: true, blocked: { key: p.Ip, reason: p.Reason, expiresAt: Date.now() + 7 * 864e5 } };
    if (p.Action === 'list') body = { ok: true, blocked: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return ipCalls;
}

const sharedIp = {
  ok: true,
  order: { ip: '103.4.5.6', country: 'BD', network: 'Grameenphone', device: 'Android · Facebook app', time: Date.now() - 3600e3, outcome: 'saved' },
  ips: [{ ip: '103.4.5.6', blockKey: '103.4.5.6', blocked: null, ordersFromIp30d: 6, ordersByThisPhone: 2,
    otherPhones: [{ phone: '01811111111', orders: 2 }, { phone: '01822222222', orders: 1 }, { phone: '01833333333', orders: 1 }] }],
};

test('risky order shows the hold banner and IP card; blocking sends the right request', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const ipCalls = await mockAdmin(page, { ipLookup: sharedIp });
  await page.goto('/admin-order.html?id=MA-IP-TEST');
  const hold = page.locator('#oHold');
  await expect(hold).toBeVisible();
  await expect(hold).toContainText('ঝুঁকি বেশি');
  await expect(hold).toContainText('সফলতা 33%');
  await expect(hold).toContainText('আরও 3টি ভিন্ন নম্বরে');
  await expect(page.locator('#ipBody')).toContainText('103.4.5.6');
  await expect(page.locator('#ipBody')).toContainText('Android · Facebook app');
  await expect(page.locator('#ipBody')).toContainText('01811111111');
  expect(ipCalls[0]).toMatchObject({ Action: 'lookup', OrderId: 'MA-IP-TEST', Phone: '01711111111', Token: 'tok-123' });
  await page.screenshot({ path: 'test-results/admin-order-ip-hold.png', fullPage: true });

  await page.selectOption('#ipDays0', '30');
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('ফেক অর্ডার') : d.accept()));
  await page.click('[data-ip-block="103.4.5.6"]');
  await expect.poll(() => ipCalls.find((c) => c.Action === 'block')).toMatchObject({ Ip: '103.4.5.6', Days: '30', Reason: 'ফেক অর্ডার' });
  expect(errors).toEqual([]);
});

test('Confirmed on a held order asks first; cancelling keeps the order unsaved', async ({ page }) => {
  await mockAdmin(page, { ipLookup: { ok: true, order: null, ips: [] } });
  await page.goto('/admin-order.html?id=MA-IP-TEST');
  await expect(page.locator('#oHold')).toBeVisible();
  await expect(page.locator('#ipBody')).toContainText('IP রেকর্ড নেই');
  await page.selectOption('#fStatus', 'Confirmed');
  let asked = '';
  page.once('dialog', (d) => { asked = d.message(); d.dismiss(); });
  await page.click('#btnSave');
  expect(asked).toContain('হোল্ডে আছে');
  expect(await page.evaluate(() => window.__calls.filter((c) => c === 'AdminOrderUpdate').length)).toBe(0);
  page.once('dialog', (d) => d.accept());
  await page.click('#btnSave');
  await expect.poll(() => page.evaluate(() => window.__calls.filter((c) => c === 'AdminOrderUpdate').length)).toBe(1);
});

test('a clean customer has no hold and saves without an extra question', async ({ page }) => {
  await mockAdmin(page, { risk: 'low', ipLookup: { ok: true, order: null, ips: [] } });
  await page.goto('/admin-order.html?id=MA-IP-TEST');
  await expect(page.locator('#ipBody')).toContainText('IP রেকর্ড নেই');
  await expect(page.locator('#oHold')).toBeHidden();
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs++; d.accept(); });
  await page.selectOption('#fStatus', 'Confirmed');
  await page.click('#btnSave');
  await expect.poll(() => page.evaluate(() => window.__calls.filter((c) => c === 'AdminOrderUpdate').length)).toBe(1);
  expect(dialogs).toBe(0);
});
