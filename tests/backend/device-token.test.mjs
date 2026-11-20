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
function makeRequest(eventId, cookie = '', phone = '01712345678') {
  const fd = new FormData();
  [['RecordType','Order'],['EventID',eventId],['Name','Test Buyer'],['Phone',phone],['Total','1650'],['_ma_target',TARGET]].forEach(([k,v]) => fd.append(k,v));
  const headers = { Origin:'https://muslimabaya.com', 'CF-Connecting-IP':'103.4.5.6', 'User-Agent':'Mozilla/5.0 (Linux; Android 13) Chrome/130 Mobile' };
  if (cookie) headers.Cookie = cookie;
  const req = new Request('https://muslimabaya.com/_ma/order',{method:'POST',body:fd,headers});
  Object.defineProperty(req,'cf',{value:{country:'BD',asn:24389,asOrganization:'Grameenphone'}});
  return req;
}
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
