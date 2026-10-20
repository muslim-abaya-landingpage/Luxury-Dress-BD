const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../apps-script/OrderSync.gs'), 'utf8');

function fakeSheet(values) {
  const sheet = {
    values: values.map(r => r.slice()),
    writes: 0,
    getDataRange: () => ({ getValues: () => sheet.values.map(r => r.slice()) }),
    getMaxColumns: () => Math.max(1, ...sheet.values.map(r => r.length)),
    getMaxRows: () => Math.max(1000, sheet.values.length),
    getLastRow: () => sheet.values.length,
    insertColumnsAfter() {}, insertRowsAfter() {}, clearContents() { sheet.values = []; },
    setFrozenRows() {}, autoResizeColumns() {},
    getRange(row, col, numRows, numCols) {
      return {
        setValues(rows) {
          sheet.writes++;
          rows.forEach((r, i) => { sheet.values[row - 1 + i] = r.slice(); });
          return this;
        },
        setFontWeight() { return this; },
        setNumberFormat() { return this; },
      };
    },
  };
  return sheet;
}

function setup(sourceRows, mirrorRows) {
  const header = ['Time', 'Name', 'Phone', 'Qty', 'Ship', 'Addr', 'Product', 'Size', 'Total', 'অর্ডার আইডি', 'Status'];
  const src = fakeSheet([header, ...sourceRows]);
  const mirror = fakeSheet(mirrorRows ? [header, ...mirrorRows] : []);
  const props = {};
  const alerts = [];
  const sandbox = {
    console: { log() {}, error() {} },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: k => (k in props ? props[k] : null),
      setProperty: (k, v) => { if (String(v).length > 9 * 1024) throw new Error('Argument too large'); props[k] = String(v); },
    }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getId: () => 'SRC', getSheetByName: n => (n === 'Online Order' ? src : null) }),
      openById: () => ({ getId: () => 'MIRROR', getName: () => 'Mirror', getSheetByName: n => (n === 'OrderSync' ? mirror : null), insertSheet: () => fakeSheet([]) }),
    },
    MailApp: { sendEmail: m => alerts.push(m.subject) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200 }) },
    getAdminNotifyEmails_: () => ['owner@example.com'],
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { sandbox, src, mirror, props, alerts };
}

const order = i => ['t', 'C' + i, '017', 1, 80, 'a', 'p', '', 500, 'MA-' + i, 'Pending'];

test('first fill copies all orders in one write and sends no alerts', () => {
  const env = setup(Array.from({ length: 900 }, (_, i) => order(i)), null);
  const result = env.sandbox.runOrderSyncNow();
  assert.equal(result.added, 900);
  assert.equal(result.initialFill, true);
  assert.equal(env.alerts.length, 0);
  assert.equal(env.mirror.values.length, 901);
  assert.ok(env.mirror.writes <= 3, `expected batched writes, got ${env.mirror.writes}`);
});

test('later runs alert only genuinely new orders and update existing rows in place', () => {
  const existing = Array.from({ length: 50 }, (_, i) => order(i));
  const changed = existing.map(r => r.slice());
  changed[3][10] = 'Shipped';
  const env = setup([...changed, order(50), order(51)], existing);
  const result = env.sandbox.runOrderSyncNow();
  assert.equal(result.added, 2);
  assert.equal(result.updated, 50);
  assert.deepEqual(env.alerts, ['নতুন অর্ডার — MA-50', 'নতুন অর্ডার — MA-51']);
  assert.equal(env.mirror.values[4][10], 'Shipped');
});

test('a burst of new orders is capped at 10 alerts per run', () => {
  const existing = [order(0)];
  const env = setup([order(0), ...Array.from({ length: 25 }, (_, i) => order(100 + i))], existing);
  env.sandbox.runOrderSyncNow();
  assert.equal(env.alerts.length, 10);
});

test('alerted-order log stays under the 9 KB script-property limit', () => {
  const env = setup([], null);
  for (let i = 0; i < 1000; i++) env.sandbox.sendNewOrderAlertOnce_('MA-20261020-' + i, 'x');
  assert.equal(env.alerts.length, 1000);
  assert.ok(env.props.ORDERSYNC_ALERTED_ORDER_IDS.length < 9 * 1024);
  env.sandbox.sendNewOrderAlertOnce_('MA-20261020-999', 'x');
  assert.equal(env.alerts.length, 1000, 'recent order must not be alerted twice');
});

test('in-cell images are mirrored as their URL instead of crashing setValues', () => {
  const img = { toBuilder() {}, getUrl: () => 'https://example.com/a.jpg', getContentUrl: () => 'x' };
  const noUrl = { toBuilder() {}, getUrl: () => null, getContentUrl: () => null };
  const row = order(1); row[8] = img; row[9] = 'MA-1'; row[7] = noUrl;
  const env = setup([row], null);
  env.sandbox.runOrderSyncNow();
  assert.equal(env.mirror.values[1][8], 'https://example.com/a.jpg');
  assert.equal(env.mirror.values[1][7], '[image]');
  const d = new Date(2026, 0, 1);
  assert.equal(env.sandbox.mirrorSafeValue_(d), d);
});
