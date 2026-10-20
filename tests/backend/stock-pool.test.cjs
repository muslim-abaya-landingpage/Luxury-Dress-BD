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
