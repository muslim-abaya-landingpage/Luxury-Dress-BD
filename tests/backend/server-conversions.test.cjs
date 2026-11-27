// Server-side GA4 Purchase on Confirmed + cancel/return events (apps-script/ServerConversions.gs).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const codeGs = fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8');
const scGs = fs.readFileSync(path.join(__dirname, '../../apps-script/ServerConversions.gs'), 'utf8');
const pick = (name) => { const m = codeGs.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}', 'm')); assert.ok(m, name); return m[0]; };
const code = [
  'var ONLINE_ORDER_TRACKING_CLIENT_COL = 39;', "var ONLINE_ORDER_TRACKING_CLIENT_HEADER = 'Tracking Client';",
  pick('cleanTrackingClientIp_'), pick('cleanTrackingClientUa_'), pick('saveOnlineOrderTrackingClient_'),
  pick('readOnlineOrderTrackingInfo_'), pick('setOnlineOrderTrackingFlags_'), pick('parseOrderValue_'), scGs,
].join('\n');

const COLS = 40;
function fakeSheet() {
  const rows = [Array(COLS).fill('')];
  rows[0][38] = 'Tracking Client';
  return {
    rows,
    getMaxColumns: () => COLS,
    getLastRow: () => rows.length,
    insertColumnsAfter() {},
    getRange(r, c, nr = 1, nc = 1) {
      const cell = (rr, cc) => ((rows[rr - 1] || [])[cc - 1] === undefined ? '' : rows[rr - 1][cc - 1]);
      return {
        getValue: () => cell(r, c),
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => cell(r + i, c + j))),
        setValue: (v) => { while (rows.length < r) rows.push(Array(COLS).fill('')); rows[r - 1][c - 1] = v; },
      };
    },
  };
}

function setup(props = { GA4_API_SECRET: 'sec' }) {
  const sheet = fakeSheet();
  const calls = [];
  const ctx = {
    Date, JSON, Math, Number, String, Array, Object, isFinite, parseInt, parseFloat, encodeURIComponent,
    console: { error() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || '' }) },
    UrlFetchApp: { fetch: (url, opt) => { calls.push({ url, body: JSON.parse(opt.payload) }); return { getResponseCode: () => 204 }; } },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
    SHA256_Hash: (s) => crypto.createHash('sha256').update(String(s)).digest('hex'),
    onlineOrderColumn_: (_s, c) => c,
    normalizePhone_: (p) => p,
    readOnlineOrderRows_: (s, row, n) => s.rows.slice(row - 1, row - 1 + n).map((r) => r.slice(0, 17)),
    sendToFacebookCAPI: (data, id, name) => { calls.push({ meta: name, id }); return { ok: true, code: 'OK' }; },
  };
  vm.runInNewContext(code + '\nthis.api = { saveOnlineOrderTrackingClient_, sendGa4ConfirmedPurchaseForRow_, serverConversionsRefundSweep_, readOnlineOrderTrackingInfo_ };', ctx);
  return { sheet, calls, api: ctx.api };
}

function addOrder(sheet, status, notes) {
  const r = Array(COLS).fill('');
  r[1] = 'Rina'; r[2] = '01711111111'; r[7] = '৳1,850'; r[8] = 'MA-100'; r[9] = status; r[16] = notes || '';
  r[32] = JSON.stringify([{ id: 'p1', name: 'Abaya', qty: 2, price: 900, size: 'M', category: 'abaya' }]);
  sheet.rows.push(r);
  return sheet.rows.length;
}

test('new order stores GA ids and v2 marker; bad ids are dropped', () => {
  const { sheet, api } = setup();
  const row = addOrder(sheet, 'Pending');
  api.saveOnlineOrderTrackingClient_(sheet, row, '1.2.3.4', 'UA', { clientId: '123.456', sessionId: '1700000000' });
  const info = JSON.parse(sheet.rows[row - 1][38]);
  assert.equal(info.v, 2); assert.equal(info.gc, '123.456'); assert.equal(info.gs, '1700000000'); assert.equal(info.ip, '1.2.3.4');
  api.saveOnlineOrderTrackingClient_(sheet, row, '', '', { clientId: '<x>', sessionId: 'abc' });
  const info2 = JSON.parse(sheet.rows[row - 1][38]);
  assert.equal(info2.v, 2); assert.equal(info2.gc, undefined); assert.equal(info2.gs, undefined);
});

test('Confirmed v2 order sends one GA4 purchase with items, value and session; never twice', () => {
  const { sheet, calls, api } = setup();
  const row = addOrder(sheet, 'Confirmed');
  api.saveOnlineOrderTrackingClient_(sheet, row, '', '', { clientId: '123.456', sessionId: '1700000000' });
  const vals = sheet.rows[row - 1].slice(0, 17);
  assert.equal(api.sendGa4ConfirmedPurchaseForRow_(sheet, row, vals).code, 'OK');
  assert.equal(api.sendGa4ConfirmedPurchaseForRow_(sheet, row, vals).code, 'ALREADY_SENT');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /measurement_id=G-L2BNEXE0XG&api_secret=sec/);
  const b = calls[0].body;
  assert.equal(b.client_id, '123.456');
  const ev = b.events[0];
  assert.equal(ev.name, 'purchase');
  assert.equal(ev.params.transaction_id, 'MA-100');
  assert.equal(ev.params.value, 1850);
  assert.equal(ev.params.session_id, '1700000000');
  assert.deepEqual(ev.params.items[0], { quantity: 2, item_id: 'p1', item_name: 'Abaya', price: 900, item_category: 'abaya', item_variant: 'M' });
  assert.ok(b.timestamp_micros, 'recent order is back-dated to order time');
});

test('old orders (no v2) and missing secret send nothing; missing client id uses a stable fallback', () => {
  const s1 = setup();
  const old = addOrder(s1.sheet, 'Confirmed');
  s1.sheet.rows[old - 1][38] = JSON.stringify({ ip: '1.2.3.4' });
  assert.equal(s1.api.sendGa4ConfirmedPurchaseForRow_(s1.sheet, old, s1.sheet.rows[old - 1]).code, 'GA4_OLD_ORDER');
  const s2 = setup({});
  const r2 = addOrder(s2.sheet, 'Confirmed');
  s2.api.saveOnlineOrderTrackingClient_(s2.sheet, r2, '', '', {});
  assert.equal(s2.api.sendGa4ConfirmedPurchaseForRow_(s2.sheet, r2, s2.sheet.rows[r2 - 1]).code, 'GA4_CONFIG_MISSING');
  assert.equal(s2.calls.length, 0);
  const s3 = setup();
  const r3 = addOrder(s3.sheet, 'Confirmed');
  s3.api.saveOnlineOrderTrackingClient_(s3.sheet, r3, '', '', {});
  s3.api.sendGa4ConfirmedPurchaseForRow_(s3.sheet, r3, s3.sheet.rows[r3 - 1]);
  assert.match(s3.calls[0].body.client_id, /^\d+\.\d+$/);
});

test('refund sweep: reported order that is now Cancelled gets GA4 refund + Meta OrderCancelled once', () => {
  const { sheet, calls, api } = setup();
  const row = addOrder(sheet, 'Confirmed', 'CAPI_OK | META_PURCHASE_SENT');
  api.saveOnlineOrderTrackingClient_(sheet, row, '', '', { clientId: '123.456' });
  api.sendGa4ConfirmedPurchaseForRow_(sheet, row, sheet.rows[row - 1]);
  sheet.rows[row - 1][9] = 'Cancelled';
  const res = api.serverConversionsRefundSweep_();
  assert.equal(res.sent, 1);
  const refund = calls.find((c) => c.body && c.body.events[0].name === 'refund');
  assert.equal(refund.body.events[0].params.transaction_id, 'MA-100');
  assert.ok(calls.find((c) => c.meta === 'OrderCancelled' && c.id === 'cancel_MA-100'));
  const before = calls.length;
  assert.equal(api.serverConversionsRefundSweep_().sent, 0);
  assert.equal(calls.length, before);
});

test('refund sweep skips delivered orders, never-reported orders and old (pre-v2) orders', () => {
  const { sheet, calls, api } = setup();
  const delivered = addOrder(sheet, 'Delivered', 'META_PURCHASE_SENT');
  api.saveOnlineOrderTrackingClient_(sheet, delivered, '', '', {});
  const notReported = addOrder(sheet, 'Cancelled', '');
  api.saveOnlineOrderTrackingClient_(sheet, notReported, '', '', {});
  const old = addOrder(sheet, 'Cancelled', 'META_PURCHASE_SENT');
  sheet.rows[old - 1][38] = JSON.stringify({ ip: '1.2.3.4' });
  const res = api.serverConversionsRefundSweep_();
  assert.equal(res.sent, 0);
  // The delivered order gets only its OrderDelivered event, never a cancel/refund.
  assert.deepEqual(calls.map((c) => c.meta), ['OrderDelivered']);
});

test('delivered orders send OrderDelivered once, also when only the courier says Delivered; old orders never', () => {
  const { sheet, calls, api } = setup();
  const byStatus = addOrder(sheet, 'Delivered', '');
  api.saveOnlineOrderTrackingClient_(sheet, byStatus, '', '', {});
  const byCourier = addOrder(sheet, 'Shipped', '');
  sheet.rows[byCourier - 1][8] = 'MA-101'; sheet.rows[byCourier - 1][12] = 'Delivered';
  api.saveOnlineOrderTrackingClient_(sheet, byCourier, '', '', {});
  const old = addOrder(sheet, 'Delivered', '');
  sheet.rows[old - 1][38] = JSON.stringify({ ip: '1.2.3.4' });
  assert.equal(api.serverConversionsRefundSweep_().delivered, 2);
  assert.deepEqual(calls.map((c) => c.id).sort(), ['delivered_MA-100', 'delivered_MA-101']);
  assert.equal(api.serverConversionsRefundSweep_().delivered, 0); // flag dv stops a second send
  assert.equal(calls.length, 2);
});
