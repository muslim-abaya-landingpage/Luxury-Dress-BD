const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '../../apps-script');
const code = fs.readFileSync(path.join(dir, 'Code.gs'), 'utf8');
const profitSrc = fs.readFileSync(path.join(dir, 'ProductProfit.gs'), 'utf8');
const activitySrc = fs.readFileSync(path.join(dir, 'ActivityLog.gs'), 'utf8');
const setupSrc = fs.readFileSync(path.join(dir, 'SetupStatus.gs'), 'utf8');
const pick = (src, name) => { const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}', 'm')); assert.ok(m, name); return m[0]; };

function profitSandbox() {
  const sandbox = { Number, String, Math, JSON, Object, Array, parseInt, parseFloat, isFinite,
    dayKeyFromCell_: v => { const m = String(v || '').match(/^(\d{1,2})-(\d{1,2})-(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; } };
  vm.runInNewContext(pick(code, 'bdIsValidDateKey_') + '\n' + pick(profitSrc, 'productProfitFromRows_') + '\nthis.run = productProfitFromRows_;', sandbox);
  return sandbox;
}
const row = (time, status, cart) => { const r = Array(37).fill(''); r[0] = time; r[1] = 'N'; r[2] = '01700000000'; r[9] = status; r[32] = JSON.stringify(cart); return r; };

test('per-product profit counts delivered lines and uses private buying prices', () => {
  const rows = [Array(37).fill('h'),
    row('02-11-2026 10:00', 'Delivered', [{ id: 'A', name: 'Abaya', qty: 2, price: 1500 }, { id: 'B', name: 'Hijab', qty: 1, price: 300 }]),
    row('03-11-2026 10:00', 'Confirmed', [{ id: 'A', name: 'Abaya', qty: 1, price: 1500 }]),
    row('04-11-2026 10:00', 'Cancelled', [{ id: 'A', name: 'Abaya', qty: 5, price: 1500 }]),
    row('01-10-2026 10:00', 'Delivered', [{ id: 'A', name: 'Abaya', qty: 9, price: 1500 }])];
  const bounds = { fromKey: '2026-11-01', toKey: '2026-11-06' };
  const r = Array.from([profitSandbox().run(rows, bounds, 'custom', 'delivered', { A: 1000 })])[0];
  assert.equal(r.orders, 1);
  const a = r.products.find(p => p.productId === 'A');
  assert.equal(a.qty, 2); assert.equal(a.sales, 3000); assert.equal(a.profit, 1000); assert.equal(a.margin, 33.3);
  const b = r.products.find(p => p.productId === 'B');
  assert.equal(b.profit, null);
  assert.equal(r.totals.missingCost, 1);
  assert.equal(r.totals.profit, 1000);
  const withConfirmed = profitSandbox().run(rows, bounds, 'custom', 'confirmed', { A: 1000 });
  assert.equal(withConfirmed.products.find(p => p.productId === 'A').qty, 3);
});

test('activity log only records whitelisted changes and never the token or file content', () => {
  assert.match(activitySrc, /response\.ok !== true\) return/);
  assert.doesNotMatch(activitySrc.match(/ADMIN_ACTIVITY_FIELDS_ = \[[\s\S]*?\];/)[0], /'Token'|'Password'|'Content'|'Payload'/);
  assert.match(code, /if \(typeof adminActivityRequest_ !== 'undefined'\) adminActivityRequest_ = e;/);
  assert.match(code, /if \(typeof adminActivityLog_ === 'function'\)/);
  const appended = [];
  const sheet = { appendRow: r => appended.push(r), getRange: () => ({ setValues() {} }), setFrozenRows() {} };
  const sandbox = { String, Object, JSON, Array, console,
    param_: (e, k) => (e.parameter[k] == null ? '' : e.parameter[k]),
    verifyAdminSession_: () => ({ ok: true, email: 'staff@x.com', role: 'staff' }),
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
    Utilities: { formatDate: () => '2026-11-06 10:00:00' } };
  vm.runInNewContext(activitySrc + '\nthis.log = adminActivityLog_; this.setReq = function (e) { adminActivityRequest_ = e; adminActivityDone_ = false; };', sandbox);
  sandbox.setReq({ parameter: { RecordType: 'AdminOrderList', Token: 'secret' } });
  sandbox.log({ ok: true });
  sandbox.setReq({ parameter: { RecordType: 'AdminOrderUpdate', Token: 'secret', OrderId: 'MA-1', Status: '=HYPERLINK("x")' } });
  sandbox.log({ ok: false });
  sandbox.log({ ok: true });
  assert.equal(appended.length, 1);
  assert.equal(appended[0][1], 'staff@x.com');
  assert.equal(appended[0][3], 'AdminOrderUpdate');
  assert.equal(appended[0][4], 'MA-1');
  assert.ok(!appended[0].join('|').includes('secret'));
  assert.match(appended[0][5], /Status='=HYPERLINK/);
});

test('setup status reports whether secrets are set, never their values', () => {
  const fn = pick(setupSrc, 'getAdminSetupStatus_');
  assert.doesNotMatch(fn, /getProperty\('(TELEGRAM_BOT_TOKEN|STEADFAST_API_KEY|GITHUB_TOKEN|META_ACCESS_TOKEN)'\)/);
  assert.match(fn, /requireOwnerAdmin_/);
  assert.match(pick(setupSrc, 'runAdminSetupAction_'), /hasOwnProperty\.call\(SETUP_ACTIONS_, name\)/);
});


test('Messenger Page token save is owner-only, Page-scoped, and never returns the secret', () => {
  const fn = pick(setupSrc, 'saveMessengerPageToken_');
  assert.ok(fn.includes('verifyAdminSession_'));
  assert.ok(fn.includes('requireOwnerAdmin_'));
  assert.ok(fn.includes('Object.prototype.hasOwnProperty.call(MSGR_PAGES, pageId)'));
  assert.ok(fn.includes('String(body.id) !== pageId'));
  assert.ok(fn.includes("setProperty('MSGR_PAGE_TOKEN_' + pageId, accessToken)"));
  assert.ok(!fn.includes('console.log(accessToken)'));
  assert.ok(code.includes("type === 'AdminMessengerTokenSave'"));
});
