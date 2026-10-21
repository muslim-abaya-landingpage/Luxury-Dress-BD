const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const scope={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('admin-order-status.js','utf8'),scope);
const {describe}=scope.module.exports;
test('a courier record explains legacy Shipped without claiming rider handover',()=>{
 const s=describe({status:'Shipped',tracking:'example',courierStatus:'pending'});
 assert.equal(s.orderLabel,'pending');
 assert.equal(s.courierLabel,'pending');
 assert.equal(s.orderRaw,'Shipped');
 assert(!s.courierLabel.includes('অনুমোদিত'));
});
test('approval and approval-pending remain distinct',()=>{
 assert.equal(describe({courierStatus:'approved'}).courierLabel,'approved');
 assert.equal(describe({courierStatus:'approval_pending'}).courierLabel,'approval_pending');
});
test('missing courier status is disclosed instead of inferred from Shipped',()=>{
 const s=describe({status:'Shipped',tracking:'example'});
 assert.equal(s.courierLabel,'স্ট্যাটাস পাওয়া যায়নি');
 assert.equal(describe({status:'Shipped'}).orderLabel,'Shipped');
});
test('partial delivery, unknown statuses and shop status are preserved',()=>{
 const order={status:'Confirmed',courierStatus:'partial_delivered'};
 const snapshot=JSON.stringify(order);
 assert.equal(describe(order).courierLabel,'partial_delivered');
 assert.equal(describe(order).orderLabel,'partial_delivered');
 assert.equal(describe(order).orderRaw,'Confirmed');
 assert.equal(describe(order).badgeKey,'pending');
 assert.equal(describe({courierStatus:'future_state'}).courierLabel,'future_state');
 assert.equal(JSON.stringify(order),snapshot);
});


const orderPage = fs.readFileSync(require('node:path').join(__dirname, '../../admin-order.html'), 'utf8');
test('order editor rejects invalid money and keeps save failures rejected', () => {
  const start = orderPage.indexOf('function save() {');
  const end = orderPage.indexOf('$("btnSave").addEventListener', start);
  assert.ok(start >= 0 && end > start, 'Could not locate order save flow');
  const saveFlow = orderPage.slice(start, end);
  assert.match(saveFlow, /!\[charge, advance, discount\]\.every\(Number\.isFinite\)/);
  assert.match(saveFlow, /MaAdmin\.call\("AdminOrderUpdate"/);
  assert.match(saveFlow, /function \(err\) \{[^}]*?(?:btn\.disabled = false|setSaveState\(false\));\s*throw (?:err|new Error\()/, 'a failed save re-enables the button and stays rejected');
  assert.match(saveFlow, /formSnapshot = previousSnapshot/, 'a failed save marks the edits unsaved again');
});
test('courier send is chained after successful order update', () => {
  const start = orderPage.indexOf('$("btnCourierSend").addEventListener');
  const end = orderPage.indexOf('});', start);
  assert.ok(start >= 0 && end > start, 'Could not locate courier send handler');
  const courierFlow = orderPage.slice(start, orderPage.indexOf('function load()', start));
  assert.match(courierFlow, /save\(\)\.then\(function \(\) \{\s*return MaAdmin\.call\("AdminSendCourier"/);
});
