import { createCore } from '../_lib/gs-core.js';
import { buildEnv } from '../_lib/sheets-shim.js';
import { loadSnapshot } from '../_lib/sheet-snapshot.js';
import { getAccessToken } from '../_lib/google-auth.js';
import { ASSET_PATH } from '../_lib/live-catalog.js';

const DEFAULT_SHEET_ID = '1kHt7Bdd4OnpX0jb1ApBXMZIIYqvmv5q2EyOnPV9HJKo';
const MAX_BODY = 6_000_000;
const MAX_IMAGE_BYTES = 4_194_304;
const CDN_BASE = 'https://images.muslimabaya.com/';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function decodeWebP(base64, path) {
  if (!ASSET_PATH.test(path) || !path.endsWith('.webp')) throw Error('BAD_PATH');
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) throw Error('BAD_IMAGE');
  const raw = atob(base64);
  if (!raw.length || raw.length > MAX_IMAGE_BYTES) throw Error('IMAGE_TOO_LARGE');
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (bytes[0] !== 82 || bytes[1] !== 73 || bytes[2] !== 70 || bytes[3] !== 70 ||
      bytes[8] !== 87 || bytes[9] !== 69 || bytes[10] !== 66 || bytes[11] !== 80) throw Error('BAD_IMAGE_TYPE');
  return bytes;
}

async function isOwner(token, env, fetchImpl, now) {
  const access = await getAccessToken(env.GOOGLE_SA_JSON, fetchImpl, now);
  const snapshot = await loadSnapshot({
    spreadsheetId: env.SHEET_ID || DEFAULT_SHEET_ID,
    token: access,
    sheets: ['Sessions', 'Admins'],
    fetchImpl,
    nowMs: now,
  });
  const core = createCore(buildEnv(snapshot));
  const who = core.verifyAdminSession_(token);
  if (!who || !who.ok) return 'NOT_LOGGED_IN';
  return core.requireOwnerAdmin_(who) ? 'OWNER_ONLY' : '';
}

export async function handleImageUpload(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  if (!env || !env.PRODUCT_IMAGES || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY) return json({ ok: false, error: 'TOO_LARGE' }, 413);

  let payload;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ ok: false, error: 'TOO_LARGE' }, 413);
    payload = JSON.parse(text);
  } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  const token = String(payload && payload.Token || '').trim();
  if (!token) return json({ ok: false, error: 'NO_TOKEN' }, 401);

  try {
    const error = deps.authorize ? await deps.authorize(token, env) : await isOwner(token, env, fetchImpl, now);
    if (error === 'NOT_LOGGED_IN') return json({ ok: false, error }, 401);
    if (error) return json({ ok: false, error }, 403);
  } catch (e) { return json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503); }

  let bytes;
  const path = String(payload.path || '');
  try { bytes = decodeWebP(payload.content, path); }
  catch (e) { return json({ ok: false, error: String(e.message || 'BAD_IMAGE') }, 400); }

  try {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    const slash = path.lastIndexOf('/');
    const key = path.slice(0, slash + 1) + path.slice(slash + 1, -'.webp'.length) + '-' + hash.slice(0, 20) + '.webp';
    await env.PRODUCT_IMAGES.put(key, bytes, {
      httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' },
      customMetadata: { sourcePath: path },
    });
    const url = CDN_BASE + key.split('/').map(encodeURIComponent).join('/');
    return json({ ok: true, key, url, bytes: bytes.byteLength });
  } catch (e) { return json({ ok: false, error: 'R2_WRITE_FAILED' }, 503); }
}

export const onRequestPost = ({ request, env }) => handleImageUpload(request, env);
