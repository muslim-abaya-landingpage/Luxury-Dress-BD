const { test, expect } = require('@playwright/test');

const GUARD = 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin",name:"Owner"});}};';
async function stub(page, api) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: GUARD }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: `window.__calls=[];window.MaAdmin=Object.assign({
    getSession:function(){return{token:'t',role:'admin',name:'Owner'};},verifySession:function(){return Promise.resolve(this.getSession());},
    cached:function(){return null;},logout:function(){},fetchOrders:function(){return Promise.resolve({ok:true,orders:[]});},
    call:function(){return Promise.resolve({ok:true,orders:[],items:[]});},inboxCall:function(){return Promise.resolve({ok:true,contacts:[]});},
    getStockVariants:function(){return Promise.resolve({ok:true,items:[]});}},${api});` }));
}
const summary = (n) => `{ok:true,range:o.range,from:'2026-11-01',to:'2026-11-06',undatedOrderCount:0,salesByMonth:[],topProducts:[],sourceBreakdown:[],
  summary:{totalOrders:${n},totalOrderValue:${n * 1000},deliveredCount:2,cancelledCount:1,returnedCount:1,pendingCount:3,customerCount:${n - 1},repeatCustomerCount:1}}`;

test('dashboard range chips fill the top cards from the server report for that range', async ({ page }) => {
  await stub(page, `{getAnalyticsV2:function(o){window.__calls.push(o.range);return Promise.resolve(o.range==='today'?${summary(4)}:${summary(40)});}}`);
  await page.goto('/admin-dashboard.html');
  await expect(page.locator('#admOverviewOrders')).toHaveText('40');
  await page.locator('#dzRange [data-range="today"]').click();
  await expect(page.locator('#admOverviewOrders')).toHaveText('4');
  await expect(page.locator('#admOverviewPending')).toHaveText('3');
  await expect(page.locator('#admOverviewCustomers')).toHaveText('3');
  await expect(page.locator('#admOverviewCancelled')).toHaveText('2');
  await expect(page.locator('#dzRange [data-range="today"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#admReportRange')).toHaveValue('today');
});

test('setup page lists jobs and turns one on with a click', async ({ page }) => {
  await stub(page, `{getSetupStatus:function(){var on=!!window.__on;return Promise.resolve({ok:true,checkedAt:'2026-11-06 10:00',connections:[{label:'Telegram নোটিফিকেশন',ok:false,help:'set token'}],
    jobs:[{label:'প্রতিদিন সকাল ৮টায় বিক্রির সারাংশ',on:on,duplicates:0,action:'installDailySummary'}]});},
    runSetupAction:function(a){window.__calls.push(a);window.__on=true;return Promise.resolve({ok:true,message:'চালু হয়েছে।'});}}`);
  await page.goto('/admin-setup.html');
  await expect(page.locator('#stScore')).toHaveText('0/2');
  await page.locator('[data-action="installDailySummary"]').click();
  await expect(page.locator('#stJobResult')).toContainText('চালু হয়েছে');
  await expect(page.locator('#stScore')).toHaveText('1/2');
  expect(await page.evaluate(() => window.__calls)).toEqual(['installDailySummary']);
});

test('profit page saves only the changed buying price', async ({ page }) => {
  await stub(page, `{getProductProfit:function(o){return Promise.resolve({ok:true,orders:2,from:'2026-10-08',to:'2026-11-06',totals:{qty:3,sales:4500,costedSales:3000,profit:1000,missingCost:1},
    products:[{productId:'A',name:'Abaya',qty:2,sales:3000,cost:1000,totalCost:2000,profit:1000,margin:33.3,unpricedQty:0},{productId:'B',name:'Hijab',qty:1,sales:1500,cost:null,totalCost:null,profit:null,margin:null,unpricedQty:0}]});},
    saveProductCosts:function(c){window.__calls.push(c);return Promise.resolve({ok:true,saved:1,removed:0});}}`);
  await page.goto('/admin-profit.html');
  await expect(page.locator('#pfProfit')).toHaveText('৳1,000');
  await page.locator('.pf-cost[data-id="B"]').fill('900');
  await page.locator('#pfSave').click();
  await expect(page.locator('#pfResult')).toContainText('সেভ হয়েছে');
  expect(await page.evaluate(() => window.__calls)).toEqual([{ B: { cost: 900, name: 'Hijab' } }]);
});

test('quick search: Ctrl+K, a phone number opens the customer profile', async ({ page }) => {
  await stub(page, `{lookupCustomer:function(p){return Promise.resolve({ok:true,found:true,phone:p,name:'Fatema',stats:{total:2,delivered:1},risk:'low',successRate:100,recent:[],blocked:false});}}`);
  await page.goto('/admin-setup.html');
  await page.keyboard.press('Control+k');
  await page.keyboard.type('+880 1711-223344');
  await expect(page.locator('.maqs-list li').first()).toContainText('কাস্টমার প্রোফাইল: 01711223344');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/admin-customers\.html\?phone=01711223344/);
  await expect(page.locator('#cuName')).toHaveText('Fatema');
  await expect(page.locator('#cuNewOrder')).toHaveAttribute('href', 'admin-order-new.html?phone=01711223344');
});
