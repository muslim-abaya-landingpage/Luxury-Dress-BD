const ORIGINS = new Set(["https://muslimabaya.com", "https://www.muslimabaya.com"]);
const HOSTS = new Set(["muslimabaya.com", "www.muslimabaya.com"]);
const ZONE_ID = "f9265892a5f0a3758261759b55ea8010";
const OWNER_AUTH = "https://muslimabaya.com/api/cache-manager-auth";
const API = "https://api.cloudflare.com/client/v4/zones/" + ZONE_ID + "/purge_cache";
const lastPurge = new Map();

function json(body, status = 200, cors = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    ...cors
  }});
}
function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin"
  };
}
function tokenFrom(request) {
  const m = /^Bearer\s+(.+)$/i.exec(request.headers.get("Authorization") || "");
  return m ? m[1].trim() : "";
}
async function ownerCheck(token, fetchImpl) {
  if (!token || token.length > 4096) return { ok:false, status:401, error:"NOT_LOGGED_IN" };
  let res, data;
  try {
    res = await fetchImpl(OWNER_AUTH, {
      method:"POST",
      headers: {
        "Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",
        "Origin":"https://muslimabaya.com"
      },
      body:new URLSearchParams({Token:token})
    });
    data = await res.json();
  } catch { return {ok:false,status:503,error:"AUTH_UNAVAILABLE"}; }
  if (res.ok && data && data.ok === true) return {ok:true};
  if (res.status === 401 || (data && data.error === "NOT_LOGGED_IN")) return {ok:false,status:401,error:"NOT_LOGGED_IN"};
  if (res.status === 403 || (data && data.error === "OWNER_ONLY")) return {ok:false,status:403,error:"OWNER_ONLY"};
  return {ok:false,status:503,error:"AUTH_UNAVAILABLE"};
}
function urls(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) return null;
  const out = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length > 2048) return null;
    let u; try { u = new URL(item); } catch { return null; }
    if (u.protocol !== "https:" || !HOSTS.has(u.hostname) || u.username || u.password) return null;
    out.push(u.toString());
  }
  return [...new Set(out)];
}
function prefixes(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) return null;
  const out = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length > 512 || /[?#\\\s]/.test(item)) return null;
    const m = /^(muslimabaya\.com|www\.muslimabaya\.com)(\/[^\s]*)?$/.exec(item);
    if (!m) return null;
    out.push(m[1] + (m[2] || "/"));
  }
  return [...new Set(out)];
}
async function purge(env, payload, fetchImpl) {
  if (!env || !env.CLOUDFLARE_API_TOKEN) return {ok:false,status:503,error:"CLOUDFLARE_TOKEN_NOT_CONFIGURED"};
  let res, data;
  try {
    res = await fetchImpl(API, {
      method:"POST",
      headers: {
        "Authorization":"Bearer " + env.CLOUDFLARE_API_TOKEN,
        "Content-Type":"application/json"
      },
      body:JSON.stringify(payload)
    });
    data = await res.json();
  } catch { return {ok:false,status:502,error:"CLOUDFLARE_API_UNAVAILABLE"}; }
  if (!res.ok || !data || data.success !== true) {
    const denied = res.status === 401 || res.status === 403;
    return {ok:false,status:denied ? 403 : 502,error:denied ? "CLOUDFLARE_PERMISSION_DENIED" : "PURGE_FAILED"};
  }
  return {ok:true,purgeId:data.result && data.result.id || null};
}
export async function handleRequest(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const url = new URL(request.url);
  if (url.pathname === "/health" && request.method === "GET") {
    return json({ok:true,service:"muslim-abaya-cache-manager",version:"1.0.0"});
  }
  const origin = request.headers.get("Origin") || "";
  if (!ORIGINS.has(origin)) return json({ok:false,error:"ORIGIN_NOT_ALLOWED"},403);
  const headers = cors(origin);
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers});
  if (url.pathname !== "/api/status" && url.pathname !== "/api/purge") return json({ok:false,error:"NOT_FOUND"},404,headers);
  if ((url.pathname === "/api/status" && request.method !== "GET") ||
      (url.pathname === "/api/purge" && request.method !== "POST")) {
    return json({ok:false,error:"METHOD_NOT_ALLOWED"},405,headers);
  }
  const auth = await ownerCheck(tokenFrom(request),fetchImpl);
  if (!auth.ok) return json({ok:false,error:auth.error},auth.status,headers);
  if (url.pathname === "/api/status") {
    return json({
      ok:true,service:"muslim-abaya-cache-manager",version:"1.0.0",
      cloudflareTokenConfigured:!!(env && env.CLOUDFLARE_API_TOKEN),
      zone:"muslimabaya.com",
      supportedActions:["site","urls","prefixes","zone"],
      protectedHosts:["muslimabaya.com","www.muslimabaya.com"]
    },200,headers);
  }
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 20480) return json({ok:false,error:"TOO_LARGE"},413,headers);
    body = JSON.parse(raw || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("BAD_JSON");
  } catch { return json({ok:false,error:"BAD_JSON"},400,headers); }
  let payload, scope;
  if (body.action === "site") {
    payload = {hosts:["muslimabaya.com","www.muslimabaya.com"]}; scope = "site-hostnames";
  } else if (body.action === "urls") {
    const list = urls(body.urls);
    if (!list) return json({ok:false,error:"INVALID_URLS"},400,headers);
    payload = {files:list}; scope = "specific-urls";
  } else if (body.action === "prefixes") {
    const list = prefixes(body.prefixes);
    if (!list) return json({ok:false,error:"INVALID_PREFIXES"},400,headers);
    payload = {prefixes:list}; scope = "url-prefixes";
  } else if (body.action === "zone") {
    if (body.confirm !== "PURGE_ENTIRE_ZONE_MUSLIMABAYA_COM") return json({ok:false,error:"CONFIRMATION_REQUIRED"},400,headers);
    payload = {purge_everything:true}; scope = "entire-zone";
  } else return json({ok:false,error:"UNKNOWN_ACTION"},400,headers);

  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(tokenFrom(request)));
  const key = Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  const now = Date.now(), previous = lastPurge.get(key) || 0;
  if (now - previous < 3000) return json({ok:false,error:"RATE_LIMITED",retryAfter:Math.ceil((3000-(now-previous))/1000)},429,headers);
  lastPurge.set(key,now);
  const result = await purge(env,payload,fetchImpl);
  if (!result.ok) return json({ok:false,error:result.error},result.status,headers);
  return json({ok:true,scope,purgeId:result.purgeId,purgedAt:new Date().toISOString()},200,headers);
}
export function _resetRateLimit(){lastPurge.clear();}
export default { fetch(request,env){ return handleRequest(request,env); } };
