// Last Cloudflare build step: remove files that are not part of the website from the deploy folder.
//
// Cloudflare Pages deploys the build folder, which is the whole repository checkout. Without this step the
// Apps Script source, Worker source, tests, scripts, notes (*.md) and tool files were downloadable from
// muslimabaya.com and could be indexed by search engines. Files removed here stay in git; they are only
// left out of the upload. functions/ (Pages Functions) and the _headers/_redirects/_routes.json files are kept.
//
// Safety: it only runs inside a Cloudflare Pages build (CF_PAGES=1) or with --force (tests / scratch copies),
// so running the build on your own computer never deletes your files.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.env.CF_PAGES !== '1' && !process.argv.includes('--force')) {
  console.log('prune-deploy: skipped (not a Cloudflare Pages build; pass --force to run).');
  process.exit(0);
}

// Folders that are tooling, source for other systems, or old copies — never website pages.
const DIRS = ['apps-script', 'tests', 'scripts', 'cloudflare-worker', 'docs', 'supabase', 'migrations', 'monitoring', 'src', 'tools',
  'hosting-pack', 'muslimabaya-fonts-setup', 'test-results', 'playwright-report', '.github'];
// Root files that are tooling/notes. Everything the site serves (html, js, css, images, robots.txt, sitemap.xml,
// llms.txt, CNAME, catalog-validation.json, live-build.json, …) is kept.
const ROOT_FILE = /\.(md|bat|ps1|gs|ts|toml|rules|cjs|py|sh)$/i;
const ROOT_NAMES = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'metadata.json', 'manus-routes.json',
  'firebase-applet-config.json', 'apps-script-copy.html', '.gitignore', '.env.example']);

let removed = 0;
for (const dir of DIRS) {
  const full = path.join(root, dir);
  if (fs.existsSync(full)) { fs.rmSync(full, {recursive: true, force: true}); removed++; }
}
for (const name of fs.readdirSync(root)) {
  const full = path.join(root, name);
  if (!fs.statSync(full).isFile()) continue;
  if (ROOT_FILE.test(name) || ROOT_NAMES.has(name)) { fs.rmSync(full); removed++; }
}
// Must never remove what the site or Pages Functions need.
for (const keep of ['index.html', 'functions', '_headers', '_redirects', '_routes.json', 'catalog-validation.json', 'robots.txt', 'sitemap.xml']) {
  if (!fs.existsSync(path.join(root, keep))) throw new Error('prune-deploy removed a required file: ' + keep);
}
console.log(`prune-deploy: removed ${removed} non-website files/folders from the upload.`);
