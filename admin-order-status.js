/* Display-only: shop workflow and last stored courier status are separate facts. */
(function (root) {
  'use strict';
  function describe(order) {
    order = order || {};
    var status = String(order.status || 'Pending').trim();
    var raw = String(order.courierStatus || '').trim();
    var key = raw.toLowerCase().replace(/[\s-]+/g, '_');
    var hasRecord = Boolean(order.tracking || order.consignmentId || raw);
    var labels = {
      pending: 'অপেক্ষমাণ', in_review: 'পর্যালোচনায়',
      approval_pending: 'অনুমোদনের অপেক্ষায়', unknown_approval_pending: 'অনুমোদনের অপেক্ষায়',
      approved: 'অনুমোদিত', delivered: 'ডেলিভারি সম্পন্ন',
      partial_delivered: 'আংশিক ডেলিভারি', cancelled: 'বাতিল',
      returned: 'ফেরত', hold: 'হোল্ড', holded: 'হোল্ড'
    };
    return {
      orderLabel: status.toLowerCase() === 'shipped' && hasRecord ? 'কুরিয়ারে নথিভুক্ত' : status,
      orderRaw: status,
      hasCourier: hasRecord,
      courierLabel: raw ? (labels[key] ? labels[key] + ' (' + raw + ')' : raw) : 'স্ট্যাটাস পাওয়া যায়নি',
      note: 'কুরিয়ারে নথিভুক্ত হওয়া মানেই রাইডারের কাছে বা ডেলিভারির পথে নয়। কুরিয়ার স্ট্যাটাস সর্বশেষ সংরক্ষিত তথ্য; লাইভ পোর্টালের সঙ্গে আপডেটের সময়ের পার্থক্য থাকতে পারে।'
    };
  }
  var api = { describe: describe };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MaOrderStatus = api;
})(typeof window !== 'undefined' ? window : this);
