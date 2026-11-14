// Product Manager → Edit product: WooCommerce-style product type, Attributes and Variations panels.
const { test, expect } = require('@playwright/test');

async function stub(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({
    contentType: 'application/javascript',
    body: 'window.__stockCommits=[];window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null},' +
      'getStockVariants:function(){return Promise.resolve({ok:true,items:[{productId:"ABY-MAROON-1",variant:"Length 54",tracked:true,available:7}]})},' +
      'commitStockCsv:function(rows){window.__stockCommits.push(rows);return Promise.resolve({ok:true,applied:rows.length,skipped:0})}};'
  }));
}

async function openMaroon(page, answers, beforeNavigation) {
  await stub(page);
  page.on('dialog', (d) => {
    const m = d.message();
    const hit = Object.keys(answers || {}).find((k) => m.indexOf(k) !== -1);
    d.accept(hit ? answers[hit] : undefined);
  });
  if (beforeNavigation) await beforeNavigation();
  await page.goto('/product-manager.html');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true, publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } }); });
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click();
  await expect(page.locator('.pm-wp-name')).toHaveValue('Maroon Abaya Set');
}

async function publishedBlock(page) {
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const start = file.indexOf('"ABY-MAROON-1"');
  return file.slice(start, file.indexOf('\n    }', start));
}

test('product type, attributes with "Used for variations", generate, edit variation cards and publish', async ({ page }) => {
  await openMaroon(page, { 'regular prices by': '10%' });
  // Simple product: no Variations tab, like WooCommerce.
  await expect(page.locator('#pmProductType')).toHaveValue('simple');
  await expect(page.locator('[data-etab="variations"]')).toHaveCount(0);
  await page.selectOption('#pmProductType', 'variable');
  await expect(page.locator('[data-etab="variations"]')).toBeVisible();
  await expect(page.locator('[data-epanel="attributes"]')).toBeVisible();

  // Attributes: one box per attribute; Long values edited with "|", Option not used for variations.
  const mount = page.locator('#pmAttrMount');
  await expect(mount.locator('.pmw-box-head b')).toHaveText(['Option', 'Color', 'Body', 'Long']);
  await expect(mount.locator('[data-pa="used"][data-id="body"]')).not.toBeChecked();
  await expect(mount.locator('[data-pa="used"][data-id="length"]')).toBeChecked();
  await mount.locator('[data-pa="values"][data-id="length"]').fill('50 | 52 | 54 | 56');
  await mount.locator('[data-pa="used"][data-id="type"]').uncheck();
  await mount.locator('[data-pa="save"]').click();
  await expect(page.locator('[data-ef="sizes"]')).toHaveValue('50, 52, 54, 56');

  // Variations: generate one per Long value (4), WooCommerce cards.
  await page.click('[data-etab="variations"]');
  const vars = page.locator('[data-epanel="variations"] .pmw-var');
  await expect(page.locator('.pmw-empty')).toContainText('Long');
  await page.click('[data-pv="generate"]');
  await expect(vars).toHaveCount(4);
  await expect(vars.nth(0).locator('.pmw-id')).toHaveText('#1');
  await expect(vars.nth(0).locator('[data-pv="attr"]')).toHaveValue('Length 50');
  await expect(vars.nth(0).locator('[data-pv="attr"] option').first()).toHaveText('Any Long…');

  await vars.nth(0).locator('[data-pv="edit"]').click();
  const c1 = vars.nth(0);
  await c1.locator('[data-pv="regular"]').fill('1800');
  await c1.locator('[data-pv="regular"]').blur();
  await c1.locator('[data-pv="sale"]').fill('1650');
  await c1.locator('[data-pv="sale"]').blur();
  // Variation Schedule: own sale dates.
  await c1.locator('[data-pv="sched"]').click();
  await c1.locator('[data-pv="sfrom"]').fill('2030-02-01');
  await c1.locator('[data-pv="sto"]').fill('2030-02-05');
  await c1.locator('[data-pv="sto"]').blur();
  await expect(c1.locator('[data-pv="nosched"]')).toBeVisible();
  // Variation image like WooCommerce: the image button on the row opens the Media Library.
  await page.route('**/media-manifest.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, items: [{ path: 'images/variation-photo.webp', date: 1 }] }) }));
  await page.route('**/api/media-library', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, items: [] }) }));
  const galleryBefore = await page.locator('#pmGalView .pm-wp-gallery li').count();
  await c1.locator('.pmw-thumb').click();
  const lib = page.locator('#maMediaModal');
  await expect(lib.locator('.mam-head h1')).toHaveText('Variation image #1');
  await expect(lib.locator('#mamFilter')).toHaveValue('mine'); // opens on this product's photos
  await lib.locator('#mamFilter').selectOption('all');
  await lib.locator('.mam-item[title="variation-photo.webp"]').click();
  await lib.locator('.mam-go').click();
  await expect(lib).toBeHidden();
  await expect(vars.nth(0).locator('.pmw-thumb img')).toHaveAttribute('src', /variation-photo\.webp/);
  // The website shows a variation photo from the gallery, so it was added there too.
  await expect(page.locator('#pmGalView .pm-wp-gallery li')).toHaveCount(galleryBefore + 1);

  await vars.nth(1).locator('[data-pv="edit"]').click();
  await vars.nth(1).locator('[data-pv="enabled"]').uncheck();
  await expect(vars.nth(1)).toHaveClass(/is-off/);

  // Counted stock loads into Manage stock; another variation can switch to Out of stock.
  await vars.nth(2).locator('[data-pv="edit"]').click();
  await expect(vars.nth(2).locator('[data-pv="manage"]')).toBeChecked();
  await expect(vars.nth(2).locator('[data-pv="stock"]')).toHaveValue('7');
  await vars.nth(3).locator('[data-pv="edit"]').click();
  await vars.nth(3).locator('[data-pv="status"]').selectOption('outofstock');
  await expect(vars.nth(3).locator('.pmw-var-head')).toContainText('Out of stock');
  await vars.nth(3).locator('[data-pv="manage"]').check();
  await vars.nth(3).locator('[data-pv="stock"]').fill('5');

  // Bulk: increase regular prices by 10% (the first variation 1800 → 1980, keeping its 1650 sale).
  await page.selectOption('[data-pv="bulk"]', 'regular-up');
  await expect(vars.nth(0).locator('[data-pv="regular"]')).toHaveValue('1980');
  await expect(vars.nth(0).locator('[data-pv="sale"]')).toHaveValue('1650');

  await page.click('#pmEditUpdate');
  const block = await publishedBlock(page);
  await expect(page.locator('#pmEditNote')).toContainText('Stock saved for 1');
  expect(block).toContain('variations: [');
  expect(block).toMatch(/"size":"Length 50"[^}]*"price":1650,"regularPrice":1980/);
  expect(block).toMatch(/"size":"Length 50"[^}]*"saleFrom":"2030-02-01","saleTo":"2030-02-05"/);
  expect(block).toMatch(/"size":"Length 52"[^}]*"enabled":false/);
  expect(block).toMatch(/"size":"Length 56"[^}]*"stockStatus":"outofstock"/);
  expect(block).toContain('variationAttributes: ["length"]');
  expect(block).toContain('productType: "variable"');
  const commits = await page.evaluate(() => window.__stockCommits);
  expect(commits).toEqual([[{ productId: 'ABY-MAROON-1', productName: 'Maroon Abaya Set', category: 'abaya', variant: 'Length 56', qty: 5, reason: 'Product Manager variations' }]]);
});

test('Add manually, remove, and switching back to a simple product removes the variations', async ({ page }) => {
  await openMaroon(page);
  await page.selectOption('#pmProductType', 'variable');
  await page.click('[data-etab="variations"]');
  await page.click('[data-pv="generate"]');
  const vars = page.locator('[data-epanel="variations"] .pmw-var');
  await expect(vars).toHaveCount(14); // 2 options × 7 lengths (Body is off for abaya)
  await vars.nth(0).locator('[data-pv="del"]').click();
  await expect(vars).toHaveCount(13);
  await page.click('[data-pv="add"]');
  await expect(vars).toHaveCount(14);
  await expect(vars.nth(13).locator('[data-pv="attr"]').first()).toHaveValue('');
  await page.selectOption('#pmProductType', 'simple');
  await expect(page.locator('[data-etab="variations"]')).toHaveCount(0);
  await page.click('#pmEditUpdate');
  const block = await publishedBlock(page);
  expect(block).not.toContain('variations');
});

test('ticks changed on Attributes are kept when opening Variations without pressing Save attributes', async ({ page }) => {
  await openMaroon(page);
  await page.selectOption('#pmProductType', 'variable');
  const mount = page.locator('#pmAttrMount');
  await mount.locator('[data-pa="used"][data-id="type"]').uncheck();
  await mount.locator('[data-pa="values"][data-id="length"]').fill('50 | 52');
  await page.click('[data-etab="variations"]');
  await expect(page.locator('[data-epanel="variations"]')).toBeVisible();
  await expect(page.locator('#pmEditNote')).toContainText('Attributes saved automatically');
  await page.click('[data-pv="generate"]');
  await expect(page.locator('[data-epanel="variations"] .pmw-var')).toHaveCount(2); // Long 50, 52 only
});

test('variation image remains attached to the same photo after gallery reorder', async ({ page }) => {
  await openMaroon(page, undefined, async () => {
    await page.route('**/category-products.js*', async (route) => {
      const response = await route.fetch();
      // Whatever the Maroon set's main photo is today (the owner can change it from the panel).
      const body = (await response.text()).replace(
        /(image: "[^"]*Maroon[^"]*",)/,
        '$1 images: ["/images/e2e-photo-a.webp", "/images/e2e-photo-b.webp"],'
      );
      await route.fulfill({ response, body });
    });
  });
  await page.selectOption('#pmProductType', 'variable');
  await page.locator('[data-etab="variations"]').click();
  await page.locator('[data-pv="generate"]').click();
  const variation = page.locator('[data-epanel="variations"] .pmw-var').first();
  await page.route('**/media-manifest.json*', (r) => r.fulfill({ contentType: 'application/json', body: '{"version":1,"items":[]}' }));
  await page.route('**/api/media-library', (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"items":[]}' }));
  await variation.locator('[data-pv="edit"]').click();
  // The Media Library opens on "This product's photos"; choose photo B.
  await variation.locator('.pmw-thumb').click();
  const lib = page.locator('#maMediaModal');
  await expect(lib.locator('#mamFilter')).toHaveValue('mine');
  await lib.locator('.mam-item[title="e2e-photo-b.webp"]').click();
  await lib.locator('.mam-go').click();
  await expect(variation.locator('.pmw-img img')).toHaveAttribute('src', '/images/e2e-photo-b.webp');

  // Reorder gallery photos through the same UI controls used by administrators.
  await page.locator('[data-etab="general"]').click();
  const rightArrow = page.locator('.pm-gallery-move[data-gi="0"][data-dir="1"]');
  if (await rightArrow.count()) await rightArrow.evaluate((button) => button.click());
  await page.locator('[data-etab="variations"]').click();
  await expect(page.locator('[data-epanel="variations"] .pmw-var').first().locator('.pmw-img img'))
    .toHaveAttribute('src', '/images/e2e-photo-b.webp');
});

test('renaming a color updates the selected variation key before publish', async ({ page }) => {
  await openMaroon(page);
  await page.locator('[data-etab="attributes"]').click();
  await page.locator('#pmColorAdd').click();
  const secondColor = page.locator('#pmColorVariationList [data-color-row]:last-child');
  await secondColor.locator('[data-color-field="label"]').fill('Black');
  await secondColor.locator('[data-color-photo]').first().click();
  await page.selectOption('#pmProductType', 'variable');
  await page.locator('[data-etab="variations"]').click();
  await page.locator('[data-pv="generate"]').click();
  const first = page.locator('[data-epanel="variations"] .pmw-var').first();
  await first.locator('[data-pv="edit"]').click();

  // Change the product's color label (the editor derives its variation key from that label).
  await page.locator('[data-etab="attributes"]').click();
  const colorLabel = page.locator('#pmColorVariationList [data-color-field="label"]').first();
  await colorLabel.fill('Deep Maroon');
  await colorLabel.dispatchEvent('change');
  await page.locator('[data-etab="variations"]').click();

  const colorSelects = page.locator('[data-epanel="variations"] .pmw-var [data-pv="attr"][data-attr="color"]');
  await expect(colorSelects.first().locator('option[value="deep-maroon"]')).toHaveCount(1);
  for (let i = 0; i < await colorSelects.count(); i++) {
    if (await colorSelects.nth(i).inputValue() === 'maroon') await colorSelects.nth(i).selectOption('deep-maroon');
  }
  await page.locator('#pmEditUpdate').click();
  const block = await publishedBlock(page);
  expect(block).toContain('"color":"deep-maroon"');
  expect(block).not.toContain('"color":"maroon"');
});

test('variation price box on each row (no Edit needed) saves the variation price', async ({ page }) => {
  await openMaroon(page);
  await page.selectOption('#pmProductType', 'variable');
  await page.click('[data-etab="variations"]');
  await page.click('[data-pv="generate"]');
  const vars = page.locator('[data-epanel="variations"] .pmw-var');
  const box = vars.first().locator('[data-pv="hprice"]');
  await expect(box).toBeVisible();
  await box.fill('1777');
  await box.blur();
  // The same value shows in the Edit panel.
  await vars.first().locator('[data-pv="edit"]').click();
  await expect(vars.first().locator('[data-pv="regular"]')).toHaveValue('1777');
  await page.click('#pmEditUpdate');
  const block = await publishedBlock(page);
  expect(block).toContain('"price":1777');
});
