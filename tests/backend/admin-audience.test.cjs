// Admin → বিজ্ঞাপনের অডিয়েন্স: lists built from the shop's own orders (apps-script/AdminAudience.gs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = (f) => fs.readFileSync(path.join(__dirname, '../../apps-script', f), 'utf8');

function orderRow(day, name, phone, total, status, courier) {
  const r = new Array(13).fill('');
  r[0] = day; r[1] = name; r[2] = phone; r[7] = total; r[8] = 'MA-' + Math.random(); r[9] = status; r[12] = courier || '';
  return r;
}

function run(params, { orders, carts = [], blocked = {}, role = 'owner' }) {
  const ctx = {
    String, Number, Object, Array, Math, Date, parseInt, isFinite, JSON,
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => ({ getLastRow: () => orders.length + 1 }) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(read('AdminOrders.gs'), ctx);
  vm.runInContext(read('AdminAudience.gs'), ctx);
  Object.assign(ctx, {
    verifyAdminSession_: (t) => (t === 'tok' ? { ok: true, role: role === 'owner' ? 'admin' : 'staff' } : { ok: false, error: 'INVALID_TOKEN' }),
    requireOwnerAdmin_: (v) => (v.role === 'admin' ? null : { ok: false, error: 'OWNER_ONLY' }),
    param_: (e, k) => (e.parameter[k] == null ? '' : e.parameter[k]),
    normalizePhone_: (p) => String(p || '').replace(/\D/g, '').replace(/^880/, '0').slice(-11),
    dayKeyFromCell_: (v) => String(v || '').slice(0, 10),
    readOnlineOrderRows_: () => orders,
    admBlockedMap_: () => blocked,
    ensureAbandonedCartsSheet_: () => ({ getDataRange: () => ({ getValues: () => [['Phone'], ...carts] }) }),
  });
  return JSON.parse(JSON.stringify(ctx.adminAudienceExport_({ parameter: Object.assign({ Token: 'tok' }, params) })));
}

const ORDERS = [
  orderRow('2026-01-05', 'Rina Akter', '01711111111', 1500, 'Delivered'),
  orderRow('2026-11-01', 'Rina Akter', '01711111111', 2000, 'Delivered'),
  orderRow('2026-11-02', 'Karim', '01722222222', 1200, 'Delivered'),
  orderRow('2026-11-03', 'Fake Guy', '01733333333', 900, 'Fake'),
  orderRow('2026-11-04', 'Nusrat Jahan', '01744444444', 1100, 'Pending'),
  orderRow('2026-11-05', 'Twice Cancel', '01755555555', 800, 'Cancelled'),
  orderRow('2026-11-06', 'Twice Cancel', '01755555555', 800, 'Confirmed', 'Returned'),
];

test('counts only (no rows) for the page load, and it is owner only', () => {
  const res = run({ RecordType: 'AdminAudienceCounts', List: 'buyers' }, { orders: ORDERS });
  assert.equal(res.ok, true);
  assert.equal(res.rows, undefined);
  assert.deepEqual(res.counts, { buyers: 2, repeat: 1, all: 3, abandoned: 0, exclude: 2 });
  assert.equal(run({ RecordType: 'AdminAudienceCounts' }, { orders: ORDERS, role: 'staff' }).error, 'OWNER_ONLY');
});

test('buyers export is in Meta customer-list shape with delivered value', () => {
  const res = run({ RecordType: 'AdminAudienceExport', List: 'buyers' }, { orders: ORDERS });
  const rina = res.rows.find((r) => r.phone === '8801711111111');
  assert.deepEqual(rina, { phone: '8801711111111', fn: 'Rina', ln: 'Akter', country: 'bd', value: 3500 });
  assert.equal(res.rows.length, 2);
});

test('exclude list has Fake, blocked and repeat cancellers; they never appear in other lists', () => {
  const blocked = { '01722222222': true };
  const ex = run({ RecordType: 'AdminAudienceExport', List: 'exclude' }, { orders: ORDERS, blocked });
  assert.deepEqual(ex.rows.map((r) => r.phone).sort(), ['8801722222222', '8801733333333', '8801755555555']);
  const all = run({ RecordType: 'AdminAudienceExport', List: 'all' }, { orders: ORDERS, blocked });
  assert.deepEqual(all.rows.map((r) => r.phone).sort(), ['8801711111111', '8801744444444']);
});

test('Months limits the period, but an old Fake order still excludes the phone', () => {
  const orders = ORDERS.concat([orderRow('2025-01-01', 'Old Faker', '01766666666', 500, 'Fake'), orderRow('2026-11-10', 'Old Faker', '01766666666', 500, 'Delivered')]);
  const res = run({ RecordType: 'AdminAudienceExport', List: 'repeat', Months: '3' }, { orders });
  assert.deepEqual(res.rows, []); // Rina's first delivery is older than 3 months
  const buyers = run({ RecordType: 'AdminAudienceExport', List: 'buyers', Months: '3' }, { orders });
  assert.ok(!buyers.rows.some((r) => r.phone === '8801766666666'));
});

test('abandoned checkout only when no order came from that phone afterwards', () => {
  const carts = [
    ['01799999999', 'New Visitor', 'Abaya', 1500, '2026-11-20', '2026-11-20', 'open'],
    ['01744444444', 'Nusrat Jahan', 'Abaya', 1100, '2026-11-01', '2026-11-01', 'open'], // ordered on 11-04
    ['01733333333', 'Fake Guy', 'Abaya', 900, '2026-11-20', '2026-11-20', 'open'],     // excluded phone
  ];
  const res = run({ RecordType: 'AdminAudienceExport', List: 'abandoned' }, { orders: ORDERS, carts });
  assert.deepEqual(res.rows.map((r) => r.phone), ['8801799999999']);
});
