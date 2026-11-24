// Cloudflare Pages Functions shared D1 stock logic. No Apps Script dependency.
const ID = /^[A-Za-z0-9_-]{1,90}$/;
const headers = { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store' };
export const json = (body, status=200) => new Response(JSON.stringify(body),{status,headers});
export const validId = id => typeof id === 'string' && ID.test(id);
export function db(env) { if (!env.STOCK_DB) throw new Error('STOCK_DB_NOT_BOUND'); return env.STOCK_DB; }
export async function readStock(env) {
  const rows = await db(env).prepare('SELECT product_id, in_stock, version, updated_at FROM live_stock').all();
  const items = {};
  for (const r of rows.results || []) items[r.product_id] = { inStock:r.in_stock === 1, version:r.version, updatedAt:r.updated_at };
  return items;
}
// All-or-nothing transaction: D1 batch commits writes and audit entries together.
export async function writeStock(env, ids, inStock, actor) {
  const database=db(env), statements=[], value=inStock?1:0;
  for (const id of ids) {
    statements.push(database.prepare('INSERT INTO live_stock_audit(product_id,old_value,new_value,actor) VALUES (?,(SELECT in_stock FROM live_stock WHERE product_id=?),?,?)').bind(id,id,value,actor));
    statements.push(database.prepare('INSERT INTO live_stock(product_id,in_stock,version,updated_at,updated_by) VALUES (?,?,1,CURRENT_TIMESTAMP,?) ON CONFLICT(product_id) DO UPDATE SET in_stock=excluded.in_stock,version=live_stock.version+1,updated_at=CURRENT_TIMESTAMP,updated_by=excluded.updated_by').bind(id,value,actor));
  }
  await database.batch(statements);
  return {ok:true,productIds:ids,inStock};
}
