// Product quantity: the order server's count decides, an "In stock" switch cannot sell a counted product at 0,
// a reservation takes one off per order, and Tracked=false turns counting off.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8');
function fnSource(name) {
  const start = code.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  let depth = 0;
  for (let i = code.indexOf('{', start); i < code.length; i++) {
    if (code[i] === '{') depth++; else if (code[i] === '}' && --depth === 0) return code.slice(start, i + 1);
  }
}
const plain = (v) => JSON.parse(JSON.stringify(v));
function sheet(rows) { return { getDataRange: () => ({ getValues: () => rows }) }; }

function status(variantRows, overrides) {
  const ctx = { Object, Number, String, Math, JSON,
    ensureStockSheet_: () => sheet([['Product ID', 'Name', 'Qty']]),
    ensureStockVariantsSheet_: () => sheet([['pid', 'name', 'cat', 'variant', 'tracked', 'avail', 'reserved', 'thr']].concat(variantRows)),
    liveStockOverrides_: () => overrides };
  vm.createContext(ctx);
  ['publicStockIsCounted_', 'getPublicStockStatus_'].forEach((n) => vm.runInContext(fnSource(n), ctx));
  return plain(ctx.getPublicStockStatus_().items);
}

test('a counted product at 0 stays Out of stock even when its "In stock" switch is on', () => {
  const items = status([['A', 'A', 'c', '', true, 0, 2, '']], { A: true });
  assert.equal(items.A.inStock, false);
  assert.equal(items.A.qty, 0);
  assert.notEqual(items.A.manualOverride, true);
});

test('a counted product with pieces left is In stock; the "Out of stock" switch still hides it', () => {
  assert.equal(status([['A', 'A', 'c', '', true, 12, 0, '']], {}).A.inStock, true);
  assert.equal(status([['A', 'A', 'c', '', true, 12, 0, '']], {}).A.qty, 12);
  const off = status([['A', 'A', 'c', '', true, 12, 0, '']], { A: false }).A;
  assert.equal(off.inStock, false);
  assert.equal(off.manualOverride, true);
});

test('products without a count keep using the switch as before', () => {
  assert.equal(status([], { B: true }).B.inStock, true);
  assert.equal(status([['C', 'C', 'c', '', false, 0, 0, '']], { C: true }).C.inStock, true);
});

test('Tracked=false (no quantity) turns counting off; a quantity turns it on', () => {
  const body = fnSource('saveAdminStockVariant_');
  assert.match(body, /var setUntracked = !hasQty && trackedRaw === 'false';/);
  assert.match(body, /setTracked: setTracked, setUntracked: setUntracked/);
  assert.match(fnSource('mutateStockVariant_'), /tracked: opts\.setUntracked \? false : !!\(before\.tracked \|\| opts\.setTracked\)/);
});

test('every website order reserves (takes off) stock inside the order lock', () => {
  const body = fnSource('handleOnlineOrderPost_');
  const r = body.indexOf("reserveStockForOrderItems_(validated.cartItems, orderId, 'order-intake')");
  assert.ok(r > body.indexOf('orderLock.waitLock'));
  assert.match(fnSource('reserveStockForOrderItems_'), /deltaAvailable: -req\.qty/);
});
