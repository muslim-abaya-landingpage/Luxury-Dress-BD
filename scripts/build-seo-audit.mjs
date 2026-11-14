// SEO audit of the built website (every deploy; run by scripts/build-cloudflare.mjs after build-seo-settings).
// Reads the HTML that is about to go live and writes seo-report.json for Admin → SEO Manager:
//   errors   — must be fixed (broken internal links, invalid structured data, wrong canonical, noindex in sitemap…)
//   warnings — should be fixed (duplicate / too long titles and descriptions, missing alt text…)
//   info     — recommendations (approve automatic SEO, add a primary keyword…)
// It never changes the website; a problem is reported, not "fixed" by guessing.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicPages, headValues } from './build-seo-settings.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const exists = (f) => { try { return fs.statSync(path.join(root, f)).isFile(); } catch (e) { return false; } };
const SITE = 'https://muslimabaya.com';
const AVAIL = new Set(['https://schema.org/InStock', 'https://schema.org/OutOfStock', 'https://schema.org/BackOrder', 'https://schema.org/PreOrder', 'https://schema.org/LimitedAvailability', 'https://schema.org/Discontinued']);

export function audit(options = {}) {
  const issues = [];
  const add = (level, type, url, message, fix) => issues.push({ level, type, url, message, fix: fix || '' });

  // Catalog (published products) through the same code the shop uses.
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  for (const f of ['product-config.js', 'product-utils.js', 'category-products.js', 'product-links-data.js', 'product-catalog-sync.js']) vm.runInContext(read(f), ctx, { filename: f });
  const w = ctx.window;
  const cats = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, w.PRODUCT_LINKS_DATA || w.PRODUCT_IMAGE_LISTS || {});
  const products = [];
  Object.entries(cats).forEach(([cat, rows]) => rows.forEach((p) => { if (p && p.id && p.name && !p.isImageView) products.push({ p, cat }); }));

  // Pages that go live: public pages + one page per published product.
  const pages = publicPages().map((pg) => ({ ...pg, kind: 'page' }));
  products.forEach(({ p }) => { const f = 'product/' + p.id + '.html'; if (exists(f)) pages.push({ file: f, path: '/product/' + p.id, kind: 'product', id: p.id }); });

  const sitemap = exists('sitemap.xml') ? read('sitemap.xml') : '';
  const locs = (sitemap.match(/<loc>([^<]+)<\/loc>/g) || []).map((l) => l.replace(/<\/?loc>/g, '').trim());
  const locSet = new Set(locs);
  const redirectsFrom = new Set(read('_redirects').split('\n').map((l) => l.trim()).filter((l) => l && l[0] !== '#').map((l) => l.split(/\s+/)[0].toLowerCase()));

  const titles = {}, descs = {};
  const linkSources = {};
  for (const pg of pages) {
    const html = read(pg.file);
    const h = headValues(html);
    const url = SITE + (pg.path === '/' ? '/' : pg.path);
    const noindex = /noindex/i.test(h.robots);
    if (!h.title) add('error', 'missing-title', url, 'Page has no <title>.', 'Add a title in SEO Manager → Pages.');
    else {
      if (!noindex) (titles[h.title] = titles[h.title] || []).push(url);
      if (h.title.length > 65) add('warning', 'long-title', url, 'Title is ' + h.title.length + ' characters; Google shows about 60.', 'Shorten it' + (pg.kind === 'product' ? ' in Product Manager → SEO title.' : ' in SEO Manager → Pages.'));
      if (h.title.length < 15) add('warning', 'short-title', url, 'Title is only ' + h.title.length + ' characters.', 'Describe the page in 30–60 characters.');
    }
    if (!h.description) add(noindex ? 'info' : 'error', 'missing-description', url, 'Page has no meta description.', 'Add one in SEO Manager.');
    else {
      if (!noindex) (descs[h.description] = descs[h.description] || []).push(url);
      if (h.description.length > 170) add('warning', 'long-description', url, 'Meta description is ' + h.description.length + ' characters; Google shows about 160.', 'Shorten it.');
      if (h.description.length < 50) add('warning', 'short-description', url, 'Meta description is only ' + h.description.length + ' characters.', 'Use 120–160 characters.');
    }
    if (!h.canonical) { if (!noindex) add('error', 'missing-canonical', url, 'No canonical URL.', 'Each indexable page needs <link rel="canonical">.'); }
    else if (!/^https:\/\/muslimabaya\.com\//.test(h.canonical)) add('error', 'bad-canonical', url, 'Canonical points outside the site: ' + h.canonical, '');
    else if (h.canonical !== url && pg.kind === 'page' && !noindex) add('warning', 'canonical-mismatch', url, 'Canonical is ' + h.canonical + ', not this page.', 'Only intended when this page duplicates another one.');
    if (noindex && locSet.has(url)) add('error', 'noindex-in-sitemap', url, 'Page is noindex but listed in sitemap.xml.', 'Remove it from the sitemap or make it indexable.');
    if (!noindex && pg.kind === 'product' && !locSet.has(url)) add('error', 'missing-from-sitemap', url, 'Published product is not in sitemap.xml.', 'It is added automatically at deploy; check the deploy log.');

    // Structured data: valid JSON, required Product/Offer fields, nothing invented.
    const blocks = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || [];
    blocks.forEach((b) => {
      const body = b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
      let data;
      try { data = JSON.parse(body); } catch (e) { add('error', 'schema-invalid-json', url, 'Structured data is not valid JSON.', 'Check the page template.'); return; }
      (Array.isArray(data) ? data : [data]).forEach((d) => {
        if (!d || typeof d !== 'object') return;
        const json = JSON.stringify(d);
        if (/"(aggregateRating|review)"/.test(json)) add('error', 'schema-rating', url, 'Structured data contains a rating or review.', 'Only real customer reviews may be marked up; remove it.');
        if (d['@type'] === 'Product') {
          const o = Array.isArray(d.offers) ? d.offers[0] : d.offers;
          if (!d.name || !d.image || (Array.isArray(d.image) && !d.image.length)) add('error', 'schema-product', url, 'Product schema needs name and image.', '');
          if (!o) add('error', 'schema-offer', url, 'Product schema has no offer (price).', '');
          else {
            if (!(Number(o.price) > 0)) add('error', 'schema-offer', url, 'Offer price is missing or 0.', 'Set the product price.');
            if (o.priceCurrency !== 'BDT') add('error', 'schema-offer', url, 'Offer currency is ' + o.priceCurrency + ', not BDT.', '');
            if (!AVAIL.has(o.availability)) add('error', 'schema-offer', url, 'Offer availability is not a schema.org value.', '');
          }
        }
        if (d['@type'] === 'BreadcrumbList') {
          const items = d.itemListElement || [];
          if (!items.length || items.some((it, i) => it.position !== i + 1 || !it.name)) add('error', 'schema-breadcrumb', url, 'Breadcrumb positions or names are wrong.', '');
        }
      });
    });
    if (pg.kind === 'product' && !blocks.some((b) => b.indexOf('"@type":"Product"') >= 0 || b.indexOf('"@type":"Product"') >= 0) && h.canonical === url) add('error', 'schema-missing', url, 'Product page has no Product structured data.', '');

    // Images in the server HTML without alt text (decorative images use alt="").
    (html.match(/<img\b[^>]*>/gi) || []).forEach((img) => { if (!/\balt=/i.test(img)) add('warning', 'missing-alt', url, 'An image has no alt attribute: ' + img.slice(0, 90), 'Add a short description of the photo.'); });

    // Internal links, checked once for the whole site below.
    (html.match(/\bhref="(\/[^"#?]*)/g) || []).forEach((m) => {
      const p = decodeURI(m.slice(6));
      if (/^\/(?:api|cdn-cgi)\//.test(p) || /\.(?:css|js|png|jpe?g|webp|avif|svg|ico|json|xml|txt|woff2?|webmanifest|csv|gif|mp4)$/i.test(p)) return;
      (linkSources[p] = linkSources[p] || new Set()).add(url);
    });
  }

  const resolves = (p) => {
    const clean = p.replace(/\/+$/, '') || '/';
    if (clean === '/') return true;
    const rel = clean.slice(1);
    return exists(rel) || exists(rel + '.html') || exists(rel + '/index.html') || redirectsFrom.has(clean.toLowerCase()) || redirectsFrom.has((clean + '.html').toLowerCase());
  };
  Object.keys(linkSources).sort().forEach((p) => {
    if (!resolves(p)) {
      const from = Array.from(linkSources[p]);
      add('error', 'broken-link', SITE + p, 'Broken internal link (page does not exist) — linked from ' + from.length + ' page(s), e.g. ' + from[0], 'Fix the link or add a redirect in SEO Manager → Redirects.');
    }
  });
  locs.forEach((loc) => {
    if (!loc.startsWith(SITE + '/')) { add('error', 'sitemap-foreign', loc, 'sitemap.xml lists a URL outside the site.', ''); return; }
    if (!resolves(loc.slice(SITE.length) || '/')) add('error', 'sitemap-broken', loc, 'sitemap.xml lists a page that does not exist.', '');
  });
  if (new Set(locs).size !== locs.length) add('warning', 'sitemap-duplicate', SITE + '/sitemap.xml', 'sitemap.xml lists some URLs twice.', '');

  Object.entries(titles).forEach(([t, urls]) => { if (urls.length > 1) urls.forEach((u) => add('warning', 'duplicate-title', u, 'Same title as ' + (urls.length - 1) + ' other page(s): "' + t.slice(0, 70) + '"', 'Give each page its own title.')); });
  Object.entries(descs).forEach(([t, urls]) => { if (urls.length > 1) urls.forEach((u) => add('warning', 'duplicate-description', u, 'Same meta description as ' + (urls.length - 1) + ' other page(s).', 'Give each page its own description.')); });

  // Product recommendations (automatic SEO works without these; approving locks the text in).
  const suggestions = [];
  products.forEach(({ p, cat }) => {
    const url = SITE + '/product/' + p.id;
    const seo = w.maCatalog.productSeo(p);
    if (!p.image) add('error', 'missing-image', url, 'Product has no main photo.', 'Add one in Product Manager.');
    if (seo.keyword && seo.title.toLowerCase().indexOf(seo.keyword.toLowerCase()) < 0 && seo.description.toLowerCase().indexOf(seo.keyword.toLowerCase()) < 0) add('warning', 'keyword-missing', url, 'Primary keyword "' + seo.keyword + '" is not in the title or description.', 'Use it in the SEO title or description.');
    if (!seo.titleIsManual || !seo.descriptionIsManual) suggestions.push({ id: p.id, category: cat, name: p.name, url, title: seo.title, description: seo.description, titleIsManual: seo.titleIsManual, descriptionIsManual: seo.descriptionIsManual });
  });
  if (suggestions.length) add('info', 'auto-seo', SITE + '/product-manager', suggestions.length + ' product(s) use automatic SEO text.', 'It is already live; open a product → "Use suggestion" to approve or edit it.');
  const noKeyword = products.filter(({ p }) => !String(p.seoKeyword || '').trim()).length;
  if (noKeyword) add('info', 'no-keyword', SITE + '/product-manager', noKeyword + ' product(s) have no primary keyword.', 'Optional: add the main search phrase (e.g. "লিনেন টু পিস") in Product Manager → SEO.');
  Object.keys(cats).forEach((cat) => { if (cats[cat].length && /^[a-z0-9-]+$/.test(cat) && !exists(cat + '.html')) add('warning', 'category-no-page', SITE + '/' + cat, 'Category "' + cat + '" has products but no category page.', 'Its products are still reachable from /category and their own pages.'); });

  const count = (l) => issues.filter((i) => i.level === l).length;
  return {
    version: 1, generatedAt: options.now || new Date().toISOString(), source: 'build',
    summary: { pages: pages.length, products: products.length, sitemapUrls: locs.length, errors: count('error'), warnings: count('warning'), info: count('info') },
    issues, suggestions,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = audit();
  fs.writeFileSync(path.join(root, 'seo-report.json'), JSON.stringify(report));
  const s = report.summary;
  console.log('SEO audit: ' + s.pages + ' pages, ' + s.errors + ' errors, ' + s.warnings + ' warnings, ' + s.info + ' recommendations.');
  report.issues.filter((i) => i.level === 'error').slice(0, 15).forEach((i) => console.log('  SEO error [' + i.type + '] ' + i.url + ' — ' + i.message));
}
