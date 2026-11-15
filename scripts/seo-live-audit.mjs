// Scheduled SEO audit of the LIVE website (GitHub Actions: .github/workflows/seo-audit.yml, daily; can also be run by hand).
// Checks what Google actually gets: every sitemap URL answers 200 with a matching canonical, no noindex
// (meta or X-Robots-Tag), a title and description, valid structured data; robots.txt and sitemap.xml are
// reachable; http/www go to https://muslimabaya.com; a missing page answers 404; internal links work.
// Sends the report to /api/seo-report (header X-SEO-Audit-Key) for Admin → SEO Manager.
//   node scripts/seo-live-audit.mjs                 → prints the report
//   SEO_AUDIT_KEY=… node scripts/seo-live-audit.mjs --send
import { blocksSearch, parseHead, robotsIssues, sitemapUrls, pageIssues, duplicateTitleIssues, brokenLinkIssue } from '../functions/_lib/seo-live-checks.js';
const SITE = process.env.SEO_SITE || 'https://muslimabaya.com';
const CONCURRENCY = 6;
const UA = 'MuslimAbaya-SEO-Audit/1.0 (+https://muslimabaya.com/)';

const issues = [];
const add = (level, type, url, message, fix) => issues.push({ level, type, url, message, fix: fix || '' });
const unesc = (s) => String(s || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

async function get(url, opts = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { redirect: opts.redirect || 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    const body = opts.body === false ? '' : await res.text();
    return { status: res.status, url: res.url, headers: res.headers, body, ms: Date.now() - t0 };
  } catch (e) { return { status: 0, error: String(e.message || e), ms: Date.now() - t0, body: '', headers: new Headers() }; }
}
async function pool(items, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}
export { blocksSearch, parseHead };

export async function run() {
  const started = Date.now();
  const robots = await get(SITE + '/robots.txt');
  robotsIssues(robots.status, robots.body).forEach((i) => issues.push(i));
  const sm = await get(SITE + '/sitemap.xml');
  const locs = sm.status === 200 ? sitemapUrls(sm.body) : [];
  if (sm.status !== 200 || !locs.length) add('error', 'sitemap-unreachable', SITE + '/sitemap.xml', 'sitemap.xml answered ' + sm.status + ' or is empty.', '');

  // Site-wide signals.
  const checks = [
    ['http://muslimabaya.com/', 'http-not-https', 'http:// does not redirect to https://'],
    ['https://www.muslimabaya.com/', 'www-not-apex', 'www.muslimabaya.com does not redirect to muslimabaya.com'],
  ];
  for (const [url, type, msg] of checks) {
    const r = await get(url, { body: false });
    if (r.status && r.status !== 200) continue;
    if (r.status === 0 || !String(r.url || '').startsWith(SITE + '/')) add('warning', type, url, msg + (r.status === 0 ? ' (no answer).' : '.'), 'Check the Cloudflare redirect rules.');
  }
  const missing = await get(SITE + '/seo-audit-missing-page-check', { body: false });
  if (missing.status !== 404) add('error', 'soft-404', SITE + '/seo-audit-missing-page-check', 'A page that does not exist answered ' + missing.status + ' instead of 404.', '');

  const titles = {};
  const links = new Map();
  const results = await pool(locs, async (loc) => {
    const r = await get(loc);
    const res = pageIssues(loc, { status: r.status, url: r.url, body: r.body, ms: r.ms, robotsHeader: r.headers.get('x-robots-tag') || '' });
    res.issues.forEach((i) => issues.push(i));
    if (res.title) (titles[res.title] = titles[res.title] || []).push(loc);
    res.links.forEach((p) => { if (!links.has(p)) links.set(p, loc); });
    return r.ms;
  });
  duplicateTitleIssues(titles).forEach((i) => issues.push(i));

  const known = new Set(locs.map((l) => new URL(l).pathname.replace(/\/$/, '') || '/'));
  const toCheck = Array.from(links.keys()).filter((p) => !known.has(p.replace(/\/$/, '') || '/')).slice(0, 150);
  await pool(toCheck, async (p) => {
    const r = await get(SITE + p, { body: false });
    const b = brokenLinkIssue(p, r.status, links.get(p)); if (b) issues.push(b);
  });

  const ms = results.filter(Boolean);
  const count = (l) => issues.filter((i) => i.level === l).length;
  return {
    version: 1, source: 'live', generatedAt: new Date().toISOString(),
    summary: { urls: locs.length, linksChecked: toCheck.length, errors: count('error'), warnings: count('warning'), info: count('info'), msAverage: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0, durationMs: Date.now() - started },
    issues,
  };
}

if (process.argv[1] && process.argv[1].endsWith('seo-live-audit.mjs')) {
  const report = await run();
  const s = report.summary;
  console.log('Live SEO audit: ' + s.urls + ' sitemap URLs, ' + s.linksChecked + ' other links, ' + s.errors + ' errors, ' + s.warnings + ' warnings, avg ' + s.msAverage + ' ms.');
  report.issues.slice(0, 40).forEach((i) => console.log('  ' + i.level.toUpperCase() + ' [' + i.type + '] ' + i.url + ' — ' + i.message));
  if (process.argv.includes('--send')) {
    // GitHub Actions: a short-lived token signed by GitHub for this workflow run (no secret needed).
    // Otherwise (by hand): SEO_AUDIT_KEY, if the Pages secret of the same name is set.
    const headers = { 'Content-Type': 'application/json' };
    if (process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
      const t = await fetch(process.env.ACTIONS_ID_TOKEN_REQUEST_URL + '&audience=' + encodeURIComponent(SITE + '/api/seo-report'), { headers: { Authorization: 'bearer ' + process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN } }).then((r) => r.json());
      if (!t || !t.value) { console.log('Could not get the GitHub OIDC token: report not sent.'); process.exit(1); }
      headers.Authorization = 'Bearer ' + t.value;
    } else if (process.env.SEO_AUDIT_KEY) headers['X-SEO-Audit-Key'] = process.env.SEO_AUDIT_KEY;
    else { console.log('No GitHub OIDC token and no SEO_AUDIT_KEY: report not sent.'); process.exit(1); }
    const res = await fetch(SITE + '/api/seo-report', { method: 'POST', headers, body: JSON.stringify(report) });
    const out = await res.json().catch(() => ({}));
    console.log('Report sent: HTTP ' + res.status + ' ' + JSON.stringify(out));
    if (!res.ok || !out.ok) process.exit(1);
  }
}
