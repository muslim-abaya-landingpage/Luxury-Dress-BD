/**
 * GitHub App sign-in for the site's own GitHub writes (product save, SEO save, Purge All, scheduled rebuilds).
 *
 * With the Pages secrets GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY (the .pem GitHub gives when you create the app;
 * optional GITHUB_APP_INSTALLATION_ID), every request gets a fresh installation token that GitHub itself makes
 * for one hour — nothing for the owner to renew, ever. Without them the old personal GITHUB_TOKEN is used as is.
 *
 * Usage at an entry point:  env = await withGithubToken(env);  then code keeps reading env.GITHUB_TOKEN.
 * The private key and the tokens are never logged or returned.
 */

const DEFAULT_REPO = 'muslim-abaya-landingpage/Luxury-Dress-BD';
const API = 'https://api.github.com';
let cached = null; // { key, token, expiresAt } — per worker isolate

function b64url(bytes) {
  let bin = '';
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
const utf8 = (s) => new TextEncoder().encode(s);

function derLength(n) {
  if (n < 0x80) return [n];
  const out = [];
  while (n > 0) { out.unshift(n & 0xff); n >>= 8; }
  return [0x80 | out.length, ...out];
}
function der(tag, body) { return Uint8Array.from([tag, ...derLength(body.length), ...body]); }

/** PEM ("BEGIN RSA PRIVATE KEY" = PKCS#1, or "BEGIN PRIVATE KEY" = PKCS#8) → PKCS#8 DER bytes. */
export function pemToPkcs8(pem) {
  const text = String(pem || '').replace(/\\n/g, '\n').trim();
  const m = /-----BEGIN ((?:RSA )?PRIVATE KEY)-----([\s\S]+?)-----END \1-----/.exec(text);
  if (!m) throw new Error('BAD_PRIVATE_KEY');
  const raw = Uint8Array.from(atob(m[2].replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  if (m[1] === 'PRIVATE KEY') return raw;
  // PrivateKeyInfo { version 0, AlgorithmIdentifier { rsaEncryption, NULL }, OCTET STRING { RSAPrivateKey } }
  const version = [0x02, 0x01, 0x00];
  const algorithm = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const octet = der(0x04, Array.from(raw));
  return der(0x30, [...version, ...algorithm, ...octet]);
}

/** A 9-minute RS256 app JWT (GitHub allows at most 10). */
export async function appJwt(appId, pem, nowMs) {
  const key = await crypto.subtle.importKey('pkcs8', pemToPkcs8(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(nowMs / 1000);
  const head = b64url(utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64url(utf8(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) })));
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(head + '.' + body)));
  return head + '.' + body + '.' + b64url(sig);
}

export function githubAppConfigured(env) {
  return !!(env && env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY);
}

/** Fresh (or cached, >5 min left) installation token for the repository. Throws Error(code) on failure. */
export async function installationToken(env, fetchImpl = fetch, nowMs = Date.now()) {
  const repo = env.GITHUB_REPO || DEFAULT_REPO;
  const cacheKey = env.GITHUB_APP_ID + '|' + repo;
  if (cached && cached.key === cacheKey && cached.expiresAt - nowMs > 5 * 60000) return cached.token;
  const jwt = await appJwt(env.GITHUB_APP_ID, env.GITHUB_APP_PRIVATE_KEY, nowMs);
  const headers = { Authorization: 'Bearer ' + jwt, Accept: 'application/vnd.github+json', 'User-Agent': 'MuslimAbaya-GitHubApp', 'X-GitHub-Api-Version': '2022-11-28' };
  let id = String(env.GITHUB_APP_INSTALLATION_ID || '').trim();
  if (!id) {
    const r = await fetchImpl(API + '/repos/' + repo + '/installation', { headers });
    if (!r.ok) throw new Error(r.status === 404 ? 'APP_NOT_INSTALLED' : 'APP_AUTH_' + r.status);
    id = String((await r.json()).id || '');
  }
  const res = await fetchImpl(API + '/app/installations/' + id + '/access_tokens', { method: 'POST', headers });
  if (!res.ok) throw new Error('APP_TOKEN_' + res.status);
  const data = await res.json();
  const expiresAt = Date.parse(data.expires_at || '') || nowMs + 3600000;
  cached = { key: cacheKey, token: data.token, expiresAt };
  return data.token;
}

/**
 * env with GITHUB_TOKEN = a GitHub App installation token when the app is set up; otherwise env unchanged.
 * If the app is set up but GitHub refuses, the personal token (if any) is kept so saving still works,
 * and GITHUB_APP_ERROR tells token-status what went wrong.
 */
export async function withGithubToken(env, fetchImpl = fetch, nowMs = Date.now()) {
  if (!githubAppConfigured(env)) return env;
  try {
    const token = await installationToken(env, fetchImpl, nowMs);
    return Object.assign({}, env, { GITHUB_TOKEN: token, GITHUB_TOKEN_SOURCE: 'app' });
  } catch (e) {
    return Object.assign({}, env, { GITHUB_APP_ERROR: String(e && e.message || e) });
  }
}

export function _resetGithubAppCache() { cached = null; }
