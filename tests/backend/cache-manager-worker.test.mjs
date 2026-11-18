import test from "node:test";
import assert from "node:assert/strict";
import {handleRequest,_resetRateLimit} from "../../workers/cache-manager/worker.js";
const origin="https://muslimabaya.com", token="valid-owner-session-token", base="https://cache-manager.example.workers.dev";
function req(path,options={}) {
  return new Request(base+path,{...options,headers:{Origin:origin,...(options.headers||{})}});
}
function fakeFetch(calls) {
  return async (url,init={}) => {
    calls.push({url:String(url),init});
    if(String(url).includes("cache-manager-auth")) return Response.json({ok:true});
    return Response.json({success:true,result:{id:"purge-123"}});
  };
}
test("public health response reveals no secrets",async()=>{
  const r=await handleRequest(new Request(base+"/health"),{});
  assert.equal(r.status,200); assert.equal((await r.json()).service,"muslim-abaya-cache-manager");
});
test("rejects unapproved origin",async()=>{
  const r=await handleRequest(new Request(base+"/api/status",{headers:{Origin:"https://evil.example"}}),{},{fetch:async()=>{throw Error("unexpected");}});
  assert.equal(r.status,403);
});
test("status requires owner session and hides token value",async()=>{
  const calls=[],r=await handleRequest(req("/api/status",{headers:{Authorization:"Bearer "+token}}),{CLOUDFLARE_API_TOKEN:"secret-value"},{fetch:fakeFetch(calls)});
  const body=await r.json(); assert.equal(r.status,200); assert.equal(body.cloudflareTokenConfigured,true);
  assert.equal(JSON.stringify(body).includes("secret-value"),false); assert.equal(calls.length,1);
});
test("site purge targets only apex and www hosts",async()=>{
  _resetRateLimit(); const calls=[];
  const r=await handleRequest(req("/api/purge",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"site"})}),{CLOUDFLARE_API_TOKEN:"secret"},{fetch:fakeFetch(calls)});
  assert.equal(r.status,200);
  const call=calls.find(x=>x.url.includes("purge_cache")); assert.deepEqual(JSON.parse(call.init.body),{hosts:["muslimabaya.com","www.muslimabaya.com"]});
});
test("rejects purge URLs outside storefront hosts",async()=>{
  _resetRateLimit(); const calls=[];
  const r=await handleRequest(req("/api/purge",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"urls",urls:["https://shop.muslimabaya.com/"]})}),{CLOUDFLARE_API_TOKEN:"secret"},{fetch:fakeFetch(calls)});
  assert.equal(r.status,400); assert.equal((await r.json()).error,"INVALID_URLS");
  assert.equal(calls.some(x=>x.url.includes("purge_cache")),false);
});
test("zone purge requires exact confirmation",async()=>{
  _resetRateLimit(); const calls=[];
  const r=await handleRequest(req("/api/purge",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"zone"})}),{CLOUDFLARE_API_TOKEN:"secret"},{fetch:fakeFetch(calls)});
  assert.equal(r.status,400); assert.equal((await r.json()).error,"CONFIRMATION_REQUIRED");
  assert.equal(calls.some(x=>x.url.includes("purge_cache")),false);
});
test("missing Cloudflare secret fails closed",async()=>{
  _resetRateLimit();
  const r=await handleRequest(req("/api/purge",{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({action:"site"})}),{},{fetch:fakeFetch([])});
  assert.equal(r.status,503); assert.equal((await r.json()).error,"CLOUDFLARE_TOKEN_NOT_CONFIGURED");
});
