// Messenger webhook relay: verification is decided by Apps Script, messages are answered 200 at once
// and passed on unchanged, and an optional App Secret check rejects forged payloads.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');

const mod = () => import(path.join(__dirname, '../../functions/api/messenger-webhook.js'));
const PAYLOAD = JSON.stringify({ object: 'page', entry: [{ id: '381729145014885', messaging: [{ sender: { id: '42' }, message: { mid: 'm1', text: 'দাম কত?' } }] }] });

function upstream(answer) {
  const calls = [];
  const f = async (url, init = {}) => { calls.push({ url: String(url), init }); return { ok: true, text: async () => answer }; };
  return { f, calls };
}

test('verification passes only when Apps Script echoes the challenge', async () => {
  const { handleMessengerWebhook } = await mod();
  const ok = upstream('12345');
  const res = await handleMessengerWebhook(new Request('https://muslimabaya.com/api/messenger-webhook?hub.mode=subscribe&hub.verify_token=t&hub.challenge=12345'), {}, undefined, { fetch: ok.f });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '12345');
  assert.match(ok.calls[0].url, /\/exec\?hub\.mode=subscribe&hub\.verify_token=t&hub\.challenge=12345$/);
  const bad = upstream('forbidden');
  const res2 = await handleMessengerWebhook(new Request('https://muslimabaya.com/api/messenger-webhook?hub.mode=subscribe&hub.verify_token=x&hub.challenge=12345'), {}, undefined, { fetch: bad.f });
  assert.equal(res2.status, 403);
});

test('messages get 200 immediately and reach Apps Script unchanged', async () => {
  const { handleMessengerWebhook } = await mod();
  const up = upstream('');
  const waits = [];
  const res = await handleMessengerWebhook(new Request('https://muslimabaya.com/api/messenger-webhook', { method: 'POST', body: PAYLOAD }), {}, { waitUntil: (p) => waits.push(p) }, { fetch: up.f });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'EVENT_RECEIVED');
  await Promise.all(waits);
  assert.equal(up.calls.length, 1);
  assert.equal(up.calls[0].init.method, 'POST');
  assert.equal(up.calls[0].init.body, PAYLOAD);
  // Apps Script routes on this exact substring.
  assert.ok(up.calls[0].init.body.includes('"object":"page"'));
});

test('non-page payloads are not forwarded', async () => {
  const { handleMessengerWebhook } = await mod();
  const up = upstream('');
  const res = await handleMessengerWebhook(new Request('https://x/api/messenger-webhook', { method: 'POST', body: '{"object":"user"}' }), {}, { waitUntil() {} }, { fetch: up.f });
  assert.equal(res.status, 200);
  assert.equal(up.calls.length, 0);
});

test('with an App Secret set, only correctly signed payloads pass', async () => {
  const { handleMessengerWebhook } = await mod();
  const secret = 'test-app-secret';
  const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(PAYLOAD).digest('hex');
  const up = upstream('');
  const good = await handleMessengerWebhook(new Request('https://x/api/messenger-webhook', { method: 'POST', body: PAYLOAD, headers: { 'X-Hub-Signature-256': sig } }), { MSGR_APP_SECRET: secret }, { waitUntil() {} }, { fetch: up.f });
  assert.equal(good.status, 200);
  const forged = await handleMessengerWebhook(new Request('https://x/api/messenger-webhook', { method: 'POST', body: PAYLOAD, headers: { 'X-Hub-Signature-256': 'sha256=' + '0'.repeat(64) } }), { MSGR_APP_SECRET: secret }, { waitUntil() {} }, { fetch: up.f });
  assert.equal(forged.status, 403);
  const unsigned = await handleMessengerWebhook(new Request('https://x/api/messenger-webhook', { method: 'POST', body: PAYLOAD }), { MSGR_APP_SECRET: secret }, { waitUntil() {} }, { fetch: up.f });
  assert.equal(unsigned.status, 403);
  assert.equal(up.calls.length, 1);
});
