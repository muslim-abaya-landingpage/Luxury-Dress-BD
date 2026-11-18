import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync(new URL("../../admin-cache-manager.html",import.meta.url),"utf8");
const js=readFileSync(new URL("../../admin-cache-manager.js",import.meta.url),"utf8");

test("Cache Manager page is owner guarded and linked from admin navigation",()=>{
  assert.match(html,/data-admin-guard="1"/);
  assert.match(html,/admin-guard\.js/);
  assert.match(html,/admin-cache-manager\.js/);
});
test("Cache Manager UI calls only the dedicated Worker and owner-protected endpoints",()=>{
  assert.match(js,/muslim-abaya-cache-manager\.muslimabeya\.workers\.dev/);
  assert.match(js,/MaAdminGuard\.requireOwner\(\)/);
  assert.match(js,/Authorization:'Bearer '\+token/);
  assert.doesNotMatch(js,/CLOUDFLARE_API_TOKEN/);
});
test("every purge requires explicit confirmation and supported narrow scopes only",()=>{
  assert.match(js,/window\.confirm\(/);
  assert.match(js,/action:'site'/);
  assert.match(js,/action:'urls'/);
  assert.match(js,/action:'prefixes'/);
  assert.doesNotMatch(js,/action:'zone'/);
});
test("dashboard Settings menu exposes Cache Manager",()=>{
  assert.match(html,/Cache Manager/);
});
