// classifyNetwork() in cloudflare-worker/worker.js: fills fraud-risk.js's vpnOrProxy/hostingNetwork
// signal slots from Cloudflare's own free request.cf.asn/asOrganization. No internal export exists
// for a single function in this file (it's a module script, not a library), so these tests drive it
// the same way order-ip-guard.test.mjs and device-token.test.mjs do: through worker.fetch() with a
// real SQLite-backed D1 stand-in, reading the resulting risk back out of order_inbox.
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
function makeRequest(eventId, cf, ip = '103.4.5.6') {
  const fd = new FormData();
  [['RecordType', 'Order'], ['EventID', eventId], ['Name', 'Test Buyer'], ['Phone', '01712345678'], ['Total', '1650'], ['_ma_target', TARGET]]
    .forEach(([k, v]) => fd.append(k, v));
  const req = new Request('https://muslimabaya.com/_ma/order', {
    method: 'POST', body: fd,
    headers: { Origin: 'https://muslimabaya.com', 'CF-Connecting-IP': ip, 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) Chrome/130 Mobile' },
  });
  Object.defineProperty(req, 'cf', { value: cf });
  return req;
}
function ctx() { const pending = []; return { waitUntil(p) { pending.push(p); }, async done() { await Promise.all(pending); } }; }
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://script.google.com/')) return new Response('Success|MA-NET-TEST', { status: 200 });
  return realFetch(url, opts);
};

test('an ordinary Bangladeshi mobile ISP is not flagged as hosting or VPN', async () => {
  const DB = makeDB();
  const c = ctx();
  await worker.fetch(makeRequest('net_isp', { country: 'BD', asn: 24389, asOrganization: 'Grameenphone Ltd' }), { DB }, c);
  await c.done();
  const payload = JSON.parse(DB.raw.prepare("SELECT payload FROM order_inbox WHERE event_id='net_isp'").get().payload);
  assert.equal(payload.risk.hostingNetwork, false);
  assert.equal(payload.risk.vpnOrProxy, false);
  assert.equal(payload.risk.level, 'low');
});

test('a known cloud/hosting ASN is flagged as a hosting network, and raises the score', async () => {
  const DB = makeDB();
  const c = ctx();
  // AWS
  await worker.fetch(makeRequest('net_aws', { country: 'US', asn: 16509, asOrganization: 'Amazon.com, Inc.' }), { DB }, c);
  await c.done();
  const payload = JSON.parse(DB.raw.prepare("SELECT payload FROM order_inbox WHERE event_id='net_aws'").get().payload);
  assert.equal(payload.risk.hostingNetwork, true);
  assert.equal(payload.risk.vpnOrProxy, false);
  assert.ok(payload.risk.reasons.some((r) => /Hosting/.test(r)));
});

test('a known commercial VPN brand in the AS organization name is flagged as vpnOrProxy', async () => {
  const DB = makeDB();
  const c = ctx();
  await worker.fetch(makeRequest('net_vpn', { country: 'NL', asn: 60068, asOrganization: 'NordVPN S.A.' }), { DB }, c);
  await c.done();
  const payload = JSON.parse(DB.raw.prepare("SELECT payload FROM order_inbox WHERE event_id='net_vpn'").get().payload);
  assert.equal(payload.risk.vpnOrProxy, true);
  assert.ok(payload.risk.reasons.some((r) => /VPN/.test(r)));
});

test('an order still succeeds when request.cf is missing entirely', async () => {
  const DB = makeDB();
  const c = ctx();
  const res = await worker.fetch(makeRequest('net_no_cf', undefined), { DB }, c);
  await c.done();
  assert.match(await res.text(), /^Success\|/);
});
