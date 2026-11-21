// WhatsApp order-phone OTP (cloudflare-worker/worker.js, added 2026-11-21): a risk-flagged order
// (fraud score already 'review'/'high' from scoreFraudRisk) is held and asked to verify its phone
// via a WhatsApp code before it reaches Apps Script; everything else is untouched. Drives this the
// same way order-ip-guard.test.mjs and device-token.test.mjs do: through worker.fetch() with a real
// SQLite-backed D1 stand-in, and a mocked fetch() for both script.google.com and
// graph.facebook.com (the WhatsApp Cloud API) so no real network call or real SMS/WhatsApp cost
// happens while testing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const worker = (await import(path.join(root, 'cloudflare-worker/worker.js'))).default;
const INBOX_SQL = `CREATE TABLE order_inbox (event_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, target TEXT NOT NULL,
  payload TEXT NOT NULL, name TEXT, phone TEXT, total TEXT, order_id TEXT, last_response TEXT)`;

function makeDB() {
  const db = new DatabaseSync(':memory:');
  db.exec(INBOX_SQL);
  db.exec(fs.readFileSync(path.join(root, 'cloudflare-worker/schema-ip.sql'), 'utf8'));
  db.exec(fs.readFileSync(path.join(root, 'cloudflare-worker/schema-device.sql'), 'utf8'));
  db.exec(fs.readFileSync(path.join(root, 'cloudflare-worker/schema-device-fp.sql'), 'utf8'));
  db.exec(fs.readFileSync(path.join(root, 'cloudflare-worker/schema-otp.sql'), 'utf8'));
  return {
    raw: db,
    prepare(sql) {
      let args = [];
      const api = {
        bind(...a) { args = a.map((v) => (v === undefined ? null : v)); return api; },
        async first() { return db.prepare(sql).get(...args) || null; },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async run() { db.prepare(sql).run(...args); return { success: true }; },
      };
      return api;
    },
  };
}

const TARGET = 'https://script.google.com/macros/s/AKfycbxZv7KU0JMY90576HoRF8wtHmEgW2ggkTxAoQKjO/exec';
const PHONE = '01712345678';
const FP_A = 'b'.repeat(64);

function makeOrderRequest(eventId, { phone = PHONE, deviceFp = '', otpToken = '' } = {}) {
  const fd = new FormData();
  [['RecordType', 'Order'], ['EventID', eventId], ['Name', 'Test Buyer'], ['Phone', phone], ['Total', '1650'], ['_ma_target', TARGET]]
    .forEach(([k, v]) => fd.append(k, v));
  if (deviceFp) fd.append('DeviceFP', deviceFp);
  if (otpToken) fd.append('OtpToken', otpToken);
  const req = new Request('https://muslimabaya.com/_ma/order', {
    method: 'POST', body: fd,
    headers: { Origin: 'https://muslimabaya.com', 'CF-Connecting-IP': '103.4.5.6', 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) Chrome/130 Mobile' },
  });
  Object.defineProperty(req, 'cf', { value: { country: 'BD', asn: 24389, asOrganization: 'Grameenphone' } });
  return req;
}

function makeApiRequest(path, fields) {
  const body = new URLSearchParams(fields);
  return new Request('https://muslimabaya.com' + path, {
    method: 'POST', body,
    headers: { Origin: 'https://muslimabaya.com' },
  });
}

function ctx() { const pending = []; return { waitUntil(p) { pending.push(p); }, async done() { await Promise.all(pending); } }; }

const OTP_ENV = { WHATSAPP_ACCESS_TOKEN: 'test-token', WHATSAPP_PHONE_NUMBER_ID: '123456789', OTP_TOKEN_SECRET: 'x'.repeat(40) };

const realFetch = globalThis.fetch;
let whatsappCalls = [];
function installFetchMock() {
  whatsappCalls = [];
  globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.startsWith('https://script.google.com/')) return new Response('Success|MA-OTP-TEST', { status: 200 });
    if (u.startsWith('https://api.telegram.org/')) return new Response('{"ok":true}', { status: 200 });
    if (u.startsWith('https://graph.facebook.com/')) {
      const body = JSON.parse(opts.body);
      whatsappCalls.push(body);
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.test' }] }), { status: 200 });
    }
    return realFetch(url, opts);
  };
}
function restoreFetch() { globalThis.fetch = realFetch; }

function sentCode() {
  const last = whatsappCalls[whatsappCalls.length - 1];
  return last.template.components[0].parameters[0].text;
}

// Drives the order's own fraud score to 'review' the same way device-token.test.mjs does: three
// prior orders from the same client fingerprint (no cookie) score sameDeviceAttempts24h=3 -> +30,
// which lands exactly on the default reviewAt=30 threshold.
async function driveToReviewLevel(DB, c, prefix) {
  for (let i = 0; i < 3; i += 1) {
    await worker.fetch(makeOrderRequest(prefix + '_' + i, { phone: '0171000' + String(1000 + i).slice(-4), deviceFp: FP_A }), { DB, ...OTP_ENV }, c);
  }
}

test('a low-risk order never touches OTP, even fully configured', async () => {
  installFetchMock();
  const DB = makeDB();
  const c = ctx();
  const res = await worker.fetch(makeOrderRequest('otp_low'), { DB, ...OTP_ENV }, c);
  await c.done();
  assert.equal(await res.text(), 'Success|MA-OTP-TEST');
  assert.equal(whatsappCalls.length, 0);
  const row = DB.raw.prepare("SELECT status FROM order_inbox WHERE event_id='otp_low'").get();
  assert.equal(row.status, 'saved');
  restoreFetch();
});

test('a risk-flagged order is held pending OTP instead of reaching Apps Script', async () => {
  installFetchMock();
  const DB = makeDB();
  const c = ctx();
  await driveToReviewLevel(DB, c, 'otp_gate');
  const res = await worker.fetch(makeOrderRequest('otp_gate_4', { phone: '01710001003', deviceFp: FP_A }), { DB, ...OTP_ENV }, c);
  await c.done();
  const text = await res.text();
  assert.equal(text, 'NeedsOtp|otp_gate_4');
  const row = DB.raw.prepare("SELECT status FROM order_inbox WHERE event_id='otp_gate_4'").get();
  assert.equal(row.status, 'awaiting_otp');
  assert.equal(whatsappCalls.length, 0); // the gate itself never sends -- /_ma/otp/send does
  restoreFetch();
});

test('without WhatsApp/OTP secrets configured, a risk-flagged order proceeds as before (fail-open)', async () => {
  installFetchMock();
  const DB = makeDB();
  const c = ctx();
  for (let i = 0; i < 3; i += 1) {
    await worker.fetch(makeOrderRequest('otp_off_' + i, { phone: '0172000' + String(1000 + i).slice(-4), deviceFp: FP_A }), { DB }, c);
  }
  const res = await worker.fetch(makeOrderRequest('otp_off_4', { phone: '01720001003', deviceFp: FP_A }), { DB }, c);
  await c.done();
  assert.equal(await res.text(), 'Success|MA-OTP-TEST');
  const row = DB.raw.prepare("SELECT status FROM order_inbox WHERE event_id='otp_off_4'").get();
  assert.equal(row.status, 'saved');
  restoreFetch();
});

test('/_ma/otp/send stores a hashed (not plaintext) code and sends it over WhatsApp', async () => {
  installFetchMock();
  const DB = makeDB();
  const res = await worker.fetch(makeApiRequest('/_ma/otp/send', { Phone: PHONE }), { DB, ...OTP_ENV });
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(whatsappCalls.length, 1);
  const code = sentCode();
  assert.match(code, /^\d{6}$/);
  const row = DB.raw.prepare("SELECT otp_hash FROM order_otp_log WHERE phone = ?").get('01712345678');
  assert.notEqual(row.otp_hash, code);
  assert.match(row.otp_hash, /^[a-f0-9]{64}$/);
  restoreFetch();
});

test('/_ma/otp/send is a no-op (clear error) when WhatsApp secrets are not configured', async () => {
  installFetchMock();
  const DB = makeDB();
  const res = await worker.fetch(makeApiRequest('/_ma/otp/send', { Phone: PHONE }), { DB });
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'NOT_CONFIGURED');
  assert.equal(whatsappCalls.length, 0);
  restoreFetch();
});

test('a resend within the cooldown window is rejected', async () => {
  installFetchMock();
  const DB = makeDB();
  await worker.fetch(makeApiRequest('/_ma/otp/send', { Phone: PHONE }), { DB, ...OTP_ENV });
  const res2 = await worker.fetch(makeApiRequest('/_ma/otp/send', { Phone: PHONE }), { DB, ...OTP_ENV });
  const body2 = await res2.json();
  assert.equal(body2.ok, false);
  assert.equal(body2.error, 'COOLDOWN');
  assert.equal(whatsappCalls.length, 1);
  restoreFetch();
});

test('more than 5 codes to the same phone within an hour are rate-limited', async () => {
  installFetchMock();
  const DB = makeDB();
  const now = Date.now();
  // Seed 5 "already sent" rows spaced past the resend cooldown, inside the 1h window.
  for (let i = 0; i < 5; i += 1) {
    DB.raw.prepare('INSERT INTO order_otp_log (phone, otp_hash, created_at, expires_at, attempts) VALUES (?, ?, ?, ?, 0)')
      .run('01712345678', 'deadbeef', now - 58000 - i * 1000, now + 5 * 60 * 1000);
  }
  const res = await worker.fetch(makeApiRequest('/_ma/otp/send', { Phone: PHONE }), { DB, ...OTP_ENV });
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'RATE_LIMIT');
  assert.equal(whatsappCalls.length, 0);
  restoreFetch();
});

test('/_ma/otp/verify rejects a wrong code and counts the attempt, accepts the right one', async () => {
  installFetchMock();
  const DB = makeDB();
  await worker.fetch(makeApiRequest('/_ma/otp/send', { Phone: PHONE }), { DB, ...OTP_ENV });
  const code = sentCode();

  const wrong = await worker.fetch(makeApiRequest('/_ma/otp/verify', { Phone: PHONE, Code: '000000' }), { DB, ...OTP_ENV });
  const wrongBody = await wrong.json();
  assert.equal(wrongBody.ok, false);
  assert.equal(wrongBody.error, 'WRONG_CODE');
  const afterWrong = DB.raw.prepare("SELECT attempts FROM order_otp_log WHERE phone = ?").get('01712345678');
  assert.equal(afterWrong.attempts, 1);

  const right = await worker.fetch(makeApiRequest('/_ma/otp/verify', { Phone: PHONE, Code: code }), { DB, ...OTP_ENV });
  const rightBody = await right.json();
  assert.equal(rightBody.ok, true);
  assert.ok(rightBody.token && rightBody.token.split('.').length === 3);
  restoreFetch();
});

test('5 wrong attempts lock the code out, even with the right one', async () => {
  installFetchMock();
  const DB = makeDB();
  await worker.fetch(makeApiRequest('/_ma/otp/send', { Phone: PHONE }), { DB, ...OTP_ENV });
  const code = sentCode();
  for (let i = 0; i < 5; i += 1) {
    await worker.fetch(makeApiRequest('/_ma/otp/verify', { Phone: PHONE, Code: '000000' }), { DB, ...OTP_ENV });
  }
  const res = await worker.fetch(makeApiRequest('/_ma/otp/verify', { Phone: PHONE, Code: code }), { DB, ...OTP_ENV });
  const body = await res.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, 'LOCKED');
  restoreFetch();
});

test('a verified OTP token releases the same held order to Apps Script, end to end', async () => {
  installFetchMock();
  const DB = makeDB();
  const c = ctx();
  await driveToReviewLevel(DB, c, 'otp_e2e');
  const heldPhone = '01710001099';
  const held = await worker.fetch(makeOrderRequest('otp_e2e_hold', { phone: heldPhone, deviceFp: FP_A }), { DB, ...OTP_ENV }, c);
  assert.equal(await held.text(), 'NeedsOtp|otp_e2e_hold');

  await worker.fetch(makeApiRequest('/_ma/otp/send', { Phone: heldPhone }), { DB, ...OTP_ENV });
  const code = sentCode();
  const verify = await worker.fetch(makeApiRequest('/_ma/otp/verify', { Phone: heldPhone, Code: code }), { DB, ...OTP_ENV });
  const { token } = await verify.json();

  const resubmit = await worker.fetch(makeOrderRequest('otp_e2e_hold', { phone: heldPhone, deviceFp: FP_A, otpToken: token }), { DB, ...OTP_ENV }, c);
  await c.done();
  assert.equal(await resubmit.text(), 'Success|MA-OTP-TEST');
  const row = DB.raw.prepare("SELECT status FROM order_inbox WHERE event_id='otp_e2e_hold'").get();
  assert.equal(row.status, 'saved');
  restoreFetch();
});

test('a token issued for one phone cannot release an order for a different phone', async () => {
  installFetchMock();
  const DB = makeDB();
  const c = ctx();
  await driveToReviewLevel(DB, c, 'otp_mismatch');
  const heldPhone = '01710001088';
  await worker.fetch(makeOrderRequest('otp_mismatch_hold', { phone: heldPhone, deviceFp: FP_A }), { DB, ...OTP_ENV }, c);

  await worker.fetch(makeApiRequest('/_ma/otp/send', { Phone: '01799998888' }), { DB, ...OTP_ENV });
  const code = sentCode();
  const verify = await worker.fetch(makeApiRequest('/_ma/otp/verify', { Phone: '01799998888', Code: code }), { DB, ...OTP_ENV });
  const { token } = await verify.json();

  const resubmit = await worker.fetch(makeOrderRequest('otp_mismatch_hold', { phone: heldPhone, deviceFp: FP_A, otpToken: token }), { DB, ...OTP_ENV }, c);
  await c.done();
  assert.equal(await resubmit.text(), 'NeedsOtp|otp_mismatch_hold');
  restoreFetch();
});
