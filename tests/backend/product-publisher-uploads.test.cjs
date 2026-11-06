'use strict';
// product-publisher.js: photos of one save go to R2 up to 3 at a time, every URL lands in the commit,
// and a failed photo stops the save while the photos that did upload are remembered for the retry.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'product-publisher.js'), 'utf8');
const PATHS = ['product-config.js', 'category-products.js', 'product-links-data.js', 'product-catalog-sections.js'];
const gitSha = (text) => {
  const body = Buffer.from(text, 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from('blob ' + body.length + '\0'), body])).digest('hex');
};

function harness(uploadImpl) {
  const files = Object.fromEntries(PATHS.map((p) => [p, '// ' + p]));
  const shas = Object.fromEntries(PATHS.map((p) => [p, gitSha(files[p])]));
  const published = [];
  const store = {};
  const g = {
    crypto: crypto.webcrypto,
    TextEncoder,
    sessionStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    fetch: async (url, opts) => {
      const p = String(url).replace(/^\//, '').split('?')[0];
      if (opts && opts.method === 'HEAD') return { ok: true };
      if (files[p] !== undefined) return { ok: true, text: async () => files[p] };
      // The publish-status check reads this; reporting the new release as live ends its polling loop.
      if (p === 'catalog-validation.json') return { ok: true, json: async () => ({ releaseSha: 'b'.repeat(40), products: [{ id: 'p' }] }) };
      return { ok: false, text: async () => '', json: async () => ({}) };
    },
    document: {
      head: { appendChild: (el) => setTimeout(() => el.onload && el.onload(), 0) },
      createElement: () => ({}),
      dispatchEvent() {},
    },
    CustomEvent: function CustomEvent() {},
    MaAdmin: {
      getSession: () => null, // no live push in this test
      call: async (type, data) => {
        if (type === 'AdminCatalogState') return { version: 1, head: 'a'.repeat(40), shas };
        if (type === 'AdminCatalogPublish') { published.push(JSON.parse(data.Payload)); return { sha: 'b'.repeat(40), shas }; }
        return { state: 'queued' };
      },
      uploadImage: uploadImpl,
    },
  };
  g.window = g;
  const ctx = vm.createContext(Object.assign(g, { setTimeout, clearTimeout, Promise, Error, JSON, Object, Array, Math, Date, URL, Blob: class {}, Worker: class {} }));
  vm.runInContext(source, ctx, { filename: 'product-publisher.js' });
  return { g, published, store };
}

async function ready(h) {
  const statuses = [];
  await h.g.MaCatalogPublisher.init((s) => statuses.push(s), () => {});
  return statuses;
}

test('uploads photos three at a time and puts every R2 URL into the saved catalog', async () => {
  let active = 0, peak = 0;
  const h = harness(async (p) => {
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 15));
    active--;
    return { ok: true, url: 'https://images.muslimabaya.com/' + p };
  });
  await ready(h);
  const photos = Array.from({ length: 7 }, (_, i) => ({ path: 'images/uploads/p' + i + '.webp', content: 'AAAA' }));
  h.g.MaCatalogPublisher.enqueue(photos);
  const catalog = 'window.X=[' + photos.map((p) => JSON.stringify(p.path)).join(',') + '];';
  const result = await h.g.MaCatalogPublisher.publish([{ path: 'category-products.js', content: catalog }], { id: 'p' });
  assert.equal(peak, 3);
  assert.equal(h.published.length, 1);
  const saved = h.published[0].files[0].content;
  photos.forEach((p) => {
    assert.ok(saved.includes('https://images.muslimabaya.com/' + p.path), p.path);
    assert.equal(result.uploadedUrls[p.path], 'https://images.muslimabaya.com/' + p.path);
  });
  assert.ok(!/"images\/uploads\//.test(saved), 'no local photo path left in the commit');
});

test('a failed photo stops the save, and photos already uploaded are kept for the next try', async () => {
  const calls = [];
  const h = harness(async (p) => {
    calls.push(p);
    await new Promise((r) => setTimeout(r, 5));
    if (p.endsWith('p2.webp')) return { ok: false, message: 'R2_WRITE_FAILED' };
    return { ok: true, url: 'https://images.muslimabaya.com/' + p };
  });
  await ready(h);
  const photos = Array.from({ length: 5 }, (_, i) => ({ path: 'images/uploads/p' + i + '.webp', content: 'AAAA' }));
  h.g.MaCatalogPublisher.enqueue(photos);
  const catalog = photos.map((p) => p.path).join('\n');
  await assert.rejects(h.g.MaCatalogPublisher.publish([{ path: 'category-products.js', content: catalog }], {}), /R2_WRITE_FAILED/);
  assert.equal(h.published.length, 0, 'nothing is committed when a photo fails');
  const remembered = JSON.parse(h.store.ma_r2_uploaded || '{}');
  assert.ok(remembered['images/uploads/p0.webp'] && remembered['images/uploads/p1.webp']);
  assert.ok(!remembered['images/uploads/p2.webp']);
});
