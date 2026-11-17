// Photo reviews: upload endpoint limits, Apps Script only keeps our own photo URLs and only for verified buyers,
// moderation is owner-only, and the public photo feed lists approved reviews with photos only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x20, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(24, 1)]).toString('base64');
const URL1 = 'https://images.muslimabaya.com/reviews/2026/0f8fad5b-d9cb-469f-a165-70867728950e.webp';
const URL2 = 'https://images.muslimabaya.com/reviews/2026/7c9e6679-7425-40de-944b-e07fc1f90ae7.webp';

function fakeDb() {
  const rows = new Map();
  return { prepare(sql) { let a = []; const st = { bind(...x) { a = x; return st; }, async run() { if (/^DELETE/.test(sql)) return {}; return {}; },
    async first() { const k = a[0] + '|' + a[1]; const n = (rows.get(k) || 0); if (n >= a[2]) return null; rows.set(k, n + 1); return { n: n + 1 }; } }; return st; } };
}
const req = (body, headers = {}) => new Request('https://muslimabaya.com/api/review-photo', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4' }, headers), body: JSON.stringify(body) });

test('review photo upload: WebP only, stored under reviews/<year>/<uuid>.webp, 9 per IP per hour, other sites refused', async () => {
  const { handleReviewPhoto } = await import('../../functions/api/review-photo.js');
  const puts = [];
  const env = { STOCK_DB: fakeDb(), PRODUCT_IMAGES: { put: async (k, b, o) => { puts.push([k, b.length, o.httpMetadata.contentType]); } } };
  const deps = { now: () => Date.parse('2026-11-17T02:00:00Z'), uuid: () => '0f8fad5b-d9cb-469f-a165-70867728950e' };
  const ok = await (await handleReviewPhoto(req({ image: WEBP }), env, deps)).json();
  assert.deepEqual(ok, { ok: true, url: URL1 });
  assert.equal(puts[0][0], 'reviews/2026/0f8fad5b-d9cb-469f-a165-70867728950e.webp'); assert.equal(puts[0][2], 'image/webp');
  assert.equal((await handleReviewPhoto(req({ image: Buffer.from('<svg/>').toString('base64') }), env, deps)).status, 400);
  assert.equal((await handleReviewPhoto(req({ image: WEBP }, { Origin: 'https://evil.example' }), env, deps)).status, 403);
  for (let i = 0; i < 8; i++) await handleReviewPhoto(req({ image: WEBP }), env, deps);
  assert.equal((await handleReviewPhoto(req({ image: WEBP }), env, deps)).status, 429);
});

test('photo feed: cached proxy of approved photo reviews; Google errors are not cached', async () => {
  const { handlePhotoReviews } = await import('../../functions/api/photo-reviews.js');
  const store = new Map();
  const cache = { match: async (k) => store.get(k.url), put: async (k, r) => store.set(k.url, r) };
  let calls = 0;
  const good = async () => { calls++; return new Response(JSON.stringify({ ok: true, reviews: [{ productId: 'A', photos: [URL1] }] })); };
  const r1 = await (await handlePhotoReviews(new Request('https://muslimabaya.com/api/photo-reviews'), {}, { fetch: good, cache })).json();
  assert.equal(r1.reviews.length, 1);
  await handlePhotoReviews(new Request('https://muslimabaya.com/api/photo-reviews'), {}, { fetch: good, cache });
  assert.equal(calls, 1);
  const bad = await handlePhotoReviews(new Request('https://muslimabaya.com/api/photo-reviews'), {}, { fetch: async () => { throw Error('x'); }, cache: { match: async () => null, put: async () => { throw Error('should not cache'); } } });
  assert.equal(bad.headers.get('Cache-Control'), 'no-store');
});

const gs = ['Code.gs', 'ReviewPhotos.gs'].map((f) => fs.readFileSync(path.join(__dirname, '../../apps-script', f), 'utf8')).join('\n');
const pick = (name) => { const m = gs.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}', 'm')); assert.ok(m, name); return m[0]; };
function loadGs(rows, { verified = true, owner = true } = {}) {
  const sheet = {
    getDataRange: () => ({ getValues: () => rows }),
    getRange: (r, c, nr) => ({ getValue: () => (rows[r - 1] || [])[c - 1] || '', setValue: (v) => { rows[r - 1][c - 1] = v; }, getValues: () => rows.slice(0, nr).map((x) => [x[0]]) }),
    getLastRow: () => rows.length,
  };
  const ctx = {
    JSON, String, Number, Array, Math, Date, Error,
    REVIEW_PHOTO_URL_RE_: /^https:\/\/images\.muslimabaya\.com\/reviews\/\d{4}\/[a-f0-9-]{36}\.webp$/,
    param_: (e, k) => e.parameter[k],
    getReviewsSheet_: () => sheet, opsReviewHeaders_: () => {}, rateLimit_: () => {},
    opsReviewVerification_: () => (verified ? { verified: true, orderId: 'MA-1' } : { verified: false, orderId: '' }),
    admCellText_: (v, n) => String(v).slice(0, n), appendRow_: (sh, row) => rows.push(row),
    Utilities: { getUuid: () => 'rev-' + rows.length, formatDate: () => '17 Nov 2026' },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    verifyAdminSession_: (t) => (t === 'owner' ? { ok: true } : { ok: false, error: 'NOT_LOGGED_IN' }),
    requireOwnerAdmin_: () => (owner ? null : { ok: false, error: 'OWNER_ONLY' }),
  };
  vm.runInNewContext(['reviewPhotos_', 'reviewPhotoHeader_', 'reviewRowPhotos_', 'submitReview_', 'getProductReviews_', 'getPhotoReviews_', 'reviewAdminCheck_', 'adminReviewList_', 'adminReviewStatus_'].map(pick).join('\n') +
    '\nthis.submit=submitReview_;this.product=getProductReviews_;this.feed=getPhotoReviews_;this.list=adminReviewList_;this.setStatus=adminReviewStatus_;', ctx);
  return ctx;
}
const header = ['ReviewID', 'ProductID', 'ProductName', 'Name', 'Rating', 'Comment', 'Date', 'Status', 'VerifiedPurchase', 'VerifiedOrderId', 'Photos'];
const p = (o) => ({ parameter: Object.assign({ ProductID: 'ABY-1', ProductName: 'Abaya', Name: 'Sumi', Rating: '5', Comment: 'সুন্দর' }, o) });

test('submit: only our own review-photo URLs (max 3) are kept, and only for a verified buyer', () => {
  const rows = [header.slice()];
  const ctx = loadGs(rows);
  const r = ctx.submit(p({ Photos: JSON.stringify([URL1, 'https://evil.example/x.webp', URL2, URL1, 'javascript:alert(1)']) }));
  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(rows[1][10]), [URL1, URL2]);
  assert.equal(rows[1][7], 'Pending');
  const anon = loadGs([header.slice()], { verified: false });
  assert.equal(anon.submit(p({ Photos: JSON.stringify([URL1]) })).error, 'PHOTO_NEEDS_ORDER');
  assert.equal(anon.submit(p({})).ok, true); // a text review without photos still works
});

test('public reads show photos of approved reviews only; moderation is owner-only', () => {
  const rows = [header.slice(),
    ['r1', 'ABY-1', 'Abaya', 'Sumi', 5, 'ভালো', new Date(), 'Approved', true, 'MA-1', JSON.stringify([URL1])],
    ['r2', 'ABY-1', 'Abaya', 'Moyna', 4, 'ঠিক আছে', new Date(), 'Pending', true, 'MA-2', JSON.stringify([URL2])],
    ['r3', 'ABY-2', 'Kaftan', 'Rimu', 5, 'বাহ', new Date(), 'Approved', false, '', '']];
  const ctx = loadGs(rows);
  const prod = ctx.product({ parameter: { ProductID: 'ABY-1' } });
  assert.equal(prod.count, 1); assert.deepEqual([...prod.reviews[0].photos], [URL1]);
  const feed = ctx.feed({ parameter: {} });
  assert.deepEqual([...feed.reviews.map((x) => x.name)], ['Sumi']);
  assert.equal(ctx.list({ parameter: { Token: 'nobody' } }).ok, false);
  assert.equal(loadGs(rows, { owner: false }).list({ parameter: { Token: 'owner' } }).error, 'OWNER_ONLY');
  const l = ctx.list({ parameter: { Token: 'owner' } });
  assert.equal(l.counts.Pending, 1); assert.equal(l.reviews[0].id, 'r3');
  assert.equal(ctx.setStatus({ parameter: { Token: 'owner', ReviewID: 'r2', Status: 'Approved' } }).ok, true);
  assert.equal(rows[2][7], 'Approved');
  assert.equal(ctx.setStatus({ parameter: { Token: 'owner', ReviewID: 'r2', Status: 'Deleted' } }).error, 'BAD_STATUS');
  assert.equal(ctx.feed({ parameter: {} }).reviews.length, 2);
});
