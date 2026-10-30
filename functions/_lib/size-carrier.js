/**
 * Size Manager → website. The published size configuration rides along with product-config.js (a file every
 * shop page already loads through the live-catalog middleware), so customers' browsers get it without an extra
 * request. It is attached only while some category or product actually uses a size template; while everything
 * is switched off, product-config.js is served exactly as before.
 * Verbatim reads (?catalog_check, ?live, …: the order check and the admin publisher hash the committed text)
 * never carry it.
 */
import { readActive } from './size-store.js';

export const CARRIER_FILE = 'product-config.js';
const TTL_SECONDS = 30; // same freshness the public /api/size-config promises

function cacheKey(origin) {
  return new Request(origin + '/__size-config-storefront');
}

/** Only what the shop needs: categories, overrides, and the templates something switched on can reach. */
export function storefrontConfig(config) {
  if (!config || typeof config !== 'object' || !config.templates) return null;
  const categories = config.categories || {};
  const products = config.products || {};
  const used = new Set();
  let anyOn = false;
  Object.keys(categories).forEach((k) => {
    if (categories[k] && categories[k].enabled === true) { anyOn = true; used.add(categories[k].template); }
  });
  Object.keys(products).forEach((id) => {
    const p = products[id];
    if (!p || p.enabled !== true) return;
    anyOn = true;
    // A product switched on inside a category that is off uses its own template or its category's.
    if (p.template) used.add(p.template);
    else Object.keys(categories).forEach((k) => used.add(categories[k] && categories[k].template));
  });
  if (!anyOn) return null;
  const templates = {};
  used.forEach((id) => { if (id && config.templates[id]) templates[id] = config.templates[id]; });
  return { version: config.version || 0, categories, templates, products };
}

/** The pruned published config, or null (nothing switched on, no tables, D1 down). Cached per edge location. */
export async function loadStorefrontSizeConfig(env, origin, deps = {}) {
  if (!env || !env.STOCK_DB) return null;
  const cache = deps.cache !== undefined ? deps.cache : (typeof caches !== 'undefined' ? caches.default : null);
  const key = cacheKey(origin);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) return JSON.parse(await hit.text());
    } catch (e) {}
  }
  let value = null;
  try {
    const active = await readActive(env.STOCK_DB);
    value = active ? storefrontConfig(active.config) : null;
  } catch (e) {
    // Tables missing or D1 unavailable: the shop keeps its old size pickers (the order check accepts those).
    value = null;
  }
  if (cache) {
    try {
      await cache.put(key, new Response(JSON.stringify(value), { headers: { 'Cache-Control': 'max-age=' + TTL_SECONDS } }));
    } catch (e) {}
  }
  return value;
}

/** JavaScript appended to product-config.js. `<` is escaped so the JSON can never close a script element. */
export function sizeConfigScript(config) {
  return '\n;window.MA_SIZE_CONFIG = ' + JSON.stringify(config).replace(/</g, '\\u003c') + ';\n';
}

/** A short, stable fingerprint of the attached text, for the response ETag. */
export function fingerprint(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16);
}
