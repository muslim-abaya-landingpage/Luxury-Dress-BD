// Product page reviews: approved reviews show their photos (tap = full view); a verified buyer can attach photos,
// which are uploaded first and then sent with the review; photos without order number/phone are refused.
const { test, expect } = require('@playwright/test');
const URL1 = 'https://images.muslimabaya.com/reviews/2026/0f8fad5b-d9cb-469f-a165-70867728950e.webp';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMDGgAQBGNgID5Nn2WgAAAABJRU5ErkJggg==', 'base64');

async function stub(page, submitted, uploads) {
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.route('https://images.muslimabaya.com/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.route('**/api/review-photo', async (r) => { uploads.push(JSON.parse(r.request().postData()).image.length); await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, url: URL1 }) }); });
  await page.route(/script\.google\.com/, async (r) => {
    const req = r.request();
    if (req.method() === 'POST') { submitted.push(new URLSearchParams(req.postData())); return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, message: 'ধন্যবাদ! আপনার রিভিউ পর্যালোচনার পর প্রকাশিত হবে।' }) }); }
    if (/GetReviews/.test(req.url())) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, average: 5, count: 1, reviews: [{ name: 'Sumi', rating: 5, comment: 'খুব সুন্দর', verifiedPurchase: true, date: '17 Nov 2026', photos: [URL1] }] }) });
    return r.fulfill({ contentType: 'application/json', body: '{"ok":true}' });
  });
}

test('product page: review photos show, open full size, and a buyer can add photos to a review', async ({ page }) => {
  const submitted = [], uploads = [];
  await stub(page, submitted, uploads);
  await page.goto('/product/ABY-MAROON-1');
  const box = page.locator('[data-ma-reviews]');
  await box.scrollIntoViewIfNeeded();
  await expect(box.locator('.pqv-review-photo img')).toHaveAttribute('src', URL1);
  await box.locator('.pqv-review-photo').click();
  await expect(page.locator('.pqv-photo-lightbox img')).toHaveAttribute('src', URL1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.pqv-photo-lightbox')).toHaveCount(0);

  // reviews sit inside the "Your Impression" box; there is no separate reviews section or "রিভিউ লিখুন" button
  await expect(page.locator('.pqv-impression [data-ma-reviews]')).toHaveCount(1);
  await expect(page.locator('.pqv-reviews-section, .pqv-reviews-title')).toHaveCount(0);
  await expect(box.locator('[data-ma-review-toggle]')).toBeHidden();
  // the form is hidden until a star is tapped; the tapped rating is already picked
  const form = box.locator('[data-ma-review-form]');
  await expect(form).toBeHidden();
  await page.locator('[data-pqv-rate="5"]').click();
  await expect(form).toBeVisible();
  await expect(form.locator('input[name="rating"]')).toHaveValue('5');
  await form.locator('input[name="name"]').fill('Sumi');
  await form.locator('[data-ma-photo-input]').setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await expect(form.locator('[data-ma-photo-previews] img')).toHaveCount(1);
  await form.locator('.pqv-review-submit-btn').click();
  await expect(form.locator('[data-ma-review-msg]')).toContainText('অর্ডার নম্বর ও অর্ডারের মোবাইল');
  expect(uploads.length).toBe(0);

  await form.locator('input[name="orderId"]').fill('MA-1001');
  await form.locator('input[name="phone"]').fill('01711000000');
  await form.locator('.pqv-review-submit-btn').click();
  await expect(form.locator('[data-ma-review-msg]')).toContainText('ধন্যবাদ');
  expect(uploads.length).toBe(1);
  const sent = submitted.find((p) => p.get('RecordType') === 'SubmitReview');
  expect(JSON.parse(sent.get('Photos'))).toEqual([URL1]);
  expect(sent.get('OrderID')).toBe('MA-1001');
});

test('home: "ক্রেতাদের তোলা ছবি" strip shows approved photo reviews and links to the product; nothing when there are none', async ({ page }) => {
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.route('https://images.muslimabaya.com/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.route('**/api/photo-reviews', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, reviews: [{ productId: 'ABY-MAROON-1', productName: 'Maroon Abaya Set', name: 'Sumi', rating: 5, comment: 'খুব সুন্দর', verifiedPurchase: true, photos: [URL1] }] }) }));
  await page.goto('/');
  await page.locator('#site-footer-mount').scrollIntoViewIfNeeded();
  const sec = page.locator('#maCustomerPhotos');
  await expect(sec).toBeVisible();
  await expect(sec.locator('.mcp-shop')).toHaveAttribute('href', /\/product\/ABY-MAROON-1$/);
  await expect(sec).toContainText('✓ যাচাইকৃত');
  const radius = await sec.locator('.mcp-card').first().evaluate((el) => getComputedStyle(el).borderRadius);
  expect(radius).toBe('0px');
});

test('home: no photo reviews → no strip', async ({ page }) => {
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.route('**/api/photo-reviews', (r) => r.fulfill({ contentType: 'application/json', body: '{"ok":true,"reviews":[]}' }));
  await page.goto('/');
  await page.locator('#site-footer-mount').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await expect(page.locator('#maCustomerPhotos')).toHaveCount(0);
});

test('Admin → Reviews: pending list with photos; Approve moves it to published', async ({ page }) => {
  const calls = [];
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  const list = { ok: true, counts: { Pending: 1, Approved: 0, Rejected: 0 }, reviews: [{ id: 'r1', productId: 'ABY-1', productName: 'Abaya', name: 'Sumi', rating: 5, comment: 'ভালো', status: 'Pending', verifiedPurchase: true, orderId: 'MA-1', photos: [URL1], date: '2026-11-17 10:00' }] };
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body:
    'window.__calls=[];window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},cached:function(){return null},' +
    'call:function(t,f){window.__calls.push([t,f]);return Promise.resolve(t==="AdminReviewList"?' + JSON.stringify(list) + ':{ok:true});}};' }));
  await page.route('https://images.muslimabaya.com/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.goto('/admin-reviews.html');
  const item = page.locator('.rv-item');
  await expect(item).toHaveCount(1);
  await expect(item).toContainText('যাচাইকৃত ক্রেতা · অর্ডার MA-1');
  await expect(item.locator('.rv-photos img')).toHaveAttribute('src', URL1);
  await item.locator('.rv-ok').click();
  await expect(page.locator('#rvCountApproved')).toHaveText('1');
  await expect(page.locator('.rv-item')).toHaveCount(0);
  expect(await page.evaluate(() => window.__calls.find((c) => c[0] === 'AdminReviewStatus'))).toEqual(['AdminReviewStatus', { ReviewID: 'r1', Status: 'Approved' }]);
  await page.locator('.rv-tab[data-status="Approved"]').click();
  await expect(page.locator('.rv-item')).toHaveCount(1);
});
