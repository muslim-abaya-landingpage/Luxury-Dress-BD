// /api/media-library: owner-only list of panel uploads in R2 (newest first, "-card" copies paired and hidden)
// and delete that refuses photos a product still uses.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const mod = () => import(path.join(root, 'functions/api/media-library.js'));
const manifest = () => import(path.join(root, 'scripts/build-media-manifest.mjs'));
const H = (c) => c.repeat(20);

function fakeBucket(objects) {
  const store = new Map(objects.map((o) => [o.key, o]));
  return {
    deleted: [],
    async list({ prefix = '', cursor }) {
      const all = [...store.values()].filter((o) => o.key.startsWith(prefix)).sort((a, b) => a.key.localeCompare(b.key));
      const start = cursor ? Number(cursor) : 0;
      const page = all.slice(start, start + 2); // small pages so paging is exercised
      const next = start + 2 < all.length;
      return { objects: page, truncated: next, cursor: next ? String(start + 2) : undefined };
    },
    async head(key) { return store.get(key) || null; },
    async delete(keys) { [].concat(keys).forEach((k) => { store.delete(k); this.deleted.push(k); }); },
    has: (k) => store.has(k),
  };
}
const obj = (key, uploaded, sourcePath, size = 1000) => ({ key, uploaded: new Date(uploaded), size, customMetadata: sourcePath ? { sourcePath } : undefined });
const owner = { authorize: async (t) => (t === 'tok-owner' ? '' : 'OWNER_ONLY') };
const req = (body, origin = 'https://muslimabaya.com') => new Request('https://muslimabaya.com/api/media-library', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify(body) });
function env(bucket, catalog = '') {
  return {
    GOOGLE_SA_JSON: 'x', PRODUCT_IMAGES: bucket,
    STOCK_DB: { prepare: () => ({ bind: () => ({ first: async () => (catalog ? { v: JSON.stringify({ files: { 'category-products.js': catalog } }) } : null) }) }) },
    ASSETS: { fetch: async () => new Response('window.CATEGORY_PRODUCTS = {};', { status: 200 }) },
  };
}

test('list: newest first, card copies hidden but paired, other folders ignored', async () => {
  const { handleMediaLibrary } = await mod();
  const b = fakeBucket([
    obj('images/uploads/old-' + H('a') + '.webp', '2026-10-01', 'images/uploads/old.webp'),
    obj('images/uploads/new-' + H('b') + '.webp', '2026-11-10', 'images/uploads/new.webp'),
    obj('images/uploads/new-card-' + H('c') + '.webp', '2026-11-10', 'images/uploads/new-card.webp'),
    obj('images/uploads/plain.webp', '2026-11-11'), // a website-folder copy (no hash): listed by the manifest instead
    obj('images/card-avif/x.avif', '2026-11-12'),
  ]);
  const r = await handleMediaLibrary(req({ Token: 'tok-owner', action: 'list' }), env(b), owner);
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(body.items.map((i) => i.key), ['images/uploads/new-' + H('b') + '.webp', 'images/uploads/old-' + H('a') + '.webp']);
  assert.equal(body.items[0].card, 'https://images.muslimabaya.com/images/uploads/new-card-' + H('c') + '.webp');
  assert.equal(body.items[0].url, 'https://images.muslimabaya.com/images/uploads/new-' + H('b') + '.webp');
});

test('delete: refused while a product uses the photo; otherwise deletes the photo and its card copy', async () => {
  const { handleMediaLibrary } = await mod();
  const main = 'images/uploads/new-' + H('b') + '.webp', card = 'images/uploads/new-card-' + H('c') + '.webp';
  const objects = [obj(main, '2026-11-10', 'images/uploads/new.webp'), obj(card, '2026-11-10', 'images/uploads/new-card.webp')];
  let b = fakeBucket(objects);
  let r = await handleMediaLibrary(req({ Token: 'tok-owner', action: 'delete', key: main }), env(b, 'image: "https://images.muslimabaya.com/' + main + '"'), owner);
  assert.equal(r.status, 409);
  assert.equal((await r.json()).error, 'IN_USE');
  assert.ok(b.has(main));

  b = fakeBucket(objects);
  r = await handleMediaLibrary(req({ Token: 'tok-owner', action: 'delete', key: main }), env(b, 'image: "images/other.webp"'), owner);
  assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  assert.deepEqual(b.deleted.sort(), [card, main].sort());
});

test('delete: website-folder photos, card copies and unknown keys are refused; unreadable catalog deletes nothing', async () => {
  const { handleMediaLibrary } = await mod();
  const main = 'images/uploads/new-' + H('b') + '.webp';
  const b = fakeBucket([obj(main, '2026-11-10', 'images/uploads/new.webp')]);
  for (const key of ['images/Abaya/x.webp', 'images/uploads/new-card-' + H('c') + '.webp', '../secret', 'images/uploads/plain.webp']) {
    const r = await handleMediaLibrary(req({ Token: 'tok-owner', action: 'delete', key }), env(b), owner);
    assert.equal(r.status, 400, key);
  }
  const blind = env(b); blind.STOCK_DB = null; blind.ASSETS = { fetch: async () => new Response('', { status: 500 }) };
  const r = await handleMediaLibrary(req({ Token: 'tok-owner', action: 'delete', key: main }), blind, owner);
  assert.equal(r.status, 503);
  assert.ok(b.has(main));
});

test('owner only, same site only', async () => {
  const { handleMediaLibrary } = await mod();
  const b = fakeBucket([]);
  assert.equal((await handleMediaLibrary(req({ Token: 'tok-staff', action: 'list' }), env(b), owner)).status, 403);
  assert.equal((await handleMediaLibrary(req({ action: 'list' }), env(b), owner)).status, 401);
  assert.equal((await handleMediaLibrary(req({ Token: 'tok-owner', action: 'list' }, 'https://evil.example'), env(b), owner)).status, 403);
});

test('manifest keeps product photos and leaves out the speed copies', async () => {
  const { isLibraryPhoto } = await manifest();
  assert.equal(isLibraryPhoto('images/Abaya/black.webp'), true);
  assert.equal(isLibraryPhoto('images/top.jpeg'), true);
  assert.equal(isLibraryPhoto('images/uploads/dr-01-1793126083919.webp'), true);
  for (const p of ['images/card/x.webp', 'images/card-avif/x.avif', 'images/m900/x.webp', 'images/opt/x.webp', 'images/uploads/dr-01-card.webp', 'images/x.avif', 'images/two-piece-dress/README.md']) assert.equal(isLibraryPhoto(p), false, p);
});
