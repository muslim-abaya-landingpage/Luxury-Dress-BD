import { isOwner } from "../_lib/owner-auth.js";
import { isOwnerViaAppsScript } from "../_lib/admin-verify.js";

function json(body,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store, max-age=0",
    "X-Content-Type-Options":"nosniff"
  }});
}
export async function handleCacheManagerAuth(request,env,deps={}) {
  const fetchImpl=deps.fetch||fetch;
  const now=deps.now?deps.now():Date.now();
  if(request.method!=="POST") return json({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  const origin=request.headers.get("Origin");
  if(origin && origin!=="https://muslimabaya.com") return json({ok:false,error:"ORIGIN_NOT_ALLOWED"},403);
  let token;
  try {
    const raw=await request.text();
    if(raw.length>8192) return json({ok:false,error:"TOO_LARGE"},413);
    token=String(new URLSearchParams(raw).get("Token")||"").trim();
  } catch { return json({ok:false,error:"BAD_REQUEST"},400); }
  if(!token || token.length>4096) return json({ok:false,error:"NOT_LOGGED_IN"},401);
  try {
    // With the Google service-account secret, read the Admins/Sessions sheet directly; without it
    // (this project's setup), ask Apps Script like the rest of the admin panel does.
    const result=env && env.GOOGLE_SA_JSON
      ? await isOwner(token,env,fetchImpl,now)
      : await isOwnerViaAppsScript(token,env,fetchImpl);
    if(["NOT_LOGGED_IN","INVALID_TOKEN","EXPIRED","NO_TOKEN","NOT_ADMIN","BLOCKED"].includes(result)) return json({ok:false,error:"NOT_LOGGED_IN"},401);
    if(result==="OWNER_ONLY") return json({ok:false,error:"OWNER_ONLY"},403);
    if(result) return json({ok:false,error:"AUTH_UNAVAILABLE"},503);
    return json({ok:true});
  } catch { return json({ok:false,error:"AUTH_UNAVAILABLE"},503); }
}
export const onRequestPost=({request,env})=>handleCacheManagerAuth(request,env);
