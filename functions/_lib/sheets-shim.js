/**
 * Read-only stand-in for the Apps Script services used by the admin read path, built from a
 * Google Sheets API snapshot. Any write (setValue, insertSheet, …) throws READ_ONLY so the
 * caller falls back to Apps Script instead of silently diverging.
 */

/** Date-formatted cells come back from the API as serial numbers; the formatted copy tells them apart. */
const DATEISH = /^\s*(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}:\d{2})/;
const SERIAL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** Offset (ms) of a time zone at a given instant, e.g. Asia/Dhaka → +6h. */
export function tzOffsetMs(timeZone, atMs) {
  const d = new Date(atMs);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(atMs / 1000) * 1000;
}

/** Sheets serial (days since 1899-12-30, spreadsheet-local) → Date (absolute), like Apps Script getValues(). */
export function serialToDate(serial, timeZone) {
  const localMs = SERIAL_EPOCH_MS + Math.round(serial * 86400000);
  return new Date(localMs - tzOffsetMs(timeZone, localMs));
}

/** Merge the raw and formatted API copies into Apps Script-like values. */
export function toAppsScriptValues(raw, formatted, timeZone) {
  const rows = Math.max(raw.length, formatted.length);
  const out = [];
  for (let r = 0; r < rows; r++) {
    const a = raw[r] || [], f = formatted[r] || [];
    const width = Math.max(a.length, f.length);
    const row = new Array(width);
    for (let c = 0; c < width; c++) {
      const v = a[c];
      if (v === undefined || v === null) row[c] = '';
      else if (typeof v === 'number' && typeof f[c] === 'string' && DATEISH.test(f[c]) && String(v) !== f[c]) row[c] = serialToDate(v, timeZone);
      else row[c] = v;
    }
    out.push(row);
  }
  return out;
}

function readOnly() { const e = new Error('READ_ONLY'); e.code = 'READ_ONLY'; throw e; }

function pad(n, w = 2) { return String(n).padStart(w, '0'); }
/** Utilities.formatDate for the patterns used by the order code (yyyy MM dd HH mm ss), any IANA zone or GMT±h. */
export function formatDate(date, tz, pattern) {
  let offset;
  const m = /^(?:GMT|UTC)([+-]\d{1,2})(?::?(\d{2}))?$/.exec(String(tz || 'GMT'));
  if (m) offset = (Number(m[1]) * 60 + (m[1].startsWith('-') ? -1 : 1) * Number(m[2] || 0)) * 60000;
  else if (/^(GMT|UTC)$/.test(String(tz))) offset = 0;
  else offset = tzOffsetMs(tz, date.getTime());
  const d = new Date(date.getTime() + offset);
  const map = { yyyy: d.getUTCFullYear(), MM: pad(d.getUTCMonth() + 1), dd: pad(d.getUTCDate()), HH: pad(d.getUTCHours()), mm: pad(d.getUTCMinutes()), ss: pad(d.getUTCSeconds()),
    M: d.getUTCMonth() + 1, d: d.getUTCDate() };
  return String(pattern).replace(/yyyy|MM|dd|HH|mm|ss|M|d/g, (t) => String(map[t]));
}

function makeSheet(ss, name, sheetId, values, grid = {}) {
  const lastRow = (() => { for (let r = values.length - 1; r >= 0; r--) if (values[r].some((v) => v !== '' && v !== null)) return r + 1; return 0; })();
  const lastCol = values.reduce((w, row) => { for (let c = row.length - 1; c >= 0; c--) if (row[c] !== '' && row[c] !== null) return Math.max(w, c + 1); return w; }, 0);
  function cell(r, c) { const row = values[r - 1]; return row && row[c - 1] !== undefined ? row[c - 1] : ''; }
  function range(row, col, numRows = 1, numCols = 1) {
    if (typeof row === 'string') readOnly(); // A1 notation is not used on the read path
    return {
      getValues: () => Array.from({ length: numRows }, (_, i) => Array.from({ length: numCols }, (_, j) => cell(row + i, col + j))),
      getValue: () => cell(row, col),
      getDisplayValues: () => Array.from({ length: numRows }, (_, i) => Array.from({ length: numCols }, (_, j) => String(cell(row + i, col + j)))),
      getNumRows: () => numRows, getNumColumns: () => numCols, getRow: () => row, getColumn: () => col,
      setValue: readOnly, setValues: readOnly, setNumberFormat: readOnly, setBackground: readOnly, setFontColor: readOnly, setFontWeight: readOnly,
      setHorizontalAlignment: readOnly, clearContent: readOnly, setDataValidation: readOnly, setFormula: readOnly, setNote: readOnly, insertCheckboxes: readOnly,
    };
  }
  return {
    getName: () => name, getSheetId: () => sheetId, getParent: () => ss,
    getLastRow: () => lastRow, getLastColumn: () => lastCol, getMaxRows: () => Math.max(lastRow, Number(grid.rowCount) || 1000), getMaxColumns: () => Math.max(lastCol, Number(grid.columnCount) || 26),
    getRange: range, getDataRange: () => range(1, 1, Math.max(lastRow, 1), Math.max(lastCol, 1)),
    insertColumnsAfter: readOnly, insertRowsAfter: readOnly, appendRow: readOnly, deleteRow: readOnly, setFrozenRows: readOnly, clear: readOnly,
  };
}

/**
 * snapshot: { spreadsheetId, url, timeZone, sheets: { [name]: { id, values, rowCount, columnCount } } }
 * Returns the env object for createCore().
 */
export function buildEnv(snapshot) {
  const ss = { getId: () => snapshot.spreadsheetId, getUrl: () => snapshot.url || '', getSpreadsheetTimeZone: () => snapshot.timeZone, insertSheet: readOnly };
  const sheets = {};
  Object.keys(snapshot.sheets).forEach((name) => { const sh = snapshot.sheets[name]; sheets[name] = makeSheet(ss, name, sh.id, sh.values, sh); });
  ss.getSheetByName = (name) => sheets[name] || null;
  ss.getSheets = () => Object.values(sheets);
  ss.getActiveSheet = () => sheets['Online Order'] || Object.values(sheets)[0];
  const props = snapshot.properties || {};
  return {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, openById: (id) => (id === snapshot.spreadsheetId ? ss : readOnly()) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null), setProperty: readOnly, deleteProperty: readOnly }) },
    // No cache on the edge: Apps Script helpers treat a throwing cache as "not cached" and do the real check.
    CacheService: { getScriptCache: () => { throw new Error('NO_CACHE'); } },
    Utilities: { formatDate, sleep: () => {} },
    ScriptApp: { getScriptId: () => snapshot.scriptId || '' },
    LockService: { getScriptLock: readOnly, getUserLock: readOnly },
    Session: { getEffectiveUser: () => ({ getEmail: () => '' }), getScriptTimeZone: () => snapshot.timeZone },
    UrlFetchApp: { fetch: readOnly }, MailApp: { sendEmail: readOnly }, GmailApp: {}, ContentService: {}, HtmlService: {}, DriveApp: {}, CalendarApp: {}, XmlService: {},
    Logger: { log() {} },
    console: { log() {}, warn() {}, error() {} },
  };
}
