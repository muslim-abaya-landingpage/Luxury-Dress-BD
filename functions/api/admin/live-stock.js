import {json,readStock,writeStock,validId} from '../../_lib/live-stock-d1.js';
const decoder = new TextDecoder();
function base64url(input) {
  const normalized=input.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'='));
  return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
async function accessIdentity(request,env) {
  const domain=String(env.ACCESS_TEAM_DOMAIN||'').replace(/^https?:\/\//,'').replace(/\/$/,'');
  const audience=env.ACCESS_AUD;
  if (!domain || !audience || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)) return null;
  const token=request.headers.get('cf-access-jwt-assertion');
  if (!token) return null;
  const parts=token.split('.');
  if(parts.length!==3) return null;
  let header,payload;
  try {header=JSON.parse(decoder.decode(base64url(parts[0])));payload=JSON.parse(decoder.decode(base64url(parts[1])));}
  catch {return null;}
  if(header.alg!=='RS256'||typeof header.kid!=='string') return null;
  if(payload.iss!==`https://${domain}` || !Array.isArray(payload.aud) || !payload.aud.includes(audience)) return null;
  if(typeof payload.exp!=='number'||payload.exp<=Date.now()/1000) return null;
  const response=await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if(!response.ok) return null;
  const jwks=await response.json();
  const jwk=(jwks.keys||[]).find(k=>k.kid===header.kid && k.kty==='RSA');
  if(!jwk)return null;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const ok=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,base64url(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1]));
  return ok && typeof payload.email==='string' ? payload.email : null;
}
export async function onRequest({request,env}) {
  try {
    const actor=await accessIdentity(request,env);
    if(!actor)return json({ok:false,error:'UNAUTHORIZED'},401);
    if(request.method==='GET')return json({ok:true,items:await readStock(env)});
    if(request.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);
    if(!/^application\/json\b/i.test(request.headers.get('content-type')||''))return json({ok:false,error:'JSON_REQUIRED'},415);
    if(Number(request.headers.get('content-length')||0)>8192)return json({ok:false,error:'PAYLOAD_TOO_LARGE'},413);
    let body;
    try {body=await request.json();}catch{return json({ok:false,error:'INVALID_JSON'},400);}
    const ids=body?.productIds, flag=body?.inStock;
    if(!Array.isArray(ids)||ids.length<1||ids.length>100||new Set(ids).size!==ids.length||!ids.every(validId)||typeof flag!=='boolean')return json({ok:false,error:'INVALID_STOCK_CHANGE'},400);
    return json(await writeStock(env,ids,flag,actor));
  }catch(e){console.error('admin live stock error',e);return json({ok:false,error:'STOCK_UNAVAILABLE'},503);}
}
