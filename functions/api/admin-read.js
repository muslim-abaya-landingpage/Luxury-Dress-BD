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
// Read-only Apps Script calls the edge may answer: RecordType → { run: core function, sheets: tabs it reads }.
const AUTH = ['Sessions', 'Admins'];
const ORDERS = ['Online Order', 'Sessions', 'Admins', 'Blocked'];
const withLogin = (name) => (core, e) => {
  // Inbox/growth handlers expect the caller to have checked the login already (as handleInboxRequest_ does).
  const v = core.verifyAdminSession_(core.param_(e, 'Token'));
  return v.ok ? core[name](e) : v;
};
const ALLOWED = {
  AdminVerify: { run: (core, e) => core.verifyAdminSession_(core.param_(e, 'Token')), sheets: AUTH },
  AdminOrderList: { run: 'adminOrderList_', sheets: ORDERS },
  AdminOrderGet: { run: 'adminOrderGet_', sheets: ORDERS },
  AdminOrders: { run: 'listAdminOrders_', sheets: AUTH.concat('Online Order') },
  AdminFraudCheck: { run: 'adminFraudCheck_', sheets: ORDERS },
  AdminOrderStaff: { run: 'adminStaffList_', sheets: AUTH },
  AdminCustomerLookup: { run: 'adminCustomerLookup_', sheets: ORDERS },
  AdminStockVariantsList: { run: 'getAdminStockVariants_', sheets: AUTH.concat('StockVariants') },
  AdminStockLedgerList: { run: 'getAdminStockLedger_', sheets: AUTH.concat('StockLedger') },
  AdminAnalyticsV2: { run: 'getAdminAnalyticsV2_', sheets: AUTH.concat('Online Order', 'StockVariants') },
  AdminGrowthData: { run: 'getAdminGrowthData_', sheets: AUTH.concat('AbandonedCarts', 'StockWaitlist', 'ReorderOffers') },
  // Which Pages are connected lives in Script Properties (secret tokens) the edge cannot read, so `pages`
  // is left out; the browser only asks the edge for this list when it does not need them (dashboard count).
  InboxList: {
    run: (core, e) => { const r = withLogin('inboxList_')(core, e); if (r.ok) { delete r.pages; r.pagesOmitted = true; } return r; },
    sheets: AUTH.concat('MessengerContacts'),
  },
  // Opening a conversation that still has unread messages needs a write (mark read), which the read-only
  // copy refuses, so those fall back to Apps Script automatically.
  InboxThread: { run: withLogin('inboxThread_'), sheets: AUTH.concat('MessengerContacts', 'MessengerMessages') },
};
const FIELDS = ['RecordType', 'Token', 'Limit', 'Cursor', 'OrderId', 'Phone', 'Search', 'StockStatus', 'Category', 'CategoryMap', 'Range', 'From', 'To', 'Unread', 'PageId', 'PSID', 'Status', 'AssignedTo', 'Q', 'ProductId'];

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
  const route = ALLOWED[params.RecordType];
  if (!route) return json({ ok: false, error: 'UNSUPPORTED' }, 400);
  if (!params.Token) return json({ ok: false, error: 'NO_TOKEN' }, 401);

  try {
    const token = await getAccessToken(env.GOOGLE_SA_JSON, fetchImpl, nowMs);
    const snapshot = await loadSnapshot({ spreadsheetId: env.SHEET_ID || DEFAULT_SHEET_ID, token, sheets: route.sheets, fetchImpl, nowMs });
    const core = createCore(buildEnv(snapshot));
    const e = { parameter: params };
    const result = typeof route.run === 'function' ? route.run(core, e) : core[route.run](e);
    // Only successes are served from the edge; auth failures etc. are re-checked by Apps Script.
    if (!result || result.ok !== true) return json({ ok: false, error: 'EDGE_DECLINED', reason: result && result.error || '' }, 409);
    return json(result);
  } catch (err) {
    // A request that would need a write (e.g. marking a chat read) is simply handed back to Apps Script.
    if (err && err.code === 'READ_ONLY') return json({ ok: false, error: 'EDGE_DECLINED', reason: 'NEEDS_WRITE' }, 409);
    return json({ ok: false, error: 'EDGE_ERROR', reason: String(err && (err.code || err.message) || 'ERROR').slice(0, 60) }, 503);
  }
}

/** GET /api/admin-read?health=1 — reads the sheet end to end but returns no data; used by the hourly monitor. */
// Public and unauthenticated, so one answer is reused for a minute: hammering it cannot burn the Sheets quota.
let healthCache = { at: 0, status: 0, body: null };
export async function handleHealth(env, deps = {}) {
  const now = deps.now ? deps.now() : Date.now();
  if (healthCache.body && now - healthCache.at < 60000) return json(healthCache.body, healthCache.status);
  const res = await handleHealthFresh(env, deps);
  try { healthCache = { at: now, status: res.status, body: await res.clone().json() }; } catch (e) {}
  return res;
}
export function _resetHealthCache() { healthCache = { at: 0, status: 0, body: null }; }

async function handleHealthFresh(env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const started = Date.now();
  if (!env || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  try {
    const token = await getAccessToken(env.GOOGLE_SA_JSON, fetchImpl);
    const snapshot = await loadSnapshot({ spreadsheetId: env.SHEET_ID || DEFAULT_SHEET_ID, token, fetchImpl });
    createCore(buildEnv(snapshot));
    const hasOrders = !!(snapshot.sheets['Online Order'] && snapshot.sheets['Online Order'].values.length > 1);
    return json({ ok: hasOrders, error: hasOrders ? undefined : 'NO_ORDERS_READ', ms: Date.now() - started }, hasOrders ? 200 : 503);
  } catch (err) {
    return json({ ok: false, error: 'EDGE_ERROR', reason: String(err && (err.code || err.message) || 'ERROR').slice(0, 60) }, 503);
  }
}

export const onRequestPost = ({ request, env }) => handleAdminRead(request, env);
export const onRequestGet = ({ request, env }) => (new URL(request.url).searchParams.get('health') === '1'
  ? handleHealth(env) : json({ ok: false, error: 'METHOD' }, 405));
