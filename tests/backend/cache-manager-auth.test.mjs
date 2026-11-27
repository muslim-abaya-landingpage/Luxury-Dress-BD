import test from "node:test";
import assert from "node:assert/strict";
import {handleCacheManagerAuth} from "../../functions/api/cache-manager-auth.js";
function post(origin="https://muslimabaya.com"){
  return new Request("https://muslimabaya.com/api/cache-manager-auth",{method:"POST",headers:{Origin:origin,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({Token:"owner-session-token"})});
}
test("auth bridge rejects non-POST",async()=>{
  const r=await handleCacheManagerAuth(new Request("https://muslimabaya.com/api/cache-manager-auth"),{});
  assert.equal(r.status,405);
});
test("auth bridge rejects unapproved origin",async()=>{
  const r=await handleCacheManagerAuth(post("https://evil.example"),{GOOGLE_SA_JSON:"{}"});
  assert.equal(r.status,403);
});
const appsScript=(reply)=>({fetch:async()=>new Response(JSON.stringify(reply)),now:()=>0});
test("without the service-account secret, the owner is verified through Apps Script",async()=>{
  const r=await handleCacheManagerAuth(post(),{},appsScript({ok:true,role:"admin",isOwner:true}));
  assert.equal(r.status,200);
});
test("staff sessions are refused as OWNER_ONLY",async()=>{
  const r=await handleCacheManagerAuth(post(),{},appsScript({ok:true,role:"staff",isOwner:false}));
  assert.deepEqual([r.status,(await r.json()).error],[403,"OWNER_ONLY"]);
});
test("an invalid session is NOT_LOGGED_IN",async()=>{
  const r=await handleCacheManagerAuth(post(),{},appsScript({ok:false,error:"INVALID_TOKEN"}));
  assert.deepEqual([r.status,(await r.json()).error],[401,"NOT_LOGGED_IN"]);
});
test("Apps Script outage fails closed",async()=>{
  const r=await handleCacheManagerAuth(post(),{},{fetch:async()=>{throw new Error("down");},now:()=>0});
  assert.equal(r.status,503);
});
