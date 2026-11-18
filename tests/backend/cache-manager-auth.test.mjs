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
test("auth bridge fails closed without Pages service-account secret",async()=>{
  const r=await handleCacheManagerAuth(post(),{});
  assert.equal(r.status,503);
});
