const { test, expect } = require('@playwright/test');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');

test('admin dashboard renders alerts, priority orders, lifetime report and consented desktop notices', async ({ page }) => {
  // The fixtures below use fixed order dates; pin "now" so the overdue
  // assertions don't start failing once the calendar moves past them.
  await page.clock.setFixedTime(new Date('2026-10-18T12:00:00+06:00'));
  await page.setContent(`<!doctype html><html><body>
    <button id="admDesktopAlerts" hidden></button><span id="admDesktopStatus"></span>
    <button id="admAlertsRefresh"></button><span id="admAlertState"></span><span id="admStockAlertCount"></span><span id="admInboxAlertCount"></span>
    <div id="admStockAlerts"></div><div id="admInboxAlerts"></div>
    <button id="admTasksRefresh"></button><span id="admTaskState"></span><span id="admTaskPendingCount"></span><span id="admTaskOverdueCount"></span><span id="admTaskScope"></span><div id="admPriorityTasks"></div>
    <button id="admRefresh"></button><button id="admReportLoad"></button><button id="admReportExport" disabled></button>
    <select id="admReportRange"><option value="all" selected>all</option><option value="custom">custom</option></select>
    <div id="admReportCustomDates" hidden></div><input id="admReportFrom"><input id="admReportTo">
    <span id="admReportState"></span><div id="admReportError" hidden></div><div id="admReportBody" hidden></div>
    <span id="admReportRangeLabel"></span><p id="admUndatedNote" hidden></p>
    <span id="admReportOrders"></span><span id="admReportOrderValue"></span><span id="admReportDeliveredValue"></span>
    <span id="admReportDelivered"></span><span id="admReportCancelRate"></span><span id="admReportDeliveryRate"></span>
    <div id="admSalesMonths"></div><div id="admReportProducts"></div><div id="admReportSources"></div>
  </body></html>`);

  await page.evaluate(() => {
    window.__sentNotifications = [];
    window.__stockItems = [
      { productId: 'P-LOW', productName: 'Black Abaya', variant: 'M', tracked: true, available: 2, threshold: 3, status: 'LOW' },
      { productId: 'P-OUT', productName: 'Navy Abaya', variant: 'L', tracked: true, available: 0, threshold: 5, status: 'OUT' }
    ];
    window.__inboxResult = {
      stats: { unread: 1 },
      contacts: [{ pageId: 'page-1', psid: 'customer-1', name: 'Customer A', unread: 2, lastMessage: 'Size জানতে চাই' }]
    };
    class TestNotification {
      static permission = 'default';
      static requestPermission() { TestNotification.permission = 'granted'; return Promise.resolve('granted'); }
      constructor(title, options) { window.__sentNotifications.push({ title, body: options.body }); }
    }
    Object.defineProperty(window, 'Notification', { configurable: true, value: TestNotification });
    window.MaAdmin = {
      getSession: () => ({ token: 'test-session' }),
      getStockVariants: async () => ({ defaultThreshold: 5, items: window.__stockItems }),
      inboxCall: async () => window.__inboxResult,
      call: async () => ({
        counts: { all: 2 },
        orders: [
          { orderId: 'P-OLD', name: 'Pending Customer', status: 'Pending', time: '01-01-2026 10:00:00', total: '1800' },
          { orderId: 'C-NEW', name: 'Confirmed Customer', status: 'Confirmed', time: '18-10-2026 10:00:00', total: '2100' }
        ]
      }),
      getAnalyticsV2: async options => ({
        ok: true, range: options.range, from: '2025-12-01', to: '2026-10-18', undatedOrderCount: 0,
        summary: { totalOrders: 7, totalOrderValue: 9000, deliveredSalesValue: 4200, deliveredCount: 3, cancellationRate: 0.14, deliverySuccessRate: 0.43 },
        salesByMonth: [{ month: '2026-10', orders: 7, revenue: 9000, deliveredOrders: 3, deliveredSales: 4200 }],
        topProducts: [{ productId: 'P1', name: 'Black Abaya', qty: 6 }],
        sourceBreakdown: [{ source: 'Facebook', orders: 5, delivered: 2 }],
        sourceMessage: ''
      })
    };
  });
  await page.addScriptTag({ path: path.join(root, 'admin-dashboard-logic.js') });
  await page.addScriptTag({ path: path.join(root, 'admin-dashboard-features.js') });

  await expect(page.locator('#admStockAlertCount')).toHaveText('2');
  await expect(page.locator('#admInboxAlertCount')).toHaveText('1');
  await expect(page.locator('#admStockAlerts')).toContainText('Black Abaya');
  await expect(page.locator('#admInboxAlerts')).toContainText('Customer A');
  await expect(page.locator('#admTaskPendingCount')).toHaveText('1');
  await expect(page.locator('#admTaskOverdueCount')).toHaveText('1');
  await expect(page.locator('#admPriorityTasks')).toContainText('P-OLD');
  await expect(page.locator('#admPriorityTasks a.adm-task-open')).toHaveAttribute('href', 'admin-order.html?id=P-OLD');
  await expect(page.locator('#admReportOrders')).toHaveText('7');
  await expect(page.locator('#admReportDeliveredValue')).toHaveText('৳4,200');
  await expect(page.locator('#admSalesMonths')).toContainText('2026-10');
  await expect(page.locator('#admReportExport')).toBeEnabled();

  await page.locator('#admDesktopAlerts').click();
  await expect(page.locator('#admDesktopAlerts')).toContainText('বন্ধ করুন');
  await page.evaluate(() => {
    window.__stockItems = window.__stockItems.concat([{ productId: 'P-NEW', productName: 'New Product', variant: 'S', tracked: true, available: 1, threshold: 2, status: 'LOW' }]);
    window.__inboxResult = {
      stats: { unread: 2 },
      contacts: window.__inboxResult.contacts.concat([{ pageId: 'page-1', psid: 'customer-2', name: 'Private Customer Name', unread: 1, lastMessage: 'Private customer message' }])
    };
  });
  await page.locator('#admAlertsRefresh').click();
  await expect(page.locator('#admStockAlertCount')).toHaveText('3');
  await expect(page.locator('#admInboxAlertCount')).toHaveText('2');
  await expect.poll(() => page.evaluate(() => window.__sentNotifications.length)).toBe(2);
  const notices = await page.evaluate(() => window.__sentNotifications);
  expect(JSON.stringify(notices)).toContain('স্টক অ্যালার্ট');
  expect(JSON.stringify(notices)).toContain('Messenger-এ নতুন বার্তা');
  expect(JSON.stringify(notices)).not.toContain('Private Customer Name');
  expect(JSON.stringify(notices)).not.toContain('Private customer message');
});
