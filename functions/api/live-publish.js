/**
 * POST /api/live-publish — the admin panel calls this right after a product save was committed to GitHub,
 * with the same catalog files, so the site shows the change immediately (functions/_lib/live-catalog.js).
 * Only the owner admin may call it; the login is checked against the admin sheet exactly like
 * /api/admin-read does. Body: JSON {Token, sha, files:{path:text}, validation, index, names, assets:[{path, content(base64)}]}
 */
import { createCore } from '../_lib/gs-core.js';
import { buildEnv } from '../_lib/sheets-shim.js';
import { loadSnapshot } from '../_lib/sheet-snapshot.js';
import { getAccessToken } from '../_lib/google-auth.js';
import { CATALOG_FILES, ASSET_PATH, MAX_ASSET_BYTES, ensureTables, rememberState } from '../_lib/live-catalog.js';

const DEFAULT_SHEET_ID = '1kHt7Bdd4OnpX0jb1ApBXMZIIYqvmv5q2EyOnPV9HJKo';
const MAX_BODY = 14 * 1024 * 1024;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function imageType(bytes, path) {
  const ext = path.split('.').pop();
  const b = (i) => bytes[i];
  if (ext === 'webp' && b(0) === 82 && b(1) === 73 && b(2) === 70 && b(3) === 70 && b(8) === 87 && b(9) === 69 && b(10) === 66 && b(11) === 80) return 'image/webp';
  if (ext === 'jpg' && b(0) === 255 && b(1) === 216 && b(2) === 255) return 'image/jpeg';
  if (ext === 'png' && b(0) === 137 && b(1) === 80 && b(2) === 78 && b(3) === 71) return 'image/png';
  return '';
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
  const index = {};
  const names = {};
  Object.keys(p.index || {}).slice(0, 5000).forEach((id) => {
    const cat = String(p.index[id] || '');
    if (/^[A-Za-z0-9_-]{1,100}$/.test(id) && /^[A-Za-z0-9_-]{1,60}$/.test(cat)) {
      index[id] = cat;
      if (p.names && typeof p.names[id] === 'string') names[id] = p.names[id].slice(0, 160);
    }
  });
  const assets = [];
  (Array.isArray(p.assets) ? p.assets : []).slice(0, 12).forEach((a) => {
    const path = String(a && a.path || '');
    if (!ASSET_PATH.test(path) || typeof a.content !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(a.content)) throw Error('BAD_ASSET');
    const bytes = b64ToBytes(a.content);
    const ctype = imageType(bytes, path);
    if (!ctype) throw Error('BAD_ASSET');
    if (bytes.length <= MAX_ASSET_BYTES) assets.push({ path, bytes, ctype });
  });
  return { state: { sha: p.sha, files, validation: p.validation, index, names }, assets };
}

export async function handleLivePublish(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  if (!env || !env.STOCK_DB || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
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

  // Owner login check, same rules as Apps Script (AdminCatalogPublish is owner-only).
  try {
    const access = await getAccessToken(env.GOOGLE_SA_JSON, fetchImpl, now);
    const snapshot = await loadSnapshot({ spreadsheetId: env.SHEET_ID || DEFAULT_SHEET_ID, token: access, sheets: ['Sessions', 'Admins'], fetchImpl, nowMs: now });
    const core = createCore(buildEnv(snapshot));
    const who = core.verifyAdminSession_(token);
    if (!who || !who.ok) return json({ ok: false, error: 'NOT_LOGGED_IN' }, 401);
    const denied = core.requireOwnerAdmin_(who);
    if (denied) return json({ ok: false, error: 'OWNER_ONLY' }, 403);
  } catch (e) {
    return json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503);
  }

  let checked;
  try { checked = validatePayload(payload); } catch (e) { return json({ ok: false, error: String(e.message || 'BAD_REQUEST') }, 400); }

  try {
    const db = env.STOCK_DB;
    await ensureTables(db);
    const state = Object.assign({}, checked.state, { savedAt: now, liveAssets: checked.assets.map((a) => a.path) });
    const stmts = checked.assets.map((a) =>
      db.prepare('INSERT OR REPLACE INTO live_assets (path, data, ctype, saved_at) VALUES (?, ?, ?, ?)').bind(a.path, a.bytes, a.ctype, now));
    stmts.push(db.prepare('INSERT OR REPLACE INTO live_catalog (k, v, saved_at) VALUES (?, ?, ?)').bind('state', JSON.stringify(state), now));
    // Photos from earlier saves have long been deployed by now.
    stmts.push(db.prepare('DELETE FROM live_assets WHERE saved_at < ?').bind(now - 2 * 24 * 3600 * 1000));
    await db.batch(stmts);
    await rememberState(new URL(request.url).origin, state, deps);
    return json({ ok: true, live: true, sha: state.sha, photos: state.liveAssets.length });
  } catch (e) {
    return json({ ok: false, error: 'SAVE_FAILED' }, 503);
  }
}

export const onRequestPost = ({ request, env }) => handleLivePublish(request, env);
