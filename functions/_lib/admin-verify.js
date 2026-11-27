/**
 * Verifies an admin session token the same lightweight way the tracking Worker
 * (cloudflare-worker/worker.js verifyAdminToken) and the browser itself (admin-api.js,
 * RecordType "AdminVerify") already do: one HTTPS call to the Apps Script backend.
 *
 * isOwner()/isOwnerCached() in owner-auth.js instead read the Admins/Sessions sheet directly
 * over the Google Sheets API, which needs a service-account key (env.GOOGLE_SA_JSON). When that
 * secret is not configured on this Cloudflare Pages project, every isOwner() call fails with
 * NOT_CONFIGURED even though the admin is properly logged in — this path needs no such secret,
 * so it keeps working regardless.
 *
 * isOwnerViaAppsScript() has the exact same return contract as isOwner(): '' (falsy) on success,
 * 'NOT_LOGGED_IN' or 'OWNER_ONLY' (or the underlying error) on failure — so a call site can swap
 * one for the other without changing any of its own logic.
 */
const DEFAULT_ADMIN_API_URL = 'https://script.google.com/macros/s/AKfycbxZv7KU0JMY90576HoRF8wtHmEgW2ggkTxAoQKjO6on1cactlDgJDhoRLndCh3kK_hz/exec';

export async function verifyAdminSession(token, env, fetchImpl) {
  if (!token) return { ok: false, error: 'NOT_LOGGED_IN' };
  const impl = fetchImpl || fetch;
  const apiUrl = (env && env.ADMIN_API_URL) || DEFAULT_ADMIN_API_URL;
  const body = new URLSearchParams({ RecordType: 'AdminVerify', Token: token });
  let res;
  try {
    const r = await impl(apiUrl, { method: 'POST', body });
    res = JSON.parse(await r.text());
  } catch (e) {
    return { ok: false, error: 'AUTH_UNAVAILABLE' };
  }
  return res && typeof res === 'object' ? res : { ok: false, error: 'AUTH_UNAVAILABLE' };
}

export async function isOwnerViaAppsScript(token, env, fetchImpl) {
  const v = await verifyAdminSession(token, env, fetchImpl);
  if (!v || !v.ok) return (v && v.error) || 'NOT_LOGGED_IN';
  return v.isOwner ? '' : 'OWNER_ONLY';
}
