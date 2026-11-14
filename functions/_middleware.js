/**
 * Instant live catalog (see functions/_lib/live-catalog.js). Only the paths listed in _routes.json run
 * through Functions; every other file is served straight from the static site as before.
 */
import { LIVE_FILES, serveLiveFile, serveProductPage, loadState, loadDeployed, isPending } from './_lib/live-catalog.js';
import { isBlockedPath } from './_lib/blocked-paths.js';
const MANUS_ROUTES = JSON.stringify({ routes: [
  { path: '/', title: 'Muslim Abaya — Home' },
  { path: '/abaya', title: 'Abaya' },
  { path: '/cover-up', title: 'Cover Up' },
  { path: '/premium-two-piece', title: 'Premium Two-Piece' },
  { path: '/tops-kurti', title: 'Tops / Kurti' },
  { path: '/embroidery', title: 'Embroidery' },
  { path: '/hijab', title: 'Hijab' },
  { path: '/panjabi', title: 'Panjabi' },
  { path: '/category', title: 'Shop Categories' },
  { path: '/checkout', title: 'Checkout' },
  { path: '/about', title: 'About' }
] });

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (url.pathname === '/manus-routes.json') {
    return new Response(MANUS_ROUTES, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  }
  // Source code, tests, notes and tool files are never part of the website (see functions/_lib/blocked-paths.js).
  if (isBlockedPath(url.pathname)) {
    return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();
  // Serve the generated Meta Commerce CSV explicitly through Pages Assets.
  // This keeps the feed reachable even when the static asset fallback is bypassed by routing.
  if (url.pathname === '/meta-product-feed.csv') {
    // A catalog save writes its matching feed to D1 too, so Meta sees new products immediately,
    // before the GitHub-triggered static deployment finishes.
    try {
      const [state, deployed] = await Promise.all([loadState(env, url.origin), loadDeployed(env, url.origin)]);
      if (isPending(state, deployed) && typeof state.metaFeed === 'string' && state.metaFeed.startsWith('"id","title","description"')) {
        return new Response(request.method === 'HEAD' ? null : state.metaFeed, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'inline; filename="meta-product-feed.csv"',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-MA-Live': '1'
          }
        });
      }
    } catch (e) {}
    const assetUrl = new URL('/meta-product-feed.csv', url.origin);
    const assetRequest = new Request(assetUrl.toString(), { method: 'GET', headers: request.headers });
    const asset = await env.ASSETS.fetch(assetRequest);
    if (!asset.ok) return new Response('Meta product feed is not present in this deployment.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
    });
    const headers = new Headers(asset.headers);
    headers.set('Content-Type', 'text/csv; charset=utf-8');
    headers.set('Content-Disposition', 'inline; filename="meta-product-feed.csv"');
    headers.set('Cache-Control', 'public, max-age=300, s-maxage=300');
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(request.method === 'HEAD' ? null : asset.body, { status: 200, headers });
  }
  const path = url.pathname.replace(/^\//, '');
  if (LIVE_FILES.indexOf(path) >= 0) return serveLiveFile(request, env, path);
  const m = /^product\/([^/]+?)(?:\.html)?$/.exec(path);
  if (m) {
    const res = await serveProductPage(request, env, decodeURIComponent(m[1]), next);
    return res.status === 404 ? (await seoRedirect(request, env, url)) || res : res;
  }
  return next();
}

/**
 * Admin → SEO Manager redirects for paths served by Functions (/product/…), where _redirects does not run.
 * Used only when the page does not exist (404), so a live product is never redirected away.
 * seo-redirects.json is written at deploy by scripts/build-seo-settings.mjs.
 */
export async function seoRedirect(request, env, url) {
  try {
    if (!env || !env.ASSETS) return null;
    const res = await env.ASSETS.fetch(new Request(url.origin + '/seo-redirects.json'));
    if (!res.ok) return null;
    const map = await res.json();
    const key = decodeURIComponent(url.pathname).replace(/\.html$/, '').replace(/\/+$/, '').toLowerCase();
    const hit = map && map[key];
    if (!hit || !hit.to) return null;
    const target = hit.to.charAt(0) === '/' ? url.origin + hit.to : hit.to;
    if (new URL(target).origin !== url.origin) return null;
    return new Response(null, { status: hit.code === 302 ? 302 : 301, headers: { Location: target, 'Cache-Control': 'public, max-age=300' } });
  } catch (e) { return null; }
}
