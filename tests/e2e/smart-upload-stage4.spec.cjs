// Smart Product Upload, stage 4: automatic product link and search listing in the upload form.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

async function setup(page, products) {
  await page.setContent(`<!doctype html><html><body><button id="pmQuickUpload">new</button><a id="pmLiveLink" hidden></a><button id="pmPublishCheck"></button></body></html>`);
  await page.evaluate(() => { if (!crypto.randomUUID) crypto.randomUUID = () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; });
  await page.addScriptTag({ path: path.join(root, 'product-publish-utils.js') });
  await page.addScriptTag({ path: path.join(root, 'product-color-detect.js') });
  await page.addScriptTag({ content: 'window.__staged=[];window.MaCatalogPublisher={isReady:()=>true,enqueue(){},check(){}};window.__products=' + JSON.stringify(products || {}) + ';' });
  await page.addScriptTag({ path: path.join(root, 'product-quick-upload.js') });
  await page.evaluate(() => window.MaProductQuickUpload.mount({
    sections: () => [{ key: 'hijab', menuBn: 'হিজাব' }], products: () => window.__products, status() {}, isSaved: () => true,
    stage: (cat, p) => window.__staged.push([cat, p]), publish: async () => {} }));
  await page.click('#pmQuickUpload');
  await page.fill('#pq_price', '650');
  await page.fill('#pq_sizes', 'Free Size');
  await page.fill('#pq_fabric', 'Jersey');
}
async function addPhoto(page) {
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 60; canvas.height = 80;
    canvas.getContext('2d').fillRect(0, 0, 60, 80);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'a.png', { type: 'image/png', lastModified: 1 }));
    const input = document.getElementById('pqPhotos'); input.files = dt.files; input.dispatchEvent(new Event('change'));
  });
}
const submit = (page) => page.evaluate(() => document.getElementById('pqForm').requestSubmit());
const staged = (page) => page.evaluate(() => window.__staged[0] && window.__staged[0][1]);

test('no SKU typed: the link comes from the name and is made unique; the listing is written automatically', async ({ page }) => {
  await setup(page, { hijab: [{ id: 'black-jersey-hijab', name: 'Old one' }] });
  await page.fill('#pq_name', 'Black Jersey Hijab');
  await expect(page.locator('#pqSkuHint')).toHaveText('Automatic link: /product/black-jersey-hijab-2 (type a SKU to use your own).');
  await expect(page.locator('#pq_seoTitle')).toHaveAttribute('placeholder', 'Black Jersey Hijab | Muslim Abaya');
  await expect(page.locator('#pqSeoTitleCount')).toHaveText('33 / 60 characters (automatic)');
  await addPhoto(page);
  await submit(page);
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  const p = await staged(page);
  expect(p.id).toBe('black-jersey-hijab-2');
  expect(p.seoTitle).toBe('Black Jersey Hijab | Muslim Abaya');
  expect(p.seoDescription).toBe('Black Jersey Hijab. Fabric: Jersey. ৳650. Cash on delivery across Bangladesh.');
});

test('typed SKU and typed listing win over the automatic ones', async ({ page }) => {
  await setup(page);
  await page.fill('#pq_name', 'Black Jersey Hijab');
  await page.fill('#pq_sku', 'HJ-77');
  await page.click('.pm-quick-seo summary');
  await page.fill('#pq_seoTitle', 'Soft black hijab for daily wear');
  await page.fill('#pq_seoDesc', 'My own description.');
  await expect(page.locator('#pqSeoTitleCount')).toHaveText('31 / 60 characters');
  await addPhoto(page);
  await submit(page);
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  const p = await staged(page);
  expect([p.id, p.seoTitle, p.seoDescription]).toEqual(['HJ-77', 'Soft black hijab for daily wear', 'My own description.']);
});

test('a Bangla-only name without SKU keeps the automatic P- code', async ({ page }) => {
  await setup(page);
  await page.fill('#pq_name', 'কালো হিজাব');
  await expect(page.locator('#pqSkuHint')).toHaveText('Also the product link: /product/SKU. Cannot be changed after publishing.');
  await addPhoto(page);
  await submit(page);
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  expect((await staged(page)).id).toMatch(/^P-[0-9A-F]{16}$/);
});

test('editing: the saved listing is shown; clearing it returns to the website automatic text', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.MaProductQuickUpload.edit({ id: 'HJ-5', name: 'Old Hijab', price: 500, sizes: ['Free Size'], image: 'images/a.webp',
    seoTitle: 'Saved title', seoDescription: 'Saved description' }, 'hijab'));
  await expect(page.locator('#pq_seoTitle')).toHaveValue('Saved title');
  await page.click('.pm-quick-seo summary');
  await page.fill('#pq_seoTitle', '');
  await submit(page);
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  const p = await staged(page);
  expect(p.seoTitle).toBeUndefined();
  expect(p.seoDescription).toBe('Saved description');
});
