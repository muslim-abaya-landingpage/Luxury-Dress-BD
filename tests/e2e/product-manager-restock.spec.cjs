// Replacing an out-of-stock product (new main photo in its place) puts it back in stock on save.
const { test, expect } = require('@playwright/test');

async function open(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: 'window.__calls=[];window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},cached:function(){return null},' +
      'call:function(a,p){window.__calls.push([a,p]);if(a==="AdminLiveStockList")return Promise.resolve({ok:true,items:{"ABY-MAROON-1":false}});return Promise.resolve({ok:true})},' +
      'getStockVariants:function(){return Promise.resolve({ok:true,items:[]})},commitStockCsv:function(){return Promise.resolve({ok:true,applied:0,skipped:0})}};'
  }));
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true, publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } });
    window.openMediaLibrary = function (cb) { cb(window.__nextPhoto || '/images/e2e-new-product.webp', {}); };
  });
  await page.locator('#pmAllSearch').fill('ABY-MAROON-1');
  await expect(async () => {
    await page.locator('#pmAllRows tr .pm-row-title').first().click();
    await expect(page.locator('.pm-wp-name')).toHaveValue('Maroon Abaya Set', { timeout: 1500 });
  }).toPass();
}
const stockSets = (page) => page.evaluate(() => window.__calls.filter((c) => c[0] === 'AdminLiveStockSet').map((c) => c[1]));

test('new main photo on an out-of-stock product → In stock after Update', async ({ page }) => {
  await open(page);
  await page.locator('#pmImgEdit').click();
  await page.locator('#pmEditUpdate').click();
  await expect(page.locator('#pmEditNote')).toContainText('now In stock');
  expect(await stockSets(page)).toEqual([{ ProductIds: '["ABY-MAROON-1"]', InStock: 'true' }]);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const block = file.slice(file.indexOf('"ABY-MAROON-1"'), file.indexOf('\n    }', file.indexOf('"ABY-MAROON-1"')));
  expect(block).toContain('inStock: true');
  expect(block).toContain('/images/e2e-new-product.webp');
});

test('editing an out-of-stock product without a new main photo keeps it Out of stock', async ({ page }) => {
  await open(page);
  await page.locator('.pm-wp-name').fill('Maroon Abaya Set 2');
  await page.locator('#pmEditUpdate').click();
  await expect(page.locator('#pmEditNote')).toContainText('Saved');
  await expect(page.locator('#pmEditNote')).not.toContainText('In stock');
  expect(await stockSets(page)).toEqual([]);
});

test('Publish on a draft: the Publish box then shows Published / Update and the "Saved" message stays', async ({ page }) => {
  await page.route('**/category-products.js*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/(id: "ABY-MAROON-1",)/, '$1 status: "draft",');
    await route.fulfill({ response, body });
  });
  await open(page);
  await expect(page.locator('#pmStatusLabel')).toHaveText('Draft');
  await expect(page.locator('#pmEditUpdate')).toHaveText('Publish');
  await page.locator('#pmEditUpdate').click();
  await expect(page.locator('#pmStatusLabel')).toHaveText('Published');
  await expect(page.locator('#pmEditUpdate')).toHaveText('Update');
  await expect(page.locator('#pmSaveDraft')).toHaveCount(0);
  await expect(page.locator('#pmEditNote')).toContainText('Saved');
  await expect(page.locator('#pmStatusNote')).not.toContainText('Hidden from the website');
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const block = file.slice(file.indexOf('"ABY-MAROON-1"'), file.indexOf('\n    }', file.indexOf('"ABY-MAROON-1"')));
  expect(block).not.toContain('status:');
});
