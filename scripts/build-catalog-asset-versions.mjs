import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = ['category-products.js', 'product-links-data.js', 'product-config.js', 'product-catalog-sections.js', 'product-utils.js', 'product-catalog-loader.js', 'category-renderer.js', 'product-quick-upload.js', 'product-publisher.js', 'product-publish-utils.js', 'product-csv.js', 'admin-api.js', 'stock-sync.js'];
const versions = new Map(assets.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 16)]));
// site-header.js loads the catalog scripts itself on pages that do not include them (About, Help, …).
// Stamp those URLs with the same content versions, then version site-header.js by its stamped content,
// so a changed catalog script can never be served from a year-long browser/edge cache through the header.
{
  const headerFile = path.join(root, 'site-header.js');
  const before = fs.readFileSync(headerFile, 'utf8');
  const after = before.replace(/(["'])([a-z-]+\.js)\?v=[^"']*\1/g, (match, quote, file) => versions.has(file) ? quote + file + '?v=' + versions.get(file) + quote : match);
  if (after !== before) fs.writeFileSync(headerFile, after);
  versions.set('site-header.js', crypto.createHash('sha256').update(after).digest('hex').slice(0, 16));
}
let updated = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.name.startsWith('.') || ['node_modules', 'upload', 'originals'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const before = fs.readFileSync(full, 'utf8');
    const stamp = (match, prefix, quote, url) => {
      if (/^(?:[a-z]+:)?\/\//i.test(url)) return match;
      const file = url.split(/[?#]/)[0].split('/').pop();
      if (!versions.has(file)) return match;
      const parsed = new URL(url, 'https://local.invalid/');
      parsed.searchParams.set('v', versions.get(file));
      return prefix + quote + url.split(/[?#]/)[0] + parsed.search + parsed.hash + quote;
    };
    // <script src> and the matching <link rel=preload href> must carry the same version,
    // otherwise the browser downloads the file twice (preloaded copy is never used).
    const after = before
      .replace(/(<script\b[^>]*\bsrc=)(["'])([^"']+)\2/gi, stamp)
      .replace(/(<link\b(?=[^>]*\brel=["']?preload)[^>]*\bhref=)(["'])([^"']+)\2/gi, stamp);
    if (after !== before) {fs.writeFileSync(full, after); updated++;}
  }
}
walk(root);
console.log(`Catalog content versions applied to ${updated} HTML pages.`);
