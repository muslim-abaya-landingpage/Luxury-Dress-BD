const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = f => fs.readFileSync(path.join(root, 'apps-script', f), 'utf8');
const CODE = read('Code.gs'), ADM = read('AdminOrders.gs'), MON = read('Monitor.gs');
function extractFrom(source, name) {
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

const formatCell_ = v => String(v || '');
const normalizePhone_ = p => { let s = String(p || '').replace(/\D/g, ''); if (s.length === 10 && s[0] === '1') s = '0' + s; return s; };
function historyRows(list) { return list.map(([phone, status]) => ['t', 'n', phone, '', '', '', '', '500', 'ID' + Math.random(), status, '', '', '']); }

test('second Fake order on a number blocks it automatically; first does not', () => {
  const appended = [];
  const box = { normalizePhone_, formatCell_, admReadHistory_: () => rows, admBlockedMap_: () => ({}), admBlockedSheet_: () => 'BLOCKED',
    appendRow_: (sh, v) => appended.push([sh, v]) };
  let rows = historyRows([['01711111111', 'Fake']]);
  vm.createContext(box);
  vm.runInContext([extractFrom(ADM, 'admNum_'), extractFrom(ADM, 'admHistoryForPhone_'), 'var ADM_AUTO_BLOCK_FAKE_COUNT = 2;', extractFrom(ADM, 'admAutoBlockRepeatFake_')].join('\n'), box);
  assert.equal(box.admAutoBlockRepeatFake_(null, '01711111111'), 'BELOW_THRESHOLD');
  rows = historyRows([['01711111111', 'Fake'], ['01711111111', 'Fake'], ['01822222222', 'Delivered']]);
  assert.equal(box.admAutoBlockRepeatFake_(null, '01711111111'), 'BLOCKED');
  assert.equal(appended[0][1][0], '01711111111');
  assert.equal(appended[0][1][3], 'auto');
  box.admBlockedMap_ = () => ({ '01711111111': 'x' });
  assert.equal(box.admAutoBlockRepeatFake_(null, '01711111111'), 'ALREADY_BLOCKED');
});

test('new order from a risky number gets a warning in Admin Note; clean numbers do not', () => {
  const written = {};
  const sheet = { getRange: (r, c) => ({ getValue: () => written[r] || '', setValue: v => { written[r] = v; } }) };
  const box = { normalizePhone_, formatCell_, onlineOrderColumn_: (s, c) => c, ADM_COL_ADMIN_NOTE: 40, admReadHistory_: () => rows };
  let rows = historyRows([['01711111111', 'Fake'], ['01711111111', 'Delivered'], ['01933333333', 'Delivered']]);
  vm.createContext(box);
  vm.runInContext(extractFrom(ADM, 'admNum_') + '\n' + extractFrom(ADM, 'admHistoryForPhone_') + '\n' + extractFrom(CODE, 'flagNewOrderRisk_'), box);
  const line = box.flagNewOrderRisk_(sheet, 55, '01711111111', 'NEW');
  assert.match(line, /ঝুঁকি বেশি/);
  assert.match(written[55], /Fake 1/);
  assert.equal(box.flagNewOrderRisk_(sheet, 56, '01933333333', 'NEW'), '');
  assert.equal(written[56], undefined);
});

test('manual order uses the existing mini-order flow and records who added it', () => {
  let captured = null;
  const params = { Token: 't', Name: 'Rahim', Phone: '01711111111', District: 'ঢাকা', Address: 'House 1, Road 2, Dhaka', Design: 'Kurti × 1', Qty: '1', Total: '630', Payment: 'Cash On Delivery', Notes: 'call first' };
  const box = { normalizePhone_, formatCell_, param_: (e, k) => params[k], verifyAdminSession_: () => ({ ok: true, email: 'staff@x.com' }),
    admBlockedMap_: () => ({}), admCellText_: (v, n) => String(v == null ? '' : v).slice(0, n),
    submitWhatsappMiniOrder: p => { captured = p; return { ok: true, orderId: 'MA-1', row: 55 }; } };
  vm.createContext(box);
  vm.runInContext(extractFrom(ADM, 'adminManualOrderCreate_'), box);
  const res = box.adminManualOrderCreate_({});
  assert.equal(res.orderId, 'MA-1');
  assert.equal(captured.sendCourierNow, false);
  assert.match(captured.notes, /call first \| যোগ করেছেন: staff@x.com/);
  box.admBlockedMap_ = () => ({ '01711111111': 'x' });
  assert.equal(box.adminManualOrderCreate_({}).error, 'PHONE_BLOCKED');
  params.AllowBlocked = '1';
  assert.equal(box.adminManualOrderCreate_({}).ok, true);
  box.verifyAdminSession_ = () => ({ ok: false, error: 'NOT_ADMIN' });
  assert.equal(box.adminManualOrderCreate_({}).error, 'NOT_ADMIN');
});

test('uptime monitor alerts once after 2 failures and once on recovery', () => {
  const props = {}, sent = [];
  let code = 500;
  const box = { console: { log() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => code }) },
    sendAdminAndTelegramNotification_: (s) => sent.push(s) };
  vm.createContext(box);
  vm.runInContext(MON, box);
  box.siteUptimeCheck(); assert.equal(sent.length, 0, 'one failure is not enough');
  box.siteUptimeCheck(); assert.equal(sent.length, 1);
  box.siteUptimeCheck(); assert.equal(sent.length, 1, 'no repeat while still down');
  code = 200;
  box.siteUptimeCheck(); assert.equal(sent.length, 2);
  assert.match(sent[1], /আবার চালু/);
  box.siteUptimeCheck(); assert.equal(sent.length, 2);
});
