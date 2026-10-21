const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path'); const vm = require('node:vm');
const box = { module: { exports: {} } }; box.globalThis = box;
vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../admin-order-new.js'), 'utf8'), box);
const N = box.module.exports;
const J = (v) => JSON.stringify(v);

const base = () => ({
  status: 'Pending', date: '2026-10-21T05:30', source: 'Facebook', note: 'call after 5pm', payment: 'bKash', txn: 'TX1',
  billing: { name: 'Rahima Akter', phone: '01711-111111', email: 'r@x.com' },
  shipping: { address: 'House 3, Road 2, Mirpur 10', district: 'ঢাকা', courierNote: 'fragile' },
  items: [{ name: 'Butterfly Abaya Set', type: 'Full Set', size: '52', price: 1350, qty: 1 }, { name: 'Kurti', size: '38', price: 250, qty: 2 }],
  shippingCharge: 80, discount: 50, coupon: { code: 'EID10', amount: 100 }, advance: 200,
});

test('totals: subtotal, shipping, discount, coupon, advance and due', () => {
  const s = base();
  const t = N.totals(s.items, s.shippingCharge, s.discount, s.coupon.amount, s.advance);
  assert.equal(J([t.qty, t.subtotal, t.total, t.due]), J([3, 1850, 1780, 1580]));
});

test('item lines use the checkout format so reports and invoices can read them', () => {
  assert.equal(N.itemLine({ name: 'Butterfly Abaya Set', type: 'Full Set', size: '52', price: 1350, qty: 1 }), 'Butterfly Abaya Set · Full Set · Size 52 × 1 pcs = ৳1,350');
  assert.equal(N.itemLine({ name: 'Kurti', size: '', price: 250, qty: 2 }), 'Kurti × 2 pcs = ৳500');
});

test('payload: one AdminOrderCreate call with cart items, exact money fields, date/time and source', () => {
  const p = N.payloads(base());
  const c = p.create;
  assert.equal(c.Phone, '01711111111');
  assert.equal(c.Charge, 80);
  assert.equal(c.Advance, 200);
  assert.equal(c.Status, 'Pending');
  assert.equal(c.Date, '2026-10-21'); assert.equal(c.Time, '05:30');
  assert.equal(c.Source, 'Facebook');
  assert.equal(c.Email, 'r@x.com');
  assert.equal(c.CourierNote, 'fragile');
  assert.equal(c.CouponCode, 'EID10');
  assert.equal(c.AdminNote, 'call after 5pm');
  const items = JSON.parse(c.ItemsJSON);
  assert.equal(items.length, 2);
  assert.equal(items[0].type, 'Full Set'); assert.equal(items[0].size, '52'); assert.equal(items[0].price, 1350); assert.equal(items[0].qty, 1);
  assert.equal(items[1].qty, 2);
  assert.ok(!('Design' in c) && !('Total' in c), 'server builds the item text and total itself');
});

test('validation catches the usual mistakes', () => {
  const v = (patch) => { const s = base(); patch(s); return N.validate(s); };
  assert.equal(v(() => {}), '');
  assert.match(v((s) => { s.billing.phone = '123'; }), /মোবাইল/);
  assert.match(v((s) => { s.shipping.address = 'short'; }), /ঠিকানা/);
  assert.match(v((s) => { s.items = []; }), /পণ্য/);
  assert.match(v((s) => { s.advance = 5000; }), /অগ্রিম/);
  assert.match(v((s) => { s.items[0].price = 0; }), /দাম/);
});

test('district charge comes from the checkout list; unknown district → 150', () => {
  const D = [{ bn: 'ঢাকা', en: 'Dhaka', fee: 80 }, { bn: 'গাজীপুর', en: 'Gazipur', fee: 150 }];
  assert.equal(N.chargeFor('ঢাকা', D), 80);
  assert.equal(N.chargeFor('Gazipur', D), 150);
  assert.equal(N.chargeFor('', D), 150);
});

test('customer search keeps one entry per phone with the latest details', () => {
  const c = N.customers([{ phone: '01711111111', name: 'A', address: 'Mirpur 10 road 2', district: 'ঢাকা' }, { phone: '01711111111', name: 'A old', address: 'old' }, { phone: 'bad' }]);
  assert.equal(c.length, 1);
  assert.equal(J([c[0].name, c[0].address, c[0].orders]), J(['A', 'Mirpur 10 road 2', 2]));
});
