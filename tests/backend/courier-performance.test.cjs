const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../../apps-script/AdminOrders.gs'), 'utf8');

// Minimal re-implementation of the StockLedger row shape appendStockLedger_ writes:
// [Timestamp, ProductId, Variant, ChangeType, QtyBefore, QtyAfter, ReservedBefore, ReservedAfter, Reason, OrderId, Admin]
function ledgerRow(ts, changeType, orderId) {
  return [new Date(ts), 'P1', 'M', changeType, 1, 0, 1, 0, 'reason', orderId, 'system'];
}

// Minimal re-implementation of an Online Order row, positioned so the indices adminCourierPerformance_
// reads (r[0] placed-time, r[8] orderId, r[9] status, r[12] courierStatus, r[45] courier) line up.
function orderRow({ placedAt, orderId, status, courierStatus, courier }) {
  const r = new Array(46).fill('');
  r[0] = new Date(placedAt);
  r[8] = orderId;
  r[9] = status;
  r[12] = courierStatus || '';
  r[45] = courier;
  return r;
}

function fixture({ ledgerRows, orderRows }) {
  const ctx = {
    String, Number, Object, Array, Math, Date, isFinite,
    verifyAdminSession_: token => token === 'admin' ? { ok: true } : { ok: false, error: 'NOT_LOGGED_IN' },
    param_: (e, key) => e && e.parameter ? e.parameter[key] : '',
    admGetSheet_: () => ({ id: 'orders' }),
    lastOnlineOrderDataRow_: () => orderRows.length + 1,
    readOnlineOrderRows_: () => orderRows,
    ensureStockLedgerSheet_: () => ({ getDataRange: () => ({ getValues: () => [['Timestamp'], ...ledgerRows] }) })
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  // Override AFTER vm.runInContext, since the source declares some of these names itself
  // (see the documented ordering bug in steadfast-autosync-stock.test.cjs).
  ctx.admGetSheet_ = () => ({ id: 'orders' });
  ctx.lastOnlineOrderDataRow_ = () => orderRows.length + 1;
  ctx.readOnlineOrderRows_ = () => orderRows;
  ctx.ensureStockLedgerSheet_ = () => ({ getDataRange: () => ({ getValues: () => [['Timestamp'], ...ledgerRows] }) });
  return ctx;
}

test('admDeliveredAtFromStockLedger_ takes the earliest SELL-type ledger entry per order and ignores other change types', () => {
  const ctx = fixture({
    ledgerRows: [
      ledgerRow('2026-11-01T10:00:00Z', 'SELL', 'MA-1'),
      ledgerRow('2026-11-01T09:00:00Z', 'SELL_DIRECT', 'MA-1'), // earlier — should win
      ledgerRow('2026-11-02T12:00:00Z', 'RESERVE', 'MA-2'), // not a sell type — ignored
      ledgerRow('2026-11-03T08:00:00Z', 'SELL_UNTRACKED_RESERVATION', 'MA-3')
    ],
    orderRows: []
  });
  const map = ctx.admDeliveredAtFromStockLedger_();
  assert.equal(map['MA-1'].toISOString(), new Date('2026-11-01T09:00:00Z').toISOString());
  assert.equal(map['MA-2'], undefined);
  assert.ok(map['MA-3']);
});

test('adminCourierPerformance_ computes an average delivery time per courier from matched ledger timestamps, skipping orders with no ledger match', () => {
  const ctx = fixture({
    ledgerRows: [
      ledgerRow('2026-11-02T00:00:00Z', 'SELL', 'MA-1'), // 24h after placed
      ledgerRow('2026-11-04T00:00:00Z', 'SELL', 'MA-2')  // 48h after placed
      // MA-3 (Delivered) has no ledger entry at all — must be excluded, not estimated
    ],
    orderRows: [
      orderRow({ placedAt: '2026-11-01T00:00:00Z', orderId: 'MA-1', status: 'Delivered', courier: 'Steadfast' }),
      orderRow({ placedAt: '2026-11-02T00:00:00Z', orderId: 'MA-2', status: 'Delivered', courier: 'Steadfast' }),
      orderRow({ placedAt: '2026-11-05T00:00:00Z', orderId: 'MA-3', status: 'Delivered', courier: 'Steadfast' }),
      orderRow({ placedAt: '2026-11-06T00:00:00Z', orderId: 'MA-4', status: 'Cancelled', courier: 'Steadfast' })
    ]
  });
  const res = ctx.adminCourierPerformance_({ parameter: { Token: 'admin' } });
  assert.equal(res.ok, true);
  const steadfast = res.couriers.find(c => c.courier === 'Steadfast');
  assert.equal(steadfast.delivered, 3);
  assert.equal(steadfast.avgDeliverySampleSize, 2);
  assert.equal(steadfast.avgDeliveryHours, 36); // (24 + 48) / 2
});

test('adminCourierPerformance_ requires an authenticated admin session', () => {
  const ctx = fixture({ ledgerRows: [], orderRows: [] });
  const res = ctx.adminCourierPerformance_({ parameter: { Token: 'bad' } });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'NOT_LOGGED_IN');
});
