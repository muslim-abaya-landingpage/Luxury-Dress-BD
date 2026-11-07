// /api/token-status: owner-only; reports whether the Cloudflare GITHUB_TOKEN works and when it expires (never the token itself).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const mod = () => import(path.join(root, 'functions/api/token-status.js'));
const NOW = Date.UTC(2026, 10, 7, 9, 0, 0);
const owner = { authorize: async (t) => (t === 'tok-owner' ? '' : 'OWNER_ONLY'), now: () => NOW };
const req = (body, origin = 'https://muslimabaya.com') => new Request('https://muslimabaya.com/api/token-status', { method: 'POST', headers: { Origin: origin }, body: JSON.stringify(body) });
const gh = (status, expiry) => async (url, init) => {
  assert.match(String(url), /api\.github\.com\/repos\/muslim-abaya-landingpage\/Luxury-Dress-BD$/);
  assert.equal(init.headers.Authorization, 'Bearer ghp-secret');
  const headers = new Headers();
  if (expiry) headers.set('github-authentication-token-expiration', expiry);
  return new Response('{}', { status, headers });
};
async function status(env, fetchImpl) {
  const { handleTokenStatus } = await mod();
  const r = await handleTokenStatus(req({ Token: 'tok-owner' }), Object.assign({ GOOGLE_SA_JSON: 'x', STOCK_DB: {}, PRODUCT_IMAGES: {} }, env), Object.assign({ fetch: fetchImpl }, owner));
  const body = await r.json();
  return { r, body, github: body.items && body.items.find((i) => i.id === 'cf-github') };
}

test('reads GitHub expiry header formats', async () => {
  const { parseGithubExpiry } = await mod();
  assert.equal(parseGithubExpiry('2026-12-01 10:00:00 UTC').toISOString(), '2026-12-01T10:00:00.000Z');
  assert.equal(parseGithubExpiry('2026-12-01 16:00:00 +0600').toISOString(), '2026-12-01T10:00:00.000Z');
  assert.equal(parseGithubExpiry('nonsense'), null);
});

test('no expiry, far expiry, soon, expired, broken, missing', async () => {
  let s = await status({ GITHUB_TOKEN: 'ghp-secret' }, gh(200));
  assert.equal(s.github.state, 'ok'); assert.match(s.github.message, /মেয়াদ নেই/);
  s = await status({ GITHUB_TOKEN: 'ghp-secret' }, gh(200, '2027-05-07 09:00:00 UTC'));
  assert.equal(s.github.state, 'ok'); assert.equal(s.github.daysLeft, 181);
  s = await status({ GITHUB_TOKEN: 'ghp-secret' }, gh(200, '2026-11-17 09:00:00 UTC'));
  assert.equal(s.github.state, 'warn'); assert.equal(s.github.daysLeft, 10); assert.match(s.github.message, /2026-11-17/);
  s = await status({ GITHUB_TOKEN: 'ghp-secret' }, gh(401));
  assert.equal(s.github.state, 'bad');
  s = await status({ GITHUB_TOKEN: 'ghp-secret' }, gh(403));
  assert.equal(s.github.state, 'bad'); assert.match(s.github.message, /Contents/);
  s = await status({}, async () => assert.fail('no GitHub call without a token'));
  assert.equal(s.github.state, 'off');
  assert.ok(!JSON.stringify(s.body).includes('ghp-secret'));
});

test('owner only, same site only', async () => {
  const { handleTokenStatus } = await mod();
  const env = { GOOGLE_SA_JSON: 'x', GITHUB_TOKEN: 'ghp-secret' };
  assert.equal((await handleTokenStatus(req({ Token: 'tok-staff' }), env, owner)).status, 403);
  assert.equal((await handleTokenStatus(req({}), env, owner)).status, 401);
  assert.equal((await handleTokenStatus(req({ Token: 'tok-owner' }, 'https://evil.example'), env, owner)).status, 403);
});
