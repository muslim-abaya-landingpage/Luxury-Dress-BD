// Server-side tracking (SST): the confirmed-order Purchase event must carry the shopper's
// IP + browser and the ordered product IDs, so Meta CAPI / TikTok Events API can match it.
//  - Worker /_ma/order adds ClientIP from CF-Connecting-IP (a browser-sent ClientIP is dropped).
//  - Apps Script stores {ip, ua} at order intake and uses it, plus CartJSON, on Confirmed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const worker = (await import(path.join(root, 'cloudflare-worker/worker.js'))).default;

// ---------- Worker ----------
function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE order_inbox (event_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
    status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, target TEXT NOT NULL,
    payload TEXT NOT NULL, name TEXT, phone TEXT, total TEXT, order_id TEXT, last_response TEXT)`);
  db.exec(fs.readFileSync(path.join(root, 'cloudflare-worker/schema-ip.sql'), 'utf8'));
  return {
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

test('worker forwards the real shopper IP as ClientIP and drops a spoofed one', async () => {
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    const host = new URL(String(url)).hostname;
    if (host === 'script.google.com') { sent.push([...opts.body.entries()]); return new Response('Success|MA-1', { status: 200 }); }
    if (host === 'api.telegram.org') return new Response('{}');
    return realFetch(url, opts);
  };
  try {
    const fd = new FormData();
    [['RecordType', 'Order'], ['EventID', 'order_sst_1'], ['Name', 'Test'], ['Phone', '01712345678'], ['Total', '1650'],
      ['ClientIP', '1.2.3.4'], ['ClientUserAgent', 'UA-test'], ['_ma_target', TARGET]].forEach(([k, v]) => fd.append(k, v));
    const req = new Request('https://muslimabaya.com/_ma/order', { method: 'POST', body: fd, headers: { Origin: 'https://muslimabaya.com', 'CF-Connecting-IP': '103.4.5.6' } });
    Object.defineProperty(req, 'cf', { value: { country: 'BD' } });
    const pending = [];
    const res = await worker.fetch(req, { DB: makeD1() }, { waitUntil: (p) => pending.push(p) });
    await Promise.all(pending);
    assert.equal(await res.text(), 'Success|MA-1');
    assert.equal(sent.length, 1);
    const ips = sent[0].filter(([k]) => k === 'ClientIP').map(([, v]) => v);
    assert.deepEqual(ips, ['103.4.5.6']);
    assert.equal(sent[0].find(([k]) => k === 'ClientUserAgent')[1], 'UA-test');
  } finally {
    globalThis.fetch = realFetch;
  }
});

// ---------- Apps Script ----------
function loadCode() {
  const calls = [];
  const props = { FB_ACCESS_TOKEN: 'tok', FB_PIXEL_ID: '1465090315322833', TIKTOK_ACCESS_TOKEN: 'tt' };
  const ctx = {
    console,
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_, s) => [...crypto.createHash('sha256').update(String(s)).digest()].map((b) => (b > 127 ? b - 256 : b)),
    },
    UrlFetchApp: {
      fetch(url, opts) {
        calls.push({ url, body: JSON.parse(opts.payload) });
        const meta = new URL(url).hostname === 'graph.facebook.com';
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify(meta ? { events_received: 1 } : { code: 0 }) };
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8'), ctx);
  return { ctx, calls };
}

function fakeSheet(rows) {
  return {
    rows,
    getMaxColumns() { return Math.max(...rows.map((r) => r.length)); },
    insertColumnsAfter(_, n) { rows.forEach((r) => { for (let i = 0; i < n; i++) r.push(''); }); },
    getRange(r, c) {
      return {
        getValue: () => (rows[r - 1] || [])[c - 1] ?? '',
        setValue: (v) => { while (rows[r - 1].length < c) rows[r - 1].push(''); rows[r - 1][c - 1] = v; },
      };
    },
  };
}

test('Apps Script stores and reads back the shopper IP + browser in "Tracking Client"', () => {
  const { ctx } = loadCode();
  ctx.onlineOrderColumn_ = (_, c) => c;
  const sheet = fakeSheet([Array(38).fill('h'), Array(38).fill('')]);
  assert.equal(ctx.saveOnlineOrderTrackingClient_(sheet, 2, '103.4.5.6', 'Mozilla/5.0 test'), true);
  assert.equal(sheet.rows[0][38], 'Tracking Client');
  assert.deepEqual(JSON.parse(sheet.rows[1][38]), { ip: '103.4.5.6', ua: 'Mozilla/5.0 test' });
  assert.equal(JSON.stringify(ctx.readOnlineOrderTrackingClient_(sheet, 2)), JSON.stringify({ ip: '103.4.5.6', ua: 'Mozilla/5.0 test' }));
  // Bad IP is ignored; a foreign header in that column is never overwritten.
  assert.equal(ctx.cleanTrackingClientIp_('1.2.3.4<script>'), '');
  const other = fakeSheet([Array(39).fill('h'), Array(39).fill('')]);
  other.rows[0][38] = 'Something Else';
  assert.equal(ctx.saveOnlineOrderTrackingClient_(other, 2, '103.4.5.6', 'ua'), false);
  assert.equal(other.rows[1][38], '');
});

test('confirmed Purchase to Meta and TikTok carries IP, user agent and product contents', () => {
  const { ctx, calls } = loadCode();
  const contents = ctx.purchaseContentsFromCartJson_(JSON.stringify([{ id: 'MA-101', qty: 2, price: 1350 }, { id: '', qty: 1 }, { id: 'MA-7', qty: 1, price: 0 }]));
  assert.equal(JSON.stringify(contents), JSON.stringify([{ id: 'MA-101', quantity: 2, item_price: 1350 }, { id: 'MA-7', quantity: 1 }]));
  const data = { Name: 'Rahima', Phone: '01712345678', Total: '2700', Design: 'Abaya', ClientIP: '103.4.5.6', ClientUserAgent: 'Mozilla/5.0 test', Contents: contents, EventSourceUrl: 'https://muslimabaya.com/checkout' };
  assert.equal(ctx.sendToFacebookCAPI(data, 'order_x').ok, true);
  assert.equal(ctx.sendToTikTokCAPI(data, 'order_x').ok, true);
  const meta = calls[0].body.data[0];
  assert.equal(meta.event_name, 'Purchase');
  assert.equal(meta.event_id, 'order_x');
  assert.equal(meta.user_data.client_ip_address, '103.4.5.6');
  assert.equal(meta.user_data.client_user_agent, 'Mozilla/5.0 test');
  assert.deepEqual([...meta.custom_data.content_ids], ['MA-101', 'MA-7']);
  assert.equal(meta.custom_data.num_items, 3);
  const tt = calls[1].body.data[0];
  assert.equal(tt.event, 'CompletePayment');
  assert.equal(tt.user.ip, '103.4.5.6');
  assert.equal(tt.user.user_agent, 'Mozilla/5.0 test');
  assert.equal(tt.properties.contents[0].content_id, 'MA-101');
});

test('old orders without stored client info still send Purchase as before', () => {
  const { ctx, calls } = loadCode();
  const data = { Name: 'Rahima', Phone: '01712345678', Total: '1650', Design: 'Abaya' };
  assert.equal(ctx.sendToFacebookCAPI(data, 'order_y').ok, true);
  const meta = calls[0].body.data[0];
  assert.equal(meta.user_data.client_ip_address, undefined);
  assert.equal(meta.custom_data.content_ids, undefined);
  assert.equal(meta.custom_data.value, 1650);
});
