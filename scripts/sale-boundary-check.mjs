// Prints the products whose scheduled sale (Product Manager → Schedule) starts today or ended yesterday,
// Bangladesh time. Used by .github/workflows/sale-schedule-rebuild.yml: on those days the website is rebuilt
// so the pre-rendered pages and Google product data show the new price. (Prices customers see and pay are
// already decided live; this only refreshes the built HTML.)
// Run: node scripts/sale-boundary-check.mjs [YYYY-MM-DD]   → exit 0 and prints "rebuild=true|false"
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dhaka = (ms) => new Date(ms + 6 * 3600000).toISOString().slice(0, 10);
const today = process.argv[2] || dhaka(Date.now());
const yesterday = dhaka(Date.parse(today + 'T12:00:00+06:00') - 86400000);

const w = {};
w.window = w;
vm.runInContext(fs.readFileSync(path.join(root, 'category-products.js'), 'utf8'), vm.createContext(w));
const hits = [];
for (const [cat, list] of Object.entries(w.CATEGORY_PRODUCTS || {})) {
  for (const p of Array.isArray(list) ? list : []) {
    if (!p || typeof p !== 'object') continue;
    if (p.saleFrom === today) hits.push(`${cat}/${p.id}: sale starts ${today}`);
    if (p.saleTo === yesterday) hits.push(`${cat}/${p.id}: sale ended ${yesterday}`);
    for (const v of Array.isArray(p.variations) ? p.variations : []) {
      if (v && v.saleFrom === today) hits.push(`${cat}/${p.id} variation ${v.size || v.color || v.type || ''}: sale starts ${today}`);
      if (v && v.saleTo === yesterday) hits.push(`${cat}/${p.id} variation ${v.size || v.color || v.type || ''}: sale ended ${yesterday}`);
    }
  }
}
hits.forEach((h) => console.log(h));
console.log('rebuild=' + (hits.length > 0));
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'rebuild=' + (hits.length > 0) + '\n');
