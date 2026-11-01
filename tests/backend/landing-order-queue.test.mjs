// Landing page (shop.muslimabaya.com) order safety net in the Worker: the order is kept in D1, the live
// request is passed through unchanged, and failures are retried via the Pages project URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { default: worker } = await import(path.join(root, 'cloudflare-worker/worker.js'));
const INBOX_SQL = `CREATE TABLE order_inbox (event_id TEXT PRIMARY KEY, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_at INTEGER NOT NULL DEFAULT 0, target TEXT NOT NULL,
  payload TEXT NOT NULL, name TEXT, phone TEXT, total TEXT, order_id TEXT, last_response TEXT)`;
function makeD1() {
  const db = new DatabaseSync(':memory:'); db.exec(INBOX_SQL);
  return { raw: db, prepare(sql) { let a = []; const st = { bind(...x) { a = x.map((v) => (v === undefined ? null : v)); return st; }, async first() { return db.prepare(sql).get(...a) || null; }, async all() { return { results: db.prepare(sql).all(...a) }; }, async run() { db.prepare(sql).run(...a); return {}; } }; return st; } };
}

test('landing orders: pass-through, keep, retry, fail-open', async () => {
  const realFetch = globalThis.fetch;
  try {
let originResponder, originCalls = [], retryCalls = [], tg = [];
globalThis.fetch = async (input, opts) => {
  if (input instanceof Request) {
    const body = await input.text();
    originCalls.push({ url: input.url, body, ip: input.headers.get('CF-Connecting-IP') });
    return originResponder(body);
  }
  const url = String(input);
  if (url.startsWith('https://muslimabaya-shop-landing.pages.dev/api/order')) {
    retryCalls.push({ body: String(opts.body), origin: (opts.headers || {}).Origin });
    return originResponder(String(opts.body));
  }
  if (url.startsWith('https://api.telegram.org/')) { tg.push(JSON.parse(opts.body)); return new Response('{}'); }
  throw new Error('unexpected ' + url);
};
const waits = []; const ctx = { waitUntil: (p) => waits.push(p) }; const settle = () => Promise.all(waits.splice(0));
const req = (eid, extra = {}) => new Request('https://shop.muslimabaya.com/api/order', { method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'CF-Connecting-IP': '198.51.100.9' },
  body: new URLSearchParams({ Name: 'Rahima', Phone: '01712345678', Total: '1850', EventID: eid, Design: 'Hafeza', ...extra }) });
const ok = (t, s = 200) => () => new Response(t, { status: s });
const row = (env, id) => env.DB.raw.prepare('SELECT * FROM order_inbox WHERE event_id = ?').get(id);

// 1. success: passed through unchanged (same request, customer IP kept), stored as saved
let env = { DB: makeD1(), TELEGRAM_BOT_TOKEN: 't', TELEGRAM_CHAT_ID: '1' };
originResponder = ok('Success|LP-501');
let r = await worker.fetch(req('lp_1'), env, ctx); await settle();
assert.equal(r.status, 200); assert.equal(await r.text(), 'Success|LP-501');
assert.equal(originCalls.length, 1); assert.equal(originCalls[0].ip, '198.51.100.9'); assert.match(originCalls[0].body, /EventID=lp_1/);
assert.equal(row(env, 'lp_1').status, 'saved'); assert.equal(row(env, 'lp_1').order_id, 'LP-501');
// resubmit of a saved order: no second write
originCalls = []; r = await worker.fetch(req('lp_1'), env, ctx);
assert.equal(await r.text(), 'Success|LP-501'); assert.equal(originCalls.length, 0);

// 2. real rejection (e.g. bad phone) goes back to the customer unchanged, status kept
originResponder = ok('Error|ফোন নম্বর সঠিক নয়', 400);
r = await worker.fetch(req('lp_2'), env, ctx); await settle();
assert.equal(r.status, 400); assert.equal(await r.text(), 'Error|ফোন নম্বর সঠিক নয়');
assert.equal(row(env, 'lp_2').status, 'rejected');

// 3. origin crash / Google error page: kept + customer gets a reference instead of an error
originResponder = ok('<html>Error 1101</html>', 500);
r = await worker.fetch(req('lp_3'), env, ctx);
assert.equal(r.status, 200); assert.equal(r.headers.get('X-MA-Queued'), '1');
const t3 = await r.text(); assert.match(t3, /^Success\|MA-[A-Z0-9]+$/);
assert.equal(row(env, 'lp_3').status, 'retry'); assert.equal(row(env, 'lp_3').target, 'landing:https://muslimabaya-shop-landing.pages.dev/api/order');
// "Success|" with empty id counts as failure for the landing page, so it is queued too
originResponder = ok('Success|');
r = await worker.fetch(req('lp_3b'), env, ctx); assert.match(await r.text(), /^Success\|MA-/); assert.equal(row(env, 'lp_3b').status, 'retry');
// customer presses submit again while queued: no second post
originCalls = []; r = await worker.fetch(req('lp_3'), env, ctx); assert.match(await r.text(), /^Success\|MA-/); assert.equal(originCalls.length, 0);

// 4. cron retries via pages.dev with the exact stored fields; recovers
env.DB.raw.prepare("UPDATE order_inbox SET next_at = 0 WHERE status = 'retry'").run();
originResponder = ok('Success|LP-777'); retryCalls = [];
await worker.scheduled({}, env, ctx); await settle();
assert.equal(retryCalls.length, 2); assert.equal(retryCalls[0].origin, undefined, 'no Origin header, or the landing Worker answers 403');
assert.match(retryCalls[0].body, /EventID=lp_3/); assert.match(retryCalls[0].body, /Design=Hafeza/);
assert.equal(row(env, 'lp_3').status, 'saved'); assert.equal(row(env, 'lp_3').order_id, 'LP-777');

// 5. retry answered DUPLICATE -> human check + Telegram
originResponder = ok('<html>x</html>', 502);
await worker.fetch(req('lp_4'), env, ctx);
env.DB.raw.prepare("UPDATE order_inbox SET next_at = 0 WHERE event_id = 'lp_4'").run();
tg = []; originResponder = ok('Error|এই অর্ডার আগেই নেওয়া হয়েছে (DUPLICATE_ORDER)');
await worker.scheduled({}, env, ctx); await settle();
assert.equal(row(env, 'lp_4').status, 'needs_attention'); assert.equal(tg.length, 1); assert.match(tg[0].text, /01712345678/);

// 6. fail-open: no DB, non-form body, or bad EventID -> plain pass-through, nothing stored
originResponder = ok('Success|LP-9'); originCalls = [];
r = await worker.fetch(req('lp_5'), {}, ctx); assert.equal(await r.text(), 'Success|LP-9'); assert.equal(originCalls.length, 1);
r = await worker.fetch(req('bad id with spaces'), env, ctx); assert.equal(await r.text(), 'Success|LP-9');
assert.equal(row(env, 'bad id with spaces'), undefined);
const jsonReq = new Request('https://shop.muslimabaya.com/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"EventID":"j1"}' });
r = await worker.fetch(jsonReq, env, ctx); assert.equal(await r.text(), 'Success|LP-9'); assert.equal(row(env, 'j1'), undefined);
// D1 failure -> pass-through
const broken = { DB: { prepare() { throw new Error('d1 down'); } } };
r = await worker.fetch(req('lp_6'), broken, ctx); assert.equal(await r.text(), 'Success|LP-9');

// 7. main-site queue still uses the Apps Script path (unchanged): a GET to /api/order is not intercepted
  } finally { globalThis.fetch = realFetch; }
});
