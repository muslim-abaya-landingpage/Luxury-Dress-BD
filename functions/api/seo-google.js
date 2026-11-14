/**
 * POST /api/seo-google {Token, action:"summary"} — Search Console + GA4 numbers for Admin → SEO Manager (owner only).
 * Uses the server-side Google service account (Pages secret GOOGLE_SA_JSON, already used for the order sheets);
 * no Google key or token ever reaches the browser. Read-only scopes:
 *   Search Console: webmasters.readonly — add the service-account e-mail as a user of the property (free)
 *   GA4:            analytics.readonly  — add the same e-mail as Viewer of the GA4 property, and set its ID
 * The answer says which of the two is not connected yet and shows the e-mail to add.
 */
import { getAccessToken, parseServiceAccount } from '../_lib/google-auth.js';
import { sanitizeSettings } from '../_lib/seo-settings.js';
import { ownerRequest } from './seo-settings.js';

const GSC_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const GA_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

async function call(fetchImpl, token, url, body) {
  const res = await fetchImpl(url, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = Error(res.status === 403 || res.status === 401 ? 'NO_ACCESS' : res.status === 404 ? 'NOT_FOUND' : 'GOOGLE_' + res.status); e.status = res.status; throw e; }
  return data;
}

export async function searchConsole(fetchImpl, token, property, now) {
  const props = property ? [property] : ['sc-domain:muslimabaya.com', 'https://muslimabaya.com/'];
  const end = day(now - 3 * 864e5), start = day(now - 30 * 864e5);
  let lastErr;
  for (const prop of props) {
    const base = 'https://www.googleapis.com/webmasters/v3/sites/' + encodeURIComponent(prop);
    try {
      const q = (dims, rowLimit) => call(fetchImpl, token, base + '/searchAnalytics/query', { startDate: start, endDate: end, dimensions: dims, rowLimit });
      const [total, queries, pages, dates, sitemaps] = await Promise.all([q([], 1), q(['query'], 25), q(['page'], 25), q(['date'], 31), call(fetchImpl, token, base + '/sitemaps').catch(() => ({}))]);
      const row = (r) => ({ key: (r.keys || [])[0] || '', clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr || 0, position: r.position || 0 });
      return {
        connected: true, property: prop, startDate: start, endDate: end,
        totals: row((total.rows || [])[0] || {}),
        queries: (queries.rows || []).map(row), pages: (pages.rows || []).map(row), byDate: (dates.rows || []).map(row),
        sitemaps: (sitemaps.sitemap || []).map((s) => ({ path: s.path, lastSubmitted: s.lastSubmitted || '', lastDownloaded: s.lastDownloaded || '', errors: Number(s.errors) || 0, warnings: Number(s.warnings) || 0, isPending: !!s.isPending })),
      };
    } catch (e) { lastErr = e; }
  }
  return { connected: false, error: (lastErr && lastErr.message) || 'NO_ACCESS' };
}

export async function analytics(fetchImpl, token, propertyId) {
  if (!propertyId) return { connected: false, error: 'NO_PROPERTY_ID' };
  try {
    const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport';
    const range = [{ startDate: '28daysAgo', endDate: 'yesterday' }];
    const [totals, channels, landing] = await Promise.all([
      call(fetchImpl, token, url, { dateRanges: range, metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'screenPageViews' }, { name: 'engagementRate' }] }),
      call(fetchImpl, token, url, { dateRanges: range, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], limit: 10 }),
      call(fetchImpl, token, url, { dateRanges: range, dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }], dimensionFilter: { filter: { fieldName: 'sessionDefaultChannelGroup', stringFilter: { value: 'Organic Search' } } }, limit: 15 }),
    ]);
    const v = (r, i) => Number(((r.rows || [])[0] || { metricValues: [] }).metricValues[i] && r.rows[0].metricValues[i].value) || 0;
    const rows = (r) => (r.rows || []).map((x) => ({ key: x.dimensionValues[0].value, sessions: Number(x.metricValues[0].value) || 0 }));
    return { connected: true, propertyId, totals: { sessions: v(totals, 0), users: v(totals, 1), pageViews: v(totals, 2), engagementRate: v(totals, 3) }, channels: rows(channels), organicLandingPages: rows(landing) };
  } catch (e) { return { connected: false, error: e.message || 'NO_ACCESS' }; }
}

export async function handleSeoGoogle(request, env, deps = {}) {
  if (!env || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  const req = await ownerRequest(request, env, deps);
  if (req.response) return req.response;
  if (req.payload.action !== 'summary') return json({ ok: false, error: 'UNKNOWN_ACTION' }, 400);
  const { fetchImpl, now } = req;
  let saEmail = '';
  try { saEmail = parseServiceAccount(env.GOOGLE_SA_JSON).email; } catch (e) { return json({ ok: false, error: 'SA_JSON_INVALID' }, 503); }
  let settings = {};
  try {
    const origin = new URL(request.url).origin;
    const res = env.ASSETS ? await env.ASSETS.fetch(new Request(origin + '/seo-settings.json')) : await fetchImpl(origin + '/seo-settings.json');
    if (res.ok) settings = sanitizeSettings(await res.json()).settings.global;
  } catch (e) {}
  const [gscToken, gaToken] = await Promise.all([
    getAccessToken(env.GOOGLE_SA_JSON, fetchImpl, now, GSC_SCOPE).catch(() => ''),
    getAccessToken(env.GOOGLE_SA_JSON, fetchImpl, now, GA_SCOPE).catch(() => ''),
  ]);
  const [gsc, ga4] = await Promise.all([
    gscToken ? searchConsole(fetchImpl, gscToken, settings.gscProperty, now) : { connected: false, error: 'TOKEN_FAILED' },
    gaToken ? analytics(fetchImpl, gaToken, settings.ga4PropertyId) : { connected: false, error: 'TOKEN_FAILED' },
  ]);
  return json({ ok: true, serviceAccount: saEmail, gsc, ga4 });
}

export const onRequestPost = ({ request, env }) => handleSeoGoogle(request, env);
