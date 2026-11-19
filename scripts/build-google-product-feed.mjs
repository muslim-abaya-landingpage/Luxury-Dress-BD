import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Build a Google Merchant Center feed (RSS 2.0 + g: namespace, the XML format Google's Scheduled
// Fetch accepts) from the same canonical storefront catalog as the Meta feed. Free organic listing
// in the Google Shopping tab — no ad spend. Run automatically during the Cloudflare Pages build
// (scripts/build-cloudflare.mjs); never reads private/admin data.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const site = 'https://muslimabaya.com';
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const file of ['product-config.js', 'product-utils.js', 'category-products.js', 'product-links-data.js', 'product-catalog-sync.js']) {
  vm.runInContext(read(file), ctx, { filename: file });
}
const w = ctx.window;
if (!w.maCatalog || typeof w.maCatalog.normalizeAll !== 'function') {
  throw new Error('Google feed: canonical product catalog could not be initialized.');
}
const catalog = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, w.PRODUCT_LINKS_DATA || w.PRODUCT_IMAGE_LISTS || {});
const sections = new Map((w.CATALOG_SECTIONS || []).map(section => [section.key, section]));

const xmlEscape = value => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const absoluteUrl = raw => {
  const value = String(raw || '').trim();
  if (!value || /^(?:data:|blob:|javascript:)/i.test(value)) return '';
  try { return new URL(value, site + '/').href; } catch { return ''; }
};
const cleanText = value => String(value == null ? '' : value)
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const seen = new Set();
const items = [];
let skipped = 0;
for (const [category, products] of Object.entries(catalog)) {
  for (const product of products || []) {
    if (!product || !product.id || !product.name || product.isImageView === true ||
        product.catalogVisibility === 'hidden' || seen.has(String(product.id))) continue;
    if (!w.maCatalog.isPublishedProduct(product)) continue;
    const price = Number(product.price);
    const images = [product.image].concat(Array.isArray(product.images) ? product.images : [])
      .map(absoluteUrl).filter((url, index, list) => url && list.indexOf(url) === index);
    if (!Number.isFinite(price) || price <= 0 || !images.length) { skipped++; continue; }
    seen.add(String(product.id));
    const stock = w.maCatalog.getStockStatus(product);
    const section = sections.get(category);
    const details = [
      product.name,
      product.fabric ? 'Fabric: ' + cleanText(product.fabric) : '',
      product.colorLabel || product.color ? 'Color: ' + cleanText(product.colorLabel || product.color) : '',
      Array.isArray(product.sizes) && product.sizes.length ? 'Available sizes: ' + product.sizes.map(cleanText).join(', ') : '',
      product.detailNote ? cleanText(product.detailNote) : ''
    ].filter(Boolean).join(' | ');
    const productType = cleanText(section && (section.menu || section.menuBn) || category);
    items.push({
      id: String(product.id),
      title: cleanText(product.name).slice(0, 150),
      description: details.slice(0, 5000) || cleanText(product.name),
      link: site + '/product/' + encodeURIComponent(String(product.id)),
      image_link: images[0],
      additional_image_link: images.slice(1, 11),
      availability: stock.inStock ? 'in_stock' : 'out_of_stock',
      price: price.toFixed(2) + ' BDT',
      condition: 'new',
      brand: 'MUSLIM ABAYA',
      product_type: productType,
      // No GTIN/MPN exists for these made-to-order fashion pieces; Google requires one identifier
      // field to be explicit about that, rather than leaving it to guess.
      identifier_exists: 'no'
    });
  }
}
if (!items.length) throw new Error('Google feed: no eligible published products were found.');

const itemXml = items.map(it => [
  '  <item>',
  `    <g:id>${xmlEscape(it.id)}</g:id>`,
  `    <title>${xmlEscape(it.title)}</title>`,
  `    <description>${xmlEscape(it.description)}</description>`,
  `    <link>${xmlEscape(it.link)}</link>`,
  `    <g:image_link>${xmlEscape(it.image_link)}</g:image_link>`,
  ...it.additional_image_link.map(u => `    <g:additional_image_link>${xmlEscape(u)}</g:additional_image_link>`),
  `    <g:availability>${it.availability}</g:availability>`,
  `    <g:price>${xmlEscape(it.price)}</g:price>`,
  `    <g:condition>${it.condition}</g:condition>`,
  `    <g:brand>${xmlEscape(it.brand)}</g:brand>`,
  `    <g:product_type>${xmlEscape(it.product_type)}</g:product_type>`,
  `    <g:identifier_exists>${it.identifier_exists}</g:identifier_exists>`,
  '  </item>'
].join('\n')).join('\n');

const output = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n<channel>\n  <title>Muslim Abaya product feed</title>\n  <link>${site}/</link>\n  <description>Muslim Abaya — product feed for Google Merchant Center</description>\n${itemXml}\n</channel>\n</rss>\n`;

fs.writeFileSync(path.join(root, 'google-product-feed.xml'), output, 'utf8');
console.log('Google product feed generated: ' + items.length + ' products; skipped ' + skipped + ' products with missing price/image.');
console.log('Feed URL: https://muslimabaya.com/google-product-feed.xml');
