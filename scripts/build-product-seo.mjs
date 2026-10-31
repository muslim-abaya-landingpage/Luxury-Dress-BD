import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run after catalog changes: node scripts/build-product-seo.mjs
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const file of ['product-config.js', 'product-utils.js', 'category-products.js', 'product-links-data.js', 'product-catalog-sync.js']) {
  vm.runInContext(read(file), ctx, { filename: file });
}
const w = ctx.window;
// Keep historical image-view URLs available for canonical consolidation, but do not expose
// them in storefront/category lists (product-utils filters isImageView records there).
const catalog = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, w.PRODUCT_LINKS_DATA || w.PRODUCT_IMAGE_LISTS || {}, {includeUnpublished: true});
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = data => JSON.stringify(data).replace(/</g, '\\u003c');
const site = 'https://muslimabaya.com';
const template = read('abaya.html');
const products = [];
const seen = new Set();
const byId = new Map(Object.values(catalog).flat().map(p => [p.id, p]));
fs.mkdirSync(path.join(root, 'product'), { recursive: true });
for (const [category, rows] of Object.entries(catalog)) {
  for (const p of rows) {
    if (!p.id || !p.name) continue;
    if (seen.has(p.id)) throw new Error(`Duplicate product id: ${p.id}`);
    if (!/^[A-Za-z0-9_-]+$/.test(p.id)) throw new Error(`Unsafe product id: ${p.id}`);
    seen.add(p.id);
    const url = `${site}/product/${encodeURIComponent(p.id)}`;
    const primary = p.isImageView && p.imageViewOf ? byId.get(p.imageViewOf) : null;
    const canonicalUrl = primary ? `${site}/product/${encodeURIComponent(primary.id)}` : url;
    // Product Manager → "Search engine listing" overrides the generated title / description.
    const title = String(p.seoTitle || '').trim() || `${p.name} | Muslim Abaya Bangladesh`;
    const desc = String(p.seoDescription || '').trim() || `${p.name} — ${p.fabric || 'modest fashion'}. ${p.detailNote || ''} Price ৳${p.price}. Cash on delivery in Bangladesh.`.trim();
    const images = [p.image].concat(Array.isArray(p.images) ? p.images : [])
      .filter(Boolean)
      .map(raw => /^https?:\/\//.test(raw) ? raw : site + '/' + raw.replace(/^\//, ''))
      .filter((value, index, values) => values.indexOf(value) === index);
    const image = images[0];
    const stock = w.maCatalog.getStockStatus(p);
    const schema = primary ? null : {'@context':'https://schema.org','@type':'Product',name:p.name,image:images,description:desc,sku:p.id,brand:{'@type':'Brand',name:'Muslim Abaya'},offers:{'@type':'Offer',url,priceCurrency:'BDT',price:p.price,availability:'https://schema.org/' + (stock.inStock ? 'InStock' : 'OutOfStock')}};
    const crumbs = {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{ '@type':'ListItem',position:1,name:'Home',item:site+'/'},{'@type':'ListItem',position:2,name:category,item:site+'/'+category},{'@type':'ListItem',position:3,name:p.name,item:canonicalUrl}]};
    let html = template.replace(/data-shop-category="abaya"/g, `data-shop-category="${esc(category)}"`)
      .replace(/<html\b([^>]*)>/, (m, attrs) => `<html${attrs.replace(/\s+data-(seo-managed|product-id)="[^"]*"/g, '')} data-seo-managed="full" data-product-id="${esc(p.id)}">`)
      // The category's own intro (its heading and copy) does not belong on a single product's page.
      .replace(/\s*<section class="seo-category-intro"[\s\S]*?<\/section>/, '')
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
      .replace(/<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${canonicalUrl}">`)
      .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}">`)
      .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `${schema ? `<script type="application/ld+json">${json(schema)}</script>\n` : ''}<script type="application/ld+json">${json(crumbs)}</script>`)
      .replace('</head>', `<meta property="og:title" content="${esc(title)}">\n<meta property="og:description" content="${esc(desc)}">\n<meta property="og:type" content="${primary ? 'website' : 'product'}">\n<meta property="og:url" content="${canonicalUrl}">\n<meta property="og:image" content="${esc(image)}">\n<meta name="twitter:card" content="summary_large_image">\n</head>`)
      .replace('<div id="list"></div>', `<div id="list"><article><h1>${esc(p.name)}</h1><img src="${esc(image)}" alt="${esc(w.maCatalog.imageAlt(p, images[0], 0) || p.name)}" width="480" height="600" style="max-width:100%;height:auto"><p>৳${p.price}</p><p>${esc(p.fabric)}</p><p>${esc(p.detailNote)}</p><p>${esc(stock.label)}</p><a href="https://wa.me/8801971642683?text=${encodeURIComponent(['আসসালামু আলাইকুম, আমি এই পণ্যটি অর্ডার করতে চাই:', 'পণ্য: '+p.name, 'পণ্য আইডি: '+p.id, 'একক দাম: ৳'+p.price, 'পরিমাণ: 1', 'অনুগ্রহ করে সাইজ/রং নিশ্চিত করুন।', 'পণ্যের লিংক: '+url].join('\n'))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:#117a3f;color:#fff;padding:12px 18px;border-radius:8px">WhatsApp-এ অর্ডার</a><p><a href="/${category}">View collection</a> · <a href="/shopping-guide">সাইজ ও কেনাকাটার গাইড</a> · <a href="/refund">Return policy</a></p></article></div>`)
      .replace(/\b(src|href)="(?!https?:|\/|#|data:)([^"\s]+)"/g, '$1="/$2"');
    // A product page without its id silently renders as the category list, so refuse to write one.
    if (!html.includes(`data-product-id="${esc(p.id)}"`) || !html.includes(`<title>${esc(title)}</title>`)) throw new Error(`Product page for ${p.id} is missing its product id or title; check the category template`);
    fs.writeFileSync(path.join(root, 'product', p.id+'.html'), html);
    if (!primary) products.push({id:p.id,category,url});
  }
}
// Pages of products that are no longer published (Draft, Trash or deleted) must not stay online.
// Only pages this script generated (data-seo-managed="full" + data-product-id) are removed.
if (seen.size) {
  for (const file of fs.readdirSync(path.join(root, 'product'))) {
    const m = /^([A-Za-z0-9_-]+)\.html$/.exec(file);
    if (!m || seen.has(m[1])) continue;
    const full = path.join(root, 'product', file);
    const html = fs.readFileSync(full, 'utf8');
    if (html.includes('data-seo-managed="full"') && html.includes('data-product-id="' + m[1] + '"')) {
      fs.unlinkSync(full);
      console.log('Removed product page of unpublished product: ' + m[1]);
    }
  }
}
let sitemap = read('sitemap.xml').replace(/\s*<url>\s*<loc>https:\/\/muslimabaya\.com\/product\/[^<]+<\/loc>[\s\S]*?<\/url>/g, '');
if (!sitemap.includes('<loc>'+site+'/panjabi</loc>')) sitemap = sitemap.replace('</urlset>', `  <url><loc>${site}/panjabi</loc></url>\n</urlset>`);
sitemap = sitemap.replace('</urlset>', products.map(p => `  <url><loc>${p.url}</loc></url>`).join('\n')+'\n</urlset>');
fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap);
console.log(`Generated ${products.length} product pages and sitemap URLs.`);
