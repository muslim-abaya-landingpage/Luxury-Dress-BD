/**
 * POST /api/global-attributes — owner-only reusable product attribute registry.
 * Actions: {Token, action:"read"} or {Token, action:"save", revision, attributes}.
 * This registry is additive and separate from the live product catalog.
 */
import { isOwner, isOwnerCached } from '../_lib/owner-auth.js';

const MAX_ATTRIBUTES = 40;
const MAX_TERMS = 100;
const RESERVED = new Set(['type', 'color', 'body', 'length', 'sleeve', 'palazzo', 'size']);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function cleanAttributes(input) {
  if (!Array.isArray(input) || input.length > MAX_ATTRIBUTES) throw Error('INVALID_ATTRIBUTES');
  const ids = new Set(), names = new Set();
  return input.map((raw) => {
    if (!raw || typeof raw !== 'object') throw Error('INVALID_ATTRIBUTE');
    const id = String(raw.id || '').trim().toLowerCase();
    const name = String(raw.name || '').trim().replace(/\s+/g, ' ');
    if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(id) || RESERVED.has(id)) throw Error('INVALID_ATTRIBUTE_ID');
    if (!name || name.length > 60) throw Error('INVALID_ATTRIBUTE_NAME');
    if (ids.has(id) || names.has(name.toLocaleLowerCase())) throw Error('DUPLICATE_ATTRIBUTE');
    ids.add(id); names.add(name.toLocaleLowerCase());
    if (!Array.isArray(raw.terms) || raw.terms.length > MAX_TERMS) throw Error('INVALID_TERMS');
    const termIds = new Set(), termNames = new Set();
    const terms = raw.terms.map((term) => {
      const termName = String(term && term.name || '').trim().replace(/\s+/g, ' ');
      const termId = String(term && term.id || '').trim().toLowerCase();
      if (!termName || termName.length > 60 || !/^[a-z0-9][a-z0-9_-]{0,49}$/.test(termId)) throw Error('INVALID_TERM');
      if (termIds.has(termId) || termNames.has(termName.toLocaleLowerCase())) throw Error('DUPLICATE_TERM');
      termIds.add(termId); termNames.add(termName.toLocaleLowerCase());
      return { id: termId, name: termName };
    });
    return { id, name, terms, variation: raw.variation === true, visible: raw.visible !== false };
  });
}
export async function handleGlobalAttributes(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  if (!env || !env.STOCK_DB || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  let payload;
  try { payload = await request.json(); } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  const token = String(payload && payload.Token || '').trim();
  if (!token) return json({ ok: false, error: 'NO_TOKEN' }, 401);
  try {
    const denied = deps.authorize
      ? await deps.authorize(token, env)
      : await isOwnerCached(token, now, () => isOwner(token, env, fetchImpl, now));
    if (denied === 'NOT_LOGGED_IN') return json({ ok: false, error: denied }, 401);
    if (denied) return json({ ok: false, error: denied }, 403);
  } catch (e) { return json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503); }

  const db = env.STOCK_DB;
  try {
    await db.prepare("CREATE TABLE IF NOT EXISTS global_product_attributes (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL DEFAULT 0, attributes_json TEXT NOT NULL DEFAULT '[]', updated_at INTEGER NOT NULL DEFAULT 0)").run();
    const row = await db.prepare('SELECT revision, attributes_json, updated_at FROM global_product_attributes WHERE id = 1').first();
    const current = row ? { revision: Number(row.revision) || 0, attributes: JSON.parse(row.attributes_json || '[]'), updatedAt: Number(row.updated_at) || 0 } : { revision: 0, attributes: [], updatedAt: 0 };
    if (payload.action === 'read') return json({ ok: true, ...current });
    if (payload.action !== 'save') return json({ ok: false, error: 'INVALID_ACTION' }, 400);
    if (!Number.isInteger(payload.revision) || payload.revision !== current.revision) return json({ ok: false, error: 'REVISION_CONFLICT', ...current }, 409);
    let attributes;
    try { attributes = cleanAttributes(payload.attributes); } catch (e) { return json({ ok: false, error: e.message || 'INVALID_ATTRIBUTES' }, 400); }
    const nextRevision = current.revision + 1;
    const result = await db.prepare('INSERT INTO global_product_attributes (id, revision, attributes_json, updated_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision, attributes_json=excluded.attributes_json, updated_at=excluded.updated_at WHERE global_product_attributes.revision = ?')
      .bind(nextRevision, JSON.stringify(attributes), now, current.revision).run();
    if (result && result.meta && result.meta.changes === 0) {
      const latest = await db.prepare('SELECT revision, attributes_json, updated_at FROM global_product_attributes WHERE id = 1').first();
      return json({ ok: false, error: 'REVISION_CONFLICT', revision: Number(latest && latest.revision) || 0, attributes: JSON.parse(latest && latest.attributes_json || '[]'), updatedAt: Number(latest && latest.updated_at) || 0 }, 409);
    }
    return json({ ok: true, revision: nextRevision, attributes, updatedAt: now });
  } catch (e) { return json({ ok: false, error: 'SAVE_FAILED' }, 503); }
}
export const onRequestPost = ({ request, env }) => handleGlobalAttributes(request, env);
