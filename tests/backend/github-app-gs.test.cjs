// Apps Script GitHub App: GitHub's .pem is converted for Apps Script and signs a valid app JWT; the backup save
// path uses the App token when the key is saved, and the old GITHUB_TOKEN otherwise. Keys never leave.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { generateKeyPairSync, createPrivateKey, createSign, createVerify } = require('node:crypto');

const src = fs.readFileSync(path.join(__dirname, '../../apps-script/GithubApp.gs'), 'utf8');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PKCS1 = privateKey.export({ type: 'pkcs1', format: 'pem' });
const signed = (buf) => Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
const toBuf = (x) => (typeof x === 'string' ? Buffer.from(x, 'utf8') : Buffer.from(x.map((b) => b & 0xff)));

function load(fetchImpl, props) {
  const cache = {};
  const ctx = {
    JSON, String, Math, Date, Error, console: { warn() {} },
    Utilities: {
      base64Decode: (s) => signed(Buffer.from(s, 'base64')),
      base64Encode: (x) => toBuf(x).toString('base64'),
      base64EncodeWebSafe: (x) => toBuf(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
      computeRsaSha256Signature: (input, pem) => { assert.match(pem, /^-----BEGIN PRIVATE KEY-----\n/); const s = createSign('RSA-SHA256'); s.update(input); return signed(s.sign(createPrivateKey(pem))); },
    },
    UrlFetchApp: { fetch: fetchImpl },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    verifyAdminSession_: (t) => (t === 'owner' ? { ok: true } : { ok: false, error: 'NOT_LOGGED_IN' }),
    requireOwnerAdmin_: () => null,
    param_: (e, k) => e.parameter[k],
  };
  vm.runInNewContext(src, ctx);
  return ctx;
}
const b64json = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
function githubFake(calls, { tokenStatus = 201 } = {}) {
  return (url, opt) => {
    calls.push([opt.method || 'get', url, opt.headers.Authorization]);
    if (/access_tokens$/.test(url)) {
      const jwt = opt.headers.Authorization.replace('Bearer ', '');
      const [h, b, sig] = jwt.split('.');
      const v = createVerify('RSA-SHA256'); v.update(h + '.' + b);
      assert.ok(v.verify(publicKey, Buffer.from(sig.replace(/-/g, '+').replace(/_/g, '/'), 'base64')), 'JWT signature');
      assert.equal(b64json(b).iss, '5791466');
      return { getResponseCode: () => tokenStatus, getContentText: () => JSON.stringify({ token: 'ghs_from_app' }) };
    }
    return { getResponseCode: () => 200, getContentText: () => '{}' };
  };
}

test('GitHub .pem (PKCS#1) → PKCS#8 that a crypto library accepts as the same key', () => {
  const ctx = load(() => { throw Error('no'); }, {});
  const pem = ctx.ghPkcs8Pem_(PKCS1);
  const k = createPrivateKey(pem);
  assert.equal(k.asymmetricKeyType, 'rsa');
  assert.equal(k.export({ type: 'pkcs1', format: 'pem' }), PKCS1);
  assert.equal(ctx.ghPkcs8Pem_(PKCS1.replace(/\n/g, '\\n')), pem); // pasted with literal \n
  assert.throws(() => ctx.ghPkcs8Pem_('hello'), /BAD_PRIVATE_KEY/);
});

test('saving the key: owner only, checked with GitHub first, stored as PKCS#8, reply holds no key or token', () => {
  const calls = []; const props = {};
  const ctx = load(githubFake(calls), props);
  assert.equal(ctx.saveGithubAppKey_({ parameter: { Token: 'nobody', PrivateKey: PKCS1 } }).ok, false);
  assert.equal(calls.length, 0);
  const r = ctx.saveGithubAppKey_({ parameter: { Token: 'owner', PrivateKey: PKCS1 } });
  assert.equal(r.ok, true);
  assert.match(props.GITHUB_APP_PRIVATE_KEY, /^-----BEGIN PRIVATE KEY-----/);
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE|ghs_/);
  assert.ok(calls.some((c) => /\/repos\/muslim-abaya-landingpage\/Luxury-Dress-BD$/.test(c[1]) && c[2] === 'Bearer ghs_from_app'));
  const bad = load(githubFake([], { tokenStatus: 401 }), {});
  assert.equal(bad.saveGithubAppKey_({ parameter: { Token: 'owner', PrivateKey: PKCS1 } }).error, 'APP_KEY_REJECTED');
});

test('githubToken_: App token when the key is saved (cached), old GITHUB_TOKEN otherwise or if GitHub refuses', () => {
  const calls = [];
  const withKey = load(githubFake(calls), { GITHUB_APP_PRIVATE_KEY: load(() => {}, {}).ghPkcs8Pem_(PKCS1), GITHUB_TOKEN: 'pat' });
  assert.equal(withKey.githubToken_(), 'ghs_from_app');
  assert.equal(withKey.githubToken_(), 'ghs_from_app');
  assert.equal(calls.length, 1, 'cached');
  assert.equal(load(() => { throw Error('no call'); }, { GITHUB_TOKEN: 'pat' }).githubToken_(), 'pat');
  const refused = load(githubFake([], { tokenStatus: 500 }), { GITHUB_APP_PRIVATE_KEY: load(() => {}, {}).ghPkcs8Pem_(PKCS1), GITHUB_TOKEN: 'pat' });
  assert.equal(refused.githubToken_(), 'pat');
});

test('every Apps Script GitHub call goes through githubToken_', () => {
  const all = ['Code.gs', 'CatalogPublish.gs'].map((f) => fs.readFileSync(path.join(__dirname, '../../apps-script', f), 'utf8')).join('\n');
  assert.doesNotMatch(all, /getProperty\('GITHUB_TOKEN'\)/);
  assert.equal((all.match(/githubToken_\(\)/g) || []).length, 5);
});
