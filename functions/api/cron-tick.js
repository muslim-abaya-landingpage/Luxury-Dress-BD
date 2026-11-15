/**
 * /api/cron-tick — the reliable clock for scheduled jobs.
 * Called every 2 minutes by the Cloudflare Worker cron (cloudflare-worker/worker.js). GitHub's own
 * schedules are often delayed by hours or skipped, so this starts the jobs instead ("run now" requests are
 * not dropped):
 *   - sale starts / ends (Product Manager → Schedule): once a day, at the first tick after 00:03 Bangladesh time
 *   - scheduled publish (Publish box): when a product's date and time has passed
 *     → website rebuild (sale-schedule-rebuild.yml), so pre-built pages and Google product data follow
 *   - daily SEO audit (seo-audit.yml): once a day after 02:41 Bangladesh time
 * Safe to call by anyone: it does real work at most every 4 minutes, each job runs once (claimed in D1), and
 * it only starts this repository's own workflows. Nothing secret is returned.
 */
import { dhakaDate, dhakaHourMinute, saleBoundaries, publishesBetween } from '../_lib/schedule-check.js';

const DEFAULT_REPO = 'muslim-abaya-landingpage/Luxury-Dress-BD';
const MIN_GAP_MS = 4 * 60000;
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

async function ensureTable(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS cron_state (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER)').run();
}
async function getState(db, key) {
  const row = await db.prepare('SELECT value FROM cron_state WHERE key = ?').bind(key).first();
  return row ? row.value : null;
}
async function setState(db, key, value, now) {
  await db.prepare('INSERT INTO cron_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at').bind(key, String(value), now).run();
}
/** True only for the first caller (two ticks at the same moment cannot both run a job). */
async function claim(db, key, now) {
  const res = await db.prepare('INSERT INTO cron_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO NOTHING').bind(key, 'claimed', now).run();
  return !!(res && res.meta && res.meta.changes === 1);
}

/** Starts a GitHub workflow on main. Returns 'dispatched' or an error code. */
export async function dispatchWorkflow(env, fetchImpl, file, inputs) {
  if (!env.GITHUB_TOKEN) return 'NO_GITHUB_TOKEN';
  const res = await fetchImpl('https://api.github.com/repos/' + (env.GITHUB_REPO || DEFAULT_REPO) + '/actions/workflows/' + file + '/dispatches', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'MuslimAbaya-Cron', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: inputs || {} }),
  });
  return res.status === 204 ? 'dispatched' : 'GITHUB_' + res.status;
}

/**
 * Fallback when the token may not start workflows: a tiny commit (.rebuild-trigger) on main makes Cloudflare
 * Pages rebuild the website — the same way a product save does.
 */
export async function commitRebuildTrigger(env, fetchImpl, reason, now) {
  const base = 'https://api.github.com/repos/' + (env.GITHUB_REPO || DEFAULT_REPO) + '/contents/.rebuild-trigger';
  const headers = { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'MuslimAbaya-Cron', 'X-GitHub-Api-Version': '2022-11-28' };
  const cur = await fetchImpl(base + '?ref=main', { headers });
  const sha = cur.ok ? (await cur.json()).sha : undefined;
  const text = 'Scheduled rebuild ' + new Date(now).toISOString() + ' — ' + reason + '\n';
  const bytes = new TextEncoder().encode(text); let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
  const res = await fetchImpl(base, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Scheduled rebuild: ' + reason.slice(0, 120), content: btoa(bin), branch: 'main', ...(sha ? { sha } : {}) }) });
  return res.ok ? 'committed' : 'COMMIT_' + res.status;
}

async function rebuild(env, fetchImpl, reason, now) {
  const first = await dispatchWorkflow(env, fetchImpl, 'sale-schedule-rebuild.yml', { force: 'true' });
  if (first === 'dispatched') return first;
  if (!env.GITHUB_TOKEN) return first;
  const second = await commitRebuildTrigger(env, fetchImpl, reason, now);
  return first + ' → ' + second;
}

export async function handleCronTick(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  const db = env && env.STOCK_DB;
  if (!db) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  await ensureTable(db);
  const last = Number(await getState(db, 'tick:last')) || 0;
  if (now - last < MIN_GAP_MS) return json({ ok: true, skipped: 'too soon' });
  await setState(db, 'tick:last', now, now);

  const today = dhakaDate(now), minute = dhakaHourMinute(now);
  const ran = [];
  let catalog = null;
  const loadCatalog = async () => {
    if (catalog) return catalog;
    const url = new URL(request.url).origin + '/schedule.json';
    const res = env.ASSETS ? await env.ASSETS.fetch(new Request(url)) : await fetchImpl(url);
    catalog = res.ok ? ((await res.json()).catalog || {}) : {};
    return catalog;
  };

  // 1) Sale starts / ends: once per Bangladesh day, from 00:03.
  if (minute >= 3 && await claim(db, 'sale:' + today, now)) {
    const hits = saleBoundaries(await loadCatalog(), today);
    const result = hits.length ? await rebuild(env, fetchImpl, hits[0] + (hits.length > 1 ? ' (+' + (hits.length - 1) + ')' : ''), now) : 'nothing today';
    await setState(db, 'sale:' + today, result, now);
    ran.push({ job: 'sale', result, products: hits.length });
  }

  // 2) Scheduled publish: products whose time passed since the last check.
  const since = Number(await getState(db, 'publish:since')) || now - 65 * 60000;
  const published = publishesBetween(await loadCatalog(), since, now);
  await setState(db, 'publish:since', now, now);
  if (published.length) {
    const result = await rebuild(env, fetchImpl, published[0], now);
    ran.push({ job: 'publish', result, products: published.length });
  }

  // 3) Daily SEO audit of the live site, from 02:41.
  if (minute >= 161 && await claim(db, 'seo-audit:' + today, now)) {
    const result = await dispatchWorkflow(env, fetchImpl, 'seo-audit.yml', {});
    await setState(db, 'seo-audit:' + today, result, now);
    ran.push({ job: 'seo-audit', result });
  }

  return json({ ok: true, at: new Date(now).toISOString(), ran });
}

export const onRequestPost = ({ request, env }) => handleCronTick(request, env);
export const onRequestGet = ({ request, env }) => handleCronTick(request, env);
