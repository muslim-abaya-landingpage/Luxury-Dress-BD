// scripts/prune-deploy.mjs: non-website files are left out of the Cloudflare upload, but only during a Pages build.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

function site() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-prune-'));
  const put = (name, text = 'x') => { fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true }); fs.writeFileSync(path.join(dir, name), text); };
  put('scripts/prune-deploy.mjs', fs.readFileSync(path.resolve(__dirname, '../../scripts/prune-deploy.mjs'), 'utf8'));
  ['index.html', 'about.html', 'site-header.js', 'shop.css', '_headers', '_redirects', '_routes.json', 'robots.txt', 'sitemap.xml', 'llms.txt', 'CNAME',
    'catalog-validation.json', 'live-build.json', 'functions/api/admin-ip.js', 'images/a.webp', 'product/A1.html',
    'README.md', 'START-HERE.bat', 'package.json', 'apps-script-copy.html', 'google-apps-script-backend.gs', 'playwright.config.cjs',
    'apps-script/Code.gs', 'tests/x.test.cjs', 'cloudflare-worker/worker.js', 'docs/a.md', 'hosting-pack/p.html', '.github/workflows/e2e.yml'].forEach((f) => put(f));
  const run = (env, args = []) => execFileSync(process.execPath, [path.join(dir, 'scripts/prune-deploy.mjs'), ...args], { encoding: 'utf8', env: Object.assign({}, process.env, { CF_PAGES: '' }, env) });
  const has = (f) => fs.existsSync(path.join(dir, f));
  return { run, has };
}

test('does nothing outside a Cloudflare Pages build', () => {
  const s = site();
  assert.match(s.run({}), /skipped/);
  assert.ok(s.has('README.md') && s.has('apps-script/Code.gs'));
});

test('in a Pages build: removes tooling and notes, keeps every website file and Pages Functions', () => {
  const s = site();
  assert.match(s.run({ CF_PAGES: '1' }), /removed \d+/);
  for (const gone of ['README.md', 'START-HERE.bat', 'package.json', 'apps-script-copy.html', 'google-apps-script-backend.gs', 'playwright.config.cjs',
    'apps-script', 'tests', 'cloudflare-worker', 'docs', 'hosting-pack', '.github', 'scripts']) assert.equal(s.has(gone), false, gone + ' should be left out');
  for (const kept of ['index.html', 'about.html', 'site-header.js', 'shop.css', '_headers', '_redirects', '_routes.json', 'robots.txt', 'sitemap.xml',
    'llms.txt', 'CNAME', 'catalog-validation.json', 'live-build.json', 'functions/api/admin-ip.js', 'images/a.webp', 'product/A1.html']) assert.ok(s.has(kept), kept + ' must stay');
});
