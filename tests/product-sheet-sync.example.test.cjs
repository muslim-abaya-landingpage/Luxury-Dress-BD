const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '../product-sheet-sync.example.js'), 'utf8');
const fakeModule = { exports: {} };
vm.runInNewContext(source, { window: {}, module: fakeModule, document: undefined, console, Number, String, Object, Array, Math, JSON, Error });
const { mapSheetRows, matrixErrors, parseList } = fakeModule.exports;

test('maps ProductLibrary JSON columns and preserves all product fields for staging', () => {
  const [row] = mapSheetRows([{
    id: 'ABY-001', name: 'Black Abaya', category: 'abaya', price: '৳1,450',
    sizes: '["M","L"]', images: '["img1.webp","img2.webp"]',
    variantMatrix: '[{"sku":"ABY-001-BLK-M","color":"black","size":"M","price":1450,"stock":4}]',
    priceByType: '{"Full Set":1450}',
    colorVariants: '[{"color":"black","colorLabel":"Black","image":"img1.webp"}]'
  }]);
  assert.equal(row.id, 'ABY-001');
  assert.equal(row.price, 1450);
  assert.deepEqual(row.sizes, ['M', 'L']);
  assert.equal(row.variantMatrix[0].sku, 'ABY-001-BLK-M');
  assert.equal(row.priceByType['Full Set'], 1450);
  assert.equal(row.colorVariants[0].color, 'black');
});

test('blank price stays invalid and blank stock stays unspecified', () => {
  const [row] = mapSheetRows([{ id: 'A', name: 'Product', category: 'abaya', price: '', stock: '' }]);
  assert.equal(Number.isNaN(row.price), true);
  assert.equal(row.stock, undefined);
  assert.equal(row.variantMatrix, null);
  assert.equal(row.colorVariants, null);
});

test('Bengali numerals in price and stock are converted to numeric values', () => {
  const [row] = mapSheetRows([{ price: '৳১,৪৫০', stock: '১২' }]);
  assert.equal(row.price, 1450);
  assert.equal(row.stock, 12);
});

test('an explicit empty variant matrix is distinct from a blank cell', () => {
  const [row] = mapSheetRows([{ variantMatrix: '[]' }]);
  assert.deepEqual(row.variantMatrix, []);
});

test('operator-readable pipe-delimited size cells are supported', () => {
  assert.deepEqual(Array.from(parseList('S | M | L', 'Sizes')), ['S', 'M', 'L']);
});

test('variant matrix validation rejects duplicate SKU, duplicate combination and invalid stock', () => {
  const errors = matrixErrors([
    { sku: 'A-B-M', color: 'black', size: 'M', price: 100, stock: 1 },
    { sku: 'A-B-M', color: 'black', size: 'M', price: 100, stock: -1 }
  ], 2);
  assert.ok(errors.some((x) => x.includes('duplicate variant SKU')));
  assert.ok(errors.some((x) => x.includes('duplicate color × size')));
  assert.ok(errors.some((x) => x.includes('stock শূন্য')));
});
