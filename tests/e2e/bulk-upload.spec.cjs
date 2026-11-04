const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

test('bulk upload validates the full CSV and publishes multiple products together only after confirmation', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ path: path.join(root, 'product-csv.js') });
  await page.addScriptTag({ path: path.join(root, 'product-publish-utils.js') });
  await page.evaluate(() => {
    window.__batch = [];
    window.__published = 0;
    window.__assets = [];
    window.MaCatalogPublisher = { isReady: () => true, enqueue: rows => window.__assets.push(...rows) };
    window.MaImageTools = { resizeToWebp: async (_file, width) => new Blob(['webp-' + width], { type: 'image/webp' }) };
  });
  await page.addScriptTag({ path: path.join(root, 'product-bulk-upload.js') });
  await page.evaluate(() => window.MaProductBulkUpload.mount({
    sections: () => [{ key: 'hijab', menu: 'Hijab', menuBn: 'হিজাব' }],
    products: () => ({}),
    stageMany: rows => window.__batch.push(...rows),
    publish: async () => { window.__published += 1; }
  }));
  await page.evaluate(() => window.MaProductBulkUpload.open());
  const csv = [
    'category,name,sku,price,abaya_only_price,color,fabric,sizes,body,sleeve,dress,palazzo,description,photos',
    'hijab,Navy Silk Hijab,HIJAB-NAVY-1,650,,Navy,Silk,Free Size,,,,,Soft silk hijab,',
    'Hijab,Olive Cotton Hijab,,720,,Olive,Cotton,Free Size,,,,,Breathable cotton,'
  ].join('\n');
  await page.locator('#pbuCsv').setInputFiles({ name: 'bulk.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.locator('#pbuImages').setInputFiles([
    { name: 'wrong-name.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('navy') },
    { name: 'Olive-Cotton-Hijab-front.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('olive') }
  ]);
  await expect(page.locator('#pbuPreview')).toContainText('1/2');
  await expect(page.locator('#pbuPreview')).toContainText('Auto-match: product name');
  await expect(page.locator('#pbuPublish')).toBeDisabled();
  await page.locator('.pbu-name-input').nth(0).fill('HIJAB-NAVY-1-main.jpg');
  await page.locator('#pbuAutoMatch').click();
  await expect(page.locator('#pbuPreview')).toContainText('2/2');
  await expect(page.locator('#pbuPreview')).toContainText('Auto-match: SKU');
  await expect(page.locator('#pbuPublish')).toBeEnabled();
  expect(await page.evaluate(() => [window.__batch.length, window.__published, window.__assets.length])).toEqual([0, 0, 0]);
  await page.locator('#pbuPublish').click();
  await expect(page.locator('#pbuNote')).toContainText('সফল! 2টি পণ্য একসঙ্গে publish হয়েছে');
  const result = await page.evaluate(() => ({
    names: window.__batch.map(row => row.product.name),
    categories: window.__batch.map(row => row.category),
    paths: window.__batch.map(row => row.product.image),
    publishCount: window.__published,
    assetCount: window.__assets.length
  }));
  expect(result.names).toEqual(['Navy Silk Hijab', 'Olive Cotton Hijab']);
  expect(result.categories).toEqual(['hijab', 'hijab']);
  expect(result.paths.every(path => path.startsWith('images/uploads/bulk-'))).toBe(true);
  expect(result.publishCount).toBe(1);
  expect(result.assetCount).toBe(4); // main + small card image for each product
});

test('bulk upload blocks every row if one SKU duplicates an existing product', async ({ page }) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ path: path.join(root, 'product-csv.js') });
  await page.addScriptTag({ path: path.join(root, 'product-publish-utils.js') });
  await page.evaluate(() => { window.MaCatalogPublisher = { isReady: () => true }; });
  await page.addScriptTag({ path: path.join(root, 'product-bulk-upload.js') });
  await page.evaluate(() => window.MaProductBulkUpload.mount({
    sections: () => [{ key: 'hijab', menu: 'Hijab' }],
    products: () => ({ hijab: [{ id: 'HIJAB-EXISTING' }] }),
    stageMany() { throw new Error('Should not stage an invalid batch'); }, publish() { throw new Error('Should not publish an invalid batch'); }
  }));
  await page.evaluate(() => window.MaProductBulkUpload.open());
  const csv = 'category,name,sku,price,sizes,photos\nhijab,New Hijab,HIJAB-EXISTING,650,Free Size,new.jpg';
  await page.locator('#pbuCsv').setInputFiles({ name: 'duplicate.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.locator('#pbuImages').setInputFiles({ name: 'new.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('image') });
  await expect(page.locator('#pbuPreview')).toContainText('SKU আগে থেকেই আছে');
  await expect(page.locator('#pbuPublish')).toBeDisabled();
});
