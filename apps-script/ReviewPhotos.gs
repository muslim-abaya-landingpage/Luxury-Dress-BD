/**
 * Photo reviews: verified buyers may add up to 3 photos (uploaded first to images.muslimabaya.com/reviews/
 * by /api/review-photo). Nothing is public until the owner approves it in Admin → Reviews.
 * Sheet "Reviews": … col 9 VerifiedPurchase, col 10 VerifiedOrderId, col 11 Photos (JSON array of URLs).
 */
var REVIEW_PHOTO_URL_RE_ = /^https:\/\/images\.muslimabaya\.com\/reviews\/\d{4}\/[a-f0-9-]{36}\.webp$/;

function reviewPhotos_(raw) {
  var list = [];
  try { list = JSON.parse(String(raw || '[]')); } catch (e) { list = []; }
  if (!Array.isArray(list)) return [];
  var out = [];
  list.forEach(function (u) { u = String(u || '').trim(); if (REVIEW_PHOTO_URL_RE_.test(u) && out.indexOf(u) === -1 && out.length < 3) out.push(u); });
  return out;
}

function reviewPhotoHeader_(sheet) {
  var cell = sheet.getRange(1, 11), old = cell.getValue();
  if (old && old !== 'Photos') throw Error('REVIEW_HEADER_CONFLICT');
  if (!old) cell.setValue('Photos');
}

function reviewRowPhotos_(row) { return reviewPhotos_(row[10]); }

/** Latest approved reviews that have photos, for the "Customer photos" strip (public). */
function getPhotoReviews_(e) {
  try {
    var data = getReviewsSheet_().getDataRange().getValues(), out = [];
    for (var i = data.length - 1; i >= 1 && out.length < 12; i--) {
      var r = data[i];
      if (String(r[7] || '').trim() !== 'Approved') continue;
      var photos = reviewRowPhotos_(r);
      if (!photos.length) continue;
      out.push({ productId: String(r[1] || ''), productName: String(r[2] || ''), name: String(r[3] || ''), rating: Number(r[4]) || 0,
        comment: String(r[5] || '').slice(0, 220), photos: photos, verifiedPurchase: r[8] === true,
        date: r[6] instanceof Date ? Utilities.formatDate(r[6], 'GMT+6', 'dd MMM yyyy') : String(r[6] || '') });
    }
    return { ok: true, reviews: out };
  } catch (err) {
    return { ok: false, error: 'PHOTO_REVIEWS_FAILED', reviews: [] };
  }
}

function reviewAdminCheck_(e) {
  var v = verifyAdminSession_(String(param_(e, 'Token') || ''));
  if (!v.ok) return { ok: false, error: v.error || 'NOT_LOGGED_IN' };
  return requireOwnerAdmin_(v);
}

/** Admin → Reviews: newest first (up to 300), with photos, status, verified order id. */
function adminReviewList_(e) {
  var denied = reviewAdminCheck_(e);
  if (denied) return denied;
  var data = getReviewsSheet_().getDataRange().getValues(), out = [];
  for (var i = data.length - 1; i >= 1 && out.length < 300; i--) {
    var r = data[i];
    if (!r[0]) continue;
    out.push({ id: String(r[0]), productId: String(r[1] || ''), productName: String(r[2] || ''), name: String(r[3] || ''),
      rating: Number(r[4]) || 0, comment: String(r[5] || ''), status: String(r[7] || 'Pending'), verifiedPurchase: r[8] === true,
      orderId: String(r[9] || ''), photos: reviewRowPhotos_(r),
      date: r[6] instanceof Date ? Utilities.formatDate(r[6], 'GMT+6', 'yyyy-MM-dd HH:mm') : String(r[6] || '') });
  }
  var counts = { Pending: 0, Approved: 0, Rejected: 0 };
  out.forEach(function (x) { if (counts[x.status] != null) counts[x.status]++; });
  return { ok: true, reviews: out, counts: counts };
}

function adminReviewStatus_(e) {
  var denied = reviewAdminCheck_(e);
  if (denied) return denied;
  var id = String(param_(e, 'ReviewID') || '').trim(), status = String(param_(e, 'Status') || '').trim();
  if (['Approved', 'Rejected', 'Pending'].indexOf(status) === -1) return { ok: false, error: 'BAD_STATUS', message: 'অবস্থা ঠিক নেই।' };
  if (!id) return { ok: false, error: 'NO_REVIEW', message: 'রিভিউ পাওয়া যায়নি।' };
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = getReviewsSheet_(), ids = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
    for (var i = 1; i < ids.length; i++) {
      if (String(ids[i][0]) === id) { sheet.getRange(i + 1, 8).setValue(status); return { ok: true, id: id, status: status }; }
    }
  } finally { lock.releaseLock(); }
  return { ok: false, error: 'NO_REVIEW', message: 'রিভিউ পাওয়া যায়নি।' };
}
