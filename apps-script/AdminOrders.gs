/**
 * Muslim Abaya — Admin Order Panel API (orders.html / order.html)
 *
 * Code.gs-এর পাশে আলাদা ফাইল। Apps Script-এ সব .gs ফাইল একই scope শেয়ার করে,
 * তাই Code.gs-এর verifyAdminSession_, param_, normalizePhone_ ইত্যাদি এখানে সরাসরি চলে।
 *
 * RecordType (সব POST, Token সহ):
 *   AdminOrderList   — অর্ডার তালিকা + স্ট্যাটাস কাউন্ট
 *   AdminOrderGet    — একটি অর্ডার + আগের/পরের ID + কাস্টমারের অর্ডার ইতিহাস
 *   AdminOrderUpdate — কাস্টমার/প্রাইসিং/স্ট্যাটাস/নোট/অ্যাসাইন সেভ
 *   AdminFraudCheck  — ফোন নম্বরের delivery/cancel ইতিহাস থেকে ঝুঁকি
 *   AdminBlockCustomer — ফোন ব্লক/আনব্লক (Blocked শীট)
 *   AdminSendCourier — Steadfast-এ পার্সেল পাঠানো
 *   AdminOrderStaff  — অ্যাসাইনের জন্য স্টাফ তালিকা (Admins শীট)
 *
 * Online Order শীটের নতুন কলাম (AN থেকে) স্বয়ংক্রিয়ভাবে তৈরি হয়:
 *   AN Admin Note · AO Courier Note · AP Advance · AQ Discount · AR Assigned To · AS Source · AT Courier
 */

// Cols 30–35 are used by Code.gs (Email/FBC/FBP, cart JSON, coupon); the panel starts at 40 (AN).
var ADM_COL_COUPON_CODE = 34;
var ADM_COL_COUPON_DISC = 35;
var ADM_COL_ADMIN_NOTE = 40;
var ADM_COL_COURIER_NOTE = 41;
var ADM_COL_ADVANCE = 42;
var ADM_COL_DISCOUNT = 43;
var ADM_COL_ASSIGNED = 44;
var ADM_COL_SOURCE = 45;
var ADM_COL_COURIER = 46;
var ADM_LAST_COL = 46;

var ADM_STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Fake'];

function admExtraHeaders_() {
  return ['Admin Note', 'Courier Note', 'Advance', 'Discount', 'Assigned To', 'Source', 'Courier'];
}

function admGetSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) throw new Error('NO_SHEET');
  admEnsureHeaders_(sheet);
  return sheet;
}

function admEnsureHeaders_(sheet) {
  var headers = admExtraHeaders_();
  var range = sheet.getRange(1, ADM_COL_ADMIN_NOTE, 1, headers.length);
  var cur = range.getValues()[0];
  var missing = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(cur[i] || '').trim() !== headers[i]) { missing = true; break; }
  }
  if (!missing) return;
  range.setValues([headers]);
  try {
    range.setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  } catch (err) {}
}

function admNum_(v) {
  var n = parseFloat(String(v == null ? '' : v).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function admRowToOrder_(r, rowNumber) {
  var total = admNum_(r[7]);
  var charge = admNum_(r[4]);
  var discount = admNum_(r[ADM_COL_DISCOUNT - 1]);
  var coupon = admNum_(r[ADM_COL_COUPON_DISC - 1]);
  var advance = admNum_(r[ADM_COL_ADVANCE - 1]);
  var design = String(r[6] || '');
  var items = design.split(/\n/).map(function (s) {
    return String(s || '').replace(/^\d+\.\s*/, '').trim();
  }).filter(Boolean);
  return {
    row: rowNumber,
    time: formatCell_(r[0]),
    name: String(r[1] || ''),
    phone: normalizePhone_(r[2]),
    qty: admNum_(r[3]),
    charge: charge,
    address: String(r[5] || ''),
    design: design,
    items: items,
    total: total,
    subtotal: Math.max(0, total - charge + discount + coupon),
    couponCode: String(r[ADM_COL_COUPON_CODE - 1] || ''),
    couponDiscount: coupon,
    discount: discount,
    advance: advance,
    due: Math.max(0, total - advance),
    orderId: String(r[8] || ''),
    status: String(r[9] || 'Pending') || 'Pending',
    tracking: String(r[10] || ''),
    consignmentId: String(r[11] || ''),
    courierStatus: String(r[12] || ''),
    district: String(r[13] || ''),
    payment: String(r[14] || ''),
    txn: String(r[15] || ''),
    customerNote: String(r[16] || ''),
    adminNote: String(r[ADM_COL_ADMIN_NOTE - 1] || ''),
    courierNote: String(r[ADM_COL_COURIER_NOTE - 1] || ''),
    assignedTo: String(r[ADM_COL_ASSIGNED - 1] || ''),
    source: String(r[ADM_COL_SOURCE - 1] || '') || 'Website',
    courier: String(r[ADM_COL_COURIER - 1] || '') || 'Steadfast'
  };
}

function admReadAll_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, ADM_LAST_COL).getValues();
}

function admFindRow_(sheet, orderId) {
  var id = String(orderId || '').trim();
  if (!id) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var ids = sheet.getRange(2, 9, lastRow - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0] || '').trim() === id) return i + 2;
  }
  return 0;
}

// ── Blocked customers ──

function admBlockedSheet_() {
  return ensureSheet_('Blocked', ['Phone', 'Reason', 'BlockedAt', 'BlockedBy']);
}

function admBlockedMap_() {
  var sheet = admBlockedSheet_();
  var map = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return map;
  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    var p = normalizePhone_(data[i][0]);
    if (p) map[p] = String(data[i][1] || '');
  }
  return map;
}

/** Code.gs → handleOnlineOrderPost_ থেকে কল হয়: ব্লক করা নম্বরের অর্ডার নেওয়া হবে না */
function isPhoneBlocked_(phone) {
  var p = normalizePhone_(phone);
  if (!p) return false;
  try {
    return Object.prototype.hasOwnProperty.call(admBlockedMap_(), p);
  } catch (err) {
    return false;
  }
}

function adminBlockCustomer_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var phone = normalizePhone_(param_(e, 'Phone'));
  if (!/^01\d{9}$/.test(phone)) return { ok: false, error: 'INVALID_PHONE', message: 'সঠিক ফোন নম্বর নয়।' };
  var unblock = param_(e, 'Block') === '0';
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = admBlockedSheet_();
    var lastRow = sheet.getLastRow();
    var found = 0;
    if (lastRow >= 2) {
      var phones = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (var i = 0; i < phones.length; i++) {
        if (normalizePhone_(phones[i][0]) === phone) { found = i + 2; break; }
      }
    }
    if (unblock) {
      if (found) sheet.deleteRow(found);
    } else if (!found) {
      appendRow_(sheet, [phone, String(param_(e, 'Reason') || '').slice(0, 200), new Date(), v.email || v.name || 'admin']);
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, phone: phone, blocked: !unblock };
}

// ── Fraud check (নিজের অর্ডার ইতিহাস থেকে) ──

function admHistoryForPhone_(rows, phone, skipOrderId) {
  var stats = { total: 0, delivered: 0, cancelled: 0, fake: 0, returned: 0, pending: 0, active: 0 };
  var recent = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (normalizePhone_(r[2]) !== phone) continue;
    var oid = String(r[8] || '');
    if (skipOrderId && oid === skipOrderId) continue;
    var st = String(r[9] || 'Pending').toLowerCase();
    var cs = String(r[12] || '').toLowerCase();
    stats.total++;
    if (st === 'delivered' || cs === 'delivered') stats.delivered++;
    else if (st === 'fake') stats.fake++;
    else if (st === 'cancelled' || cs === 'cancelled') stats.cancelled++;
    else if (cs.indexOf('return') !== -1) stats.returned++;
    else if (st === 'pending') stats.pending++;
    else stats.active++;
    if (recent.length < 8) {
      recent.push({
        orderId: oid,
        time: formatCell_(r[0]),
        status: String(r[9] || 'Pending'),
        courierStatus: String(r[12] || ''),
        total: admNum_(r[7])
      });
    }
  }
  var failed = stats.cancelled + stats.fake + stats.returned;
  var decided = stats.delivered + failed;
  var rate = decided ? Math.round((stats.delivered / decided) * 100) : null;
  var risk = 'new';
  if (decided) {
    if (stats.fake > 0 || (failed >= 2 && rate < 50)) risk = 'high';
    else if (failed > 0 && rate < 80) risk = 'medium';
    else risk = 'low';
  } else if (stats.total > 0) {
    risk = 'unknown';
  }
  return { stats: stats, successRate: rate, risk: risk, recent: recent };
}

function adminFraudCheck_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var phone = normalizePhone_(param_(e, 'Phone'));
  if (!/^01\d{9}$/.test(phone)) return { ok: false, error: 'INVALID_PHONE', message: 'সঠিক ফোন নম্বর নয়।' };
  var rows = admReadAll_(admGetSheet_());
  var h = admHistoryForPhone_(rows, phone, param_(e, 'OrderId'));
  var blockedMap = admBlockedMap_();
  return {
    ok: true,
    phone: phone,
    stats: h.stats,
    successRate: h.successRate,
    risk: h.risk,
    recent: h.recent,
    blocked: Object.prototype.hasOwnProperty.call(blockedMap, phone),
    blockReason: blockedMap[phone] || '',
    source: 'own-orders'
  };
}

// ── List / Get ──

function adminOrderList_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var limit = parseInt(param_(e, 'Limit'), 10) || 300;
  if (limit < 1) limit = 1;
  if (limit > 1000) limit = 1000;
  var sheet = admGetSheet_();
  var rows = admReadAll_(sheet);
  var blockedMap = admBlockedMap_();
  var todayKey = Utilities.formatDate(new Date(), 'GMT+6', 'yyyy-MM-dd');
  var counts = { all: 0, today: 0 };
  ADM_STATUSES.forEach(function (s) { counts[s] = 0; });
  var orders = [];
  for (var i = rows.length - 1; i >= 0; i--) {
    var r = rows[i];
    if (!r[1] && !r[2]) continue;
    var o = admRowToOrder_(r, i + 2);
    counts.all++;
    if (counts.hasOwnProperty(o.status)) counts[o.status]++;
    if (dayKeyFromCell_(r[0]) === todayKey) counts.today++;
    if (orders.length < limit) {
      o.blocked = Object.prototype.hasOwnProperty.call(blockedMap, o.phone);
      orders.push(o);
    }
  }
  return { ok: true, orders: orders, counts: counts, statuses: ADM_STATUSES, sheetUrl: v.sheetUrl };
}

function adminOrderGet_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var sheet = admGetSheet_();
  var orderId = String(param_(e, 'OrderId') || '').trim();
  var row = admFindRow_(sheet, orderId);
  if (!row) return { ok: false, error: 'NOT_FOUND', message: 'অর্ডার পাওয়া যায়নি।' };
  var vals = sheet.getRange(row, 1, 1, ADM_LAST_COL).getValues()[0];
  var order = admRowToOrder_(vals, row);

  var prevId = '';
  var nextId = '';
  var lastRow = sheet.getLastRow();
  if (row > 2) prevId = String(sheet.getRange(row - 1, 9).getValue() || '');
  if (row < lastRow) nextId = String(sheet.getRange(row + 1, 9).getValue() || '');

  var rows = admReadAll_(sheet);
  var history = admHistoryForPhone_(rows, order.phone, order.orderId);
  var blockedMap = admBlockedMap_();
  order.blocked = Object.prototype.hasOwnProperty.call(blockedMap, order.phone);
  order.blockReason = blockedMap[order.phone] || '';

  return {
    ok: true,
    order: order,
    // prevId = শীটে ঠিক আগের (পুরনো) অর্ডার, nextId = পরের (নতুন) অর্ডার
    prevId: prevId,
    nextId: nextId,
    history: history,
    statuses: ADM_STATUSES,
    couriers: ['Steadfast', 'Pathao', 'RedX', 'Paperfly', 'Manual']
  };
}

// ── Update ──

function admHasParam_(e, key) {
  var p = (e && e.parameter) || {};
  if (Object.prototype.hasOwnProperty.call(p, key)) return true;
  try { return !!(getParams_(e) && Object.prototype.hasOwnProperty.call(getParams_(e), key)); } catch (err) { return false; }
}

function adminOrderUpdate_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var sheet, row, prevStatus, newStatus;
  try {
    sheet = admGetSheet_();
    row = admFindRow_(sheet, param_(e, 'OrderId'));
    if (!row) return { ok: false, error: 'NOT_FOUND', message: 'অর্ডার পাওয়া যায়নি।' };
    var vals = sheet.getRange(row, 1, 1, ADM_LAST_COL).getValues()[0];
    prevStatus = String(vals[9] || 'Pending');

    if (admHasParam_(e, 'Name')) {
      var name = String(param_(e, 'Name') || '').replace(/\s+/g, ' ').trim();
      if (name.length < 2 || name.length > 80) return { ok: false, error: 'INVALID_NAME', message: 'সঠিক নাম দিন।' };
      vals[1] = name;
    }
    if (admHasParam_(e, 'Phone')) {
      var phone = normalizePhone_(param_(e, 'Phone'));
      if (!/^01\d{9}$/.test(phone)) return { ok: false, error: 'INVALID_PHONE', message: 'সঠিক ১১ ডিজিট মোবাইল নম্বর দিন।' };
      vals[2] = phone;
    }
    if (admHasParam_(e, 'Address')) {
      var address = String(param_(e, 'Address') || '').trim();
      if (address.length < 5 || address.length > 400) return { ok: false, error: 'INVALID_ADDRESS', message: 'সঠিক ঠিকানা দিন।' };
      vals[5] = address;
    }

    // প্রাইসিং: subtotal = total - charge + discount + coupon (পুরনো মান দিয়ে), তারপর নতুন মান বসিয়ে total আবার হিসাব
    var oldTotal = admNum_(vals[7]);
    var oldCharge = admNum_(vals[4]);
    var oldDiscount = admNum_(vals[ADM_COL_DISCOUNT - 1]);
    var coupon = admNum_(vals[ADM_COL_COUPON_DISC - 1]);
    var subtotal = Math.max(0, oldTotal - oldCharge + oldDiscount + coupon);
    var charge = admHasParam_(e, 'Charge') ? Math.max(0, admNum_(param_(e, 'Charge'))) : oldCharge;
    var discount = admHasParam_(e, 'Discount') ? Math.max(0, admNum_(param_(e, 'Discount'))) : oldDiscount;
    var advance = admHasParam_(e, 'Advance') ? Math.max(0, admNum_(param_(e, 'Advance'))) : admNum_(vals[ADM_COL_ADVANCE - 1]);
    var total = Math.max(0, subtotal + charge - discount - coupon);
    if (advance > total) return { ok: false, error: 'INVALID_ADVANCE', message: 'অ্যাডভান্স মোট টাকার বেশি হতে পারে না।' };
    vals[4] = charge;
    vals[7] = String(total);
    vals[ADM_COL_DISCOUNT - 1] = discount;
    vals[ADM_COL_ADVANCE - 1] = advance;

    if (admHasParam_(e, 'Status')) {
      var st = String(param_(e, 'Status') || '').trim();
      if (ADM_STATUSES.indexOf(st) === -1) return { ok: false, error: 'INVALID_STATUS', message: 'অবৈধ স্ট্যাটাস।' };
      vals[9] = st;
    }
    if (admHasParam_(e, 'AdminNote')) vals[ADM_COL_ADMIN_NOTE - 1] = String(param_(e, 'AdminNote') || '').slice(0, 500);
    if (admHasParam_(e, 'CourierNote')) vals[ADM_COL_COURIER_NOTE - 1] = String(param_(e, 'CourierNote') || '').slice(0, 300);
    if (admHasParam_(e, 'AssignedTo')) vals[ADM_COL_ASSIGNED - 1] = String(param_(e, 'AssignedTo') || '').slice(0, 80);
    if (admHasParam_(e, 'Courier')) vals[ADM_COL_COURIER - 1] = String(param_(e, 'Courier') || '').slice(0, 40);
    if (!vals[ADM_COL_SOURCE - 1]) vals[ADM_COL_SOURCE - 1] = 'Website';

    // ফোন কলামে শূন্য হারানো ঠেকাতে টেক্সট ফরম্যাট
    sheet.getRange(row, 3).setNumberFormat('@');
    // কলাম B–Q এবং AD–AJ আলাদা লিখি; ছবির কলাম (R–AC) অক্ষত থাকে
    sheet.getRange(row, 2, 1, 16).setValues([vals.slice(1, 17)]);
    sheet.getRange(row, ADM_COL_ADMIN_NOTE, 1, ADM_LAST_COL - ADM_COL_ADMIN_NOTE + 1)
      .setValues([vals.slice(ADM_COL_ADMIN_NOTE - 1, ADM_LAST_COL)]);
    newStatus = String(vals[9]);
  } finally {
    lock.releaseLock();
  }

  // শীটে Status হাতে বদলালে যে onEdit ট্রিগার চলে, API লিখলে তা চলে না — তাই এখানে একই কাজ করি
  var hooks = null;
  if (newStatus.toLowerCase() === 'confirmed' && prevStatus.toLowerCase() !== 'confirmed') {
    hooks = admRunConfirmedHooks_(sheet, row);
  }

  var fresh = admRowToOrder_(sheet.getRange(row, 1, 1, ADM_LAST_COL).getValues()[0], row);
  return { ok: true, order: fresh, hooks: hooks };
}

function admRunConfirmedHooks_(sheet, row) {
  var out = { capi: null, courier: null };
  try {
    var capi = maybeSendConfirmedPurchaseCapiForRow_(sheet, row);
    out.capi = capi && capi.code;
  } catch (err) { out.capi = 'ERR'; }
  try {
    if (isAutoCourierEnabled_() && shouldAutoCourierOnConfirmed_()) {
      var vals = sheet.getRange(row, 1, 1, 17).getValues()[0];
      if (!String(vals[10] || '').trim() && !String(vals[11] || '').trim()) {
        var res = tryAutoCourierForOrder_({
          sheet: sheet,
          row: row,
          orderId: String(vals[8] || ('MA-ROW-' + row)),
          name: String(vals[1] || ''),
          phone: String(vals[2] || ''),
          address: String(vals[5] || ''),
          design: String(vals[6] || ''),
          slotItems: designTextToSlotItems_(String(vals[6] || '')),
          qty: parseInt(String(vals[3] || '0'), 10) || 0,
          total: admNum_(vals[7]) - admNum_(sheet.getRange(row, ADM_COL_ADVANCE).getValue()),
          payment: String(vals[14] || 'Cash On Delivery')
        });
        out.courier = res && res.ok ? 'SENT' : ((res && res.reason) || 'FAIL');
      } else {
        out.courier = 'ALREADY_SENT';
      }
    }
  } catch (err2) { out.courier = 'ERR'; }
  return out;
}

// ── Steadfast ──

function adminSendCourier_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = admGetSheet_();
    var row = admFindRow_(sheet, param_(e, 'OrderId'));
    if (!row) return { ok: false, error: 'NOT_FOUND', message: 'অর্ডার পাওয়া যায়নি।' };
    var vals = sheet.getRange(row, 1, 1, ADM_LAST_COL).getValues()[0];
    var o = admRowToOrder_(vals, row);
    if (o.tracking || o.consignmentId) {
      return { ok: false, error: 'ALREADY_SENT', message: 'ইতিমধ্যে কুরিয়ারে পাঠানো হয়েছে: ' + (o.tracking || o.consignmentId) };
    }
    if (isPhoneBlocked_(o.phone)) {
      return { ok: false, error: 'BLOCKED', message: 'এই কাস্টমার ব্লক করা আছে।' };
    }
    if (!o.name || !o.phone || !o.address) {
      return { ok: false, error: 'MISSING_FIELDS', message: 'নাম, ফোন বা ঠিকানা খালি।' };
    }
    var isCod = /cash\s*on\s*delivery/i.test(o.payment || 'Cash On Delivery');
    var payload = {
      invoice: String(o.orderId || ('MA-ROW-' + row)).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40),
      recipient_name: o.name.slice(0, 100),
      recipient_phone: o.phone,
      recipient_address: o.address.slice(0, 250),
      cod_amount: isCod ? o.due : 0,
      note: (o.courierNote || ('Order ' + o.orderId + ' · Qty ' + o.qty)).slice(0, 200),
      item_description: buildCourierItemDescription_({
        design: o.design,
        slotItems: designTextToSlotItems_(o.design),
        qty: o.qty
      })
    };
    var res;
    try {
      res = steadfastPlaceOrder_(payload);
    } catch (apiErr) {
      return { ok: false, error: 'COURIER_FAIL', message: String(apiErr && apiErr.message ? apiErr.message : apiErr).slice(0, 200) };
    }
    var c = res && res.consignment ? res.consignment : null;
    if (!c) {
      var msg = '';
      try { msg = JSON.stringify(res).slice(0, 200); } catch (jerr) {}
      return { ok: false, error: 'COURIER_FAIL', message: 'Steadfast পার্সেল তৈরি হয়নি। ' + msg };
    }
    sheet.getRange(row, 10, 1, 4).setValues([['Shipped', c.tracking_code || '', c.consignment_id || '', c.status || 'in_review']]);
    sheet.getRange(row, ADM_COL_COURIER).setValue('Steadfast');
    return {
      ok: true,
      tracking: c.tracking_code || '',
      consignmentId: c.consignment_id || '',
      order: admRowToOrder_(sheet.getRange(row, 1, 1, ADM_LAST_COL).getValues()[0], row)
    };
  } finally {
    lock.releaseLock();
  }
}

// ── Staff ──

function adminStaffList_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var sheet = getAdminsSheet_();
  var lastRow = sheet.getLastRow();
  var names = [];
  if (lastRow >= 2) {
    var data = sheet.getRange(2, 1, lastRow - 1, 6).getValues();
    for (var i = 0; i < data.length; i++) {
      var status = String(data[i][5] || 'active').toLowerCase();
      var name = String(data[i][2] || data[i][0] || '').trim();
      if (name && status !== 'disabled' && status !== 'blocked' && names.indexOf(name) === -1) names.push(name);
    }
  }
  return { ok: true, staff: names };
}

// ── Router (Code.gs doPost থেকে কল হয়) ──

function handleAdminOrderRequest_(type, e) {
  try {
    switch (type) {
      case 'AdminOrderList': return adminOrderList_(e);
      case 'AdminOrderGet': return adminOrderGet_(e);
      case 'AdminOrderUpdate': return adminOrderUpdate_(e);
      case 'AdminFraudCheck': return adminFraudCheck_(e);
      case 'AdminBlockCustomer': return adminBlockCustomer_(e);
      case 'AdminSendCourier': return adminSendCourier_(e);
      case 'AdminOrderStaff': return adminStaffList_(e);
    }
  } catch (err) {
    var code = String(err && err.message ? err.message : err);
    if (code === 'NO_SHEET') return { ok: false, error: 'NO_SHEET', message: 'Online Order শীট পাওয়া যায়নি।' };
    return { ok: false, error: 'SERVER_ERROR', message: code.slice(0, 200) };
  }
  return null;
}
