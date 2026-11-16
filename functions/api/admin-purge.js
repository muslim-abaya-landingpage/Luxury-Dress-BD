/**
 * POST /api/admin-purge — "Purge All" from the admin bar (owner only).
 * Starts a fresh build + deployment of the whole site (the same commit trigger the scheduled rebuild uses),
 * so every page and file is rebuilt from the newest catalog/settings and served from a brand-new deployment.
 * At most once every 5 minutes. Body: {Token}. Reply: {ok, started, at} or {ok:false, error, retryAfter}.
 *
 * Browser-side caches are cleared in admin-wp.js; pages are not stored in Cloudflare's cache
 * (cf-cache-status: DYNAMIC) and photo/script names change on every upload/build, so nothing else is kept.
 */
import { ownerRequest } from './seo-settings.js';
import { commitRebuildTrigger } from './cron-tick.js';

const GAP_MS = 5 * 60000;
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

export async function handleAdminPurge(request, env, deps = {}) {
  const r = await ownerRequest(request, env, deps);
  if (r.response) return r.response;
  const { fetchImpl, now } = r;
  const db = env && env.STOCK_DB;
  if (!env || !env.GITHUB_TOKEN) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  if (db) {
    await db.prepare('CREATE TABLE IF NOT EXISTS cron_state (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)').run();
    // claim the 5-minute slot atomically: only one of two simultaneous clicks wins
    const res = await db.prepare("INSERT INTO cron_state (key, value, updated_at) VALUES ('purge:last', 'started', ?) ON CONFLICT(key) DO UPDATE SET value = 'started', updated_at = excluded.updated_at WHERE cron_state.updated_at <= ?")
      .bind(now, now - GAP_MS).run();
    if (!(res && res.meta && res.meta.changes === 1)) {
      const row = await db.prepare("SELECT updated_at FROM cron_state WHERE key = 'purge:last'").first();
      const wait = Math.max(1, Math.ceil(((row ? row.updated_at : now) + GAP_MS - now) / 1000));
      return json({ ok: false, error: 'TOO_SOON', retryAfter: wait }, 429);
    }
  }
  let result;
  try { result = await commitRebuildTrigger(env, fetchImpl, 'Purge All from the admin bar', now); }
  catch (e) { result = 'COMMIT_ERROR'; }
  if (result !== 'committed') {
    if (db) await db.prepare("DELETE FROM cron_state WHERE key = 'purge:last' AND updated_at = ?").bind(now).run();
    return json({ ok: false, error: result }, 502);
  }
  return json({ ok: true, started: true, at: now });
}

export const onRequestPost = ({ request, env }) => handleAdminPurge(request, env);
