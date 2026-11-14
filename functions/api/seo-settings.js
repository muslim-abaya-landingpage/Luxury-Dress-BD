/**
 * POST /api/seo-settings — Admin → SEO Manager settings (owner only).
 *   {Token, action:"get"}                       → {ok, settings, sha}
 *   {Token, action:"save", settings, sha}        → validates (functions/_lib/seo-settings.js), commits seo-settings.json
 *                                                 to GitHub; the next deploy (~2 min) puts it in the server HTML.
 * Same protections as /api/catalog-save: owner login, same-origin check, size limit, and the file's SHA so a
 * save made from another tab is reported (SEO_CONFLICT) instead of overwritten.
 */
import { isOwner, isOwnerCached } from '../_lib/owner-auth.js';
import { githubClient } from './catalog-save.js';
import { SEO_FILE, DEFAULT_SETTINGS, sanitizeSettings } from '../_lib/seo-settings.js';

const MAX_BODY = 200 * 1024;
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
const b64 = (text) => { const bytes = new TextEncoder().encode(text); let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); return btoa(bin); };
const unb64 = (data) => { const bin = atob(String(data || '').replace(/\s+/g, '')); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };

export async function readSettings(gh) {
  try {
    const file = await gh('GET', 'contents/' + SEO_FILE + '?ref=main');
    let parsed = {};
    try { parsed = JSON.parse(unb64(file.content)); } catch (e) {}
    return { settings: sanitizeSettings(parsed).settings, sha: file.sha };
  } catch (e) {
    if (String(e.message) === 'GITHUB_ACCESS_404') return { settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), sha: '' };
    throw e;
  }
}

/** Shared request checks for the SEO Manager endpoints; returns {payload} or {response}. */
export async function ownerRequest(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return { response: json({ ok: false, error: 'METHOD' }, 405) };
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return { response: json({ ok: false, error: 'ORIGIN' }, 403) };
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return { response: json({ ok: false, error: 'TOO_LARGE' }, 413) };
  let payload;
  try { const text = await request.text(); if (text.length > MAX_BODY) throw Error('big'); payload = JSON.parse(text); }
  catch (e) { return { response: json({ ok: false, error: 'BAD_REQUEST' }, 400) }; }
  const token = String(payload && payload.Token || '').trim();
  if (!token) return { response: json({ ok: false, error: 'NOT_LOGGED_IN' }, 401) };
  try {
    const error = deps.authorize ? await deps.authorize(token, env) : await isOwnerCached(token, now, () => isOwner(token, env, fetchImpl, now));
    if (error === 'NOT_LOGGED_IN') return { response: json({ ok: false, error }, 401) };
    if (error) return { response: json({ ok: false, error }, 403) };
  } catch (e) { return { response: json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503) }; }
  return { payload, fetchImpl, now };
}

export async function handleSeoSettings(request, env, deps = {}) {
  if (!env || !env.GITHUB_TOKEN) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  const req = await ownerRequest(request, env, deps);
  if (req.response) return req.response;
  const { payload, fetchImpl } = req;
  const gh = githubClient(env, fetchImpl);
  try {
    if (payload.action === 'get') return json({ ok: true, ...(await readSettings(gh)) });
    if (payload.action !== 'save') return json({ ok: false, error: 'UNKNOWN_ACTION' }, 400);
    const checked = sanitizeSettings(payload.settings);
    if (!checked.ok) return json({ ok: false, error: 'INVALID', errors: checked.errors }, 400);
    const current = await readSettings(gh);
    if ((current.sha || '') !== String(payload.sha || '')) return json({ ok: false, error: 'SEO_CONFLICT', message: 'SEO settings were changed elsewhere. Reload and try again.' }, 409);
    const body = { message: 'SEO Manager: update SEO settings', content: b64(JSON.stringify(checked.settings, null, 2) + '\n'), branch: 'main' };
    if (current.sha) body.sha = current.sha;
    const saved = await gh('PUT', 'contents/' + SEO_FILE, body);
    return json({ ok: true, settings: checked.settings, sha: saved.content && saved.content.sha, commit: saved.commit && saved.commit.sha });
  } catch (e) {
    const code = String(e.message || 'FAILED');
    return json({ ok: false, error: code === 'CATALOG_CONFLICT' ? 'SEO_CONFLICT' : code }, code === 'CATALOG_CONFLICT' ? 409 : 502);
  }
}

export const onRequestPost = ({ request, env }) => handleSeoSettings(request, env);
