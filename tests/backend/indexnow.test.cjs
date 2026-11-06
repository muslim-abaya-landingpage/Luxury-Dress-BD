const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '../..');
const load = () => import(path.join(root, 'scripts/indexnow-submit.mjs'));

test('IndexNow key file exists at the site root and matches its name', async () => {
  const { findKey } = await load();
  const key = findKey(root);
  assert.match(key, /^[a-f0-9]{32}$/);
  // The deploy prune step must not drop it (.txt at the root is kept).
  const prune = fs.readFileSync(path.join(root, 'scripts/prune-deploy.mjs'), 'utf8');
  assert.doesNotMatch(prune.match(/const ROOT_FILE = [^;]+;/)[0], /txt/);
});

test('changed files map to public sitemap pages only', async () => {
  const { urlsForChanges } = await load();
  const all = ['https://muslimabaya.com/', 'https://muslimabaya.com/abaya', 'https://muslimabaya.com/product/A', 'https://muslimabaya.com/product/B'];
  assert.deepEqual(urlsForChanges(['abaya.html', 'admin-dashboard.html', 'product/B.html', 'site-header.css'], all).sort(),
    ['https://muslimabaya.com/abaya', 'https://muslimabaya.com/product/B']);
  assert.equal(urlsForChanges(['category-products.js'], all).length, 4);
  assert.deepEqual(urlsForChanges(['index.html'], all), ['https://muslimabaya.com/']);
  assert.deepEqual(urlsForChanges(['admin-orders.html', 'README.md'], all), []);
});
