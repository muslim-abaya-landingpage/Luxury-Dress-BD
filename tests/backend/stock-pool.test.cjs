const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${name} in apps-script/Code.gs`);
  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, `Missing body for ${name}`);

  let depth = 0;
  let state = 'code';
  let escaped = false;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === 'line-comment') {
      if (ch === '\n') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        state = 'code';
        i += 1;
      }
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if ((state === 'single' && ch === "'") ||
                 (state === 'double' && ch === '"') ||
                 (state === 'template' && ch === '`')) {
        state = 'code';
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      state = 'line-comment';
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      state = 'block-comment';
      i += 1;
      continue;
    }
    if (ch === "'") {
      state = 'single';
      continue;
    }
    if (ch === '"') {
      state = 'double';
      continue;
    }
    if (ch === '`') {
      state = 'template';
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  assert.fail(`Unclosed function body: ${name}`);
}

const names = ['normStockVariant_', 'stockVariantCompareKey_', 'findStockVariantRowIndex_', 'cartItemVariantKey_',
  'colorSizeStockVariant_', 'stockSizePartCandidates_', 'cartItemStockCandidates_',
  'stockRowIsTracked_', 'stockRequirementsForCart_', 'resolveStockRequirementsForCart_', 'trackedStockRequirements_',
  'reservedStockRequirements_', 'assertStockRequirementsAvailable_'];
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(names.map(extractFunction).join('\n') + '\nthis.api = { trackedStockRequirements_, reservedStockRequirements_, assertStockRequirementsAvailable_ };', sandbox);
const api = sandbox.api;
const header = ['Product ID', 'Product Name', 'Category', 'Variant', 'Tracked', 'Available', 'Reserved'];
const cart = (...lines) => lines.map(([id, size, qty]) => ({ id, size, qty, name: id }));

test('a product-level row (empty Variant) is the stock pool for every size', () => {
  const data = [header, ['KURTI-03', 'Kurti', 'tops', '', true, 5, 0]];
  const reqs = api.trackedStockRequirements_(cart(['KURTI-03', '38', 2], ['KURTI-03', '40', 1]), data, true);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].variant, '');
  assert.equal(reqs[0].qty, 3);
  assert.equal(reqs[0].available, 5);
  api.assertStockRequirementsAvailable_(reqs);
});

test('pooled quantities are combined before the availability check', () => {
  const data = [header, ['KURTI-03', 'Kurti', 'tops', '', true, 2, 0]];
  const reqs = api.trackedStockRequirements_(cart(['KURTI-03', '38', 2], ['KURTI-03', '40', 1]), data, true);
  assert.throws(() => api.assertStockRequirementsAvailable_(reqs), /OUT_OF_STOCK/);
});

test('an explicit size row wins over the pool; other sizes still use the pool', () => {
  const data = [header, ['KURTI-03', 'Kurti', 'tops', '38', true, 1, 0], ['KURTI-03', 'Kurti', 'tops', '', true, 4, 0]];
  const reqs = api.trackedStockRequirements_(cart(['KURTI-03', '38', 1], ['KURTI-03', '40', 2]), data, true);
  const by = Object.fromEntries(reqs.map(r => [r.variant, r]));
  assert.equal(by['38'].available, 1);
  assert.equal(by[''].qty, 2);
});

test('without a pool, a tracked product still rejects sizes it does not know (unchanged behaviour)', () => {
  const data = [header, ['KURTI-03', 'Kurti', 'tops', '38', true, 3, 0]];
  assert.throws(() => api.trackedStockRequirements_(cart(['KURTI-03', '40', 1]), data, true), /VARIANT_NOT_TRACKED/);
});

test('untracked products and an untracked pool never block orders', () => {
  const data = [header, ['KURTI-03', 'Kurti', 'tops', '', false, 0, 0]];
  assert.deepEqual(Array.from(api.trackedStockRequirements_(cart(['KURTI-03', '38', 1], ['DR-01', 'M', 1]), data, true)), []);
});

test('release/finalize resolve to the same pool row the reservation used', () => {
  const data = [header, ['KURTI-03', 'Kurti', 'tops', '', true, 3, 2]];
  const reqs = api.reservedStockRequirements_(cart(['KURTI-03', '38', 1], ['KURTI-03', '40', 1]), data);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].variant, '');
  assert.equal(reqs[0].qty, 2);
  assert.equal(reqs[0].reserved, 2);
});

const colorCart = (...lines) => lines.map(([id, color, size, qty]) => ({ id, color, size, qty, name: id }));

test('a "Colour · Size" row keeps separate stock for each colour of the same size', () => {
  const data = [header,
    ['AB-9', 'Abaya', 'abaya', 'Navy · 52', true, 3, 0],
    ['AB-9', 'Abaya', 'abaya', 'Black · 52', true, 1, 0]];
  const reqs = api.trackedStockRequirements_(colorCart(['AB-9', 'Navy', '52', 2], ['AB-9', 'Black', '52', 1]), data, true);
  const by = Object.fromEntries(reqs.map(r => [r.variant, r]));
  assert.equal(by['Navy · 52'].available, 3);
  assert.equal(by['Navy · 52'].qty, 2);
  assert.equal(by['Black · 52'].qty, 1);
  api.assertStockRequirementsAvailable_(reqs);
  const tooMany = api.trackedStockRequirements_(colorCart(['AB-9', 'black', '52', 2]), data, true);
  assert.throws(() => api.assertStockRequirementsAvailable_(tooMany), /OUT_OF_STOCK/);
});

test('without a colour row the size row, then the colour row, then the pool is used', () => {
  const sizeRow = [header, ['AB-9', 'Abaya', 'abaya', '52', true, 4, 0], ['AB-9', 'Abaya', 'abaya', '', true, 9, 0]];
  const merged = api.trackedStockRequirements_(colorCart(['AB-9', 'Navy', '52', 1], ['AB-9', 'Black', '52', 2]), sizeRow, true);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].variant, '52');
  assert.equal(merged[0].qty, 3);
  const colourRow = [header, ['AB-9', 'Abaya', 'abaya', 'Navy', true, 2, 0]];
  assert.equal(api.trackedStockRequirements_(colorCart(['AB-9', 'Navy', '52', 1]), colourRow, true)[0].variant, 'Navy');
  const pool = [header, ['AB-9', 'Abaya', 'abaya', '', true, 5, 0]];
  assert.equal(api.trackedStockRequirements_(colorCart(['AB-9', 'Navy', '52', 1]), pool, true)[0].variant, '');
  const strict = [header, ['AB-9', 'Abaya', 'abaya', '54', true, 5, 0]];
  assert.throws(() => api.trackedStockRequirements_(colorCart(['AB-9', 'Navy', '52', 1]), strict, true), /VARIANT_NOT_TRACKED:AB-9 \(52\)/);
});

test('release finds the same "Colour · Size" row the reservation used', () => {
  const data = [header, ['AB-9', 'Abaya', 'abaya', 'Navy · 52', true, 3, 2], ['AB-9', 'Abaya', 'abaya', '52', true, 7, 0]];
  const reqs = api.reservedStockRequirements_(colorCart(['AB-9', 'Navy', '52', 2]), data);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0].variant, 'Navy · 52');
  assert.equal(reqs[0].reserved, 2);
});

const utilsSrc = fs.readFileSync(path.join(root, 'product-utils.js'), 'utf8');
const g = { location: { protocol: 'https:' } };
g.window = g;
vm.createContext(g);
vm.runInContext(utilsSrc, g);

test('storefront uses the same pool rule for size availability', () => {
  const qty = g.maCatalog.getStockQty;
  const pooled = { id: 'K', stockVariants: { _default: { tracked: true, available: 4 } } };
  assert.equal(qty(pooled, '38'), 4);
  assert.equal(g.maCatalog.isInStock({ id: 'K', stockVariants: { _default: { tracked: true, available: 0 } } }, '38'), false);
  const mixed = { id: 'K', stockVariants: { '38': { tracked: true, available: 1 }, _default: { tracked: true, available: 6 } } };
  assert.equal(qty(mixed, '38'), 1);
  assert.equal(qty(mixed, '40'), 6);
  const strict = { id: 'K', stockVariants: { '38': { tracked: true, available: 2 } } };
  assert.equal(qty(strict, '40'), 0);
});

test('storefront uses the same "Colour · Size" rows as the order check', () => {
  const qty = g.maCatalog.getStockQty;
  const p = { id: 'AB', stockVariants: { 'navy · 52': { tracked: true, available: 3 }, 'black · 52': { tracked: true, available: 0 },
    'black · 54': { tracked: true, available: 2 } } };
  assert.equal(qty(p, '52', 'navy'), 3);
  assert.equal(qty(p, '52', 'black'), 0);
  assert.equal(g.maCatalog.isInStock(p, '52', 'black'), false);
  assert.equal(qty(p, '52', 'red'), 0);
  assert.equal(qty(p, 'black', 'black'), 2, 'colour chosen, no size yet: that colour\'s total');
  assert.equal(qty(p, '52'), 0, 'old callers without a colour: no plain size row');
  const sized = { id: 'AB', stockVariants: { '52': { tracked: true, available: 4 }, 'navy · 52': { tracked: true, available: 1 } } };
  assert.equal(qty(sized, '52', 'navy'), 1);
  assert.equal(qty(sized, '52', 'black'), 4);
  const key = g.maCatalog.stockLineKey;
  assert.equal(key(sized, { size: '52', color: 'black' }), key(sized, { size: '52', color: 'red' }));
  assert.notEqual(key(sized, { size: '52', color: 'navy' }), key(sized, { size: '52', color: 'black' }));
  const pooled = { id: 'K', stockVariants: { _default: { tracked: true, available: 4 } } };
  assert.equal(key(pooled, { size: '38' }), key(pooled, { size: '40' }), 'sizes sharing the pool count together');
  assert.equal(key(null, { size: ' 38 ' }), '38');
});

test('expired login sessions are removed, valid and undated ones are kept', () => {
  const now = Date.UTC(2026, 9, 20);
  const rows = [
    ['Token', 'Email', 'Phone', 'Name', 'CreatedAt', 'ExpiresAt', 'Role'],
    ['old', 'a', '', '', '', new Date(Date.UTC(2026, 8, 3)), 'customer'],
    ['live', 'b', '', '', '', new Date(Date.UTC(2026, 9, 27)), 'admin'],
    ['undated', 'c', '', '', '', '', 'customer'],
    ['old2', 'd', '', '', '', '2026-10-10T00:00:00Z', 'admin'],
  ];
  const sheet = { getDataRange: () => ({ getValues: () => rows.map(r => r.slice()) }), deleteRow: n => { rows.splice(n - 1, 1); } };
  const box = { getSessionsSheet_: () => sheet };
  vm.createContext(box);
  vm.runInContext(extractFunction('cleanupExpiredSessions_'), box);
  const res = box.cleanupExpiredSessions_(now);
  assert.equal(res.removed, 2);
  assert.deepEqual(rows.slice(1).map(r => r[0]), ['live', 'undated']);
});

test('new orders go right after the last real order, not after trailing formula rows', () => {
  // 3 orders, then empty-but-formatted/formula rows down to 965.
  const values = Array.from({ length: 964 }, (_, i) => (i < 3 ? ['C' + i, '017'] : ['', '']));
  const sheet = { getLastRow: () => 965, getRange: (r, c, n, w) => ({ getValues: () => values.slice(r - 2, r - 2 + n) }) };
  const box = {};
  vm.createContext(box);
  vm.runInContext(extractFunction('lastOnlineOrderDataRow_'), box);
  assert.equal(box.lastOnlineOrderDataRow_(sheet), 4);
  const empty = { getLastRow: () => 1 };
  assert.equal(box.lastOnlineOrderDataRow_(empty), 1);
});
