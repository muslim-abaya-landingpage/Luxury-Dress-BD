// Delivery charge from Product Manager → Store settings (SITE_LINKS.delivery in product-config.js).
// The website (maDelivery), the price-check file (catalog-validation.json) and the order server
// (Apps Script opsDeliveryCharge_) must give the same charge for every district and quantity,
// or orders would fail with PRICE_CHANGED or charge the wrong amount.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

function site(delivery) {
  const ctx = { console };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('product-config.js'), ctx);
  if (delivery !== undefined) ctx.SITE_LINKS.delivery = delivery;
  vm.runInContext(read('product-utils.js'), ctx);
  vm.runInContext(read('catalog-validation-core.js'), ctx);
  return ctx;
}

function server(validationDelivery) {
  const src = read('apps-script/Code.gs');
  const grab = (name) => {
    const i = src.indexOf('function ' + name + '(');
    if (i < 0) throw new Error('missing ' + name);
    let depth = 0;
    for (let k = src.indexOf('{', i); k < src.length; k++) {
      if (src[k] === '{') depth++;
      else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
    }
    throw new Error('missing ' + name);
  };
  const ctx = vm.createContext({ opsCatalog_: () => ({ delivery: validationDelivery }) });
  vm.runInContext(['opsDeliverySettings_', 'opsDeliveryCharge_', 'getDistrictChargeMap_'].map(grab).join('\n'), ctx);
  return ctx;
}

const DISTRICTS = ['ঢাকা', 'গাজীপুর', 'সিলেট', 'চট্টগ্রাম'];

for (const [label, delivery] of [
  ['defaults (no settings saved yet)', undefined],
  ['custom charges', { dhaka: 70, outside: 120, freeQty: 4 }],
  ['free delivery switched off', { dhaka: 60, outside: 130, freeQty: 0 }],
  ['free delivery for everything', { dhaka: 0, outside: 0, freeQty: 1 }],
]) {
  test('website and order server agree: ' + label, () => {
    const w = site(delivery);
    const validation = w.__maValidationDelivery(w); // what goes into catalog-validation.json
    const s = server(validation);
    for (const d of DISTRICTS) for (let qty = 1; qty <= 6; qty++) {
      assert.equal(s.opsDeliveryCharge_(d, qty), w.maDelivery.fee(d, qty), d + ' × ' + qty);
    }
  });
}

test('defaults are 80 / 150 / free from 3 pieces', () => {
  const w = site(undefined);
  assert.deepEqual({ ...w.maDelivery.settings() }, { dhaka: 80, outside: 150, freeQty: 3 });
  assert.equal(w.maDelivery.fee('ঢাকা', 1), 80);
  assert.equal(w.maDelivery.fee('সিলেট', 2), 150);
  assert.equal(w.maDelivery.fee('সিলেট', 3), 0);
  assert.equal(w.maDelivery.fee('', 1), null);
  assert.equal(w.maDelivery.hintBn(), 'ঢাকা ৳80 · ঢাকার বাইরে ৳150 · 3টি বা বেশি পণ্যে ফ্রি ডেলিভারি');
});

test('bad values in the settings fall back to the defaults instead of breaking checkout', () => {
  const w = site({ dhaka: 'abc', outside: -5, freeQty: 500 });
  assert.deepEqual({ ...w.maDelivery.settings() }, { dhaka: 80, outside: 150, freeQty: 3 });
  const s = server({ dhaka: 'abc', outside: -5, freeQty: 500 });
  assert.deepEqual({ ...s.opsDeliverySettings_() }, { dhaka: 80, outside: 150, freeQty: 3 });
});

test('order server keeps working (defaults) when the price-check file cannot be read', () => {
  const src = read('apps-script/Code.gs');
  const body = (n) => { const i = src.indexOf('function ' + n + '('); let d = 0; for (let k = src.indexOf('{', i); ; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
  const ctx = vm.createContext({ opsCatalog_: () => { throw new Error('CATALOG_UNAVAILABLE'); } });
  vm.runInContext(body('opsDeliverySettings_') + body('opsDeliveryCharge_'), ctx);
  assert.equal(ctx.opsDeliveryCharge_('ঢাকা', 1), 80);
  assert.equal(ctx.opsDeliveryCharge_('বরিশাল', 3), 0);
});

test('the price-check file built for the website carries the delivery settings', () => {
  const v = JSON.parse(read('catalog-validation.json'));
  assert.deepEqual(v.delivery, { dhaka: 80, outside: 150, freeQty: 3 });
});

test('Store settings search words: every word in a line finds the same products', () => {
  const w = site(undefined);
  w.SITE_LINKS.searchWords = ['গাউন, gown, maxi'];
  const shop = { gowns: [{ id: 'G1', name: 'Royal Maxi Dress', price: 900, status: 'publish' }], abaya: [{ id: 'A1', name: 'Maroon Abaya Set', price: 1200, status: 'publish' }] };
  for (const q of ['গাউন', 'gown', 'maxi']) assert.deepEqual([...w.maSearch.collectProducts(shop, q, {})].map((p) => p.id), ['G1'], q);
  w.SITE_LINKS.searchWords = [];
  assert.deepEqual([...w.maSearch.collectProducts(shop, 'গাউন', {})].map((p) => p.id), []);
});
