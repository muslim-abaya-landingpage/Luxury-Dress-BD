// Product Manager — WooCommerce-style additions: sale price, Draft, Trash (restore / delete permanently),
// SEO box, sortable columns and CSV export / import. Publishing is stubbed; the published files are checked.
const { test, expect } = require('@playwright/test');

async function open(page, { fail = false } = {}) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null}};' }));
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate((fail) => {
    window.__published = null; window.__publishCount = 0;
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true,
      publish: (files) => { window.__publishCount++; if (fail) return Promise.reject(new Error('offline')); window.__published = files; return Promise.resolve({ ok: true }); } });
  }, fail);
}
const productsFile = (page) => page.evaluate(() => window.__published && window.__published.find((f) => f.path === 'category-products.js').content);
const entry = (file, id) => { const i = file.indexOf('id: "' + id + '"'); const j = file.indexOf('\n    }', i); return i === -1 ? '' : file.slice(i, j); };

test('sale price: before-sale price per option, card price follows the first option, list shows the sale', async ({ page }) => {
  await open(page);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click(); // ABY-MAROON-1 (Full Set / Abaya Only)
  // WooCommerce boxes: Regular 1299 / Sale 1250 and Regular 999 / Sale 1000 → refused (not lower), so Sale = 1000 is rejected.
  const reg = page.locator('.pm-opt-row .pm-opt-regular'), sale = page.locator('.pm-opt-row .pm-opt-sale');
  await expect(reg).toHaveCount(2);
  await reg.nth(0).fill('1299'); await sale.nth(0).fill('1250');
  await reg.nth(1).fill('999'); await sale.nth(1).fill('1000');
  await expect(sale.nth(1)).toHaveClass(/pm-price-bad/);
  await reg.nth(1).fill('1100'); await sale.nth(1).fill('1000');
  await page.click('#pmEditUpdate');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  const e = entry(await productsFile(page), 'ABY-MAROON-1');
  expect(e).toMatch(/regularPriceByType: \{"Full Set Borka, Hijab\+ Niqab":1299,"Abaya Only":1100\}/);
  expect(e).toMatch(/\bpriceByType: \{\s*"Full Set Borka, Hijab\+ Niqab":\s*1250,\s*"Abaya Only":\s*1000\s*\}/);
  expect(e).toContain('regularPrice: 1299');
  await page.click('#pmEditBack');
  // Several option prices: the list shows the range and a Sale tag.
  const row = page.locator('#pmAllRows tr').first();
  await expect(row.locator('.column-price')).toContainText('৳1000 – ৳1250');
  await expect(row.locator('.column-price .pm-sale-tag')).toHaveText('Sale');
});

test('Draft: hidden status is saved, shown in the list and counted under Drafts', async ({ page }) => {
  await open(page);
  // The live catalog may already hold drafts; count relative to what is there now.
  const draftsBefore = Number(((await page.locator('[data-overview-status="draft"]').textContent().catch(() => '')) || '').replace(/\D+/g, '') || 0);
  await page.locator('#pmAllRows tr').nth(1).locator('.pm-row-title').click();
  const id = (await page.locator('[data-ef="id"]').inputValue());
  await page.click('[data-misc="status"]');
  await page.selectOption('#pmEditStatus', 'draft');
  await page.click('[data-misc-ok="status"]');
  await expect(page.locator('#pmStatusLabel')).toHaveText('Draft');
  await expect(page.locator('#pmEditUpdate')).toHaveText('Publish');
  await expect(page.locator('#pmStatusNote')).toContainText('Hidden from the website');
  await page.click('#pmSaveDraft');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  expect(entry(await productsFile(page), id)).toContain('status: "draft"');
  await page.click('#pmEditBack');
  await expect(page.locator('[data-overview-status="draft"]')).toContainText('(' + (draftsBefore + 1) + ')');
  await expect(page.locator('#pmAllRows tr').nth(1).locator('.pm-post-state')).toHaveText('— Draft');
  await page.click('[data-overview-status="draft"]');
  await expect(page.locator('#pmAllRows tr')).toHaveCount(draftsBefore + 1);
  await expect(page.locator('#pmAllRows .column-sku', { hasText: id })).toHaveCount(1);
});

test('Trash: bulk move, then restore one and delete the other permanently; a failed save changes nothing', async ({ page }) => {
  await open(page);
  const total = await page.locator('[data-overview-status=""] .count').textContent();
  const ids = [];
  for (const i of [0, 1]) {
    const tr = page.locator('#pmAllRows tr').nth(i);
    ids.push((await tr.locator('.column-sku').textContent()).trim());
    await tr.locator('.pm-overview-check').check();
  }
  await page.selectOption('#pmBulkAction', 'trash');
  await page.click('#pmBulkApply');
  await expect.poll(async () => (await productsFile(page)) || '').toContain('status: "trash"');
  let file = await productsFile(page);
  for (const id of ids) { expect(entry(file, id)).toContain('status: "trash"'); expect(entry(file, id)).toMatch(/trashedAt: "\d{4}-\d{2}-\d{2}"/); }
  await expect(page.locator('[data-overview-status="trash"]')).toContainText('(2)');
  await expect(page.locator('[data-overview-status=""] .count')).not.toHaveText(total);
  await page.click('[data-overview-status="trash"]');
  await expect(page.locator('#pmAllRows tr')).toHaveCount(2);
  const r0 = page.locator('#pmAllRows tr').filter({ hasText: ids[0] });
  await r0.hover(); // row actions appear on hover, as in WordPress
  await r0.locator('[data-status-action="restore"]').click();
  await expect.poll(async () => entry((await productsFile(page)) || '', ids[0])).not.toContain('status:');
  const r1 = page.locator('#pmAllRows tr').filter({ hasText: ids[1] });
  await r1.hover();
  await r1.locator('[data-status-action="delete"]').click();
  await expect.poll(async () => entry((await productsFile(page)) || '', ids[1])).toBe('');
  file = await productsFile(page);
  expect(entry(file, ids[0])).toContain('id: "' + ids[0] + '"');
});

test('Trash: when saving fails the products stay where they were', async ({ page }) => {
  await open(page, { fail: true });
  await page.locator('#pmAllRows tr').first().locator('.pm-overview-check').check();
  await page.selectOption('#pmBulkAction', 'trash');
  await page.click('#pmBulkApply');
  await expect(page.locator('#pmSaveStatus')).toContainText('Not saved');
  await expect(page.locator('[data-overview-status="trash"]')).toHaveCount(0);
});

test('SEO box: preview and counters, the custom title and description are saved', async ({ page }) => {
  await open(page);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  await expect(page.locator('#pmSeoPrevTitle')).toHaveText('Maroon Abaya Set | Muslim Abaya Bangladesh');
  await expect(page.locator('#pmSeoTitleCount')).toContainText('(automatic)');
  await page.fill('#pmSeoTitle', 'Maroon Abaya Set — Eid Offer');
  await page.fill('#pmSeoDesc', 'Dubai cherry maroon abaya with hijab. Cash on delivery all over Bangladesh.');
  await expect(page.locator('#pmSeoPrevTitle')).toHaveText('Maroon Abaya Set — Eid Offer');
  await expect(page.locator('#pmSeoTitleCount')).toHaveText('28 / 60 characters');
  await page.click('#pmEditUpdate');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  const e = entry(await productsFile(page), 'ABY-MAROON-1');
  expect(e).toContain('seoTitle: "Maroon Abaya Set — Eid Offer"');
  expect(e).toContain('seoDescription: "Dubai cherry maroon abaya with hijab.');
});

test('columns sort by price and name, both directions', async ({ page }) => {
  await open(page);
  const prices = async () => (await page.locator('#pmAllRows tr .column-price').allTextContents()).map((t) => parseInt(t.replace(/.*৳/, ''), 10));
  await page.locator('thead [data-sort="price"]').click();
  let p = await prices();
  expect(p).toEqual([...p].sort((a, b) => a - b));
  await expect(page.locator('thead th.column-price')).toHaveAttribute('aria-sort', 'ascending');
  await page.locator('thead [data-sort="price"]').click();
  p = await prices();
  expect(p).toEqual([...p].sort((a, b) => b - a));
  await page.locator('thead [data-sort="name"]').click();
  const names = (await page.locator('#pmAllRows .pm-row-title').allTextContents());
  expect(names).toEqual([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
});

test('CSV: export downloads every product; import previews changes and problems, then saves', async ({ page }) => {
  await open(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#pmCsvExport')]);
  expect(download.suggestedFilename()).toMatch(/^muslimabaya-products-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = require('fs').readFileSync(await download.path(), 'utf8');
  expect(text.startsWith('﻿SKU,Name,Category,Status,Price')).toBe(true);
  expect(text).toContain('ABY-MAROON-1,Maroon Abaya Set,ABAYA,Published');
  const csv = 'SKU,Price,Tags,Before-sale price\nABY-MAROON-1,,"eid, offer",\nNOPE-1,500,,\n';
  await page.setInputFiles('#pmCsvFile', { name: 'import.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const dlg = page.locator('#pmImportDialog');
  await expect(dlg).toContainText('1 product(s) will change');
  await expect(dlg).toContainText('ABY-MAROON-1');
  await expect(dlg).toContainText('Tags');
  await expect(dlg).toContainText('Row 3: New product NOPE-1 needs a Category.');
  await dlg.locator('[data-import-apply]').click();
  await expect(dlg).toHaveCount(0);
  const e = entry(await productsFile(page), 'ABY-MAROON-1');
  expect(e).toContain('tags: ["eid","offer"]');
  expect(e).toContain('price: 1250'); // empty Price cell left current catalog price unchanged
});

test('sale price on a single-price product shows the crossed-out price in the list', async ({ page }) => {
  await open(page);
  // Find a product without options (card price only).
  const idx = await page.evaluate(() => Array.from(document.querySelectorAll('#pmAllRows tr .column-price')).findIndex((td) => !/–/.test(td.textContent)));
  test.skip(idx < 0, 'no single-price product on the first page');
  await page.locator('#pmAllRows tr').nth(idx).locator('.pm-row-title').click();
  const simple = (await page.locator('[data-ef="salePrice"]').count()) > 0;
  const price = parseInt(simple ? await page.locator('[data-ef="regularPrice"]').inputValue()
    : (await page.locator('#pmCardPrice').textContent()).replace(/\D/g, ''), 10);
  if (simple) { await page.fill('[data-ef="regularPrice"]', String(price + 300)); await page.fill('[data-ef="salePrice"]', String(price)); }
  else { await page.locator('.pm-opt-row .pm-opt-regular').first().fill(String(price + 300)); await page.locator('.pm-opt-row .pm-opt-sale').first().fill(String(price)); }
  await page.click('#pmEditBack');
  await expect(page.locator('#pmAllRows tr').nth(idx).locator('.column-price del')).toHaveText('৳' + (price + 300));
});

test('sale schedule: Schedule shows From/To dates, they publish with the product, Cancel removes them', async ({ page }) => {
  await open(page);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click(); // ABY-MAROON-1
  await expect(page.locator('#pmSaleDates')).toBeHidden();
  await page.click('#pmSaleSchedule');
  await expect(page.locator('#pmSaleDates')).toBeVisible();
  await page.fill('#pmEf_saleFrom', '2030-01-01');
  await page.fill('#pmEf_saleTo', '2030-01-10');
  await expect(page.locator('#pmSaleNote')).toContainText('starts on 2030-01-01');
  await page.click('#pmEditUpdate');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  let e = entry(await productsFile(page), 'ABY-MAROON-1');
  expect(e).toContain('saleFrom: "2030-01-01"');
  expect(e).toContain('saleTo: "2030-01-10"');
  await page.evaluate(() => { window.__published = null; });
  await page.click('#pmSaleCancel');
  await expect(page.locator('#pmSaleSchedule')).toBeVisible();
  await page.click('#pmEditUpdate');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  e = entry(await productsFile(page), 'ABY-MAROON-1');
  expect(e).not.toContain('saleFrom');
});

test('WooCommerce fields: inventory, shipping, linked products, advanced, short description, visibility and publish date are saved', async ({ page }) => {
  await open(page);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click(); // ABY-MAROON-1
  await page.click('[data-etab="inventory"]');
  await page.fill('[data-ef="sku"]', 'MA-001');
  await page.fill('[data-ef="gtin"]', '1234567890123');
  await page.check('[data-ef="soldIndividually"]');
  await page.click('[data-etab="shipping"]');
  await page.fill('[data-ef="weight"]', '0.6');
  await page.fill('[data-ef="dimLength"]', '30');
  await page.click('[data-etab="linked"]');
  await page.fill('[data-picker-input="upsells"]', 'two');
  await page.locator('[data-picker-list="upsells"] [data-pick-id]').first().dispatchEvent('mousedown');
  await expect(page.locator('[data-picker="upsells"] .pm-woo-chip')).toHaveCount(1);
  await page.click('[data-etab="advanced"]');
  await page.fill('[data-ef="purchaseNote"]', 'Thank you!');
  await page.fill('[data-ef="menuOrder"]', '3');
  await page.uncheck('[data-ef="reviewsAllowed"]');
  await page.click('#pmShortEditor [data-ed-mode="code"]');
  await page.fill('#pmShortEditor .pm-woo-ed-code', '<p>Soft <em>Dubai cherry</em></p>');
  await page.click('[data-misc="vis"]');
  await page.check('input[name="pmVis"][value="private"]');
  await page.click('[data-misc-ok="vis"]');
  await expect(page.locator('#pmVisLabel')).toHaveText('Private');
  await page.click('[data-misc="date"]');
  await page.fill('#pmPubDate', '2030-05-01T10:30');
  await page.click('[data-misc-ok="date"]');
  await expect(page.locator('#pmPubLabel')).toContainText('Scheduled for');
  await expect(page.locator('#pmEditUpdate')).toHaveText('Schedule');
  await page.click('#pmEditUpdate');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  const e = entry(await productsFile(page), 'ABY-MAROON-1');
  for (const want of ['sku: "MA-001"', 'gtin: "1234567890123"', 'soldIndividually: true', 'weight: 0.6', 'dimLength: 30', 'upsells: [', 'purchaseNote: "Thank you!"',
    'menuOrder: 3', 'reviewsAllowed: false', 'shortDescription: "<p>Soft <em>Dubai cherry</em></p>"', 'visibility: "private"', 'publishDate: "2030-05-01T10:30"']) expect(e).toContain(want);
});

test('Sorting: drag order with ↑ ↓ is saved as the category order; stock column shows quantity', async ({ page }) => {
  await open(page);
  await page.click('#pmSortingLink');
  await page.selectOption('#pmSortCat', 'abaya');
  const names = page.locator('#pmSortList .pm-sort-name');
  const first = (await names.nth(0).textContent()).trim();
  const second = (await names.nth(1).textContent()).trim();
  await page.click('[data-sort-down="0"]');
  await expect(names.nth(0)).toHaveText(second);
  await expect(names.nth(1)).toHaveText(first);
  await page.click('#pmSortSave');
  await expect(page.locator('#pmSortMsg')).toContainText('Order saved');
  const file = await productsFile(page);
  const abaya = file.slice(file.indexOf('abaya:'), file.indexOf('"cover-up"') > 0 ? file.indexOf('"cover-up"') : undefined);
  expect(abaya.indexOf(second.replace(/ ★ Featured.*$/, ''))).toBeLessThan(abaya.indexOf(first.replace(/ ★ Featured.*$/, '')));
  await page.click('#pmSortBack');
  await expect(page.locator('#pmAllRows .column-stock').first()).toContainText(/In stock|Out of stock|Low stock|On backorder/);
});

test('Preview: the editor saves the product for preview and opens its category page with ?ma_preview', async ({ page, context }) => {
  await open(page);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  await page.fill('.pm-wp-name', 'Preview Name Test');
  const [tab] = await Promise.all([context.waitForEvent('page'), page.click('#pmPreview')]);
  await tab.waitForLoadState('domcontentloaded');
  expect(tab.url()).toMatch(/\/abaya(\.html)?\?ma_preview=ABY-MAROON-1/);
  await expect(tab.locator('.pqv-preview-banner')).toBeVisible({ timeout: 15000 });
  await expect(tab.locator('#pqvTitle')).toHaveText('Preview Name Test');
});

test('one Publish button in the Publish box: no floating save bar, a draft goes live with one click', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page);
  await page.click('#pmHeaderAdd');
  await expect(page.locator('#pmSave')).toBeHidden();
  await expect(page.locator('#pmEditBar, .pm-wp-savebar')).toHaveCount(0);
  await expect(page.locator('#pmEditUpdate')).toHaveText('Publish');
  await page.click('#pmEditBack');
  // A copy is a complete draft (price and photo), like a new product ready to go.
  await page.locator('#pmAllRows tr').nth(1).locator('.pm-row-title').click();
  await page.click('#pmCopyDraft');
  await expect(page.locator('#pmStatusLabel')).toHaveText('Draft');
  await page.fill('[data-ef="name"]', 'E2E One Click Abaya');
  await expect(page.locator('#pmEditNote')).toContainText('click Publish');
  await expect(page.locator('#pmEditNote')).toHaveAttribute('data-state', 'dirty');
  await page.screenshot({ path: 'test-results/pm-one-publish.png' });
  const id = await page.locator('[data-ef="id"]').inputValue();
  await page.click('#pmEditUpdate');
  await expect.poll(() => productsFile(page)).toBeTruthy();
  const e = entry(await productsFile(page), id);
  expect(e).toContain('E2E One Click Abaya');
  expect(e).not.toContain('status: "draft"');
});
