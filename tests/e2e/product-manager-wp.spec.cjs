const { test, expect } = require('@playwright/test');

async function stub(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null}};' }));
}

test('product list looks like WordPress Products and shows dates from the catalog', async ({ page }) => {
  await stub(page);
  await page.goto('/product-manager.html');
  await expect(page.locator('.pm-wp-title')).toHaveText('Products');
  await expect(page.locator('#pmAllRows tr')).toHaveCount(20);
  for (const head of ['Name', 'SKU', 'Stock', 'Price', 'Categories', 'Tags', 'Date']) await expect(page.locator('.pm-wp-table thead')).toContainText(head);
  await expect(page.locator('#pmAllRows tr').first().locator('.column-date')).toContainText(/Published\s*\w{3} \d{1,2}, 20\d\d/);
  await expect(page.locator('#pmPagerTop')).toContainText('items');
});

test('edit screen: name, description, product data tabs, tags, brand, featured, category', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  await expect(page.locator('.pm-wp-edit .pm-wp-title')).toHaveText('Edit product');
  await expect(page.locator('.pm-wp-name')).toHaveValue('Maroon Abaya Set');
  for (const box of ['Publish', 'Product categories', 'Product tags', 'Product brand', 'Product image', 'Product gallery', 'Product description']) await expect(page.locator('.pm-wp-box-title', { hasText: box }).first()).toBeVisible();
  // Product image / gallery boxes behave like WordPress: thumbnail + "Remove product image", or a "Set product image" link.
  await expect(page.locator('#pmImgView img')).toBeVisible();
  await page.click('#pmImgRemove');
  await expect(page.locator('#pmImgView')).toContainText('Set product image');
  await page.click('#pmImgEdit');
  await expect(page.locator('.pm-wp-chooser')).toContainText('Upload from computer');
  await expect(page.locator('#pmGalView')).toContainText('Add product gallery images');
  await page.click('#pmGalBox [data-box="toggle"]');
  await expect(page.locator('#pmGalBox')).toHaveClass(/is-closed/);
  await page.click('[data-etab="inventory"]');
  await expect(page.locator('[data-epanel="inventory"]')).toBeVisible();
  await expect(page.locator('[data-epanel="general"]')).toBeHidden();
  await page.fill('#pmEditTagInput', 'eid, black abaya');
  await page.press('#pmEditTagInput', 'Enter');
  await expect(page.locator('.pm-wp-tags li')).toHaveCount(2);
  await page.fill('[data-ef="brand"]', 'Muslim Abaya');
  await page.check('[data-ef="featured"]');
  await page.fill('[data-ef="detailNote"]', 'Dubai cherry fabric, full set');
  await expect(page.locator('#pmEditNote')).toHaveClass(/is-dirty/);
  await page.click('#pmEditBack');
  const first = page.locator('#pmAllRows tr').first();
  await expect(first.locator('.column-tags')).toContainText('eid');
  await expect(first.locator('.column-brand')).toContainText('Muslim Abaya');
  await expect(first.locator('.pm-star')).toHaveAttribute('aria-pressed', 'true');
  // tag link filters the list
  await first.locator('.column-tags .pm-row-link', { hasText: 'eid' }).click();
  await expect(page.locator('#pmAllRows tr')).toHaveCount(1);
});

test('edit screen: option prices keep the card price in step, and a new option (e.g. Hijab) is added in one click', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true, publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } }); });
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  const first = page.locator('.pm-opt-row input').first();
  await first.fill('1999');
  await expect(page.locator('#pmCardPrice')).toHaveText('৳1999');
  await page.fill('#pmOptName', 'Hijab');
  await page.fill('#pmOptPrice', '450');
  await page.click('#pmOptAdd');
  await expect(page.locator('.pm-opt-row label', { hasText: 'Hijab price' })).toBeVisible();
  await page.fill('#pmOptName', 'HIJAB'); await page.fill('#pmOptPrice', '1'); await page.click('#pmOptAdd');
  await expect(page.locator('#pmOptMsg')).toContainText('already exists');
  await page.click('text=Update');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const block = file.slice(file.indexOf('"ABY-MAROON-1"'), file.indexOf('"ABY-MAROON-1"') + 900);
  expect(block).toContain('price: 1999');
  expect(block).toMatch(/types: \[[^\]]*"Hijab"\]/);
  expect(block).toContain('"Hijab": 450');
  // Removing it again restores the category's default options.
  await page.click('[data-opt-del="Hijab"]');
  await expect(page.locator('.pm-opt-row label', { hasText: 'Hijab price' })).toHaveCount(0);
});

async function withPublisher(page, fail) {
  await page.evaluate((fail) => { window.__published = null; window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true, publish: (files) => fail ? Promise.reject(new Error('offline')) : (window.__published = files, Promise.resolve({ ok: true })) }); }, fail);
}
const block = (file, id) => file.slice(file.indexOf('"' + id + '"'), file.indexOf('"' + id + '"') + 700);

test('Quick Edit in the list: name, option prices and colour save at once; a failed save changes nothing', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await withPublisher(page, true);
  const row = page.locator('#pmAllRows tr').first();
  await row.hover();
  await row.locator('[data-qe-cat]').click();
  await page.fill('.pm-qe [data-qe="name"]', 'Maroon Abaya Set (Eid)');
  await page.fill('.pm-qe [data-qe-type="Full Set"]', '1111');
  await page.click('.pm-qe [data-qe-save]');
  await expect(page.locator('.pm-qe-msg')).toContainText('Not saved');
  expect(await page.evaluate(() => window.CATEGORY_PRODUCTS && 1)).toBe(1);
  await page.click('.pm-qe [data-qe-cancel]');
  await expect(page.locator('#pmAllRows tr').first()).toContainText('Maroon Abaya Set');
  await expect(page.locator('#pmAllRows tr').first()).not.toContainText('(Eid)');

  await withPublisher(page, false);
  await page.locator('#pmAllRows tr').first().hover();
  await page.locator('#pmAllRows tr').first().locator('[data-qe-cat]').click();
  await page.fill('.pm-qe [data-qe="name"]', 'Maroon Abaya Set (Eid)');
  await page.fill('.pm-qe [data-qe-type="Full Set"]', '1111');
  await page.fill('.pm-qe [data-qe="colorLabel"]', 'Deep Maroon');
  await page.click('.pm-qe [data-qe-save]');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const b = block(file, 'ABY-MAROON-1');
  expect(b).toContain('name: "Maroon Abaya Set (Eid)"');
  expect(b).toContain('price: 1111');
  expect(b).toContain('"Full Set": 1111');
  expect(b).toContain('colorLabel: "Deep Maroon"');
});

test('Bulk "Change price (%)" raises every option price of the selected products and saves at once', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('10') : d.accept()));
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await withPublisher(page, false);
  const before = await page.evaluate(() => { const f = (window.CATEGORY_PRODUCTS.abaya || []).find((p) => p.id === 'ABY-MAROON-1'); return { price: f.price, types: Object.assign({}, f.priceByType) }; });
  await page.locator('#pmAllRows tr').first().locator('.pm-overview-check').check();
  await page.selectOption('#pmBulkAction', 'price');
  await page.click('#pmBulkApply');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const b = block(await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content), 'ABY-MAROON-1');
  for (const [t, v] of Object.entries(before.types)) expect(b).toContain('"' + t + '": ' + Math.round(v * 1.1));
});
