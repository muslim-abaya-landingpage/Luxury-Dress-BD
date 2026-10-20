/**
 * One-off data corrections approved by the owner on 2026-10-21. Editor-only.
 * Run dataFix20261021DryRun() first (read-only; logs no names/phones), then dataFix20261021Apply().
 * Apply re-checks every cell before writing and records before/after in AutomationLogs.
 *  A) MA-LEGACY-D12B4EEB7677: date 10-12-2026 → 12-10-2026 (day/month were swapped)
 *  B) Order by "Nahid Nahar" with no Order ID → give it an ID from its own order date
 *  C) MA-20261011-4777: quantity/total/items from the checkout record (3 pcs, ৳2885)
 */
var DF_ = { swapId: 'MA-LEGACY-D12B4EEB7677', noIdName: 'Nahid Nahar', qtyId: 'MA-20261011-4777', qty: 3, total: 2885,
  oldDesign: '1. Premium Black Hafeza Set (Full Set)',
  design: '1. Elegant Purple Floral Kurti (Size 38) × 1\n2. Premium Black Hafeza Set (Full Set) (Body 42 · Length 52) × 1\n3. Elegant Grey Leaf Print Kurti (Size 38) × 1' };

function dfRows_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  var last = lastOnlineOrderDataRow_(sheet);
  var rows = last >= 2 ? readOnlineOrderRows_(sheet, 2, last - 1, 17) : [];
  return { sheet: sheet, rows: rows };
}

function dfFind_(rows) {
  var out = { swap: [], noId: [], qty: [] };
  rows.forEach(function (r, i) {
    var id = String(r[8] || '').trim(), rowNo = i + 2;
    if (id === DF_.swapId) out.swap.push(rowNo);
    if (!id && String(r[1] || '').trim().toLowerCase() === DF_.noIdName.toLowerCase()) out.noId.push(rowNo);
    if (id === DF_.qtyId) out.qty.push(rowNo);
  });
  return out;
}

function dfDateParts_(v) {
  if (v instanceof Date) return { y: +Utilities.formatDate(v, 'Asia/Dhaka', 'yyyy'), m: +Utilities.formatDate(v, 'Asia/Dhaka', 'M'), d: +Utilities.formatDate(v, 'Asia/Dhaka', 'd'), isDate: true };
  var m = /^(\d{1,2})-(\d{1,2})-(\d{4})/.exec(String(v || '').trim());
  return m ? { d: +m[1], m: +m[2], y: +m[3], isDate: false } : null;
}

function dfCartsFor_(phone) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AbandonedCarts');
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 7).getValues().filter(function (r) { return normalizePhone_(r[0]) === phone; })
    .map(function (r) { return { summary: String(r[2] || '').slice(0, 300), value: Number(r[3]) || 0, status: String(r[6] || '') }; });
}

function dataFix20261021DryRun() {
  var d = dfRows_(), f = dfFind_(d.rows), report = {};
  report.A = f.swap.map(function (row) { var r = d.rows[row - 2]; return { row: row, date: String(r[0]), parts: dfDateParts_(r[0]), status: String(r[9] || '') }; });
  report.B = f.noId.map(function (row) { var r = d.rows[row - 2]; return { row: row, date: String(r[0]), status: String(r[9] || ''), total: r[7] }; });
  report.C = f.qty.map(function (row) {
    var r = d.rows[row - 2];
    return { row: row, qty: r[3], charge: r[4], total: r[7], status: String(r[9] || ''), courier: String(r[12] || ''), design: String(r[6] || '').slice(0, 300), carts: dfCartsFor_(normalizePhone_(r[2])) };
  });
  console.log('DATAFIX DRY ' + JSON.stringify(report));
  return report;
}

function dataFix20261021Apply() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var done = [];
  try {
    var d = dfRows_(), f = dfFind_(d.rows), sheet = d.sheet;
    // A) swap day/month
    if (f.swap.length === 1) {
      var rowA = f.swap[0], cell = sheet.getRange(rowA, 1), v = cell.getValue(), p = dfDateParts_(v);
      if (p && p.y === 2026 && p.d === 10 && p.m === 12) {
        if (p.isDate) {
          var fixed = new Date(v.getTime()); fixed.setMonth(9); fixed.setDate(12);
          cell.setValue(fixed);
        } else {
          cell.setValue(String(v).replace(/^10-12-2026/, '12-10-2026'));
        }
        done.push('A row ' + rowA + ': 10-12-2026 → 12-10-2026');
      } else done.push('A skipped: date is not 10-12-2026 any more');
    } else done.push('A skipped: found ' + f.swap.length + ' rows');
    // B) missing Order ID
    if (f.noId.length === 1) {
      var rowB = f.noId[0], pb = dfDateParts_(d.rows[rowB - 2][0]);
      if (pb) {
        var used = {}; d.rows.forEach(function (r) { used[String(r[8] || '').trim()] = true; });
        var base = 'MA-' + pb.y + ('0' + pb.m).slice(-2) + ('0' + pb.d).slice(-2) + '-', id = '';
        for (var t = 0; t < 50 && (!id || used[id]); t++) id = base + (Math.floor(Math.random() * 9000) + 1000);
        var idCell = sheet.getRange(rowB, onlineOrderColumn_(sheet, 9));
        if (!String(idCell.getValue() || '').trim() && !used[id]) { idCell.setValue(id); done.push('B row ' + rowB + ': Order ID ' + id); }
        else done.push('B skipped: cell no longer empty');
      } else done.push('B skipped: unreadable date');
    } else done.push('B skipped: found ' + f.noId.length + ' rows');
    // C) quantity and total from checkout
    if (f.qty.length === 1) {
      var rowC = f.qty[0], r = d.rows[rowC - 2];
      var qCell = sheet.getRange(rowC, 4), tCell = sheet.getRange(rowC, onlineOrderColumn_(sheet, 8));
      var before = { qty: qCell.getValue(), total: tCell.getValue() };
      if (Number(before.qty) !== DF_.qty || Number(String(before.total).replace(/[^\d.]/g, '')) !== DF_.total) {
        qCell.setValue(DF_.qty); tCell.setValue(DF_.total);
        done.push('C row ' + rowC + ': qty ' + before.qty + ' → ' + DF_.qty + ', total ' + before.total + ' → ' + DF_.total);
      } else done.push('C qty/total already correct');
      var gCell = sheet.getRange(rowC, 7);
      if (String(gCell.getValue() || '').trim() === DF_.oldDesign) { gCell.setValue(DF_.design); done.push('C row ' + rowC + ': items → 3 checkout items'); }
      else done.push('C items unchanged (not the single-item text)');
    } else done.push('C skipped: found ' + f.qty.length + ' rows');
  } finally { lock.releaseLock(); }
  if (typeof recordAutomationLog_ === 'function') recordAutomationLog_('DATAFIX', true, done.length, 0, done.join(' | '));
  console.log('DATAFIX APPLIED ' + JSON.stringify(done));
  return done;
}
