const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ORDER = { row: 52, time: '11-10-2026 12:29', name: 'Nahid Nahar', phone: '01886928517', qty: 1, charge: 70, address: 'House 12, Road 7, Mirpur 10, Dhaka',
  design: '1. Kurti × 1', size: '', items: ['Kurti × 1'], total: 1570, subtotal: 1500, couponCode: '', couponDiscount: 0, discount: 0, advance: 0, due: 1570,
  orderId: 'MA-1', status: 'Confirmed', tracking: '', consignmentId: '', courierStatus: '', district: 'ঢাকা', payment: 'Cash On Delivery', txn: '',
  customerNote: '', adminNote: '', courierNote: '', assignedTo: '', source: 'Website', courier: 'Steadfast', blocked: false };

async function stubPage(page, updateBehaviour) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin",name:"Owner"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: `
    window.__pending = {}; window.__updates = [];
    window.MaAdmin = {
      cached: function () { return null; },
      markPendingSave: function (id, expect) { window.__pending[id] = expect; },
      clearPendingSave: function (id) { delete window.__pending[id]; },
      call: function (type, f) {
        if (type === 'AdminOrderUpdate') { window.__updates.push(f); return new Promise(function (ok, fail) { setTimeout(function () {
          ${updateBehaviour === 'fail' ? "var e = new Error('INVALID_ADVANCE'); fail(e);" : "var o = Object.assign({}, " + JSON.stringify(ORDER) + ", { adminNote: f.AdminNote }); ok({ ok: true, order: o });"}
        }, 1500); }); }
        var res = type === 'AdminOrderGet' ? { ok: true, order: ${JSON.stringify(ORDER)}, prevId: '', nextId: '', history: { stats: { total: 1 }, recent: [] },
          statuses: ['Pending','Confirmed','Shipped','Delivered','Cancelled','Fake'], couriers: ['Steadfast'] } : { ok: true, staff: [] };
        return Promise.resolve(res);
      } };` }));
}

test('save feels instant: the form counts as saved at once and leaving the page is not blocked', async ({ page }) => {
  await stubPage(page, 'ok');
  await page.goto('/admin-order.html?id=MA-1');
  await expect(page.locator('#fAdminNote')).toBeVisible();
  await page.fill('#fAdminNote', 'call before delivery');
  await expect(page.locator('#btnSave')).toHaveClass(/wo-save-dirty/);
  await page.click('#btnSave');
  await expect(page.locator('#btnSave')).toContainText('সেভ হচ্ছে');
  await expect(page.locator('#btnSave')).not.toHaveClass(/wo-save-dirty/);
  expect(await page.evaluate(() => window.__pending['MA-1'].AdminNote)).toBe('call before delivery');
  let dialog = false;
  page.on('dialog', (d) => { dialog = true; d.dismiss(); });
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '#x'; document.body.appendChild(a); });
  await expect(page.locator('#btnSave')).toContainText('Update Order', { timeout: 4000 });
  expect(await page.evaluate(() => Object.keys(window.__pending).length)).toBe(0);
  await expect(page.locator('#fAdminNote')).toHaveValue('call before delivery');
  expect(dialog).toBe(false);
});

test('a refused save keeps the edits on screen and marks them unsaved again', async ({ page }) => {
  await stubPage(page, 'fail');
  await page.goto('/admin-order.html?id=MA-1');
  await expect(page.locator('#fAdminNote')).toBeVisible();
  await page.fill('#fAdminNote', 'needs a retry');
  await page.click('#btnSave');
  await expect(page.locator('#btnSave')).toContainText('Update Order', { timeout: 4000 });
  await expect(page.locator('#btnSave')).toHaveClass(/wo-save-dirty/);
  await expect(page.locator('#fAdminNote')).toHaveValue('needs a retry');
  await expect(page.locator('#oError')).toContainText('সেভ হয়নি');
  expect(await page.evaluate(() => Object.keys(window.__pending).length)).toBe(0);
});

test('a save that never reported back is checked on the next admin page', async ({ page }) => {
  const api = 'https://script.google.com/macros/s/TEST/exec';
  const src = fs.readFileSync(path.join(__dirname, '../../admin-api.js'), 'utf8');
  await page.route('**/api/admin-read', (r) => r.fulfill({ status: 404, body: '' }));
  await page.route(api, (r) => {
    const body = new URLSearchParams(r.request().postData() || '');
    const order = Object.assign({}, ORDER, { orderId: body.get('OrderId'), adminNote: body.get('OrderId') === 'MA-OK' ? 'saved note' : 'old note' });
    r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, order }) });
  });
  await page.goto('/index.html');
  await page.evaluate(({ src, api }) => {
    localStorage.setItem('ma_admin_session', JSON.stringify({ token: 'tok', role: 'admin', expires: Date.now() + 3600000 }));
    const at = Date.now() - 10000;
    localStorage.setItem('ma_admin_pending_saves', JSON.stringify({
      'MA-OK': { at, expect: { Status: 'Confirmed', Charge: 70, Advance: 0, Discount: 0, AdminNote: 'saved note' } },
      'MA-LOST': { at, expect: { Status: 'Confirmed', Charge: 70, Advance: 0, Discount: 0, AdminNote: 'new note' } },
    }));
    window.__warnings = [];
    window.MaPanel = { toast: (m, err) => window.__warnings.push(m) };
    window.MA_ADMIN_CONFIG = { apiUrl: api };
    (0, eval)(src);
    window.MaAdmin.checkPendingSaves();
  }, { src, api });
  await expect.poll(() => page.evaluate(() => window.__warnings.length)).toBe(1);
  const warnings = await page.evaluate(() => window.__warnings);
  expect(warnings[0]).toContain('MA-LOST');
  expect(await page.evaluate(() => localStorage.getItem('ma_admin_pending_saves'))).toBeNull();
});
