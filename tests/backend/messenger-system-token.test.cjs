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
