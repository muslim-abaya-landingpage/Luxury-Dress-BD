// Weekly Meta audience sync (apps-script/AudienceSync.gs) against a simulated Graph API.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const read = (f) => fs.readFileSync(path.join(__dirname, '../../apps-script', f), 'utf8');
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function orderRow(day, name, phone, status) {
  const r = new Array(13).fill('');
  r[0] = day; r[1] = name; r[2] = phone; r[7] = 1000; r[9] = status;
  return r;
}

function setup({ scopes = ['ads_management', 'pages_messaging'], accounts = [{ account_id: '111', name: 'Muslim Abaya' }], token = 'SYS', props = {} } = {}) {
  const store = Object.assign({}, token ? { MSGR_SYSTEM_TOKEN: token } : {}, props);
  const calls = [];
  const audiences = {};
  let next = 900;
  const triggers = [];
  const ctx = {
    String, Number, Object, Array, Math, Date, parseInt, isFinite, JSON, encodeURIComponent,
    Utilities: {
      formatDate: (d) => d.toISOString().slice(0, 10),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_a, text) => Array.from(crypto.createHash('sha256').update(text, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in store ? store[k] : null), setProperty: (k, v) => { store[k] = String(v); }, deleteProperty: (k) => { delete store[k]; } }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(), deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1),
      WeekDay: { SATURDAY: 'SAT' },
      newTrigger: (fn) => ({ timeBased: () => ({ onWeekDay: () => ({ atHour: () => ({ create: () => triggers.push({ getHandlerFunction: () => fn }) }) }) }) }),
    },
    UrlFetchApp: {
      fetch: (url, opt) => {
        const p = url.replace('https://graph.facebook.com/v25.0/', '');
        const body = opt.payload ? JSON.parse(opt.payload) : null;
        calls.push({ method: opt.method, path: p, body, auth: opt.headers.Authorization });
        const reply = (code, obj) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(obj) });
        if (p.startsWith('debug_token')) return reply(200, { data: { scopes } });
        if (p.startsWith('me/adaccounts')) return reply(200, { data: accounts });
        if (/^act_\d+\/customaudiences$/.test(p)) { const id = String(next++); audiences[id] = body.name; return reply(200, { id }); }
        if (/^\d+\?fields=id$/.test(p)) { const id = p.split('?')[0]; return audiences[id] ? reply(200, { id }) : reply(400, { error: { message: 'gone' } }); }
        if (/^\d+\/usersreplace$/.test(p)) return reply(200, { num_received: body.payload.data.length });
        return reply(404, { error: { message: 'unexpected ' + p } });
      },
    },
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => ({ getLastRow: () => 4 }) }) },
  };
  vm.createContext(ctx);
  vm.runInContext(read('AdminOrders.gs'), ctx);
  vm.runInContext(read('AdminAudience.gs'), ctx);
  vm.runInContext(read('AudienceSync.gs'), ctx);
  Object.assign(ctx, {
    verifyAdminSession_: (t) => (t === 'tok' ? { ok: true, role: 'admin' } : { ok: false, error: 'INVALID_TOKEN' }),
    requireOwnerAdmin_: (v) => (v.role === 'admin' ? null : { ok: false, error: 'OWNER_ONLY' }),
    param_: (e, k) => (e.parameter[k] == null ? '' : e.parameter[k]),
    normalizePhone_: (p) => String(p || '').replace(/\D/g, '').slice(-11),
    dayKeyFromCell_: (v) => String(v || '').slice(0, 10),
    readOnlineOrderRows_: () => [
      orderRow(new Date().toISOString(), 'Rina Akter', '01711111111', 'Delivered'),
      orderRow(new Date().toISOString(), 'Faker', '01733333333', 'Fake'),
      orderRow(new Date().toISOString(), 'Nusrat', '01744444444', 'Pending'),
    ],
    admBlockedMap_: () => ({}),
    ensureAbandonedCartsSheet_: () => ({ getDataRange: () => ({ getValues: () => [['Phone']] }) }),
  });
  const call = (fn, params = {}) => JSON.parse(JSON.stringify(ctx[fn]({ parameter: Object.assign({ Token: 'tok' }, params) })));
  return { ctx, store, calls, audiences, triggers, call };
}

test('status explains what is missing and never returns the token', () => {
  const noAds = setup({ scopes: ['pages_messaging'] }).call('adminAudienceSyncStatus_');
  assert.equal(noAds.ready, false);
  assert.match(noAds.message, /ads_management/);
  assert.ok(!JSON.stringify(noAds).includes('SYS'));
  const noToken = setup({ token: '' }).call('adminAudienceSyncStatus_');
  assert.equal(noToken.ready, false);
  const ok = setup().call('adminAudienceSyncStatus_');
  assert.equal(ok.ready, true);
  assert.deepEqual(ok.accounts, [{ id: '111', name: 'Muslim Abaya' }]);
});

test('save only accepts a reachable ad account and manages the weekly trigger', () => {
  const s = setup();
  assert.equal(s.call('adminAudienceSyncSave_', { Account: '999', Weekly: '1' }).error, 'BAD_ACCOUNT');
  assert.equal(s.call('adminAudienceSyncSave_', { Account: 'act_111', Weekly: '1' }).ok, true);
  assert.equal(s.store.AUDIENCE_SYNC_ACCOUNT, '111');
  assert.equal(s.triggers.length, 1);
  s.call('adminAudienceSyncSave_', { Account: '111', Weekly: '0' });
  assert.equal(s.triggers.length, 0);
});

test('run creates the audiences once and replaces members with hashed phone, name and country', () => {
  const s = setup({ props: { AUDIENCE_SYNC_ACCOUNT: '111' } });
  const r = s.call('adminAudienceSyncRun_');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.last.counts, { buyers: 1, repeat: 0, all: 2, abandoned: 0, exclude: 1 });
  assert.equal(Object.keys(s.audiences).length, 5);
  const buyers = s.calls.find((c) => c.path.endsWith('/usersreplace') && c.body.payload.data.length === 1 && c.body.payload.data[0][0] === sha('8801711111111'));
  assert.ok(buyers, 'buyers upload');
  assert.deepEqual(buyers.body.payload.schema, ['PHONE', 'FN', 'COUNTRY']);
  assert.deepEqual(buyers.body.payload.data[0], [sha('8801711111111'), sha('rina'), sha('bd')]);
  assert.ok(s.calls.every((c) => c.auth === 'Bearer SYS'));
  assert.ok(!s.calls.some((c) => JSON.stringify(c.body || {}).includes('01711111111')), 'no plain phone sent');
  // Second run reuses the same audiences; empty lists are not uploaded.
  s.call('adminAudienceSyncRun_');
  assert.equal(s.calls.filter((c) => /customaudiences$/.test(c.path)).length, 5);
});

test('an audience deleted in Ads Manager is made again on the next run', () => {
  const s = setup({ props: { AUDIENCE_SYNC_ACCOUNT: '111', AUDIENCE_SYNC_IDS: JSON.stringify({ buyers: '555' }) } });
  s.call('adminAudienceSyncRun_');
  const ids = JSON.parse(s.store.AUDIENCE_SYNC_IDS);
  assert.notEqual(ids.buyers, '555');
});
