const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const box = { module: { exports: {} } }; box.globalThis = box;
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../size-finder.js'), 'utf8'), box);
const S = box.module.exports;

test('length: picks the closest abaya length, tie goes longer', () => {
  const L = ['50', '52', '54', '56'];
  assert.equal(S.pick(L, 53.2, 'length').value, '54');
  assert.equal(S.pick(L, 53, 'length').value, '54');
  assert.equal(S.pick(L, 51.4, 'length').value, '52');
  assert.equal(S.pick(L, 56.8, 'length').value, '56');
  assert.equal(S.pick(L, 58, 'length').outOfRange, 'above');
  assert.equal(S.pick(L, 58, 'length').value, null);
  const low = S.pick(L, 46, 'length');
  assert.equal(low.value, '50'); assert.equal(low.outOfRange, 'below');
});

test('body: never suggests a size tighter than the body', () => {
  const B = ['Body 34', 'Body 36', 'Body 38', 'Body 40'];
  assert.equal(S.pick(B, 35, 'body').value, 'Body 36');
  assert.equal(S.pick(B, 36, 'body').value, 'Body 36');
  assert.equal(S.pick(B, 41, 'body').outOfRange, 'above');
  assert.equal(S.pick(['46 [Free size]'], 44, 'body').value, '46 [Free size]');
});

test('ignores bad input and non-numeric options', () => {
  assert.equal(S.pick(['Free Size'], 40, 'body').value, null);
  assert.equal(S.pick(['50', '52'], '', 'length').value, null);
  assert.equal(S.pick(['50', '52'], -3, 'length').value, null);
});
