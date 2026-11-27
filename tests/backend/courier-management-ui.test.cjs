'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('courier management page is admin-guarded and links into existing admin workspace', () => {
  const html = read('courier-management.html');
  assert.match(html, /data-admin-guard="1"/);
  assert.match(html, /admin-guard\.js/);
  assert.match(html, /admin-api\.js/);
  assert.match(html, /admin-orders\.html/);
  assert.match(html, /courier-management\.js/);
});

test('courier workspace uses only existing authenticated courier/order APIs', () => {
  const js = read('courier-management.js');
  for (const type of ['AdminOrderList', 'AdminSendCourier', 'AdminCourierTracking', 'AdminCourierPerformance']) {
    assert.ok(js.includes("'" + type + "'"), 'missing API contract: ' + type);
  }
  assert.match(js, /MaAdmin\.getCourierRates/);
  assert.match(js, /MaAdmin\.saveCourierRates/);
  assert.match(js, /MaAdminGuard\.require/);
  assert.match(js, /isReady\(o\)/);
  assert.match(js, /window\.confirm/);
  assert.match(js, /escape|esc\(/);
});

test('unsupported Pathao and RedX parcel creation is not presented as enabled', () => {
  const html = read('courier-management.html');
  assert.match(html, /তুলনার জন্য/);
  assert.match(html, /API-তে পার্সেল পাঠানো এখনো সংযুক্ত নয়/);
});


test('Scan to Return refuses to re-record an order that is already Cancelled/Fake instead of duplicating the admin note', () => {
  const js = read('courier-management.js');
  assert.match(js, /\^\(cancelled\|fake\)\$/);
  assert.match(js, /ইতিমধ্যে ফেরত\/বাতিল হিসেবে রেকর্ড করা আছে/);
});

test('Scan to Return warns when stock was not auto-restored (order was already Delivered)', () => {
  const js = read('courier-management.js');
  assert.match(js, /wasDelivered/);
  assert.match(js, /স্টক স্বয়ংক্রিয়ভাবে ফেরত আসেনি/);
});

test('the on-page Scan to Return note no longer overclaims unconditional stock restore', () => {
  const html = read('courier-management.html');
  assert.doesNotMatch(html, /Scan to Return অর্ডারটিকে "Cancelled" করে Admin Note-এ ফেরতের নোট যোগ করবে এবং স্টক আবার ফিরিয়ে দেবে।/);
  assert.match(html, /আগে Delivered থাকলে স্টক অটো ফেরত আসে না/);
});

test('the COD footer note no longer claims settlement reconciliation is still unbuilt', () => {
  const html = read('courier-management.html');
  assert.doesNotMatch(html, /পরবর্তী ধাপে যুক্ত হবে/);
});

test('Scan to Return offers a return-reason selector that is only shown in Return mode, and is folded into the admin note', () => {
  const html = read('courier-management.html');
  const js = read('courier-management.js');
  assert.ok(html.includes('id="cmReturnReason"'));
  assert.match(html, /id="cmReturnReasonLabel" hidden/);
  assert.match(js, /cmReturnReasonLabel'\)\.hidden = state\.scanMode !== 'return'/);
  assert.match(js, /cmReturnReason'\)/);
});

test('orders table offers a client-side CSV export of the currently filtered/visible rows', () => {
  const html = read('courier-management.html');
  const js = read('courier-management.js');
  assert.ok(html.includes('id="cmExportCsv"'));
  assert.match(js, /function exportCsv\(\)/);
  assert.match(js, /visibleOrders\(\)/);
  assert.match(js, /text\/csv/);
  assert.match(js, /cmExportCsv'\)\.addEventListener\('click', exportCsv\)/);
});

test('orders table supports selecting ready orders and bulk-sending them to Steadfast one at a time', () => {
  const html = read('courier-management.html');
  const js = read('courier-management.js');
  assert.ok(html.includes('id="cmBulkToggleAll"'));
  assert.ok(html.includes('id="cmBulkSend"'));
  assert.ok(html.includes('id="cmBulkMessage"'));
  assert.match(js, /function bulkSendSelected\(\)/);
  assert.match(js, /cm-bulk-check/);
  assert.match(js, /'AdminSendCourier'/);
  // the actual sends are sequential, chained via .then(next) inside runBulkSend, not a Promise.all of AdminSendCourier calls
  assert.match(js, /function runBulkSend\(ids\)/);
  assert.doesNotMatch(js, /Promise\.all\(ids\.map\(function \(id\) \{\s*return MaAdmin\.call\('AdminSendCourier'/);
  assert.match(js, /cmBulkSend'\)\.addEventListener\('click', bulkSendSelected\)/);
});

test('bulk selection only ever targets ready (not-yet-shipped) orders', () => {
  const js = read('courier-management.js');
  assert.match(js, /check = ready\s*\n\s*\? '<input type="checkbox" class="cm-bulk-check"/);
});

test('sending to Steadfast (single or bulk) checks fraud risk via the existing AdminFraudCheck endpoint and surfaces it before sending', () => {
  const js = read('courier-management.js');
  assert.match(js, /'AdminFraudCheck'/);
  assert.match(js, /function riskWarningLines\(fraud\)/);
  assert.match(js, /fraud\.blocked \|\| fraud\.risk === 'high' \|\| fraud\.risk === 'medium'/);
  // the fraud check happens before the confirm/send, not after
  assert.match(js, /MaAdmin\.call\('AdminFraudCheck', \{ Phone: order\.phone, OrderId: order\.orderId \}\)[\s\S]{0,200}window\.confirm/);
  assert.match(js, /Promise\.all\(ids\.map/);
});

test('COD settlement workspace exposes reconciled totals, partial settlement and recent ledger', () => {
  const html = read('courier-management.html');
  const js = read('courier-management.js');
  for (const id of ['cmSetDue', 'cmSetReceived', 'cmSetOutstanding', 'cmSettlementRows', 'cmSettlementRecent', 'cmSettlementDialog']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing settlement UI: ' + id);
  }
  assert.ok(js.includes("'AdminCourierSettlementList'"));
  assert.ok(js.includes("'AdminCourierSettlementSave'"));
  assert.ok(js.includes('data-settle='));
  assert.ok(js.includes('SettlementDate'));
});
