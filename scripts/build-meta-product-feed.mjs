import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Build a Meta Commerce Manager CSV from the canonical storefront catalog.
// Run automatically during the Cloudflare Pages build (scripts/build-cloudflare.mjs); never reads private/admin data.
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
  throw new Error('Meta feed: canonical product catalog could not be initialized.');
}
const catalog = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, w.PRODUCT_LINKS_DATA || w.PRODUCT_IMAGE_LISTS || {});
const sections = new Map((w.CATALOG_SECTIONS || []).map(section => [section.key, section]));
const columns = [
  'id', 'title', 'description', 'availability', 'condition', 'price',
  'link', 'image_link', 'brand', 'product_type', 'additional_image_link',
  'color', 'size', 'inventory'
];
const csvCell = value => '"' + String(value == null ? '' : value)
  .replace(/[\r\n]+/g, ' ')
  .replace(/"/g, '""') + '"';
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
const rows = [];
let skipped = 0;
for (const [category, products] of Object.entries(catalog)) {
  for (const product of products || []) {
    if (!product || !product.id || !product.name || product.isImageView === true ||
        product.catalogVisibility === 'hidden' || seen.has(String(product.id))) continue;
    if (!w.maCatalog.isPublishedProduct(product)) continue;
    const price = Number(product.price);
    const images = [product.image].concat(Array.isArray(product.images) ? product.images : [])
      .map(absoluteUrl).filter((url, index, list) => url && list.indexOf(url) === index);
    if (!Number.isFinite(price) || price <= 0 || !images.length) {
      skipped++;
      continue;
    }
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
    const inventory = stock.qty != null && stock.qty !== '' && Number.isFinite(Number(stock.qty))
      ? Math.max(0, Number(stock.qty)) : '';
    rows.push([
      String(product.id),
      cleanText(product.name).slice(0, 150),
      details.slice(0, 5000),
      stock.inStock ? 'in stock' : 'out of stock',
      'new',
      price.toFixed(2) + ' BDT',
      site + '/product/' + encodeURIComponent(String(product.id)),
      images[0],
      'MUSLIM ABAYA',
      cleanText(section && (section.menu || section.menuBn) || category),
      images.slice(1).join(','),
      cleanText(product.colorLabel || product.color),
      Array.isArray(product.sizes) ? product.sizes.map(cleanText).join(', ') : '',
      inventory
    ]);
  }
}
if (!rows.length) throw new Error('Meta feed: no eligible published products were found.');
const output = [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
const destination = path.join(root, 'meta-product-feed.csv');
fs.writeFileSync(destination, output, 'utf8');
console.log('Meta product feed generated: ' + rows.length + ' products; skipped ' + skipped + ' products with missing price/image.');
console.log('Feed URL: https://muslimabaya.com/meta-product-feed.csv');
