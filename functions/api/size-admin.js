/**
 * POST /api/size-admin — the Size Manager admin API (owner only). Reads and edits the size_* tables in D1
 * (binding STOCK_DB) through functions/_lib/size-store.js; the login is checked against the admin sheet exactly
 * like /api/live-publish. Customers never reach these tables: the website only gets the published copy
 * from GET /api/size-config.
 * Body: JSON {Token, action, ...}. Actions:
 *   draft                                   → {config, updatedAt, active: {version, publishedAt} | null}
 *   versions                                → {versions: [...]}
 *   saveTemplate {template, expectedUpdatedAt?}
 *   duplicateTemplate {from, id, name_bn?, name_en?}
 *   deleteTemplate {id}
 *   saveCategory {category: {category_key, template_id, enabled}}
 *   saveOverride {override: {product_id, template_id?, enabled?, use_template?, fields?}}
 *   deleteOverride {product_id}
 *   publish {note?}                         → {version}
 *   rollback {version}                      → {version}
 */
import { createCore } from '../_lib/gs-core.js';
import { buildEnv } from '../_lib/sheets-shim.js';
import { loadSnapshot } from '../_lib/sheet-snapshot.js';
import { getAccessToken } from '../_lib/google-auth.js';
import * as store from '../_lib/size-store.js';

const DEFAULT_SHEET_ID = '1kHt7Bdd4OnpX0jb1ApBXMZIIYqvmv5q2EyOnPV9HJKo';
const MAX_BODY = 256 * 1024;
// Errors the admin panel can show; anything else is reported as SAVE_FAILED without details.
const USER_ERRORS = /^(BAD_[A-Z_]+|NO_FIELDS|TOO_MANY_[A-Z]+|FIELD_HAS_NO_CHOICES|UNKNOWN_[A-Z]+|TEMPLATE_IN_USE|CONFLICT|[A-Z_]+_TEMPLATE_MISSING|TEMPLATE_EXISTS)$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

/** Owner login check (same rules as Apps Script). Returns {who} or {response}. */
async function checkOwner(token, env, fetchImpl, now) {
  try {
    const access = await getAccessToken(env.GOOGLE_SA_JSON, fetchImpl, now);
    const snapshot = await loadSnapshot({ spreadsheetId: env.SHEET_ID || DEFAULT_SHEET_ID, token: access, sheets: ['Sessions', 'Admins'], fetchImpl, nowMs: now });
    const core = createCore(buildEnv(snapshot));
    const who = core.verifyAdminSession_(token);
    if (!who || !who.ok) return { response: json({ ok: false, error: 'NOT_LOGGED_IN' }, 401) };
    if (core.requireOwnerAdmin_(who)) return { response: json({ ok: false, error: 'OWNER_ONLY' }, 403) };
    return { who };
  } catch (e) {
    return { response: json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503) };
  }
}

async function run(db, p, ctx) {
  switch (p.action) {
    case 'draft': {
      const { config, updatedAt } = await store.readDraft(db);
      const active = await store.readActive(db);
      return { config, updatedAt, active: active ? { version: active.version, publishedAt: active.publishedAt } : null };
    }
    case 'versions':
      return { versions: await store.listVersions(db) };
    case 'saveTemplate':
      return { template: await store.saveTemplate(db, p.template, Object.assign({ expectedUpdatedAt: p.expectedUpdatedAt }, ctx)) };
    case 'duplicateTemplate': {
      const { config } = await store.readDraft(db);
      const from = config.templates[String(p.from || '')];
      if (!from) throw Object.assign(new Error('UNKNOWN_TEMPLATE'), { code: 'UNKNOWN_TEMPLATE' });
      if (config.templates[String(p.id || '')]) throw Object.assign(new Error('TEMPLATE_EXISTS'), { code: 'TEMPLATE_EXISTS' });
      const copy = Object.assign({}, from, { id: p.id, name_bn: p.name_bn != null ? p.name_bn : from.name_bn, name_en: p.name_en != null ? p.name_en : from.name_en });
      return { template: await store.saveTemplate(db, copy, ctx) };
    }
    case 'deleteTemplate':
      await store.deleteTemplate(db, String(p.id || ''), ctx);
      return {};
    case 'saveCategory':
      return { category: await store.saveCategory(db, p.category, ctx) };
    case 'saveOverride':
      return { override: await store.saveOverride(db, p.override, ctx) };
    case 'deleteOverride':
      await store.deleteOverride(db, p.product_id, ctx);
      return {};
    case 'publish':
      return { version: await store.publish(db, Object.assign({ note: p.note || '' }, ctx)) };
    case 'rollback':
      return { version: await store.rollback(db, Object.assign({ version: p.version }, ctx)) };
    default:
      throw Object.assign(new Error('BAD_ACTION'), { code: 'BAD_ACTION' });
  }
}

export async function handleSizeAdmin(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  if (!env || !env.STOCK_DB || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  let payload;
  try {
    const body = await request.text();
    if (body.length > MAX_BODY) return json({ ok: false, error: 'TOO_LARGE' }, 413);
    payload = JSON.parse(body);
  } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  if (!payload || typeof payload !== 'object') return json({ ok: false, error: 'BAD_REQUEST' }, 400);
  const token = String(payload.Token || '').trim();
  if (!token) return json({ ok: false, error: 'NO_TOKEN' }, 401);

  const auth = await checkOwner(token, env, fetchImpl, now);
  if (auth.response) return auth.response;
  const actor = String(auth.who.email || auth.who.phone || 'owner').slice(0, store.LIMITS.actor);

  try {
    const out = await run(env.STOCK_DB, payload, { now, actor });
    return json(Object.assign({ ok: true }, out));
  } catch (e) {
    const code = String(e && (e.code || e.message) || '');
    if (USER_ERRORS.test(code)) return json({ ok: false, error: code }, code === 'CONFLICT' ? 409 : 400);
    if (/no such table/i.test(code)) return json({ ok: false, error: 'NOT_MIGRATED' }, 503);
    return json({ ok: false, error: 'SAVE_FAILED' }, 503);
  }
}

export const onRequestPost = ({ request, env }) => handleSizeAdmin(request, env);
