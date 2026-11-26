// Admin → SMS গেটওয়ে সেটিংস: scaffold-only storage for the owner's future (paid) SMS
// gateway credentials. Never sends anything and never masks except the API key.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../../apps-script/SetupStatus.gs'), 'utf8');

function load(props, opts) {
  opts = opts || {};
  const ctx = {
    JSON, String, Number, Object, isFinite, console: { warn() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; } }) },
    verifyAdminSession_: (t) => (t === 'owner' || t === 'staff' ? { ok: true, role: t === 'owner' ? 'admin' : 'staff', isOwner: t === 'owner' } : { ok: false, error: 'NOT_LOGGED_IN' }),
    requireOwnerAdmin_: (v) => (opts.owner === false ? { ok: false, error: 'OWNER_ONLY' } : null),
    param_: (e, k) => (e && e.parameter ? e.parameter[k] : undefined),
    admCellText_: (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, n || 500),
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}

test('sms settings: defaults are empty and disabled, no key stored', () => {
  const ctx = load({});
  const res = ctx.getAdminSmsSettings_({ parameter: { Token: 'owner' } });
  assert.equal(res.ok, true);
  assert.equal(res.settings.enabled, false);
  assert.equal(res.settings.provider, '');
  assert.equal(res.hasKey, false);
  assert.equal(res.settings.apiKey, undefined, 'raw key must never be returned');
});

test('sms settings: save persists fields and masks the key in the response', () => {
  const props = {};
  const ctx = load(props);
  const save = ctx.saveAdminSmsSettings_({ parameter: { Token: 'owner', Enabled: '1', Provider: 'BulkSMSBD', SenderId: '8809xxxxxxx', ApiUrl: 'https://api.example.com/send', ApiKey: 'supersecretkey1234' } });
  assert.equal(save.ok, true);
  assert.equal(save.settings.enabled, true);
  assert.equal(save.settings.provider, 'BulkSMSBD');
  assert.equal(save.hasKey, true);
  assert.equal(save.settings.apiKeyHint, '•••1234');
  assert.equal(save.settings.apiKey, undefined, 'raw key must never be returned');
  const stored = JSON.parse(props.SMS_GATEWAY_SETTINGS_JSON);
  assert.equal(stored.apiKey, 'supersecretkey1234', 'only the stored copy keeps the full key');
});

test('sms settings: blank ApiKey on save leaves the previously stored key unchanged', () => {
  const props = {};
  const ctx = load(props);
  ctx.saveAdminSmsSettings_({ parameter: { Token: 'owner', Provider: 'Greenweb', ApiKey: 'firstkey9999' } });
  const second = ctx.saveAdminSmsSettings_({ parameter: { Token: 'owner', Provider: 'Greenweb', SenderId: 'MuslimAbaya', ApiKey: '' } });
  assert.equal(second.ok, true);
  assert.equal(second.settings.senderId, 'MuslimAbaya');
  assert.equal(second.hasKey, true);
  const stored = JSON.parse(props.SMS_GATEWAY_SETTINGS_JSON);
  assert.equal(stored.apiKey, 'firstkey9999', 'key kept from the earlier save');
});

test('sms settings: staff can neither view nor save (API key is owner-only)', () => {
  const ctx = load({}, { owner: false });
  const save = ctx.saveAdminSmsSettings_({ parameter: { Token: 'staff', Provider: 'X' } });
  assert.equal(save.ok, false);
  assert.equal(save.error, 'OWNER_ONLY');
  const view = ctx.getAdminSmsSettings_({ parameter: { Token: 'staff' } });
  assert.equal(view.ok, false);
  assert.equal(view.error, 'OWNER_ONLY');
});

test('sms settings: requires a valid session', () => {
  const ctx = load({});
  assert.equal(ctx.getAdminSmsSettings_({ parameter: { Token: 'bad' } }).ok, false);
  assert.equal(ctx.saveAdminSmsSettings_({ parameter: { Token: 'bad' } }).ok, false);
});
