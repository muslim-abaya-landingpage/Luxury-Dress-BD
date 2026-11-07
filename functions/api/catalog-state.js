/**
 * POST /api/catalog-state — what Product Manager needs when it opens: main's head commit and the SHAs of the
 * 4 catalog files (same answer as Apps Script AdminCatalogState, without the Apps Script round trip).
 * Owner only. Read only. Without GITHUB_TOKEN it answers NOT_CONFIGURED and the panel asks Apps Script.
 * Body: {Token}
 */
import { isOwner, isOwnerCached } from '../_lib/owner-auth.js';
import { CATALOG_FILES } from '../_lib/live-catalog.js';
import { readHead, githubClient } from './catalog-save.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function handleCatalogState(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  if (!env || !env.GITHUB_TOKEN || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  let token = '';
  try { token = String((await request.json()).Token || '').trim(); } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  if (!token) return json({ ok: false, error: 'NO_TOKEN' }, 401);
  // Read GitHub alongside the owner check; the answer is only sent to the owner.
  const headRead = readHead(githubClient(env, fetchImpl));
  headRead.catch(() => {});
  try {
    const error = deps.authorize ? await deps.authorize(token, env) : await isOwnerCached(token, now, () => isOwner(token, env, fetchImpl, now));
    if (error === 'NOT_LOGGED_IN') return json({ ok: false, error }, 401);
    if (error) return json({ ok: false, error }, 403);
  } catch (e) { return json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503); }
  try {
    const { head, current } = await headRead;
    if (CATALOG_FILES.some((p) => !current[p])) return json({ ok: false, error: 'CATALOG_FILES_MISSING' }, 502);
    const shas = {};
    CATALOG_FILES.forEach((p) => { shas[p] = current[p]; });
    return json({ ok: true, version: 1, head, shas });
  } catch (e) {
    return json({ ok: false, error: String(e.message || 'GITHUB_FAILED').slice(0, 40) }, 502);
  }
}

export const onRequestPost = ({ request, env }) => handleCatalogState(request, env);
