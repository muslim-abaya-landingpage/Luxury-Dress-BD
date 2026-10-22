/**
 * Live Stock overrides: a fast, authenticated stock switch separate from GitHub catalog publishing.
 * Deploy this file alongside Code.gs in the SAME Apps Script project.
 * Stock quantities/variant reservations remain managed by the existing inventory workflow.
 */
function liveStockSheet_() {
  return ensureSheet_('LiveStockOverrides', ['Product ID', 'In Stock', 'Updated At', 'Updated By']);
}
function liveStockOverrides_() {
  var sh = liveStockSheet_(), values = sh.getDataRange().getValues(), map = {};
  for (var i = 1; i < values.length; i++) {
    var id = String(values[i][0] || '').trim();
    if (!id) continue;
    map[id] = String(values[i][1]).toLowerCase() === 'true' || values[i][1] === true;
  }
  return map;
}
function adminLiveStockHandle_(type, e) {
  var auth = verifyAdminSession_(param_(e, 'Token'));
  if (!auth.ok) return auth;
  if (type === 'AdminLiveStockList') return {ok:true, items:liveStockOverrides_()};
  if (type !== 'AdminLiveStockSet') return {ok:false, error:'UNKNOWN_TYPE'};
  var ids, available = String(param_(e, 'InStock')).toLowerCase();
  try { ids = JSON.parse(param_(e, 'ProductIds') || '[]'); }
  catch (err) { return {ok:false, error:'INVALID_PRODUCTS'}; }
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 ||
      ids.some(function(id){ return typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,90}$/.test(id); }) ||
      (available !== 'true' && available !== 'false')) return {ok:false,error:'INVALID_STOCK_CHANGE'};
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = liveStockSheet_(), values = sh.getDataRange().getValues(), rowById = {};
    for (var i = 1; i < values.length; i++) {
      var key = String(values[i][0] || '').trim();
      if (key) rowById[key] = i + 1;
    }
    var flag = available === 'true', now = new Date();
    ids.forEach(function(id) {
      if (rowById[id]) sh.getRange(rowById[id], 2, 1, 3).setValues([[flag,now,auth.email || 'admin']]);
      else { sh.appendRow([id,flag,now,auth.email || 'admin']); rowById[id] = sh.getLastRow(); }
    });
    return {ok:true, productIds:ids, inStock:flag};
  } finally { lock.releaseLock(); }
}

function assertLiveStockAvailable_(cartItems) {
  var map = liveStockOverrides_();
  (cartItems || []).forEach(function(item) {
    var id = String((item && (item.id || item.productId)) || '').trim();
    if (id && Object.prototype.hasOwnProperty.call(map, id) && map[id] === false) {
      var err = new Error('OUT_OF_STOCK:' + id);
      err.isStockError = true;
      throw err;
    }
  });
}
