/**
 * /api/cron-tick — the reliable clock for scheduled jobs.
 * Called every 2 minutes by the Cloudflare Worker cron (cloudflare-worker/worker.js). GitHub's own
 * schedules are often delayed by hours or skipped, so this starts the jobs instead ("run now" requests are
 * not dropped):
 *   - sale starts / ends (Product Manager → Schedule): once a day, at the first tick after 00:03 Bangladesh time
 *   - scheduled publish (Publish box): when a product's date and time has passed
 *     → website rebuild (sale-schedule-rebuild.yml), so pre-built pages and Google product data follow
 *   - daily SEO audit of the live site: started once a day after 02:41 Bangladesh time and run right here in small
 *     steps (15 pages per tick, ~30 minutes for the whole sitemap), saved for Admin → SEO Manager
 * Safe to call by anyone: it does real work at most every 4 minutes, each job runs once (claimed in D1), and
 * it only starts this repository's own workflows. Nothing secret is returned.
 */
import { dhakaDate, dhakaHourMinute, saleBoundaries, publishesBetween } from '../_lib/schedule-check.js';
import { SITE, robotsIssues, sitemapUrls, pageIssues, duplicateTitleIssues, brokenLinkIssue, report } from '../_lib/seo-live-checks.js';
import { cleanLiveReport } from './seo-report.js';

const DEFAULT_REPO = 'muslim-abaya-landingpage/Luxury-Dress-BD';
const MIN_GAP_MS = 3 * 60000; // the Worker calls every 2 minutes → real work every 4
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
  const text = 'Rebuild ' + new Date(now).toISOString() + ' — ' + reason + '\n';
  const bytes = new TextEncoder().encode(text); let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
  const res = await fetchImpl(base, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Rebuild: ' + reason.slice(0, 120), content: btoa(bin), branch: 'main', ...(sha ? { sha } : {}) }) });
  return res.ok ? 'committed' : 'COMMIT_' + res.status;
}

async function rebuild(env, fetchImpl, reason, now) {
  const first = await dispatchWorkflow(env, fetchImpl, 'sale-schedule-rebuild.yml', { force: 'true' });
  if (first === 'dispatched') return first;
  if (!env.GITHUB_TOKEN) return first;
  const second = await commitRebuildTrigger(env, fetchImpl, reason, now);
  return first + ' → ' + second;
}

// ---------- Daily live SEO audit in small steps (stays under the per-request limits of the free plan) ----------
const PAGES_PER_STEP = 15, LINKS_PER_STEP = 25, UA = 'MuslimAbaya-SEO-Audit/1.0 (+https://muslimabaya.com/)';
async function get(fetchImpl, url, withBody) {
  const t0 = Date.now();
  try {
    const res = await fetchImpl(url, { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
    const body = withBody ? await res.text() : '';
    return { status: res.status, url: res.url, body, ms: Date.now() - t0, robotsHeader: res.headers.get('x-robots-tag') || '' };
  } catch (e) { return { status: 0, url: '', body: '', ms: Date.now() - t0, robotsHeader: '' }; }
}
export async function auditStart(fetchImpl, date, now) {
  const issues = [];
  const robots = await get(fetchImpl, SITE + '/robots.txt', true);
  robotsIssues(robots.status, robots.body).forEach((i) => issues.push(i));
  const sm = await get(fetchImpl, SITE + '/sitemap.xml', true);
  const locs = sm.status === 200 ? sitemapUrls(sm.body) : [];
  if (!locs.length) issues.push({ level: 'error', type: 'sitemap-unreachable', url: SITE + '/sitemap.xml', message: 'sitemap.xml answered ' + sm.status + ' or is empty.', fix: '' });
  // http→https is not checked here: requests from inside Cloudflare skip the zone's "Always Use HTTPS" redirect,
  // so it would always look broken (scripts/seo-live-audit.mjs checks it from outside).
  for (const [url, type, msg] of [['https://www.muslimabaya.com/', 'www-not-apex', 'www.muslimabaya.com does not redirect to muslimabaya.com']]) {
    const r = await get(fetchImpl, url, false);
    if (r.status && r.status !== 200) continue;
    if (r.status === 0 || !String(r.url || '').startsWith(SITE + '/')) issues.push({ level: 'warning', type, url, message: msg + (r.status === 0 ? ' (no answer).' : '.'), fix: 'Check the Cloudflare redirect rules.' });
  }
  const missing = await get(fetchImpl, SITE + '/seo-audit-missing-page-check', false);
  if (missing.status !== 404) issues.push({ level: 'error', type: 'soft-404', url: SITE + '/seo-audit-missing-page-check', message: 'A page that does not exist answered ' + missing.status + ' instead of 404.', fix: '' });
  return { date, started: now, phase: 'pages', locs, i: 0, j: 0, issues, titles: {}, links: {}, linkList: [], ms: [] };
}
/** One step; returns the finished report, or null when there is more to do (st is updated in place). */
export async function auditStep(fetchImpl, st) {
  if (st.phase === 'pages') {
    const batch = st.locs.slice(st.i, st.i + PAGES_PER_STEP);
    const results = await Promise.all(batch.map((loc) => get(fetchImpl, loc, true).then((r) => [loc, r])));
    results.forEach(([loc, r]) => {
      const res = pageIssues(loc, r);
      res.issues.forEach((x) => st.issues.push(x));
      if (res.title) (st.titles[res.title] = st.titles[res.title] || []).push(loc);
      res.links.forEach((p) => { if (!st.links[p]) st.links[p] = loc; });
      if (r.status === 200) st.ms.push(r.ms);
    });
    st.i += batch.length;
    if (st.i < st.locs.length) return null;
    const known = new Set(st.locs.map((l) => { try { return new URL(l).pathname.replace(/\/$/, '') || '/'; } catch (e) { return l; } }));
    st.linkList = Object.keys(st.links).filter((p) => !known.has(p.replace(/\/$/, '') || '/')).slice(0, 150);
    st.phase = 'links';
    return null;
  }
  const batch = st.linkList.slice(st.j, st.j + LINKS_PER_STEP);
  const results = await Promise.all(batch.map((p) => get(fetchImpl, SITE + p, false).then((r) => [p, r])));
  results.forEach(([p, r]) => { const b = brokenLinkIssue(p, r.status, st.links[p]); if (b) st.issues.push(b); });
  st.j += batch.length;
  if (st.j < st.linkList.length) return null;
  duplicateTitleIssues(st.titles).forEach((x) => st.issues.push(x));
  const avg = st.ms.length ? Math.round(st.ms.reduce((a, b) => a + b, 0) / st.ms.length) : 0;
  return report(st.issues, { urls: st.locs.length, linksChecked: st.linkList.length, msAverage: avg });
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

  // 3) Daily SEO audit of the live site: start after 02:41, then continue a little on every tick.
  if (minute >= 161 && await claim(db, 'seo-audit:' + today, now)) {
    await setState(db, 'live-audit:state', JSON.stringify(await auditStart(fetchImpl, today, now)), now);
    await setState(db, 'seo-audit:' + today, 'running', now);
    ran.push({ job: 'seo-audit', result: 'started' });
  } else {
    const raw = await getState(db, 'live-audit:state');
    if (raw) {
      const st = JSON.parse(raw);
      const done = await auditStep(fetchImpl, st);
      if (done) {
        const rep = cleanLiveReport(done);
        await db.prepare('CREATE TABLE IF NOT EXISTS seo_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, source TEXT NOT NULL, report TEXT NOT NULL)').run();
        await db.prepare('INSERT INTO seo_reports (created_at, source, report) VALUES (?, ?, ?)').bind(now, 'live', JSON.stringify(rep)).run();
        await db.prepare('DELETE FROM seo_reports WHERE id NOT IN (SELECT id FROM seo_reports ORDER BY id DESC LIMIT 60)').run();
        await setState(db, 'live-audit:state', '', now);
        await setState(db, 'seo-audit:' + st.date, 'done: ' + rep.summary.errors + ' errors, ' + rep.summary.warnings + ' warnings', now);
        ran.push({ job: 'seo-audit', result: 'done', summary: rep.summary });
      } else {
        await setState(db, 'live-audit:state', JSON.stringify(st), now);
        ran.push({ job: 'seo-audit', result: 'step', done: st.phase === 'pages' || !st.j ? st.i + '/' + st.locs.length + ' pages' : st.j + '/' + st.linkList.length + ' links' });
      }
    }
  }

  return json({ ok: true, at: new Date(now).toISOString(), ran });
}

export const onRequestPost = ({ request, env }) => handleCronTick(request, env);
export const onRequestGet = ({ request, env }) => handleCronTick(request, env);
