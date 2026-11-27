/**
 * POST /api/live-publish — the admin panel sends catalog text after its GitHub commit so the site can
 * show the change immediately (functions/_lib/live-catalog.js). Photo bytes are not accepted here;
 * they must be uploaded to R2 through /api/image-upload first. Only the owner admin may call it.
 * Body: JSON {Token, sha, files:{path:text}, validation, index, names, assets:[]}
 */
import { verifyAdminSession } from '../_lib/admin-verify.js';
import { CATALOG_FILES, ensureTables, rememberState } from '../_lib/live-catalog.js';

const MAX_BODY = 14 * 1024 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

/** Reject duplicate product and variation SKUs before a catalog can be committed or made live. */
export function validateUniqueSkus(products) {
  if (!Array.isArray(products)) throw Error('BAD_VALIDATION');
  const seen = new Map();
  const claim = (value, label) => {
    const sku = String(value || '').trim();
    if (!sku) return;
    const key = sku.toLocaleUpperCase();
    if (seen.has(key)) throw Error('DUPLICATE_SKU');
    seen.set(key, label);
  };
  products.forEach((p) => {
    if (!p || typeof p !== 'object') return;
    claim(String(p.sku || '').trim() || p.id, p.name || p.id || 'product');
    (Array.isArray(p.variations) ? p.variations : []).forEach((v, i) => {
      if (v && v.sku) claim(v.sku, (p.name || p.id || 'product') + ' variation #' + (i + 1));
    });
  });
}

/** Checks the payload; returns {state, assets} or throws Error(code). */
export function validatePayload(p) {
  if (!p || typeof p !== 'object') throw Error('BAD_REQUEST');
  if (!/^[a-f0-9]{40}$/.test(String(p.sha || ''))) throw Error('BAD_SHA');
  const files = {};
  CATALOG_FILES.forEach((path) => {
    const text = p.files && p.files[path];
    if (typeof text !== 'string' || !text || text.length > 1500000) throw Error('BAD_FILES');
    files[path] = text;
  });
  if (typeof p.validation !== 'string' || p.validation.length > 2000000) throw Error('BAD_VALIDATION');
  let v;
  try { v = JSON.parse(p.validation); } catch (e) { throw Error('BAD_VALIDATION'); }
  if (!v || v.version !== 1 || v.releaseSha !== p.sha || !Array.isArray(v.products) || !v.products.length || !/^[a-f0-9]{64}$/.test(String(v.sourceSha256 || ''))) throw Error('BAD_VALIDATION');
  validateUniqueSkus(v.products);
  const index = {};
  const names = {};
  Object.keys(p.index || {}).slice(0, 5000).forEach((id) => {
    const cat = String(p.index[id] || '');
    if (/^[A-Za-z0-9_-]{1,100}$/.test(id) && /^[A-Za-z0-9_-]{1,60}$/.test(cat)) {
      index[id] = cat;
      if (p.names && typeof p.names[id] === 'string') names[id] = p.names[id].slice(0, 160);
    }
  });
  if (Array.isArray(p.assets) && p.assets.length) throw Error('R2_REQUIRED');
  const metaFeed = typeof p.metaFeed === 'string' && p.metaFeed.length <= 1800000 && p.metaFeed.startsWith('\"id\",\"title\",\"description\"') ? p.metaFeed : '';
  return { state: { sha: p.sha, files, validation: p.validation, index, names, metaFeed }, assets: [] };
}

/** Stores a checked catalog state in D1 so the site serves it until the deployment catches up. */
export async function writeLiveState(db, origin, checkedState, now, deps = {}) {
  await ensureTables(db);
  const state = Object.assign({}, checkedState, { savedAt: now, liveAssets: [] });
  const stmts = [];
  stmts.push(db.prepare('INSERT OR REPLACE INTO live_catalog (k, v, saved_at) VALUES (?, ?, ?)').bind('state', JSON.stringify(state), now));
  // Photos from earlier saves have long been deployed by now.
  stmts.push(db.prepare('DELETE FROM live_assets WHERE saved_at < ?').bind(now - 2 * 24 * 3600 * 1000));
  await db.batch(stmts);
  await rememberState(origin, state, deps);
  return state;
}

export async function handleLivePublish(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  if (!env || !env.STOCK_DB) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) return json({ ok: false, error: 'TOO_LARGE' }, 413);
  let payload;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ ok: false, error: 'TOO_LARGE' }, 413);
    payload = JSON.parse(text);
  } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  const token = String(payload && payload.Token || '').trim();
  if (!token) return json({ ok: false, error: 'NO_TOKEN' }, 401);

  // Owner login check, the same lightweight way as the tracking Worker and the browser itself
  // (functions/_lib/admin-verify.js — one HTTPS call to the Apps Script backend, no Google
  // service-account secret needed). AdminCatalogPublish is owner-only.
  try {
    const who = await verifyAdminSession(token, env, fetchImpl);
    if (!who || !who.ok) return json({ ok: false, error: 'NOT_LOGGED_IN' }, 401);
    if (!who.isOwner) return json({ ok: false, error: 'OWNER_ONLY' }, 403);
  } catch (e) {
    return json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503);
  }

  let checked;
  try { checked = validatePayload(payload); } catch (e) { return json({ ok: false, error: String(e.message || 'BAD_REQUEST') }, 400); }

  try {
    const state = await writeLiveState(env.STOCK_DB, new URL(request.url).origin, checked.state, now, deps);
    return json({ ok: true, live: true, sha: state.sha, photos: state.liveAssets.length });
  } catch (e) {
    return json({ ok: false, error: 'SAVE_FAILED' }, 503);
  }
}

export const onRequestPost = ({ request, env }) => handleLivePublish(request, env);
