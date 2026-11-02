// Popup checkout (backend part): unique order IDs, the same checkout attempt never makes two orders,
// the Processing status exists everywhere a status list is kept, and the order note is stored safely.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const code = read('apps-script/Code.gs');

function fnSource(name) {
  const start = code.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  let depth = 0;
  for (let i = code.indexOf('{', start); i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}' && --depth === 0) return code.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
}

function load(names, extra) {
  const store = {};
  const ctx = Object.assign({
    console, Date, Math, String, JSON,
    Utilities: {
      formatDate: () => '20261102',
      base64EncodeWebSafe: (s) => Buffer.from(String(s)).toString('base64url')
    },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in store ? store[k] : null), put: (k, v) => { store[k] = v; } }) },
    normalizePhone_: (p) => String(p || '').replace(/\D/g, '').replace(/^88/, '')
  }, extra || {});
  vm.createContext(ctx);
  names.forEach((n) => vm.runInContext(fnSource(n), ctx));
  ctx.__store = store;
  return ctx;
}

test('order ID: a new ID never repeats one already in the sheet', () => {
  const taken = ['MA-20261102-1000', 'MA-20261102-1001', 'MA-20261102-1002'];
  let calls = 0;
  const ctx = load(['generateUniqueOrderId_'], {
    recentOnlineOrderIds_: () => Object.fromEntries(taken.map((t) => [t, true])),
    generateOrderId_: () => 'MA-20261102-' + (1000 + (calls++))
  });
  assert.equal(ctx.generateUniqueOrderId_({}, 'MA-20261102-1001'), 'MA-20261102-1003');
  assert.equal(ctx.generateUniqueOrderId_({}, 'MA-20261102-5555'), 'MA-20261102-5555');
});

test('order ID: still unique when every random draw is taken', () => {
  const ctx = load(['generateUniqueOrderId_'], {
    recentOnlineOrderIds_: () => ({ 'MA-20261102-1000': true }),
    generateOrderId_: () => 'MA-20261102-1000'
  });
  const id = ctx.generateUniqueOrderId_({}, 'MA-20261102-1000');
  assert.match(id, /^MA-20261102-1000-\d{4}$/);
});

test('same checkout attempt (EventID + phone) returns the saved order ID', () => {
  const ctx = load(['orderIdempotencyKey_', 'findSavedOrderForEvent_', 'rememberSavedOrderForEvent_']);
  assert.equal(ctx.findSavedOrderForEvent_('order_1730520000000_ab12', '01712345678'), '');
  ctx.rememberSavedOrderForEvent_('order_1730520000000_ab12', '01712345678', 'MA-20261102-4321');
  assert.equal(ctx.findSavedOrderForEvent_('order_1730520000000_ab12', '+8801712345678'), 'MA-20261102-4321');
  // Another phone with the same EventID does not get someone else's order.
  assert.equal(ctx.findSavedOrderForEvent_('order_1730520000000_ab12', '01811111111'), '');
  // Missing / odd EventIDs are never cached.
  ctx.rememberSavedOrderForEvent_('', '01712345678', 'MA-X');
  ctx.rememberSavedOrderForEvent_('a b', '01712345678', 'MA-X');
  assert.equal(Object.keys(ctx.__store).length, 1);
});

test('order intake checks the saved attempt first and remembers it after the row is written', () => {
  const body = fnSource('handleOnlineOrderPost_');
  const check = body.indexOf('findSavedOrderForEvent_');
  assert.ok(check > 0 && check < body.indexOf('assertLiveStockAvailable_'), 'retry check runs before stock/duplicate checks');
  assert.ok(check < body.indexOf('checkDuplicateOrder_'));
  const unique = body.indexOf('generateUniqueOrderId_');
  assert.ok(unique > body.indexOf('orderLock.waitLock') && unique < body.indexOf('reserveStockForOrderItems_'), 'unique ID picked inside the order lock');
  assert.ok(body.indexOf('rememberSavedOrderForEvent_') > body.indexOf('orderLock.releaseLock'));
  assert.match(body, /sanitizeCellText_\(param_\(e, 'SpecialNotes'\) \|\| '', 1000\)/);
});

test('Processing status is offered by the sheet, admin API and manual order form', () => {
  assert.match(fnSource('getOrderStatusOptions_'), /'Confirmed', 'Processing', 'Shipped'/);
  const admin = read('apps-script/AdminOrders.gs');
  assert.match(admin, /var ADM_STATUSES = \[[^\]]*'Processing'/);
  assert.match(admin, /var ADM_CREATE_STATUSES = \[[^\]]*'Processing'/);
  assert.match(read('admin-order-new.js'), /"Processing"/);
  assert.match(read('functions/_lib/gs-core.js'), /'Confirmed', 'Processing', 'Shipped'/);
});

test('Processing keeps reserved stock (no stock change on that status)', () => {
  const src = fnSource('applyStockLifecycleForStatusChangeLocked_');
  assert.doesNotMatch(src, /Processing/);
  assert.match(src, /else \{\s*return;/);
});
