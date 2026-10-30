// Size Manager admin page (admin-sizes.html) against the real /api/size-admin and /api/size-config handlers,
// running here on a node:sqlite copy of the D1 tables (migrations/d1). Nothing goes to Cloudflare or Google.
const { test, expect } = require('@playwright/test');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const root = path.resolve(__dirname, '../..');
const lib = (f) => import(path.join(root, 'functions', f));
const NOW = Date.now();

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
  ['0001_size_manager.sql', '0002_size_manager_seed.sql'].forEach((f) => db.exec(fs.readFileSync(path.join(root, 'migrations/d1', f), 'utf8')));
  return {
    prepare: (sql) => stmt(sql),
    batch: async (list) => { db.exec('BEGIN'); try { list.forEach((s) => s._run()); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } return []; },
    _db: db,
  };
}

/** Google service-account + admin sheet stand-ins, so the real owner check runs (as in tests/backend). */
async function ownerAuth() {
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
      ['tok-owner', 'owner@example.com', '01700000000', 'Owner', serial(new Date(NOW - 3600000)), serial(new Date(Date.UTC(2100, 0, 1))), 'admin']],
    Admins: [['Email', 'Phone', 'Name', 'PasswordHash', 'Salt', 'Status', 'CreatedAt', 'Role', 'UpdatedAt'],
      ['owner@example.com', '01700000000', 'Owner', 'h', 's', 'active', serial(new Date(NOW - 9e9)), 'admin']],
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
  return { sa, fakeFetch };
}

async function setup(page, { token = 'tok-owner', role = 'admin' } = {}) {
  const { handleSizeAdmin } = await lib('api/size-admin.js');
  const { handleSizeConfig } = await lib('api/size-config.js');
  const db = fakeD1();
  const { sa, fakeFetch } = await ownerAuth();
  const env = { GOOGLE_SA_JSON: sa, SHEET_ID: 'S', STOCK_DB: db };
  const toRoute = async (route, res) => route.fulfill({ status: res.status, contentType: 'application/json', body: await res.text() });
  await page.route('**/api/size-admin', async (route) => {
    const req = route.request();
    const res = await handleSizeAdmin(new Request('http://127.0.0.1/api/size-admin', { method: req.method(), body: req.postData() || undefined }), env, { fetch: fakeFetch });
    await toRoute(route, res);
  });
  await page.route('**/api/size-config*', async (route) => toRoute(route, await handleSizeConfig(new Request('http://127.0.0.1/api/size-config'), env)));
  // Login checks by the shared admin code never leave the test.
  await page.route('**/api/admin-read', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, role, token, email: 'owner@example.com' }) }));
  await page.route('https://script.google.com/**', (route) => route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, role, token, email: 'owner@example.com' }) }));
  await page.addInitScript(({ token, role }) => {
    localStorage.setItem('ma_admin_session', JSON.stringify({ token, role, email: 'owner@example.com', expires: Date.now() + 3600000 }));
    sessionStorage.setItem('ma_admin_verified_at', JSON.stringify({ token, at: Date.now() }));
  }, { token, role });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { db, errors };
}

const acceptDialogs = (page, promptValue) => page.on('dialog', (d) => d.accept(promptValue));

test('owner edits categories, templates and overrides in the draft, publishes and rolls back', async ({ page }) => {
  const { db, errors } = await setup(page);
  acceptDialogs(page, 'abaya-kids');
  await page.goto('/admin-sizes.html');
  await expect(page.locator('#szStatus')).toContainText('খসড়া লোড হয়েছে');
  await expect(page.locator('#szCategoryRows tr')).toHaveCount(8);
  await expect(page.locator('#szCategoryRows')).not.toContainText(/kaftan|karchupi/i);
  await expect(page.locator('#szPending')).toContainText('একই');

  // Switch abaya on: draft only, customers still on version 1.
  await page.locator('tr[data-cat="abaya"] [data-cat-enabled]').check();
  await expect(page.locator('#szStatus')).toContainText('সংরক্ষিত');
  await expect(page.locator('#szPending')).toContainText('প্রকাশ হয়নি');
  expect(db._db.prepare("SELECT enabled FROM size_category_settings WHERE category_key='abaya'").get().enabled).toBe(1);
  expect(JSON.parse(db._db.prepare('SELECT snapshot_json FROM size_config_versions WHERE active=1').get().snapshot_json).categories.abaya.enabled).toBe(false);

  // Template editor: rename জামা → কামিজ, move it down, add a field with a quick range; preview follows.
  await page.locator('#szTabTemplates').click();
  await page.locator('#szTemplatePick').selectOption('premium-two-piece');
  const first = page.locator('#szFields li.sz-field').first();
  await expect(first.locator('[data-f="key"]')).toHaveAttribute('readonly', '');
  await expect(first.locator('[data-remove]')).toHaveCount(0);
  await first.locator('[data-f="label_bn"]').fill('কামিজ');
  await expect(page.locator('#szTplPreview')).toContainText('কামিজ');
  await first.locator('[data-move="1"]').click();
  await expect(page.locator('#szFields li.sz-field').nth(1).locator('[data-f="label_bn"]')).toHaveValue('কামিজ');
  await page.locator('#szFieldAdd').click();
  const added = page.locator('#szFields li.sz-field').last();
  await added.locator('[data-f="label_bn"]').fill('কোমর');
  await added.locator('[data-f="label_en"]').fill('Waist');
  await added.locator('[data-f="key"]').fill('waist');
  await added.locator('[data-f="required"]').uncheck();
  await added.locator('[data-r="from"]').fill('26');
  await added.locator('[data-r="to"]').fill('34');
  await added.locator('[data-range]').click();
  await expect(page.locator('#szFields li.sz-field').last().locator('[data-f="options"]')).toHaveValue('26\n28\n30\n32\n34');
  await page.locator('#szTemplateSave').click();
  await expect(page.locator('#szTemplateMsg')).toContainText('সংরক্ষিত');
  const saved = db._db.prepare("SELECT key, label_bn FROM size_fields WHERE template_id='premium-two-piece' ORDER BY sort_order").all().map((r) => r.key + ':' + r.label_bn);
  expect(saved.slice(0, 2)).toEqual(['top_length:', 'top:কামিজ']);
  expect(saved[saved.length - 1]).toBe('waist:কোমর');

  // Server refuses a default that customers could not submit; the message is in Bangla.
  await page.locator('#szFields li.sz-field').first().locator('[data-f="default"]').fill('99');
  await page.locator('#szTemplateSave').click();
  await expect(page.locator('#szTemplateMsg')).toContainText('ডিফল্ট মান');

  // Duplicate abaya as abaya-kids (prompt answered above).
  await page.locator('#szRefresh').click();
  await page.locator('#szTemplatePick').selectOption('abaya');
  await page.locator('#szTemplateDuplicate').click();
  await expect(page.locator('#szStatus')).toContainText('কপি');
  await expect(page.locator('#szTemplatePick')).toHaveValue('abaya-kids');

  // Product override: DR-01 stays on old sizes even when its category is switched on.
  await page.locator('#szTabProducts').click();
  await page.locator('#szProductSearch').fill('DR-01');
  await page.locator('#szProductSearch').dispatchEvent('change');
  await expect(page.locator('#szOverrideTitle')).toContainText('DR-01');
  await expect(page.locator('#szOvPreview')).toContainText('ক্যাটাগরি এখন বন্ধ');
  await page.locator('#szOvMode').selectOption('off');
  await page.locator('#szOverrideForm button[type="submit"]').click();
  await expect(page.locator('#szOverrideMsg')).toContainText('সংরক্ষিত');
  await expect(page.locator('#szOverrideRows')).toContainText('বন্ধ (পুরনো সাইজ)');

  // Publish → version 2 is what the website gets; roll back → version 3 equals version 1.
  await page.locator('#szTabPublish').click();
  await page.locator('#szPublishNote').fill('আবায়া চালু');
  await page.locator('#szPublishBtn').click();
  await expect(page.locator('#szPublishMsg')).toContainText('সংস্করণ 2 প্রকাশিত');
  await expect(page.locator('#szPending')).toContainText('একই');
  let live = await page.evaluate(() => fetch('/api/size-config').then((r) => r.json()));
  expect([live.version, live.config.categories.abaya.enabled, live.config.products['DR-01'].enabled]).toEqual([2, true, false]);
  await page.locator('[data-rollback="1"]').click();
  await expect(page.locator('#szPublishMsg')).toContainText('নতুন সংস্করণ 3');
  live = await page.evaluate(() => fetch('/api/size-config').then((r) => r.json()));
  expect([live.version, live.config.categories.abaya.enabled]).toEqual([3, false]);
  expect(errors).toEqual([]);
});

test('staff cannot use the page', async ({ page }) => {
  const { errors } = await setup(page, { token: 'tok-staff', role: 'staff' });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/admin-sizes.html');
  await expect(page.locator('#szStatus')).toContainText('শুধু মূল অ্যাডমিন');
  await expect(page.locator('#szCategories')).toBeHidden();
  expect(errors).toEqual([]);
});

test('phone layout fits the screen', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/admin-sizes.html');
  await expect(page.locator('#szCategoryRows tr')).toHaveCount(8);
  await page.locator('#szTabTemplates').click();
  await expect(page.locator('#szFields li.sz-field').first()).toBeVisible();
  let overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.locator('#szTabProducts').click();
  await page.locator('#szProductSearch').fill('DR-01');
  await page.locator('#szProductSearch').dispatchEvent('change');
  await expect(page.locator('#szOvFields fieldset').first()).toBeVisible();
  overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
