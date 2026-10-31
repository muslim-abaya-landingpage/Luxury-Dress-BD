// Smart Product Upload, stage 2: colour suggestions per photo; confirmed colours are linked to their photos.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

async function setup(page) {
  await page.setContent(`<!doctype html><html><body><button id="pmQuickUpload">new</button><a id="pmLiveLink" hidden></a><button id="pmPublishCheck"></button></body></html>`);
  await page.evaluate(() => { if (!crypto.randomUUID) crypto.randomUUID = () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; });
  await page.addScriptTag({ path: path.join(root, 'product-publish-utils.js') });
  await page.addScriptTag({ path: path.join(root, 'product-color-detect.js') });
  await page.addScriptTag({ content: 'window.__staged=[];window.MaCatalogPublisher={isReady:()=>true,enqueue(){},check(){}};window.__products={};' });
  await page.addScriptTag({ path: path.join(root, 'product-quick-upload.js') });
  await page.evaluate(() => window.MaProductQuickUpload.mount({
    sections: () => [{ key: 'hijab', menuBn: 'হিজাব' }], products: () => window.__products, status() {}, isSaved: () => true,
    stage: (cat, p) => window.__staged.push([cat, p]), publish: async () => {} }));
  await page.click('#pmQuickUpload');
  await page.fill('#pq_name', 'Test Hijab');
  await page.fill('#pq_price', '650');
  await page.fill('#pq_sizes', 'Free Size');
}

/** Real image files: white studio background with a coloured garment in the middle. */
async function addPhotos(page, colours) {
  await page.evaluate(async (list) => {
    const dt = new DataTransfer();
    for (const [i, c] of list.entries()) {
      const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 260;
      const g = canvas.getContext('2d');
      g.fillStyle = '#fafafa'; g.fillRect(0, 0, 200, 260);
      g.fillStyle = c; g.fillRect(40, 20, 120, 220);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
      dt.items.add(new File([blob], 'p' + i + '-' + c.replace('#', '') + '.png', { type: 'image/png', lastModified: 1000 + i }));
    }
    const input = document.getElementById('pqPhotos');
    input.files = dt.files; input.dispatchEvent(new Event('change'));
  }, colours);
}
const suggestions = (page) => page.locator('.pm-quick-thumb .pm-quick-suggest').evaluateAll((l) => l.map((b) => (b.hidden ? '' : b.textContent)));

test('each photo gets a colour suggestion; nothing is applied until it is tapped', async ({ page }) => {
  await setup(page);
  await addPhotos(page, ['#161e50', '#6e1223', '#0c0c0c']);
  await expect(page.locator('.pm-quick-thumb .pm-quick-suggest:not([hidden])')).toHaveCount(3);
  expect(await suggestions(page)).toEqual(['Navy ✓', 'Maroon ✓', 'Black ✓']);
  await expect(page.locator('.pm-quick-color').first()).toHaveValue('');
  await expect(page.locator('#pq_color')).toHaveValue('');
  // accept the first one by tapping, the rest with "use all"
  await page.locator('.pm-quick-thumb').first().locator('.pm-quick-suggest').click();
  await expect(page.locator('.pm-quick-color').first()).toHaveValue('Navy');
  await expect(page.locator('#pq_color')).toHaveValue('Navy');
  await page.click('#pqUseAll');
  await expect(page.locator('#pq_color')).toHaveValue('Navy, Maroon, Black');
  await expect(page.locator('#pqUseAll')).toBeHidden();
});

test('publish: different colours are linked to their own photos, in the chosen photo order', async ({ page }) => {
  await setup(page);
  await addPhotos(page, ['#161e50', '#6e1223']);
  await page.click('#pqUseAll');
  await page.locator('.pm-quick-thumb').nth(1).locator('.pm-quick-color').fill('Wine Red'); // own wording wins
  await page.locator('.pm-quick-thumb').nth(1).locator('[data-act="main"]').click(); // Wine Red photo becomes the main one
  await page.fill('#pq_sku', 'HJ-COL-1');
  await page.evaluate(() => (() => { const f = document.getElementById('pqForm'); f.requestSubmit(); const r = document.getElementById('pqReview'); if (r && !r.hidden) f.requestSubmit(); })());
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  const p = (await page.evaluate(() => window.__staged[0]))[1];
  expect(p.colorLabel).toBe('Wine Red, Navy');
  expect(p.image).toBe('images/uploads/hj-col-1-1.webp');
  expect(p.colorVariants).toEqual([
    { color: 'wine-red', colorLabel: 'Wine Red', image: 'images/uploads/hj-col-1-1.webp' },
    { color: 'navy', colorLabel: 'Navy', image: 'images/uploads/hj-col-1-2.webp' }]);
});

test('publish: one colour on every photo is a plain single-colour product (no colour variants)', async ({ page }) => {
  await setup(page);
  await addPhotos(page, ['#161e50', '#1a2258']);
  await page.click('#pqUseAll');
  await page.fill('#pq_sku', 'HJ-COL-2');
  await page.evaluate(() => (() => { const f = document.getElementById('pqForm'); f.requestSubmit(); const r = document.getElementById('pqReview'); if (r && !r.hidden) f.requestSubmit(); })());
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  const p = (await page.evaluate(() => window.__staged[0]))[1];
  expect(p.colorLabel).toBe('Navy');
  expect(p.colorVariants).toBeUndefined();
});

test('publish: a hand-edited Color box that disagrees with the photo colours stops variants from being guessed', async ({ page }) => {
  await setup(page);
  await addPhotos(page, ['#161e50', '#6e1223']);
  await page.click('#pqUseAll');
  await page.fill('#pq_color', 'Navy, Burgundy'); // user's own list differs from the photo tags
  await page.fill('#pq_sku', 'HJ-COL-3');
  await page.evaluate(() => (() => { const f = document.getElementById('pqForm'); f.requestSubmit(); const r = document.getElementById('pqReview'); if (r && !r.hidden) f.requestSubmit(); })());
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  const p = (await page.evaluate(() => window.__staged[0]))[1];
  expect(p.colorLabel).toBe('Navy, Burgundy');
  expect(p.colorVariants).toBeUndefined();
});

test('reordering keeps each colour with its photo; removing a photo drops its colour from the list', async ({ page }) => {
  await setup(page);
  await addPhotos(page, ['#161e50', '#6e1223']);
  await page.click('#pqUseAll');
  await page.locator('.pm-quick-thumb').nth(1).locator('[data-act="main"]').click();
  await expect(page.locator('.pm-quick-color').first()).toHaveValue('Maroon');
  await expect(page.locator('#pq_color')).toHaveValue('Maroon, Navy');
  await page.locator('.pm-quick-thumb').first().locator('[data-act="remove"]').click();
  await expect(page.locator('#pq_color')).toHaveValue('Navy');
});
