/**
 * SEO Manager settings (seo-settings.json in the repository root).
 *
 * One file holds what the owner changes from Admin → SEO Manager without editing code:
 *   global    — Search Console / Bing verification codes, default share (Open Graph) image
 *   pages     — title / description / robots / share image for the homepage, category pages and other pages
 *   redirects — 301 / 302 redirects (written into _redirects at deploy)
 *   robots    — extra Disallow lines for robots.txt (written at deploy)
 *
 * The same rules run on the server (functions/api/seo-settings.js, before anything is saved) and at deploy
 * (scripts/build-seo-settings.mjs), so a bad value can never reach the live HTML.
 */

export const SEO_FILE = 'seo-settings.json';
export const DEFAULT_SETTINGS = { version: 1, global: {}, pages: {}, redirects: [], robots: { disallow: [] } };

export const ROBOTS_VALUES = ['index, follow', 'noindex, follow', 'noindex, nofollow'];
export const LIMITS = { title: 120, description: 320, redirects: 200, disallow: 50, pages: 200, intro: 1200, faq: 12, question: 200, answer: 1000 };
const SITE_HOSTS = ['muslimabaya.com', 'www.muslimabaya.com', 'images.muslimabaya.com'];
// Paths whose behaviour belongs to the shop itself: never redirected away and never blocked by the SEO Manager.
const PROTECTED = /^\/(?:$|api(?:\/|$)|admin|product-manager|product-links|stock-analytics|checkout|cdn-cgi(?:\/|$)|robots\.txt$|sitemap\.xml$|seo-settings\.json$|_)/i;

/** Plain one-line text: no tags, no control characters, single spaces. */
export function cleanText(value, max) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function siteUrl(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  let u;
  try { u = new URL(v); } catch (e) { return null; }
  if (u.protocol !== 'https:' || SITE_HOSTS.indexOf(u.hostname) < 0 || u.username || u.password) return null;
  return u.href;
}

/** A site path such as /abaya or /help (no query, no fragment, no "..", no spaces). */
export function cleanPath(value) {
  const v = String(value || '').trim();
  if (!/^\/[A-Za-z0-9\-._~\/ঀ-৿%]*$/.test(v) || /\/\.\.?(?:\/|$)/.test(v) || /\/\//.test(v)) return null;
  return v.length > 1 ? v.replace(/\/+$/, '') : v;
}

/**
 * Returns {ok, settings, errors}. Unknown keys are dropped; every kept value has passed its rule.
 * errors are short English sentences the admin page shows next to the Save button.
 */
export function sanitizeSettings(input) {
  const errors = [];
  const src = input && typeof input === 'object' ? input : {};
  const out = { version: 1, global: {}, pages: {}, redirects: [], robots: { disallow: [] } };

  const g = src.global && typeof src.global === 'object' ? src.global : {};
  ['googleVerification', 'bingVerification'].forEach((k) => {
    const v = String(g[k] || '').trim();
    if (!v) return;
    // Accept the bare code or the whole <meta ... content="..."> tag that Google / Bing show.
    const m = /content=["']([^"']+)["']/i.exec(v);
    const code = (m ? m[1] : v).trim();
    if (/^[A-Za-z0-9_\-]{10,100}$/.test(code)) out.global[k] = code;
    else errors.push((k === 'googleVerification' ? 'Google' : 'Bing') + ' verification code is not valid.');
  });
  if (g.ga4PropertyId) {
    const id = String(g.ga4PropertyId).replace(/^properties\//, '').trim();
    if (/^\d{6,14}$/.test(id)) out.global.ga4PropertyId = id; else errors.push('GA4 property ID must be the number shown in GA4 → Admin → Property details.');
  }
  if (g.gscProperty) {
    const v = String(g.gscProperty).trim();
    if (v === 'sc-domain:muslimabaya.com' || v === 'https://muslimabaya.com/' || v === 'https://www.muslimabaya.com/') out.global.gscProperty = v;
    else errors.push('Search Console property must be sc-domain:muslimabaya.com or https://muslimabaya.com/.');
  }
  if (g.defaultImage) {
    const img = siteUrl(g.defaultImage);
    if (img) out.global.defaultImage = img; else errors.push('Default share image must be an https link on muslimabaya.com.');
  }

  const pages = src.pages && typeof src.pages === 'object' ? src.pages : {};
  Object.keys(pages).slice(0, LIMITS.pages).forEach((rawPath) => {
    const path = cleanPath(rawPath);
    const p = pages[rawPath] && typeof pages[rawPath] === 'object' ? pages[rawPath] : {};
    if (!path || /^\/(?:api|admin|product)(?:[\/-]|$)/.test(path)) { errors.push('Page ' + String(rawPath).slice(0, 40) + ' cannot be edited here.'); return; }
    const row = {};
    const title = cleanText(p.title, LIMITS.title);
    const description = cleanText(p.description, LIMITS.description);
    if (title) row.title = title;
    if (description) row.description = description;
    if (p.robots) {
      if (ROBOTS_VALUES.indexOf(String(p.robots)) >= 0) row.robots = String(p.robots);
      else errors.push(path + ': robots must be one of ' + ROBOTS_VALUES.join(' / ') + '.');
    }
    if (p.image) {
      const img = siteUrl(p.image);
      if (img) row.image = img; else errors.push(path + ': share image must be an https link on muslimabaya.com.');
    }
    // Category pages: a short visible introduction and questions & answers (shown on the page, not only to Google).
    const intro = cleanText(p.intro, LIMITS.intro);
    if (intro) row.intro = intro;
    if (Array.isArray(p.faq)) {
      const faq = [];
      p.faq.forEach((item) => {
        const q = cleanText(item && item.q, LIMITS.question), a = cleanText(item && item.a, LIMITS.answer);
        if (!q && !a) return;
        if (!q || !a) { errors.push(path + ': every question needs an answer (and every answer a question).'); return; }
        if (faq.length >= LIMITS.faq) { errors.push(path + ': at most ' + LIMITS.faq + ' questions.'); return; }
        faq.push({ q, a });
      });
      if (faq.length) row.faq = faq;
    }
    if (Object.keys(row).length) out.pages[path] = row;
  });

  const seen = {};
  (Array.isArray(src.redirects) ? src.redirects : []).slice(0, LIMITS.redirects + 1).forEach((r, i) => {
    if (i >= LIMITS.redirects) { errors.push('At most ' + LIMITS.redirects + ' redirects.'); return; }
    if (!r || typeof r !== 'object') return;
    const from = cleanPath(r.from);
    const toRaw = String(r.to || '').trim();
    const to = toRaw.charAt(0) === '/' ? cleanPath(toRaw) : siteUrl(toRaw);
    const code = Number(r.code) === 302 ? 302 : 301;
    const label = 'Redirect ' + (i + 1);
    if (!from) { errors.push(label + ': "From" must be a path like /old-page.'); return; }
    if (PROTECTED.test(from)) { errors.push(label + ': ' + from + ' is part of the shop and cannot be redirected.'); return; }
    if (!to) { errors.push(label + ': "To" must be a path like /new-page or a muslimabaya.com link.'); return; }
    if (to === from) { errors.push(label + ': "From" and "To" are the same.'); return; }
    if (seen[from.toLowerCase()]) { errors.push(label + ': ' + from + ' is listed twice.'); return; }
    seen[from.toLowerCase()] = true;
    out.redirects.push({ from, to, code });
  });
  // A redirect whose target is itself redirected makes a chain (or a loop): report it, Google follows few hops.
  const byFrom = {};
  out.redirects.forEach((r) => { byFrom[r.from.toLowerCase()] = r.to; });
  out.redirects.forEach((r) => {
    let hop = r.to, n = 0;
    while (hop.charAt(0) === '/' && byFrom[hop.toLowerCase()] && n < 10) { hop = byFrom[hop.toLowerCase()]; n++; if (hop.toLowerCase() === r.from.toLowerCase()) break; }
    if (hop.toLowerCase() === r.from.toLowerCase()) errors.push('Redirect loop: ' + r.from + ' comes back to itself.');
    else if (n) errors.push('Redirect chain: ' + r.from + ' → ' + r.to + ' is redirected again; point it straight to ' + hop + '.');
  });

  const dis = src.robots && Array.isArray(src.robots.disallow) ? src.robots.disallow : [];
  dis.slice(0, LIMITS.disallow).forEach((d) => {
    const v = String(d || '').trim();
    if (!v) return;
    if (!/^\/[A-Za-z0-9\-._~\/*$%]*$/.test(v) || v === '/' || v === '/*') { errors.push('robots.txt: "' + v.slice(0, 40) + '" is not allowed (it must be a path, and the whole site cannot be blocked).'); return; }
    if (/^\/(?:product|abaya|cover-up|premium-two-piece|tops-kurti|embroidery|karchupi|kaftan|hijab|panjabi|three-piece-dress|category|sitemap\.xml|images)(?:[\/*$]|$)/i.test(v)) { errors.push('robots.txt: "' + v + '" would hide products or category pages from Google.'); return; }
    if (out.robots.disallow.indexOf(v) < 0) out.robots.disallow.push(v);
  });

  return { ok: errors.length === 0, settings: out, errors };
}

/** Lines for the managed block of _redirects. */
export function redirectLines(settings) {
  return (settings.redirects || []).map((r) => r.from + '  ' + r.to + '  ' + r.code);
}
