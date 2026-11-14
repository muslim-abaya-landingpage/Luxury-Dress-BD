// Size & measurements: the owner adds their own measurement (Pant Crotch Depth) in Product Manager,
// customers pick a value on the product page and it reaches the cart size text.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function openManager(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true});},cached:function(){return null}};' }));
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__published = null;
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true,
      publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } });
  });
}

test('Product Manager: add Pant Crotch Depth and a new custom measurement, then publish', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await openManager(page);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  const id = await page.locator('[data-ef="id"]').inputValue();
  await page.click('[data-etab="attributes"]');
  await page.evaluate(() => { const d = document.getElementById('pmMoreDetails'); if (d) d.open = true; }); // "More details" box
  await page.click('[data-measure-add="Pant Crotch Depth"]');
  const rows = page.locator('#pmMeasures .pm-ms-own');
  await expect(rows).toHaveCount(1);
  await expect(rows.first().locator('[data-measure-values]')).toBeFocused();
  await page.keyboard.type('10, 11, 12 inches');
  await expect(rows.first().locator('.pm-ms-chip')).toHaveText(['10', '11', '12']);
  // A brand-new name of the owner's choice.
  await page.click('[data-measure-add=""]');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1).locator('[data-measure-name]')).toBeFocused();
  await page.keyboard.type('Knee: Width');
  await expect(rows.nth(1).locator('[data-measure-name]')).toHaveValue('Knee Width');
  await rows.nth(1).locator('[data-measure-values]').fill('16, 17');
  await page.locator('#pmMeasures').scrollIntoViewIfNeeded();
  await page.locator('#pmMeasures').screenshot({ path: 'test-results/measures-editor.png' });
  // remove and add back works too
  await rows.nth(1).locator('[data-measure-del]').click();
  await expect(rows).toHaveCount(1);
  await page.click('[data-measure-add=""]');
  await rows.nth(1).locator('[data-measure-name]').fill('Knee Width');
  await rows.nth(1).locator('[data-measure-values]').fill('16, 17');
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const i = file.indexOf('id: "' + id + '"');
  const entry = file.slice(i, file.indexOf('\n    }', i));
  expect(entry).toMatch(/Pant Crotch Depth/);
  expect(entry).toMatch(/"10",\s*"11",\s*"12"/);
  expect(entry).toMatch(/Knee Width/);
});

const real = fs.readFileSync(path.join(__dirname, '../../category-products.js'), 'utf8');
test('product page: customer picks Pant Crotch Depth and it goes into the cart size', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route(/\/category-products\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: real +
    '\n(function(){var p=(window.CATEGORY_PRODUCTS.abaya||[]).find(function(x){return x.id==="ABY-MAROON-1";});if(p){p.measures=[{name:"Pant Crotch Depth",values:["10","11","12"]}];}})();\n' }));
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto('/product/ABY-MAROON-1');
  const pills = page.locator('.pqv-measure-opt');
  await expect(pills).toHaveCount(3);
  await expect(page.locator('.pqv-field-measure .pqv-field-label')).toHaveText('Pant Crotch Depth');
  await pills.nth(1).click();
  await expect(pills.nth(1)).toHaveClass(/is-active/);
  await page.locator('.pqv-field-measure').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'test-results/measures-product-page.png' });
  await page.locator('.pqv-act-cart[data-product-idx]:not(.pqv-wholesale-add)').first().click();
  await expect.poll(() => page.evaluate(() => (window.loadStoreCart({ readOnly: true })[0] || {}).size || '')).toContain('Pant Crotch Depth: 11');
});
