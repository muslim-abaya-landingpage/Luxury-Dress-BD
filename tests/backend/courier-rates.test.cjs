// Admin → Setup courier-rate table: the owner enters the rates their own Pathao/RedX accounts
// quote; admin-order.html only ever shows a number that was actually typed in, never a guess.
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
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx;
}

test('courier rates: defaults have Steadfast filled, Pathao/RedX blank until the owner enters them', () => {
  const ctx = load({});
  const res = ctx.getAdminCourierRates_({ parameter: { Token: 'owner' } });
  assert.equal(res.ok, true);
  assert.equal(res.rates.steadfastInside, 80);
  assert.equal(res.rates.steadfastOutside, 150);
  assert.equal(res.rates.pathaoInside, '');
  assert.equal(res.rates.redxOutside, '');
});

test('courier rates: save validates, rounds out of range to blank, and persists', () => {
  const props = {};
  const ctx = load(props);
  const save = ctx.saveAdminCourierRates_({ parameter: { Token: 'owner', steadfastInside: '70', steadfastOutside: '130', pathaoInside: '65', pathaoOutside: '120', redxInside: '-5', redxOutside: '9999' } });
  assert.equal(save.ok, true);
  assert.equal(save.rates.pathaoInside, 65);
  assert.equal(save.rates.redxInside, '', 'negative rejected');
  assert.equal(save.rates.redxOutside, '', 'absurdly large rejected');
  const stored = JSON.parse(props.COURIER_RATES_JSON);
  assert.equal(stored.pathaoOutside, 120);
  const reread = ctx.getAdminCourierRates_({ parameter: { Token: 'owner' } });
  assert.equal(reread.rates.steadfastInside, 70);
});

test('courier rates: staff cannot save; anyone logged in can view', () => {
  const ctx = load({}, { owner: false });
  const save = ctx.saveAdminCourierRates_({ parameter: { Token: 'staff', pathaoInside: '60' } });
  assert.equal(save.ok, false);
  assert.equal(save.error, 'OWNER_ONLY');
  const view = ctx.getAdminCourierRates_({ parameter: { Token: 'staff' } });
  assert.equal(view.ok, true);
});

test('courier rates: requires a valid session', () => {
  const ctx = load({});
  assert.equal(ctx.getAdminCourierRates_({ parameter: { Token: 'bad' } }).ok, false);
  assert.equal(ctx.saveAdminCourierRates_({ parameter: { Token: 'bad' } }).ok, false);
});
