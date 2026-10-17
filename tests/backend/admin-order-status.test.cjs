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
