const { test, expect } = require('@playwright/test');

const sampleOrders = [
  { orderId: 'MA-1001', row: 1, time: '27-11-2026 10:30', name: 'রহিমা আক্তার', phone: '01711111111', total: 1450, items: ['কালো আবায়া × 1'], status: 'Pending', courier: '', source: 'Website', assignedTo: '' },
  { orderId: 'MA-1002', row: 2, time: '27-11-2026 09:10', name: 'করিমা বেগম', phone: '01822222222', total: 2250, items: ['নেভি আবায়া × 1'], status: 'Delivered', courier: 'Steadfast', courierStatus: 'delivered', tracking: 'SF123', source: 'Website', assignedTo: 'Rafi' }
];

async function stubOrderPage(page) {
  await page.route('**/admin-guard.js*', route => route.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.MaAdmin={cached:function(){return null;},call:async function(type){if(type==="AdminOrderList")return {orders:${JSON.stringify(sampleOrders)},counts:{all:2,Pending:1,Delivered:1,pending:1,delivered:1},statuses:["Pending","Delivered"],nextCursor:0};return {ok:true};}};
  ` }));
  await page.route('**/admin-panel.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.MaPanel={esc:function(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});},money:function(v){return "৳"+Number(v||0).toLocaleString("en-US");},statusClass:function(v){return String(v||"pending").toLowerCase().replace(/[^a-z]/g,"")||"pending";},init:function(){return Promise.resolve(true);},toast:function(){}};
  ` }));
  await page.route('**/admin-order-insights.js*', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.MaOrderInsights={labels:{missing_phone:"ফোন নেই"},dateKey:function(v){var m=/^(\\d{1,2})-(\\d{1,2})-(\\d{4})/.exec(String(v||""));return m?m[3]+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):"";},dhakaToday:function(){return "2026-11-27";},amount:function(v){return v==null||String(v).trim()===""?null:Number(v);},analyze:function(list){return {totalValue:list.reduce(function(s,o){return s+(Number(o.total)||0);},0),flagged:0,invalidAmounts:0,rows:[],groups:{delivered:{count:1,value:2250},active:{count:1,value:1450},cancelled:{count:0,value:0},fake:{count:0,value:0},returned:{count:0,value:0},unknown:{count:0,value:0}}};}};
  ` }));
  await page.route('**/admin-order-tools.js*', route => route.fulfill({ contentType: 'application/javascript', body: '/* order actions covered by existing workflow tests */' }));
  await page.route('**/admin-manual-order.js*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.route('**/admin-invoice.js*', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
}

test('admin orders: Bengali status filters, customer name and phone search', async ({ page }) => {
  await stubOrderPage(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/admin-orders.html');
  await expect(page.locator('#ordBody tr[data-id]')).toHaveCount(2);
  await expect(page.locator('#ordTabs')).toContainText('অপেক্ষমাণ');
  await expect(page.locator('#ordBody')).toContainText('রহিমা আক্তার');
  await expect(page.locator('#ordBody')).toContainText('ডেলিভারি সম্পন্ন');
  await page.locator('#ordSearch').fill('01822222222');
  await expect(page.locator('#ordBody tr[data-id]')).toHaveCount(1);
  await expect(page.locator('#ordBody')).toContainText('করিমা বেগম');
});

test('admin orders: mobile uses full-width order cards without page overflow', async ({ page }) => {
  await stubOrderPage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin-orders.html');
  await expect(page.locator('#ordBody tr[data-id]')).toHaveCount(2);
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth,
    rows: [...document.querySelectorAll('#ordBody tr[data-id]')].map(el => Math.round(el.getBoundingClientRect().width)),
    cardDisplay: getComputedStyle(document.querySelector('#ordBody tr[data-id]')).display
  }));
  expect(layout.pageWidth).toBeLessThanOrEqual(layout.viewport);
  expect(layout.cardDisplay).toBe('grid');
  expect(layout.rows.every(w => w > 300 && w <= layout.viewport)).toBe(true);
  await expect(page.locator('#ordBody tr[data-id]').first()).toContainText('01711111111');
});
