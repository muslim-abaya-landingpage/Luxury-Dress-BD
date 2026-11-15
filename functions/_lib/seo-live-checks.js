/**
 * Live-site SEO checks, shared by scripts/seo-live-audit.mjs (GitHub Actions / by hand) and the daily audit
 * that /api/cron-tick runs in small steps on the website's own server.
 */
export const SITE = 'https://muslimabaya.com';
const unesc = (s) => String(s || '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const issue = (level, type, url, message, fix) => ({ level, type, url, message, fix: fix || '' });

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

export function sitemapUrls(xml) {
  return (String(xml || '').match(/<loc>([^<]+)<\/loc>/g) || []).map((l) => l.replace(/<\/?loc>/g, '').trim());
}

export function robotsIssues(status, body) {
  if (status !== 200) return [issue('error', 'robots-unreachable', SITE + '/robots.txt', 'robots.txt answered ' + status + '.')];
  const out = [];
  if (!/^Sitemap:\s*https:\/\/muslimabaya\.com\/sitemap\.xml/im.test(body)) out.push(issue('warning', 'robots-no-sitemap', SITE + '/robots.txt', 'robots.txt does not point to the sitemap.'));
  if (blocksSearch(body)) out.push(issue('error', 'robots-blocks-all', SITE + '/robots.txt', 'robots.txt blocks the whole site for Google (User-agent: * or Googlebot).'));
  return out;
}

/**
 * Checks one sitemap page as fetched: {status, url (final), body, ms, robotsHeader}.
 * Returns {issues, title, links: [internal paths]}.
 */
export function pageIssues(loc, r) {
  const issues = [];
  if (r.status !== 200) return { issues: [issue('error', 'sitemap-url-status', loc, 'Sitemap URL answered ' + (r.status || 'no response') + '.', 'Remove it from the sitemap or fix the page.')], title: '', links: [] };
  if (r.url && r.url.replace(/\/$/, '') !== loc.replace(/\/$/, '')) issues.push(issue('warning', 'sitemap-redirect', loc, 'Sitemap URL redirects to ' + r.url + '.', 'List the final URL in the sitemap.'));
  const h = parseHead(r.body);
  if (/noindex/i.test(r.robotsHeader || '') || /noindex/i.test(h.robots)) issues.push(issue('error', 'sitemap-noindex', loc, 'Page in the sitemap is noindex.'));
  if (!h.title) issues.push(issue('error', 'missing-title', loc, 'No <title>.'));
  if (!h.description) issues.push(issue('error', 'missing-description', loc, 'No meta description.'));
  if (!h.canonical) issues.push(issue('error', 'missing-canonical', loc, 'No canonical URL.'));
  else if (h.canonical.replace(/\/$/, '') !== loc.replace(/\/$/, '') && !/\/product\//.test(loc)) issues.push(issue('warning', 'canonical-mismatch', loc, 'Canonical is ' + h.canonical + '.'));
  (r.body.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || []).forEach((b) => {
    try { const d = JSON.parse(b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '')); if (/"(aggregateRating|review)"/.test(JSON.stringify(d))) issues.push(issue('error', 'schema-rating', loc, 'Structured data contains a rating/review.')); }
    catch (e) { issues.push(issue('error', 'schema-invalid-json', loc, 'Structured data is not valid JSON.')); }
  });
  if (r.ms > 3000) issues.push(issue('warning', 'slow-response', loc, 'Server answered in ' + r.ms + ' ms.'));
  const links = [];
  (r.body.match(/\bhref="(\/[^"#?]*)/g) || []).forEach((m) => {
    const p = m.slice(6);
    if (/^\/(?:api|cdn-cgi)\//.test(p) || /\.(?:css|js|png|jpe?g|webp|avif|svg|ico|json|xml|txt|woff2?|webmanifest|csv|gif|mp4)$/i.test(p)) return;
    if (links.indexOf(p) < 0) links.push(p);
  });
  return { issues, title: h.title, links };
}

export function duplicateTitleIssues(titles) {
  return Object.entries(titles).filter(([, urls]) => urls.length > 1).map(([t, urls]) => issue('warning', 'duplicate-title', urls[0], urls.length + ' pages share the title "' + t.slice(0, 70) + '".', 'Give each page its own title.'));
}

export function brokenLinkIssue(path, status, from) {
  return (status === 404 || status === 410 || status >= 500 || status === 0) ? issue('error', 'broken-link', SITE + path, 'Internal link answers ' + (status || 'no response') + ' — linked from ' + from, 'Fix the link or add a redirect in SEO Manager → Redirects.') : null;
}

export function report(issues, extra) {
  const count = (l) => issues.filter((i) => i.level === l).length;
  return { version: 1, source: 'live', generatedAt: new Date().toISOString(), summary: Object.assign({ errors: count('error'), warnings: count('warning'), info: count('info') }, extra || {}), issues };
}
