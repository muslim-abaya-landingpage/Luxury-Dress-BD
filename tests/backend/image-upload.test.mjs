import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { handleImageUpload, decodeWebP } from '../../functions/api/image-upload.js';

globalThis.crypto ||= webcrypto;

const webp = Uint8Array.from([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]);
const base64 = Buffer.from(webp).toString('base64');

test('accepts only allowlisted product image paths and WebP bytes', () => {
  assert.equal(decodeWebP(base64, 'images/uploads/sku_1.webp').length, 12);
  assert.equal(decodeWebP(base64, 'images/main/cards/sku-1-card.webp').length, 12);
  assert.equal(decodeWebP(base64, 'images/gallery/sku-1-g1.webp').length, 12);
  assert.throws(() => decodeWebP(base64, 'images/uploads/../../private.webp'), /BAD_PATH/);
  assert.throws(() => decodeWebP(base64, 'images/uploads/file.jpg'), /BAD_PATH/);
  assert.throws(() => decodeWebP(Buffer.from('not image').toString('base64'), 'images/uploads/file.webp'), /BAD_IMAGE_TYPE/);
});

test('requires an owner token and rejects cross-origin writes', async () => {
  const bucket = { put: async () => assert.fail('must not write') };
  const env = { PRODUCT_IMAGES: bucket, GOOGLE_SA_JSON: 'configured' };
  const noToken = await handleImageUpload(new Request('https://shop.test/api/image-upload', {
    method: 'POST', body: JSON.stringify({ path: 'images/uploads/a.webp', content: base64 }),
  }), env, { authorize: async () => '' });
  assert.equal(noToken.status, 401);

  const crossOrigin = await handleImageUpload(new Request('https://shop.test/api/image-upload', {
    method: 'POST', headers: { Origin: 'https://attacker.test' }, body: JSON.stringify({ Token: 't', path: 'images/uploads/a.webp', content: base64 }),
  }), env, { authorize: async () => '' });
  assert.equal(crossOrigin.status, 403);
});

test('uploads to a content-addressed R2 key and returns the public CDN URL', async () => {
  const puts = [];
  const env = { GOOGLE_SA_JSON: 'configured', PRODUCT_IMAGES: { put: async (...args) => puts.push(args) } };
  const request = new Request('https://shop.test/api/image-upload', {
    method: 'POST', headers: { Origin: 'https://shop.test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ Token: 'owner-session', path: 'images/uploads/sku_1.webp', content: base64, mimeType: 'image/webp' }),
  });
  const response = await handleImageUpload(request, env, { authorize: async (token) => token === 'owner-session' ? '' : 'OWNER_ONLY' });
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.match(data.key, /^images\/uploads\/sku_1-[a-f0-9]{20}\.webp$/);
  assert.equal(data.url, 'https://images.muslimabaya.com/' + data.key);
  assert.equal(puts.length, 1);
  assert.equal(puts[0][1].length, 12);
  assert.equal(puts[0][2].httpMetadata.contentType, 'image/webp');
  assert.match(puts[0][2].httpMetadata.cacheControl, /immutable/);
});
