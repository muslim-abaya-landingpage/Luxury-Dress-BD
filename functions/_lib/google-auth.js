/**
 * Google service-account access token (OAuth JWT bearer flow) using WebCrypto — no libraries.
 * The token is kept in memory for the life of the Worker isolate and refreshed 5 minutes early.
 */
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
let cached = { key: '', token: '', exp: 0 };

function b64url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem) {
  const body = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function parseServiceAccount(raw) {
  let sa;
  try { sa = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { throw new Error('SA_JSON_INVALID'); }
  if (!sa || !sa.client_email || !sa.private_key) throw new Error('SA_JSON_INVALID');
  return { email: sa.client_email, key: sa.private_key, tokenUri: sa.token_uri || 'https://oauth2.googleapis.com/token' };
}

export async function getAccessToken(rawServiceAccount, fetchImpl = fetch, nowMs = Date.now()) {
  const sa = parseServiceAccount(rawServiceAccount);
  if (cached.key === sa.email && cached.token && nowMs < cached.exp - 300000) return cached.token;
  const iat = Math.floor(nowMs / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: sa.email, scope: SCOPE, aud: sa.tokenUri, iat, exp: iat + 3600 }));
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(sa.key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(header + '.' + claims));
  const assertion = header + '.' + claims + '.' + b64url(sig);
  const res = await fetchImpl(sa.tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + assertion,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error('SA_TOKEN_FAILED');
  cached = { key: sa.email, token: data.access_token, exp: nowMs + (Number(data.expires_in) || 3600) * 1000 };
  return cached.token;
}

export function _resetTokenCache() { cached = { key: '', token: '', exp: 0 }; }
