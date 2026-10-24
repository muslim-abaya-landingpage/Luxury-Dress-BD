// Non-website files (source, tests, notes, tool config) must answer 404 on muslimabaya.com even when Cloudflare
// Pages still holds a copy from an older deployment: the middleware blocks them, and _routes.json must send
// every blocked path to the middleware.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { BLOCKED_DIRS, BLOCKED_FILES, isBlockedPath } = await import(path.join(root, 'functions/_lib/blocked-paths.js'));
const { onRequest } = await import(path.join(root, 'functions/_middleware.js'));
const routes = JSON.parse(fs.readFileSync(path.join(root, '_routes.json'), 'utf8'));

test('_routes.json sends every blocked path to the middleware and stays within the 100-rule limit', () => {
  for (const d of BLOCKED_DIRS) assert.ok(routes.include.includes('/' + d + '/*'), 'missing /' + d + '/*');
  for (const f of BLOCKED_FILES) {
    assert.ok(routes.include.includes('/' + f), 'missing /' + f);
    // The percent-encoded form is added too when it fits Cloudflare's 100-character rule limit.
    if (/[^\x00-\x7f]/.test(f) && encodeURI('/' + f).length <= 100) assert.ok(routes.include.includes(encodeURI('/' + f)), 'missing encoded /' + f);
  }
  assert.ok(routes.include.length + routes.exclude.length <= 100, 'at most 100 rules');
  for (const rule of routes.include.concat(routes.exclude)) assert.ok(rule.length <= 100, 'rule over 100 characters: ' + rule);
});

test('blocked: source, tests, notes, tool files; allowed: every page and asset the site serves', () => {
  for (const p of ['/apps-script/Code.gs', '/cloudflare-worker/worker.js', '/scripts/build-cloudflare.mjs', '/tests/x.cjs', '/docs/ADMIN-SETUP.md',
    '/README.md', '/package.json', '/firestore.rules', '/%2Fapps-script/Code.gs', '//apps-script/Code.gs', '/' + encodeURIComponent('দৈনিক-চেকলিস্ট.md')]) {
    assert.equal(isBlockedPath(p), true, p);
  }
  // Nothing that exists in the deployed site may be blocked.
  const site = fs.readdirSync(root).filter((f) => /\.(html|js|css|json|txt|xml|png|svg|webp|ico)$/.test(f) && !BLOCKED_FILES.includes(f));
  for (const f of site) assert.equal(isBlockedPath('/' + f), false, f);
  for (const p of ['/', '/abaya', '/product/ABY-MAROON-1', '/api/admin-read', '/catalog-validation.json', '/robots.txt', '/images/a.webp']) {
    assert.equal(isBlockedPath(p), false, p);
  }
});

test('middleware answers 404 (no-store, noindex) for a blocked path and passes others on', async () => {
  let nextCalled = 0;
  const ctx = (url, method = 'GET') => ({ request: new Request('https://muslimabaya.com' + url, { method }), env: {}, next: () => { nextCalled++; return new Response('static'); } });
  const res = await onRequest(ctx('/apps-script/Code.gs'));
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
  assert.equal((await onRequest(ctx('/README.md', 'POST'))).status, 404);
  assert.equal(nextCalled, 0);
  const ok = await onRequest(ctx('/abaya'));
  assert.equal(await ok.text(), 'static');
  assert.equal(nextCalled, 1);
});
