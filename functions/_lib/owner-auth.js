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
export async function isOwnerCached(token, now, check) {
  const key = await tokenKey(token);
  for (const [k, v] of ownerChecks) if (v.exp <= now) ownerChecks.delete(k);
  const hit = ownerChecks.get(key);
  if (hit && hit.exp > now) return hit.result;
  // Store the pending check so photos uploading at the same time share one Sheets read.
  const result = Promise.resolve().then(check);
  ownerChecks.set(key, { result, exp: now + OWNER_CACHE_MS });
  try {
    const error = await result;
    if (error) ownerChecks.delete(key);
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

