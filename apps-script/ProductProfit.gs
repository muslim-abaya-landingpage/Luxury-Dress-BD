/**
 * Per-product profit (owner only).
 * Buying prices are private, so they live in the "Product Costs" sheet — never in the public catalog.
 * AdminProductProfit: for a date range, sold quantity, sales and (when a buying price is set) profit per product,
 *   from order lines (CartJSON, column 33). Basis "delivered" (default) counts only Delivered orders;
 *   "confirmed" also counts Confirmed and Shipped.
 * AdminProductCostsSave: Costs = JSON {productId: {cost, name}} — cost '' or null removes it.
 */
var PRODUCT_COST_SHEET_ = 'Product Costs';
var PRODUCT_COST_HEADERS_ = ['Product ID', 'Product Name', 'Buying Price', 'Updated At', 'Updated By'];

function productCostSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PRODUCT_COST_SHEET_);
  if (!sh) {
    sh = ss.insertSheet(PRODUCT_COST_SHEET_);
    sh.getRange(1, 1, 1, PRODUCT_COST_HEADERS_.length).setValues([PRODUCT_COST_HEADERS_]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function productCostMap_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PRODUCT_COST_SHEET_);
  var map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues().forEach(function (r) {
    var id = String(r[0] || '').trim(), cost = Number(r[2]);
    if (id && isFinite(cost) && cost >= 0) map[id] = cost;
  });
  return map;
}

/** Pure: totals per product from order rows. Exported for tests. */
function productProfitFromRows_(rows, bounds, range, basis, costs) {
  var products = {}, orders = 0;
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[1] && !r[2]) continue;
    var dk = dayKeyFromCell_(r[0]);
    if (dk && !bdIsValidDateKey_(dk)) dk = '';
    if (range === 'all') { if (dk && dk > bounds.toKey) continue; }
    else if (!dk || dk < bounds.fromKey || dk > bounds.toKey) continue;
    var status = String(r[9] || '').trim().toLowerCase();
    var counted = status === 'delivered' || (basis === 'confirmed' && (status === 'confirmed' || status.indexOf('ship') !== -1));
    if (!counted) continue;
    var items = [];
    try { items = JSON.parse(String(r[32] || '').trim() || '[]'); } catch (pe) { items = []; }
    if (!Array.isArray(items) || !items.length) continue;
    orders++;
    items.forEach(function (it) {
      var id = String((it && it.id) || '').trim();
      var qty = parseInt(it && it.qty, 10) || 0;
      if (!id || qty <= 0) return;
      var price = parseFloat(it && it.price) || 0;
      if (!products[id]) products[id] = { productId: id, name: String((it && it.name) || id), qty: 0, sales: 0, unpricedQty: 0 };
      var p = products[id];
      p.qty += qty;
      if (price > 0) p.sales += price * qty; else p.unpricedQty += qty;
    });
  }
  var list = Object.keys(products).map(function (id) {
    var p = products[id];
    var cost = Object.prototype.hasOwnProperty.call(costs, id) ? costs[id] : null;
    p.sales = Math.round(p.sales);
    p.cost = cost;
    p.totalCost = cost == null ? null : Math.round(cost * p.qty);
    p.profit = cost == null ? null : p.sales - p.totalCost;
    p.margin = cost == null || !p.sales ? null : Math.round(p.profit / p.sales * 1000) / 10;
    return p;
  }).sort(function (a, b) { return b.sales - a.sales; });
  var withCost = list.filter(function (p) { return p.profit != null; });
  return {
    orders: orders,
    products: list,
    totals: {
      qty: list.reduce(function (s, p) { return s + p.qty; }, 0),
      sales: list.reduce(function (s, p) { return s + p.sales; }, 0),
      costedSales: withCost.reduce(function (s, p) { return s + p.sales; }, 0),
      profit: withCost.reduce(function (s, p) { return s + p.profit; }, 0),
      missingCost: list.length - withCost.length
    }
  };
}

function adminProductProfit_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var range = String(param_(e, 'Range') || '30d').trim().toLowerCase();
  var bounds = bdRangeBounds_(range, String(param_(e, 'From') || '').trim(), String(param_(e, 'To') || '').trim());
  if (bounds.ok === false) return bounds;
  var basis = param_(e, 'Basis') === 'confirmed' ? 'confirmed' : 'delivered';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  var rows = sheet ? readOnlineOrderRows_(sheet) : [];
  var result = productProfitFromRows_(rows, bounds, range, basis, productCostMap_());
  result.ok = true;
  result.range = range;
  result.basis = basis;
  result.from = bounds.fromKey;
  result.to = bounds.toKey;
  result.costs = productCostMap_();
  return result;
}

function adminProductCostsSave_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var input;
  try { input = JSON.parse(param_(e, 'Costs') || '{}'); } catch (err) { return { ok: false, error: 'BAD_JSON', message: 'ডেটা পড়া যায়নি।' }; }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'BAD_JSON', message: 'ডেটা পড়া যায়নি।' };
  var ids = Object.keys(input);
  if (ids.length > 500) return { ok: false, error: 'TOO_MANY', message: 'একবারে সর্বোচ্চ ৫০০টি পণ্য।' };
  var clean = {};
  for (var k = 0; k < ids.length; k++) {
    var id = String(ids[k] || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/.test(id)) return { ok: false, error: 'BAD_ID', message: 'পণ্যের ID ঠিক নেই: ' + id };
    var raw = input[ids[k]] || {};
    var costRaw = raw.cost;
    if (costRaw === '' || costRaw === null || costRaw === undefined) { clean[id] = { remove: true }; continue; }
    var cost = Number(costRaw);
    if (!isFinite(cost) || cost < 0 || cost > 1000000) return { ok: false, error: 'BAD_COST', message: id + ': কেনা দাম ০ থেকে ১০,০০,০০০ টাকার মধ্যে দিন।' };
    clean[id] = { cost: Math.round(cost * 100) / 100, name: String(raw.name || '').replace(/[\r\n\t]+/g, ' ').replace(/^[=+\-@]/, "'$&").slice(0, 150) };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'BUSY', message: 'একটু পরে আবার চেষ্টা করুন।' };
  try {
    var sh = productCostSheet_();
    var last = sh.getLastRow();
    var rows = last >= 2 ? sh.getRange(2, 1, last - 1, PRODUCT_COST_HEADERS_.length).getValues() : [];
    var at = Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyy-MM-dd HH:mm');
    var who = String(v.email || v.phone || v.name || '');
    var index = {};
    rows.forEach(function (r, i) { index[String(r[0] || '').trim()] = i; });
    var saved = 0, removed = 0;
    Object.keys(clean).forEach(function (id) {
      var c = clean[id];
      if (c.remove) {
        if (index[id] !== undefined) { rows[index[id]] = null; removed++; }
        return;
      }
      var row = [id, c.name || (index[id] !== undefined ? rows[index[id]][1] : ''), c.cost, at, who];
      if (index[id] !== undefined && rows[index[id]]) rows[index[id]] = row;
      else { index[id] = rows.length; rows.push(row); }
      saved++;
    });
    rows = rows.filter(Boolean);
    if (last >= 2) sh.getRange(2, 1, last - 1, PRODUCT_COST_HEADERS_.length).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, PRODUCT_COST_HEADERS_.length).setValues(rows);
    return { ok: true, saved: saved, removed: removed, Count: saved + removed };
  } finally {
    lock.releaseLock();
  }
}
