import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const functions = source.slice(source.indexOf('function inboxThread_(e)'), source.indexOf('function inboxReply_(e)'));
function setup() {
  const writes = [];
  const row = ['p', 'user', 'Saved name', 'picture'];
  const ctx = {
    MC: { UNREAD: 5, NAME: 3, PROFILE: 4 },
    param_: (e,k) => e[k],
    msgrMessagesSheet_: () => ({getDataRange:()=>({getValues:()=>[['header'], ['time','p','user','in','hello','','',[]]]})}),
    msgrContactsSheet_: () => ({getDataRange:()=>({getValues:()=>[['header'], row]}), getRange:(...args)=>({setValue:v=>writes.push([args,v])})}),
    msgrFindContactRow_:()=>2,
    formatCell_:v=>v, msgrAttachments_:v=>v,
    msgrContactFromRow_:r=>({name:r[2],profilePic:r[3]}),
    getMessengerProfile_:()=>{ throw Error('external profile service is slow/unavailable'); }
  };
  vm.createContext(ctx);vm.runInContext(functions,ctx);
  return {ctx,writes};
}
test('conversation returns saved messages and profile without calling external profile service',()=>{
  const {ctx,writes}=setup();
  const res=ctx.inboxThread_({PageId:'p',PSID:'user'});
  assert.equal(res.ok,true);assert.equal(res.messages[0].text,'hello');assert.equal(res.contact.name,'Saved name');assert.equal(writes.length,0);
});
test('optional profile enrichment is separate and updates only changed profile fields',()=>{
  const {ctx,writes}=setup();ctx.getMessengerProfile_=()=>({name:'New name',profile_pic:'new-picture'});
  const res=ctx.inboxProfile_({PageId:'p',PSID:'user'});
  assert.equal(res.contact.name,'New name');assert.equal(writes.length,2);
  ctx.inboxProfile_({PageId:'p',PSID:'user'});assert.equal(writes.length,2);
});
test('profile route remains behind inbox session authorization',()=>{
  const handler=source.slice(source.indexOf('function handleInboxRequest_'),source.indexOf('function msgrTeamNames_'));
  let profileCalled=false;
  const ctx={param_:()=>'',inboxRateLimit_:()=>{},verifyInboxSession_:()=>({ok:false,error:'INVALID_TOKEN'}),inboxProfile_:()=>{profileCalled=true;}};
  vm.createContext(ctx);vm.runInContext(handler,ctx);
  assert.equal(ctx.handleInboxRequest_('InboxProfile',{}).error,'INVALID_TOKEN');assert.equal(profileCalled,false);
});
