const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

test('copy an existing product into the upload form: details copied, name/colour/photos left to the user', async ({ page }) => {
  await page.setContent(`<!doctype html><html><body>
    <button id="pmQuickUpload">new</button><a id="pmLiveLink" hidden></a><button id="pmPublishCheck"></button>
  </body></html>`);
  await page.addScriptTag({ path: path.join(root, 'product-publish-utils.js') });
  await page.evaluate(() => {
    window.MaCatalogPublisher = { isReady: () => true, enqueue() {}, check() {} };
    window.__staged = [];
    window.__products = { abaya: [{ id: 'ABY-BUTTERFLY-13', name: 'Butterfly Abaya Set', price: 1350, priceByType: { 'Abaya Only': 1150 },
      colorLabel: 'Black', fabric: 'Dubai Cherry', lengthSizes: ['50', '52', '54'], bodySizes: ['46'], detailNote: 'Full set with hijab', image: 'images/a.webp' }] };
  });
  await page.addScriptTag({ path: path.join(root, 'product-quick-upload.js') });
  await page.evaluate(() => window.MaProductQuickUpload.mount({
    sections: () => [{ key: 'abaya', menuBn: 'আবায়া · বোরকা' }, { key: 'hijab', menuBn: 'হিজাব' }],
    products: () => window.__products, status() {}, isSaved: () => true,
    stage: (cat, p) => window.__staged.push([cat, p]), publish: async () => {} }));

  // via the search box in the "new product" form
  await page.click('#pmQuickUpload');
  await expect(page.locator('#pqCopyWrap')).toBeVisible();
  await page.fill('#pqCopy', 'Butterfly Abaya Set · ABY-BUTTERFLY-13 · আবায়া · বোরকা');
  await page.locator('#pqCopy').dispatchEvent('change');
  await expect(page.locator('#pq_price')).toHaveValue('1350');
  await expect(page.locator('#pq_onlyPrice')).toHaveValue('1150');
  await expect(page.locator('#pq_sizes')).toHaveValue('50, 52, 54');
  await expect(page.locator('#pq_body')).toHaveValue('46');
  await expect(page.locator('#pq_fabric')).toHaveValue('Dubai Cherry');
  await expect(page.locator('#pq_note')).toHaveValue('Full set with hijab');
  await expect(page.locator('#pq_category')).toHaveValue('abaya');
  await expect(page.locator('#pq_color')).toHaveValue('');
  await expect(page.locator('#pqPhotos')).toHaveJSProperty('required', true);
  await expect(page.locator('.pm-quick-dialog h2')).toHaveText('New product from an existing one');

  // submitting without photos is refused, and the source product is untouched
  await page.fill('#pq_name', 'Butterfly Abaya Set - Maroon');
  await page.evaluate(() => (() => { const f = document.getElementById('pqForm'); f.requestSubmit(); const r = document.getElementById('pqReview'); if (r && !r.hidden) f.requestSubmit(); })());
  expect(await page.evaluate(() => window.__staged.length)).toBe(0);
  expect(await page.evaluate(() => window.__products.abaya[0].name)).toBe('Butterfly Abaya Set');

  // direct call (the "কপি" button in the product list) works too
  await page.evaluate(() => { document.querySelector('.pm-quick-dialog').close(); window.MaProductQuickUpload.copyFrom(window.__products.abaya[0], 'abaya'); });
  await expect(page.locator('#pq_name')).toHaveValue('Butterfly Abaya Set');
  await expect(page.locator('.pm-quick-dialog')).toHaveJSProperty('open', true);
});
