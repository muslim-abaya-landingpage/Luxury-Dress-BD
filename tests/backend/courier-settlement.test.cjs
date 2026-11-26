const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../../apps-script/AdminOrders.gs'), 'utf8');

function fixture(opts) {
  opts = opts || {};
  const ledger = (opts.ledger || []).map(r => r.slice());
  const appended = [];
  let locked = 0;
  const order = Object.assign({
    orderId: 'MA-1001', due: 1000, payment: 'Cash On Delivery',
    status: 'Delivered', courierStatus: 'delivered', courier: 'Steadfast',
    tracking: 'TRK-1001', consignmentId: '9001', name: 'Test Buyer', phone: '01700000000'
  }, opts.order || {});
  const ctx = {
    String, Number, Object, Array, Math, Date, isFinite, RegExp, JSON,
    verifyAdminSession_: token => token === 'admin' ? { ok: true, email: 'owner@example.com' } : { ok: false, error: 'NOT_LOGGED_IN' },
    param_: (e, key) => e && e.parameter ? e.parameter[key] : '',
    admCellText_: (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, n || 500),
    admMoneyParam_: (e, key, fallback) => {
      const raw = e && e.parameter ? e.parameter[key] : undefined;
      const value = raw == null || raw === '' ? fallback : Number(raw);
      if (!Number.isFinite(value) || value < 0) throw new Error('INVALID_AMOUNT');
      return Math.round(value * 100) / 100;
    },
    admNum_: v => Number(v) || 0,
    admGetSheet_: () => ({ id: 'orders' }),
    admFindRow_: () => 2,
    readOnlineOrderRows_: () => [[]],
    admRowToOrder_: () => order,
    ensureSheet_: () => ({ getLastRow: () => ledger.length + 1, getRange: () => ({ getValues: () => ledger }) }),
    admCourierSettlementSheet_: () => ({ name: 'settlements' }),
    admCourierSettlementData_: () => ledger,
    appendRow_: (_, row) => { appended.push(row); ledger.push(row); },
    formatCell_: v => String(v || ''),
    Utilities: { getUuid: () => '12345678-1234-1234-1234-123456789012', formatDate: () => '2026-11-26' },
    LockService: { getScriptLock: () => ({ waitLock: () => { locked++; }, releaseLock: () => { locked--; } }) }
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  ctx.admGetSheet_ = () => ({ id: 'orders' });
  ctx.admFindRow_ = () => 2;
  ctx.readOnlineOrderRows_ = () => [[]];
  ctx.admRowToOrder_ = () => order;
  ctx.ensureSheet_ = () => ({ name: 'settlements' });
  ctx.admCourierSettlementSheet_ = () => ({ name: 'settlements' });
  ctx.admCourierSettlementData_ = () => ledger;
  ctx.appendRow_ = (_, row) => { appended.push(row); ledger.push(row); };
  ctx.formatCell_ = v => String(v || '');
  return { c: ctx, ledger, appended, order, get locked() { return locked; } };
}

test('COD settlement requires an authenticated admin before touching the order sheet', () => {
  const f = fixture();
  const res = f.c.admCourierSettlementSave_({ parameter: { Token: 'bad', OrderId: 'MA-1001', Amount: '100', Reference: 'TX-100' } });
  assert.equal(res.error, 'NOT_LOGGED_IN');
  assert.equal(f.locked, 0);
  assert.equal(f.appended.length, 0);
});

test('COD settlement accepts a partial payment and appends an immutable transaction row', () => {
  const f = fixture();
  const res = f.c.admCourierSettlementSave_({ parameter: { Token: 'admin', OrderId: 'MA-1001', Amount: '350.50', Reference: 'TX-350', SettlementDate: '2026-11-26', Note: 'Weekly payout' } });
  assert.equal(res.ok, true);
  assert.equal(res.received, 350.5);
  assert.equal(res.remaining, 649.5);
  assert.equal(f.appended.length, 1);
  assert.equal(f.appended[0][1], 'MA-1001');
  assert.equal(f.appended[0][6], 350.5);
  assert.equal(f.appended[0][7], 'TX-350');
  assert.equal(f.locked, 0);
});

test('COD settlement rejects an amount larger than the remaining COD due', () => {
  const f = fixture({ ledger: [['CS-1', 'MA-1001', 'Steadfast', '', '', 1000, 700, 'TX-OLD', '2026-11-20', '', new Date(), 'owner']] });
  const res = f.c.admCourierSettlementSave_({ parameter: { Token: 'admin', OrderId: 'MA-1001', Amount: '300.01', Reference: 'TX-NEW' } });
  assert.equal(res.error, 'AMOUNT_EXCEEDS_DUE');
  assert.equal(f.appended.length, 0);
});

test('COD settlement rejects duplicate transaction references for the same order', () => {
  const f = fixture({ ledger: [['CS-1', 'MA-1001', 'Steadfast', '', '', 1000, 200, 'TX-DUP', '2026-11-20', '', new Date(), 'owner']] });
  const res = f.c.admCourierSettlementSave_({ parameter: { Token: 'admin', OrderId: 'MA-1001', Amount: '100', Reference: 'TX-DUP' } });
  assert.equal(res.error, 'DUPLICATE_REFERENCE');
  assert.equal(f.appended.length, 0);
});

test('COD settlement only accepts delivered COD orders', () => {
  const notDelivered = fixture({ order: { status: 'Shipped', courierStatus: 'in_transit' } });
  assert.equal(notDelivered.c.admCourierSettlementSave_({ parameter: { Token: 'admin', OrderId: 'MA-1001', Amount: '100', Reference: 'TX-A' } }).error, 'NOT_DELIVERED');
  const prepaid = fixture({ order: { payment: 'bKash' } });
  assert.equal(prepaid.c.admCourierSettlementSave_({ parameter: { Token: 'admin', OrderId: 'MA-1001', Amount: '100', Reference: 'TX-B' } }).error, 'NOT_COD');
});

test('COD settlement rejects duplicate full payments and validates reference/date', () => {
  const f = fixture({ ledger: [['CS-1', 'MA-1001', 'Steadfast', '', '', 1000, 1000, 'TX-FULL', '2026-11-20', '', new Date(), 'owner']] });
  assert.equal(f.c.admCourierSettlementSave_({ parameter: { Token: 'admin', OrderId: 'MA-1001', Amount: '1', Reference: 'TX-NEXT' } }).error, 'ALREADY_SETTLED');
  assert.equal(f.c.admCourierSettlementSave_({ parameter: { Token: 'admin', OrderId: 'MA-1001', Amount: '1', Reference: 'x' } }).error, 'REFERENCE_REQUIRED');
  assert.equal(f.c.admCourierSettlementSave_({ parameter: { Token: 'admin', OrderId: 'MA-1001', Amount: '1', Reference: 'TX-DATE', SettlementDate: '26/11/2026' } }).error, 'INVALID_DATE');
});
