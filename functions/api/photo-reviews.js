/**
 * GET /api/photo-reviews — latest approved customer photo reviews (for the "Customer photos" strip).
 * Read from Apps Script (GetPhotoReviews) and kept in Cloudflare's cache for 10 minutes so the home page
 * does not wait on Google. Reply: {ok, reviews:[{productId, productName, name, rating, comment, photos, date}]}.
 */
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxZv7KU0JMY90576HoRF8wtHmEgW2ggkTxAoQKjO6on1cactlDgJDhoRLndCh3kK_hz/exec';
const TTL = 600;

export async function handlePhotoReviews(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const key = new Request(new URL('/api/photo-reviews', request.url).toString());
  if (cache) { const hit = await cache.match(key); if (hit) return hit; }
  let data = { ok: false, reviews: [] };
  try {
    const r = await fetchImpl(APPS_SCRIPT_URL + '?RecordType=GetPhotoReviews', { redirect: 'follow' });
    const j = await r.json();
    if (j && j.ok && Array.isArray(j.reviews)) data = { ok: true, reviews: j.reviews.slice(0, 12) };
  } catch (e) {}
  const res = new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': data.ok ? 'public, max-age=' + TTL : 'no-store' } });
  if (cache && data.ok) { try { await cache.put(key, res.clone()); } catch (e) {} }
  return res;
}

export const onRequestGet = ({ request, env }) => handlePhotoReviews(request, env);
