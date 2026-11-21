/**
 * Server-side conversions that run after an order's status changes.
 *
 * 1) GA4 Purchase (Measurement Protocol): sent once, when an order becomes Confirmed,
 *    so GA4 counts only real orders (fake / cancelled orders never become Confirmed).
 *    The browser no longer sends "purchase" to GA4 at checkout (GTM sends "order_placed").
 * 2) Cancel / return: when an order that was already reported as a Purchase later becomes
 *    Cancelled / Returned / Fake, GA4 gets a "refund" for the same transaction_id and Meta gets
 *    a custom "OrderCancelled" event (Meta has no way to subtract a Purchase; the custom event can
 *    be used for audiences and custom conversions). Runs from orderSyncTriggerHandler (every 15 min).
 *
 * Script properties:
 *   GA4_API_SECRET       — GA4 → Admin → Data streams → muslimabaya.com → Measurement Protocol API secrets
 *   GA4_MEASUREMENT_ID   — optional, default G-L2BNEXE0XG
 *
 * Flags are kept in the order's "Tracking Client" JSON cell (logical column 39), not in Notes,
 * because Notes is capped at 220 characters and older markers there can be cut off.
 *   v  = 2 for orders placed after this feature (only those get a server GA4 purchase,
 *        so orders that already got a browser "purchase" are never counted twice)
 *   t  = order time (ms), gc = GA client_id, gs = GA session_id
 *   g4 = GA4 purchase sent, rf = cancel/return events sent
 */

var SC_GA4_DEFAULT_MEASUREMENT_ID = 'G-L2BNEXE0XG';
var SC_GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
var SC_REFUND_STATUSES = { cancelled: 1, canceled: 1, returned: 1, fake: 1 };
var SC_REFUND_SWEEP_ROWS = 400;

function scGa4Config_() {
  var props = PropertiesService.getScriptProperties();
  var mid = String(props.getProperty('GA4_MEASUREMENT_ID') || SC_GA4_DEFAULT_MEASUREMENT_ID).trim();
  var secret = String(props.getProperty('GA4_API_SECRET') || '').trim();
  return { measurementId: /^G-[A-Z0-9]{4,20}$/.test(mid) ? mid : '', apiSecret: secret };
}

function scCleanGaClientId_(value) {
  var v = String(value || '').trim();
  return /^\d{1,20}\.\d{1,20}$/.test(v) ? v : '';
}

function scCleanGaSessionId_(value) {
  var v = String(value || '').trim();
  return /^\d{6,20}$/.test(v) ? v : '';
}

// A stable stand-in client_id when the shopper's browser sent none (ad blocker, cookies off).
// GA4 still counts the revenue; it just can't tie it to the visit.
function scFallbackClientId_(orderId) {
  var h = SHA256_Hash('ma-ga4|' + String(orderId || ''));
  var a = parseInt(h.slice(0, 8), 16) % 2000000000;
  var b = parseInt(h.slice(8, 16), 16) % 2000000000;
  return String(a + 1) + '.' + String(b + 1);
}

function scGa4ItemsFromCartJson_(raw) {
  var out = [];
  try {
    var items = JSON.parse(String(raw || '') || '[]');
    if (!Array.isArray(items)) return out;
    for (var i = 0; i < items.length && out.length < 50; i++) {
      var it = items[i] || {};
      var id = String(it.id || '').trim().slice(0, 100);
      var name = String(it.name || '').trim().slice(0, 100);
      if (!id && !name) continue;
      var o = { quantity: Math.max(1, parseInt(it.qty, 10) || 1) };
      if (id) o.item_id = id;
      if (name) o.item_name = name;
      var price = parseFloat(it.price);
      if (price > 0) o.price = price;
      var cat = String(it.category || '').trim().slice(0, 100);
      if (cat) o.item_category = cat;
      var variant = [it.size, it.color].map(function (x) { return String(x || '').trim(); }).filter(Boolean).join(' / ').slice(0, 100);
      if (variant) o.item_variant = variant;
      out.push(o);
    }
  } catch (err) {}
  return out;
}

function scPostGa4_(clientId, sessionId, timestampMs, eventName, params) {
  var cfg = scGa4Config_();
  if (!cfg.measurementId || !cfg.apiSecret) return { ok: false, code: 'GA4_CONFIG_MISSING' };
  var ev = { name: eventName, params: params || {} };
  if (sessionId) ev.params.session_id = sessionId;
  ev.params.engagement_time_msec = 1;
  var body = { client_id: clientId, events: [ev] };
  // GA4 accepts back-dated events up to 72 hours; use the order time so the event joins the visit.
  if (timestampMs && Date.now() - timestampMs < 70 * 3600 * 1000 && timestampMs <= Date.now()) {
    body.timestamp_micros = String(Math.floor(timestampMs) * 1000);
  }
  var url = SC_GA4_ENDPOINT + '?measurement_id=' + encodeURIComponent(cfg.measurementId) +
    '&api_secret=' + encodeURIComponent(cfg.apiSecret);
  var res = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json',
    payload: JSON.stringify(body), muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  return code >= 200 && code < 300 ? { ok: true, code: 'OK' } : { ok: false, code: 'GA4_HTTP_' + code };
}

// Called from maybeSendConfirmedPurchaseCapiForRow_ (already holding the script lock).
// vals = readOnlineOrderRows_(sheet, row, 1, 17)[0]
function sendGa4ConfirmedPurchaseForRow_(sheet, row, vals) {
  var info = readOnlineOrderTrackingInfo_(sheet, row);
  if (!(Number(info.v) >= 2)) return { ok: false, code: 'GA4_OLD_ORDER' };
  if (info.g4) return { ok: true, code: 'ALREADY_SENT' };
  var orderId = String(vals[8] || ('MA-ROW-' + row)).trim();
  var value = parseOrderValue_(vals[7]);
  var params = { transaction_id: orderId, currency: 'BDT', value: value };
  var items = [];
  try { items = scGa4ItemsFromCartJson_(sheet.getRange(row, onlineOrderColumn_(sheet, 33)).getValue()); } catch (cartErr) {}
  if (items.length) params.items = items;
  var clientId = scCleanGaClientId_(info.gc) || scFallbackClientId_(orderId);
  var res = scPostGa4_(clientId, scCleanGaSessionId_(info.gs), Number(info.t) || 0, 'purchase', params);
  if (res.ok) setOnlineOrderTrackingFlags_(sheet, row, { g4: 1 });
  return res;
}

function scSendCancelEventsForRow_(sheet, row, vals, info, status) {
  var orderId = String(vals[8] || ('MA-ROW-' + row)).trim();
  var value = parseOrderValue_(vals[7]);
  var notes = String(vals[16] || '');
  var out = { ga4: 'SKIP', meta: 'SKIP' };
  if (info.g4) {
    var clientId = scCleanGaClientId_(info.gc) || scFallbackClientId_(orderId);
    var g = scPostGa4_(clientId, '', 0, 'refund', { transaction_id: orderId, currency: 'BDT', value: value });
    out.ga4 = g.code;
    if (!g.ok) return { ok: false, detail: out };
  }
  if (notes.indexOf('META_PURCHASE_SENT') !== -1 || notes.indexOf('CAPI_OK') !== -1) {
    var metaVals = sheet.getRange(row, onlineOrderColumn_(sheet, 30), 1, 3).getValues()[0];
    var data = {
      Name: String(vals[1] || ''), Phone: String(vals[2] || ''), Email: String(metaVals[0] || '').trim(),
      FBC: String(metaVals[1] || '').trim(), FBP: String(metaVals[2] || '').trim(),
      Total: String(vals[7] || '0'), Design: String(vals[6] || ''),
      ExternalID: normalizePhone_(String(vals[2] || '')), EventSourceUrl: 'https://muslimabaya.com/checkout',
      ClientIP: info.ip || '', ClientUserAgent: info.ua || ''
    };
    var m = sendToFacebookCAPI(data, 'cancel_' + orderId, 'OrderCancelled');
    out.meta = m && m.code;
    if (!(m && m.ok)) return { ok: false, detail: out };
  }
  return { ok: true, detail: out, status: status };
}

/**
 * Every 15 minutes: orders that were reported as a Purchase and are now Cancelled / Returned / Fake.
 * Each order is handled once (flag rf). Only the newest SC_REFUND_SWEEP_ROWS rows are checked.
 */
function serverConversionsRefundSweep_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss && ss.getSheetByName('Online Order');
  if (!sheet) return { ok: false, code: 'NO_SHEET' };
  var last = sheet.getLastRow();
  if (last < 2) return { ok: true, sent: 0 };
  var first = Math.max(2, last - SC_REFUND_SWEEP_ROWS + 1);
  var rows = readOnlineOrderRows_(sheet, first, last - first + 1, 17);
  var col = onlineOrderColumn_(sheet, ONLINE_ORDER_TRACKING_CLIENT_COL);
  if (sheet.getMaxColumns() < col ||
      String(sheet.getRange(1, col).getValue() || '').trim() !== ONLINE_ORDER_TRACKING_CLIENT_HEADER) {
    return { ok: true, sent: 0 };
  }
  var cells = sheet.getRange(first, col, last - first + 1, 1).getValues();
  var sent = 0, failed = 0;
  for (var i = 0; i < rows.length; i++) {
    var status = String(rows[i][9] || '').toLowerCase().trim();
    if (!SC_REFUND_STATUSES[status]) continue;
    var info = scParseTrackingInfo_(cells[i][0]);
    // Only orders placed after this feature went live (v2), so old orders are not re-reported.
    if (info.rf || !(Number(info.v) >= 2)) continue;
    var notes = String(rows[i][16] || '');
    var wasReported = info.g4 || notes.indexOf('META_PURCHASE_SENT') !== -1 || notes.indexOf('CAPI_OK') !== -1;
    if (!wasReported) continue;
    var row = first + i;
    try {
      var r = scSendCancelEventsForRow_(sheet, row, rows[i], info, status);
      if (r.ok) { setOnlineOrderTrackingFlags_(sheet, row, { rf: 1 }); sent++; }
      else failed++;
    } catch (err) { failed++; }
    if (sent + failed >= 30) break;
  }
  return { ok: true, sent: sent, failed: failed };
}

function scParseTrackingInfo_(raw) {
  try {
    var p = JSON.parse(String(raw || '') || '{}');
    return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
  } catch (err) { return {}; }
}
