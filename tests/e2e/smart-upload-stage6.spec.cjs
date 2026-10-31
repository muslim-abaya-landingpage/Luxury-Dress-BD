// Smart Product Upload, stage 6: a summary before going live, one confirm click that publishes
// photos, product, SEO and stock together, and a full new-product journey from start to finish.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

async function setup(page, products) {
  await page.route('**/__upload-test', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><button id="pmQuickUpload">new</button><a id="pmLiveLink" hidden></a><button id="pmPublishCheck"></button></body></html>' }));
  await page.goto('/__upload-test');
  await page.addScriptTag({ path: path.join(root, 'product-publish-utils.js') });
  await page.addScriptTag({ path: path.join(root, 'product-color-detect.js') });
  await page.evaluate((list) => {
    window.__staged = []; window.__stock = []; window.__published = []; window.__assets = [];
    window.__products = { hijab: list || [] };
    window.MaCatalogPublisher = { isReady: () => true, enqueue(a) { window.__assets.push(a); }, check() {} };
    window.MaAdmin = { commitStockCsv: async (rows) => { window.__stock.push(rows); return { applied: rows.length, skipped: 0 }; } };
  }, products);
  await page.addScriptTag({ path: path.join(root, 'product-quick-upload.js') });
  await page.evaluate(() => window.MaProductQuickUpload.mount({
    sections: () => [{ key: 'hijab', menuBn: 'হিজাব' }], products: () => window.__products, status() {}, isSaved: () => true,
    stage: (cat, p) => window.__staged.push([cat, p]),
    publish: async (x) => { window.__published.push(x); } }));
  await page.click('#pmQuickUpload');
}
async function addPhotos(page, colours) {
  await page.evaluate(async (list) => {
    const dt = new DataTransfer();
    for (const [i, c] of list.entries()) {
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 260;
      const g = cv.getContext('2d'); g.fillStyle = '#fafafa'; g.fillRect(0, 0, 200, 260); g.fillStyle = c; g.fillRect(40, 20, 120, 220);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      dt.items.add(new File([blob], 'p' + i + '.png', { type: 'image/png', lastModified: 500 + i }));
    }
    const input = document.getElementById('pqPhotos'); input.files = dt.files; input.dispatchEvent(new Event('change'));
  }, colours);
}
const press = (page) => page.evaluate(() => document.getElementById('pqForm').requestSubmit());
const review = (page) => page.locator('#pqReview');
const fill = async (page, name) => {
  await page.fill('#pq_name', name || 'Navy Silk Hijab');
  await page.fill('#pq_price', '650');
  await page.fill('#pq_sizes', 'Free Size');
};

test('a complete new product shows a summary first; nothing is sent until "Confirm and publish"', async ({ page }) => {
  await setup(page);
  await fill(page);
  await page.fill('#pq_fabric', 'Silk');
  await addPhotos(page, ['#161e50']);
  await page.locator('#pqStock input[data-variant="Free Size"]').fill('5');
  await press(page);
  await expect(review(page)).toBeVisible();
  await expect(review(page)).toContainText('হিজাব');
  await expect(review(page)).toContainText('/product/navy-silk-hijab');
  await expect(review(page)).toContainText('৳650');
  await expect(review(page)).toContainText('1 variation(s), 5 piece(s) in total');
  await expect(review(page)).toContainText('Navy Silk Hijab | Muslim Abaya');
  await expect(page.locator('#pqSubmit')).toHaveText('Confirm and publish');
  await expect(page.locator('#pqSubmit')).toBeFocused();
  expect(await page.evaluate(() => [window.__staged.length, window.__published.length, window.__stock.length, window.__assets.length])).toEqual([0, 0, 0, 0]);
  await press(page); // the one click that publishes everything
  await expect(page.locator('#pqStatus')).toContainText('Stock saved for 1 variation(s).');
  await expect(review(page)).toBeHidden();
  const out = await page.evaluate(() => ({ staged: window.__staged.length, pub: window.__published, stock: window.__stock, assets: window.__assets.length }));
  expect(out.staged).toBe(1);
  expect(out.pub).toEqual([{ id: 'navy-silk-hijab', category: 'hijab' }]);
  expect(out.assets).toBe(1);
  expect(out.stock[0].map((r) => [r.productId, r.variant, r.qty])).toEqual([['navy-silk-hijab', 'Free Size', 5]]);
});

test('changing anything after the summary hides it; the next press shows a fresh summary', async ({ page }) => {
  await setup(page);
  await fill(page);
  await addPhotos(page, ['#161e50']);
  await press(page);
  await expect(review(page)).toContainText('/product/navy-silk-hijab');
  await page.fill('#pq_name', 'Maroon Silk Hijab');
  await expect(review(page)).toBeHidden();
  await expect(page.locator('#pqSubmit')).toHaveText('Publish to website with images');
  await press(page);
  await expect(review(page)).toContainText('/product/maroon-silk-hijab');
  await press(page);
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  expect(await page.evaluate(() => window.__staged[0][1].id)).toBe('maroon-silk-hijab');
});

test('"Back to edit" closes the summary and keeps everything typed', async ({ page }) => {
  await setup(page);
  await fill(page);
  await addPhotos(page, ['#161e50']);
  await press(page);
  await page.click('#pqBack');
  await expect(review(page)).toBeHidden();
  await expect(page.locator('#pqBack')).toBeHidden();
  await expect(page.locator('#pq_name')).toHaveValue('Navy Silk Hijab');
  await expect(page.locator('#pq_name')).toBeFocused();
  await expect(page.locator('.pm-quick-thumb')).toHaveCount(1);
  expect(await page.evaluate(() => window.__staged.length)).toBe(0);
});

test('problems are still listed first; no summary is shown for an incomplete form', async ({ page }) => {
  await setup(page);
  await page.fill('#pq_name', 'Navy Silk Hijab');
  await press(page);
  await expect(page.locator('#pqStatus')).toContainText('Please fix these');
  await expect(review(page)).toBeHidden();
});

test('saving changes to an existing product needs no summary', async ({ page }) => {
  const existing = { id: 'HJ-OLD', name: 'Old Hijab', price: '500', sizes: ['Free Size'], image: 'images/uploads/hj-old.webp', images: [] };
  await setup(page, [existing]);
  await page.evaluate((p) => { document.getElementById('pmQuickUpload').click(); window.MaProductQuickUpload.edit(p, 'hijab'); }, existing);
  await page.fill('#pq_price', '550');
  await press(page);
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  await expect(review(page)).toBeHidden();
  const p = await page.evaluate(() => window.__staged[0][1]);
  expect([p.id, p.price]).toEqual(['HJ-OLD', 550]);
});

test('full journey: copy, two colours, stock, automatic SEO, summary, publish, live link, next product', async ({ page }) => {
  const source = { id: 'HJ-SRC', name: 'Source Hijab', price: '700', fabric: 'Georgette', sizes: ['Free Size'], detailNote: 'Soft georgette hijab.', image: 'images/uploads/src.webp', images: [] };
  await setup(page, [source]);
  await page.evaluate((p) => window.MaProductQuickUpload.copyFrom(p, 'hijab'), source);
  await expect(page.locator('#pq_price')).toHaveValue('700');
  await page.fill('#pq_name', 'Georgette Hijab Duo');
  await addPhotos(page, ['#161e50', '#6e1223']);
  await page.locator('.pm-quick-thumb').first().locator('.pm-quick-color').fill('Navy');
  await page.locator('.pm-quick-thumb').nth(1).locator('.pm-quick-color').fill('Maroon');
  await page.locator('#pqStock input[data-variant="navy · Free Size"]').fill('3');
  await page.locator('#pqStock input[data-variant="maroon · Free Size"]').fill('0');
  await press(page);
  await expect(review(page)).toContainText('Navy, Maroon');
  await expect(review(page)).toContainText('2 variation(s), 3 piece(s) in total');
  await expect(review(page)).toContainText('2 (the ★ one is the main photo)');
  await press(page);
  await expect.poll(() => page.evaluate(() => window.__stock.length)).toBe(1);
  const p = await page.evaluate(() => window.__staged[0][1]);
  expect(p.id).toBe('georgette-hijab-duo');
  expect(p.fabric).toBe('Georgette');
  expect(p.colorVariants.map((c) => c.colorLabel)).toEqual(['Navy', 'Maroon']);
  expect(p.seoTitle).toBe('Georgette Hijab Duo | Muslim Abaya');
  expect(p.seoDescription.length).toBeLessThanOrEqual(160);
  expect(p.variationSkus).toEqual({ 'navy · Free Size': 'GEORGETTE-HIJAB-DUO-NAVY-FREE-SIZE', 'maroon · Free Size': 'GEORGETTE-HIJAB-DUO-MAROON-FREE-SIZE' });
  expect(await page.evaluate(() => window.__stock[0].map((r) => [r.variant, r.qty]))).toEqual([['navy · Free Size', 3], ['maroon · Free Size', 0]]);
  // Not live yet: "Add another product" waits for the deploy confirmation.
  await expect(page.locator('#pqAnother')).toBeDisabled();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('ma-product-live', { detail: { productId: 'georgette-hijab-duo' } })));
  await expect(page.locator('#pqView')).toHaveAttribute('href', '/product/georgette-hijab-duo');
  await expect(page.locator('#pqAnother')).toBeEnabled();
  await page.click('#pqAnother');
  await expect(page.locator('#pq_name')).toHaveValue('');
  await expect(page.locator('.pm-quick-thumb')).toHaveCount(0);
  await expect(review(page)).toBeHidden();
  await expect(page.locator('#pqSubmit')).toHaveText('Publish to website with images');
});

test('editing with new photos: a colour that pointed to an old photo now points to the new main photo', async ({ page }) => {
  const existing = { id: 'HJ-OLD', name: 'Old Hijab', price: '500', sizes: ['Free Size'], color: 'black', colorLabel: 'Black', image: 'images/uploads/hj-old.webp', images: [], colorVariants: [{ color: 'black', colorLabel: 'Black', image: 'images/uploads/hj-old.webp' }] };
  await setup(page, [existing]);
  await page.evaluate((p) => window.MaProductQuickUpload.edit(p, 'hijab'), existing);
  await addPhotos(page, ['#111111']);
  await press(page);
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  const p = await page.evaluate(() => window.__staged[0][1]);
  expect(p.image).not.toBe('images/uploads/hj-old.webp');
  expect(p.colorVariants.map((c) => c.image)).toEqual([p.image]);
});
