/* Courier text is shown verbatim; shop workflow remains a separate field. */
(function (root) {
  'use strict';
  function describe(order) {
    order = order || {};
    var status = String(order.status || 'Pending').trim();
    var raw = String(order.courierStatus || '').trim();
    var hasRecord = Boolean(order.tracking || order.consignmentId || raw);
    var key = String(hasRecord ? raw : status).toLowerCase();
    var badgeKey = key === 'delivered' ? 'delivered' : /^(cancelled|returned)$/.test(key) ? 'cancelled' : key === 'confirmed' ? 'confirmed' : 'pending';
    return { orderLabel: hasRecord ? (raw || 'স্ট্যাটাস পাওয়া যায়নি') : status,
      orderRaw: status, hasCourier: hasRecord, courierLabel: raw || 'স্ট্যাটাস পাওয়া যায়নি',
      badgeKey: badgeKey,
      note: 'কুরিয়ার থেকে পাওয়া মূল স্ট্যাটাস। পোর্টালের ধাপ বা অবস্থান অনুমান করা হয় না; সর্বশেষ ট্র্যাকিং দেখতে অর্ডার খুলুন।' };
  }
  var api = { describe: describe };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaOrderStatus = api;
})(typeof window !== 'undefined' ? window : this);
