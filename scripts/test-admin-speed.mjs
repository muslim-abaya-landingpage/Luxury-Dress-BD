import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const api = await readFile(new URL('../admin-api.js', import.meta.url), 'utf8');
const guard = await readFile(new URL('../admin-guard.js', import.meta.url), 'utf8');
function storage() {
  const values = new Map();
  return { getItem:k=>values.get(k)??null, setItem:(k,v)=>values.set(k,String(v)), removeItem:k=>values.delete(k), key:i=>[...values.keys()][i], get length(){return values.size;} };
}
function fixture() {
  const calls = [], localStorage = storage(), sessionStorage = storage();
  localStorage.setItem('ma_admin_session', JSON.stringify({token:'session-a',role:'admin',expires:Date.now()+60000}));
  const window={ MA_ADMIN_CONFIG:{apiUrl:'https://example.invalid/api'} };
  const context=vm.createContext({window,localStorage,sessionStorage,URLSearchParams,Date,Promise,setTimeout,clearTimeout,
    location:{pathname:'/admin-dashboard',search:'',href:''},document:{documentElement:{getAttribute:()=>null}},
    fetch:(_url,opts)=>new Promise(resolve=>calls.push({fields:Object.fromEntries(opts.body),reply:body=>resolve({text:()=>Promise.resolve(JSON.stringify(body))})}))});
  vm.runInContext(api,context);vm.runInContext(guard,context);
  return {window,calls,localStorage,sessionStorage,context};
}
test('shell does not wait for verification and concurrent guards share one verification',async()=>{
 const f=fixture(); const a=f.window.MaAdminGuard.require(),b=f.window.MaAdminGuard.require();
 assert.equal((await a).token,'session-a');assert.equal((await b).token,'session-a');assert.equal(f.calls.length,1);
 f.calls[0].reply({ok:true,token:'session-a',role:'admin',expires:Date.now()+60000});
});
test('matching read requests share a request and retain a session-scoped snapshot',async()=>{
 const f=fixture(),api=f.window.MaAdmin;
 const a=api.call('AdminOrderList',{Limit:300}),b=api.call('AdminOrderList',{Limit:300});assert.equal(f.calls.length,1);
 f.calls[0].reply({ok:true,orders:[{orderId:'one'}]});await Promise.all([a,b]);
 assert.equal(api.cached('AdminOrderList',{Limit:300}).orders[0].orderId,'one');
 f.localStorage.setItem('ma_admin_session',JSON.stringify({token:'session-b',role:'admin',expires:Date.now()+60000}));
 assert.equal(api.cached('AdminOrderList',{Limit:300}),null);
});
test('refresh always requests fresh data and a mutation cannot restore an older in-flight snapshot',async()=>{
 const f=fixture(),api=f.window.MaAdmin;
 let read=api.call('AdminOrderList',{Limit:300});f.calls[0].reply({ok:true,orders:[]});await read;
 read=api.call('AdminOrderList',{Limit:300});assert.equal(f.calls.length,2);
 const mutation=api.call('AdminOrderUpdate',{OrderId:'one'});assert.equal(api.cached('AdminOrderList',{Limit:300}),null);
 f.calls[1].reply({ok:true,orders:[{orderId:'stale'}]});await read;
 assert.equal(api.cached('AdminOrderList',{Limit:300}),null);
 f.calls[2].reply({ok:true});await mutation;
});
test('writes are never deduplicated and logout removes snapshots and old order cache',async()=>{
 const f=fixture(),api=f.window.MaAdmin;
 const a=api.call('InboxReply',{PSID:'one',Text:'A'}),b=api.call('InboxReply',{PSID:'one',Text:'A'});assert.equal(f.calls.length,2);
 f.calls.forEach(c=>c.reply({ok:true}));await Promise.all([a,b]);
 f.sessionStorage.setItem('ma_admin_orders_v1','private');api.logout();assert.equal(f.sessionStorage.getItem('ma_admin_orders_v1'),null);assert.equal(api.getSession(),null);
});
test('invalid server authorization clears the session; missing sessions redirect without a request',async()=>{
 const f=fixture();const p=f.window.MaAdmin.call('InboxList',{});f.calls[0].reply({ok:false,error:'INVALID_TOKEN'});
 await assert.rejects(p,/INVALID_TOKEN/);assert.equal(f.window.MaAdmin.getSession(),null);
 await f.window.MaAdminGuard.require();assert.match(f.context.location.href,/admin-login/);assert.equal(f.calls.length,1);
});
test('snapshots expire and never replace the live request after a timeout or failed refresh',async()=>{
 const f=fixture(),api=f.window.MaAdmin;const p=api.call('AdminOrders',{Limit:100});f.calls[0].reply({ok:true,orders:[]});await p;
 const key=[...Array(f.sessionStorage.length)].map((_,i)=>f.sessionStorage.key(i)).find(k=>k.startsWith('ma_admin_read_v2:'));
 const entry=JSON.parse(f.sessionStorage.getItem(key));entry.at=Date.now()-301000;f.sessionStorage.setItem(key,JSON.stringify(entry));
 assert.equal(api.cached('AdminOrders',{Limit:100}),null);
});
test('successful login marks verification to avoid an extra login-to-dashboard roundtrip',async()=>{
 const f=fixture();f.window.MaAdmin.logout();const p=f.window.MaAdmin.login({login:'owner@example.invalid',password:'test-only'});
 f.calls[0].reply({ok:true,token:'new-session',role:'admin',expires:Date.now()+60000});await p;
 await f.window.MaAdminGuard.require();assert.equal(f.calls.length,1);
});
