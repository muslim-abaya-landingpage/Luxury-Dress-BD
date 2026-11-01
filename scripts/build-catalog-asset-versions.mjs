// Cloudflare build step: content-versions every local script and stylesheet.
//
// JS and CSS are served with "Cache-Control: immutable, 1 year" (_headers), so a URL must change whenever the
// file changes. Hand-written ?v= strings were easy to forget (a changed file kept its old URL and visitors got
// the old copy). This step replaces them at build time:
//   1. Inside site JS files, every pinned "some-file.js?v=…" / "some-file.css?v=…" string that points to a real
//      site file gets ?v=<content hash> (site-header.js, site-footer.js, category-renderer.js, … load files
//      themselves). Repeated until stable, because stamping a file changes its own hash.
//   2. In every HTML page, every local <script src> and <link href> to a .js/.css file gets ?v=<content hash>.
// The repository keeps its readable ?v= strings; only the deployed copy is stamped. Run: node scripts/build-catalog-asset-versions.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Not part of the website (or generated/owned elsewhere): never rewritten.
const SKIP_DIRS = new Set(['node_modules', 'upload', 'originals', 'tests', 'scripts', 'functions', 'cloudflare-worker', 'apps-script', 'docs', 'test-results', 'playwright-report', 'landing-shop']);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!SKIP_DIRS.has(entry.name)) walk(full, out); continue; }
    out.push(full);
  }
  return out;
}
const files = walk(root, []);
const rel = (full) => path.relative(root, full).split(path.sep).join('/');
const assets = files.filter((f) => /\.(js|css)$/i.test(f));
const assetSet = new Set(assets.map(rel));
const hashOf = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
const versions = new Map(assets.map((f) => [rel(f), hashOf(fs.readFileSync(f))]));

/** Site-relative path of a URL as written in a page or script, or '' if it is not a local asset. */
function resolveAsset(url, baseDir) {
  if (!url || /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(url) || /^(data|blob|javascript):/i.test(url)) return '';
  const clean = url.split(/[?#]/)[0];
  if (!/\.(js|css)$/i.test(clean)) return '';
  const joined = clean.startsWith('/') ? clean.slice(1) : path.posix.join(baseDir, clean);
  const normal = path.posix.normalize(joined).replace(/^(\.\/)+/, '');
  return assetSet.has(normal) ? normal : '';
}
function withVersion(url, file) {
  const parsed = new URL(url, 'https://local.invalid/');
  parsed.searchParams.set('v', versions.get(file));
  return url.split(/[?#]/)[0] + parsed.search + parsed.hash;
}

// 1. Pinned URLs inside JS files (only strings that already carry ?v=, so ordinary text is never touched).
const jsFiles = assets.filter((f) => /\.js$/i.test(f));
const PINNED = /(["'`])((?:\/|\.\/)?[A-Za-z0-9_\-./]+\.(?:js|css))\?v=[^"'`\s]*\1/g;
let passes = 0, changed = true, jsUpdated = new Set();
while (changed && passes < 10) {
  changed = false;
  passes++;
  for (const full of jsFiles) {
    const before = fs.readFileSync(full, 'utf8');
    const after = before.replace(PINNED, (match, quote, url) => {
      const file = resolveAsset(url, '');
      return file ? quote + withVersion(url + '?v=x', file) + quote : match;
    });
    if (after !== before) {
      fs.writeFileSync(full, after);
      versions.set(rel(full), hashOf(after));
      jsUpdated.add(rel(full));
      changed = true;
    }
  }
}
if (changed) throw new Error('Asset versions did not settle (files reference each other in a loop).');

// 2. Every local script / stylesheet / preload in every HTML page.
let pages = 0;
for (const full of files.filter((f) => /\.html?$/i.test(f))) {
  const before = fs.readFileSync(full, 'utf8');
  const baseDir = path.posix.dirname(rel(full));
  const stamp = (match, prefix, quote, url) => {
    const file = resolveAsset(url, baseDir === '.' ? '' : baseDir);
    return file ? prefix + quote + withVersion(url, file) + quote : match;
  };
  const after = before
    .replace(/(<script\b[^>]*?\bsrc=)(["'])([^"']+)\2/gi, stamp)
    .replace(/(<link\b[^>]*?\bhref=)(["'])([^"']+)\2/gi, stamp);
  if (after !== before) { fs.writeFileSync(full, after); pages++; }
}
console.log(`Content versions: ${versions.size} JS/CSS files, ${jsUpdated.size} scripts with pinned URLs (${passes} passes), ${pages} HTML pages.`);
