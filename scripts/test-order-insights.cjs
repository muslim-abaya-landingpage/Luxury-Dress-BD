const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const loadedModel = require('../admin-order-insights.js');
const model = globalThis.MaOrderInsights || loadedModel.default || loadedModel;
const good = {orderId:'MA-20261015-001', time:'15-10-2026 10:00', status:'Delivered', total:1000, charge:100, advance:0, qty:1, size:'Body 42 · Length 52', name:'Example', phone:'', items:['Example']};
const fixture = [good,
  {...good,orderId:'MA-20261015-002',status:'Pending',total:500},
  {...good,orderId:'MA-20261015-003',status:'Confirmed',total:600},
  {...good,orderId:'MA-20261015-004',status:'Shipped',total:700},
  {...good,orderId:'MA-20261015-005',status:'Cancelled',total:800},
  {...good,orderId:'MA-20261015-006',status:'Fake',total:900},
  {...good,orderId:'MA-20261015-007',status:'Returned',total:400}];
let a = model.analyze(fixture,{today:'2026-10-16'});
assert.equal(a.totalValue,4900);
assert.deepEqual(a.groups.delivered,{count:1,value:1000});
assert.deepEqual(a.groups.active,{count:3,value:1800});
assert.equal(a.groups.fake.value,900);
assert.equal(a.groups.returned.value,400);
assert.equal(a.deliveredProductValue,900);
assert.equal(a.flagged,0);
assert.equal(model.dateKey('31-02-2026 12:00'),null);
assert.equal(model.dateKey('29-02-2024'), '2024-02-29');
assert.equal(model.dateKey('2026-10-16 01:00'), '2026-10-16');
assert.equal(model.dhakaToday(Date.parse('2026-10-15T19:00:00Z')),'2026-10-16');
a = model.analyze([{...good,status:'Pending',orderId:'MA-20261015-X', time:'10-12-2026',size:'',qty:1.5,total:100,advance:101,adminNote:'৳500 পার্থক্য যাচাই করুন'}, {...good,orderId:'MA-20261015-X'}, {...good,orderId:'',status:'??',time:'',total:'NaN'}],{today:'2026-10-16'});
for (const code of ['duplicate_id','missing_size','future_date','date_mismatch','invalid_qty','advance_over_total','review_note']) assert(a.rows[0].issues.includes(code),code);
for (const code of ['missing_id','unknown_status','invalid_date','invalid_total']) assert(a.rows[2].issues.includes(code),code);
assert.equal(a.invalidAmounts,1);
assert(!model.analyze([{...good,status:'Delivered',size:''}],{today:'2026-10-16'}).rows[0].issues.includes('missing_size'),'finished orders are not flagged for size');
{ const st = model.analyze([
    {...good,orderId:'MA-20261010-1',time:'10-10-2026',status:'Confirmed'},
    {...good,orderId:'MA-20261015-2',time:'15-10-2026',status:'Pending'},
    {...good,orderId:'MA-20261001-3',time:'01-10-2026',status:'Shipped',tracking:'T',courierStatus:'in_review'},
    {...good,orderId:'MA-20261001-4',time:'01-10-2026',status:'Delivered',tracking:'T',courierStatus:'delivered'},
    {...good,orderId:'MA-20260501-5',time:'01-05-2026',status:'Pending'}],{today:'2026-10-16'});
  assert(st.rows[0].issues.includes('stuck_unsent'),'6 days unsent');
  assert(!st.rows[1].issues.includes('stuck_unsent'),'1 day is fine');
  assert(st.rows[2].issues.includes('stuck_courier'),'courier not final after 15 days');
  assert(!st.rows[3].issues.some(k=>k.startsWith('stuck')),'delivered is done');
  assert(!st.rows[4].issues.some(k=>k.startsWith('stuck')),'older than 90 days not repeated'); }
assert.equal(a.totalValue,1100);
assert.deepEqual(model.analyze([], {today:'2026-10-16'}).groups.delivered,{count:0,value:0});
const original = JSON.stringify(fixture); model.analyze(fixture); assert.equal(JSON.stringify(fixture),original);
// Execute the real order page controller with its existing authenticated API contract.
const html = fs.readFileSync(path.join(__dirname,'../admin-orders.html'),'utf8');
// The page's main inline script (the one that loads the order list); small helper scripts may follow it.
// Empty-state rows must span the whole order table, however many columns the page has.
const tableCols = (((html.match(/<thead>[\s\S]*?<\/thead>/) || [''])[0]).match(/<th\b/g) || []).length;
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).find((code) => code.includes('AdminOrderList'));
class Element {
  constructor(){ this.listeners={}; this.textContent=''; this.innerHTML=''; this.hidden=true; this.children=[]; }
  addEventListener(k,fn){this.listeners[k]=fn;}
  appendChild(el){this.children.push(el);}
}
const els = new Map();
const document = {getElementById(id){if(!els.has(id))els.set(id,new Element());return els.get(id);},createElement(){return new Element();}};
const escape = s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const hostile = {...good,status:'Pending',orderId:'unsafe<id>',name:'<img src=x onerror=alert(1)>',size:''};
const calls=[];
const statusScope={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../admin-order-status.js'),'utf8'),statusScope);
const context = {document,Map,MaOrderStatus:statusScope.module.exports,MaOrderInsights:model,MaPanel:{esc:escape,money:n=>'৳'+n,statusClass:()=>'',toast(){},init:()=>Promise.resolve({})},MaAdmin:{cached:()=>null,call:(type,args)=>{calls.push({type,args});return Promise.resolve({orders:[...fixture,hostile],counts:{all:400},statuses:['Pending','Delivered']});}},location:{href:''}};
vm.runInNewContext(inline,context);
setImmediate(()=>{
  try {
    assert.equal(calls.length,1); assert.equal(calls[0].type,'AdminOrderList');
    assert.equal(document.getElementById('ordInsights').hidden,false);
    assert(document.getElementById('ordScope').textContent.includes('8 / 400'));
    assert(document.getElementById('ordBody').innerHTML.includes('&lt;img'));
    assert(!document.getElementById('ordBody').innerHTML.includes('<img'));
    assert(document.getElementById('ordBody').innerHTML.includes('unsafe%3Cid%3E'));
    const finance=document.getElementById('ordFinance').innerHTML;
    document.getElementById('ordIssueFilter').value='missing_size';
    document.getElementById('ordIssueFilter').listeners.change();
    assert(document.getElementById('ordBody').innerHTML.includes('unsafe%3Cid%3E'));
    assert(!document.getElementById('ordBody').innerHTML.includes('MA-20261015-002'));
    assert.equal(document.getElementById('ordFinance').innerHTML,finance);
    assert.equal(calls.length,1,'filters do not write or refetch orders');
    document.getElementById('ordSearch').listeners.input({target:{value:'does-not-exist'}});
    assert(document.getElementById('ordBody').innerHTML.includes('colspan="' + tableCols + '"'));
    console.log('PASS: finance separation, strict dates, Dhaka boundary, audit flags, no mutation, page/API integration, escaping, scope and combined filters.');
  } catch(error) { console.error(error); process.exitCode=1; }
});
