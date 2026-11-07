/**
 * Owner-only login check for Pages Functions, the same rules as Apps Script
 * (verifyAdminSession_ + requireOwnerAdmin_ on the Sessions/Admins sheets).
 */
import { createCore } from './gs-core.js';
import { buildEnv } from './sheets-shim.js';
import { loadSnapshot } from './sheet-snapshot.js';
import { getAccessToken } from './google-auth.js';

const DEFAULT_SHEET_ID = '1kHt7Bdd4OnpX0jb1ApBXMZIIYqvmv5q2EyOnPV9HJKo';

// A save uploads several photos in a row with the same login. Reading the Sessions/Admins sheet for every
// photo made each upload wait on Google Sheets, so a successful owner check is reused for a short time
// (per Worker instance, keyed by a hash of the token; failures are never cached).
const OWNER_CACHE_MS = 60_000;
const ownerChecks = new Map();
async function tokenKey(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
// Shared across Worker instances in the same Cloudflare location (Cache API): a save's photo uploads and the
// save itself often land on different instances, and each fresh check reads Google Sheets (~1 s).
// Only a successful owner check is stored, for 3 minutes, keyed by the token's hash (never the token).
const EDGE_CACHE_SECONDS = 180;
function edgeCache() { try { return typeof caches !== 'undefined' && caches.default ? caches.default : null; } catch (e) { return null; } }
function edgeKey(key) { return new Request('https://owner-auth.internal/' + key); }
export async function isOwnerCached(token, now, check) {
  const key = await tokenKey(token);
  for (const [k, v] of ownerChecks) if (v.exp <= now) ownerChecks.delete(k);
  const hit = ownerChecks.get(key);
  if (hit && hit.exp > now) return hit.result;
  const cache = edgeCache();
  if (cache) {
    try {
      const res = await cache.match(edgeKey(key));
      if (res && (await res.text()) === 'owner') {
        ownerChecks.set(key, { result: Promise.resolve(''), exp: now + OWNER_CACHE_MS });
        return '';
      }
    } catch (e) {}
  }
  // Store the pending check so photos uploading at the same time share one Sheets read.
  const result = Promise.resolve().then(check);
  ownerChecks.set(key, { result, exp: now + OWNER_CACHE_MS });
  try {
    const error = await result;
    if (error) ownerChecks.delete(key);
    else if (cache) {
      try { await cache.put(edgeKey(key), new Response('owner', { headers: { 'Cache-Control': 'max-age=' + EDGE_CACHE_SECONDS } })); } catch (e) {}
    }
    return error;
  } catch (e) { ownerChecks.delete(key); throw e; }
}
export function _resetOwnerCache() { ownerChecks.clear(); }

export async function isOwner(token, env, fetchImpl, now) {
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

