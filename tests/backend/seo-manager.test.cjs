// SEO Manager: setting validation, the deploy step that applies settings / fills missing page SEO without
// overwriting, automatic product SEO (manual always wins, nothing invented), the owner-only endpoints, the
// scheduled-audit report intake, Google data access, and the live-audit helpers.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const lib = () => import(path.join(root, 'functions/_lib/seo-settings.js'));
const build = () => import(path.join(root, 'scripts/build-seo-settings.mjs'));
const plain = (v) => JSON.parse(JSON.stringify(v));
const owner = { authorize: async (t) => (t === 'tok-owner' ? '' : 'OWNER_ONLY') };
const req = (url, body, headers = {}) => new Request('https://muslimabaya.com' + url, { method: 'POST', headers: Object.assign({ Origin: 'https://muslimabaya.com' }, headers), body: typeof body === 'string' ? body : JSON.stringify(body) });

function catalog() {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  for (const f of ['product-config.js', 'product-utils.js', 'category-products.js']) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx);
  return ctx.window;
}

test('settings: valid values kept, tags stripped, verification taken from a pasted meta tag', async () => {
  const { sanitizeSettings } = await lib();
  const r = sanitizeSettings({
    global: { googleVerification: '<meta name="google-site-verification" content="abcDEF1234567890_-x" />', ga4PropertyId: 'properties/456789012', defaultImage: 'https://muslimabaya.com/images/x.webp' },
    pages: { '/abaya': { title: '<b>Abaya</b> Collection <script>x</script>', description: 'Desc', robots: 'index, follow' } },
    redirects: [{ from: '/old', to: '/abaya', code: 301 }],
    robots: { disallow: ['/video'] },
    extra: 'dropped',
  });
  assert.equal(r.ok, true, r.errors.join('; '));
  assert.equal(r.settings.global.googleVerification, 'abcDEF1234567890_-x');
  assert.equal(r.settings.global.ga4PropertyId, '456789012');
  assert.equal(r.settings.pages['/abaya'].title, 'Abaya Collection x');
  assert.deepEqual(plain(r.settings.redirects), [{ from: '/old', to: '/abaya', code: 301 }]);
  assert.equal(r.settings.extra, undefined);
});

test('settings: unsafe values are refused with a reason', async () => {
  const { sanitizeSettings } = await lib();
  const bad = sanitizeSettings({
    global: { defaultImage: 'https://evil.example/x.png', googleVerification: 'x"><script>' },
    pages: { '/admin-dashboard': { title: 'x' }, '/abaya': { robots: 'noarchive' } },
    redirects: [{ from: '/checkout', to: '/x' }, { from: '/a', to: 'https://evil.example/' }, { from: '/b', to: '/c' }, { from: '/c', to: '/b' }, { from: '/same', to: '/same' }],
    robots: { disallow: ['/', '/product/', '/abaya', 'no-slash'] },
  });
  assert.equal(bad.ok, false);
  const all = bad.errors.join('\n');
  ['Default share image', 'Google verification', 'cannot be edited here', 'robots must be one of', 'part of the shop', '"To" must be', 'Redirect loop', 'are the same', 'whole site cannot be blocked', 'would hide products', 'is not allowed']
    .forEach((m) => assert.match(all, new RegExp(m.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&')), 'expected error: ' + m));
  assert.equal(bad.settings.redirects.length, 2); // b→c and c→b are kept but reported as a loop; nothing else
  assert.deepEqual(plain(bad.settings.robots.disallow), []);
});

test('deploy step: manual page values replace the automatic ones and lock the page against browser overrides', async () => {
  const { applyPage, headValues } = await build();
  const html = '<html lang="bn"><head><title>Auto</title><meta name="description" content="Auto d"><meta property="og:title" content="Auto"><link rel="canonical" href="https://muslimabaya.com/abaya"></head><body></body></html>';
  const out = applyPage(html, { title: 'Abaya & "Borkha"', description: 'Manual', robots: 'noindex, follow' }, '/abaya', {});
  const h = headValues(out);
  assert.equal(h.title, 'Abaya & "Borkha"');
  assert.equal(h.description, 'Manual');
  assert.equal(h.robots, 'noindex, follow');
  assert.match(out, /<meta property="og:title" content="Abaya &amp; &quot;Borkha&quot;">/);
  assert.match(out, /<html lang="bn" data-seo-managed="full">/);
  assert.equal((out.match(/<title>/g) || []).length, 1);
});

test('deploy step: automatic SEO only fills what is missing and never changes existing tags', async () => {
  const { autoPage, headValues } = await build();
  const missing = autoPage('<html><head><title>Muslim Abaya Size Chart</title></head></html>', '/size-chart');
  const h = headValues(missing.html);
  assert.match(h.description, /^Size Chart — Muslim Abaya/);
  assert.equal(h.canonical, 'https://muslimabaya.com/size-chart');
  const account = headValues(autoPage('<html><head><title>Reset</title></head></html>', '/forgot-password').html);
  assert.equal(account.robots, 'noindex, follow');
  assert.equal(account.canonical, '');
  const complete = '<html><head><title>T</title><meta name="description" content="Mine"><link rel="canonical" href="https://muslimabaya.com/x"></head></html>';
  assert.deepEqual(autoPage(complete, '/x'), { html: complete, added: null });
});

test('deploy step: redirect and robots blocks are replaced, never duplicated', async () => {
  const { managedBlock } = await build();
  const robots = 'User-agent: *\nDisallow: /checkout\n\nSitemap: https://muslimabaya.com/sitemap.xml\n';
  const once = managedBlock(robots, ['Disallow: /video'], 'Sitemap:');
  const twice = managedBlock(once, ['Disallow: /video', 'Disallow: /x'], 'Sitemap:');
  assert.equal((twice.match(/BEGIN SEO Manager/g) || []).length, 1);
  assert.match(twice, /Disallow: \/x\n# END SEO Manager\n\nSitemap:/);
  assert.equal(managedBlock(twice, [], 'Sitemap:').indexOf('SEO Manager'), -1);
});

test('product SEO: automatic text is short, built from the product only; manual text always wins', () => {
  const w = catalog();
  const all = Object.values(w.CATEGORY_PRODUCTS).flat().filter((p) => p && p.name);
  all.forEach((p) => {
    const s = w.maCatalog.productSeo(p);
    assert.ok(s.autoTitle.length <= 60, p.id + ' title ' + s.autoTitle.length);
    assert.ok(s.autoDescription.length <= 161, p.id + ' description ' + s.autoDescription.length);
    assert.match(s.autoTitle, /Muslim Abaya/);
    assert.doesNotMatch(s.autoDescription, /rating|review|★|best seller/i);
    if (p.price > 0) assert.ok(s.autoDescription.indexOf('৳' + p.price) >= 0, p.id + ' price in description');
  });
  // Different names never collapse to the same automatic title (long names are shortened from the middle).
  const byTitle = {};
  all.forEach((p) => { const t = w.maCatalog.productSeo(p).autoTitle; (byTitle[t] = byTitle[t] || new Set()).add(p.name); });
  Object.entries(byTitle).forEach(([t, names]) => assert.equal(names.size, 1, 'same automatic title for different names: ' + t));
  assert.equal(w.maCatalog.productSeo({ name: 'Popcorn Set for Women | Muslim Abaya' }).autoTitle, 'Popcorn Set for Women | Muslim Abaya Bangladesh');
  assert.equal(w.maCatalog.productSeo({ name: 'Premium Tribal Print Cotton One-Piece Maxi Dress - Cherry Red' }).autoTitle, 'Premium Tribal Print … Dress - Cherry Red | Muslim Abaya');
  const manual = w.maCatalog.productSeo({ name: 'X', price: 100, seoTitle: 'My title', seoDescription: 'My description' });
  assert.equal(manual.title, 'My title');
  assert.equal(manual.description, 'My description');
  assert.equal(manual.titleIsManual && manual.descriptionIsManual, true);
});

function fakeGitHub(initial) {
  const files = { 'seo-settings.json': initial ? { sha: 'a'.repeat(40), content: Buffer.from(JSON.stringify(initial)).toString('base64') } : null };
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push([init.method || 'GET', url, init.body ? JSON.parse(init.body) : null]);
    const f = files['seo-settings.json'];
    if ((init.method || 'GET') === 'GET') return f ? new Response(JSON.stringify(f), { status: 200 }) : new Response('{}', { status: 404 });
    const body = JSON.parse(init.body);
    if ((f && body.sha !== f.sha) || (!f && body.sha)) return new Response('{}', { status: 409 });
    files['seo-settings.json'] = { sha: 'b'.repeat(40), content: body.content };
    return new Response(JSON.stringify({ content: { sha: 'b'.repeat(40) }, commit: { sha: 'c'.repeat(40) } }), { status: 200 });
  };
  return { fetchImpl, calls, files };
}

test('/api/seo-settings: owner only, same origin, validated, conflict-safe commit', async () => {
  const { handleSeoSettings } = await import(path.join(root, 'functions/api/seo-settings.js'));
  const gh = fakeGitHub({ version: 1, pages: { '/abaya': { title: 'Old' } } });
  const env = { GITHUB_TOKEN: 'x' };
  const deps = Object.assign({ fetch: gh.fetchImpl }, owner);
  assert.equal((await handleSeoSettings(req('/api/seo-settings', { Token: 'tok-staff', action: 'get' }), env, deps)).status, 403);
  assert.equal((await handleSeoSettings(req('/api/seo-settings', { Token: 'tok-owner', action: 'get' }, { Origin: 'https://evil.example' }), env, deps)).status, 403);
  const got = await (await handleSeoSettings(req('/api/seo-settings', { Token: 'tok-owner', action: 'get' }), env, deps)).json();
  assert.equal(got.settings.pages['/abaya'].title, 'Old');
  const invalid = await handleSeoSettings(req('/api/seo-settings', { Token: 'tok-owner', action: 'save', sha: got.sha, settings: { redirects: [{ from: '/api/x', to: '/' }] } }), env, deps);
  assert.equal(invalid.status, 400);
  assert.equal(gh.calls.filter((c) => c[0] === 'PUT').length, 0);
  const stale = await handleSeoSettings(req('/api/seo-settings', { Token: 'tok-owner', action: 'save', sha: 'f'.repeat(40), settings: {} }), env, deps);
  assert.equal(stale.status, 409);
  const ok = await (await handleSeoSettings(req('/api/seo-settings', { Token: 'tok-owner', action: 'save', sha: got.sha, settings: { pages: { '/abaya': { title: 'New' } } } }), env, deps)).json();
  assert.equal(ok.ok, true);
  const saved = JSON.parse(Buffer.from(gh.files['seo-settings.json'].content, 'base64').toString('utf8'));
  assert.equal(saved.pages['/abaya'].title, 'New');
  const put = gh.calls.find((c) => c[0] === 'PUT');
  assert.match(put[1], /contents\/seo-settings\.json$/);
  assert.equal(put[2].sha, 'a'.repeat(40));
});

function fakeDb() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return {
        bind(...a) { this.a = a; return this; },
        async run() { if (/^INSERT/.test(sql)) rows.push({ id: rows.length + 1, created_at: this.a[0], report: this.a[2] }); return {}; },
        async all() { return { results: rows.slice().reverse() }; },
      };
    },
  };
}

test('/api/seo-report: the scheduled audit needs the key; stored reports are trimmed; owner reads them', async () => {
  const { handleSeoReport } = await import(path.join(root, 'functions/api/seo-report.js'));
  const db = fakeDb();
  const env = { SEO_AUDIT_KEY: 'k'.repeat(40), STOCK_DB: db, ASSETS: { fetch: async (r) => new Response(JSON.stringify({ name: new URL(r.url).pathname }), { status: 200 }) } };
  const report = { generatedAt: '2026-11-15T00:00:00Z', summary: { urls: 97 }, issues: [{ level: 'error', type: 'broken-link', url: 'https://muslimabaya.com/x', message: 'm'.repeat(1000), fix: 'f', extra: 'drop' }, { level: 'nope', type: 'x' }] };
  assert.equal((await handleSeoReport(req('/api/seo-report', report, { 'X-SEO-Audit-Key': 'wrong' }), env)).status, 403);
  assert.equal(db.rows.length, 0);
  const stored = await (await handleSeoReport(req('/api/seo-report', report, { 'X-SEO-Audit-Key': 'k'.repeat(40) }), env)).json();
  assert.equal(stored.ok, true);
  const saved = JSON.parse(db.rows[0].report);
  assert.equal(saved.issues.length, 1);
  assert.equal(saved.issues[0].message.length, 400);
  assert.equal(saved.issues[0].extra, undefined);
  assert.equal(saved.summary.errors, 1);
  assert.equal((await handleSeoReport(req('/api/seo-report', { Token: 'tok-staff', action: 'get' }), env, owner)).status, 403);
  const got = await (await handleSeoReport(req('/api/seo-report', { Token: 'tok-owner', action: 'get' }), env, owner)).json();
  assert.equal(got.build.name, '/seo-report.json');
  assert.equal(got.pages.name, '/seo-pages.json');
  assert.equal(got.live[0].summary.errors, 1);
  assert.equal(got.scheduled, true);
});

test('/api/seo-google: read-only Google calls on the server; "not connected" shows the e-mail to add', async () => {
  const { searchConsole, analytics } = await import(path.join(root, 'functions/api/seo-google.js'));
  const denied = async () => new Response('{}', { status: 403 });
  assert.deepEqual(plain(await searchConsole(denied, 't', '', Date.parse('2026-11-15'))), { connected: false, error: 'NO_ACCESS' });
  assert.deepEqual(plain(await analytics(denied, 't', '')), { connected: false, error: 'NO_PROPERTY_ID' });
  const seen = [];
  const ok = async (url, init) => {
    seen.push([url, init.headers.Authorization]);
    if (/sitemaps$/.test(url)) return new Response(JSON.stringify({ sitemap: [{ path: 'https://muslimabaya.com/sitemap.xml', errors: '0' }] }), { status: 200 });
    const body = JSON.parse(init.body);
    const rows = body.dimensions.length ? [{ keys: ['বোরকা'], clicks: 3, impressions: 40, ctr: 0.075, position: 8.2 }] : [{ clicks: 10, impressions: 200, ctr: 0.05, position: 12 }];
    return new Response(JSON.stringify({ rows }), { status: 200 });
  };
  const g = await searchConsole(ok, 'tok', 'sc-domain:muslimabaya.com', Date.parse('2026-11-15'));
  assert.equal(g.connected, true);
  assert.equal(g.totals.clicks, 10);
  assert.equal(g.queries[0].key, 'বোরকা');
  assert.equal(g.sitemaps[0].errors, 0);
  assert.ok(seen.every((s) => s[1] === 'Bearer tok' && s[0].startsWith('https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Amuslimabaya.com/')));
  const src = fs.readFileSync(path.join(root, 'functions/api/seo-google.js'), 'utf8');
  assert.match(src, /webmasters\.readonly/);
  assert.match(src, /analytics\.readonly/);
  assert.doesNotMatch(src, /auth\/webmasters'|auth\/analytics'/); // never a write scope
});

test('live audit: robots groups for other bots do not count as blocking Google; head parsing', async () => {
  const { blocksSearch, parseHead } = await import(path.join(root, 'scripts/seo-live-audit.mjs'));
  assert.equal(blocksSearch('User-agent: *\nAllow: /\n\nUser-agent: GPTBot\nDisallow: /\n'), false);
  assert.equal(blocksSearch('User-agent: *\nDisallow: /\n'), true);
  assert.equal(blocksSearch('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nAllow: /\n'), true);
  const h = parseHead('<title> A &amp; B </title><meta name="description" content="D"><meta name="robots" content="noindex"><link rel="canonical" href="https://muslimabaya.com/a">');
  assert.deepEqual(plain(h), { title: 'A & B', description: 'D', robots: 'noindex', canonical: 'https://muslimabaya.com/a' });
});

test('SEO Manager is wired into the deploy, the admin menu, robots and the scheduled workflow', () => {
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const order = read('scripts/build-cloudflare.mjs');
  assert.ok(order.indexOf('build-product-seo.mjs') < order.indexOf('build-seo-settings.mjs'));
  assert.ok(order.indexOf('build-home-prerender.mjs') < order.indexOf('build-seo-settings.mjs'));
  assert.ok(order.indexOf('build-seo-settings.mjs') < order.indexOf('build-seo-audit.mjs'));
  assert.match(read('admin-navigation.json'), /"href": "admin-seo.html"/);
  assert.match(read('admin-seo.html'), /data-admin-guard="1"/);
  assert.match(read('admin-seo.html'), /<meta name="robots" content="noindex, nofollow">/);
  assert.match(read('robots.txt'), /^Disallow: \/admin-$/m);
  const wf = read('.github/workflows/seo-audit.yml');
  assert.match(wf, /schedule:/);
  assert.match(wf, /secrets\.SEO_AUDIT_KEY/);
  assert.match(read('site-seo.js'), /meta\.inStock === false \? "out of stock" : "in stock"/);
});
