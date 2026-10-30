// Size Manager (Stage 2): D1 schema + seed, the owner-only admin API, the public published config, the shared
// size core (website + Apps Script) and the Apps Script order check. Runs on node:sqlite as a D1 stand-in.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '../..');
const lib = (f) => import(path.join(root, 'functions', f));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v));
const NOW = Date.UTC(2026, 9, 30, 8, 0, 0);
const CATEGORIES = ['abaya', 'cover-up', 'premium-two-piece', 'tops-kurti', 'embroidery', 'hijab', 'panjabi', 'three-piece-dress'];

/** D1 stand-in: prepare/bind/first/all/run and an all-or-nothing batch, foreign keys on (as in D1). */
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    first: async () => { const r = db.prepare(sql).get(...args); return r ? Object.assign({}, r) : null; },
    all: async () => ({ results: db.prepare(sql).all(...args).map((r) => Object.assign({}, r)) }),
    run: async () => { db.prepare(sql).run(...args); return { success: true }; },
    _run() { db.prepare(sql).run(...args); },
  });
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => {
      db.exec('BEGIN');
      try { list.forEach((s) => s._run()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
      return [];
    },
    _db: db,
  };
}
const migrate = (d1, ...files) => files.forEach((f) => d1._db.exec(read('migrations/d1/' + f)));
const tables = (d1) => d1._db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name);

function sizeCore() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(read('apps-script/SizeCore.gs'), ctx);
  return ctx.maSizeCore;
}
const catalog = JSON.parse(read('catalog-validation.json'));

async function ownerEnv(db) {
  const { _resetTokenCache } = await lib('_lib/google-auth.js');
  const { _resetMetaCache } = await lib('_lib/sheet-snapshot.js');
  _resetTokenCache(); _resetMetaCache();
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const sa = JSON.stringify({ client_email: 'reader@proj.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const serial = (d) => (d.getTime() + 6 * 3600000 - Date.UTC(1899, 11, 30)) / 86400000;
  const fmt = (n) => { const d = new Date(Math.round(n * 86400000) + Date.UTC(1899, 11, 30)); const p = (x) => String(x).padStart(2, '0'); return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`; };
  const DATE_COLS = { Sessions: [4, 5], Admins: [6] };
  const sheets = {
    Sessions: [['Token', 'Email', 'Phone', 'Name', 'CreatedAt', 'ExpiresAt', 'Role'],
      ['tok-owner', 'owner@example.com', '01700000000', 'Owner', serial(new Date(NOW - 3600000)), serial(new Date(Date.UTC(2100, 0, 1))), 'admin'],
      ['tok-staff', 'staff@example.com', '01800000000', 'Staff', serial(new Date(NOW - 3600000)), serial(new Date(Date.UTC(2100, 0, 1))), 'staff']],
    Admins: [['Email', 'Phone', 'Name', 'PasswordHash', 'Salt', 'Status', 'CreatedAt', 'Role', 'UpdatedAt'],
      ['owner@example.com', '01700000000', 'Owner', 'h', 's', 'active', serial(new Date(NOW - 9e9)), 'admin'],
      ['staff@example.com', '01800000000', 'Staff', 'h', 's', 'active', serial(new Date(NOW - 9e9)), 'staff']],
  };
  const fakeFetch = async (url) => {
    const ok = (body) => ({ ok: true, status: 200, json: async () => body });
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) return ok({ access_token: 'AT', expires_in: 3600 });
    if (/values:batchGet/.test(url)) {
      const asked = new URL(url).searchParams.getAll('ranges').map((r) => r.replace(/^'|'$/g, ''));
      const formatted = /FORMATTED_VALUE/.test(url) && !/UNFORMATTED/.test(url);
      return ok({ valueRanges: asked.map((n) => ({ values: sheets[n].map((row, r) => row.map((v, c) => (r && formatted && DATE_COLS[n].includes(c) ? fmt(v) : formatted ? String(v) : v))) })) });
    }
    return ok({ spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/S/edit', properties: { timeZone: 'Asia/Dhaka' },
      sheets: Object.keys(sheets).map((n, i) => ({ properties: { title: n, sheetId: i + 1, gridProperties: { rowCount: 100, columnCount: 20 } } })) });
  };
  return { env: { GOOGLE_SA_JSON: sa, SHEET_ID: 'S', STOCK_DB: db }, fakeFetch };
}

test('migration adds only the size_* tables, keeps existing tables and rows, and rolls back cleanly', () => {
  const d1 = fakeD1();
  d1._db.exec("CREATE TABLE live_catalog (k TEXT PRIMARY KEY, v TEXT NOT NULL, saved_at INTEGER NOT NULL); INSERT INTO live_catalog VALUES ('state', '{}', 1)");
  migrate(d1, '0001_size_manager.sql');
  migrate(d1, '0001_size_manager.sql'); // running it twice is harmless
  assert.deepEqual(tables(d1), ['live_catalog', 'size_audit_log', 'size_category_settings', 'size_config_versions', 'size_fields',
    'size_options', 'size_product_overrides', 'size_templates']);
  migrate(d1, '0001_size_manager.down.sql');
  assert.deepEqual(tables(d1), ['live_catalog']);
  assert.equal(d1._db.prepare('SELECT COUNT(*) AS n FROM live_catalog').get().n, 1, 'existing rows untouched');
});

test('schema refuses bad rows (Kaftan/Karchupi categories, bad keys, two active versions, dangling templates)', () => {
  const d1 = fakeD1();
  migrate(d1, '0001_size_manager.sql', '0002_size_manager_seed.sql');
  const bad = (sql) => assert.throws(() => d1._db.exec(sql), /constraint/i, sql);
  bad("INSERT INTO size_category_settings VALUES ('kaftan', 'abaya', 1, 1, '')");
  bad("INSERT INTO size_category_settings VALUES ('karchupi', 'abaya', 1, 1, '')");
  bad("INSERT INTO size_templates VALUES ('Bad Id', '', '', 1, '')");
  bad("INSERT INTO size_fields (template_id, key) VALUES ('abaya', 'Body-1')");
  bad("INSERT INTO size_fields (template_id, key) VALUES ('no-such-template', 'body')");
  bad("INSERT INTO size_config_versions VALUES (99, '{}', 1, '', '', 1)");
  bad("UPDATE size_category_settings SET template_id = 'missing' WHERE category_key = 'abaya'");
});

test('seed: 8 default templates, every category off, version 1 published; re-running keeps owner edits', async () => {
  const store = await lib('_lib/size-store.js');
  execFileSync(process.execPath, [path.join(root, 'scripts/build-size-seed.mjs'), '--check']);
  const d1 = fakeD1();
  migrate(d1, '0001_size_manager.sql', '0002_size_manager_seed.sql');
  const { config } = await store.readDraft(d1);
  assert.deepEqual(Object.keys(config.templates).sort(), CATEGORIES.slice().sort());
  assert.deepEqual(Object.keys(config.categories).sort(), CATEGORIES.slice().sort());
  assert.ok(Object.values(config.categories).every((c) => c.enabled === false));
  const tp = config.templates['premium-two-piece'];
  assert.deepEqual(tp.fields.map((f) => [f.key, f.label_bn || f.label_en]),
    [['top', 'জামা'], ['top_length', 'Top Length'], ['sleeve', 'Sleeve Length'], ['bottom', 'পায়জামা / প্লাজু'], ['bottom_type', 'Bottom Type']]);
  assert.deepEqual(config.templates.abaya.fields[0].options.map((o) => o.value), ['40', '42', '44', '46', '48', '50', '52']);
  const active = await store.readActive(d1);
  assert.equal(active.version, 1);
  assert.deepEqual(plain(active.config), plain(Object.assign({ version: 1 }, config)));

  await store.saveTemplate(d1, Object.assign({}, config.templates.hijab, { name_en: 'Hijab (edited)' }), { now: NOW, actor: 'owner' });
  migrate(d1, '0002_size_manager_seed.sql');
  assert.equal((await store.readDraft(d1)).config.templates.hijab.name_en, 'Hijab (edited)');
  assert.equal((await store.listVersions(d1)).length, 1);
});

test('size core: every category off → every catalog product keeps its old pickers (resolve → null)', async () => {
  const core = sizeCore();
  const d1 = fakeD1();
  migrate(d1, '0001_size_manager.sql', '0002_size_manager_seed.sql');
  const { config } = await (await lib('_lib/size-store.js')).readActive(d1);
  assert.ok(catalog.products.length > 50);
  catalog.products.forEach((p) => assert.equal(core.resolve(config, p), null, p.id));
});

test('size core: with every category ON, existing products offer exactly their old sizes', async () => {
  const core = sizeCore();
  const store = await lib('_lib/size-store.js');
  const d1 = fakeD1();
  migrate(d1, '0001_size_manager.sql', '0002_size_manager_seed.sql');
  const { config } = await store.readActive(d1);
  CATEGORIES.forEach((k) => { config.categories[k].enabled = true; });
  let checked = 0;
  catalog.products.forEach((p) => {
    assert.ok(p.sizeLegacy && Object.keys(p.sizeLegacy).length, p.id + ' has old size lists');
    const r = core.resolve(config, p);
    assert.ok(r, p.id);
    const tpl = config.templates[p.category];
    // Each field shows the first old list it maps to; every old list is shown by some field, unchanged.
    const shown = {};
    r.fields.forEach((f) => {
      const t = tpl.fields.find((x) => x.key === f.key);
      const slot = t.legacy.find((s) => p.sizeLegacy[s]);
      assert.ok(slot, p.id + ' ' + f.key + ' only appears when the product had that list');
      assert.deepEqual(plain(f.options.map((o) => o.value)), p.sizeLegacy[slot].filter((v, i, a) => a.indexOf(v) === i), p.id + ' ' + f.key);
      shown[slot] = true;
    });
    Object.keys(p.sizeLegacy).forEach((slot) => {
      const covered = shown[slot] || tpl.fields.some((f) => f.legacy.includes(slot) && f.legacy.some((s) => shown[s]));
      assert.ok(covered, p.id + ' old list ' + slot + ' is offered');
    });
    checked++;
  });
  assert.equal(checked, catalog.products.length);
  assert.equal(core.resolve(config, { id: 'K-1', category: 'kaftan', sizeLegacy: { sizes: ['52'] } }), null, 'Kaftan untouched');
  assert.equal(core.resolve(config, { id: 'K-2', category: 'karchupi', sizeLegacy: { sizes: ['52'] } }), null, 'Karchupi untouched');
});

test('size core: new products use the template; labels are display only; validation rules', async () => {
  const core = sizeCore();
  const { DEFAULT_TEMPLATES } = await lib('_lib/size-defaults.js');
  const templates = {};
  DEFAULT_TEMPLATES.forEach((t) => { templates[t.id] = t; });
  const config = { version: 7, categories: { 'premium-two-piece': { template: 'premium-two-piece', enabled: true }, hijab: { template: 'hijab', enabled: true } },
    templates, products: { 'NEW-OFF': { enabled: false }, 'OWN-1': { useTemplate: true, fields: { top: { label_bn: 'কামিজ', options: ['38', '40'] }, bottom_type: { enabled: false } } } } };
  const r = core.resolve(config, { id: 'NEW-1', category: 'premium-two-piece', sizeLegacy: {} });
  assert.deepEqual(plain(r.fields.map((f) => [f.key, f.label, f.required])),
    [['top', 'জামা', true], ['top_length', 'Top Length', true], ['bottom', 'পায়জামা / প্লাজু', true], ['bottom_type', 'Bottom Type', false]]);
  assert.equal(r.version, 7);
  assert.equal(core.resolve(config, { id: 'NEW-OFF', category: 'premium-two-piece', sizeLegacy: {} }), null, 'product switch wins');
  const own = core.resolve(config, { id: 'OWN-1', category: 'premium-two-piece', sizeLegacy: { body: ['52'] } });
  assert.deepEqual(plain(own.fields.map((f) => f.key)), ['top', 'top_length', 'bottom']);
  assert.equal(own.fields[0].label, 'কামিজ');
  assert.deepEqual(plain(own.fields[0].options.map((o) => o.value)), ['38', '40']);

  const ok = core.validate(r, [{ key: 'top', value: '40' }, { key: 'top_length', value: '42' }, { key: 'bottom', value: '38' }]);
  assert.equal(ok.ok, true);
  assert.equal(ok.size, 'জামা 40 · Top Length 42 · পায়জামা / প্লাজু 38');
  assert.equal(core.variantKey(ok.measurements), 'top=40|top_length=42|bottom=38', 'stock key does not depend on labels');
  const codes = (m) => core.validate(r, m).errors.map((e) => e.key + ':' + e.code).join(',');
  assert.equal(codes([{ key: 'top', value: '40' }]), 'top_length:REQUIRED,bottom:REQUIRED');
  assert.equal(codes([{ key: 'top', value: '99' }, { key: 'top_length', value: '42' }, { key: 'bottom', value: '38' }]), 'top:INVALID');
  assert.equal(codes([{ key: 'top', value: '40' }, { key: 'top', value: '42' }, { key: 'top_length', value: '42' }, { key: 'bottom', value: '38' }]), ':MALFORMED');
  assert.equal(codes({ top: '40', top_length: '42', bottom: '38', hack: '1' }), 'hack:UNKNOWN');

  const h = core.resolve(config, { id: 'NEW-H', category: 'hijab', sizeLegacy: {} });
  assert.equal(core.validate(h, { size: '60 x 70' }).ok, true, 'custom value allowed where the owner allows it');
  assert.equal(core.validate(h, { size: '<script>' }).ok, false, 'markup refused');
  assert.equal(core.validate(h, { size: 'x'.repeat(41) }).ok, false, 'length limit');
});

test('store validation refuses unsafe or broken input', async () => {
  const store = await lib('_lib/size-store.js');
  const base = { id: 'test', name_en: 'Test', fields: [{ key: 'size', label_en: 'Size', options: ['1'] }] };
  const code = (fn) => { try { fn(); return 'OK'; } catch (e) { return e.code; } };
  assert.equal(code(() => store.validateTemplate(base)), 'OK');
  assert.equal(code(() => store.validateTemplate({ ...base, id: "x'; DROP TABLE size_templates;--" })), 'BAD_TEMPLATE_ID');
  assert.equal(code(() => store.validateTemplate({ ...base, name_en: '<img onerror=1>' })), 'BAD_NAME');
  assert.equal(code(() => store.validateTemplate({ ...base, fields: [] })), 'NO_FIELDS');
  assert.equal(code(() => store.validateTemplate({ ...base, fields: [base.fields[0], base.fields[0]] })), 'BAD_FIELD_KEY');
  assert.equal(code(() => store.validateTemplate({ ...base, fields: [{ key: 'size', label_en: 'Size', options: [] }] })), 'FIELD_HAS_NO_CHOICES');
  assert.equal(code(() => store.validateTemplate({ ...base, fields: [{ key: 'size', label_en: 'Size', options: ['1', ' 1 '] }] })), 'BAD_OPTION');
  assert.equal(code(() => store.validateTemplate({ ...base, fields: [{ key: 'size', label_en: 'Size', options: ['1'], legacy: ['nope'] }] })), 'BAD_LEGACY');
  assert.equal(code(() => store.validateTemplate({ ...base, fields: Array.from({ length: 21 }, (_, i) => ({ key: 'f' + i, label_en: 'F', options: ['1'] })) })), 'TOO_MANY_FIELDS');
  const ids = new Set(['abaya']);
  assert.equal(code(() => store.validateCategory({ category_key: 'kaftan', template_id: 'abaya' }, ids)), 'BAD_CATEGORY');
  assert.equal(code(() => store.validateCategory({ category_key: 'abaya', template_id: 'nope' }, ids)), 'UNKNOWN_TEMPLATE');
  assert.equal(code(() => store.validateOverride({ product_id: '../x' }, ids)), 'BAD_PRODUCT_ID');
  assert.equal(code(() => store.validateOverride({ product_id: 'AB-1', fields: { size: { label_bn: '{{x}}' } } }, ids)), 'BAD_LABEL');
});

test('admin API: owner only; edit, conflict, duplicate, publish, rollback, audit; public config shows only the published copy', async () => {
  const { handleSizeAdmin } = await lib('api/size-admin.js');
  const { handleSizeConfig } = await lib('api/size-config.js');
  const db = fakeD1();
  migrate(db, '0001_size_manager.sql', '0002_size_manager_seed.sql');
  const { env, fakeFetch } = await ownerEnv(db);
  let now = NOW;
  const call = async (body, headers = {}) => {
    const res = await handleSizeAdmin(new Request('https://muslimabaya.com/api/size-admin', { method: 'POST', body: JSON.stringify(body), headers }), env, { fetch: fakeFetch, now: () => now });
    return { status: res.status, body: await res.json() };
  };
  const pub = async () => (await handleSizeConfig(new Request('https://muslimabaya.com/api/size-config'), env)).json();

  assert.equal((await call({ Token: 'tok-staff', action: 'draft' })).status, 403);
  assert.equal((await call({ Token: 'nope', action: 'draft' })).status, 401);
  assert.equal((await call({ action: 'draft' })).status, 401);
  assert.equal((await call({ Token: 'tok-owner', action: 'draft' }, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await handleSizeAdmin(new Request('https://muslimabaya.com/api/size-admin'), env, { fetch: fakeFetch })).status, 405);
  assert.equal((await call({ Token: 'tok-owner', action: 'dropTables' })).body.error, 'BAD_ACTION');

  const draft = (await call({ Token: 'tok-owner', action: 'draft' })).body;
  assert.equal(draft.ok, true);
  assert.equal(draft.active.version, 1);
  const tp = draft.config.templates['premium-two-piece'];

  // Rename জামা → কামিজ and reorder: labels change, keys stay.
  now += 1000;
  const edited = Object.assign({}, tp, { fields: [tp.fields[3], Object.assign({}, tp.fields[0], { label_bn: 'কামিজ' })].concat(tp.fields.slice(1, 3), tp.fields.slice(4)) });
  let r = await call({ Token: 'tok-owner', action: 'saveTemplate', template: edited, expectedUpdatedAt: draft.updatedAt['premium-two-piece'] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await call({ Token: 'tok-owner', action: 'saveTemplate', template: edited, expectedUpdatedAt: draft.updatedAt['premium-two-piece'] });
  assert.deepEqual([r.status, r.body.error], [409, 'CONFLICT'], 'stale editor cannot overwrite');
  r = await call({ Token: 'tok-owner', action: 'saveTemplate', template: Object.assign({}, edited, { name_en: '<b>x</b>' }) });
  assert.deepEqual([r.status, r.body.error], [400, 'BAD_NAME']);

  assert.equal((await call({ Token: 'tok-owner', action: 'duplicateTemplate', from: 'abaya', id: 'abaya-kids', name_en: 'Abaya Kids' })).body.ok, true);
  assert.equal((await call({ Token: 'tok-owner', action: 'duplicateTemplate', from: 'abaya', id: 'abaya-kids' })).body.error, 'TEMPLATE_EXISTS');
  assert.equal((await call({ Token: 'tok-owner', action: 'deleteTemplate', id: 'abaya' })).body.error, 'TEMPLATE_IN_USE');
  assert.equal((await call({ Token: 'tok-owner', action: 'saveCategory', category: { category_key: 'karchupi', template_id: 'abaya', enabled: true } })).body.error, 'BAD_CATEGORY');
  assert.equal((await call({ Token: 'tok-owner', action: 'saveCategory', category: { category_key: 'premium-two-piece', template_id: 'premium-two-piece', enabled: true } })).body.ok, true);
  assert.equal((await call({ Token: 'tok-owner', action: 'saveOverride', override: { product_id: 'DR-01', enabled: false } })).body.ok, true);
  assert.equal((await call({ Token: 'tok-owner', action: 'saveOverride', override: { product_id: "DR-01' OR 1=1--" } })).body.error, 'BAD_PRODUCT_ID');

  // Nothing reaches customers until Publish.
  assert.equal((await pub()).version, 1);
  assert.equal((await pub()).config.categories['premium-two-piece'].enabled, false);
  r = await call({ Token: 'tok-owner', action: 'publish', note: 'two-piece on' });
  assert.deepEqual([r.body.ok, r.body.version], [true, 2]);
  let live = await pub();
  assert.equal(live.version, 2);
  assert.equal(live.config.categories['premium-two-piece'].enabled, true);
  assert.equal(live.config.templates['premium-two-piece'].fields[1].label_bn, 'কামিজ');
  assert.equal(live.config.products['DR-01'].enabled, false);
  const core = sizeCore();
  assert.equal(core.resolve(live.config, catalog.products.find((p) => p.id === 'DR-01')), null, 'product override keeps DR-01 on old pickers');
  const other = catalog.products.find((p) => p.category === 'premium-two-piece' && p.id !== 'DR-01');
  assert.ok(core.resolve(live.config, other));

  r = await call({ Token: 'tok-owner', action: 'rollback', version: 1 });
  assert.deepEqual([r.body.ok, r.body.version], [true, 3]);
  live = await pub();
  assert.equal(live.version, 3);
  assert.equal(live.config.categories['premium-two-piece'].enabled, false);
  assert.equal(live.config.templates['abaya-kids'], undefined);
  const v = (await call({ Token: 'tok-owner', action: 'versions' })).body.versions;
  assert.deepEqual(plain(v.map((x) => [x.version, x.active])), [[3, 1], [2, 0], [1, 0]]);
  const audit = db._db.prepare('SELECT action, actor FROM size_audit_log ORDER BY id').all().map((x) => x.action + ':' + x.actor);
  assert.deepEqual(audit, ['seed:seed', 'save_template:owner@example.com', 'save_template:owner@example.com', 'save_category:owner@example.com',
    'save_override:owner@example.com', 'publish:owner@example.com', 'publish:owner@example.com']);
  const body = JSON.stringify(await pub());
  assert.doesNotMatch(body, /owner@example\.com|audit|updated_by/, 'public config carries no admin data');
});

test('public config: no tables / no D1 → version 0 (old pickers everywhere); only GET', async () => {
  const { handleSizeConfig } = await lib('api/size-config.js');
  const get = (env, method = 'GET') => handleSizeConfig(new Request('https://muslimabaya.com/api/size-config', { method }), env);
  assert.deepEqual(await (await get({ STOCK_DB: fakeD1() })).json(), { ok: true, version: 0, config: null });
  assert.deepEqual(await (await get({})).json(), { ok: true, version: 0, config: null });
  assert.equal((await get({}, 'POST')).status, 405);
  const { handleSizeAdmin } = await lib('api/size-admin.js');
  const res = await handleSizeAdmin(new Request('https://muslimabaya.com/api/size-admin', { method: 'POST', body: '{}' }), {});
  assert.equal(res.status, 503);
});

test('Apps Script: SizeCore.gs is current; order check uses the template only when it is on', async () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/build-size-core.mjs'), '--check']);
  const { DEFAULT_TEMPLATES } = await lib('_lib/size-defaults.js');
  const templates = {};
  DEFAULT_TEMPLATES.forEach((t) => { templates[t.id] = t; });
  let config = null, fetches = 0, status = 200;
  const c = { console, Date, JSON, Number, String, Math, Array, Object, Error, isFinite,
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {} }) },
    UrlFetchApp: { fetch: (url) => { fetches++; assert.match(url, /^https:\/\/muslimabaya\.com\/api\/size-config\?/); return { getResponseCode: () => status, getContentText: () => JSON.stringify({ ok: true, version: config ? 5 : 0, config }) }; } } };
  vm.createContext(c);
  vm.runInContext(read('apps-script/SizeCore.gs'), c);
  vm.runInContext(read('apps-script/Operations.gs'), c);
  const p = plain(catalog.products.find((x) => x.id === 'DR-01'));
  const oldSize = 'Body 52 · Length 44 · Sleeve 19 · Palazzo 40';

  // Old cart line (no measurements): unchanged behaviour, no config fetch.
  let it = { id: p.id, qty: 1, price: 1, size: oldSize };
  assert.equal(c.opsLinePrice_(it, p), p.price);
  assert.equal(fetches, 0);
  assert.equal(it.measurements, undefined);

  // Category off: measurements are dropped and the old size check runs.
  config = { version: 5, categories: { 'premium-two-piece': { template: 'premium-two-piece', enabled: false } }, templates, products: {} };
  it = { id: p.id, qty: 1, price: 1, size: oldSize, measurements: [{ key: 'top', value: '52' }] };
  assert.equal(c.opsLinePrice_(it, p), p.price);
  assert.equal(it.measurements, undefined);
  assert.equal(it.size, oldSize);

  // Category on: server rebuilds size text from its own labels; the client's text is ignored.
  config.categories['premium-two-piece'].enabled = true;
  it = { id: p.id, qty: 2, price: 1, size: 'anything', measurements: [{ key: 'top', value: '52' }, { key: 'top_length', value: '44' }, { key: 'sleeve', value: '19' }, { key: 'bottom', value: '40' }] };
  assert.equal(c.opsLinePrice_(it, p), p.price * 2);
  assert.equal(it.size, 'জামা 52 · Top Length 44 · Sleeve Length 19 · পায়জামা / প্লাজু 40');
  assert.deepEqual([it.sizeTemplate, it.sizeConfigVersion], ['premium-two-piece', 5]);
  assert.throws(() => c.opsLinePrice_({ id: p.id, qty: 1, measurements: [{ key: 'top', value: '46' }, { key: 'top_length', value: '44' }, { key: 'bottom', value: '40' }] }, p), /INVALID_MEASUREMENT/, 'size the product never had');
  assert.throws(() => c.opsLinePrice_({ id: p.id, qty: 1, measurements: [{ key: 'top', value: '52' }] }, p), /MEASUREMENT_REQUIRED/);
  status = 500;
  assert.throws(() => c.opsLinePrice_({ id: p.id, qty: 1, measurements: [{ key: 'top', value: '52' }] }, p), /SIZE_CONFIG_UNAVAILABLE/);
});

test('Apps Script intake keeps measurements only when sent, capped and trimmed', () => {
  const src = read('apps-script/Code.gs');
  const start = src.indexOf('cartItems = parsedCart.map(');
  const end = src.indexOf('}).filter(function (it) { return it.id; });', start);
  assert.ok(start > 0 && end > start);
  const fn = new Function('parsedCart', 'var cartItems;' + src.slice(start, end) + '}).filter(function (it) { return it.id; }); return cartItems;');
  const [oldLine] = fn([{ id: 'A', name: 'n', qty: 1, price: 1, size: 'Body 42' }]);
  assert.equal('measurements' in oldLine, false, 'old carts are unchanged');
  const [line] = fn([{ id: 'A', qty: 1, measurements: Array.from({ length: 20 }, (_, i) => ({ key: 'k'.repeat(50) + i, value: 'v'.repeat(100) })) }]);
  assert.equal(line.measurements.length, 12);
  assert.equal(line.measurements[0].key.length, 40);
  assert.equal(line.measurements[0].value.length, 80);
});

test('website never ships migrations; routes and prune list agree', async () => {
  const { BLOCKED_DIRS } = await lib('_lib/blocked-paths.js');
  assert.ok(BLOCKED_DIRS.includes('migrations'));
  assert.ok(JSON.parse(read('_routes.json')).include.includes('/migrations/*'));
  assert.match(read('scripts/prune-deploy.mjs'), /'migrations'/);
  assert.doesNotMatch(read('functions/api/size-config.js') + read('size-core.js'), /SERVICE_ROLE|GOOGLE_SA_JSON|private_key/);
});
