// Live site health check (run by .github/workflows/site-health.yml, or: node scripts/site-health.mjs).
// Fails (exit 1) with a clear list when something customers or orders depend on is broken, so GitHub
// e-mails the owner. Read-only: it only downloads public pages.
import crypto from 'node:crypto';

const SITE = process.env.SITE_URL || 'https://muslimabaya.com';
const LANDING = process.env.LANDING_URL || 'https://shop.muslimabaya.com';
const problems = [], ok = [];
const bust = () => 'health=' + Date.now();

async function get(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'Cache-Control': 'no-cache', 'User-Agent': 'MuslimAbaya-HealthCheck' }, redirect: 'follow', ...opts });
    return { status: res.status, text: await res.text() };
  } catch (e) {
    return { status: 0, text: String(e && e.name === 'AbortError' ? 'TIMEOUT' : e) };
  } finally { clearTimeout(t); }
}
async function page(name, url, mustContain) {
  const r = await get(url);
  if (r.status !== 200) return problems.push(`${name}: HTTP ${r.status} (${url})`);
  if (mustContain && !mustContain.test(r.text)) return problems.push(`${name}: page loaded but expected content is missing (${url})`);
  ok.push(name);
}

// 1. Pages customers use.
await page('Home page', `${SITE}/?${bust()}`, /Muslim Abaya/i);
await page('Abaya category', `${SITE}/abaya?${bust()}`, /data-shop-category/);
await page('Checkout', `${SITE}/checkout?${bust()}`, /<form|checkout/i);
await page('Sitemap', `${SITE}/sitemap.xml?${bust()}`, /<urlset/);
await page('Product Manager', `${SITE}/product-manager?${bust()}`, /Product Manager/i);
await page('Landing page', `${LANDING}/?${bust()}`, /৳|price/i);

// 2. Order price check data: the order server (Apps Script opsCatalog_) refuses every order with
//    CATALOG_OUTDATED when catalog-validation.json does not match the published catalog files.
const files = ['product-config.js', 'product-utils.js', 'category-products.js', 'product-links-data.js', 'product-catalog-sync.js'];
const cv = await get(`${SITE}/catalog-validation.json?${bust()}`);
let catalog = null;
try { catalog = JSON.parse(cv.text); } catch (e) {}
if (cv.status !== 200 || !catalog || !Array.isArray(catalog.products) || !catalog.products.length) {
  problems.push(`Order price data (catalog-validation.json): HTTP ${cv.status}, not readable — orders may be refused`);
} else {
  const parts = await Promise.all(files.map((f) => get(`${SITE}/${f}?catalog_check=${Date.now()}`)));
  const bad = parts.findIndex((r) => r.status !== 200);
  if (bad >= 0) problems.push(`Catalog file ${files[bad]}: HTTP ${parts[bad].status}`);
  else {
    const text = parts.map((r, i) => files[i] + '\u0000' + r.text + '\u0000').join('');
    const sha = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    if (sha !== catalog.sourceSha256) problems.push('Order price data is OUT OF DATE (catalog-validation.json does not match the catalog files) — the order server will refuse orders until the site is rebuilt');
    else ok.push(`Order price data matches the catalog (${catalog.products.length} products)`);
  }
  // 3. A product page opens.
  const first = catalog.products.find((p) => p && p.id);
  if (first) await page(`Product page /product/${first.id}`, `${SITE}/product/${encodeURIComponent(first.id)}?${bust()}`, new RegExp('data-product-id="' + String(first.id).replace(/[^A-Za-z0-9_-]/g, '') + '"'));
}

console.log('OK:\n  ' + ok.join('\n  '));
if (problems.length) {
  console.log('\nPROBLEMS:\n  ' + problems.join('\n  '));
  if (process.env.GITHUB_STEP_SUMMARY) {
    const fs = await import('node:fs');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '## Site health: problems found\n\n' + problems.map((p) => '- ' + p).join('\n') + '\n');
  }
  process.exit(1);
}
console.log('\nAll checks passed.');
