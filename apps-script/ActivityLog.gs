/**
 * Admin activity log: who changed what, and when.
 * doPost stores the request in adminActivityRequest_; jsonOut_ calls adminActivityLog_
 * with the response. Only successful CHANGES are written (no reads, no logins), and only a
 * short whitelist of fields — never tokens, passwords, file contents or full payloads.
 * Sheet: "Admin Activity". Reading it (AdminActivityList) is owner-only.
 */
var adminActivityRequest_ = null;
var adminActivityDone_ = false;
var ADMIN_ACTIVITY_SHEET_ = 'Admin Activity';
var ADMIN_ACTIVITY_HEADERS_ = ['Time', 'Admin', 'Role', 'Action', 'Target', 'Details'];
var ADMIN_ACTIVITY_LABELS_ = {
  AdminOrderUpdate: 'অর্ডার আপডেট', AdminOrderCreate: 'নতুন অর্ডার', AdminManualOrderCreate: 'নতুন অর্ডার (ম্যানুয়াল)',
  AdminSendCourier: 'কুরিয়ারে পাঠানো', AdminBlockCustomer: 'কাস্টমার ব্লক/আনব্লক',
  AdminCatalogPublish: 'পণ্য পাবলিশ', AdminPublishFile: 'ফাইল পাবলিশ', AdminUploadImage: 'ছবি আপলোড', AdminDeleteImage: 'ছবি মুছে ফেলা',
  AdminLiveStockSet: 'লাইভ স্টক বদল', AdminStockSet: 'স্টক বদল', AdminStockVariantSave: 'স্টক (রং/সাইজ) বদল',
  AdminStockQuickAdjust: 'স্টক দ্রুত বদল', AdminStockCsvCommit: 'স্টক CSV ইমপোর্ট', AdminStockMigrate: 'স্টক মাইগ্রেশন',
  AdminStaffSave: 'স্টাফ যোগ/বদল', AdminStaffDelete: 'স্টাফ মুছে ফেলা', AdminGrowthDismiss: 'গ্রোথ আইটেম মুছে ফেলা',
  AdminSetupAction: 'সেটআপ কাজ', AdminOperationsSave: 'হিসাব/রিটার্ন সেভ', AdminProductCostsSave: 'পণ্যের কেনা দাম সেভ'
};
var ADMIN_ACTIVITY_FIELDS_ = ['OrderId', 'Status', 'CourierStatus', 'Block', 'Phone', 'ProductId', 'Variant', 'Available', 'Reason',
  'Path', 'Message', 'Action', 'Email', 'Role', 'Kind', 'Count'];

function adminActivityText_(value, max) {
  var s = String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim();
  if (/^[=+\-@]/.test(s)) s = "'" + s; // never let the sheet treat it as a formula
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function adminActivityLog_(response) {
  var e = adminActivityRequest_;
  if (adminActivityDone_ || !e || !response || response.ok !== true) return;
  var type = String(param_(e, 'RecordType') || '');
  if (!Object.prototype.hasOwnProperty.call(ADMIN_ACTIVITY_LABELS_, type)) return;
  adminActivityDone_ = true;
  try {
    var v = verifyAdminSession_(param_(e, 'Token'));
    if (!v || !v.ok) return;
    var details = [];
    ADMIN_ACTIVITY_FIELDS_.forEach(function (key) {
      var val = param_(e, key);
      if (val !== '' && val != null) details.push(key + '=' + adminActivityText_(val, 80));
    });
    if (type === 'AdminCatalogPublish') {
      try {
        var payload = JSON.parse(param_(e, 'Payload') || '{}');
        if (payload && payload.message) details.push('Message=' + adminActivityText_(payload.message, 120));
      } catch (pe) {}
    }
    var target = param_(e, 'OrderId') || param_(e, 'ProductId') || param_(e, 'Phone') || param_(e, 'Path') || param_(e, 'Email') || response.orderId || '';
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(ADMIN_ACTIVITY_SHEET_);
    if (!sh) {
      sh = ss.insertSheet(ADMIN_ACTIVITY_SHEET_);
      sh.getRange(1, 1, 1, ADMIN_ACTIVITY_HEADERS_.length).setValues([ADMIN_ACTIVITY_HEADERS_]);
      sh.setFrozenRows(1);
    }
    sh.appendRow([
      Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyy-MM-dd HH:mm:ss'),
      adminActivityText_(v.email || v.phone || v.name || '', 120),
      v.role === 'staff' ? 'staff' : 'admin',
      type,
      adminActivityText_(target, 120),
      adminActivityText_(details.join(' · '), 400)
    ]);
  } catch (err) {
    try { console.log('ADMIN_ACTIVITY_LOG_FAILED ' + (err && err.message || err)); } catch (x) {}
  }
}

/** Newest first. Optional Admin (email/phone) and Q (text) filters. Owner only. */
function adminActivityList_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var limit = Math.max(1, Math.min(500, parseInt(param_(e, 'Limit'), 10) || 200));
  var who = String(param_(e, 'Admin') || '').trim().toLowerCase();
  var q = String(param_(e, 'Q') || '').trim().toLowerCase();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ADMIN_ACTIVITY_SHEET_);
  var items = [], admins = {};
  if (sh && sh.getLastRow() >= 2) {
    var start = Math.max(2, sh.getLastRow() - 3000 + 1);
    var rows = sh.getRange(start, 1, sh.getLastRow() - start + 1, ADMIN_ACTIVITY_HEADERS_.length).getDisplayValues();
    for (var i = rows.length - 1; i >= 0 && items.length < limit; i--) {
      var r = rows[i];
      var admin = String(r[1] || '');
      if (admin) admins[admin] = true;
      if (who && admin.toLowerCase() !== who) continue;
      if (q && r.join(' ').toLowerCase().indexOf(q) === -1) continue;
      items.push({ time: r[0], admin: admin, role: r[2], type: r[3], label: ADMIN_ACTIVITY_LABELS_[r[3]] || r[3], target: r[4], details: r[5] });
    }
  }
  return { ok: true, items: items, admins: Object.keys(admins).sort() };
}
