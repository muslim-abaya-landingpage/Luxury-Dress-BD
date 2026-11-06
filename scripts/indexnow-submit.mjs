// Tell Bing (and other IndexNow search engines: Yandex, Seznam, Naver…) which pages changed, right after
// a deploy, so new products, prices and pages show up in search within hours instead of days.
// Free. Run by .github/workflows/indexnow.yml on every push to main. Only URLs listed in sitemap.xml
// (public pages) are ever sent. The key file <key>.txt at the site root proves the site is ours.
//
//   node scripts/indexnow-submit.mjs <before-sha> <after-sha>   send pages changed between two commits
//   node scripts/indexnow-submit.mjs --all                      send every page in sitemap.xml
//   add --dry-run to print the list without sending
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://muslimabaya.com';
const HOST = 'muslimabaya.com';
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((a) => !a.startsWith('--'));

export function findKey(dir = root) {
  const files = fs.readdirSync(dir).filter((f) => /^[a-f0-9]{32}\.txt$/.test(f));
  if (files.length !== 1) throw new Error(`Expected exactly one IndexNow key file (<32 hex>.txt) at the site root, found ${files.length}`);
  const key = files[0].slice(0, -4);
  if (fs.readFileSync(path.join(dir, files[0]), 'utf8').trim() !== key) throw new Error('IndexNow key file content must equal its name');
  return key;
}

export function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]).filter((u) => u.startsWith(SITE + '/'));
}

/** Changed repository files → public page URLs (only those present in the sitemap). */
export function urlsForChanges(changedFiles, allUrls) {
  const set = new Set();
  const inSitemap = new Set(allUrls);
  const products = allUrls.filter((u) => u.includes('/product/'));
  const listPages = allUrls.filter((u) => !u.includes('/product/'));
  const catalogFiles = /^(category-products\.js|product-links-data\.js|product-config\.js|catalog-validation\.json)$/;
  for (const file of changedFiles) {
    if (catalogFiles.test(file)) { products.forEach((u) => set.add(u)); listPages.forEach((u) => set.add(u)); continue; }
    let m = file.match(/^product\/([A-Za-z0-9_-]+)\.html$/);
    if (m) { set.add(`${SITE}/product/${m[1]}`); continue; }
    m = file.match(/^([a-z0-9-]+)\.html$/);
    if (m) set.add(m[1] === 'index' ? `${SITE}/` : `${SITE}/${m[1]}`);
  }
  return [...set].filter((u) => inSitemap.has(u));
}

function changedBetween(before, after) {
  try {
    return execFileSync('git', ['diff', '--name-only', before, after], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch (e) {
    console.log('Could not compare commits (' + e.message.split('\n')[0] + '); sending the home page only.');
    return ['index.html'];
  }
}

async function main() {
  const key = findKey();
  const all = sitemapUrls(fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8'));
  let urls;
  if (args.includes('--all')) urls = all;
  else if (positional.length === 2) urls = urlsForChanges(changedBetween(positional[0], positional[1]), all);
  else throw new Error('Usage: indexnow-submit.mjs <before-sha> <after-sha> | --all  [--dry-run]');
  urls = urls.slice(0, 10000);
  if (!urls.length) { console.log('No public page changed; nothing to send.'); return; }
  console.log(`${urls.length} page(s):\n` + urls.join('\n'));
  if (dryRun) return;
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key, keyLocation: `${SITE}/${key}.txt`, urlList: urls }),
  });
  const text = (await res.text()).slice(0, 300);
  console.log(`IndexNow answered ${res.status} ${text}`);
  // 200 = sent, 202 = accepted (key check pending). Anything else is a real problem worth a red run.
  if (res.status !== 200 && res.status !== 202) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
