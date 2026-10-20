(function (root) {
  'use strict';
  var GROUPS = ['delivered', 'active', 'cancelled', 'fake', 'returned', 'unknown'];
  var LABELS = {
    missing_id: 'Order ID নেই', duplicate_id: 'একই Order ID একাধিকবার',
    missing_size: 'সাইজের তথ্য যাচাই করুন', future_date: 'ভবিষ্যতের অর্ডার তারিখ',
    invalid_date: 'তারিখ নেই বা বোঝা যাচ্ছে না', date_mismatch: 'Order ID ও তারিখ মেলেনি',
    invalid_total: 'মোট টাকার মান সঠিক নয়', invalid_qty: 'পণ্যের পরিমাণ যাচাই করুন',
    advance_over_total: 'অগ্রিম মোট টাকার চেয়ে বেশি', review_note: 'অ্যাডমিন নোটে যাচাই বাকি',
    unknown_status: 'অর্ডার স্ট্যাটাস যাচাই করুন'
  };
  function text(v) { return String(v == null ? '' : v).trim(); }
  function amount(v) {
    if (v == null || text(v) === '') return null;
    var n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  function statusGroup(status) {
    var s = text(status).toLowerCase();
    if (s === 'delivered') return 'delivered';
    if (['pending', 'confirmed', 'shipped'].indexOf(s) !== -1) return 'active';
    if (['cancelled', 'canceled'].indexOf(s) !== -1) return 'cancelled';
    if (s === 'fake') return 'fake';
    if (['returned', 'return'].indexOf(s) !== -1) return 'returned';
    return 'unknown';
  }
  function validDay(y, m, d) {
    var dt = new Date(Date.UTC(y, m - 1, d));
    return y >= 2000 && y <= 2200 && dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  function pad(v) { return String(v).padStart(2, '0'); }
  function dateKey(value) {
    var s = text(value), m, y, month, day;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(s))) {
      y = +m[1]; month = +m[2]; day = +m[3];
    } else if ((m = /^(\d{1,2})-(\d{1,2})-(\d{4})(?:$|\s)/.exec(s))) {
      y = +m[3]; month = +m[2]; day = +m[1];
    } else return null;
    return validDay(y, month, day) ? y + '-' + pad(month) + '-' + pad(day) : null;
  }
  function dhakaToday(now) { return new Date((now == null ? Date.now() : now) + 6 * 3600000).toISOString().slice(0, 10); }
  function analyze(orders, opts) {
    opts = opts || {};
    var today = opts.today || dhakaToday(), seen = Object.create(null), groups = {};
    GROUPS.forEach(function (key) { groups[key] = { count: 0, value: 0 }; });
    orders.forEach(function (o) { var id = text(o.orderId); if (id) seen[id] = (seen[id] || 0) + 1; });
    var totalValue = 0, invalidAmounts = 0, deliveredProductValue = 0, unknownShipping = 0;
    var rows = orders.map(function (o) {
      var id = text(o.orderId), issues = [], group = statusGroup(o.status), total = amount(o.total);
      if (!id) issues.push('missing_id');
      else if (seen[id] > 1) issues.push('duplicate_id');
      var size = text(o.size);
      // Size only matters while the order still has to be packed; finished orders are not flagged.
      if ((group === 'active' || group === 'unknown') && (!size || /^(?:—|-|null|undefined)$/i.test(size))) issues.push('missing_size');
      var date = dateKey(o.time);
      if (!date) issues.push('invalid_date');
      else {
        if (date > today) issues.push('future_date');
        var idDate = /^MA-(\d{4})(\d{2})(\d{2})-/.exec(id);
        if (idDate && date !== idDate[1] + '-' + idDate[2] + '-' + idDate[3]) issues.push('date_mismatch');
      }
      if (total === null) { issues.push('invalid_total'); invalidAmounts++; }
      else { totalValue += total; groups[group].value += total; }
      groups[group].count++;
      var qty = amount(o.qty);
      if (qty === null || !Number.isSafeInteger(qty) || qty < 1) issues.push('invalid_qty');
      if (total !== null && amount(o.advance) !== null && amount(o.advance) > total) issues.push('advance_over_total');
      if (/⚠|REVIEW|যাচাই|অমিল|পার্থক্য/i.test(text(o.adminNote))) issues.push('review_note');
      if (group === 'unknown') issues.push('unknown_status');
      if (group === 'delivered' && total !== null) {
        var shipping = amount(o.charge);
        if (shipping === null || shipping > total) unknownShipping++;
        else deliveredProductValue += total - shipping;
      }
      return { order: o, issues: issues, group: group, date: date };
    });
    return { rows: rows, groups: groups, totalValue: totalValue, invalidAmounts: invalidAmounts,
      deliveredProductValue: deliveredProductValue, unknownShipping: unknownShipping,
      flagged: rows.filter(function (r) { return r.issues.length; }).length, today: today };
  }
  var api = { analyze: analyze, amount: amount, statusGroup: statusGroup, dateKey: dateKey,
    dhakaToday: dhakaToday, labels: LABELS };
  root.MaOrderInsights = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
