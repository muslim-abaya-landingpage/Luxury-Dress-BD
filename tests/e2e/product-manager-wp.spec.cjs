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
  const first = page.locator('.pm-opt-row .pm-opt-price').first();
  await first.fill('1999');
  await expect(page.locator('#pmCardPrice')).toHaveText('৳1999');
  await page.fill('#pmOptName', 'Hijab');
  await page.fill('#pmOptPrice', '450');
  await page.click('#pmOptAdd');
  await expect(page.locator('[data-opt-name="Hijab"]')).toBeVisible();
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
  await expect(page.locator('[data-opt-name="Hijab"]')).toHaveCount(0);
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

test('edit screen: the save bar is always visible, shows unsaved / saved / failed, and Ctrl+S saves', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await withPublisher(page, true);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  const bar = page.locator('#pmEditBar');
  await page.locator('.pm-opt-row .pm-opt-price').first().fill('1777');
  await expect(bar).toHaveAttribute('data-state', 'dirty');
  await expect(bar).toBeInViewport();
  await page.click('#pmEditBarSave');
  await expect(bar).toHaveAttribute('data-state', 'err');
  await expect(page.locator('#pmEditNote')).toContainText('Not saved');
  await withPublisher(page, false);
  await page.keyboard.press('Control+s');
  await expect(bar).toHaveAttribute('data-state', 'pub');
  await expect(page.locator('#pmEditNote')).toContainText('Saved');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('ma-product-live')));
  await expect(bar).toHaveAttribute('data-state', 'ok');
  await expect(page.locator('#pmEditBarMsg')).toContainText('Live on the website');
  expect(await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content.includes('1777'))).toBe(true);
});

test('edit screen: an option can be renamed (Hijab → Hijab + Niqab) and reordered, keeping its price', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await withPublisher(page, false);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  await page.fill('#pmOptName', 'Hijab'); await page.fill('#pmOptPrice', '450'); await page.click('#pmOptAdd');
  const hijab = page.locator('[data-opt-name="Hijab"]');
  await hijab.fill('Hijab + Niqab'); await hijab.press('Enter');
  const renamed = page.locator('[data-opt-name="Hijab + Niqab"]');
  await expect(renamed).toBeVisible();
  await expect(page.locator('[data-ef="typePrice:Hijab + Niqab"]')).toHaveValue('450');
  await expect(page.locator('#pmEditBar')).toHaveAttribute('data-state', 'dirty');
  // Duplicate name is refused and the old name stays.
  await renamed.fill('full set'); await renamed.press('Enter');
  await expect(page.locator('#pmOptEditMsg')).toContainText('already exists');
  await expect(page.locator('[data-opt-name="Hijab + Niqab"]')).toBeVisible();
  // Move it to the top: it becomes the card price.
  await page.locator('[data-opt-up="2"]').click();
  await page.locator('[data-opt-up="1"]').click();
  await expect(page.locator('.pm-opt-name').first()).toHaveValue('Hijab + Niqab');
  await expect(page.locator('#pmCardPrice')).toHaveText('৳450');
  await page.click('#pmEditBarSave');
  await expect(page.locator('#pmEditBar')).toHaveAttribute('data-state', 'pub');
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  expect(file).toContain('"Hijab + Niqab": 450');
  expect(file).not.toMatch(/"Hijab": 450/);
});

test('edit screen: new main and gallery photos are not committed one by one; they go up with Save in one publish', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__uploads = []; window.__queued = {};
    window.MaAdmin.uploadImage = (path) => { window.__uploads.push(path); return Promise.resolve({ ok: true, path }); };
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, {
      isReady: () => true,
      enqueue: (rows) => rows.forEach((r) => { window.__queued[r.path] = r; }),
      publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); }
    });
  });
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  // 64x80 PNG made in the page so the real resize/WebP step runs.
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 80; c.getContext('2d').fillRect(0, 0, 64, 80); return c.toDataURL('image/png').split(',')[1]; });
  const file = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
  await page.locator('.pm-file-input').first().setInputFiles(file);
  await page.locator('.pm-gallery-file-input').first().setInputFiles([file, { ...file, name: 'photo2.png' }]);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__queued).length)).toBe(4);
  const queued = await page.evaluate(() => Object.keys(window.__queued));
  for (const p of queued) expect(p).toMatch(/^images\/uploads\/[a-z0-9-]+\.webp$/);
  expect(await page.evaluate(() => window.__uploads)).toEqual([]);
  // Before saving, the editor shows the photos from the browser (they are not on the website yet).
  const srcs = await page.evaluate(() => Array.from(document.querySelectorAll('#pmImgView img, #pmGalView img')).map((i) => i.getAttribute('src')));
  expect(srcs.length).toBeGreaterThanOrEqual(3);
  expect(srcs.filter((s) => /^blob:/.test(s)).length).toBeGreaterThanOrEqual(3);
  await page.click('#pmSave');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const catalog = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  for (const p of queued) expect(catalog).toContain(p);
});
