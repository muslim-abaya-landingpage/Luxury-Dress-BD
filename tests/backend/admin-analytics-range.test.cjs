const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8');
const helpers = source.match(/function bdIsValidDateKey_[\s\S]*?function bdRangeBounds_\([\s\S]*?\n\}/m);
assert.ok(helpers, 'Could not locate analytics date-bound helpers in Code.gs');
const fixedNow = Date.UTC(2026, 9, 18, 0, 30, 0);
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static UTC(...args) { return Date.UTC(...args); }
}
function formatDhaka(date) {
  const shifted = new Date(date.getTime() + 6 * 60 * 60 * 1000);
  const pad = value => String(value).padStart(2, '0');
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}
const sandbox = {
  Date: FixedDate,
  Number,
  String,
  Math,
  Utilities: { formatDate: formatDhaka }
};
vm.runInNewContext(helpers[0] + '\nthis.bdRangeBounds_ = bdRangeBounds_; this.bdIsValidDateKey_ = bdIsValidDateKey_;', sandbox);
const today = formatDhaka(new FixedDate());

test('all range covers the full dated history through Bangladesh today', () => {
  const result = sandbox.bdRangeBounds_('all', '', '');
  assert.equal(result.all, true);
  assert.equal(result.fromKey, '');
  assert.equal(result.toKey, today);
});

test('custom range accepts valid inclusive date keys and rejects malformed dates', () => {
  const valid = sandbox.bdRangeBounds_('custom', '2026-10-01', '2026-10-18');
  assert.equal(valid.ok, undefined);
  assert.equal(valid.fromKey, '2026-10-01');
  assert.equal(valid.toKey, '2026-10-18');
  assert.equal(sandbox.bdRangeBounds_('custom', '2026-02-30', '2026-03-02').error, 'INVALID_DATE_RANGE');
  assert.equal(sandbox.bdRangeBounds_('custom', '2026-10-19', '2026-10-18').error, 'INVALID_DATE_RANGE');
});

test('unknown range keeps the legacy today fallback', () => {
  const result = sandbox.bdRangeBounds_('unknown', '', '');
  assert.equal(result.fromKey, today);
  assert.equal(result.toKey, today);
  assert.equal(result.all, false);
});

test('analytics response includes monthly sales and undated-order disclosure fields', () => {
  assert.match(source, /salesByMonth:\s*salesByMonth/);
  assert.match(source, /undatedOrderCount:\s*undatedOrderCount/);
});

test('lifetime analytics includes all dated and undated orders and groups valid dates by month', () => {
  const analytics = source.match(/function getAdminAnalyticsV2_\(e\)[\s\S]*?^\}/m);
  assert.ok(analytics, 'Could not locate getAdminAnalyticsV2_');
  const makeRow = ({ time, name, phone, total, status, cart, sourceName }) => {
    const row = Array(37).fill('');
    row[0] = time; row[1] = name; row[2] = phone; row[7] = String(total); row[9] = status;
    row[32] = cart ? JSON.stringify(cart) : ''; row[36] = sourceName || '';
    return row;
  };
  const rows = [Array(37).fill('header'),
    makeRow({ time: '15-12-2025 10:00:00', name: 'A', phone: '01000000001', total: 1000, status: 'Confirmed', cart: [{ id: 'p1', name: 'Abaya', qty: 1 }] }),
    makeRow({ time: '17-10-2026 11:00:00', name: 'B', phone: '01000000002', total: 1200, status: 'Delivered', cart: [{ id: 'p1', name: 'Abaya', qty: 2 }], sourceName: 'Facebook' }),
    makeRow({ time: '', name: 'C', phone: '01000000003', total: 500, status: 'Pending' }),
    makeRow({ time: '19-10-2026 11:00:00', name: 'Future', phone: '01000000004', total: 900, status: 'Pending' }),
    makeRow({ time: '17-10-2026 11:00:00', name: '', phone: '', total: 400, status: 'Pending' })
  ];
  const testSandbox = {
    Date: FixedDate,
    Number,
    String,
    Math,
    Utilities: { formatDate: formatDhaka },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => ({}) }) },
    param_: (event, key) => event[key] || '',
    verifyAdminSession_: () => ({ ok: true }),
    readOnlineOrderRows_: () => rows,
    dayKeyFromCell_: value => {
      const match = String(value || '').match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
      return match ? `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}` : '';
    },
    isReturnKeywordStatus_: value => /return|ফেরত|refund/i.test(String(value || '')),
    isPlainCancelStatus_: value => /cancel|বাতিল/i.test(String(value || '')),
    ensureStockVariantsSheet_: () => ({ getDataRange: () => ({ getValues: () => [['Product ID']] }) }),
    STOCK_LOW_DEFAULT_THRESHOLD_: 5
  };
  vm.runInNewContext(helpers[0] + '\n' + analytics[0] + '\nthis.runAnalytics = getAdminAnalyticsV2_;', testSandbox);
  const result = testSandbox.runAnalytics({ Token: 'valid', Range: 'all' });
  assert.equal(result.ok, true);
  assert.equal(result.summary.totalOrders, 3);
  assert.equal(result.summary.totalOrderValue, 2700);
  assert.equal(result.summary.deliveredSalesValue, 1200);
  assert.equal(result.undatedOrderCount, 1);
  assert.deepEqual(Array.from(result.salesByMonth, row => row.month), ['2025-12', '2026-10']);
  assert.equal(result.salesByMonth[1].deliveredOrders, 1);
});
