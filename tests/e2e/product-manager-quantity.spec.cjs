// Inventory → Quantity goes to the order server's count (orders take one off; 0 = Out of stock).
const { test, expect } = require('@playwright/test');

async function open(page, livePool) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  const pool = livePool ? JSON.stringify([{ productId: 'ABY-MAROON-1', variant: '', tracked: true, available: livePool.available, reserved: livePool.reserved }]) : '[]';
  await page.route('**/admin-api.js*', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: 'window.__calls=[];window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},cached:function(){return null},' +
      'call:function(a,p){window.__calls.push([a,p]);if(a==="AdminLiveStockList")return Promise.resolve({ok:true,items:{}});return Promise.resolve({ok:true})},' +
      'getStockVariants:function(){return Promise.resolve({ok:true,items:' + pool + '})},commitStockCsv:function(){return Promise.resolve({ok:true,applied:0,skipped:0})}};'
  }));
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true, publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } }); });
  await page.locator('#pmAllSearch').fill('ABY-MAROON-1');
  await expect(async () => {
    await page.locator('#pmAllRows tr .pm-row-title').first().click();
    await expect(page.locator('.pm-wp-name')).toHaveValue('Maroon Abaya Set', { timeout: 1500 });
  }).toPass();
  await page.locator('[data-etab="inventory"]').click();
}
const saves = (page) => page.evaluate(() => window.__calls.filter((c) => c[0] === 'AdminStockVariantSave').map((c) => c[1]));

test('typing a quantity saves it as the product count on Update', async ({ page }) => {
  await open(page);
  if (!(await page.locator('#pmManageStock').isChecked())) await page.locator('#pmManageStock').check();
  await page.locator('[data-ef="stock"]').fill('12');
  await page.locator('#pmEditUpdate').click();
  await expect(page.locator('#pmEditNote')).toContainText('Quantity 12 saved');
  const s = await saves(page);
  expect(s).toHaveLength(1);
  expect(s[0]).toMatchObject({ ProductId: 'ABY-MAROON-1', Variant: '', Available: '12' });
});

test('the box shows the live count, and saving other changes never overwrites it', async ({ page }) => {
  await open(page, { available: 3, reserved: 2 });
  await expect(page.locator('#pmLiveQty')).toContainText('Live: 3 left (2 in open orders)');
  await expect(page.locator('[data-ef="stock"]')).toHaveValue('3');
  await page.locator('[data-etab="general"]').click();
  await page.locator('.pm-wp-name').fill('Maroon Abaya Set X');
  await page.locator('#pmEditUpdate').click();
  await expect(page.locator('#pmEditNote')).toContainText('Saved');
  expect(await saves(page)).toEqual([]);
});

test('unticking "Track stock quantity" turns counting off on the server', async ({ page }) => {
  await open(page, { available: 5, reserved: 0 });
  await expect(page.locator('#pmLiveQty')).toContainText('Live: 5 left');
  await page.locator('#pmManageStock').uncheck();
  await page.locator('#pmEditUpdate').click();
  await expect(page.locator('#pmEditNote')).toContainText('tracking turned off');
  expect(await saves(page)).toEqual([{ ProductId: 'ABY-MAROON-1', Variant: '', Tracked: 'false', Reason: 'Product Manager: stopped tracking quantity' }]);
});
