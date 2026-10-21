// Cloudflare fast read path: the generated core + read-only sheet stand-in must give exactly the
// answer Apps Script gives for AdminOrderList / AdminOrderGet, and must never write.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const lib = (f) => import(path.join(root, 'functions', f));
const DHAKA = 6 * 3600000;
const EPOCH = Date.UTC(1899, 11, 30);
const NOW = Date.UTC(2026, 9, 21, 6, 0, 0); // 21 Oct 2026 12:00 Dhaka

function serialOf(date) { return (date.getTime() + DHAKA - EPOCH) / 86400000; }
function fmt(date) {
  const d = new Date(date.getTime() + DHAKA);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

// Apps Script-style truth values (Date objects where the sheet has dates).
function fixture() {
  const header = ['তারিখ', 'নাম', 'মোবাইল', 'পরিমাণ', 'ডেলিভারি চার্জ', 'ঠিকানা', 'ডিজাইন', 'সাইজ', 'মোট টাকা', 'অর্ডার আইডি', 'স্ট্যাটাস'];
  while (header.length < 47) header.push('');
  ['Admin Note', 'Courier Note', 'Advance', 'Discount', 'Assigned To', 'Source', 'Courier'].forEach((h, i) => { header[40 + i] = h; });
  const row = (date, name, phone, id, status, extra = {}) => {
    const r = new Array(47).fill('');
    r[0] = date; r[1] = name; r[2] = phone; r[3] = 1; r[4] = 70; r[5] = 'House 1, Mirpur, Dhaka'; r[6] = '1. Abaya Black'; r[7] = 'M';
    r[8] = 1520; r[9] = id; r[10] = status; Object.keys(extra).forEach((k) => { r[k] = extra[k]; });
    return r;
  };
  const orders = [header,
    row(new Date(NOW - 5 * 86400000), 'Rina', '01711111111', 'MA-1', 'Delivered', { 13: 'Delivered' }),
    row(new Date(NOW - 2 * 86400000), 'Sumi', '01722222222', 'MA-2', 'Confirmed', { 43: 100, 41: 'call first' }),
    row(new Date(NOW - 3600000), 'Rina', '01711111111', 'MA-3', 'Pending', { 34: 'EID10', 35: 50 }),
    row('12-10-2026', 'Text Date', 1733333333, 'MA-4', 'Cancelled'),
  ];
  const sessions = [['Token', 'Email', 'Phone', 'Name', 'CreatedAt', 'ExpiresAt', 'Role'],
    ['tok-admin', 'owner@example.com', '01700000000', 'Owner', new Date(NOW - 3600000), new Date(NOW + 86400000), 'admin'],
    ['tok-old', 'owner@example.com', '01700000000', 'Owner', new Date(NOW - 9e8), new Date(NOW - 1000), 'admin']];
  const admins = [['Email', 'Phone', 'Name', 'PasswordHash', 'Salt', 'Status', 'CreatedAt', 'Role', 'UpdatedAt'],
    ['owner@example.com', '01700000000', 'Owner', 'h', 's', 'active', new Date(NOW - 9e9), 'admin']];
  const blocked = [['Phone', 'Reason', 'BlockedAt', 'BlockedBy'], ['01722222222', 'fake', new Date(NOW - 86400000), 'Owner']];
  const stock = [['Product ID', 'Product Name', 'Category', 'Variant', 'Tracked', 'Available', 'Reserved', 'LowStockThreshold', 'UpdatedAt', 'UpdatedBy'],
    ['ABY-1', 'Abaya Black', 'abaya', 'M', true, 0, 0, '', new Date(NOW - 86400000), 'Owner'],
    ['ABY-1', 'Abaya Black', 'abaya', 'L', true, 1, 0, 3, new Date(NOW - 86400000), 'Owner'],
    ['HJB-2', 'Hijab', '', 'Free', false, 9, 0, '', 'text date', '']];
  orders[3][32] = JSON.stringify([{ id: 'ABY-1', name: 'Abaya Black', qty: 1, size: 'M', category: 'abaya' }]);
  orders[2][32] = JSON.stringify([{ id: 'HJB-2', name: 'Hijab', qty: 2 }]);
  orders[2][36] = 'Facebook';
  const msgr = [['PSID', 'Name', 'FirstSeen', 'LastSeen', 'FromAd', 'PageId', 'Status', 'AssignedTo', 'LastMessage', 'LastDirection', 'Unread', 'OrderId', 'OrderValue', 'PurchaseSent', 'Notes', 'ProfilePic'],
    ['111', 'Ayesha', new Date(NOW - 9e7), new Date(NOW - 600000), 'yes', '', 'New', '', 'দাম কত?', 'in', 2, '', '', '', '', ''],
    ['222', 'Karim', new Date(NOW - 9e7), new Date(NOW - 9e6), '', '', 'New', '', 'ok', 'out', 0, '', '', '', '', '']];
  return { 'Online Order': orders, Sessions: sessions, Admins: admins, Blocked: blocked, StockVariants: stock, MessengerContacts: msgr };
}

// What the Sheets API would return for those values (serials + formatted copy; trailing blanks trimmed).
function apiCopies(values) {
  const trim = (row) => { const r = row.slice(); while (r.length && (r[r.length - 1] === '' || r[r.length - 1] == null)) r.pop(); return r; };
  const raw = values.map((row) => trim(row.map((v) => (v instanceof Date ? serialOf(v) : v))));
  const formatted = values.map((row) => trim(row.map((v) => (v instanceof Date ? fmt(v) : typeof v === 'number' ? String(v) : v))));
  return { raw, formatted };
}

function withNow(fn) {
  const RealDate = Date;
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } static [Symbol.hasInstance](x) { return x instanceof RealDate; } }
  global.Date = FakeDate;
  try { return fn(); } finally { global.Date = RealDate; }
}

async function makeCores() {
  const { createCore } = await lib('_lib/gs-core.js');
  const { buildEnv, toAppsScriptValues } = await lib('_lib/sheets-shim.js');
  const data = fixture();
  const truth = { spreadsheetId: 'SHEET', url: 'https://docs.google.com/spreadsheets/d/SHEET/edit', timeZone: 'Asia/Dhaka', scriptId: 'SCRIPT', sheets: {} };
  const edge = { ...truth, sheets: {} };
  Object.keys(data).forEach((name, i) => {
    truth.sheets[name] = { id: i + 1, values: data[name], rowCount: 1000, columnCount: 50 };
    const { raw, formatted } = apiCopies(data[name]);
    edge.sheets[name] = { id: i + 1, values: toAppsScriptValues(raw, formatted, 'Asia/Dhaka'), rowCount: 1000, columnCount: 50 };
  });
  return { truth: createCore(buildEnv(truth)), edge: createCore(buildEnv(edge)), buildEnv, createCore, truthSnap: truth };
}

test('generated core is in sync with the Apps Script sources', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/build-gs-core.mjs'), '--check'], { stdio: 'pipe' });
});

test('serial dates become the same instants Apps Script returns', async () => {
  const { serialToDate, formatDate } = await lib('_lib/sheets-shim.js');
  const d = new Date(Date.UTC(2026, 9, 20, 8, 30, 15));
  assert.equal(serialToDate(serialOf(d), 'Asia/Dhaka').getTime(), d.getTime());
  assert.equal(formatDate(d, 'GMT+6', 'dd-MM-yyyy HH:mm'), '20-10-2026 14:30');
  assert.equal(formatDate(d, 'Asia/Dhaka', 'yyyy-MM-dd'), '2026-10-20');
});

test('AdminOrderList and AdminOrderGet match the Apps Script answer exactly', async () => {
  const { truth, edge } = await makeCores();
  for (const p of [{ Token: 'tok-admin' }, { Token: 'tok-admin', Limit: '2' }, { Token: 'tok-admin', Limit: '2', Cursor: '3' }]) {
    const a = withNow(() => truth.adminOrderList_({ parameter: p }));
    const b = withNow(() => edge.adminOrderList_({ parameter: p }));
    assert.equal(a.ok, true);
    assert.equal(JSON.stringify(b), JSON.stringify(a));
  }
  const full = withNow(() => edge.adminOrderList_({ parameter: { Token: 'tok-admin' } }));
  assert.deepEqual(full.orders.map((o) => o.orderId), ['MA-4', 'MA-3', 'MA-2', 'MA-1']);
  assert.equal(full.counts.today, 1);
  assert.equal(full.orders.find((o) => o.orderId === 'MA-2').blocked, true);
  for (const id of ['MA-1', 'MA-3', 'MA-4']) {
    const a = withNow(() => truth.adminOrderGet_({ parameter: { Token: 'tok-admin', OrderId: id } }));
    const b = withNow(() => edge.adminOrderGet_({ parameter: { Token: 'tok-admin', OrderId: id } }));
    assert.equal(a.ok, true);
    assert.equal(JSON.stringify(b), JSON.stringify(a));
  }
  const got = withNow(() => edge.adminOrderGet_({ parameter: { Token: 'tok-admin', OrderId: 'MA-3' } }));
  assert.equal(got.order.couponCode, 'EID10');
  assert.equal(got.history.stats.total, 1);
  assert.equal(got.prevId, 'MA-2');
  assert.equal(got.nextId, 'MA-4');
});

test('dashboard, verify, fraud, staff and customer reads match Apps Script exactly', async () => {
  const { truth, edge } = await makeCores();
  const cases = [
    (c) => c.verifyAdminSession_('tok-admin'),
    (c) => c.listAdminOrders_({ parameter: { Token: 'tok-admin', Limit: '80' } }),
    (c) => c.adminFraudCheck_({ parameter: { Token: 'tok-admin', Phone: '01711111111', OrderId: 'MA-3' } }),
    (c) => c.adminStaffList_({ parameter: { Token: 'tok-admin' } }),
    (c) => c.adminCustomerLookup_({ parameter: { Token: 'tok-admin', Phone: '01711111111' } }),
    (c) => c.adminCustomerLookup_({ parameter: { Token: 'tok-admin', Phone: '01799999999' } }),
    (c) => c.getAdminStockVariants_({ parameter: { Token: 'tok-admin', StockStatus: 'all' } }),
    (c) => c.getAdminStockVariants_({ parameter: { Token: 'tok-admin', Search: 'aby', CategoryMap: '{"HJB-2":"hijab"}' } }),
    (c) => c.getAdminAnalyticsV2_({ parameter: { Token: 'tok-admin', Range: 'today' } }),
    (c) => c.getAdminAnalyticsV2_({ parameter: { Token: 'tok-admin', Range: '30d' } }),
    (c) => c.getAdminAnalyticsV2_({ parameter: { Token: 'tok-admin', Range: 'all' } }),
    (c) => c.inboxList_({ parameter: { Token: 'tok-admin', Unread: '1', Limit: '300' } }),
  ];
  for (const run of cases) {
    const a = withNow(() => run(truth));
    const b = withNow(() => run(edge));
    assert.equal(a.ok, true, JSON.stringify(a));
    assert.equal(JSON.stringify(b), JSON.stringify(a));
  }
  assert.equal(withNow(() => edge.listAdminOrders_({ parameter: { Token: 'tok-admin' } })).orders[0].time.length > 0, true);
});

test('expired, unknown and missing tokens are refused', async () => {
  const { edge } = await makeCores();
  assert.equal(withNow(() => edge.adminOrderList_({ parameter: { Token: 'tok-old' } })).error, 'EXPIRED');
  assert.equal(withNow(() => edge.adminOrderList_({ parameter: { Token: 'nope' } })).error, 'INVALID_TOKEN');
  assert.equal(withNow(() => edge.adminOrderGet_({ parameter: {} })).ok, false);
});

test('the stand-in refuses every write', async () => {
  const { buildEnv, createCore, truthSnap } = await makeCores();
  const snap = { ...truthSnap, sheets: { ...truthSnap.sheets } };
  delete snap.sheets.Sessions; // verifySession_ would have to create the sheet
  const core = createCore(buildEnv(snap));
  assert.throws(() => withNow(() => core.adminOrderList_({ parameter: { Token: 'tok-admin' } })), /READ_ONLY/);
});

test('endpoint: full request through mocked Google APIs', async () => {
  const { handleAdminRead } = await lib('api/admin-read.js');
  const { _resetTokenCache } = await lib('_lib/google-auth.js');
  const { _resetMetaCache } = await lib('_lib/sheet-snapshot.js');
  _resetTokenCache(); _resetMetaCache();
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = JSON.stringify({ client_email: 'reader@proj.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const data = fixture();
  const names = Object.keys(data);
  const calls = [];
  const fakeFetch = async (url, init = {}) => {
    calls.push(String(url));
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) {
      assert.match(String(init.body), /assertion=[\w-]+\.[\w-]+\.[\w-]+/);
      return ok({ access_token: 'AT', expires_in: 3600 });
    }
    assert.equal(init.headers.Authorization, 'Bearer AT');
    if (/values:batchGet/.test(url)) {
      const formatted = /FORMATTED_VALUE/.test(url) && !/UNFORMATTED/.test(url);
      return ok({ valueRanges: names.map((n) => ({ values: apiCopies(data[n])[formatted ? 'formatted' : 'raw'] })) });
    }
    return ok({ spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/SHEET/edit', properties: { timeZone: 'Asia/Dhaka' },
      sheets: names.map((n, i) => ({ properties: { title: n, sheetId: i + 1, gridProperties: { rowCount: 1000, columnCount: 50 } } })).concat([{ properties: { title: 'Products', sheetId: 99 } }]) });
  };
  const req = (body, headers = {}) => new Request('https://muslimabaya.com/api/admin-read', { method: 'POST', body: new URLSearchParams(body), headers });
  const env = { GOOGLE_SA_JSON: sa, SHEET_ID: 'SHEET' };

  const res = await withNow(() => handleAdminRead(req({ RecordType: 'AdminOrderList', Token: 'tok-admin', Limit: '80' }), env, { fetch: fakeFetch, now: () => NOW }));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('X-MA-Source'), 'edge');
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.orders.length, 4);
  assert.ok(!calls.some((u) => /Products/.test(decodeURIComponent(u))), 'only the needed tabs are read');

  const declined = await handleAdminRead(req({ RecordType: 'AdminOrderList', Token: 'nope' }), env, { fetch: fakeFetch, now: () => NOW });
  assert.equal(declined.status, 409);
  assert.equal((await handleAdminRead(req({ RecordType: 'AdminOrderUpdate', Token: 'tok-admin' }), env, { fetch: fakeFetch })).status, 400);
  assert.equal((await handleAdminRead(req({ RecordType: 'AdminOrderList', Token: 'x' }), {}, { fetch: fakeFetch })).status, 503);
  assert.equal((await handleAdminRead(req({ RecordType: 'AdminOrderList', Token: 'x' }, { Origin: 'https://evil.example' }), env, { fetch: fakeFetch })).status, 403);
  assert.equal(calls.filter((u) => u.startsWith('https://oauth2')).length, 1, 'access token is reused');
});
