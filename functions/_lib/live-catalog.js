/**
 * Instant live catalog.
 *
 * When the owner saves products in the admin panel, the change is committed to GitHub as before (the
 * permanent copy, which Cloudflare then builds and deploys in about a minute). Right after that commit
 * the admin panel also sends the same files here (POST /api/live-publish), and they are kept in D1
 * (binding STOCK_DB, table live_catalog). Until the deploy that contains that commit is live, the site
 * serves the saved files from D1, so visitors see the change immediately. New photos from that save are
 * served from D1 under /api/live-img/... until the deploy has them.
 *
 * Safety: anything unexpected (no D1, no saved state, a read error) falls back to the deployed static
 * files, i.e. exactly how the site worked before.
 */

export const CATALOG_FILES = ['category-products.js', 'product-links-data.js', 'product-catalog-sections.js', 'product-config.js'];
export const VALIDATION_FILE = 'catalog-validation.json';
export const LIVE_FILES = CATALOG_FILES.concat(VALIDATION_FILE);
export const ASSET_PATH = /^images\/uploads\/[a-z0-9-]+\.(webp|jpg|png)$/;
export const MAX_ASSET_BYTES = 1900000; // D1 row limit is 2 MB; larger photos simply wait for the deploy.
import { CARRIER_FILE, loadStorefrontSizeConfig, sizeConfigScript, fingerprint } from './size-carrier.js';

const STATE_TTL_SECONDS = 1; // short edge-state TTL limits stale product data after an owner save
// Requests that check the exact committed text (admin panel, order price check) get it verbatim.
const VERBATIM_PARAMS = ['catalog', 'catalog_check', 'live', 'publish'];

export async function ensureTables(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS live_catalog (k TEXT PRIMARY KEY, v TEXT NOT NULL, saved_at INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS live_assets (path TEXT PRIMARY KEY, data BLOB NOT NULL, ctype TEXT NOT NULL, saved_at INTEGER NOT NULL)'),
  ]);
}

function stateCacheKey(origin) {
  return new Request(origin + '/__live-catalog-state');
}

/** The last saved state ({sha, savedAt, files, index, assets}) or null. Cached per edge location for a few seconds. */
export async function loadState(env, origin, deps = {}) {
  if (!env || !env.STOCK_DB) return null;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const key = stateCacheKey(origin);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) return JSON.parse(await hit.text());
    } catch (e) {}
  }
  let state = null;
  try {
    const row = await env.STOCK_DB.prepare('SELECT v FROM live_catalog WHERE k = ?').bind('state').first();
    state = row && row.v ? JSON.parse(row.v) : null;
  } catch (e) {
    // Table not created yet, or D1 unavailable: behave like before (static files).
    state = null;
  }
  if (cache) {
    try {
      await cache.put(key, new Response(JSON.stringify(state), { headers: { 'Cache-Control': 'max-age=' + STATE_TTL_SECONDS } }));
    } catch (e) {}
  }
  return state;
}

export async function rememberState(origin, state, deps = {}) {
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  if (!cache) return;
  try {
    await cache.put(stateCacheKey(origin), new Response(JSON.stringify(state), { headers: { 'Cache-Control': 'max-age=' + STATE_TTL_SECONDS } }));
  } catch (e) {}
}

let deployedMemo = null;
/** What the running deployment was built from (written by scripts/build-cloudflare.mjs). */
export async function loadDeployed(env, origin) {
  if (deployedMemo) return deployedMemo;
  let info = { sha: '', commitTime: 0, history: [], ids: null };
  try {
    const res = await env.ASSETS.fetch(new Request(origin + '/live-build.json'));
    if (res.ok) {
      const data = await res.json();
      info.sha = String(data.sha || '');
      info.commitTime = Number(data.commitTime) || 0;
      info.history = Array.isArray(data.history) ? data.history.map(String) : [];
    }
  } catch (e) {}
  deployedMemo = info;
  return info;
}
export function _resetDeployedMemo() { deployedMemo = null; }

/**
 * True while the saved state is newer than the running deployment: its commit is not part of what was
 * deployed, and no later commit has been deployed since it was saved.
 */
export function isPending(state, deployed) {
  if (!state || !/^[a-f0-9]{40}$/.test(String(state.sha || '')) || !state.files) return false;
  if (!deployed) return true;
  if (deployed.sha === state.sha) return false;
  if ((deployed.history || []).indexOf(state.sha) >= 0) return false;
  if (deployed.commitTime && deployed.commitTime * 1000 > Number(state.savedAt || 0)) return false;
  return true;
}

/** New photos are not on the site until the deploy; point the catalog at their D1 copy meanwhile. */
export function rewriteAssets(text, assets) {
  let out = String(text);
  (assets || []).forEach((p) => {
    out = out.split('/' + p).join('/api/live-img/' + p);
    out = out.split('"' + p).join('"/api/live-img/' + p);
    out = out.split("'" + p).join("'/api/live-img/" + p);
  });
  return out;
}

function wantsVerbatim(url) {
  return VERBATIM_PARAMS.some((k) => url.searchParams.has(k));
}

function typeFor(path) {
  return path.endsWith('.json') ? 'application/json; charset=utf-8' : 'application/javascript; charset=utf-8';
}

async function passThrough(request, env) {
  const res = await env.ASSETS.fetch(request);
  // No long browser cache for catalog files: a returning visitor re-checks (cheap 304) and sees changes at once.
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-cache');
  return out;
}

/** GET for one of LIVE_FILES. */
export async function serveLiveFile(request, env, path, deps = {}) {
  const url = new URL(request.url);
  if (path === CARRIER_FILE && !wantsVerbatim(url)) {
    const sizeConfig = await loadStorefrontSizeConfig(env, url.origin, deps);
    if (sizeConfig) return withSizeConfig(request, env, path, deps, sizeConfig);
  }
  return serveCatalogFile(request, env, path, deps);
}

/** product-config.js with the published size configuration appended (functions/_lib/size-carrier.js). */
async function withSizeConfig(request, env, path, deps, sizeConfig) {
  // Fetch the whole file (no conditional headers): a 304 from the static copy could not carry the config.
  const headers = new Headers(request.headers);
  headers.delete('If-None-Match');
  headers.delete('If-Modified-Since');
  const base = await serveCatalogFile(new Request(request.url, { method: 'GET', headers }), env, path, deps);
  if (base.status !== 200) return base;
  const body = (await base.text()) + sizeConfigScript(sizeConfig);
  const etag = '"sz-' + fingerprint(body) + '"';
  const live = base.headers.get('X-MA-Live') === '1';
  const out = { 'Content-Type': typeFor(path), 'Cache-Control': live ? 'no-store' : 'no-cache', ETag: etag, 'X-MA-Size': String(sizeConfig.version) };
  if (live) out['X-MA-Live'] = '1';
  if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers: out });
  return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers: out });
}

async function serveCatalogFile(request, env, path, deps) {
  const url = new URL(request.url);
  try {
    const [state, deployed] = await Promise.all([loadState(env, url.origin, deps), loadDeployed(env, url.origin)]);
    if (isPending(state, deployed)) {
      let body = path === VALIDATION_FILE ? state.validation : state.files[path];
      if (typeof body === 'string' && body) {
        const verbatim = path === VALIDATION_FILE || wantsVerbatim(url);
        if (!verbatim) body = rewriteAssets(body, state.liveAssets || []);
        const etag = '"live-' + state.sha.slice(0, 16) + '-' + (verbatim ? 'v' : 'r') + '"';
        const headers = { 'Content-Type': typeFor(path), 'Cache-Control': 'no-store', ETag: etag, 'X-MA-Live': '1' };
        if (request.headers.get('If-None-Match') === etag) return new Response(null, { status: 304, headers });
        return new Response(request.method === 'HEAD' ? null : body, { status: 200, headers });
      }
    }
  } catch (e) {}
  return passThrough(request, env);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * A product added in the admin panel has no page file until the deploy. Meanwhile build its page from the
 * category template, the same way scripts/build-product-seo.mjs does (the product itself is rendered in
 * the browser from the live catalog).
 */
export async function serveProductPage(request, env, id, next) {
  const url = new URL(request.url);
  try {
    if (/^[A-Za-z0-9_-]+$/.test(id)) {
      const [state, deployed] = await Promise.all([loadState(env, url.origin), loadDeployed(env, url.origin)]);
      const category = state && state.index && state.index[id];
      if (category && isPending(state, deployed) && /^[a-z0-9_-]+$/i.test(category)) {
        const res = await next();
        const html = res.ok ? await res.clone().text() : '';
        if (html.indexOf('data-product-id="' + id + '"') >= 0) return res;
        const tplRes = await env.ASSETS.fetch(new Request(url.origin + '/abaya'));
        if (tplRes.ok) {
          const name = state.names && state.names[id] || id;
          const title = name + ' | Muslim Abaya Bangladesh';
          const page = (await tplRes.text())
            .replace(/data-shop-category="abaya"/g, 'data-shop-category="' + esc(category) + '"')
            .replace(/<html\b([^>]*)>/, (m, attrs) => '<html' + attrs.replace(/\s+data-(seo-managed|product-id)="[^"]*"/g, '') + ' data-seo-managed="full" data-product-id="' + esc(id) + '">')
            .replace(/\s*<section class="seo-category-intro"[\s\S]*?<\/section>/, '')
            .replace(/<title>[\s\S]*?<\/title>/, '<title>' + esc(title) + '</title>')
            .replace(/<link rel="canonical"[^>]*>/, '<link rel="canonical" href="https://muslimabaya.com/product/' + encodeURIComponent(id) + '">')
            .replace(/\b(src|href)="(?!https?:|\/|#|data:)([^"\s]+)"/g, '$1="/$2"');
          if (page.indexOf('data-product-id="' + esc(id) + '"') >= 0) {
            return new Response(page, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-MA-Live': '1' } });
          }
        }
        return res;
      }
    }
  } catch (e) {}
  return next();
}
