const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadBrowserIife(file) {
  const sandbox = { module: { exports: {} } };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(fs.readFileSync(require.resolve(file), 'utf8'), sandbox, { filename: file });
  return sandbox.module.exports;
}

const { parseProductCsv, parseMoney } = loadBrowserIife('../product-bulk-import.js');

test('parses quoted commas, escaped quotes, gallery and size lists', () => {
  const csv = [
    'SKU,Name,Price,Category,Image,Sizes,Images',
    'ABY-01,"Abaya, Premium ""Noor""",1450,abaya,https://img.example/a.jpg,"50|52|54","https://img.example/a.jpg|https://img.example/b.jpg"'
  ].join('\r\n');
  const result = parseProductCsv(csv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.rows[0].name, 'Abaya, Premium "Noor"');
  assert.deepEqual(Array.from(result.rows[0].sizes), ['50', '52', '54']);
  assert.deepEqual(Array.from(result.rows[0].images), ['https://img.example/a.jpg', 'https://img.example/b.jpg']);
});

test('accepts Google Sheets TSV and Bengali numeric price', () => {
  const tsv = 'SKU\tName\tPrice\tCategory\tImage\nABY-02\tকালো আবায়া\t৳১,৪৫০\tabaya\timages/black.jpg';
  const result = parseProductCsv(tsv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.delimiter, '\t');
  assert.equal(result.rows[0].price, 1450);
  assert.equal(parseMoney('৳ ৯৯৯'), 999);
});

test('reports missing required import columns', () => {
  assert.throws(() => parseProductCsv('Name,Price\nOne,10'), /প্রয়োজনীয় কলাম নেই/);
});

test('rejects malformed price and invalid negative quantity', () => {
  const csv = 'SKU,Name,Price,Category,Image,Stock\nABY-03,One,no,abaya,x.jpg,-1';
  const result = parseProductCsv(csv);
  assert.ok(result.errors.some((error) => error.includes('দাম সংখ্যা নয়')));
  assert.ok(result.errors.some((error) => error.includes('Stock')));
});

test('enforces the 250-product batch cap', () => {
  const rows = ['SKU,Name,Price,Category,Image'];
  for (let i = 0; i < 251; i += 1) rows.push(`ABY-${i},Item ${i},10,abaya,x.jpg`);
  const result = parseProductCsv(rows.join('\n'));
  assert.ok(result.errors.some((error) => error.includes('সর্বোচ্চ 250')));
});
