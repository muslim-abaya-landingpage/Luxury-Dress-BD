/**
 * Verifies a GitHub Actions OIDC token (no shared secret needed). GitHub signs a short-lived JWT for each
 * workflow run; we check the signature with GitHub's published keys and that the token comes from THIS
 * repository's main branch and the expected workflow file, for our audience.
 */
const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS_URL = ISSUER + '/.well-known/jwks';
let jwksCache = { at: 0, keys: [] };

function b64urlBytes(s) {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(s).length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
const b64urlJson = (s) => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

async function jwks(fetchImpl, now) {
  if (jwksCache.keys.length && now - jwksCache.at < 3600e3) return jwksCache.keys;
  const res = await fetchImpl(JWKS_URL);
  if (!res.ok) throw Error('JWKS_' + res.status);
  const data = await res.json();
  jwksCache = { at: now, keys: data.keys || [] };
  return jwksCache.keys;
}

/** Returns the claims, or throws. opts: {audience, repository, workflow (path in repo), ref} */
export async function verifyGithubOidc(token, opts, fetchImpl = fetch, now = Date.now()) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw Error('BAD_TOKEN');
  const header = b64urlJson(parts[0]);
  const claims = b64urlJson(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw Error('BAD_ALG');
  const jwk = (await jwks(fetchImpl, now)).find((k) => k.kid === header.kid);
  if (!jwk) throw Error('UNKNOWN_KEY');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!ok) throw Error('BAD_SIGNATURE');
  const sec = Math.floor(now / 1000);
  if (claims.iss !== ISSUER) throw Error('BAD_ISSUER');
  if ([].concat(claims.aud).indexOf(opts.audience) < 0) throw Error('BAD_AUDIENCE');
  if (!(claims.exp > sec) || (claims.nbf && claims.nbf > sec + 60)) throw Error('EXPIRED');
  if (claims.repository !== opts.repository) throw Error('BAD_REPOSITORY');
  if (claims.ref !== (opts.ref || 'refs/heads/main')) throw Error('BAD_REF');
  const wf = opts.repository + '/' + opts.workflow + '@' + (opts.ref || 'refs/heads/main');
  if (claims.job_workflow_ref !== wf && claims.workflow_ref !== wf) throw Error('BAD_WORKFLOW');
  return claims;
}
export function _resetJwksCache() { jwksCache = { at: 0, keys: [] }; }
