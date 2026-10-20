const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const sandbox = { module: { exports: {} } }; sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../admin-order-tools.js'), 'utf8'), sandbox);
const T = sandbox.module.exports;

const order = (o) => Object.assign({ orderId: 'MA-1', name: 'Rahima', phone: '01711111111', total: 1630, advance: 0,
  items: ['Black Abaya (Body 52) × 2'], address: 'House 3, Mirpur', district: 'ঢাকা', status: 'Pending' }, o);

test('WhatsApp link uses the Bangladesh country code and carries the order summary', () => {
  assert.equal(T.waPhone('01711111111'), '8801711111111');
  assert.equal(T.waPhone('+880 1711-111111'), '8801711111111');
  assert.equal(T.waPhone('12345'), '');
  const url = T.waUrl(order({ advance: 130 }));
  assert.match(url, /^https:\/\/wa\.me\/8801711111111\?text=/);
  const msg = decodeURIComponent(url.split('text=')[1]);
  assert.match(msg, /MA-1/); assert.match(msg, /Black Abaya/);
  assert.match(msg, /অগ্রিম পেয়েছি: ৳130 · ডেলিভারির সময় দেবেন: ৳1,500/);
  assert.equal(T.waUrl(order({ phone: '' })), '');
});

test('reason tag is added, replaced and read back without touching the rest of the note', () => {
  const a = T.withReason('call after 5pm', 'সাইজ মেলেনি');
  assert.equal(a, '[কারণ: সাইজ মেলেনি] call after 5pm');
  const b = T.withReason(a, 'ফোন ধরেনি');
  assert.equal(b, '[কারণ: ফোন ধরেনি] call after 5pm');
  assert.equal(T.reasonOf(b), 'ফোন ধরেনি');
  assert.equal(T.needsReason('Cancelled'), true);
  assert.equal(T.needsReason('Fake'), true);
  assert.equal(T.needsReason('Delivered'), false);
});

test('courier status text decides the outcome when present', () => {
  assert.equal(T.outcome(order({ status: 'Shipped', courierStatus: 'delivered' })), 'delivered');
  assert.equal(T.outcome(order({ status: 'Shipped', courierStatus: 'partial_delivered' })), 'active');
  assert.equal(T.outcome(order({ status: 'Shipped', courierStatus: 'cancelled_approval_pending' })), 'cancelled');
  assert.equal(T.outcome(order({ status: 'Fake' })), 'fake');
  assert.equal(T.outcome(order({ status: '' })), 'active');
});

test('report groups by district, product units and reason', () => {
  const rep = T.report([
    order({ status: 'Delivered' }),
    order({ orderId: 'MA-2', status: 'Cancelled', adminNote: '[কারণ: সাইজ মেলেনি]', district: 'চট্টগ্রাম', items: ['Black Abaya (Body 50) × 1'] }),
    order({ orderId: 'MA-3', status: 'Fake', district: 'চট্টগ্রাম', items: ['Kurti × 1'] }),
    order({ orderId: 'MA-4', status: 'Pending', district: '' }),
  ]);
  const ctg = rep.districts.find(d => d.key === 'চট্টগ্রাম');
  assert.equal(JSON.stringify([ctg.orders, ctg.delivered, ctg.failed]), JSON.stringify([2, 0, 2]));
  assert.equal(T.failRate(ctg), 100);
  assert.ok(rep.districts.find(d => d.key === 'জেলা লেখা নেই'));
  const abaya = rep.products.find(p => p.label === 'Black Abaya');
  assert.equal(JSON.stringify([abaya.units, abaya.deliveredUnits, abaya.failedUnits]), JSON.stringify([5, 2, 1]));
  assert.equal(JSON.stringify(rep.reasons.map(r => r.reason).sort()), JSON.stringify(['কারণ লেখা হয়নি', 'সাইজ মেলেনি']));
  assert.equal(rep.totals.orders, 4);
});

test('bulk courier skips orders already sent, finished or blocked', () => {
  const plan = T.courierPlan([
    order({}), order({ orderId: 'MA-2', tracking: 'T1' }), order({ orderId: 'MA-3', status: 'Delivered' }),
    order({ orderId: 'MA-4', blocked: true }), order({ orderId: '' }), order({ orderId: 'MA-6', status: 'Confirmed' }),
  ]);
  assert.equal(JSON.stringify(plan.send.map(o => o.orderId)), JSON.stringify(['MA-1', 'MA-6']));
  assert.equal(plan.skip.length, 4);
});

test('item parser handles every checkout format seen in the sheet', () => {
  const one = (s) => { const r = T.parseItems(s); return r.map(i => i.name + '|' + i.qty).join(','); };
  assert.equal(one('Black White Polka (Body 42 (Free size) · Length 50) · Body 42 (Free size) · Length 50 × 2 pcs = ৳1,100'), 'Black White Polka|2');
  assert.equal(one('Pink Floral Printed Co-ord Set · Body 42 (Free size) · Length 37-38 inch × 1 pcs = ৳550'), 'Pink Floral Printed Co-ord Set|1');
  assert.equal(one('Royal Blue Golden (1টি)'), 'Royal Blue Golden|1');
  assert.equal(one('Black Base Rose (1), Royal Blue Golden (2)'), 'Black Base Rose|1,Royal Blue Golden|2');
  assert.equal(one('Royal-Blue-Golden-Floral-Print'), 'Royal Blue Golden Floral Print|1');
  assert.equal(one('Premium Black Hafeza Set (Full Set)'), 'Premium Black Hafeza Set|1');
  assert.equal(one('kurti'), 'kurti|1');
  const a = T.parseItems('Black White Polka (1টি)')[0], b = T.parseItems('black white polka × 1 pcs = ৳550')[0];
  assert.equal(a.key, b.key, 'same product groups together regardless of case');
});

test('district guess: only an unambiguous match, Bengali spelling variants and Dhaka areas', () => {
  const D = [{ bn: 'ঢাকা', en: 'Dhaka' }, { bn: 'টাঙ্গাইল', en: 'Tangail' }, { bn: 'নারায়ণগঞ্জ', en: 'Narayanganj' }, { bn: 'চট্টগ্রাম', en: 'Chittagong' }, { bn: 'মুন্সীগঞ্জ', en: 'Munshiganj' }];
  assert.equal(T.guessDistrict('গ্রাম:চরজানা, থানা ও জেলা টাংগাইল', D), 'টাঙ্গাইল');
  assert.equal(T.guessDistrict('সোনার গা, নারায়ণগন্জ', D), 'নারায়ণগঞ্জ');
  assert.equal(T.guessDistrict('House 5, Agrabad, Chattogram', D), 'চট্টগ্রাম');
  assert.equal(T.guessDistrict('Uttara sector 18, Aparajita', D), 'ঢাকা');
  assert.equal(T.guessDistrict('উত্তরা সেক্টর 18', D), 'ঢাকা');
  assert.equal(T.guessDistrict('Dhaka to Tangail bus stand', D), '', 'two districts → no guess');
  assert.equal(T.guessDistrict('Jury', D), '');
  const rep = T.report([{ orderId: 'A', address: 'Mirpur 10', status: 'Delivered', total: 100, items: ['x'] }], D);
  assert.equal(rep.districts[0].key, 'ঢাকা'); assert.equal(rep.guessedDistricts, 1);
});
