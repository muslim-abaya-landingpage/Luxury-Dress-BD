const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const imageRoot = path.resolve(__dirname, '../../images');
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const expectedExtensions = new Set(['.webp', '.jpg', '.jpeg', '.png', '.avif']);

function imageFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return imageFiles(fullPath);
    return entry.isFile() && expectedExtensions.has(path.extname(entry.name).toLowerCase()) ? [fullPath] : [];
  });
}

function formatMatches(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const bytes = fs.readFileSync(filePath);
  if (ext === '.webp') {
    return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  }
  if (ext === '.jpg' || ext === '.jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (ext === '.png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(pngSignature);
  if (ext === '.avif') {
    return bytes.length >= 12 && bytes.toString('ascii', 4, 8) === 'ftyp' && bytes.toString('ascii', 8, 12) === 'avif';
  }
  return false;
}

test('static image bytes match their filename extensions', () => {
  const mismatches = imageFiles(imageRoot).filter((filePath) => !formatMatches(filePath)).map((filePath) => path.relative(path.resolve(__dirname, '../..'), filePath));
  assert.deepEqual(mismatches, [], `Image extension/content mismatch or corrupt image:\n${mismatches.join('\n')}`);
});

// A product photo saved as a local path must exist in the repository; R2 photos are full https URLs.
// (DR-9, 2026-11-02: a second save committed local upload paths that were never in git, so its photos were blank.)
test('every local photo path in the catalog exists in the repository', () => {
  const root = path.resolve(__dirname, '../..');
  const missing = [];
  for (const file of ['category-products.js', 'product-links-data.js']) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const re = /["'](\/?images\/[^"']+\.(?:webp|avif|jpe?g|png))["']/g;
    let m;
    while ((m = re.exec(text))) {
      const rel = m[1].replace(/^\//, '');
      if (!fs.existsSync(path.join(root, rel))) missing.push(`${file}: ${rel}`);
    }
  }
  assert.deepEqual([...new Set(missing)], [], `Catalog points at photos that are not in the repository:\n${missing.join('\n')}`);
});

// Site pages must not load photos straight from GitHub (raw.githubusercontent.com): GitHub is not image hosting
// (Acceptable Use Policies, excessive bandwidth). Photos come from Cloudflare (Pages /images/ or R2).
test('site pages and scripts do not load images from raw.githubusercontent.com', () => {
  const root = path.resolve(__dirname, '../..');
  const files = ['category-renderer.js', 'category-products.js', 'product-links-data.js', 'hero-banner-config.js', 'index-home-app.js', 'cart-utils.js']
    .concat(fs.readdirSync(root).filter((n) => n.endsWith('.html') && n !== 'apps-script-copy.html'));
  const hits = files.filter((n) => fs.existsSync(path.join(root, n)))
    .filter((n) => /raw\.githubusercontent\.com\/[^"'\s]+\.(webp|jpe?g|png|avif|gif)/i.test(fs.readFileSync(path.join(root, n), 'utf8')));
  assert.deepEqual(hits, [], `Image loaded from raw.githubusercontent.com in:\n${hits.join('\n')}`);
});

test('footer cards align as a balanced grid and Shop links collapse cleanly on mobile', () => {
  const root = path.resolve(__dirname, '../..');
  const css = fs.readFileSync(path.join(root, 'site-footer.css'), 'utf8');

  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1\.2fr\)\s+minmax\(0,\s*1\.25fr\)/);
  assert.match(css, /\.anz-footer-main,[\s\S]*?align-items:\s*stretch;/);
  assert.match(css, /#site-footer-mount \.anz-col-shop #anz-footer-shop\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width: 1100px\)[\s\S]*?"shop about"[\s\S]*?"contact newsletter"/);
  assert.match(css, /@media \(max-width: 768px\)[\s\S]*?#site-footer-mount \.anz-col-shop #anz-footer-shop\s*\{\s*grid-template-columns:\s*1fr;/);
});
