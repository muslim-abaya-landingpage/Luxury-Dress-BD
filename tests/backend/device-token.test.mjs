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
  return {
    raw: db,
    prepare(sql) {
      let args = [];
      const api = {
        bind(...a) { args = a.map((v) => v === undefined ? null : v); return api; },
        async first() { return db.prepare(sql).get(...args) || null; },
        async all() { return { results: db.prepare(sql).all(...args) }; },
        async run() { db.prepare(sql).run(...args); return { success: true }; }
      };
      return api;
    }
  };
}
const TARGET = 'https://script.google.com/macros/s/AKfycbxZv7KU0JMY90576HoRF8wtHmEgW2ggkTxAoQKjO/exec';
function makeRequest(eventId, cookie = '', phone = '01712345678', deviceFp = '') {
  const fd = new FormData();
  [['RecordType','Order'],['EventID',eventId],['Name','Test Buyer'],['Phone',phone],['Total','1650'],['_ma_target',TARGET]].forEach(([k,v]) => fd.append(k,v));
  if (deviceFp) fd.append('DeviceFP', deviceFp);
  const headers = { Origin:'https://muslimabaya.com', 'CF-Connecting-IP':'103.4.5.6', 'User-Agent':'Mozilla/5.0 (Linux; Android 13) Chrome/130 Mobile' };
  if (cookie) headers.Cookie = cookie;
  const req = new Request('https://muslimabaya.com/_ma/order',{method:'POST',body:fd,headers});
  Object.defineProperty(req,'cf',{value:{country:'BD',asn:24389,asOrganization:'Grameenphone'}});
  return req;
}
const FP_A = 'a'.repeat(64);
function ctx() { const pending=[]; return { waitUntil(p){pending.push(p);}, async done(){await Promise.all(pending);} }; }
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://script.google.com/')) return new Response('Success|MA-DEVICE-TEST',{status:200});
  return realFetch(url,opts);
};

test('issues a signed HttpOnly first-party device token and reuses it for subsequent orders', async () => {
  const DB = makeDB();
  const env = { DB, DEVICE_TOKEN_SECRET: 'test-secret-that-is-at-least-thirty-two-characters-long' };
  let cookie = '';
  for (let i=1;i<=4;i++) {
    const c = ctx();
    const res = await worker.fetch(makeRequest('device_order_'+i,cookie,'0171234567'+i),env,c);
    await c.done();
    assert.match(await res.text(),/^Success\|/);
    if (i===1) {
      const setCookie = res.headers.get('Set-Cookie') || '';
      assert.match(setCookie,/ma_device=/);
      assert.match(setCookie,/HttpOnly/);
      assert.match(setCookie,/Secure/);
      cookie = setCookie.split(';')[0];
    } else {
      assert.equal(res.headers.get('Set-Cookie'),null);
    }
  }
  const rows = DB.raw.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT device_hash) AS devices FROM device_order_log').get();
  assert.equal(rows.n,4);
  assert.equal(rows.devices,1);
  const payload = JSON.parse(DB.raw.prepare("SELECT payload FROM order_inbox WHERE event_id='device_order_4'").get().payload);
  assert.equal(payload.risk.sameDeviceAttempts24h,3);
  assert.equal(payload.risk.action,'challenge');
});

test('does not issue or rely on a device token when its secret is absent', async () => {
  const DB = makeDB();
  const c = ctx();
  const res = await worker.fetch(makeRequest('device_no_secret'),{DB},c);
  await c.done();
  assert.equal(res.headers.get('Set-Cookie'),null);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM device_order_log').get().n,0);
});

test('a device past the hard limit is refused outright, not just flagged for review', async () => {
  const DB = makeDB();
  const env = { DB, DEVICE_TOKEN_SECRET: 'test-secret-that-is-at-least-thirty-two-characters-long', TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_CHAT_ID: 'chat' };
  const alerts = [];
  globalThis.fetch = async (url, opts) => {
    if (String(url).startsWith('https://script.google.com/')) return new Response('Success|MA-DEVICE-TEST', { status: 200 });
    if (String(url).includes('api.telegram.org')) { try { alerts.push(JSON.parse(opts.body).text); } catch (e) {} return new Response('{}', { status: 200 }); }
    return realFetch(url, opts);
  };
  let cookie = '';
  for (let i = 1; i <= 8; i++) {
    const c = ctx();
    const res = await worker.fetch(makeRequest('device_hard_' + i, cookie, '017100000' + String(i).padStart(2, '0')), env, c);
    await c.done();
    assert.match(await res.text(), /^Success\|/, 'attempt ' + i + ' should still go through');
    if (i === 1) cookie = (res.headers.get('Set-Cookie') || '').split(';')[0];
  }
  // 9th attempt: 8 prior same-device orders already logged -> hard limit reached.
  const c9 = ctx();
  const res9 = await worker.fetch(makeRequest('device_hard_9', cookie, '0171000009'), env, c9);
  await c9.done();
  const text9 = await res9.text();
  assert.match(text9, /^Error\|/);
  assert.match(text9, /WhatsApp/);
  assert.equal(DB.raw.prepare("SELECT status FROM order_inbox WHERE event_id='device_hard_9'").get(), undefined, 'a blocked attempt never reaches order_inbox / Apps Script');
  const blockAlerts = alerts.filter((a) => /ডিভাইস-চেষ্টা/.test(a));
  assert.equal(blockAlerts.length, 1, 'exactly one hard-block alert, for the 9th attempt');
  // The blocked attempt is still logged, so a retry does not reset the count.
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM device_order_log').get().n, 9);
});

test('a visitor with no device cookie (secret unset) is never hard-blocked by device alone', async () => {
  const DB = makeDB();
  const c = ctx();
  for (let i = 1; i <= 10; i++) {
    const cc = ctx();
    const res = await worker.fetch(makeRequest('device_anon_' + i, '', '0181000000'), {DB}, cc);
    await cc.done();
    assert.match(await res.text(), /^Success\|/);
  }
});

test('a malformed DeviceFP is ignored rather than stored or trusted', async () => {
  const DB = makeDB();
  const c = ctx();
  const res = await worker.fetch(makeRequest('device_fp_bad', '', '0191000000', 'not-a-real-hash!!'), { DB }, c);
  await c.done();
  assert.match(await res.text(), /^Success\|/);
  assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM device_fp_log').get().n, 0);
});

test('the fingerprint hard-blocks on its own, with no cookie at all', async () => {
  const DB = makeDB();
  const env = { DB }; // no DEVICE_TOKEN_SECRET -> cookie never issued or checked
  for (let i = 1; i <= 8; i++) {
    const c = ctx();
    const res = await worker.fetch(makeRequest('fp_only_' + i, '', '019200000' + i, FP_A), env, c);
    await c.done();
    assert.match(await res.text(), /^Success\|/, 'attempt ' + i);
  }
  const c9 = ctx();
  const res9 = await worker.fetch(makeRequest('fp_only_9', '', '0192000009', FP_A), env, c9);
  await c9.done();
  assert.match(await res9.text(), /^Error\|/);
});

test('clearing the ma_device cookie between orders does not reset the count when the fingerprint stays the same', async () => {
  const DB = makeDB();
  const env = { DB, DEVICE_TOKEN_SECRET: 'test-secret-that-is-at-least-thirty-two-characters-long' };
  // Each request below sends NO cookie (as if cookies were cleared), so every attempt gets its
  // own fresh ma_device identity -- but the same fingerprint, simulating a returning browser
  // whose cookies were wiped between visits.
  for (let i = 1; i <= 8; i++) {
    const c = ctx();
    const res = await worker.fetch(makeRequest('fp_cookiewipe_' + i, '', '019300000' + i, FP_A), env, c);
    await c.done();
    assert.match(await res.text(), /^Success\|/, 'attempt ' + i);
  }
  // Cookie-based count alone would see 0 prior attempts every time (each request is a fresh
  // cookie identity); the fingerprint is what catches this on the 9th attempt.
  const c9 = ctx();
  const res9 = await worker.fetch(makeRequest('fp_cookiewipe_9', '', '0193000009', FP_A), env, c9);
  await c9.done();
  const text9 = await res9.text();
  assert.match(text9, /^Error\|/);
  // 9 distinct device_hash values (a fresh cookie identity every time, including the blocked
  // attempt), but only 1 fingerprint throughout -- that single fingerprint is what caught it.
  assert.equal(DB.raw.prepare('SELECT COUNT(DISTINCT device_hash) AS n FROM device_order_log').get().n, 9);
  assert.equal(DB.raw.prepare('SELECT COUNT(DISTINCT fp_hash) AS n FROM device_fp_log').get().n, 1);
});

test('the fingerprint signal feeds scoreFraudRisk even when the cookie is fresh', async () => {
  const DB = makeDB();
  const env = { DB, DEVICE_TOKEN_SECRET: 'test-secret-that-is-at-least-thirty-two-characters-long' };
  for (let i = 1; i <= 4; i++) {
    const c = ctx();
    const res = await worker.fetch(makeRequest('fp_risk_' + i, '', '019400000' + i, FP_A), env, c);
    await c.done();
    assert.match(await res.text(), /^Success\|/);
  }
  const payload = JSON.parse(DB.raw.prepare("SELECT payload FROM order_inbox WHERE event_id='fp_risk_4'").get().payload);
  assert.equal(payload.risk.sameDeviceAttempts24h, 3);
  assert.equal(payload.risk.action, 'challenge');
});
