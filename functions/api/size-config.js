/**
 * GET /api/size-config — the published Size Manager configuration (functions/_lib/size-store.js), read by the
 * Apps Script order check (Operations.gs opsSizeConfig_) and later by the website. Only the active published
 * version is served; drafts, overrides in progress and the audit log are never exposed.
 * Answers {ok:true, version:0, config:null} while nothing is published (or the tables do not exist yet):
 * every product then keeps its old size pickers.
 */
import { readActive } from '../_lib/size-store.js';

function json(body, status, cache) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, 'X-Robots-Tag': 'noindex' } });
}

export async function handleSizeConfig(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return json({ ok: false, error: 'METHOD' }, 405, 'no-store');
  if (!env || !env.STOCK_DB) return json({ ok: true, version: 0, config: null }, 200, 'no-store');
  let active = null;
  try {
    active = await readActive(env.STOCK_DB);
  } catch (e) {
    // Tables not created yet → same as "nothing published". Any other D1 failure → let the caller retry.
    if (!/no such table/i.test(String(e && e.message))) return json({ ok: false, error: 'UNAVAILABLE' }, 503, 'no-store');
  }
  if (!active) return json({ ok: true, version: 0, config: null }, 200, 'public, max-age=30');
  return json({ ok: true, version: active.version, publishedAt: active.publishedAt, config: active.config }, 200, 'public, max-age=30');
}

export const onRequest = ({ request, env }) => handleSizeConfig(request, env);
