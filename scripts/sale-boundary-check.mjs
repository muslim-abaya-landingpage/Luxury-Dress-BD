// Prints the products whose scheduled sale (Product Manager → Schedule) starts today or ended yesterday, or whose
// scheduled publish date (Publish box) was reached in the last hour, Bangladesh time.
// Used by .github/workflows/sale-schedule-rebuild.yml (GitHub's hourly schedule — often delayed, so the
// main trigger is /api/cron-tick, called by the Cloudflare Worker cron every 2 minutes).
// Prices customers see and pay are already decided live; this only refreshes the built HTML.
// Run: node scripts/sale-boundary-check.mjs [YYYY-MM-DD]   → exit 0 and prints "rebuild=true|false"
// Also: node scripts/sale-boundary-check.mjs --snapshot  → writes schedule.json (deploy step)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dhakaDate, saleBoundaries, publishesBetween, scheduleSnapshot } from '../functions/_lib/schedule-check.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const w = {};
w.window = w;
vm.runInContext(fs.readFileSync(path.join(root, 'category-products.js'), 'utf8'), vm.createContext(w));
const catalog = w.CATEGORY_PRODUCTS || {};

if (process.argv[2] === '--snapshot') {
  fs.writeFileSync(path.join(root, 'schedule.json'), JSON.stringify({ version: 1, catalog: scheduleSnapshot(catalog) }));
  console.log('schedule.json written.');
} else {
  const now = Date.now();
  const today = process.argv[2] || dhakaDate(now);
  // Sales start/end at midnight: checked in the first run of the day (00:xx), or when a date is given.
  const midnightRun = !!process.argv[2] || new Date(now + 6 * 3600000).getUTCHours() === 0;
  const hits = publishesBetween(catalog, now - 65 * 60000, now).concat(midnightRun ? saleBoundaries(catalog, today) : []);
  hits.forEach((h) => console.log(h));
  console.log('rebuild=' + (hits.length > 0));
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'rebuild=' + (hits.length > 0) + '\n');
}
