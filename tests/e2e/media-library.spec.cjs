// WordPress-style Media Library in the product manager: one window with "Upload files" and "Media Library",
// newest photos first, attachment details, several photos at once for the gallery, uploads straight to R2,
// and no deleting of a photo a product still uses.
const { test, expect } = require('@playwright/test');

const H = (c) => c.repeat(20);
const NEW_URL = 'https://images.muslimabaya.com/images/uploads/new-' + H('b') + '.webp';
const NEW_CARD = 'https://images.muslimabaya.com/images/uploads/new-card-' + H('c') + '.webp';
const OLD_URL = 'https://images.muslimabaya.com/images/uploads/old-' + H('a') + '.webp';
// A tiny valid PNG so <img> loads offline.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function open(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true})},cached:function(){return null}};' }));
  await page.route(/images\.muslimabaya\.com/, (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.route('**/media-manifest.json*', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, items: [{ path: 'images/site-photo.webp', date: Date.UTC(2026, 5, 1) }] }) }));
  const calls = [];
  await page.route('**/api/media-library', async (r) => {
    const body = JSON.parse(r.request().postData());
    calls.push(body);
    if (body.action === 'list') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, items: [
      { key: 'images/uploads/new-' + H('b') + '.webp', url: NEW_URL, card: NEW_CARD, size: 120000, uploaded: Date.UTC(2026, 10, 10), sourcePath: 'images/uploads/new.webp' },
      { key: 'images/uploads/old-' + H('a') + '.webp', url: OLD_URL, size: 90000, uploaded: Date.UTC(2026, 9, 1), sourcePath: 'images/uploads/old.webp' },
    ] }) });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, deleted: [body.key] }) });
  });
  await page.goto('/product-manager.html');
  await page.locator('#pmAllRows tr').first().locator('.pm-row-title').click(); // ABY-MAROON-1
  await expect(page.locator('.pm-wp-edit .pm-wp-title')).toHaveText('Edit product');
  return calls;
}

test('set product image from the library: newest first, details panel, single choice', async ({ page }) => {
  await open(page);
  await page.click('#pmImgEdit');
  const modal = page.locator('#maMediaModal');
  await expect(modal.locator('.mam-head h1')).toHaveText('Product image');
  await expect(modal.locator('.mam-item')).toHaveCount(3);
  const titles = await modal.locator('.mam-item').evaluateAll((els) => els.map((e) => e.getAttribute('title')));
  expect(titles).toEqual(['new.webp', 'old.webp', 'site-photo.webp']);
  await expect(modal.locator('.mam-go')).toBeDisabled();
  await modal.locator('.mam-item').first().click();
  await expect(modal.locator('.mam-side')).toContainText('new.webp');
  await expect(modal.locator('.mam-side')).toContainText('Not used by any product');
  await expect(modal.locator('.mam-go')).toHaveText('Set product image');
  // Single choice: clicking another photo replaces the selection.
  await modal.locator('.mam-item').nth(1).click();
  await expect(modal.locator('.mam-item.is-sel')).toHaveCount(1);
  await modal.locator('.mam-item').first().click();
  await modal.locator('.mam-go').click();
  await expect(modal).toBeHidden();
  await expect(page.locator('#pmImgView img')).toHaveAttribute('src', NEW_URL);
  const p = await page.evaluate(() => { const u = document.querySelector('.pm-wp-hidden-uploader [data-f="image"]'); return u && u.value; });
  expect(p).toBe(NEW_URL);
});

test('gallery: several photos at once; search and filter', async ({ page }) => {
  await open(page);
  const before = await page.locator('#pmGalView .pm-wp-gallery li').count();
  await page.click('#pmGalAdd');
  const modal = page.locator('#maMediaModal');
  await expect(modal.locator('.mam-head h1')).toHaveText('Add images to product gallery');
  await expect(modal.locator('.mam-item')).toHaveCount(3);
  await modal.locator('#mamFilter').selectOption('site');
  await expect(modal.locator('.mam-item')).toHaveCount(1);
  await modal.locator('#mamFilter').selectOption('all');
  await modal.locator('#mamSearch').fill('old');
  await expect(modal.locator('.mam-item')).toHaveCount(1);
  await modal.locator('#mamSearch').fill('');
  await modal.locator('.mam-item').nth(0).click();
  await modal.locator('.mam-item').nth(2).click();
  await expect(modal.locator('.mam-count')).toContainText('2 selected');
  await modal.locator('.mam-go').click();
  await expect(page.locator('#pmGalView .pm-wp-gallery li')).toHaveCount(before + 2);
});

test('delete: blocked for a photo in use, allowed (after confirm) for an unused upload', async ({ page }) => {
  const calls = await open(page);
  page.on('dialog', (d) => d.accept());
  // Put the new photo on this product first, so it is "in use".
  await page.click('#pmImgEdit');
  const modal = page.locator('#maMediaModal');
  await modal.locator('.mam-item').first().click();
  await modal.locator('.mam-go').click();
  await page.click('#pmImgEdit');
  await modal.locator('.mam-item').first().click();
  await expect(modal.locator('.mam-side')).toContainText('Used by: Maroon Abaya Set');
  await expect(modal.locator('.mam-del')).toBeDisabled();
  await modal.locator('.mam-item').nth(1).click();
  await expect(modal.locator('.mam-del')).toBeEnabled();
  await modal.locator('.mam-del').click();
  await expect(modal.locator('.mam-item')).toHaveCount(2);
  expect(calls.some((c) => c.action === 'delete' && c.key === 'images/uploads/old-' + H('a') + '.webp')).toBe(true);
});

test('upload files tab: photos go to R2 and come back selected in the library', async ({ page }) => {
  await open(page);
  const uploads = [];
  await page.route('**/api/image-upload', async (r) => {
    const body = JSON.parse(r.request().postData());
    uploads.push(body.path);
    const key = body.path.replace(/\.webp$/, '-' + H('d') + '.webp');
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, key, url: 'https://images.muslimabaya.com/' + key, bytes: 500 }) });
  });
  await page.evaluate(() => { window.MaImageTools.resizeToWebp = () => Promise.resolve(new Blob(['RIFF0000WEBP'], { type: 'image/webp' })); });
  await page.click('#pmImgEdit');
  const modal = page.locator('#maMediaModal');
  await modal.locator('.mam-tab', { hasText: 'Upload files' }).click();
  await expect(modal.locator('.mam-drop')).toContainText('Drop files to upload');
  await modal.locator('#mamFiles').setInputFiles({ name: 'my photo.png', mimeType: 'image/png', buffer: PNG });
  await expect(modal.locator('.mam-tab[aria-selected="true"]')).toHaveText('Media Library');
  await expect(modal.locator('.mam-item')).toHaveCount(4);
  await expect(modal.locator('.mam-item').first()).toHaveClass(/is-sel/);
  expect(uploads).toHaveLength(2);
  expect(uploads.some((p) => /^images\/uploads\/aby-maroon-1-\d+-0\.webp$/.test(p))).toBe(true);
  expect(uploads.some((p) => /-card\.webp$/.test(p))).toBe(true);
  await modal.locator('.mam-go').click();
  await expect(page.locator('#pmImgView img')).toHaveAttribute('src', /aby-maroon-1-\d+-0-d{20}\.webp$/);
});
