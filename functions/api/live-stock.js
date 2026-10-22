import {json, readStock} from '../_lib/live-stock-d1.js';
export async function onRequestGet({env}) {
  try { return json({ok:true,items:await readStock(env)}); }
  catch(e) { console.error('live stock read failed',e); return json({ok:false,error:'STOCK_UNAVAILABLE'},503); }
}
export function onRequest() { return json({ok:false,error:'METHOD_NOT_ALLOWED'},405); }
