const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

const orders = [
  { orderId: 'MA-1', name: 'Rahima', phone: '01711111111', total: 1630, advance: 0, due: 1630, items: ['Black Abaya (Body 46) × 1'], address: 'Mirpur 10', district: 'ঢাকা', status: 'Pending' },
  { orderId: 'MA-2', name: 'Karima', phone: '01822222222', total: 1100, advance: 0, due: 1100, items: ['Kurti × 1'], address: 'Agrabad', district: 'চট্টগ্রাম', status: 'Cancelled', adminNote: '[কারণ: সাইজ মেলেনি]' },
  { orderId: 'MA-3', name: 'Salma', phone: '01933333333', total: 999, advance: 0, due: 999, items: ['Black Abaya (Body 46) × 1'], address: 'Uttara', district: 'ঢাকা', status: 'Confirmed', tracking: 'SF123' },
];

test('order list: WhatsApp confirm link, bulk select, courier send skips sent orders, report', async ({ page }) => {
  await page.setContent(`<!doctype html><html><body>
    <section id="ordInsights"></section><button id="ordRefresh">refresh</button>
    <div class="pn-table-wrap"><table><thead><tr><th><input type="checkbox" class="ot-sel" id="otSelAll"></th></tr></thead><tbody id="ordBody"></tbody></table></div>
  </body></html>`);
  await page.evaluate((list) => {
    window.__calls = [];
    window.MaAdmin = { call: async (type, f) => { window.__calls.push([type, f.OrderId]); return { ok: true }; } };
    window.MaPanel = { toast: (m) => { window.__toast = m; } };
    window.confirm = () => true;
    document.getElementById('ordBody').innerHTML = list.map(o =>
      `<tr data-id="${o.orderId}" data-oid="${o.orderId}"><td><input type="checkbox" class="ot-sel" data-oid="${o.orderId}"></td><td>${o.name}<div class="ot-wa-slot"></div></td></tr>`).join('');
    window.MaOrdersState = { all: list, total: list.length };
  }, orders);
  await page.addScriptTag({ path: path.join(root, 'admin-invoice.js') });
  await page.addScriptTag({ path: path.join(root, 'admin-order-tools.js') });
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('ma-orders-rendered')));

  const wa = page.locator('tr[data-oid="MA-1"] .ot-wa');
  await expect(wa).toHaveAttribute('href', /^https:\/\/wa\.me\/8801711111111\?text=/);

  await expect(page.locator('#otBulk')).toBeHidden();
  await page.locator('#otSelAll').check();
  await expect(page.locator('#otBulkCount')).toHaveText('3টি নির্বাচিত');
  await page.locator('#otSendSel').click();
  await expect.poll(() => page.evaluate(() => window.__toast || '')).toContain('1টি পাঠানো হয়েছে');
  expect(await page.evaluate(() => window.__calls)).toEqual([['AdminSendCourier', 'MA-1']]);

  await page.locator('#otReport summary').click();
  await expect(page.locator('#otReportBody')).toContainText('চট্টগ্রাম');
  await expect(page.locator('#otReportBody')).toContainText('সাইজ মেলেনি');
  await expect(page.locator('#otReportBody')).toContainText('Black Abaya');
});

test('order page: WhatsApp button and reason picker on cancel', async ({ page }) => {
  await page.setContent(`<!doctype html><html><body>
    <div class="pn-head"><button id="btnFraud">fraud</button></div>
    <div class="pn-actions-row"><a id="btnMap" href="#">map</a></div><input id="fName" value="Rahima"><input id="fAddress" value="Mirpur 10">
    <select id="fStatus"><option>Pending</option><option>Cancelled</option></select>
    <textarea id="fAdminNote">call after 5pm</textarea>
  </body></html>`);
  await page.evaluate(() => {
    window.MaPanel = { toast() {}, openModal(title, html) {
      let bg = document.getElementById('pnModal');
      if (!bg) { bg = document.createElement('div'); bg.id = 'pnModal'; bg.innerHTML = '<div id="pnModalBody"></div>'; document.body.appendChild(bg); }
      document.getElementById('pnModalBody').innerHTML = html; bg.classList.add('open');
    } };
  });
  await page.addScriptTag({ path: path.join(root, 'admin-invoice.js') });
  await page.addScriptTag({ path: path.join(root, 'admin-order-tools.js') });
  await page.evaluate((o) => document.dispatchEvent(new CustomEvent('ma-order-rendered', { detail: o })), orders[0]);
  await expect(page.locator('#otWaConfirm')).toBeVisible();
  await expect(page.locator('#otPrint')).toBeVisible();
  await expect(page.locator('.pn-actions-row #otWaConfirm')).toHaveCount(1);
  await page.selectOption('#fStatus', 'Cancelled');
  await page.locator('[data-reason="ফোন ধরেনি"]').click();
  await expect(page.locator('#fAdminNote')).toHaveValue('[কারণ: ফোন ধরেনি] call after 5pm');
});
