// Smart Product Upload, stage 5: all problems shown at once, draft with photos survives a reload,
// and a failed publish or stock save can be retried without typing anything again.
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

// A real origin (not about:blank) so the browser allows IndexedDB, where draft photos are kept.
async function setup(page, opts) {
  opts = opts || {};
  await page.route('**/__upload-test', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body><button id="pmQuickUpload">new</button><a id="pmLiveLink" hidden></a><button id="pmPublishCheck"></button></body></html>' }));
  await page.goto('/__upload-test');
  await page.addScriptTag({ path: path.join(root, 'product-publish-utils.js') });
  await page.addScriptTag({ path: path.join(root, 'product-color-detect.js') });
  await page.evaluate((o) => {
    window.__staged = []; window.__stock = []; window.__products = {}; window.__failPublish = o.failPublish || 0; window.__failStock = o.failStock || 0;
    window.MaCatalogPublisher = { isReady: () => true, enqueue() {}, check() {} };
    window.MaAdmin = { commitStockCsv: async (rows) => { window.__stock.push(rows); if (window.__failStock-- > 0) throw new Error('NETWORK'); return { applied: rows.length, skipped: 0 }; } };
  }, opts);
  await page.addScriptTag({ path: path.join(root, 'product-quick-upload.js') });
  await page.evaluate(() => window.MaProductQuickUpload.mount({
    sections: () => [{ key: 'hijab', menuBn: 'হিজাব' }], products: () => window.__products, status() {}, isSaved: () => true,
    stage: (cat, p) => window.__staged.push([cat, p]),
    publish: async () => { if (window.__failPublish-- > 0) throw new Error('Could not reach GitHub.'); } }));
  await page.click('#pmQuickUpload');
}
async function addPhotos(page, n) {
  await page.evaluate(async (count) => {
    const dt = new DataTransfer();
    for (let i = 0; i < count; i++) {
      const c = document.createElement('canvas'); c.width = 60; c.height = 80;
      const g = c.getContext('2d'); g.fillStyle = ['#161e50', '#6e1223', '#0c0c0c'][i % 3]; g.fillRect(0, 0, 60, 80);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      dt.items.add(new File([blob], 'photo' + i + '.png', { type: 'image/png', lastModified: 100 + i }));
    }
    const input = document.getElementById('pqPhotos'); input.files = dt.files; input.dispatchEvent(new Event('change'));
  }, n);
}
const submit = (page) => page.evaluate(() => document.getElementById('pqForm').requestSubmit());
const fill = async (page) => {
  await page.fill('#pq_name', 'Draft Hijab');
  await page.fill('#pq_price', '650');
  await page.fill('#pq_sizes', 'Free Size');
};

test('every problem is listed at once and each box is marked; fixing a box clears its mark', async ({ page }) => {
  await setup(page);
  await page.fill('#pq_name', 'A');
  await page.fill('#pq_price', '12.5');
  await submit(page);
  const status = page.locator('#pqStatus');
  await expect(status).toContainText('Please fix these 4 before publishing');
  await expect(status).toContainText('Product name: 2–150 characters.');
  await expect(status).toContainText('Price: a whole number of taka');
  await expect(status).toContainText('Sizes: enter at least one');
  await expect(status).toContainText('Photos: choose at least one');
  await expect(page.locator('#pq_name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#pq_name')).toBeFocused();
  await page.fill('#pq_name', 'Good Name');
  await expect(page.locator('#pq_name')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#pq_price')).toHaveAttribute('aria-invalid', 'true');
  expect(await page.evaluate(() => window.__staged.length)).toBe(0);
});

test('a reload keeps the text, the photos with their colours and the stock boxes', async ({ page }) => {
  await setup(page);
  await fill(page);
  await addPhotos(page, 2);
  await page.locator('.pm-quick-thumb').first().locator('.pm-quick-color').fill('Navy');
  await page.locator('.pm-quick-thumb').nth(1).locator('.pm-quick-color').fill('Maroon');
  await page.locator('#pqStock input[data-variant="navy · Free Size"]').fill('4');
  await expect(page.locator('#pqDraftNote')).toContainText('with 2 photo(s)');
  await page.reload();
  await setup(page);
  await expect(page.locator('.pm-quick-thumb')).toHaveCount(2);
  await expect(page.locator('#pqStatus')).toContainText('Draft restored: the form and 2 photo(s)');
  await expect(page.locator('#pq_name')).toHaveValue('Draft Hijab');
  await expect(page.locator('.pm-quick-thumb').nth(1).locator('.pm-quick-color')).toHaveValue('Maroon');
  await expect(page.locator('#pqStock input[data-variant="navy · Free Size"]')).toHaveValue('4');
  // Publishing clears the draft: the next reload starts empty.
  await submit(page);
  await expect.poll(() => page.evaluate(() => window.__staged.length)).toBe(1);
  expect((await page.evaluate(() => window.__staged[0][1])).colorVariants.map((c) => c.colorLabel)).toEqual(['Navy', 'Maroon']);
  await page.reload();
  await setup(page);
  await expect(page.locator('#pq_name')).toHaveValue('');
  await expect(page.locator('.pm-quick-thumb')).toHaveCount(0);
});

test('"Discard draft" clears the form and the kept photos', async ({ page }) => {
  await setup(page);
  await fill(page);
  await addPhotos(page, 1);
  await expect(page.locator('#pqDraftNote')).toContainText('with 1 photo(s)');
  page.once('dialog', (d) => d.accept());
  await page.click('#pqDiscard');
  await expect(page.locator('#pq_name')).toHaveValue('');
  await expect(page.locator('.pm-quick-thumb')).toHaveCount(0);
  await page.reload();
  await setup(page);
  await expect(page.locator('.pm-quick-thumb')).toHaveCount(0);
  await expect(page.locator('#pq_name')).toHaveValue('');
});

test('publish fails once: the form says nothing is lost, and "Try publishing again" works', async ({ page }) => {
  await setup(page, { failPublish: 1 });
  await fill(page);
  await page.fill('#pq_sku', 'HJ-RETRY');
  await addPhotos(page, 1);
  await submit(page);
  await expect(page.locator('#pqStatus')).toContainText('Could not reach GitHub.');
  await expect(page.locator('#pqStatus')).toContainText('Nothing is lost');
  await expect(page.locator('#pqSubmit')).toHaveText('Try publishing again');
  await expect(page.locator('#pqSubmit')).toBeEnabled();
  await submit(page);
  await expect(page.locator('#pqStatus')).toContainText('Saved.');
  const staged = await page.evaluate(() => window.__staged.map((s) => s[1].id));
  expect(staged).toEqual(['HJ-RETRY', 'HJ-RETRY']); // same product both times, no duplicate id
});

test('stock save fails once: "Retry saving stock" sends the same rows again', async ({ page }) => {
  await setup(page, { failStock: 1 });
  await fill(page);
  await addPhotos(page, 1);
  await page.locator('#pqStock input[data-variant="Free Size"]').fill('6');
  await submit(page);
  await expect(page.locator('#pqStatus')).toContainText('Stock was not saved (NETWORK)');
  await expect(page.locator('#pqStockRetry')).toBeVisible();
  await page.click('#pqStockRetry');
  await expect(page.locator('#pqStatus')).toContainText('Stock saved for 1 variation(s).');
  await expect(page.locator('#pqStockRetry')).toBeHidden();
  const sent = await page.evaluate(() => window.__stock.map((rows) => rows.map((r) => [r.variant, r.qty])));
  expect(sent).toEqual([[['Free Size', 6]], [['Free Size', 6]]]);
});
