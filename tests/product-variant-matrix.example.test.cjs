const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const sandbox = { module: { exports: {} } };
sandbox.globalThis = sandbox;
vm.runInNewContext(fs.readFileSync(require.resolve('../product-variant-matrix.example.js'), 'utf8'), sandbox);
const matrix = sandbox.module.exports;

const rows = [
  { sku: 'ABY-BLK-50', color: 'black', colorLabel: 'Black', size: '50', price: 1450 },
  { sku: 'ABY-BLK-52', color: 'black', colorLabel: 'Black', size: '52', price: 1450 },
  { sku: 'ABY-MRN-50', color: 'maroon', colorLabel: 'Maroon', size: '50', price: 1490 }
];

test('creates stable compound inventory keys', () => {
  assert.equal(matrix.makeVariantKey(rows[0]), 'color=black|size=50');
});

test('finds selected color-size combination and available option lists', () => {
  assert.equal(matrix.findVariant(rows, 'BLACK', '52').sku, 'ABY-BLK-52');
  assert.deepEqual(Array.from(matrix.listColors(rows), (x) => x.label), ['Black', 'Maroon']);
  assert.deepEqual(Array.from(matrix.listSizesForColor(rows, 'black')), ['50', '52']);
});

test('rejects duplicated SKU or duplicated color-size pair', () => {
  const duplicate = rows.concat([{ ...rows[0] }]);
  const errors = Array.from(matrix.validateVariantMatrix(duplicate));
  assert.ok(errors.some((error) => error.includes('duplicate')));
  assert.ok(errors.some((error) => error.includes('দুইবার')));
});
