/**
 * POST /api/admin-read — fast, read-only copy of some Apps Script admin reads (see ALLOWED).
 * Runs the same Apps Script code (functions/_lib/gs-core.js, generated) against the sheet read via the
 * Google Sheets API with a read-only service account. Anything unexpected returns ok:false and the
 * browser falls back to Apps Script, which stays the source of truth (and the only writer).
 *
 * Setup (Cloudflare Pages → Settings → Variables and Secrets):
 *   GOOGLE_SA_JSON  (secret)  service-account key JSON; share the sheet with its client_email as Viewer
 *   SHEET_ID        (optional) defaults to the order sheet below
 */
import { createCore } from '../_lib/gs-core.js';
import { buildEnv } from '../_lib/sheets-shim.js';
import { loadSnapshot } from '../_lib/sheet-snapshot.js';
import { getAccessToken } from '../_lib/google-auth.js';

const DEFAULT_SHEET_ID = '1kHt7Bdd4OnpX0jb1ApBXMZIIYqvmv5q2EyOnPV9HJKo';
// Read-only Apps Script calls the edge may answer (RecordType → generated core function).
const ALLOWED = {
  AdminVerify: (core, e) => core.verifyAdminSession_(core.param_(e, 'Token')),
  AdminOrderList: 'adminOrderList_',
  AdminOrderGet: 'adminOrderGet_',
  AdminOrders: 'listAdminOrders_',
  AdminFraudCheck: 'adminFraudCheck_',
  AdminOrderStaff: 'adminStaffList_',
  AdminCustomerLookup: 'adminCustomerLookup_',
  AdminStockVariantsList: 'getAdminStockVariants_',
  AdminAnalyticsV2: 'getAdminAnalyticsV2_',
};
const FIELDS = ['RecordType', 'Token', 'Limit', 'Cursor', 'OrderId', 'Phone', 'Search', 'StockStatus', 'Category', 'CategoryMap', 'Range', 'From', 'To'];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-MA-Source': 'edge', 'X-Content-Type-Options': 'nosniff' },
  });
}

/** Pure handler (tests inject fetch/now). */
export async function handleAdminRead(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const nowMs = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  if (!env || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);

  let params;
  try {
    const text = await request.text();
    if (text.length > 65536) return json({ ok: false, error: 'TOO_LARGE' }, 413);
    const form = new URLSearchParams(text);
    params = {};
    FIELDS.forEach((k) => { if (form.has(k)) params[k] = String(form.get(k) || '').trim(); });
  } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  const fn = ALLOWED[params.RecordType];
  if (!fn) return json({ ok: false, error: 'UNSUPPORTED' }, 400);
  if (!params.Token) return json({ ok: false, error: 'NO_TOKEN' }, 401);

  try {
    const token = await getAccessToken(env.GOOGLE_SA_JSON, fetchImpl, nowMs);
    const snapshot = await loadSnapshot({ spreadsheetId: env.SHEET_ID || DEFAULT_SHEET_ID, token, fetchImpl, nowMs });
    const core = createCore(buildEnv(snapshot));
    const e = { parameter: params };
    const result = typeof fn === 'function' ? fn(core, e) : core[fn](e);
    // Only successes are served from the edge; auth failures etc. are re-checked by Apps Script.
    if (!result || result.ok !== true) return json({ ok: false, error: 'EDGE_DECLINED', reason: result && result.error || '' }, 409);
    return json(result);
  } catch (err) {
    return json({ ok: false, error: 'EDGE_ERROR', reason: String(err && (err.code || err.message) || 'ERROR').slice(0, 60) }, 503);
  }
}

export const onRequestPost = ({ request, env }) => handleAdminRead(request, env);
export const onRequest = ({ request, env }) => handleAdminRead(request, env);
