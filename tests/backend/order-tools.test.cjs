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
  const abaya = rep.products.find(p => p.key === 'Black Abaya');
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
