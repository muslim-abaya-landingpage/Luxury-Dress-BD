/*
 * Cursor-paged order list example. Not wired into the live Apps Script deployment.
 * Requires existing helpers/constants from Code.gs + AdminOrders.gs:
 *   verifyAdminSession_(), param_(), admGetSheet_(), readOnlineOrderRows_(),
 *   onlineOrderColumn_(), admRowToOrder_(), admBlockedMap_(), dayKeyFromCell_(),
 *   ADM_STATUSES, ADM_LAST_COL
 * Route inside handleAdminOrderRequest_():
 *   case 'AdminOrderListV2': return adminOrderListV2_(e);
 */
var ADM_ORDER_PAGE_MAX_ = 100;
var ADM_ORDER_SUMMARY_TTL_SEC_ = 20;
var ADM_BLOCKED_MAP_TTL_SEC_ = 20;

function admCursorSignatureV2_(encoded) {
  var secret = PropertiesService.getScriptProperties().getProperty('AUTH_SECRET');
  if (!secret) throw new Error('AUTH_NOT_CONFIGURED');
  var sig = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, encoded, secret, Utilities.Charset.UTF_8);
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/g, '');
}

function admConstantTimeEqualV2_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function admCursorEncodeV2_(payload) {
  var encoded = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8).replace(/=+$/g, '');
  return encoded + '.' + admCursorSignatureV2_(encoded);
}

function admCursorDecodeV2_(token, lastRow) {
  if (!token) return { version: 1, maxRow: lastRow, beforeRow: lastRow };
  try {
    token = String(token);
    if (token.length > 512) return null;
    var parts = token.split('.');
    if (parts.length !== 2 || !admConstantTimeEqualV2_(parts[1], admCursorSignatureV2_(parts[0]))) return null;
    var bytes = Utilities.base64DecodeWebSafe(parts[0]);
    var value = JSON.parse(Utilities.newBlob(bytes).getDataAsString('UTF-8'));
    if (!value || value.version !== 1 || !Number.isInteger(value.maxRow) || !Number.isInteger(value.beforeRow) ||
        value.maxRow < 2 || value.maxRow > lastRow || value.beforeRow < 2 || value.beforeRow > value.maxRow) return null;
    return value;
  } catch (err) { return null; }
}

function admOrderSummaryV2_(sheet, lastRow) {
  var empty = { counts: { all: 0, today: 0 }, statuses: ADM_STATUSES, computedAt: new Date().toISOString() };
  ADM_STATUSES.forEach(function (status) { empty.counts[status] = 0; });
  if (lastRow < 2) return empty;

  var props = PropertiesService.getScriptProperties();
  var revision = props.getProperty('ADMIN_ORDER_SUMMARY_REV_V2') || '0';
  var key = 'adm_order_sum_v2_' + sheet.getSheetId() + '_' + lastRow + '_' + revision;
  var cache = CacheService.getScriptCache();
  var cached = cache.get(key);
  if (cached) { try { return JSON.parse(cached); } catch (ignore) {} }

  var rowCount = lastRow - 1;
  // Read only A:C (valid-order test + timestamp) and the physical status column,
  // rather than materializing all 46 order columns solely to calculate the tabs.
  var core = sheet.getRange(2, 1, rowCount, 3).getValues();
  var statusCol = onlineOrderColumn_(sheet, 10);
  var statusValues = sheet.getRange(2, statusCol, rowCount, 1).getDisplayValues();
  var todayKey = Utilities.formatDate(new Date(), 'GMT+6', 'yyyy-MM-dd');
  var counts = { all: 0, today: 0 };
  ADM_STATUSES.forEach(function (status) { counts[status] = 0; });
  for (var i = 0; i < rowCount; i++) {
    if (!core[i][1] && !core[i][2]) continue;
    counts.all++;
    var status = String(statusValues[i][0] || 'Pending').trim() || 'Pending';
    if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status]++;
    if (dayKeyFromCell_(core[i][0]) === todayKey) counts.today++;
  }
  var result = { counts: counts, statuses: ADM_STATUSES, computedAt: new Date().toISOString(), snapshotLastRow: lastRow };
  try { cache.put(key, JSON.stringify(result), ADM_ORDER_SUMMARY_TTL_SEC_); } catch (ignoreCache) {}
  return result;
}

function admBlockedMapCachedV2_() {
  var cache = CacheService.getScriptCache();
  var key = 'adm_blocked_map_v2';
  var cached = cache.get(key);
  if (cached) { try { return JSON.parse(cached); } catch (ignore) {} }
  var map = admBlockedMap_();
  try { cache.put(key, JSON.stringify(map), ADM_BLOCKED_MAP_TTL_SEC_); } catch (ignoreCache) {}
  return map;
}

// Call after each script-owned order create/update/courier status write.
// Direct edits made in Sheets are picked up when the short cache expires.
function admBumpOrderSummaryRevisionV2_() {
  PropertiesService.getScriptProperties().setProperty('ADMIN_ORDER_SUMMARY_REV_V2', Utilities.getUuid());
}

function adminOrderListV2_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var limit = parseInt(param_(e, 'Limit'), 10) || 50;
  limit = Math.max(1, Math.min(ADM_ORDER_PAGE_MAX_, limit));

  var sheet = admGetSheet_();
  var lastRow = sheet.getLastRow();
  var summary = admOrderSummaryV2_(sheet, lastRow);
  if (lastRow < 2) return { ok: true, orders: [], count: 0, totalCount: 0, counts: summary.counts, statuses: ADM_STATUSES, nextCursor: '', hasMore: false, sheetUrl: v.sheetUrl };

  var cursor = admCursorDecodeV2_(param_(e, 'Cursor'), lastRow);
  if (!cursor) return { ok: false, error: 'INVALID_CURSOR', message: 'পেজিং cursor আর বৈধ নেই। প্রথম পৃষ্ঠা রিফ্রেশ করুন।' };
  var endRow = Math.min(cursor.beforeRow, cursor.maxRow);
  if (endRow < 2) return { ok: true, orders: [], count: 0, totalCount: summary.counts.all, counts: summary.counts, statuses: ADM_STATUSES, nextCursor: '', hasMore: false, sheetUrl: v.sheetUrl };
  var startRow = Math.max(2, endRow - limit + 1);
  var rows = readOnlineOrderRows_(sheet, startRow, endRow - startRow + 1, ADM_LAST_COL);
  var blocked = admBlockedMapCachedV2_();
  var orders = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (!r[1] && !r[2]) continue;
    var full = admRowToOrder_(r, startRow + i);
    // List projection only: AdminOrderGet remains the authorized full-detail endpoint.
    // Omit address, transaction ID, private customer/courier notes and raw design text.
    orders.push({
      row: full.row, time: full.time, name: full.name, phone: full.phone,
      qty: full.qty, charge: full.charge, size: full.size, items: full.items,
      total: full.total, advance: full.advance, orderId: full.orderId,
      status: full.status, tracking: full.tracking, courierStatus: full.courierStatus,
      district: full.district, payment: full.payment, assignedTo: full.assignedTo,
      courier: full.courier, adminNote: full.adminNote,
      blocked: Object.prototype.hasOwnProperty.call(blocked, full.phone)
    });
  }
  var hasMore = startRow > 2;
  var nextCursor = hasMore ? admCursorEncodeV2_({ version: 1, maxRow: cursor.maxRow, beforeRow: startRow - 1 }) : '';
  return {
    ok: true, orders: orders, count: orders.length, totalCount: summary.counts.all,
    counts: summary.counts, statuses: ADM_STATUSES, nextCursor: nextCursor,
    hasMore: hasMore, snapshotLastRow: cursor.maxRow, sheetUrl: v.sheetUrl
  };
}
