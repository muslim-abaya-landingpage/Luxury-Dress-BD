/** Reads the order spreadsheet through the Google Sheets API and shapes it for sheets-shim.buildEnv(). */
import { toAppsScriptValues } from './sheets-shim.js';

const API = 'https://sheets.googleapis.com/v4/spreadsheets/';
export const READ_SHEETS = ['Online Order', 'Sessions', 'Admins', 'Blocked', 'StockVariants', 'MessengerContacts'];
const META_TTL_MS = 10 * 60 * 1000;
let metaCache = { id: '', at: 0, meta: null };

async function getJson(fetchImpl, url, token) {
  const res = await fetchImpl(url, { headers: { Authorization: 'Bearer ' + token } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error('SHEETS_API_' + res.status); e.status = res.status; throw e; }
  return data;
}

function quote(title) { return "'" + String(title).replace(/'/g, "''") + "'"; }

// Requests that arrive together (a page fires several reads at once) share one sheet read. Only a read
// that started moments ago is shared, so a read issued after a save never gets pre-save data.
const SHARE_MS = 400;
let inflight = { id: '', at: 0, promise: null };

export function loadSnapshot(opts) {
  const nowMs = opts.nowMs || Date.now();
  if (inflight.promise && inflight.id === opts.spreadsheetId && nowMs - inflight.at < SHARE_MS) return inflight.promise;
  const promise = loadSnapshotFresh(opts);
  inflight = { id: opts.spreadsheetId, at: nowMs, promise };
  promise.catch(() => { if (inflight.promise === promise) inflight = { id: '', at: 0, promise: null }; });
  return promise;
}

async function loadSnapshotFresh({ spreadsheetId, token, fetchImpl = fetch, nowMs = Date.now() }) {
  if (metaCache.id !== spreadsheetId || !metaCache.meta || nowMs - metaCache.at > META_TTL_MS) {
    const fields = 'spreadsheetUrl,properties.timeZone,sheets.properties(title,sheetId,gridProperties(rowCount,columnCount))';
    const meta = await getJson(fetchImpl, API + encodeURIComponent(spreadsheetId) + '?fields=' + encodeURIComponent(fields), token);
    metaCache = { id: spreadsheetId, at: nowMs, meta };
  }
  const meta = metaCache.meta;
  const timeZone = (meta.properties && meta.properties.timeZone) || 'Asia/Dhaka';
  const present = (meta.sheets || []).map((s) => s.properties).filter((p) => READ_SHEETS.includes(p.title));
  if (!present.some((p) => p.title === 'Online Order')) throw new Error('NO_SHEET');
  const ranges = present.map((p) => 'ranges=' + encodeURIComponent(quote(p.title))).join('&');
  const base = API + encodeURIComponent(spreadsheetId) + '/values:batchGet?majorDimension=ROWS&' + ranges;
  const [raw, formatted] = await Promise.all([
    getJson(fetchImpl, base + '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER', token),
    getJson(fetchImpl, base + '&valueRenderOption=FORMATTED_VALUE', token),
  ]);
  const sheets = {};
  present.forEach((p, i) => {
    const a = (raw.valueRanges && raw.valueRanges[i] && raw.valueRanges[i].values) || [];
    const f = (formatted.valueRanges && formatted.valueRanges[i] && formatted.valueRanges[i].values) || [];
    const grid = p.gridProperties || {};
    sheets[p.title] = { id: p.sheetId, values: toAppsScriptValues(a, f, timeZone), rowCount: grid.rowCount, columnCount: grid.columnCount };
  });
  return { spreadsheetId, url: meta.spreadsheetUrl || '', timeZone, sheets };
}

export function _resetMetaCache() { metaCache = { id: '', at: 0, meta: null }; inflight = { id: '', at: 0, promise: null }; }
