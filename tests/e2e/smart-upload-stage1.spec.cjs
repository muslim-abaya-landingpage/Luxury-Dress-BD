// Smart Product Upload, stage 1: own SKU (also the product link), several photos at once with a chosen main
// photo and order, and the description. The publish step is stubbed; this checks what would be staged.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

// 1x1 PNGs of different colours so every file has its own name and bytes.
const png = (n) => ({ name: 'photo-' + n + '.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64') });
const file = (n) => { const f = png(n); f.buffer = Buffer.concat([f.buffer, Buffer.from(String(n))]); return f; };

async function setup(page) {
  // about:blank is not a secure context, so crypto.randomUUID (used for automatic SKUs on https) is missing.
  await page.evaluate(() => { if (!crypto.randomUUID) crypto.randomUUID = () => '0123456789abcdef-0123-4567-89ab-cdef01234567'.replace(/[^-]/g, () => 'a'); });
  await page.setContent(`<!doctype html><html><body><button id="pmQuickUpload">new</button><a id="pmLiveLink" hidden></a><button id="pmPublishCheck"></button></body></html>`);
  await page.addScriptTag({ path: path.join(root, 'product-publish-utils.js') });
  await page.addScriptTag({ content: 'window.__staged=[];window.__assets=[];window.MaCatalogPublisher={isReady:()=>true,enqueue:(a)=>{window.__assets=a.map(x=>x.path);},check(){}};' +
    'window.__products={hijab:[{id:"HJ-EXISTING-1",name:"Existing Hijab",price:500,image:"images/a.webp"}]};' });
  await page.addScriptTag({ path: path.join(root, 'product-quick-upload.js') });
  await page.evaluate(() => window.MaProductQuickUpload.mount({
    sections: () => [{ key: 'hijab', menuBn: 'হিজাব' }], products: () => window.__products, status() {}, isSaved: () => true,
    stage: (cat, p) => window.__staged.push([cat, p]), publish: async () => {} }));
  await page.click('#pmQuickUpload');
  await page.fill('#pq_name', 'Test Hijab');
  await page.fill('#pq_price', '650');
  await page.fill('#pq_sizes', 'Free Size');
  await page.fill('#pq_note', 'Soft georgette hijab.\nMachine washable.');
}
const order = (page) => page.locator('#pqPreview .pm-quick-thumb img').evaluateAll((l) => l.map((i) => i.alt));

test('photos: several at once, pick the main one, reorder, remove, add more, 7 max', async ({ page }) => {
  await setup(page);
  await page.setInputFiles('#pqPhotos', [file(1), file(2), file(3)]);
  expect(await order(page)).toEqual(['photo-1.png', 'photo-2.png', 'photo-3.png']);
  await expect(page.locator('.pm-quick-thumb').first()).toHaveClass(/is-main/);
  // make the 3rd photo the main one
  await page.locator('.pm-quick-thumb').nth(2).locator('[data-act="main"]').click();
  expect(await order(page)).toEqual(['photo-3.png', 'photo-1.png', 'photo-2.png']);
  // move the last one earlier, remove the first
  await page.locator('.pm-quick-thumb').nth(2).locator('[data-act="left"]').click();
  expect(await order(page)).toEqual(['photo-3.png', 'photo-2.png', 'photo-1.png']);
  await page.locator('.pm-quick-thumb').nth(1).locator('[data-act="remove"]').click();
  expect(await order(page)).toEqual(['photo-3.png', 'photo-1.png']);
  // the main photo cannot be moved earlier; the file input mirrors the list
  await expect(page.locator('.pm-quick-thumb').first().locator('[data-act="main"]')).toBeDisabled();
  expect(await page.evaluate(() => Array.from(document.getElementById('pqPhotos').files).map((f) => f.name))).toEqual(['photo-3.png', 'photo-1.png']);
  // choosing again adds to the list; the very same file (name, size, date) twice is ignored
  await page.setInputFiles('#pqPhotos', [file(4)]);
  expect(await order(page)).toEqual(['photo-3.png', 'photo-1.png', 'photo-4.png']);
  await page.evaluate(() => {
    const input = document.getElementById('pqPhotos');
    const f = new File([new Uint8Array([1, 2, 3])], 'same.png', { type: 'image/png', lastModified: 1000 });
    for (let i = 0; i < 2; i++) { const dt = new DataTransfer(); dt.items.add(f); input.files = dt.files; input.dispatchEvent(new Event('change')); }
  });
  expect(await order(page)).toEqual(['photo-3.png', 'photo-1.png', 'photo-4.png', 'same.png']);
  // 7 max
  await page.setInputFiles('#pqPhotos', [file(5), file(6), file(7), file(8)]);
  expect((await order(page)).length).toBe(7);
  await expect(page.locator('#pqStatus')).toContainText('Only 7 photos');
});

test('publish: the chosen main photo and order are what is staged; description is kept', async ({ page }) => {
  await setup(page);
  await page.setInputFiles('#pqPhotos', [file(1), file(2), file(3)]);
  await page.locator('.pm-quick-thumb').nth(2).locator('[data-act="main"]').click();
  await page.fill('#pq_sku', 'HJ-TEST-1');
  await page.evaluate(() => document.getElementById('pqForm').requestSubmit());
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  const [cat, p] = await page.evaluate(() => window.__staged[0]);
  expect(cat).toBe('hijab');
  expect(p.id).toBe('HJ-TEST-1');
  expect(p.detailNote).toBe('Soft georgette hijab.\nMachine washable.');
  expect(p.image).toBe('images/uploads/hj-test-1-1.webp');
  expect(p.images).toEqual(['images/uploads/hj-test-1-2.webp', 'images/uploads/hj-test-1-3.webp']);
  expect(await page.evaluate(() => window.__assets)).toEqual(['images/uploads/hj-test-1-1.webp', 'images/uploads/hj-test-1-2.webp', 'images/uploads/hj-test-1-3.webp', 'images/uploads/hj-test-1-card.webp']);
  // after publishing the SKU is locked and the photo list is cleared (no double upload)
  await expect(page.locator('#pq_sku')).toBeDisabled();
  expect(await order(page)).toEqual([]);
});

test('SKU: empty makes an automatic one from the name; invalid or duplicate is refused before anything is staged', async ({ page }) => {
  await setup(page);
  await page.setInputFiles('#pqPhotos', [file(1)]);
  for (const bad of ['a', 'bad sku!', '-start', 'hj-existing-1']) {
    await page.fill('#pq_sku', bad);
    await expect(page.locator('#pqSkuHint')).toHaveClass(/pm-quick-error/);
    expect(await page.evaluate(() => document.getElementById('pq_sku').checkValidity())).toBe(false);
    await page.evaluate(() => document.getElementById('pqForm').requestSubmit());
    expect(await page.evaluate(() => window.__staged.length)).toBe(0);
  }
  await expect(page.locator('#pqSkuHint')).toContainText('already used'); // last value was the duplicate (any case)
  await page.fill('#pq_sku', '');
  expect(await page.evaluate(() => document.getElementById('pq_sku').checkValidity())).toBe(true);
  await page.evaluate(() => document.getElementById('pqForm').requestSubmit());
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  // Stage 4: an empty SKU now takes a readable link from the name (Bangla-only names keep the P- code, see stage 4 tests).
  expect(await page.evaluate(() => window.__staged[0][1].id)).toBe('test-hijab');
});

test('editing an existing product shows its SKU locked; a new product after it starts clean', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { document.querySelector('.pm-quick-dialog').close(); window.MaProductQuickUpload.edit(window.__products.hijab[0], 'hijab'); });
  await expect(page.locator('#pq_sku')).toHaveValue('HJ-EXISTING-1');
  await expect(page.locator('#pq_sku')).toBeDisabled();
  await page.evaluate(() => { document.querySelector('.pm-quick-dialog').close(); });
  await page.click('#pmQuickUpload');
  await expect(page.locator('#pq_sku')).toBeEnabled();
  await expect(page.locator('#pq_sku')).toHaveValue('');
  expect(await order(page)).toEqual([]);
});
