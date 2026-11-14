// Scheduled SEO audit of the LIVE website (GitHub Actions: .github/workflows/seo-audit.yml, daily; can also be run by hand).
// Checks what Google actually gets: every sitemap URL answers 200 with a matching canonical, no noindex
// (meta or X-Robots-Tag), a title and description, valid structured data; robots.txt and sitemap.xml are
// reachable; http/www go to https://muslimabaya.com; a missing page answers 404; internal links work.
// Sends the report to /api/seo-report (header X-SEO-Audit-Key) for Admin → SEO Manager.
//   node scripts/seo-live-audit.mjs                 → prints the report
//   SEO_AUDIT_KEY=… node scripts/seo-live-audit.mjs --send
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
/** True when the group that applies to Googlebot ("Googlebot", else "*") has "Disallow: /". Other bots' groups are ignored. */
export function blocksSearch(txt) {
  const groups = []; let cur = null, lastWasAgent = false;
  String(txt || '').split(/\r?\n/).forEach((line) => {
    const m = /^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*(?:#.*)?$/.exec(line);
    if (!m) return;
    const k = m[1].toLowerCase(), v = m[2];
    if (k === 'user-agent') { if (!lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasAgent = true; return; }
    lastWasAgent = false;
    if (cur && (k === 'disallow' || k === 'allow')) cur.rules.push([k, v]);
  });
  const pick = groups.filter((g) => g.agents.includes('googlebot'));
  const use = pick.length ? pick : groups.filter((g) => g.agents.includes('*'));
  return use.some((g) => g.rules.some(([k, v]) => k === 'disallow' && v === '/') && !g.rules.some(([k, v]) => k === 'allow' && v === '/'));
}

export function parseHead(html) {
  const meta = (attr, key) => { const tag = (html.match(/<meta\b[^>]*>/gi) || []).find((t) => new RegExp(attr + '=["\']' + key + '["\']', 'i').test(t)); const m = tag && /\bcontent=(["'])([\s\S]*?)\1/i.exec(tag); return m ? unesc(m[2]) : ''; };
  const t = /<title>([\s\S]*?)<\/title>/i.exec(html);
  const c = /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i.exec(html);
  return { title: t ? unesc(t[1].trim()) : '', description: meta('name', 'description'), robots: meta('name', 'robots'), canonical: c ? c[1] : '' };
}

export async function run() {
  const started = Date.now();
  const robots = await get(SITE + '/robots.txt');
  if (robots.status !== 200) add('error', 'robots-unreachable', SITE + '/robots.txt', 'robots.txt answered ' + robots.status + '.', '');
  else {
    if (!/^Sitemap:\s*https:\/\/muslimabaya\.com\/sitemap\.xml/im.test(robots.body)) add('warning', 'robots-no-sitemap', SITE + '/robots.txt', 'robots.txt does not point to the sitemap.', '');
    if (blocksSearch(robots.body)) add('error', 'robots-blocks-all', SITE + '/robots.txt', 'robots.txt blocks the whole site for Google (User-agent: * or Googlebot).', '');
  }
  const sm = await get(SITE + '/sitemap.xml');
  const locs = sm.status === 200 ? (sm.body.match(/<loc>([^<]+)<\/loc>/g) || []).map((l) => l.replace(/<\/?loc>/g, '').trim()) : [];
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
    if (r.status !== 200) { add('error', 'sitemap-url-status', loc, 'Sitemap URL answered ' + (r.status || 'no response') + '.', 'Remove it from the sitemap or fix the page.'); return r.ms; }
    if (r.url && r.url.replace(/\/$/, '') !== loc.replace(/\/$/, '')) add('warning', 'sitemap-redirect', loc, 'Sitemap URL redirects to ' + r.url + '.', 'List the final URL in the sitemap.');
    const xr = r.headers.get('x-robots-tag') || '';
    const h = parseHead(r.body);
    if (/noindex/i.test(xr) || /noindex/i.test(h.robots)) add('error', 'sitemap-noindex', loc, 'Page in the sitemap is noindex.', '');
    if (!h.title) add('error', 'missing-title', loc, 'No <title>.', ''); else (titles[h.title] = titles[h.title] || []).push(loc);
    if (!h.description) add('error', 'missing-description', loc, 'No meta description.', '');
    if (!h.canonical) add('error', 'missing-canonical', loc, 'No canonical URL.', '');
    else if (h.canonical.replace(/\/$/, '') !== loc.replace(/\/$/, '') && !/\/product\//.test(loc)) add('warning', 'canonical-mismatch', loc, 'Canonical is ' + h.canonical + '.', '');
    (r.body.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || []).forEach((b) => {
      try { const d = JSON.parse(b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')); if (/"(aggregateRating|review)"/.test(JSON.stringify(d))) add('error', 'schema-rating', loc, 'Structured data contains a rating/review.', ''); }
      catch (e) { add('error', 'schema-invalid-json', loc, 'Structured data is not valid JSON.', ''); }
    });
    if (r.ms > 3000) add('warning', 'slow-response', loc, 'Server answered in ' + r.ms + ' ms.', '');
    (r.body.match(/\bhref="(\/[^"#?]*)/g) || []).forEach((m) => {
      const p = m.slice(6);
      if (/^\/(?:api|cdn-cgi)\//.test(p) || /\.(?:css|js|png|jpe?g|webp|avif|svg|ico|json|xml|txt|woff2?|webmanifest|csv|gif|mp4)$/i.test(p)) return;
      if (!links.has(p)) links.set(p, loc);
    });
    return r.ms;
  });
  Object.entries(titles).forEach(([t, urls]) => { if (urls.length > 1) add('warning', 'duplicate-title', urls[0], urls.length + ' pages share the title "' + t.slice(0, 70) + '".', 'Give each page its own title.'); });

  const known = new Set(locs.map((l) => new URL(l).pathname.replace(/\/$/, '') || '/'));
  const toCheck = Array.from(links.keys()).filter((p) => !known.has(p.replace(/\/$/, '') || '/')).slice(0, 150);
  await pool(toCheck, async (p) => {
    const r = await get(SITE + p, { body: false });
    if (r.status === 404 || r.status === 410 || r.status >= 500 || r.status === 0) add('error', 'broken-link', SITE + p, 'Internal link answers ' + (r.status || 'no response') + ' — linked from ' + links.get(p), 'Fix the link or add a redirect in SEO Manager → Redirects.');
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
    if (!process.env.SEO_AUDIT_KEY) { console.log('SEO_AUDIT_KEY is not set: report not sent.'); process.exit(1); }
    const res = await fetch(SITE + '/api/seo-report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SEO-Audit-Key': process.env.SEO_AUDIT_KEY }, body: JSON.stringify(report) });
    const out = await res.json().catch(() => ({}));
    console.log('Report sent: HTTP ' + res.status + ' ' + JSON.stringify(out));
    if (!res.ok || !out.ok) process.exit(1);
  }
}
