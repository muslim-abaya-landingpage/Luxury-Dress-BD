// /api/cron-tick: the reliable clock (called by the Worker cron every 2 minutes) for sale start/end and
// scheduled-publish rebuilds and the daily SEO audit. Each job runs once; too-frequent calls do nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const mod = () => import(path.join(root, 'functions/api/cron-tick.js'));
const lib = () => import(path.join(root, 'functions/_lib/schedule-check.js'));

function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      const st = { a: [], bind(...a) { this.a = a; return this; },
        async run() {
          if (/^CREATE/.test(sql)) return {};
          if (/DO NOTHING/.test(sql)) { if (rows.has(this.a[0])) return { meta: { changes: 0 } }; rows.set(this.a[0], this.a[1]); return { meta: { changes: 1 } }; }
          rows.set(this.a[0], this.a[1]); return { meta: { changes: 1 } };
        },
        async first() { return rows.has(this.a[0]) ? { value: rows.get(this.a[0]) } : null; } };
      return st;
    },
  };
}
const bd = (s) => Date.parse(s + '+06:00');
function env(schedule, db) {
  return { STOCK_DB: db, GITHUB_TOKEN: 'tok', ASSETS: { fetch: async () => new Response(JSON.stringify({ version: 1, catalog: schedule }), { status: 200 }) } };
}
function gh(status = 204) {
  const calls = [];
  const f = async (url, init) => { calls.push([init.method, url, init.body ? JSON.parse(init.body) : null]); return new Response(null, { status }); };
  f.calls = calls;
  return f;
}
const req = () => new Request('https://muslimabaya.com/api/cron-tick', { method: 'POST' });

test('sale starting today: one rebuild at the first tick after 00:03 Bangladesh time, never twice', async () => {
  const { handleCronTick } = await mod();
  const db = fakeDb(), f = gh(), e = env({ abaya: [{ id: 'A1', saleFrom: '2026-11-16' }] }, db);
  let t = bd('2026-11-16T00:01:00');
  let out = await (await handleCronTick(req(), e, { fetch: f, now: () => t })).json();
  assert.deepEqual(out.ran, []); // before 00:03
  t = bd('2026-11-16T07:20:00'); // GitHub would have missed midnight; the tick still catches it
  out = await (await handleCronTick(req(), e, { fetch: f, now: () => t })).json();
  assert.equal(out.ran[0].job, 'sale');
  assert.equal(out.ran[0].result, 'dispatched');
  const sale = f.calls.filter((c) => /sale-schedule-rebuild\.yml\/dispatches$/.test(c[1]));
  assert.equal(sale.length, 1);
  assert.deepEqual(sale[0][2], { ref: 'main', inputs: { force: 'true' } });
  assert.equal(out.ran.find((r) => r.job === 'seo-audit').result, 'started'); // 07:20 is also after 02:41
  t += 5 * 60000;
  out = await (await handleCronTick(req(), e, { fetch: f, now: () => t })).json();
  assert.equal(out.ran.filter((r) => r.job === 'sale').length, 0);
  assert.equal(f.calls.filter((c) => /sale-schedule/.test(c[1])).length, 1);
});

test('too-frequent calls do nothing (anyone may call it)', async () => {
  const { handleCronTick } = await mod();
  const db = fakeDb(), f = gh(), e = env({}, db);
  const t = bd('2026-11-16T10:00:00');
  await handleCronTick(req(), e, { fetch: f, now: () => t });
  const out = await (await handleCronTick(req(), e, { fetch: f, now: () => t + 60000 })).json();
  assert.equal(out.skipped, 'too soon');
});

test('scheduled publish: rebuild when the time passes; daily SEO audit once after 02:41', async () => {
  const { handleCronTick } = await mod();
  const db = fakeDb(), f = gh(), e = env({ hijab: [{ id: 'H9', publishDate: '2026-11-16T10:30' }] }, db);
  let t = bd('2026-11-16T10:26:00');
  let out = await (await handleCronTick(req(), e, { fetch: f, now: () => t })).json();
  assert.equal(out.ran.filter((r) => r.job === 'publish').length, 0);
  assert.equal(out.ran.find((r) => r.job === 'seo-audit').result, 'started');
  t = bd('2026-11-16T10:31:00');
  out = await (await handleCronTick(req(), e, { fetch: f, now: () => t })).json();
  assert.ok(out.ran.some((r) => r.job === 'publish'));
  t = bd('2026-11-16T10:36:00');
  out = await (await handleCronTick(req(), e, { fetch: f, now: () => t })).json();
  assert.equal(out.ran.filter((r) => r.job === 'publish').length, 0); // not again
});

test('if the token may not start workflows, a tiny commit makes Cloudflare rebuild instead', async () => {
  const { handleCronTick } = await mod();
  const db = fakeDb(), calls = [];
  const f = async (url, init = {}) => {
    calls.push([init.method || 'GET', url, init.body ? JSON.parse(init.body) : null]);
    if (/dispatches$/.test(url)) return new Response('{}', { status: 403 });
    if ((init.method || 'GET') === 'GET') return new Response(JSON.stringify({ sha: 'abc' }), { status: 200 });
    return new Response('{}', { status: 200 });
  };
  const e = env({ abaya: [{ id: 'A1', saleTo: '2026-11-15' }] }, db);
  const out = await (await handleCronTick(req(), e, { fetch: f, now: () => bd('2026-11-16T00:05:00') })).json();
  assert.equal(out.ran[0].result, 'GITHUB_403 → committed');
  const put = calls.find((c) => c[0] === 'PUT');
  assert.match(put[1], /contents\/\.rebuild-trigger$/);
  assert.equal(put[2].sha, 'abc');
  assert.match(put[2].message, /^Scheduled rebuild: abaya\/A1: sale ended 2026-11-15/);
});

test('shared check: sale boundaries and publish window; schedule.json keeps only dates', async () => {
  const { saleBoundaries, publishesBetween, scheduleSnapshot, dhakaDate } = await lib();
  const cat = { abaya: [{ id: 'A', saleFrom: '2026-11-16', price: 1 }, { id: 'B', saleTo: '2026-11-15' }, { id: 'C', variations: [{ size: '52', saleFrom: '2026-11-16' }] }, { id: 'D', name: 'x' }] };
  assert.equal(saleBoundaries(cat, '2026-11-16').length, 3);
  assert.equal(dhakaDate(Date.parse('2026-11-15T18:30:00Z')), '2026-11-16');
  assert.deepEqual(publishesBetween({ x: [{ id: 'P', publishDate: '2026-11-16T10:30' }] }, bd('2026-11-16T10:00:00'), bd('2026-11-16T10:31:00')), ['x/P: published at 2026-11-16T10:30']);
  assert.deepEqual(JSON.parse(JSON.stringify(scheduleSnapshot(cat))), { abaya: [{ id: 'A', saleFrom: '2026-11-16' }, { id: 'B', saleTo: '2026-11-15' }, { id: 'C', variations: [{ size: '52', color: '', type: '', saleFrom: '2026-11-16', saleTo: '' }] }] });
});

test('the Worker cron calls /api/cron-tick separately from the order queue', () => {
  const src = require('node:fs').readFileSync(path.join(root, 'cloudflare-worker/worker.js'), 'utf8');
  assert.match(src, /ctx\.waitUntil\(processOrderQueue\(env\)\);\s*\/\/[^\n]*\n[^\n]*\n\s*ctx\.waitUntil\(fetch\('https:\/\/muslimabaya\.com\/api\/cron-tick'[^)]*\)\.catch\(\(\) => \{\}\)\);/);
});


test('daily live SEO audit runs on the site itself in small steps and is saved for the SEO Manager', async () => {
  const { handleCronTick } = await mod();
  const db = fakeDb(); const reports = [];
  const realPrepare = db.prepare.bind(db);
  db.prepare = (sql) => /seo_reports/.test(sql) ? { bind(...a) { this.a = a; return this; }, async run() { if (/^INSERT/.test(sql)) reports.push(JSON.parse(this.a[2])); return {}; } } : realPrepare(sql);
  const pages = Array.from({ length: 20 }, (_, i) => 'https://muslimabaya.com/p' + i);
  const page = (u, extra) => '<html><head><title>Page ' + u + '</title><meta name="description" content="d"><link rel="canonical" href="' + u + '"></head><body><a href="/broken-one">x</a>' + (extra || '') + '</body></html>';
  const site = async (url, init = {}) => {
    const u = String(url && url.url ? url.url : url);
    const r = (status, body, final) => Object.defineProperty(new Response(body || '', { status }), 'url', { value: final || u });
    if (/schedule\.json$/.test(u)) return r(200, '{"catalog":{}}');
    if (u.endsWith('/robots.txt')) return r(200, 'User-agent: *\nAllow: /\nSitemap: https://muslimabaya.com/sitemap.xml\n');
    if (u.endsWith('/sitemap.xml')) return r(200, pages.map((p) => '<loc>' + p + '</loc>').join(''));
    if (u === 'http://muslimabaya.com/') throw new Error('must not be checked from inside Cloudflare');
    if (u === 'https://www.muslimabaya.com/') return r(200, '', 'https://muslimabaya.com/');
    if (/missing-page-check|broken-one/.test(u)) return r(404, '');
    if (u === pages[3]) return r(200, '<html><head><title>No description</title><link rel="canonical" href="' + u + '"></head></html>');
    return r(200, page(u));
  };
  const e = { STOCK_DB: db, GITHUB_TOKEN: 'tok', ASSETS: { fetch: site } };
  let t = bd('2026-11-16T02:45:00');
  let out = await (await handleCronTick(req(), e, { fetch: site, now: () => t })).json();
  assert.equal(out.ran.find((r) => r.job === 'seo-audit').result, 'started');
  const seen = [];
  for (let k = 0; k < 6 && !reports.length; k++) {
    t += 5 * 60000;
    out = await (await handleCronTick(req(), e, { fetch: site, now: () => t })).json();
    seen.push(out.ran.map((r) => r.result + (r.done ? ' ' + r.done : '')).join(','));
  }
  assert.deepEqual(seen, ['step 15/20 pages', 'step 20/20 pages', 'done']);
  assert.equal(reports.length, 1);
  assert.equal(reports[0].summary.urls, 20);
  const types = reports[0].issues.map((i) => i.type).sort();
  assert.deepEqual(types, ['broken-link', 'missing-description']);
  assert.equal(db.rows.get('seo-audit:2026-11-16'), 'done: 2 errors, 0 warnings');
  t += 5 * 60000;
  out = await (await handleCronTick(req(), e, { fetch: site, now: () => t })).json();
  assert.equal(out.ran.filter((r) => r.job === 'seo-audit').length, 0); // once a day
});
