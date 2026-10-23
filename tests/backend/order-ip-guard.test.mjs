// IP tracking & blocking: the order Worker (cloudflare-worker/worker.js) and the admin API
// (functions/api/admin-ip.js), run against a real SQLite database through a small D1 adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const worker = (await import(path.join(root, 'cloudflare-worker/worker.js'))).default;
const { handleAdminIp } = await import(path.join(root, 'functions/api/admin-ip.js'));
const ipg = await import(path.join(root, 'functions/_lib/ip-guard.js'));

const INBOX_SQL = `CREATE TABLE order_inbox (event_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, target TEXT NOT NULL,
  payload TEXT NOT NULL, name TEXT, phone TEXT, total TEXT, order_id TEXT, last_response TEXT)`;

function makeD1({ withIpTables = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(INBOX_SQL);
  if (withIpTables) db.exec(fs.readFileSync(path.join(root, 'cloudflare-worker/schema-ip.sql'), 'utf8'));
  const prep = (sql) => {
    let args = [];
    const api = {
      bind(...a) { args = a.map((v) => (v === undefined ? null : v)); return api; },
      async first() { return db.prepare(sql).get(...args) || null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      async run() { db.prepare(sql).run(...args); return { success: true }; },
    };
    return api;
  };
  return { prepare: prep, raw: db };
}

const TARGET = 'https://script.google.com/macros/s/AKfycbxZv7KU0JMY90576HoRF8wtHmEgW2ggkTxAoQKjO/exec';

function orderRequest({ ip = '103.4.5.6', phone = '01712345678', eventId = 'order_' + Math.random().toString(36).slice(2), origin = 'https://muslimabaya.com' } = {}) {
  const fd = new FormData();
  [['RecordType', 'Order'], ['EventID', eventId], ['Name', 'Test Buyer'], ['Phone', phone], ['Total', '1650'], ['_ma_target', TARGET]].forEach(([k, v]) => fd.append(k, v));
  const req = new Request('https://muslimabaya.com/_ma/order', { method: 'POST', body: fd, headers: { Origin: origin, 'CF-Connecting-IP': ip, 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) Chrome/130 Mobile' } });
  Object.defineProperty(req, 'cf', { value: { country: 'BD', asn: 24389, asOrganization: 'Grameenphone' } });
  return { req, eventId };
}

function ctx() {
  const pending = [];
  return { waitUntil: (p) => pending.push(p), done: () => Promise.all(pending) };
}

let appsScriptCalls = 0;
let appsScriptReply = 'Success|MA-20261024-1234';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.indexOf('script.google.com') !== -1) { appsScriptCalls++; return new Response(appsScriptReply, { status: 200 }); }
  if (u.indexOf('api.telegram.org') !== -1) return new Response('{}', { status: 200 });
  return realFetch(url, opts);
};

test('ip helpers: normalise, IPv6 /64 keys, phones, devices', () => {
  assert.equal(ipg.normalizeIp(' 103.4.5.6 '), '103.4.5.6');
  assert.equal(ipg.normalizeIp('256.1.1.1'), '');
  assert.equal(ipg.normalizeIp('2001:0DB8:0000:0001:0000:0000:0000:0042'), '2001:db8:0:1:0:0:0:42');
  assert.equal(ipg.normalizeIp('2001:db8:0:1::42'), '2001:db8:0:1:0:0:0:42');
  assert.equal(ipg.normalizeIp('::ffff:103.4.5.6'), '103.4.5.6');
  assert.equal(ipg.normalizeIp('::1'), '0:0:0:0:0:0:0:1');
  assert.equal(ipg.normalizeIp('1::2::3'), '');
  assert.equal(ipg.normalizeIp('<script>'), '');
  assert.equal(ipg.ipBlockKey('2001:db8:0:1::42'), '2001:db8:0:1::/64');
  assert.equal(ipg.ipBlockKey('103.4.5.6'), '103.4.5.6');
  assert.deepEqual(ipg.ipBlockKeys('2001:db8:0:1::42'), ['2001:db8:0:1:0:0:0:42', '2001:db8:0:1::/64']);
  assert.deepEqual(ipg.ipBlockKeys('nonsense'), []);
  assert.equal(ipg.localPhone('+8801712345678'), '01712345678');
  assert.equal(ipg.localPhone('1712345678'), '01712345678');
  assert.equal(ipg.localPhone('12345'), '');
  assert.equal(ipg.deviceLabel('Mozilla/5.0 (Linux; Android 13) [FBAN/FB4A;FBAV/400]'), 'Android · Facebook app');
  assert.equal(ipg.deviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1'), 'iPhone/iPad · Safari');
});

test('worker keeps an identical copy of the shared ip helpers', () => {
  const pick = (s) => s.slice(s.indexOf('// ip-guard:begin'), s.indexOf('// ip-guard:end'));
  const lib = pick(fs.readFileSync(path.join(root, 'functions/_lib/ip-guard.js'), 'utf8'));
  const wk = pick(fs.readFileSync(path.join(root, 'cloudflare-worker/worker.js'), 'utf8'));
  assert.ok(lib.length > 500);
  assert.equal(wk, lib);
});

test('worker logs the IP of a normal order and records the order id', async () => {
  const DB = makeD1();
  const c = ctx();
  const { req, eventId } = orderRequest({ phone: '+8801712345678' });
  appsScriptReply = 'Success|MA-20261024-1234';
  const res = await worker.fetch(req, { DB }, c);
  await c.done();
  assert.equal(await res.text(), 'Success|MA-20261024-1234');
  const row = DB.raw.prepare('SELECT * FROM order_ip_log WHERE event_id = ?').get(eventId);
  assert.equal(row.ip, '103.4.5.6');
  assert.equal(row.phone, '01712345678');
  assert.equal(row.country, 'BD');
  assert.equal(row.as_org, 'Grameenphone');
  assert.equal(row.outcome, 'saved');
  assert.equal(row.order_id, 'MA-20261024-1234');
});

test('worker refuses an order from a blocked IP (and from inside a blocked IPv6 /64) without calling Apps Script', async () => {
  const DB = makeD1();
  const now = Date.now();
  DB.raw.prepare('INSERT INTO blocked_ips (ip, reason, created_at, created_by, expires_at) VALUES (?, ?, ?, ?, ?)').run('103.4.5.6', 'fake orders', now, 'owner', null);
  DB.raw.prepare('INSERT INTO blocked_ips (ip, reason, created_at, created_by, expires_at) VALUES (?, ?, ?, ?, ?)').run('2001:db8:0:1::/64', '', now, 'owner', now + 86400000);
  for (const ip of ['103.4.5.6', '2001:db8:0:1:aaaa::7']) {
    const before = appsScriptCalls;
    const c = ctx();
    const { req, eventId } = orderRequest({ ip });
    const text = await (await worker.fetch(req, { DB }, c)).text();
    await c.done();
    assert.match(text, /^Error\|/);
    assert.match(text, /WhatsApp/);
    assert.equal(appsScriptCalls, before, 'blocked order must not reach Apps Script');
    assert.equal(DB.raw.prepare('SELECT outcome FROM order_ip_log WHERE event_id = ?').get(eventId).outcome, 'blocked');
    assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM order_inbox WHERE event_id = ?').get(eventId).n, 0);
  }
});

test('an expired block no longer applies', async () => {
  const DB = makeD1();
  DB.raw.prepare('INSERT INTO blocked_ips (ip, reason, created_at, created_by, expires_at) VALUES (?, ?, ?, ?, ?)').run('103.4.5.6', '', 1, 'owner', Date.now() - 1000);
  const c = ctx();
  const { req } = orderRequest();
  assert.match(await (await worker.fetch(req, { DB }, c)).text(), /^Success/);
  await c.done();
});

test('orders still go through when the IP tables are missing (D1 errors never block an order)', async () => {
  const DB = makeD1({ withIpTables: false });
  const c = ctx();
  const { req, eventId } = orderRequest();
  const text = await (await worker.fetch(req, { DB }, c)).text();
  await c.done();
  assert.equal(text, 'Success|MA-20261024-1234');
  assert.equal(DB.raw.prepare('SELECT status FROM order_inbox WHERE event_id = ?').get(eventId).status, 'saved');
});

test('queued order: IP outcome follows the retry to "saved" with the order id', async () => {
  const DB = makeD1();
  appsScriptReply = '<html>Google error</html>';
  const c = ctx();
  const { req, eventId } = orderRequest();
  const res = await worker.fetch(req, { DB }, c);
  await c.done();
  assert.equal(res.headers.get('X-MA-Queued'), '1');
  assert.equal(DB.raw.prepare('SELECT outcome FROM order_ip_log WHERE event_id = ?').get(eventId).outcome, 'queued');
  DB.raw.prepare('UPDATE order_inbox SET next_at = 0 WHERE event_id = ?').run(eventId);
  appsScriptReply = 'Success|MA-20261024-9999';
  const c2 = ctx();
  await worker.scheduled({}, { DB }, c2);
  await c2.done();
  const row = DB.raw.prepare('SELECT outcome, order_id FROM order_ip_log WHERE event_id = ?').get(eventId);
  assert.deepEqual({ ...row }, { outcome: 'saved', order_id: 'MA-20261024-9999' });
  appsScriptReply = 'Success|MA-20261024-1234';
});

// ---------------- admin API ----------------

function adminRequest(fields, origin = 'https://muslimabaya.com') {
  return new Request('https://muslimabaya.com/api/admin-ip', {
    method: 'POST', body: new URLSearchParams(fields).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin },
  });
}
const staffVerify = async (t) => (t === 'good' ? { ok: true, role: 'staff', email: 'staff@example.com' } : { ok: false, error: 'SESSION_EXPIRED', message: 'আবার লগ ইন করুন।' });

test('admin API: login required, cross-site refused', async () => {
  const env = { ORDERS_DB: makeD1() };
  let r = await handleAdminIp(adminRequest({ Action: 'list' }), env, { verify: staffVerify });
  assert.equal(r.status, 401);
  r = await handleAdminIp(adminRequest({ Action: 'list', Token: 'bad' }), env, { verify: staffVerify });
  assert.equal(r.status, 401);
  r = await handleAdminIp(adminRequest({ Action: 'list', Token: 'good' }, 'https://evil.example'), env, { verify: staffVerify });
  assert.equal(r.status, 403);
  r = await handleAdminIp(adminRequest({ Action: 'list', Token: 'good' }), {}, { verify: staffVerify });
  assert.equal(r.status, 503);
});

test('admin API: lookup shows the order IP and other phone numbers on that IP; block/unblock round trip', async () => {
  const DB = makeD1();
  const env = { ORDERS_DB: DB };
  // Three orders from one IP with two different phones, one order of the customer from another IP.
  for (const [ip, phone] of [['103.4.5.6', '01712345678'], ['103.4.5.6', '01898765432'], ['103.4.5.6', '01898765432'], ['37.111.1.1', '01712345678']]) {
    const c = ctx();
    await worker.fetch(orderRequest({ ip, phone }).req, { DB }, c);
    await c.done();
  }
  let r = await (await handleAdminIp(adminRequest({ Action: 'lookup', Token: 'good', OrderId: 'MA-20261024-1234', Phone: '01712345678' }), env, { verify: staffVerify })).json();
  assert.equal(r.ok, true);
  assert.ok(r.order && r.order.ip, 'order IP is shown');
  assert.equal(r.order.device, 'Android · Chrome');
  const shared = r.ips.find((x) => x.ip === '103.4.5.6');
  assert.ok(shared);
  assert.equal(shared.ordersFromIp30d, 3);
  assert.deepEqual(shared.otherPhones.map((p) => [p.phone, p.orders]), [['01898765432', 2]]);
  assert.equal(shared.blocked, null);

  r = await (await handleAdminIp(adminRequest({ Action: 'block', Token: 'good', Ip: '103.4.5.6', Reason: 'একাধিক ফেক নম্বর', Days: '7' }), env, { verify: staffVerify })).json();
  assert.equal(r.ok, true);
  assert.equal(r.blocked.key, '103.4.5.6');
  assert.equal(r.blocked.by, 'staff@example.com');
  assert.ok(r.blocked.expiresAt > Date.now() + 6 * 86400000);

  // The Worker now refuses that IP.
  const c = ctx();
  assert.match(await (await worker.fetch(orderRequest({ ip: '103.4.5.6' }).req, { DB }, c)).text(), /^Error\|/);
  await c.done();

  r = await (await handleAdminIp(adminRequest({ Action: 'list', Token: 'good' }), env, { verify: staffVerify })).json();
  assert.deepEqual(r.blocked.map((b) => b.key), ['103.4.5.6']);

  r = await (await handleAdminIp(adminRequest({ Action: 'unblock', Token: 'good', Ip: '103.4.5.6' }), env, { verify: staffVerify })).json();
  assert.equal(r.ok, true);
  r = await (await handleAdminIp(adminRequest({ Action: 'list', Token: 'good' }), env, { verify: staffVerify })).json();
  assert.equal(r.blocked.length, 0);
});

test('admin API: IPv6 is blocked as its /64; bad input is rejected', async () => {
  const env = { ORDERS_DB: makeD1() };
  let r = await (await handleAdminIp(adminRequest({ Action: 'block', Token: 'good', Ip: '2001:db8:0:1::42', Days: '0' }), env, { verify: staffVerify })).json();
  assert.equal(r.blocked.key, '2001:db8:0:1::/64');
  assert.equal(r.blocked.expiresAt, null);
  r = await (await handleAdminIp(adminRequest({ Action: 'unblock', Token: 'good', Ip: '2001:db8:0:1::/64' }), env, { verify: staffVerify })).json();
  assert.equal(r.ok, true);
  let res = await handleAdminIp(adminRequest({ Action: 'block', Token: 'good', Ip: 'drop table', Days: '7' }), env, { verify: staffVerify });
  assert.equal(res.status, 400);
  res = await handleAdminIp(adminRequest({ Action: 'block', Token: 'good', Ip: '1.2.3.4', Days: '9999' }), env, { verify: staffVerify });
  assert.equal(res.status, 400);
});
