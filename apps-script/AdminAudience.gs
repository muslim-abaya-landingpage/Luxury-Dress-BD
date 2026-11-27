/**
 * Admin → বিজ্ঞাপনের অডিয়েন্স (AdminAudienceExport): ready-made customer lists from the shop's OWN orders,
 * downloadable as a Meta "Customer list" CSV (Ads Manager → Audiences → Custom audience → Customer list).
 * Owner only, read only: nothing in the sheet changes. Meta does not let anyone download pixel data, so
 * these lists are built from the order sheet instead.
 *
 * Lists (all by normalised phone number):
 *   buyers     at least one delivered order            → Lookalike source (value = delivered ৳)
 *   repeat     two or more delivered orders            → new-collection ads to loyal customers
 *   all        every customer except the exclude list  → general retargeting
 *   abandoned  started checkout (AbandonedCarts open), no order from that phone afterwards
 *   exclude    any Fake order, a blocked phone, or 2+ cancelled/returned with nothing delivered
 * Months: 0 = all time, otherwise only orders/carts from the last N months count.
 * AdminAudienceCounts returns only the numbers (not logged); AdminAudienceExport returns one list's rows and is
 * recorded in the Activity log (who downloaded which list).
 */
var AUDIENCE_LISTS_ = ['buyers', 'repeat', 'all', 'abandoned', 'exclude'];

function audiencePhone880_(phone) {
  var p = normalizePhone_(phone);
  return /^01[3-9]\d{8}$/.test(p) ? '88' + p : '';
}

function audienceSplitName_(name) {
  var parts = String(name || '').replace(/\s+/g, ' ').trim().split(' ');
  return { fn: parts[0] || '', ln: parts.length > 1 ? parts.slice(1).join(' ') : '' };
}

/** Builds every list for the period (0 = all time). Shared by the admin page and the weekly Meta sync. */
function audienceBuildLists_(months) {
  var cutoffKey = '';
  if (months) {
    var c = new Date();
    c.setMonth(c.getMonth() - months);
    cutoffKey = Utilities.formatDate(c, 'GMT+6', 'yyyy-MM-dd');
  }
  var inRange = function (cell) { if (!cutoffKey) return true; var k = dayKeyFromCell_(cell); return !!k && k >= cutoffKey; };

  // One pass over the orders: per phone, counts and delivered value.
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  var rowCount = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  var rows = rowCount ? readOnlineOrderRows_(sheet, 2, rowCount, 13) : [];
  var blocked = admBlockedMap_();
  var people = {};
  var lastOrderKey = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    var phone = normalizePhone_(r[2]);
    if (!phone) continue;
    var key = dayKeyFromCell_(r[0]) || '';
    if (!lastOrderKey[phone] || key > lastOrderKey[phone]) lastOrderKey[phone] = key;
    var p = people[phone] || (people[phone] = { phone: phone, name: '', orders: 0, delivered: 0, failed: 0, fake: 0, value: 0, everFake: false });
    var bucket = admHistoryBucket_(r[9], r[12]);
    if (bucket === 'fake') p.everFake = true; // a Fake order excludes the phone whatever the date range
    if (!inRange(r[0])) continue;
    if (String(r[1] || '').trim()) p.name = String(r[1]).trim();
    p.orders++;
    if (bucket === 'delivered') { p.delivered++; p.value += Math.max(0, admNum_(r[7])); }
    else if (bucket === 'fake') p.fake++;
    else if (bucket === 'cancelled' || bucket === 'returned') p.failed++;
  }
  var isExcluded = function (p) {
    return p.everFake || Object.prototype.hasOwnProperty.call(blocked, p.phone) || (p.failed >= 2 && p.delivered === 0);
  };

  var counts = { buyers: 0, repeat: 0, all: 0, abandoned: 0, exclude: 0 };
  var picked = { buyers: [], repeat: [], all: [], abandoned: [], exclude: [] };
  Object.keys(people).forEach(function (ph) {
    var p = people[ph];
    if (isExcluded(p)) { counts.exclude++; picked.exclude.push(p); return; }
    if (!p.orders) return;
    counts.all++; picked.all.push(p);
    if (p.delivered >= 1) { counts.buyers++; picked.buyers.push(p); }
    if (p.delivered >= 2) { counts.repeat++; picked.repeat.push(p); }
  });

  // Started checkout but no order from that phone on or after that day.
  try {
    var cData = ensureAbandonedCartsSheet_().getDataRange().getValues();
    var seen = {};
    for (var j = 1; j < cData.length; j++) {
      var cr = cData[j];
      var cp = normalizePhone_(cr[0]);
      if (!cp || seen[cp] || String(cr[6] || '') !== 'open' || !inRange(cr[5] || cr[4])) continue;
      var cartKey = dayKeyFromCell_(cr[5] || cr[4]) || '';
      if (lastOrderKey[cp] && lastOrderKey[cp] >= cartKey) continue;
      var known = people[cp];
      if (known && isExcluded(known)) continue;
      if (Object.prototype.hasOwnProperty.call(blocked, cp)) continue;
      seen[cp] = true;
      counts.abandoned++;
      picked.abandoned.push({ phone: cp, name: String(cr[1] || '').trim(), value: 0 });
    }
  } catch (err) {}

  return { counts: counts, picked: picked };
}

function adminAudienceExport_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var list = String(param_(e, 'RecordType')) === 'AdminAudienceExport' ? String(param_(e, 'List') || '').trim() : '';
  var months = Math.max(0, Math.min(60, parseInt(param_(e, 'Months'), 10) || 0));
  var built = audienceBuildLists_(months);
  var counts = built.counts, picked = built.picked;
  var out = { ok: true, months: months, counts: counts };
  if (AUDIENCE_LISTS_.indexOf(list) === -1) return out; // counts only
  out.list = list;
  out.rows = picked[list].map(function (p) {
    var n = audienceSplitName_(p.name);
    return { phone: audiencePhone880_(p.phone), fn: n.fn, ln: n.ln, country: 'bd', value: list === 'buyers' ? Math.round(p.value) : '' };
  }).filter(function (x) { return x.phone; });
  return out;
}
