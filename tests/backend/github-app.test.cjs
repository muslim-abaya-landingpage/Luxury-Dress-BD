// GitHub App: the site makes its own 1-hour GitHub tokens from the app's private key (nothing to renew).
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateKeyPairSync, createVerify } = require('node:crypto');

const lib = () => import('../../functions/api/../_lib/github-app.js');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PKCS1 = privateKey.export({ type: 'pkcs1', format: 'pem' }); // what GitHub's .pem looks like
const PKCS8 = privateKey.export({ type: 'pkcs8', format: 'pem' });
const b64urlJson = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());

function verifyJwt(jwt) {
  const [h, b, sig] = jwt.split('.');
  const v = createVerify('RSA-SHA256'); v.update(h + '.' + b);
  assert.ok(v.verify(publicKey, Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64')), 'signature');
  return { head: b64urlJson(h), body: b64urlJson(b) };
}

test('app JWT is RS256-signed with the GitHub .pem (PKCS#1), PKCS#8 and pasted "\\n" keys too', async () => {
  const { appJwt } = await lib();
  for (const pem of [PKCS1, PKCS8, PKCS1.replace(/\n/g, '\\n')]) {
    const { head, body } = verifyJwt(await appJwt(123456, pem, 1_800_000_000_000));
    assert.equal(head.alg, 'RS256');
    assert.equal(body.iss, '123456');
    assert.equal(body.exp - body.iat, 600);
  }
  await assert.rejects(appJwt(1, 'not a key', Date.now()), /BAD_PRIVATE_KEY/);
});

test('installation token: finds the installation, caches for the hour, and replaces env.GITHUB_TOKEN', async () => {
  const { withGithubToken, _resetGithubAppCache } = await lib();
  _resetGithubAppCache();
  const calls = [];
  const fake = async (url, init = {}) => {
    calls.push([init.method || 'GET', url]);
    const jwt = init.headers.Authorization.replace('Bearer ', '');
    verifyJwt(jwt);
    if (url.endsWith('/repos/muslim-abaya-landingpage/Luxury-Dress-BD/installation')) return new Response(JSON.stringify({ id: 777 }), { status: 200 });
    if (url.endsWith('/app/installations/777/access_tokens')) return new Response(JSON.stringify({ token: 'ghs_fresh', expires_at: '2027-01-15T09:00:00Z' }), { status: 201 });
    return new Response('{}', { status: 404 });
  };
  const env = { GITHUB_APP_ID: '42', GITHUB_APP_PRIVATE_KEY: PKCS1, GITHUB_TOKEN: 'old_pat', OTHER: 1 };
  const now = Date.parse('2027-01-15T08:00:00Z');
  const a = await withGithubToken(env, fake, now);
  assert.equal(a.GITHUB_TOKEN, 'ghs_fresh'); assert.equal(a.GITHUB_TOKEN_SOURCE, 'app'); assert.equal(a.OTHER, 1);
  assert.equal(env.GITHUB_TOKEN, 'old_pat', 'original env untouched');
  assert.equal(calls.length, 2);
  await withGithubToken(env, fake, now + 30 * 60000); // still 30 min left → cached
  assert.equal(calls.length, 2);
  await withGithubToken(env, fake, now + 56 * 60000); // <5 min left → new token
  assert.equal(calls.length, 4);
});

test('not installed / no app: personal token kept, the reason is reported; without app config env is unchanged', async () => {
  const { withGithubToken, _resetGithubAppCache } = await lib();
  _resetGithubAppCache();
  const env = { GITHUB_APP_ID: '42', GITHUB_APP_PRIVATE_KEY: PKCS8, GITHUB_TOKEN: 'old_pat' };
  const r = await withGithubToken(env, async () => new Response('{}', { status: 404 }), Date.now());
  assert.equal(r.GITHUB_TOKEN, 'old_pat'); assert.equal(r.GITHUB_APP_ERROR, 'APP_NOT_INSTALLED');
  const plain = { GITHUB_TOKEN: 'p' };
  assert.equal(await withGithubToken(plain, async () => { throw Error('no call'); }), plain);
});

test('every GitHub-writing endpoint asks for the app token first', () => {
  const fs = require('fs'); const path = require('path');
  for (const f of ['catalog-state', 'catalog-save', 'seo-settings', 'admin-purge', 'cron-tick', 'token-status']) {
    const src = fs.readFileSync(path.join(__dirname, '../../functions/api/' + f + '.js'), 'utf8');
    assert.match(src, /export const onRequestPost = async \(\{ request, env \}\) => \w+\(request, await withGithubToken\(env\)\);/, f);
  }
});

test('token status says "GitHub App, never renew" when the app token works', async () => {
  const { checkGithubToken } = await import('../../functions/api/token-status.js');
  const ok = await checkGithubToken({ GITHUB_TOKEN: 'ghs_x', GITHUB_TOKEN_SOURCE: 'app' }, async () => new Response('{}', { status: 200, headers: { 'github-authentication-token-expiration': '2027-01-15 09:00:00 UTC' } }), Date.now());
  assert.equal(ok.state, 'ok'); assert.equal(ok.name, 'GitHub App'); assert.match(ok.message, /কখনো নবায়ন করতে হবে না/);
  const bad = await checkGithubToken({ GITHUB_TOKEN: 'pat', GITHUB_APP_ERROR: 'APP_NOT_INSTALLED' }, async () => { throw Error('x'); }, Date.now());
  assert.equal(bad.state, 'bad'); assert.match(bad.message, /install করা নেই/);
});
