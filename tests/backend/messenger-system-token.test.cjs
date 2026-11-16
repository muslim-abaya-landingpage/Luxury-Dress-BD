// Messenger: one Meta Business System User token (expiry "Never") fills every Page token; never echoes a token.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8');
const setup = fs.readFileSync(path.join(__dirname, '../../apps-script/SetupStatus.gs'), 'utf8');
const pick = (src, name) => { const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}', 'm')); assert.ok(m, name); return m[0]; };
const pagesBlock = code.slice(code.indexOf('var MSGR_PAGES = {'), code.indexOf('};', code.indexOf('var MSGR_PAGES = {')) + 2);

function load(graph) {
  const props = {}; const calls = [];
  const ctx = {
    JSON, String, Number, Object, Date, encodeURIComponent,
    MSGR_PAGE_ID: '964928770039259',
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    Utilities: { formatDate: (d) => d.toISOString().slice(0, 10) },
    UrlFetchApp: { fetch: (url, opt) => { calls.push([url, opt.headers.Authorization]); const r = graph(url); return { getResponseCode: () => r[0], getContentText: () => JSON.stringify(r[1]) }; } },
    verifyAdminSession_: (t) => (t === 'owner' ? { ok: true } : { ok: false, error: 'NOT_LOGGED_IN' }),
    requireOwnerAdmin_: () => null,
    param_: (e, k) => e.parameter[k],
  };
  vm.runInNewContext(pagesBlock + '\n' + ['msgrGraphGet_', 'msgrPagesFromSystemToken_', 'msgrStoreSystemPages_', 'saveMessengerSystemToken_', 'msgrRefreshFromSystemToken_', 'saveMessengerPageToken_'].map((n) => pick(setup, n)).join('\n') + '\nthis.save = saveMessengerPageToken_; this.refresh = msgrRefreshFromSystemToken_;', ctx);
  return { ctx, props, calls };
}
const SYS = 'EAAsystemusertoken1234567890';
const graphOk = (url) => {
  if (/\/me\?fields=id,name/.test(url)) return [200, { id: '100099', name: 'Inbox Bot' }];
  if (/\/me\/accounts/.test(url)) return [200, { data: [
    { id: '381729145014885', name: 'Muslim Abaya', access_token: 'PAGE_MA' },
    { id: '1373328422533938', name: 'Luluatun Noor', access_token: 'PAGE_LN' },
    { id: '999', name: 'Someone else', access_token: 'PAGE_X' }] }];
  if (/debug_token/.test(url)) return [200, { data: { expires_at: 0 } }];
  return [404, {}];
};

test('system user token: each assigned Page gets its own token; reply names Pages and never contains a token', () => {
  const { ctx, props, calls } = load(graphOk);
  const r = ctx.save({ parameter: { Token: 'owner', PageId: 'system', AccessToken: SYS } });
  assert.equal(r.ok, true);
  assert.equal(props.MSGR_PAGE_TOKEN_381729145014885, 'PAGE_MA');
  assert.equal(props.MSGR_PAGE_TOKEN_1373328422533938, 'PAGE_LN');
  assert.equal(props.MSGR_PAGE_TOKEN_999, undefined);
  assert.equal(props.MSGR_SYSTEM_TOKEN, SYS);
  assert.deepEqual([...r.saved], ['Muslim Abaya', 'Luluatun Noor']);
  assert.match(r.message, /কখনো শেষ হবে না/);
  assert.doesNotMatch(JSON.stringify(r), /PAGE_MA|PAGE_LN|EAAsystem/);
  assert.ok(calls.every((c) => c[1] === 'Bearer ' + SYS));
  assert.ok(calls.every((c) => !c[0].includes('access_token=')));
});

test('a Page token pasted as "all Pages" is refused and nothing is stored', () => {
  const { ctx, props } = load((url) => (/\/me\?/.test(url) ? [200, { id: '381729145014885', name: 'Muslim Abaya' }] : graphOk(url)));
  const r = ctx.save({ parameter: { Token: 'owner', PageId: 'system', AccessToken: SYS } });
  assert.equal(r.error, 'NOT_SYSTEM_TOKEN');
  assert.deepEqual(props, {});
});

test('no Page assigned to the system user / bad token / not logged in: nothing stored', () => {
  let t = load((url) => (/me\/accounts/.test(url) ? [200, { data: [] }] : graphOk(url)));
  assert.equal(t.ctx.save({ parameter: { Token: 'owner', PageId: 'system', AccessToken: SYS } }).error, 'NO_PAGES_ASSIGNED');
  assert.deepEqual(t.props, {});
  t = load(() => [400, { error: { message: 'Invalid OAuth access token' } }]);
  assert.equal(t.ctx.save({ parameter: { Token: 'owner', PageId: 'system', AccessToken: SYS } }).error, 'FACEBOOK_TOKEN_INVALID');
  t = load(graphOk);
  assert.equal(t.ctx.save({ parameter: { Token: 'nobody', PageId: 'system', AccessToken: SYS } }).ok, false);
  assert.equal(t.calls.length, 0);
});

test('refresh fetches the Page tokens again from the stored system token', () => {
  const { ctx, props } = load(graphOk);
  assert.match(ctx.refresh(), /বসানো নেই/);
  props.MSGR_SYSTEM_TOKEN = SYS;
  assert.match(ctx.refresh(), /নতুন করে আনা হয়েছে: Muslim Abaya, Luluatun Noor/);
  assert.equal(props.MSGR_PAGE_TOKEN_381729145014885, 'PAGE_MA');
});

function loadHealth(graph, props) {
  const alerts = []; const cache = {};
  const ctx = {
    JSON, String, Number, Object, Date, Math, encodeURIComponent,
    MSGR_PAGE_ID: '964928770039259',
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; }, remove: (k) => { delete cache[k]; } }) },
    Utilities: { formatDate: (d, tz, f) => (f === 'yyyy-MM-dd' ? new Date(d.getTime() + 6 * 3600000).toISOString().slice(0, 10) : d.toISOString()) },
    UrlFetchApp: { fetch: (url, opt) => { const r = graph(url, opt.headers.Authorization.replace('Bearer ', '')); return { getResponseCode: () => r[0], getContentText: () => JSON.stringify(r[1]) }; } },
    monitorNotify_: (subject, body) => alerts.push([subject, body]),
  };
  vm.runInNewContext(pagesBlock + '\n' + ['msgrGraphGet_', 'msgrPagesFromSystemToken_', 'msgrStoreSystemPages_', 'msgrRefreshFromSystemToken_', 'messengerPageTokenStatus_', 'msgrTokenHealth_', 'messengerTokenDailyCheck_'].map((n) => pick(setup, n)).join('\n') +
    '\nvar MSGR_HEALTH_WARN_DAYS_ = 14;\nthis.status = messengerPageTokenStatus_; this.daily = messengerTokenDailyCheck_;', ctx);
  return { ctx, alerts, props };
}

test('token health: never-expiring, expiring soon and revoked Page tokens are shown without revealing them', () => {
  const soon = Math.floor(Date.now() / 1000) + 5 * 86400;
  const props = { MSGR_PAGE_TOKEN_381729145014885: 'T_NEVER', MSGR_PAGE_SOURCE_381729145014885: 'manual', MSGR_PAGE_TOKEN_1373328422533938: 'T_SOON', MSGR_PAGE_TOKEN_1343804848819482: 'T_DEAD', MSGR_PAGE_SOURCE_1343804848819482: 'system' };
  const { ctx } = loadHealth((url, tok) => (tok === 'T_DEAD' ? [400, { error: { message: 'Session has expired' } }] : [200, { data: { is_valid: true, expires_at: tok === 'T_SOON' ? soon : 0 } }]), props);
  const rows = Object.fromEntries(ctx.status({ getProperty: (k) => props[k] || null }).map((r) => [r.id, r]));
  assert.equal(rows['381729145014885'].health.state, 'ok'); assert.equal(rows['381729145014885'].health.expires, 'never'); assert.equal(rows['381729145014885'].source, 'manual');
  assert.equal(rows['1373328422533938'].health.state, 'warn');
  assert.equal(rows['1343804848819482'].health.state, 'bad'); assert.equal(rows['1343804848819482'].source, 'system');
  assert.equal(rows['258170054039575'].configured, false);
  assert.doesNotMatch(JSON.stringify(rows), /T_NEVER|T_SOON|T_DEAD/);
});

test('daily check: alerts once for a broken token, not again the same day or while still broken, and says when fixed', () => {
  const props = { MSGR_PAGE_TOKEN_381729145014885: 'T_DEAD' };
  let dead = true;
  const { ctx, alerts } = loadHealth((url, tok) => (dead ? [400, { error: { message: 'Session has expired' } }] : [200, { data: { is_valid: true, expires_at: 0 } }]), props);
  const p = { getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } };
  assert.equal(ctx.daily(p), 'PROBLEMS 1');
  assert.equal(alerts.length, 1); assert.match(alerts[0][0], /Token সমস্যা/); assert.match(alerts[0][1], /Muslim Abaya: বাতিল/);
  assert.equal(ctx.daily(p), 'SKIP'); // same day
  props.MSGR_HEALTH_DAY = 'yesterday';
  ctx.daily(p); assert.equal(alerts.length, 1); // still broken: no repeat
  dead = false; props.MSGR_HEALTH_DAY = 'yesterday';
  assert.equal(ctx.daily(p), 'OK'); assert.equal(alerts.length, 2); assert.match(alerts[1][0], /আবার ঠিক/);
});

test('daily check: a broken System-User Page token is fetched again before anyone is alerted', () => {
  const props = { MSGR_PAGE_TOKEN_381729145014885: 'OLD', MSGR_SYSTEM_TOKEN: 'SYS' };
  const { ctx, alerts } = loadHealth((url, tok) => {
    if (/debug_token/.test(url)) return tok === 'OLD' ? [400, { error: { message: 'expired' } }] : [200, { data: { is_valid: true, expires_at: 0 } }];
    if (/\/me\?fields/.test(url)) return [200, { id: '1', name: 'bot' }];
    if (/me\/accounts/.test(url)) return [200, { data: [{ id: '381729145014885', access_token: 'NEW' }] }];
    return [404, {}];
  }, props);
  assert.equal(ctx.daily({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }), 'OK');
  assert.equal(props.MSGR_PAGE_TOKEN_381729145014885, 'NEW');
  assert.equal(alerts.length, 0);
});
