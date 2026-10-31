// Smart Product Upload, stage 3: stock per colour and size, typed once in the upload form.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

async function setup(page, stockReply) {
  await page.setContent(`<!doctype html><html><body><button id="pmQuickUpload">new</button><a id="pmLiveLink" hidden></a><button id="pmPublishCheck"></button></body></html>`);
  await page.evaluate(() => { if (!crypto.randomUUID) crypto.randomUUID = () => 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'; });
  await page.addScriptTag({ path: path.join(root, 'product-publish-utils.js') });
  await page.addScriptTag({ path: path.join(root, 'product-color-detect.js') });
  await page.addScriptTag({ content: 'window.__staged=[];window.__stock=[];window.MaCatalogPublisher={isReady:()=>true,enqueue(){},check(){}};window.__products={};' });
  await page.evaluate((reply) => {
    window.MaAdmin = { commitStockCsv: async (rows, preview) => {
      window.__stock.push({ rows, preview });
      if (reply === 'fail') throw new Error('NOT_LOGGED_IN');
      return { ok: true, applied: rows.length, skipped: 0 };
    } };
  }, stockReply || 'ok');
  await page.addScriptTag({ path: path.join(root, 'product-quick-upload.js') });
  await page.evaluate(() => window.MaProductQuickUpload.mount({
    sections: () => [{ key: 'hijab', menuBn: 'হিজাব' }], products: () => window.__products, status() {}, isSaved: () => true,
    stage: (cat, p) => window.__staged.push([cat, p]), publish: async () => {} }));
  await page.click('#pmQuickUpload');
  await page.fill('#pq_name', 'Test Hijab');
  await page.fill('#pq_price', '650');
  await page.fill('#pq_sizes', '52, 54');
  await page.fill('#pq_sku', 'HJ-ST-1');
}

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
const box = (page, variant) => page.locator(`#pqStock input[data-variant="${variant}"]`);
const submit = (page) => page.evaluate(() => document.getElementById('pqForm').requestSubmit());

test('one colour: a box per size; only filled boxes become stock rows, saved after publishing', async ({ page }) => {
  await setup(page);
  await addPhotos(page, ['#161e50']);
  await page.click('#pqUseAll');
  await expect(page.locator('#pqStock input[data-variant]')).toHaveCount(2);
  await box(page, '52').fill('3');
  await expect(box(page, '52')).toBeFocused(); // typing does not redraw the grid
  await expect(page.locator('#pqStock td small').first()).toHaveText('HJ-ST-1-52');
  await submit(page);
  await expect.poll(() => page.evaluate(() => window.__stock.length)).toBe(1);
  const sent = await page.evaluate(() => window.__stock[0]);
  expect(sent.preview).toBe(false);
  expect(sent.rows).toEqual([{ productId: 'HJ-ST-1', productName: 'Test Hijab', category: 'hijab', variant: '52', qty: 3, reason: 'New product upload' }]);
  const p = (await page.evaluate(() => window.__staged[0]))[1];
  expect(p.variationSkus).toEqual({ 52: 'HJ-ST-1-52' });
  await expect(page.locator('#pqStatus')).toContainText('Stock saved for 1 variation(s).');
});

test('two photo colours: a row per colour, saved as "colour · size" rows', async ({ page }) => {
  await setup(page);
  await addPhotos(page, ['#161e50', '#6e1223']);
  await page.click('#pqUseAll');
  await expect(page.locator('#pqStock input[data-variant]')).toHaveCount(4);
  await box(page, 'navy · 52').fill('2');
  await box(page, 'maroon · 54').fill('0');
  // Changing the sizes redraws the grid and keeps what was typed.
  await page.fill('#pq_sizes', '52, 54, 56');
  await expect(page.locator('#pqStock input[data-variant]')).toHaveCount(6);
  await expect(box(page, 'navy · 52')).toHaveValue('2');
  await submit(page);
  await expect.poll(() => page.evaluate(() => window.__stock.length)).toBe(1);
  const rows = (await page.evaluate(() => window.__stock[0])).rows.map((r) => [r.variant, r.qty]);
  expect(rows).toEqual([['navy · 52', 2], ['maroon · 54', 0]]);
  const p = (await page.evaluate(() => window.__staged[0]))[1];
  expect(p.colorVariants.map((c) => c.color)).toEqual(['navy', 'maroon']);
  expect(p.variationSkus).toEqual({ 'navy · 52': 'HJ-ST-1-NAVY-52', 'maroon · 54': 'HJ-ST-1-MAROON-54' });
});

test('a stock box that is not a whole number stops publishing and keeps the form', async ({ page }) => {
  await setup(page);
  await addPhotos(page, ['#161e50']);
  await box(page, '54').fill('2.5');
  await submit(page);
  await expect(page.locator('#pqStatus')).toContainText('whole number');
  expect(await page.evaluate(() => window.__staged.length)).toBe(0);
  expect(await page.evaluate(() => window.__stock.length)).toBe(0);
});

test('no boxes filled: nothing is sent to the stock sheet', async ({ page }) => {
  await setup(page);
  await addPhotos(page, ['#161e50']);
  await submit(page);
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  expect(await page.evaluate(() => window.__stock.length)).toBe(0);
  expect((await page.evaluate(() => window.__staged[0]))[1].variationSkus).toBeUndefined();
});

test('stock save fails: the product stays published and the message says to use the stock panel', async ({ page }) => {
  await setup(page, 'fail');
  await addPhotos(page, ['#161e50']);
  await box(page, '52').fill('4');
  await submit(page);
  await expect(page.locator('#pqStatus')).toContainText('Stock was not saved (NOT_LOGGED_IN)');
  expect(await page.evaluate(() => window.__staged.length)).toBe(1);
});
