/**
 * POST /api/review-photo — a customer's review photo (already shrunk to WebP in the browser).
 * Stored in the image bucket as reviews/<year>/<uuid>.webp and returned as an images.muslimabaya.com URL.
 * The photo is shown nowhere until the review is approved in Admin → Reviews, and Apps Script accepts
 * photos only on reviews from a verified (delivered) order. Limits: 700 KB, WebP only, 9 photos per IP per hour.
 * Body: {image: base64 WebP}. Reply: {ok, url} | {ok:false, error}.
 */
const MAX_BYTES = 700_000;
const PER_HOUR = 9;
const CDN = 'https://images.muslimabaya.com/';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export function reviewWebP(base64) {
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) throw Error('BAD_IMAGE');
  if (base64.length > Math.ceil(MAX_BYTES / 3) * 4) throw Error('IMAGE_TOO_LARGE');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  if (bytes.length < 16 || bytes[0] !== 82 || bytes[1] !== 73 || bytes[2] !== 70 || bytes[3] !== 70 ||
      bytes[8] !== 87 || bytes[9] !== 69 || bytes[10] !== 66 || bytes[11] !== 80) throw Error('BAD_IMAGE_TYPE');
  return bytes;
}

async function underLimit(db, ip, nowMs) {
  if (!db) return true;
  const hour = Math.floor(nowMs / 3600000);
  await db.prepare('CREATE TABLE IF NOT EXISTS review_photo_rate (ip TEXT NOT NULL, hour INTEGER NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (ip, hour))').run();
  const r = await db.prepare('INSERT INTO review_photo_rate (ip, hour, n) VALUES (?, ?, 1) ON CONFLICT(ip, hour) DO UPDATE SET n = n + 1 WHERE n < ? RETURNING n')
    .bind(ip, hour, PER_HOUR).first();
  if (Math.random() < 0.02) await db.prepare('DELETE FROM review_photo_rate WHERE hour < ?').bind(hour - 24).run();
  return !!r;
}

export async function handleReviewPhoto(request, env, deps = {}) {
  const now = deps.now ? deps.now() : Date.now();
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  if (!env || !env.PRODUCT_IMAGES) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BYTES * 1.5) return json({ ok: false, error: 'IMAGE_TOO_LARGE' }, 413);
  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'BAD_JSON' }, 400); }
  let bytes;
  try { bytes = reviewWebP(body && body.image); } catch (e) { return json({ ok: false, error: e.message }, 400); }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await underLimit(env.STOCK_DB, ip, now))) return json({ ok: false, error: 'TOO_MANY' }, 429);
  const key = 'reviews/' + new Date(now).getUTCFullYear() + '/' + (deps.uuid ? deps.uuid() : crypto.randomUUID()) + '.webp';
  try {
    await env.PRODUCT_IMAGES.put(key, bytes, { httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' }, customMetadata: { kind: 'review' } });
  } catch (e) { return json({ ok: false, error: 'STORE_FAILED' }, 503); }
  return json({ ok: true, url: CDN + key });
}

export const onRequestPost = ({ request, env }) => handleReviewPhoto(request, env);
