/** GET /api/live-img/images/uploads/<file> — a photo from the last save, until the deploy has it. */
import { ASSET_PATH } from '../../_lib/live-catalog.js';

export async function onRequestGet({ request, env, params }) {
  const path = [].concat(params.path || []).join('/');
  const url = new URL(request.url);
  if (!ASSET_PATH.test(path)) return new Response('Not found', { status: 404 });
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  if (cache) {
    const hit = await cache.match(request).catch(() => null);
    if (hit) return hit;
  }
  let row = null;
  try {
    if (env.STOCK_DB) row = await env.STOCK_DB.prepare('SELECT data, ctype FROM live_assets WHERE path = ?').bind(path).first();
  } catch (e) {}
  // Not (or no longer) kept here: the deployed site has it by now.
  if (!row) return Response.redirect(url.origin + '/' + path, 302);
  const data = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data).buffer;
  const res = new Response(data, { headers: { 'Content-Type': row.ctype, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-MA-Live': '1' } });
  if (cache) await cache.put(request, res.clone()).catch(() => {});
  return res;
}
