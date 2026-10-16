import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = ['category-products.js', 'product-links-data.js', 'product-config.js', 'product-catalog-sections.js', 'product-utils.js'];
const versions = new Map(assets.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex').slice(0, 16)]));
let updated = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    if (entry.name.startsWith('.') || ['node_modules', 'upload', 'originals'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.name.endsWith('.html')) continue;
    const before = fs.readFileSync(full, 'utf8');
    const after = before.replace(/(<script\b[^>]*\bsrc=)(["'])([^"']+)\2/gi, (match, prefix, quote, url) => {
      if (/^(?:[a-z]+:)?\/\//i.test(url)) return match;
      const file = url.split(/[?#]/)[0].split('/').pop();
      if (!versions.has(file)) return match;
      const parsed = new URL(url, 'https://local.invalid/');
      parsed.searchParams.set('v', versions.get(file));
      return prefix + quote + url.split(/[?#]/)[0] + parsed.search + parsed.hash + quote;
    });
    if (after !== before) {fs.writeFileSync(full, after); updated++;}
  }
}
walk(root);
console.log(`Catalog content versions applied to ${updated} HTML pages.`);
