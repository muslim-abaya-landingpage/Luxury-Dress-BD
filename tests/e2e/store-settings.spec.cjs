// Product Manager → Store settings: the owner changes the delivery charge and search words without code.
// Saved into product-config.js with the normal publish; the order form, checkout page and search use them.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function openManager(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null}};' }));
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__published = null;
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true,
      publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } });
  });
}
const configFile = (page) => page.evaluate(() => window.__published && window.__published.find((f) => f.path === 'product-config.js').content);

test('owner saves delivery charge and search words; they go into product-config.js', async ({ page }) => {
  await openManager(page);
  await page.evaluate(() => window.pmOpenStoreSettings());
  const m = page.locator('#pmStoreModal');
  await expect(m.locator('details.ss-extra').filter({ hasText: 'Delivery charge' })).not.toHaveAttribute('open', '');
  await expect(m.locator('details.ss-extra').filter({ hasText: 'Search words' })).not.toHaveAttribute('open', '');
  await m.locator('details.ss-extra').filter({ hasText: 'Delivery charge' }).locator('summary').click();
  await expect(m.locator('#ssDhaka')).toHaveValue('80');
  await expect(m.locator('#ssOutside')).toHaveValue('150');
  await expect(m.locator('#ssFree')).toHaveValue('3');
  await m.locator('#ssDhaka').fill('70');
  await m.locator('#ssOutside').fill('130');
  await m.locator('#ssFree').fill('4');
  await m.locator('details.ss-extra').filter({ hasText: 'Search words' }).locator('summary').click();
  await m.locator('#ssWords').fill('গাউন, gown, maxi\nজামা, frock');
  await m.locator('#ssSave').click();
  await expect(m).toBeHidden();
  const cfg = await configFile(page);
  expect(cfg).toContain('"delivery": {\n    "dhaka": 70,\n    "outside": 130,\n    "freeQty": 4\n  }');
  expect(cfg).toContain('গাউন, gown, maxi');
  // Search in the page uses the new words straight away.
  const ids = await page.evaluate(() => window.maSearch.getTerms('maxi'));
  expect(ids).toEqual(await page.evaluate(() => window.maSearch.getTerms('গাউন')));
});

test('wrong values are refused with a message and nothing is published', async ({ page }) => {
  await openManager(page);
  await page.evaluate(() => window.pmOpenStoreSettings());
  const m = page.locator('#pmStoreModal');
  await m.locator('details.ss-extra').filter({ hasText: 'Delivery charge' }).locator('summary').click();
  await m.locator('#ssDhaka').fill('-10');
  await m.locator('#ssSave').click();
  await expect(m.locator('#ssMsg')).toContainText('whole number');
  await m.locator('#ssDhaka').fill('80');
  await m.locator('#ssWords').fill('একা');
  await m.locator('#ssSave').click();
  await expect(m.locator('#ssMsg')).toContainText('at least two words');
  expect(await page.evaluate(() => window.__published)).toBeNull();
});

test('admin menu link opens Store settings', async ({ page }) => {
  await openManager(page);
  await page.evaluate(() => { location.hash = 'store-settings'; });
  await expect(page.locator('#pmStoreModal')).toBeVisible();
});

test('website uses the saved delivery charge: order form and checkout page', async ({ page }) => {
  const real = fs.readFileSync(path.join(__dirname, '../../product-config.js'), 'utf8');
  const cfg = real + '\nwindow.SITE_LINKS.delivery = {"dhaka":70,"outside":130,"freeQty":4};\n';
  await page.route(/\/product-config\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: cfg }));
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|clarity\.ms|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto('/product/DR-02');
  await page.locator('[data-action="buy-now"]:visible, #pdBuyNow:visible').first().click();
  const pop = page.locator('.ma-cop');
  await expect(pop).toContainText('ঢাকা ৳70 · ঢাকার বাইরে ৳130 · 4টি বা বেশি পণ্যে ফ্রি ডেলিভারি');
  const dhakaValue = await page.$eval('#ma-cop-district', (sel) => [...sel.options].find((o) => /ঢাকা/.test(o.textContent)).value);
  await page.selectOption('#ma-cop-district', dhakaValue);
  await expect(pop.locator('[data-cop-fee]')).toHaveText('৳70');
  await page.goto('/checkout.html');
  await expect(page.locator('#deliveryFeeHint')).toHaveText('Dhaka ৳70 · Other districts ৳130 · Free delivery on 4+ items');
  await expect(page.locator('#userArea option[data-district="ঢাকা"]')).toHaveText('Dhaka (৳70)');
});

test('announcement bar follows the free-delivery setting', async ({ page }) => {
  const real = fs.readFileSync(path.join(__dirname, '../../product-config.js'), 'utf8');
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|clarity\.ms|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.route(/\/product-config\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: real + '\nwindow.SITE_LINKS.delivery = {"dhaka":80,"outside":150,"freeQty":5};\n' }));
  await page.goto('/index.html');
  await expect(page.locator('.ann-slide', { hasText: 'FREE' }).first()).toHaveText(/Buy 5 Dresses/);
  await page.unroute(/\/product-config\.js(\?.*)?$/);
  await page.route(/\/product-config\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: real + '\nwindow.SITE_LINKS.delivery = {"dhaka":80,"outside":150,"freeQty":0};\n' }));
  await page.goto('/index.html');
  await expect(page.locator('.ann-slide', { hasText: 'Nationwide Home Delivery' })).toHaveText(/Nationwide Home Delivery · Cash on Delivery/);
});


test('owner uploads a company logo and saves the brand setting', async ({ page }) => {
  await openManager(page);
  await page.evaluate(() => {
    window.__logoUpload = null;
    window.__logoPublished = null;
    window.MaAdmin.uploadImage = (path, content, mimeType) => {
      window.__logoUpload = { path, contentLength: content.length, mimeType };
      return Promise.resolve({ ok: true, url: 'https://images.muslimabaya.com/images/uploads/brand-logo-test-123.webp' });
    };
  });
  await page.evaluate(() => window.pmOpenStoreSettings());
  await page.locator('#ssLogoFile').setInputFiles({
    name: 'company-logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  });
  await page.locator('#ssLogoUpload').click();
  await expect(page.locator('#ssLogoMsg')).toContainText('Logo saved', { timeout: 15000 });
  const result = await page.evaluate(() => ({ upload: window.__logoUpload, files: window.__published }));
  expect(result.upload.path).toMatch(/^images\/uploads\/brand-logo-[a-z0-9-]+\.webp$/);
  expect(result.upload.mimeType).toBe('image/webp');
  expect(result.upload.contentLength).toBeGreaterThan(0);
  const config = result.files.find((file) => file.path === 'product-config.js');
  expect(config).toBeTruthy();
  expect(config.content).toContain('"brand"');
  expect(config.content).toContain('https://images.muslimabaya.com/images/uploads/brand-logo-test-123.webp');
});

test('storefront renders an uploaded first-party CDN logo URL without rewriting it as a local path', async ({ page }) => {
  const logo = 'https://images.muslimabaya.com/images/uploads/brand-logo-test-123.webp';
  await page.route('**/site-header-config.js*', async (route) => {
    const config = fs.readFileSync(path.join(__dirname, '../../site-header-config.js'), 'utf8');
    const updated = config.replace(/(brand\s*:\s*\{[\s\S]*?\blogoSrc\s*:\s*)(["'])(.*?)\2/, (_match, prefix) => prefix + JSON.stringify(logo));
    await route.fulfill({ contentType: 'application/javascript', body: updated });
  });
  await page.goto('/');
  await expect(page.locator('.brand-logo-img')).toHaveAttribute('src', logo);
});
