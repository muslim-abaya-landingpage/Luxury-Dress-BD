// Email blocking: the order Worker (cloudflare-worker/worker.js) and the admin API
// (functions/api/admin-email.js), run against a real SQLite database through a small D1 adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const worker = (await import(path.join(root, 'cloudflare-worker/worker.js'))).default;
const { handleAdminEmail } = await import(path.join(root, 'functions/api/admin-email.js'));
const eg = await import(path.join(root, 'functions/_lib/email-guard.js'));

const INBOX_SQL = `CREATE TABLE order_inbox (event_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, target TEXT NOT NULL,
  payload TEXT NOT NULL, name TEXT, phone TEXT, total TEXT, order_id TEXT, last_response TEXT)`;

function makeD1({ withEmailTable = true } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(INBOX_SQL);
  db.exec(fs.readFileSync(path.join(root, 'cloudflare-worker/schema-ip.sql'), 'utf8'));
  if (withEmailTable) db.exec(fs.readFileSync(path.join(root, 'cloudflare-worker/schema-email.sql'), 'utf8'));
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

function orderRequest({ ip = '103.4.5.6', phone = '01712345678', email = '', eventId = 'order_' + Math.random().toString(36).slice(2), origin = 'https://muslimabaya.com' } = {}) {
  const fd = new FormData();
  [['RecordType', 'Order'], ['EventID', eventId], ['Name', 'Test Buyer'], ['Phone', phone], ['Total', '1650'], ['_ma_target', TARGET]].forEach(([k, v]) => fd.append(k, v));
  if (email) fd.append('Email', email);
  const req = new Request('https://muslimabaya.com/_ma/order', { method: 'POST', body: fd, headers: { Origin: origin, 'CF-Connecting-IP': ip, 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) Chrome/130 Mobile' } });
  Object.defineProperty(req, 'cf', { value: { country: 'BD', asn: 24389, asOrganization: 'Grameenphone' } });
  return { req, eventId };
}

function ctx() {
  const pending = [];
  return { waitUntil: (p) => pending.push(p), done: () => Promise.all(pending) };
}

let appsScriptReply = 'Success|MA-20261024-1234';
const telegramAlerts = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  let hostname = '';
  try { hostname = new URL(u).hostname.toLowerCase(); } catch (e) {}
  if (hostname === 'script.google.com') return new Response(appsScriptReply, { status: 200 });
  if (hostname === 'api.telegram.org') {
    try { telegramAlerts.push(JSON.parse(opts.body).text); } catch (e) {}
    return new Response('{}', { status: 200 });
  }
  return realFetch(url, opts);
};

test('email helper: normalises and rejects junk', () => {
  assert.equal(eg.normalizeEmail('  Buyer@Example.com '), 'buyer@example.com');
  assert.equal(eg.normalizeEmail('not-an-email'), '');
  assert.equal(eg.normalizeEmail(''), '');
  assert.equal(eg.normalizeEmail('a@b.c'), 'a@b.c');
  assert.equal(eg.normalizeEmail('x'.repeat(260) + '@example.com'), '');
});

test('worker keeps an identical copy of the shared email helper', () => {
  const pick = (s) => s.slice(s.indexOf('// email-guard:begin'), s.indexOf('// email-guard:end'));
  const lib = pick(fs.readFileSync(path.join(root, 'functions/_lib/email-guard.js'), 'utf8'));
  const wk = pick(fs.readFileSync(path.join(root, 'cloudflare-worker/worker.js'), 'utf8'));
  assert.ok(lib.length > 50);
  assert.equal(wk, lib);
});

test('an order with no blocked email goes through as usual', async () => {
  const DB = makeD1();
  const c = ctx();
  const { req } = orderRequest({ email: 'buyer@example.com' });
  appsScriptReply = 'Success|MA-20261024-1234';
  const res = await worker.fetch(req, { DB }, c);
  await c.done();
  assert.equal(await res.text(), 'Success|MA-20261024-1234');
});

test('worker refuses an order from a blocked email without calling Apps Script, and alerts once', async () => {
  const DB = makeD1();
  const now = Date.now();
  DB.raw.prepare('INSERT INTO blocked_emails (email, reason, created_at, created_by, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run('fraud@example.com', 'বারবার fake অর্ডার', now, 'owner', null);
  telegramAlerts.length = 0;
  const c = ctx();
  const { req } = orderRequest({ email: 'Fraud@Example.com', ip: '9.9.9.9' });
  const text = await (await worker.fetch(req, { DB, TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat' }, c)).text();
  await c.done();
  assert.match(text, /^Error\|/);
  assert.match(text, /WhatsApp/);
  assert.equal(telegramAlerts.length, 1);
  assert.match(telegramAlerts[0], /ইমেইল/);
});

test('an expired email block no longer applies', async () => {
  const DB = makeD1();
  DB.raw.prepare('INSERT INTO blocked_emails (email, reason, created_at, created_by, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run('old@example.com', '', 1, 'owner', Date.now() - 1000);
  const c = ctx();
  const { req } = orderRequest({ email: 'old@example.com' });
  assert.match(await (await worker.fetch(req, { DB }, c)).text(), /^Success/);
  await c.done();
});

test('orders still go through when the blocked_emails table is missing (D1 errors never block an order)', async () => {
  const DB = makeD1({ withEmailTable: false });
  const c = ctx();
  const { req } = orderRequest({ email: 'anyone@example.com' });
  const text = await (await worker.fetch(req, { DB }, c)).text();
  await c.done();
  assert.equal(text, 'Success|MA-20261024-1234');
});

// ---------------- admin API ----------------

function adminRequest(fields, origin = 'https://muslimabaya.com') {
  return new Request('https://muslimabaya.com/api/admin-email', {
    method: 'POST', body: new URLSearchParams(fields).toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: origin },
  });
}
const staffVerify = async (t) => (t === 'good' ? { ok: true, role: 'staff', email: 'staff@example.com' } : { ok: false, error: 'SESSION_EXPIRED', message: 'আবার লগ ইন করুন।' });

test('admin API: login required, cross-site refused', async () => {
  const env = { ORDERS_DB: makeD1() };
  let r = await handleAdminEmail(adminRequest({ Action: 'list' }), env, { verify: staffVerify });
  assert.equal(r.status, 401);
  r = await handleAdminEmail(adminRequest({ Action: 'list', Token: 'bad' }), env, { verify: staffVerify });
  assert.equal(r.status, 401);
  r = await handleAdminEmail(adminRequest({ Action: 'list', Token: 'good' }, 'https://evil.example'), env, { verify: staffVerify });
  assert.equal(r.status, 403);
  r = await handleAdminEmail(adminRequest({ Action: 'list', Token: 'good' }), {}, { verify: staffVerify });
  assert.equal(r.status, 503);
});

test('admin API: check/block/list/unblock round trip, and the Worker then enforces it', async () => {
  const DB = makeD1();
  const env = { ORDERS_DB: DB };

  let r = await (await handleAdminEmail(adminRequest({ Action: 'check', Token: 'good', Email: 'buyer@example.com' }), env, { verify: staffVerify })).json();
  assert.equal(r.ok, true);
  assert.equal(r.blocked, null);

  r = await (await handleAdminEmail(adminRequest({ Action: 'block', Token: 'good', Email: 'Buyer@Example.com', Reason: 'একাধিক ফেক অর্ডার', Days: '7' }), env, { verify: staffVerify })).json();
  assert.equal(r.ok, true);
  assert.equal(r.blocked.email, 'buyer@example.com');
  assert.equal(r.blocked.by, 'staff@example.com');
  assert.ok(r.blocked.expiresAt > Date.now() + 6 * 86400000);

  const c = ctx();
  assert.match(await (await worker.fetch(orderRequest({ email: 'buyer@example.com' }).req, { DB }, c)).text(), /^Error\|/);
  await c.done();

  r = await (await handleAdminEmail(adminRequest({ Action: 'list', Token: 'good' }), env, { verify: staffVerify })).json();
  assert.deepEqual(r.blocked.map((b) => b.email), ['buyer@example.com']);

  r = await (await handleAdminEmail(adminRequest({ Action: 'unblock', Token: 'good', Email: 'buyer@example.com' }), env, { verify: staffVerify })).json();
  assert.equal(r.ok, true);
  r = await (await handleAdminEmail(adminRequest({ Action: 'list', Token: 'good' }), env, { verify: staffVerify })).json();
  assert.equal(r.blocked.length, 0);

  const c2 = ctx();
  assert.match(await (await worker.fetch(orderRequest({ email: 'buyer@example.com' }).req, { DB }, c2)).text(), /^Success/);
  await c2.done();
});

test('admin API: bad input is rejected', async () => {
  const env = { ORDERS_DB: makeD1() };
  let res = await handleAdminEmail(adminRequest({ Action: 'block', Token: 'good', Email: 'not-an-email', Days: '7' }), env, { verify: staffVerify });
  assert.equal(res.status, 400);
  res = await handleAdminEmail(adminRequest({ Action: 'block', Token: 'good', Email: 'a@b.com', Days: '9999' }), env, { verify: staffVerify });
  assert.equal(res.status, 400);
});
