// Applies Admin → SEO Manager settings (seo-settings.json) to the server-rendered website at deploy.
// Run by scripts/build-cloudflare.mjs after the product/category/home pages are built:
//   * page title / description / robots / share image → <head> of that page (and data-seo-managed="full",
//     so site-seo.js in the browser keeps exactly what Google gets in the HTML)
//   * Search Console / Bing verification codes → <meta> on the homepage
//   * redirects → managed block at the end of _redirects;  extra Disallow lines → managed block in robots.txt
// Also writes seo-pages.json: every public page with its automatic (built) title/description, which the
// SEO Manager shows as the suggestion next to any manual value.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sanitizeSettings, redirectLines } from '../functions/_lib/seo-settings.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(root, f), s);
const SITE = 'https://muslimabaya.com';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const unesc = (s) => String(s ?? '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

// Pages that are not part of the public shop (admin tools, verification files, internal modals).
export const NOT_PUBLIC = /^(?:admin-|api-setup|apps-script-copy|product-manager|product-links|stock-analytics|google[0-9a-f]+|muslim-abaya-premium-modal|support-agent-|product\.html$)/;

export function publicPages() {
  return fs.readdirSync(root).filter((f) => /\.html$/.test(f) && !NOT_PUBLIC.test(f)).sort().map((file) => ({
    file, path: file === 'index.html' ? '/' : '/' + file.replace(/\.html$/, ''),
  }));
}

export function headValues(html) {
  const meta = (attr, key) => {
    const tag = (html.match(/<meta\b[^>]*>/gi) || []).find((t) => new RegExp(attr + '=["\']' + key + '["\']', 'i').test(t));
    const m = tag && /\bcontent=(["'])([\s\S]*?)\1/i.exec(tag);
    return m ? unesc(m[2]) : '';
  };
  const t = /<title>([\s\S]*?)<\/title>/i.exec(html);
  const c = /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i.exec(html);
  return {
    title: t ? unesc(t[1].trim()) : '', description: meta('name', 'description'), robots: meta('name', 'robots'),
    canonical: c ? c[1] : '', image: meta('property', 'og:image'),
  };
}

function upsertMeta(html, attr, key, value) {
  const re = new RegExp('<meta\\s+' + attr + '=["\']' + key.replace(/[:]/g, '\\$&') + '["\'][^>]*>', 'i');
  const tag = '<meta ' + attr + '="' + key + '" content="' + esc(value) + '">';
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', tag + '\n</head>');
}

/** One page's <head> with the manual values; untouched parts stay exactly as built. */
export function applyPage(html, row, pagePath, global) {
  let out = html;
  if (row.title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + esc(row.title) + '</title>');
    out = upsertMeta(out, 'property', 'og:title', row.title);
    out = upsertMeta(out, 'name', 'twitter:title', row.title);
  }
  if (row.description) {
    out = upsertMeta(out, 'name', 'description', row.description);
    out = upsertMeta(out, 'property', 'og:description', row.description);
    out = upsertMeta(out, 'name', 'twitter:description', row.description);
  }
  if (row.robots) out = upsertMeta(out, 'name', 'robots', row.robots);
  const image = row.image || '';
  if (image) { out = upsertMeta(out, 'property', 'og:image', image); out = upsertMeta(out, 'name', 'twitter:image', image); }
  if (!/<link\s+rel=["']canonical["']/i.test(out)) out = out.replace('</head>', '<link rel="canonical" href="' + SITE + (pagePath === '/' ? '/' : pagePath) + '">\n</head>');
  // The browser script must not replace these with its own list (site-seo.js skips "full" pages).
  out = out.replace(/<html\b([^>]*)>/i, (m, attrs) => '<html' + attrs.replace(/\s+data-seo-managed="[^"]*"/, '') + ' data-seo-managed="full">');
  return out;
}

// Account / order / error pages: useful to visitors, not search results.
export const AUTO_NOINDEX = new Set(['/404', '/checkout', '/thank-you', '/success', '/signin', '/signup', '/forgot-password', '/order-track']);

/**
 * Automatic SEO for a public page: only what is MISSING is added (a robots tag for account/order pages,
 * a self canonical, a description made from the page's own title). Existing tags are never changed.
 */
export function autoPage(html, pagePath) {
  const h = headValues(html);
  const row = {};
  if (!h.robots && AUTO_NOINDEX.has(pagePath)) row.robots = 'noindex, follow';
  const noindex = /noindex/i.test(row.robots || h.robots);
  if (!h.description && h.title) {
    const base = h.title.replace(/\s*[|–—-]\s*Muslim Abaya.*$/i, '').replace(/^Muslim Abaya\s*[|–—-]?\s*/i, '').trim() || h.title;
    row.description = (base + ' — Muslim Abaya: বাংলাদেশে মডেস্ট ফ্যাশন, সারা দেশে ক্যাশ অন ডেলিভারি।').slice(0, 160);
  }
  if (!Object.keys(row).length && (h.canonical || noindex)) return { html, added: null };
  let out = html;
  if (row.robots) out = upsertMeta(out, 'name', 'robots', row.robots);
  if (row.description) { out = upsertMeta(out, 'name', 'description', row.description); out = upsertMeta(out, 'property', 'og:description', row.description); }
  if (!h.canonical && !noindex) { out = out.replace('</head>', '<link rel="canonical" href="' + SITE + (pagePath === '/' ? '/' : pagePath) + '">\n</head>'); row.canonical = SITE + pagePath; }
  out = out.replace(/<html\b([^>]*)>/i, (m, attrs) => '<html' + attrs.replace(/\s+data-seo-managed="[^"]*"/, '') + ' data-seo-managed="full">');
  return { html: out, added: row };
}

export function applyGlobal(html, global) {
  let out = html.replace(/\s*<meta name="(?:google-site-verification|msvalidate\.01)" content="[^"]*" data-seo-manager>/g, '');
  const tags = [];
  if (global.googleVerification) tags.push('<meta name="google-site-verification" content="' + esc(global.googleVerification) + '" data-seo-manager>');
  if (global.bingVerification) tags.push('<meta name="msvalidate.01" content="' + esc(global.bingVerification) + '" data-seo-manager>');
  return tags.length ? out.replace('</head>', tags.join('\n') + '\n</head>') : out;
}

const BEGIN = '# BEGIN SEO Manager (Admin → SEO Manager; do not edit by hand)';
const END = '# END SEO Manager';
export function managedBlock(text, lines, before) {
  const clean = text.replace(new RegExp('\\n?' + BEGIN.replace(/[()→;]/g, '\\$&') + '[\\s\\S]*?' + END + '\\n?', 'g'), '\n').replace(/\n{3,}/g, '\n\n');
  if (!lines.length) return clean;
  const block = BEGIN + '\n' + lines.join('\n') + '\n' + END + '\n';
  if (before && clean.indexOf(before) >= 0) return clean.replace(before, block + '\n' + before);
  return clean.replace(/\s*$/, '\n\n') + block;
}

export function run() {
  let raw = {};
  try { raw = JSON.parse(read('seo-settings.json')); } catch (e) { console.log('seo-settings.json missing or unreadable: using automatic SEO only.'); }
  const { settings, errors } = sanitizeSettings(raw);
  errors.forEach((e) => console.log('SEO Manager setting skipped: ' + e));
  const pages = publicPages();
  const report = [];
  let changed = 0;
  for (const pg of pages) {
    const html = read(pg.file);
    const auto = headValues(html);
    const row = settings.pages[pg.path];
    let next = html;
    if (row) next = applyPage(next, row, pg.path, settings.global);
    const filled = autoPage(next, pg.path);
    next = filled.html;
    if (pg.path === '/') next = applyGlobal(next, settings.global);
    if (next !== html) { write(pg.file, next); changed++; }
    report.push({ path: pg.path, file: pg.file, auto, manual: row || null, autoAdded: filled.added });
  }
  write('seo-pages.json', JSON.stringify({ version: 1, pages: report }));
  write('_redirects', managedBlock(read('_redirects'), redirectLines(settings)));
  // /product/… is served by Pages Functions, where _redirects does not apply: functions/_middleware.js reads this.
  const fnRedirects = {};
  settings.redirects.filter((r) => /^\/product\//i.test(r.from)).forEach((r) => { fnRedirects[r.from.replace(/\.html$/, '').toLowerCase()] = { to: r.to, code: r.code }; });
  write('seo-redirects.json', JSON.stringify(fnRedirects));
  write('robots.txt', managedBlock(read('robots.txt'), settings.robots.disallow.map((d) => 'Disallow: ' + d), 'Sitemap:'));
  console.log('SEO Manager: ' + Object.keys(settings.pages).length + ' page setting(s) on ' + changed + ' page(s), ' + settings.redirects.length + ' redirect(s), ' + settings.robots.disallow.length + ' robots line(s).');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
