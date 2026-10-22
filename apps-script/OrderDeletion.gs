/**
 * Irreversible deletion from Online Order, owner-only.
 * Never delete by unverified row number: IDs must be unique and match the current sheet.
 * Other systems (courier, finance, stock ledger) are not reversed by this operation.
 */
function adminOrderDelete_(e) {
  var auth = verifyAdminSession_(param_(e, 'Token'));
  if (!auth.ok) return auth;
  var denied = requireOwnerAdmin_(auth);
  if (denied) return denied;
  var idsText = String(param_(e, 'OrderIds') || '').trim();
  var confirmation = String(param_(e, 'Confirm') || '');
  if (confirmation !== 'PERMANENT_DELETE') return { ok: false, error: 'CONFIRM_REQUIRED', message: 'স্থায়ীভাবে মুছতে নিশ্চিত করুন।' };
  var ids;
  try { ids = JSON.parse(idsText); } catch (err) { ids = null; }
  if (!Array.isArray(ids) || !ids.length || ids.length > 20) return { ok: false, error: 'INVALID_IDS', message: 'একবারে ১ থেকে ২০টি অর্ডার নির্বাচন করুন।' };
  var seen = {};
  for (var i = 0; i < ids.length; i++) {
    if (typeof ids[i] !== 'string' || !ids[i].trim() || ids[i].length > 160 || seen[ids[i]]) return { ok: false, error: 'INVALID_IDS', message: 'অর্ডার ID অবশ্যই অনন্য ও সঠিক হতে হবে।' };
    seen[ids[i]] = true;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = admGetSheet_();
    var last = lastOnlineOrderDataRow_(sheet);
    var rows = last > 1 ? readOnlineOrderRows_(sheet, 2, last - 1, ADM_LAST_COL) : [];
    var found = {};
    for (var j = 0; j < rows.length; j++) {
      var id = String(rows[j][8] || '').trim();
      if (seen[id]) {
        if (found[id]) return { ok: false, error: 'DUPLICATE_ID', message: 'শীটে একই Order ID একাধিকবার আছে। আগে এটি সমাধান করুন।' };
        found[id] = j + 2;
      }
    }
    var positions = [];
    for (var k = 0; k < ids.length; k++) {
      if (!found[ids[k]]) return { ok: false, error: 'NOT_FOUND', message: 'অর্ডার পাওয়া যায়নি: ' + ids[k] };
      positions.push(found[ids[k]]);
    }
    // Delete from bottom to top so the earlier row positions remain correct.
    positions.sort(function (a, b) { return b - a; });
    for (var n = 0; n < positions.length; n++) sheet.deleteRow(positions[n]);
    SpreadsheetApp.flush();
    try {
      var log = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AdminDeleteAudit');
      if (!log) {
        log = SpreadsheetApp.getActiveSpreadsheet().insertSheet('AdminDeleteAudit');
        log.appendRow(['Deleted At', 'Order ID', 'Deleted By', 'Action']);
      }
      var when = new Date();
      var auditRows = ids.map(function (id) { return [when, id, auth.email || 'admin', 'PERMANENT_DELETE']; });
      log.getRange(log.getLastRow() + 1, 1, auditRows.length, 4).setValues(auditRows);
    } catch (auditErr) { console.error('Order delete audit failed: ' + auditErr); }
    return { ok: true, deleted: ids.length, deletedIds: ids };
  } finally {
    lock.releaseLock();
  }
}

