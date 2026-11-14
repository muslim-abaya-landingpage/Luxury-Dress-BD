const { test, expect } = require('@playwright/test');
const vm = require('node:vm');

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

test('simple product list uses full width; category editor keeps compact navigation', async ({ page }) => {
  await stub(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/product-manager.html');
  await expect(page.locator('.pm-layout')).toHaveClass(/pm-all-view/);
  await expect(page.locator('.pm-sidebar')).toBeHidden();
  await expect(page.locator('#pmMain .pm-wp-list')).toBeVisible();
  await expect(page.locator('.pl-admin-header .adm-heading')).toBeVisible();
  await expect(page.locator('.pl-admin-header > p:not(#pmSaveStatus)')).toBeVisible();

  const desktop = await page.evaluate(() => {
    const layout = document.querySelector('.pm-layout');
    const main = document.querySelector('.pm-main').getBoundingClientRect();
    return { display: getComputedStyle(layout).display, layoutWidth: layout.getBoundingClientRect().width, mainWidth: main.width };
  });
  expect(desktop.display).toBe('block');
  expect(Math.abs(desktop.layoutWidth - desktop.mainWidth)).toBeLessThan(2);

  await page.click('#pmManageCats');
  await expect(page.locator('.pm-sidebar')).toBeVisible();
  await expect(page.locator('#pmCatList li').first()).toBeVisible();

  await page.setViewportSize({ width: 850, height: 900 });
  const compact = await page.evaluate(() => ({
    direction: getComputedStyle(document.querySelector('.pm-cat-list')).flexDirection,
    maxHeight: getComputedStyle(document.querySelector('.pm-cat-list')).maxHeight,
    overflowX: getComputedStyle(document.querySelector('.pm-cat-list')).overflowX
  }));
  expect(compact.direction).toBe('row');
  expect(compact.maxHeight).toBe('none');
  expect(compact.overflowX).toBe('auto');
});

test('edit screen: name, description, product data tabs, tags, brand, featured, category', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  await expect(page.locator('.pm-wp-edit .pm-wp-title')).toHaveText('Edit product');
  await expect(page.locator('.pm-wp-name')).toHaveValue('Maroon Abaya Set');
  for (const box of ['Publish', 'Product categories', 'Product tags', 'Product brands', 'Product image', 'Product gallery', 'Product description', 'Product data', 'Product short description', 'Slug']) await expect(page.locator('.pm-wp-box-title', { hasText: box }).first()).toBeVisible();
  // Product image / gallery boxes behave like WordPress: thumbnail + "Remove product image", or a "Set product image" link.
  await expect(page.locator('#pmImgView img')).toBeVisible();
  await page.click('#pmImgRemove');
  await expect(page.locator('#pmImgView')).toContainText('Set product image');
  await page.click('#pmImgEdit');
  // Like WordPress, the link opens the media window straight away (Upload files / Media Library tabs).
  await expect(page.locator('#maMediaModal')).toBeVisible();
  await expect(page.locator('#maMediaModal .mam-tab', { hasText: 'Upload files' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#maMediaModal')).toBeHidden();
  await expect(page.locator('#pmGalView')).toContainText('Add product gallery images');
  await page.click('#pmGalBox [data-box="toggle"]');
  await expect(page.locator('#pmGalBox')).toHaveClass(/is-closed/);
  await page.click('[data-etab="inventory"]');
  await expect(page.locator('[data-epanel="inventory"]')).toBeVisible();
  await expect(page.locator('[data-epanel="general"]')).toBeHidden();
  const initialTagCount = await page.locator('.pm-wp-tags li').count();
  await page.fill('#pmEditTagInput', 'eid, black abaya');
  await page.press('#pmEditTagInput', 'Enter');
  await expect(page.locator('.pm-wp-tags li')).toHaveCount(initialTagCount + 2);
  await page.click('#pmBrandNewLink');
  await page.fill('#pmBrandNew', 'Muslim Abaya');
  await page.click('#pmBrandNewAdd');
  await expect(page.locator('#pmBrandBox [data-taxpanel="brand-all"] [data-brand-check="Muslim Abaya"]')).toBeChecked();
  await page.click('[data-misc="catvis"]');
  await page.check('[data-ef="featured"]');
  await page.click('[data-misc-ok="catvis"]');
  await expect(page.locator('#pmCatVisLabel')).toContainText('Featured');
  await page.click('#pmDescEditor [data-ed-mode="code"]');
  await page.fill('#pmDescEditor .pm-woo-ed-code', '<p>Dubai cherry fabric, <strong>full set</strong></p><script>x()</script>');
  await page.click('#pmDescEditor [data-ed-mode="visual"]');
  await expect(page.locator('#pmDescEditor .pm-woo-ed-visual strong')).toHaveText('full set');
  await expect(page.locator('#pmDescEditor .pm-woo-ed-visual script')).toHaveCount(0);
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
  const first = page.locator('.pm-opt-row .pm-opt-regular').first();
  await first.fill('1999');
  await expect(page.locator('#pmCardPrice')).toHaveText('৳1999');
  await page.locator('.pm-opt-row .pm-opt-discount').first().fill('10');
  await expect(first).toHaveValue('1999');
  await expect(page.locator('.pm-opt-row .pm-opt-sale').first()).toHaveValue('1799');
  await expect(page.locator('#pmCardPrice')).toHaveText('৳1799');
  await page.fill('#pmOptName', 'Hijab');
  await page.fill('#pmOptPrice', '450');
  await page.click('#pmOptAdd');
  await expect(page.locator('[data-opt-name="Hijab"]')).toBeVisible();
  await page.fill('#pmOptName', 'HIJAB'); await page.fill('#pmOptPrice', '1'); await page.click('#pmOptAdd');
  await expect(page.locator('#pmOptMsg')).toContainText('already exists');
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const block = file.slice(file.indexOf('"ABY-MAROON-1"'), file.indexOf('"ABY-MAROON-1"') + 900);
  expect(block).toContain('price: 1799');
  expect(block).toMatch(/types: \[[^\]]*"Hijab"\]/);
  expect(block).toContain('"Hijab": 450');
  expect(block).toContain('regularPriceByType');
  // Removing it again restores the category's default options.
  await page.click('[data-opt-del="Hijab"]');
  await expect(page.locator('[data-opt-name="Hijab"]')).toHaveCount(0);
});

test('edit screen: discount percent calculates a simple-product sale price and Dress Lengths publish', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await withPublisher(page, false);
  await page.fill('#pmAllSearch', 'DR-01');
  await page.click('#pmAllSearchBtn');
  const row = page.locator('#pmAllRows tr').filter({ hasText: 'DR-01' }).first();
  await row.locator('.pm-row-title').click();
  await expect(page.locator('[data-ef="discountPercent"]')).toHaveValue('10');
  await page.fill('[data-ef="discountPercent"]', '15');
  await expect(page.locator('[data-ef="salePrice"]')).toHaveValue('1615');
  await expect(page.locator('[data-ef="regularPrice"]')).toHaveValue('1900');
  await page.click('[data-etab="attributes"]');
  await page.fill('[data-ef="dressLengths"]', '52, 54');
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const start = file.indexOf('"DR-01"');
  const b = file.slice(start, start + 5000);
  expect(b).toContain('price: 1615');
  expect(b).toContain('regularPrice: 1900');
  expect(b).toContain('dressLengths: ["52","54"]');
});

test('edit screen: WooCommerce Regular / Sale price boxes write the sale and refuse a sale that is not lower', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await withPublisher(page, false);
  await page.fill('#pmAllSearch', 'DR-01');
  await page.click('#pmAllSearchBtn');
  await page.locator('#pmAllRows tr').filter({ hasText: 'DR-01' }).first().locator('.pm-row-title').click();
  await expect(page.locator('[data-ef="regularPrice"]')).toHaveValue('1900');
  await expect(page.locator('[data-ef="salePrice"]')).toHaveValue('1710');
  await page.fill('[data-ef="salePrice"]', '1500');
  await expect(page.locator('[data-ef="discountPercent"]')).toHaveValue('21');
  await page.fill('[data-ef="salePrice"]', '2000');
  await expect(page.locator('[data-ef="salePrice"]')).toHaveClass(/pm-price-bad/);
  await page.fill('[data-ef="salePrice"]', '');
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const at = file.indexOf('"DR-01"'), b = file.slice(at, file.indexOf('\n    }', at));
  expect(b).toContain('price: 1900');
  expect(b).not.toContain('regularPrice');
});

test('edit screen: structured color variations publish names and images, with five measurement fields', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await withPublisher(page, false);
  await page.fill('#pmAllSearch', 'DR-01');
  await page.click('#pmAllSearchBtn');
  await page.locator('#pmAllRows tr').filter({ hasText: 'DR-01' }).first().locator('.pm-row-title').click();
  await page.click('[data-etab="attributes"]');

  const measurements = ['sizes', 'bodySizes', 'sleeveSizes', 'dressLengths', 'palazzoLengths'];
  const dr01Photo = '/images/uploads/dr-01-1793126083919.webp';
  for (const field of measurements) await expect(page.locator(`[data-ef="${field}"]`)).toHaveCount(1);
  await expect(page.locator('.pm-color-variation-row')).toHaveCount(1);
  await page.fill('.pm-color-variation-row [data-color-field="label"]', 'White / Black');
  // Photos are shown as pictures (not file names); tapping one picks it.
  await expect(page.locator('.pm-color-variation-row').first().locator('.pm-color-photo-opt img').first()).toHaveAttribute('src', dr01Photo);
  await expect(page.locator('.pm-color-variation-row').first().locator('select')).toHaveCount(0);
  await page.locator('.pm-color-variation-row').first().locator(`[data-color-photo="${dr01Photo}"]`).click();
  await expect(page.locator('.pm-color-variation-row').first().locator(`[data-color-photo="${dr01Photo}"]`)).toHaveAttribute('aria-checked', 'true');
  await page.evaluate(() => { const d = document.getElementById('pmMoreDetails'); if (d) d.open = true; }); // "More details" box
  await page.click('#pmColorAdd');
  await page.locator('.pm-color-variation-row').nth(1).locator('[data-color-field="label"]').fill('কালো');
  await page.locator('.pm-color-variation-row').nth(1).locator(`[data-color-photo="${dr01Photo}"]`).click();
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);

  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const context = { window: {} };
  vm.runInNewContext(file, context);
  const product = JSON.parse(JSON.stringify(context.window.CATEGORY_PRODUCTS['premium-two-piece'].find((p) => p.id === 'DR-01')));
  expect(product.colorLabel).toBe('White / Black, কালো');
  expect(product.colorVariants).toEqual([
    { color: 'white-black', colorLabel: 'White / Black', image: dr01Photo },
    { color: 'color-2', colorLabel: 'কালো', image: dr01Photo }
  ]);
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
  await page.fill('.pm-qe [data-qe-type="Full Set Borka, Hijab+ Niqab"]', '1111');
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
  await page.fill('.pm-qe [data-qe-type="Full Set Borka, Hijab+ Niqab"]', '1111');
  await page.fill('.pm-qe [data-qe="colorLabel"]', 'Deep Maroon');
  await page.click('.pm-qe [data-qe-save]');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const b = block(file, 'ABY-MAROON-1');
  expect(b).toContain('name: "Maroon Abaya Set (Eid)"');
  expect(b).toContain('price: 1111');
  expect(b).toContain('"Full Set Borka, Hijab+ Niqab": 1111');
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

test('edit screen: the Publish box note shows unsaved / saved / failed, and Ctrl+S saves', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await withPublisher(page, true);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  const bar = page.locator('#pmEditNote');
  await page.locator('.pm-opt-row .pm-opt-regular').first().fill('1777');
  await expect(bar).toHaveAttribute('data-state', 'dirty');
  await page.click('#pmEditUpdate');
  await expect(bar).toHaveAttribute('data-state', 'err');
  await expect(page.locator('#pmEditNote')).toContainText('Not saved');
  await withPublisher(page, false);
  await page.keyboard.press('Control+s');
  await expect(bar).toHaveAttribute('data-state', 'pub');
  await expect(page.locator('#pmEditNote')).toContainText('Saved');
  await page.evaluate(() => document.dispatchEvent(new CustomEvent('ma-product-live')));
  await expect(bar).toHaveAttribute('data-state', 'ok');
  await expect(page.locator('#pmEditNote')).toContainText('Live on the website');
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
  await expect(page.locator('[data-ef="typeRegular:Hijab + Niqab"]')).toHaveValue('450');
  await expect(page.locator('#pmEditNote')).toHaveAttribute('data-state', 'dirty');
  // Duplicate name is refused and the old name stays.
  await renamed.fill('full set borka, hijab+ niqab'); await renamed.press('Enter');
  await expect(page.locator('#pmOptEditMsg')).toContainText('already exists');
  await expect(page.locator('[data-opt-name="Hijab + Niqab"]')).toBeVisible();
  // Move it to the top: it becomes the card price.
  await page.locator('[data-opt-up="2"]').click();
  await page.locator('[data-opt-up="1"]').click();
  await expect(page.locator('.pm-opt-name').first()).toHaveValue('Hijab + Niqab');
  await expect(page.locator('#pmCardPrice')).toHaveText('৳450');
  await page.click('#pmEditUpdate');
  await expect(page.locator('#pmEditNote')).toHaveAttribute('data-state', 'pub');
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  expect(file).toContain('"Hijab + Niqab": 450');
  expect(file).not.toMatch(/"Hijab": 450/);
});

test('edit screen: changing the main image URL removes the old card thumbnail', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.route('**/category-products.js*', async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source + '\nwindow.CATEGORY_PRODUCTS.abaya[0].imageCard = "/images/stale-main-card.webp";\n' });
  });
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await withPublisher(page, false);
  await expect.poll(() => page.evaluate(() => window.CATEGORY_PRODUCTS.abaya.find((p) => p.id === 'ABY-MAROON-1').imageCard)).toBe('/images/stale-main-card.webp');
  await page.fill('#pmAllSearch', 'ABY-MAROON-1');
  await page.click('#pmAllSearchBtn');
  await page.locator('#pmAllRows tr').filter({ hasText: 'ABY-MAROON-1' }).first().locator('.pm-row-title').click();
  await page.locator('[data-f="image"]').first().evaluate((input) => {
    input.value = '/images/replacement-main.webp';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const product = block(file, 'ABY-MAROON-1');
  expect(product).toContain('image: "/images/replacement-main.webp"');
  expect(product).not.toContain('stale-main-card.webp');
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
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const catalog = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  for (const p of queued) expect(catalog).toContain(p);
});

test('edit screen: after a save, uploaded photos keep their R2 URLs on the next save (no blank photos)', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__queued = {}; window.__publishes = [];
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, {
      isReady: () => true,
      enqueue: (rows) => rows.forEach((r) => { window.__queued[r.path] = r; }),
      // Like the real publisher: queued local paths go to R2 and come back as URLs.
      publish: (files) => {
        window.__publishes.push(files);
        const urls = {};
        Object.keys(window.__queued).forEach((p) => { urls[p] = 'https://images.muslimabaya.com/' + p.replace(/\.webp$/, '-0123456789abcdef0123.webp'); });
        window.__queued = {};
        return Promise.resolve({ ok: true, uploadedUrls: urls });
      }
    });
  });
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 80; c.getContext('2d').fillRect(0, 0, 64, 80); return c.toDataURL('image/png').split(',')[1]; });
  const file = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') };
  await page.locator('.pm-gallery-file-input').first().setInputFiles([file, { ...file, name: 'photo2.png' }]);
  await expect.poll(() => page.evaluate(() => Object.keys(window.__queued).length)).toBe(2);
  const queued = await page.evaluate(() => Object.keys(window.__queued));
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => window.__publishes.length)).toBe(1);
  // Second save (e.g. a small edit right after): the catalog must carry the R2 URLs, not the local paths.
  await page.evaluate(() => { const b = document.getElementById('pmEditUpdate'); b.disabled = false; b.click(); });
  await expect.poll(() => page.evaluate(() => window.__publishes.length)).toBe(2);
  const second = await page.evaluate(() => window.__publishes[1].find((f) => f.path === 'category-products.js').content);
  for (const p of queued) {
    expect(second).not.toContain('"' + p + '"');
    expect(second).toContain('https://images.muslimabaya.com/' + p.replace(/\.webp$/, '-0123456789abcdef0123.webp'));
  }
});

test('Add new product opens the WooCommerce edit screen empty; draft saves without photo, Publish needs price and photo', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__uploads = []; window.__queued = {}; window.__published = null;
    window.MaAdmin.uploadImage = (path) => { window.__uploads.push(path); return Promise.resolve({ ok: true, path }); };
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, {
      isReady: () => true,
      enqueue: (rows) => rows.forEach((r) => { window.__queued[r.path] = r; }),
      publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); }
    });
  });
  await page.click('#pmHeaderAdd');
  await expect(page.locator('.pm-wp-edit .pm-wp-title')).toHaveText('Add new product');
  await expect(page.locator('#pmQuickDialog, dialog[open]')).toHaveCount(0);
  await expect(page.locator('.pm-wp-name')).toHaveValue('');
  await expect(page.locator('#pmStatusLabel')).toHaveText('Draft');
  await expect(page.locator('#pmSaveDraft')).toBeVisible();
  await expect(page.locator('#pmEditUpdate')).toHaveText('Publish');
  await page.fill('.pm-wp-name', 'Navy Chiffon Abaya');
  await expect(page.locator('#pmEf_id')).toHaveValue('navy-chiffon-abaya');
  // Draft without price or photo is allowed.
  await page.click('#pmSaveDraft');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  let file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  expect(file).toContain('id: "navy-chiffon-abaya"');
  expect(file).toContain('status: "draft"');
  // Publish without a photo is refused with a clear message.
  await page.evaluate(() => { window.__published = null; });
  await page.click('#pmEditUpdate');
  await expect(page.locator('#pmEditNote')).toContainText('প্রকাশ করতে দাম ও প্রধান ছবি প্রয়োজন');
  // Add a price and a photo, then Publish.
  const regular = page.locator('[data-ef="regularPrice"], .pm-opt-row .pm-opt-regular').first();
  await regular.fill('1450');
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 80; c.getContext('2d').fillRect(0, 0, 64, 80); return c.toDataURL('image/png').split(',')[1]; });
  await page.locator('.pm-file-input').first().setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect.poll(() => page.evaluate(() => Object.keys(window.__queued).length)).toBeGreaterThan(0);
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const at = file.indexOf('id: "navy-chiffon-abaya"'), entry = file.slice(at, file.indexOf('\n    }', at));
  expect(entry).not.toContain('status:');
  expect(entry).toMatch(/image: "images\/uploads\/[a-z0-9-]+\.webp"/);
});

test('Copy to a new draft duplicates the product in the editor; leaving an empty new product removes it', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  const allCount = async () => parseInt((await page.locator('[data-overview-status=""] .count').textContent()).replace(/\D/g, ''), 10);
  const before = await allCount();
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  const name = await page.locator('.pm-wp-name').inputValue();
  await page.click('#pmCopyDraft');
  await expect(page.locator('.pm-wp-name')).toHaveValue(name + ' (Copy)');
  await expect(page.locator('#pmStatusLabel')).toHaveText('Draft');
  await expect(page.locator('#pmEf_id')).toHaveValue(/-copy$/);
  await page.click('#pmEditBack');
  expect(await allCount()).toBe(before + 1);
  await page.click('#pmHeaderAdd');
  await expect(page.locator('.pm-wp-title')).toHaveText('Add new product');
  await page.click('#pmEditBack');
  expect(await allCount()).toBe(before + 1);
});

test('replacing the main photo moves its colour to the new photo; the old photo is not kept in the gallery', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__queued = {};
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, {
      isReady: () => true,
      enqueue: (rows) => rows.forEach((r) => { window.__queued[r.path] = r; }),
      publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); }
    });
  });
  await page.fill('#pmAllSearch', 'DR-8');
  await page.click('#pmAllSearchBtn');
  await page.locator('#pmAllRows tr').filter({ hasText: 'DR-8' }).first().locator('.pm-row-title').click();
  const before = await page.evaluate(() => { const p = (window.CATEGORY_PRODUCTS['premium-two-piece'] || []).find((x) => x.id === 'DR-8'); return { image: p.image, images: (p.images || []).slice() }; });
  // The colour points to the current main photo.
  await page.click('[data-etab="attributes"]');
  await page.locator('.pm-color-variation-row').first().locator('.pm-color-photo-opt').first().click();
  // Replace the main photo.
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 64; c.height = 80; c.getContext('2d').fillRect(0, 0, 64, 80); return c.toDataURL('image/png').split(',')[1]; });
  await page.locator('.pm-file-input').first().setInputFiles({ name: 'new.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect.poll(() => page.evaluate(() => Object.keys(window.__queued).length)).toBe(2);
  const newMain = await page.evaluate(() => Object.keys(window.__queued).find((p) => !/-card\.webp$/.test(p)));
  // Touching the colour again must not bring the old photo back.
  await page.click('[data-etab="attributes"]');
  await page.locator('.pm-color-variation-row').first().locator('[data-color-field="label"]').fill('Charcoal Black');
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const context = { window: {} };
  vm.runInNewContext(file, context);
  const product = context.window.CATEGORY_PRODUCTS['premium-two-piece'].find((p) => p.id === 'DR-8');
  expect(product.image).toBe(newMain);
  expect(product.colorVariants.map((c) => c.image)).toEqual([newMain]);
  expect(product.images || []).not.toContain(before.image);
  expect((product.images || []).length).toBe(before.images.length);
});

test('Bulk edit: add tags, mark featured and set a % sale on the selected products (PR #109)', async ({ page }) => {
  await stub(page);
  let answer = 'eid sale, new';
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept(answer) : d.accept()));
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await withPublisher(page, false);
  const full = (file) => { const a = file.indexOf('id: "ABY-MAROON-1"'); return file.slice(a, file.indexOf('\n    }', a)); };
  const pub = () => page.evaluate(() => window.__published && window.__published.find((f) => f.path === 'category-products.js').content);
  await page.locator('#pmAllRows tr').filter({ hasText: 'ABY-MAROON-1' }).first().locator('.pm-overview-check').check();
  await page.selectOption('#pmBulkAction', 'tags');
  await page.click('#pmBulkApply');
  await expect.poll(pub).toBeTruthy();
  expect(full(await pub())).toContain('"eid sale"');
  await page.evaluate(() => { window.__published = null; });
  await page.locator('#pmAllRows tr').filter({ hasText: 'ABY-MAROON-1' }).first().locator('.pm-overview-check').check();
  await page.selectOption('#pmBulkAction', 'feature');
  await page.click('#pmBulkApply');
  await expect.poll(pub).toBeTruthy();
  expect(full(await pub())).toContain('featured: true');
  await page.evaluate(() => { window.__published = null; });
  answer = '10';
  await page.locator('#pmAllRows tr').filter({ hasText: 'ABY-MAROON-1' }).first().locator('.pm-overview-check').check();
  await page.selectOption('#pmBulkAction', 'sale');
  await page.click('#pmBulkApply');
  await expect.poll(pub).toBeTruthy();
  expect(full(await pub())).toContain('regularPriceByType');
});

test('new product with a Bangla name gets an English-letter link; an existing product keeps its link', async ({ page }) => {
  await stub(page);
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.click('#pmHeaderAdd');
  await page.fill('.pm-wp-name', 'লেপার্ড প্রিন্ট লিলেন কামিজ ও পায়জামা সেট');
  await expect(page.locator('#pmEf_id')).toHaveValue('leopard-print-linen-kameez-and-pajama-set');
  await expect(page.locator('#pmPermaSlug')).toHaveText('leopard-print-linen-kameez-and-pajama-set');
  // Typing in the slug box by hand stops the automatic link.
  await page.fill('#pmEf_id', 'leopard-set');
  await page.fill('.pm-wp-name', 'লেপার্ড প্রিন্ট সেট');
  await expect(page.locator('#pmEf_id')).toHaveValue('leopard-set');
  // A published product: changing the name never changes its link.
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  const before = await page.locator('#pmEf_id').inputValue();
  await page.fill('.pm-wp-name', 'কালো বোরকা সেট');
  await expect(page.locator('#pmEf_id')).toHaveValue(before);
});

test('Slug box: clearing it does not erase the link; Bangla is turned into English letters; empty link is filled on save', async ({ page }) => {
  await stub(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__published = null;
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true,
      publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } });
  });
  await page.click('#pmHeaderAdd');
  await page.fill('.pm-wp-name', 'লেপার্ড প্রিন্ট লিলেন কামিজ ও পায়জামা সেট');
  // Clearing the box to retype keeps the link.
  await page.fill('#pmEf_id', '');
  await expect(page.locator('#pmPermaSlug')).toHaveText('leopard-print-linen-kameez-and-pajama-set');
  // Bangla or spaces typed into the box become a valid link.
  await page.fill('#pmEf_id', 'লেপার্ড সেট');
  await expect(page.locator('#pmPermaSlug')).toHaveText('leopard-set');
  await page.fill('#pmEf_id', 'Leopard Linen Set');
  await expect(page.locator('#pmPermaSlug')).toHaveText('Leopard-Linen-Set');
  // Save Draft works and the saved product has that link.
  await page.click('#pmSaveDraft');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  expect(file).toContain('id: "Leopard-Linen-Set"');
});

test('moving a new product to a category without options drops the old option prices and keeps the automatic link', async ({ page }) => {
  await stub(page);
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__published = null;
    window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true,
      publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } });
  });
  await page.click('#pmHeaderAdd'); // starts in Abaya with Full Set / Abaya Only prices
  await page.check('[data-cat-check="premium-two-piece"]');
  await page.uncheck('[data-cat-check="abaya"]');
  await page.fill('.pm-wp-name', 'লেপার্ড প্রিন্ট সেট');
  await expect(page.locator('#pmEf_id')).toHaveValue('leopard-print-set'); // still automatic after the move
  await page.fill('[data-ef="regularPrice"]', '750');
  await page.click('#pmSaveDraft');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const at = file.indexOf('id: "leopard-print-set"'), entry = file.slice(at, file.indexOf('\n    }', at));
  expect(entry).toContain('price: 750');
  expect(entry).not.toContain('Full Set');
  expect(entry).not.toContain('Abaya Only');
});
