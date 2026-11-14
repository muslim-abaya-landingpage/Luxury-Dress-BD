// Trash like WordPress: products stay in the Trash for 30 days, then the next save deletes them permanently.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const w = {}; w.window = w; vm.createContext(w);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../product-publish-utils.js'), 'utf8'), w);
const U = w.MaProductPublishUtils;
const plain = (x) => JSON.parse(JSON.stringify(x));

test('deleted on the 30th day after trashing, not before', () => {
  assert.equal(U.trashDeleteDay('2026-11-15'), '2026-12-15');
  const shop = () => ({ abaya: [
    { id: 'A', name: 'kept', status: 'publish' },
    { id: 'B', name: 'young trash', status: 'trash', trashedAt: '2026-11-15' },
    { id: 'C', name: 'old trash', status: 'trash', trashedAt: '2026-10-01' },
  ], kurti: [{ id: 'D', status: 'draft' }] });
  let s = shop();
  assert.deepEqual(plain(U.purgeOldTrash(s, '2026-12-14').map((x) => x.id)), ['C']);
  assert.deepEqual(s.abaya.map((p) => p.id), ['A', 'B']);
  s = shop();
  assert.deepEqual(plain(U.purgeOldTrash(s, '2026-12-15').map((x) => x.id).sort()), ['B', 'C']);
  assert.deepEqual(s.abaya.map((p) => p.id), ['A']);
  assert.deepEqual(s.kurti.map((p) => p.id), ['D']);
});

test('trash without a date waits the full 30 days from now', () => {
  const s = { abaya: [{ id: 'X', status: 'trash' }] };
  assert.deepEqual(plain(U.purgeOldTrash(s, '2026-11-15')), []);
  assert.equal(s.abaya[0].trashedAt, '2026-11-15');
});
