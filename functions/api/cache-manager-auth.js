import { isOwner } from "../_lib/owner-auth.js";

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
  if(!env || !env.GOOGLE_SA_JSON) return json({ok:false,error:"AUTH_UNAVAILABLE"},503);
  let token;
  try {
    const raw=await request.text();
    if(raw.length>8192) return json({ok:false,error:"TOO_LARGE"},413);
    token=String(new URLSearchParams(raw).get("Token")||"").trim();
  } catch { return json({ok:false,error:"BAD_REQUEST"},400); }
  if(!token || token.length>4096) return json({ok:false,error:"NOT_LOGGED_IN"},401);
  try {
    const result=await isOwner(token,env,fetchImpl,now);
    if(result==="NOT_LOGGED_IN") return json({ok:false,error:"NOT_LOGGED_IN"},401);
    if(result==="OWNER_ONLY") return json({ok:false,error:"OWNER_ONLY"},403);
    if(result) return json({ok:false,error:"AUTH_UNAVAILABLE"},503);
    return json({ok:true});
  } catch { return json({ok:false,error:"AUTH_UNAVAILABLE"},503); }
}
export const onRequestPost=({request,env})=>handleCacheManagerAuth(request,env);
