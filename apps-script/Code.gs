/**
 * Muslim Abaya — সম্পূর্ণ Web App (এক ফাইলে পেস্ট করুন)
 * Code.gs → Ctrl+A → Ctrl+V → Save → Deploy → New version
 *
 * Script properties:
 *   AUTH_SECRET — Sign Up
 *   GOOGLE_CLIENT_ID — optional Google sign-in
 *   FACEBOOK_LOGIN_APP_ID, FACEBOOK_LOGIN_APP_SECRET — optional Facebook sign-in
 *   ORDER_RATE_LIMIT_MAX — optional order limit per 30-minute window (default 6)
 *   ORDER_RATE_LIMIT_BYPASS — optional explicit comma/space-separated allowlist; unset = no bypass
 *   STEADFAST_API_KEY, STEADFAST_SECRET_KEY — Steadfast Courier
 *   STEADFAST_WEBHOOK_TOKEN — webhook URL ?token=... (Apps Script header পড়ে না)
 * ঐচ্ছিক: FB_ACCESS_TOKEN, FB_PIXEL_ID
 */

function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

function normalizeSubscribeContact_(raw) {
  var v = String(raw || '').trim();
  if (!v) return '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return normalizeEmail_(v);
  var phone = normalizePhone_(v);
  if (phone.length >= 11 && phone.length <= 14 && phone.charAt(0) === '0') return phone;
  return '';
}

function saveSubscribeContact_(contactRaw) {
  var contact = normalizeSubscribeContact_(contactRaw);
  if (!contact) {
    return { ok: false, error: 'INVALID_CONTACT', message: 'সঠিক ইমেইল বা মোবাইল (01XXXXXXXXX) দিন।' };
  }
  try {
    rateLimit_('sub_' + contact.slice(0, 48));
  } catch (rl) {
    return { ok: false, error: 'RATE_LIMIT', message: 'অনেকবার চেষ্টা। কিছুক্ষণ পর আবার করুন।' };
  }
  var sub = ensureSheet_('Subscribe', ['যোগাযোগ (ইমেইল/মোবাইল)', 'তারিখ ও সময়']);
  var data = sub.getDataRange().getValues();
  var key = contact.toLowerCase();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim().toLowerCase() === key) {
      return { ok: true, message: 'Already subscribed', duplicate: true };
    }
  }
  appendRow_(sub, [contact, new Date()]);
  return { ok: true, message: 'Subscribed' };
}

function doGet(e) {
  if (e && e.parameter && e.parameter['hub.mode'] === 'subscribe') {
    return messengerVerify_(e);
  }
  try {
    var type = param_(e, 'RecordType');
    if (type === 'OrderSchema') return jsonOut_(getOnlineOrderSchemaStatus_());
    if (type === 'Subscribe') {
      // GET may be triggered by link scanners, previews, or browser prefetch.
      // Never mutate the Subscribe sheet from a GET request; use doPost instead.
      return jsonOut_({
        ok: false,
        error: 'METHOD_NOT_ALLOWED',
        message: 'Subscription requests must use POST.'
      });
    }
    if (type === 'AuthVerify' || type === 'AdminVerify') {
      var tok = param_(e, 'Token');
      if (type === 'AdminVerify') return jsonOut_(verifyAdminSession_(tok));
      return jsonOut_(verifySession_(tok));
    }
    if (type === 'StockStatus') {
      return jsonOut_(getPublicStockStatus_());
    }
    if (type === 'OrderTrack') {
      return jsonOut_(getOrderTrackStatus_(e));
    }
    if (type === 'ValidateCoupon') {
      return jsonOut_(validateCouponCode_(param_(e, 'Code'), parseFloat(param_(e, 'Subtotal')) || 0));
    }
    if (type === 'GetReviews') {
      return jsonOut_(getProductReviews_(e));
    }
  } catch (err) {
    if (param_(e, 'RecordType') === 'Subscribe') {
      return jsonOut_({ ok: false, error: String(err.message || err) });
    }
  }
  return ContentService.createTextOutput('Muslim Abaya API OK').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    if (e && e.postData && e.postData.contents &&
        e.postData.contents.indexOf('"object":"page"') !== -1) {
      return messengerWebhook_(e);
    }
    if (e && e.postData && e.postData.type && String(e.postData.type).indexOf('json') !== -1) {
      return handleSteadfastWebhookPost_(e);
    }
    var type = param_(e, 'RecordType');
    if (type === 'AdminLiveStockList' || type === 'AdminLiveStockSet') {
      adminRateLimit_(param_(e, 'Token') || 'admin_global');
      return jsonOut_(adminLiveStockHandle_(type, e));
    }
    if (type === 'NotifyBackInStockV2') return jsonOut_(opsSaveWaitlist_(e));
    if (type && type.indexOf('AdminOperations') === 0) {
      adminRateLimit_(param_(e, 'Token') || 'admin_global');
      return jsonOut_(opsHandle_(type, e));
    }
    var isOrder = type === 'Order' || (!type && param_(e, 'Name') && param_(e, 'Phone'));
    var isSubscribe =
      type === 'Subscribe' ||
      (!type && !isOrder && (param_(e, 'contact') || param_(e, 'email')));

    // Courier repair belongs to order creation, never dashboard/inbox reads.
    if (isOrder) {
      selfHealSteadfastBaseUrl_();
      selfHealAutoCourierSetup_();
    }

    if (type === 'CartCheckpoint') {
      return jsonOut_(saveCartCheckpoint_(e));
    }
    if (type === 'NotifyBackInStock') {
      return jsonOut_(saveBackInStockRequest_(e));
    }
    // Messenger inbox: token-gated with its own (higher) limit, since the admin
    // inbox polls; must run before the generic 12-per-10-min limiter below.
    if (type && type.indexOf('Inbox') === 0) {
      return jsonOut_(handleInboxRequest_(type, e));
    }

    // Every order-panel action verifies the admin/staff token inside its handler.
    var orderPanelTypes = ['AdminOrderList', 'AdminOrderGet', 'AdminOrderUpdate', 'AdminFraudCheck', 'AdminBlockCustomer', 'AdminSendCourier', 'AdminOrderStaff', 'AdminCourierTracking', 'AdminManualOrderCreate', 'AdminOrderCreate', 'AdminCustomerLookup', 'AdminCouponCheck'];
    if (orderPanelTypes.indexOf(type) !== -1) {
      var panelResult = handleAdminOrderRequest_(type, e);
      return jsonOut_(panelResult || { ok: false, error: 'UNKNOWN_TYPE' });
    }

    // Admin panel calls: token-gated with a higher shared limit (dashboard/stock/growth
    // pages can fire many calls quickly); must run before the generic 12-per-10-min limiter.
    if (type && type.indexOf('Admin') === 0) {
      adminRateLimit_(param_(e, 'Token') || 'admin_global');
    } else if (!isOrder && !isSubscribe) {
      rateLimit_(param_(e, 'Email') || param_(e, 'Phone') || param_(e, 'Login') || param_(e, 'Token') || (type === 'AuthGoogle' ? 'g_' + String(param_(e, 'IdToken')).slice(-24) : type === 'AuthFacebook' ? 'f_' + String(param_(e, 'AccessToken')).slice(-24) : '') || 'global');
    }

    if (type === 'AuthRegister' || type === 'CustomerRegister') {
      return jsonOut_(registerUser_(e));
    }
    if (type === 'AuthLogin' || type === 'CustomerLogin') {
      return jsonOut_(loginUser_(e));
    }
    if (type === 'AuthGoogle') {
      return jsonOut_(googleLogin_(e));
    }
    if (type === 'AuthFacebook') {
      return jsonOut_(facebookLogin_(e));
    }
    if (type === 'AuthVerify') {
      return jsonOut_(verifySession_(param_(e, 'Token')));
    }
    if (type === 'AdminLogin') {
      return jsonOut_(loginAdmin_(e));
    }
    if (type === 'AdminVerify') {
      return jsonOut_(verifyAdminSession_(param_(e, 'Token')));
    }
    if (type === 'AdminOrders') {
      return jsonOut_(listAdminOrders_(e));
    }
    if (type === 'AdminTodayStats') {
      return jsonOut_(getAdminTodayStats_(e));
    }
    if (type && type.indexOf('AdminCatalog') === 0) return jsonOut_(catalogPublishHandle_(type, e));

    if (type === 'AdminPublishFile') {
      return jsonOut_(publishFileToGitHub_(e));
    }
    if (type === 'AdminUploadImage') {
      return jsonOut_(publishImageToGitHub_(e));
    }
    if (type === 'AdminListImages') {
      return jsonOut_(listImagesFromGitHub_(e));
    }
    if (type === 'AdminDeleteImage') {
      return jsonOut_(deleteImageFromGitHub_(e));
    }
    if (type === 'AdminStockGet') {
      return jsonOut_(getAdminStock_(e));
    }
    if (type === 'AdminGrowthData') {
      return jsonOut_(getAdminGrowthData_(e));
    }
    if (type === 'AdminGrowthDismiss') {
      return jsonOut_(markGrowthItemDone_(e));
    }
    if (type === 'AdminStaffList') {
      return jsonOut_(listAdminStaff_(e));
    }
    if (type === 'AdminStaffSave') {
      return jsonOut_(saveAdminStaff_(e));
    }
    if (type === 'AdminStaffDelete') {
      return jsonOut_(deleteAdminStaff_(e));
    }
    if (type === 'AdminStockSet') {
      return jsonOut_(setAdminStock_(e));
    }
    if (type === 'AdminStockVariantsList') {
      return jsonOut_(getAdminStockVariants_(e));
    }
    if (type === 'AdminStockVariantSave') {
      return jsonOut_(saveAdminStockVariant_(e));
    }
    if (type === 'AdminStockLedgerList') {
      return jsonOut_(getAdminStockLedger_(e));
    }
    if (type === 'AdminStockCsvCommit') {
      return jsonOut_(commitAdminStockCsvBatch_(e));
    }
    if (type === 'AdminAnalyticsV2') {
      return jsonOut_(getAdminAnalyticsV2_(e));
    }
    if (type === 'AdminStockMigrate') {
      return jsonOut_(migrateStockToVariants_(e));
    }
    if (type === 'AdminStockQuickAdjust') {
      return jsonOut_(quickAdjustAdminStock_(e));
    }
    if (type === 'AdminAnalytics') {
      return jsonOut_(getAdminAnalytics_(e));
    }
    if (type === 'SubmitReview') {
      return jsonOut_(submitReview_(e));
    }
    if (isSubscribe) {
      var contact = String(param_(e, 'contact') || param_(e, 'email') || '').trim();
      var saved = saveSubscribeContact_(contact);
      if (!saved.ok) return jsonOut_(saved);
      if (!saved.duplicate) {
        try {
          var leadEventId = String(param_(e, 'EventID') || '').trim();
          var normalizedContact = normalizeSubscribeContact_(contact);
          var isEmailContact = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedContact);
          var leadData = {
            Name: '',
            Phone: isEmailContact ? '' : normalizedContact,
            Email: isEmailContact ? normalizedContact : '',
            EventSourceUrl: 'https://muslimabaya.com/'
          };
          sendToFacebookCAPI(leadData, leadEventId, 'Lead');
          sendToTikTokCAPI(leadData, leadEventId, 'SubmitForm');
        } catch (capiErr) {
          try { console.error('Subscribe CAPI error: ' + (capiErr.message || capiErr)); } catch (logErr2) {}
        }
      }
      return jsonOut_({ ok: true, message: 'Subscribed', sheet: 'Subscribe' });
    }

    if (!isOrder) return jsonOut_({ ok: false, error: 'UNKNOWN_TYPE', message: 'অজানা API অনুরোধ।' });
    return handleOnlineOrderPost_(e);
  } catch (err) {
    var errCode = String(err.message || err);
    try { console.error('doPost error: ' + errCode); } catch (logErr) {}
    var orderType = param_(e, 'RecordType');
    var isOrderReq = orderType === 'Order' || (!orderType && param_(e, 'Name') && param_(e, 'Phone'));
    if (isOrderReq) {
      var friendly = orderErrorMessage_(errCode);
      var isOutOfStockMsg = errCode && errCode.indexOf('OUT_OF_STOCK:') === 0;
      var isKnownStockMsg = isOutOfStockMsg || errCode.indexOf('VARIANT_NOT_TRACKED:') === 0 || errCode === 'STOCK_CHECK_UNAVAILABLE';
      if (!isKnownStockMsg && friendly.indexOf('WhatsApp') === -1 && errCode && errCode.length < 120) {
        friendly = friendly + ' (' + errCode + ')';
      }
      return ContentService.createTextOutput('Error|' + friendly)
        .setMimeType(ContentService.MimeType.TEXT);
    }
    if (errCode === 'RATE_LIMIT') {
      return jsonOut_({ ok: false, error: 'RATE_LIMIT', message: 'অনেকবার চেষ্টা। কিছুক্ষণ পর আবার করুন।' });
    }
    return jsonOut_({ ok: false, error: errCode });
  }
}

// ── Online Order: H = size, I = total, J = order ID, K = status ──
// Existing integrations use the original logical A–AT field order. Resolve the
// inserted H column at the sheet boundary, so legacy sheets and other tabs keep
// their existing field positions. The cache lives only for this execution.
var ONLINE_ORDER_LAYOUT_CACHE_ = {};

function onlineOrderHasSizeColumn_(sheet) {
  if (!sheet || sheet.getName() !== 'Online Order') return false;
  var key = sheet.getParent().getId() + ':' + sheet.getSheetId();
  if (Object.prototype.hasOwnProperty.call(ONLINE_ORDER_LAYOUT_CACHE_, key)) {
    return ONLINE_ORDER_LAYOUT_CACHE_[key];
  }
  var headers = sheet.getRange(1, 8, 1, 3).getValues()[0];
  var sizeHeader = String(headers[0] || '').trim();
  var inserted = /সাইজ|\bsize\b/i.test(sizeHeader) ||
    (!sizeHeader && String(headers[1] || '').trim() === 'মোট টাকা' &&
      String(headers[2] || '').trim() === 'অর্ডার আইডি');
  ONLINE_ORDER_LAYOUT_CACHE_[key] = inserted;
  return inserted;
}

function onlineOrderColumn_(sheet, originalColumn) {
  return originalColumn + (originalColumn >= 8 && onlineOrderHasSizeColumn_(sheet) ? 1 : 0);
}

// Deployment verification exposes only column numbers, never customer/order data.
function getOnlineOrderSchemaStatus_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) return { ok: false, error: 'NO_SHEET' };
  return {
    ok: true,
    version: 'order-size-h-20261012',
    columns: {
      size: onlineOrderHasSizeColumn_(sheet) ? 8 : null,
      total: onlineOrderColumn_(sheet, 8), orderId: onlineOrderColumn_(sheet, 9),
      status: onlineOrderColumn_(sheet, 10), tracking: onlineOrderColumn_(sheet, 11),
      notes: onlineOrderColumn_(sheet, 17), images: onlineOrderColumn_(sheet, 18),
      cartJSON: onlineOrderColumn_(sheet, 33)
    }
  };
}

function normalizeOnlineOrderRows_(sheet, rows) {
  if (!onlineOrderHasSizeColumn_(sheet)) return rows;
  return rows.map(function (row) {
    var logical = row.slice(0, 7).concat(row.slice(8));
    logical.orderSizeText_ = String(row[7] || '');
    return logical;
  });
}

function readOnlineOrderRows_(sheet, row, rowCount, originalLastColumn) {
  if (row === undefined) return normalizeOnlineOrderRows_(sheet, sheet.getDataRange().getValues());
  if (!rowCount) return [];
  return normalizeOnlineOrderRows_(sheet,
    sheet.getRange(row, 1, rowCount, onlineOrderColumn_(sheet, originalLastColumn)).getValues());
}

// Preserve the independently populated H cell when an admin edits B–Q.
function writeOnlineOrderFields_(sheet, row, originalFirstColumn, values) {
  var split = 8 - originalFirstColumn;
  if (onlineOrderHasSizeColumn_(sheet) && split > 0 && split < values.length) {
    sheet.getRange(row, originalFirstColumn, 1, split).setValues([values.slice(0, split)]);
    sheet.getRange(row, 9, 1, values.length - split).setValues([values.slice(split)]);
    return;
  }
  sheet.getRange(row, onlineOrderColumn_(sheet, originalFirstColumn), 1, values.length).setValues([values]);
}

// Long courier logs and tracking JSON must stay inside their own cells.
// Formatting empty rows does not add content or change getLastRow().
function formatOnlineOrderDisplay_(sheet, row) {
  if (!sheet || sheet.getName() !== 'Online Order') return;
  var firstRow = row || 2;
  var rowCount = row ? 1 : Math.max(0, sheet.getMaxRows() - 1);
  if (rowCount) {
    sheet.getRange(firstRow, onlineOrderColumn_(sheet, 17), rowCount, 1)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setVerticalAlignment('top');
    var metaStart = onlineOrderColumn_(sheet, 30);
    var metaWidth = Math.min(10, sheet.getMaxColumns() - metaStart + 1);
    if (metaWidth > 0) sheet.getRange(firstRow, metaStart, rowCount, metaWidth)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP).setVerticalAlignment('top');
  }
  if (!row) {
    sheet.setColumnWidth(onlineOrderColumn_(sheet, 17), 300);
    sheet.setFrozenRows(Math.max(1, sheet.getFrozenRows()));
  }
}

// Hide internal fields only on an explicit setup. Opening the sheet does not
// re-hide columns that an operator has chosen to inspect.
function setupOnlineOrderDisplayNow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) throw new Error('Online Order শীট পাওয়া যায়নি।');
  formatOnlineOrderDisplay_(sheet);
  var maxColumns = sheet.getMaxColumns();
  var trackingStart = onlineOrderColumn_(sheet, 30);
  var flagsStart = onlineOrderColumn_(sheet, 36);
  if (trackingStart + 3 <= maxColumns) sheet.hideColumns(trackingStart, 4);
  if (flagsStart + 3 <= maxColumns) sheet.hideColumns(flagsStart, 4);
  var helperColumn = sheet.getLastColumn();
  if (helperColumn && /পণ্যের সাইজ.*স্বয়ংক্রিয়/.test(String(sheet.getRange(1, helperColumn).getValue() || ''))) {
    sheet.hideColumns(helperColumn);
  }
  return { ok: true };
}

function formatOnlineOrderSizes_(items, design) {
  if (Array.isArray(items) && items.length) {
    return items.map(function (item, index) {
      var size = String((item && (item.size || item.selectedSize)) || '').trim().slice(0, 160);
      return (index + 1) + '. ' + (size || 'সাইজ নির্বাচন করা হয়নি');
    }).join('\n');
  }
  // Older manual orders store their actual sizes in the product description.
  // Leave unknown sizes blank rather than inferring a default from the product.
  var found = false;
  var sizes = String(design || '').split(/\n/).filter(function (line) {
    return String(line).trim();
  }).map(function (line, index) {
    var match = line.match(/Body\s+\d+(?:\s*\([^)]*\))?\s*·\s*Length\s+\d+(?:\s*-\s*\d+)?(?:\s*inch)?/i);
    if (match) found = true;
    return (index + 1) + '. ' + (match ? match[0] : 'সাইজ সংরক্ষিত নেই');
  });
  return found ? sizes.join('\n') : '';
}

function appendOnlineOrderRow_(sheet, values, sizeText) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return appendOnlineOrderRowLocked_(sheet, values, sizeText);
  } finally {
    lock.releaseLock();
  }
}

// Caller must already hold the script lock. Used by order submission so stock
// reserve + order append happen in one critical section without a nested lock.
function appendOnlineOrderRowLocked_(sheet, values, sizeText) {
  var physical = values.slice();
  if (onlineOrderHasSizeColumn_(sheet)) {
    physical.splice(7, 0, String(sizeText || formatOnlineOrderSizes_([], values[6])));
  }
  // Append right after the last real order (name/phone), not after
  // getLastRow(): formulas or formatting further down (e.g. a QA/helper
  // column) would otherwise push new orders hundreds of rows below the rest.
  var row = lastOnlineOrderDataRow_(sheet) + 1;
  writeRowAt_(sheet, row, physical);
  if (onlineOrderHasSizeColumn_(sheet)) {
    sheet.getRange(row, 8).clearDataValidations().setWrap(true).setVerticalAlignment('top');
  }
  try { formatOnlineOrderDisplay_(sheet, row); } catch (displayErr) {}
  return row;
}

function syncOnlineOrderSizesNow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet || !onlineOrderHasSizeColumn_(sheet)) {
    throw new Error('Online Order-এর H কলামে পণ্যের সাইজ হেডার প্রয়োজন।');
  }
  var rows = readOnlineOrderRows_(sheet);
  var sizes = [];
  for (var i = 1; i < rows.length; i++) {
    var items = [];
    try { items = JSON.parse(String(rows[i][32] || '[]')); } catch (err) {}
    sizes.push([formatOnlineOrderSizes_(items, rows[i][6]) || rows[i].orderSizeText_ || '']);
  }
  sheet.getRange(1, 8).setValue('পণ্যের সাইজ');
  if (sizes.length) sheet.getRange(2, 8, sizes.length, 1).setValues(sizes)
    .clearDataValidations().setWrap(true).setVerticalAlignment('top');
  sheet.setColumnWidth(8, 235);
  return { ok: true, orders: sizes.length };
}

function orderErrorMessage_(code) {
  var map = {
    SPAM: 'অবৈধ অনুরোধ।',
    TOO_FAST: 'অনুগ্রহ করে ফর্ম পূরণ করে আবার চেষ্টা করুন।',
    EXPIRED: 'সেশন শেষ। পেজ রিফ্রেশ করে আবার অর্ডার করুন।',
    INVALID_NAME: 'সঠিক নাম লিখুন।',
    INVALID_PHONE: 'সঠিক ১১ ডিজিট মোবাইল নম্বর দিন (01XXXXXXXXX)।',
    INVALID_ADDRESS: 'সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন।',
    INVALID_QTY: 'অর্ডার পরিমাণ সঠিক নয়।',
    ORDER_BLOCKED: 'এই নম্বর থেকে অনলাইনে অর্ডার নেওয়া সম্ভব নয়। WhatsApp এ যোগাযোগ করুন।',
    MIN_ORDER: 'ন্যূনতম অর্ডার ৳১০০।',
    EMPTY_CART: 'কার্টে কোনো পণ্য নেই।',
    ORDER_RATE_LIMIT: 'এই নম্বর থেকে খুব দ্রুত অর্ডার হয়েছে। ৩০ মিনিট পর আবার চেষ্টা করুন।',
    DUPLICATE_ORDER: 'একই অর্ডার ইতিমধ্যে পাঠানো হয়েছে।'
  };
  if (map[code]) return map[code];
  if (/^(UNKNOWN_PRODUCT|INVALID_SIZE|SIZE_REQUIRED|PRODUCT_TYPE_REQUIRED|STRUCTURED_CART_REQUIRED|CATALOG_|PRICE_CHANGED|INVALID_CUSTOM_SIZE|INVALID_COUPON)/.test(String(code))) return 'পণ্য, সাইজ বা দাম নতুন করে যাচাই প্রয়োজন। পেজ রিফ্রেশ করে পণ্য/সাইজ আবার বেছে নিন অথবা WhatsApp-এ যোগাযোগ করুন।';
  var codeStr = String(code || '');
  if (codeStr.indexOf('VARIANT_NOT_TRACKED:') === 0) {
    return 'দুঃখিত, এই পণ্যের নির্বাচিত সাইজের স্টক যাচাই করা যাচ্ছে না। অন্য সাইজ বেছে নিন অথবা WhatsApp এ যোগাযোগ করুন।';
  }
  if (codeStr === 'STOCK_CHECK_UNAVAILABLE') {
    return 'এই মুহূর্তে স্টক যাচাই করা যাচ্ছে না। অর্ডারটি নেওয়া হয়নি—কিছুক্ষণ পর আবার চেষ্টা করুন।';
  }
  if (codeStr.indexOf('OUT_OF_STOCK:') === 0) {
    var label = codeStr.slice('OUT_OF_STOCK:'.length);
    return 'দুঃখিত, ' + label + ' এই মুহূর্তে স্টকে নেই। অন্য একটি পণ্য বেছে নিন অথবা কিছুক্ষণ পর আবার চেষ্টা করুন।';
  }
  return 'অর্ডার গ্রহণ করা যায়নি। WhatsApp এ যোগাযোগ করুন।';
}

function validateOrderInput_(e) {
  if (param_(e, '_hp')) throw new Error('SPAM');

  var siteTs = parseInt(param_(e, 'SiteTs'), 10);
  var ageMs = Date.now() - siteTs;
  if (!siteTs || ageMs < 1200) throw new Error('TOO_FAST');
  if (ageMs > 30 * 60 * 1000) throw new Error('EXPIRED');

  var name = String(param_(e, 'Name') || '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 80) throw new Error('INVALID_NAME');
  if (/^(test|asdf|xxx+|fake|spam|demo|null|undefined)$/i.test(name)) throw new Error('INVALID_NAME');

  var phone = normalizePhone_(param_(e, 'Phone'));
  if (!/^01\d{9}$/.test(phone)) throw new Error('INVALID_PHONE');

  var address = String(param_(e, 'Address') || '').trim();
  if (address.length < 8 || address.length > 400) throw new Error('INVALID_ADDRESS');

  var qty = parseInt(param_(e, 'Quantity'), 10) || 0;
  if (qty < 1 || qty > 500) throw new Error('INVALID_QTY');

  var total = parseFloat(String(param_(e, 'Total') || '0').replace(/[^\d.]/g, '')) || 0;
  if (total < 100) throw new Error('MIN_ORDER');

  var design = String(param_(e, 'Design') || '').trim();
  var slotItems = [];
  var i;
  for (i = 1; i <= 50; i++) {
    var v = param_(e, 'Product_' + i);
    if (v && String(v).trim() !== '') slotItems.push(String(v).trim());
  }
  if (!design && !slotItems.length) throw new Error('EMPTY_CART');

  var cartItems = [];
  try {
    var cartJsonRaw = param_(e, 'CartJSON');
    if (cartJsonRaw) {
      var parsedCart = JSON.parse(cartJsonRaw);
      if (Array.isArray(parsedCart)) {
        cartItems = parsedCart.map(function (it) {
          var line = {
            id: String((it && it.id) || '').trim(),
            name: String((it && it.name) || '').trim(),
            qty: Number(it && it.qty),
            price: parseFloat(it && it.price) || 0,
            size: String((it && (it.size || it.selectedSize)) || '').trim().slice(0, 160),
            color: String((it && it.color) || '').trim().slice(0, 80),
            productType: String((it && it.productType) || '').trim().slice(0, 80),
            category: String((it && it.category) || '').trim().slice(0, 80)
          };
          // Size Manager: measurement choices ({key, value}); checked against the size template in opsLinePrice_.
          if (it && Array.isArray(it.measurements) && it.measurements.length) {
            line.measurements = it.measurements.slice(0, 12).map(function (m) {
              return { key: String((m && m.key) || '').slice(0, 40), value: String(m && m.value != null ? m.value : '').slice(0, 80) };
            });
          }
          return line;
        }).filter(function (it) { return it.id; });
      }
    }
  } catch (cartParseErr) {
    cartItems = [];
  }

  return {
    name: name,
    phone: phone,
    address: address,
    qty: qty,
    total: total,
    district: param_(e, 'District'),
    slotItems: slotItems,
    cartItems: cartItems,
    design: slotItems.length
      ? formatOrderDesignLines_(slotItems)
      : formatOrderDesignLines_(String(design).split(/\n/))
  };
}

/** প্রতিটি প্রোডাক্ট আলাদা লাইনে — Sheet column G-তে শুধু নাম */
function stripOrderLineToProductName_(raw) {
  var s = String(raw || '').trim();
  if (!s) return '';
  s = s.replace(/^\d+\.\s*/, '');
  s = s.split(/\s*\|\s*/)[0].trim();
  s = s.replace(/\s*\(Body\s+.*\)\s*$/i, '');
  s = s.replace(/\s*\(Size\s+.*\)\s*$/i, '');
  return s.trim();
}

function formatOrderDesignLines_(slotItems) {
  var lines = [];
  var i;
  for (i = 0; i < slotItems.length; i++) {
    var raw = String(slotItems[i] || '').trim();
    if (!raw) continue;
    var nameOnly = stripOrderLineToProductName_(raw);
    if (!nameOnly) continue;
    lines.push((lines.length + 1) + '. ' + nameOnly);
  }
  return lines.join('\n');
}

function formatOnlineOrderProductCell_(sheet, row, designText) {
  if (!sheet || !row || row < 2) return;
  var text = String(designText || '').trim();
  if (!text) return;
  var cell = sheet.getRange(row, 7);
  cell.setValue(text);
  try {
    cell.clearDataValidations();
    cell.setWrap(true);
    cell.setVerticalAlignment('top');
    var lineCount = text.split('\n').length;
    var longest = 0;
    var lines = text.split('\n');
    var i;
    for (i = 0; i < lines.length; i++) {
      var len = String(lines[i] || '').length;
      if (len > longest) longest = len;
    }
    // WhatsApp single-line orders should stay compact; multiline catalog orders can grow.
    var visualLines = Math.max(lineCount, Math.ceil(longest / 42));
    var minHeight = lineCount <= 1 ? 28 : 52;
    var targetHeight = Math.min(260, Math.max(minHeight, visualLines * 18 + 10));
    sheet.setRowHeight(row, targetHeight);
  } catch (fmtErr) {}
}

function buildCourierItemDescription_(ctx) {
  var lines = [];
  if (ctx && ctx.slotItems && ctx.slotItems.length) {
    lines = ctx.slotItems.slice();
  } else if (ctx && ctx.design) {
    lines = String(ctx.design).split(/\n/).map(function (s) { return String(s || '').trim(); }).filter(Boolean);
    if (lines.length <= 1) {
      lines = String(ctx.design).split(/,/).map(function (s) { return String(s || '').trim(); }).filter(Boolean);
    }
  }
  if (!lines.length) return String((ctx && ctx.design) || 'Muslim Abaya order').slice(0, 500);
  var sizeText = String((ctx && ctx.sizeText) || '');
  if (!sizeText && ctx && ctx.sheet && ctx.row && onlineOrderHasSizeColumn_(ctx.sheet)) {
    sizeText = String(ctx.sheet.getRange(ctx.row, 8).getValue() || '');
  }
  var sizes = sizeText.split(/\n/);
  lines = lines.map(function (line, index) {
    var size = String(sizes[index] || '').replace(/^\d+\.\s*/, '').trim();
    return size && line.indexOf(size) === -1 ? line + ' · ' + size : line;
  });
  return lines.slice(0, 10).join('\n').slice(0, 500);
}

function getProductCatalogUrl_() {
  return PropertiesService.getScriptProperties().getProperty('PRODUCT_CATALOG_URL') ||
    'https://muslimabaya.com/category-products.js';
}

function parseProductsFromCatalogJs_(text) {
  var items = [];
  var re = /\{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"((?:\\.|[^"\\])*)"[\s\S]*?price:\s*(\d+)/g;
  var m;
  var seen = {};
  while ((m = re.exec(text)) !== null) {
    var id = m[1];
    var name = m[2].replace(/\\"/g, '"');
    var price = parseInt(m[3], 10) || 0;
    if (/ - Back$| - Side$/i.test(name)) continue;
    var key = name.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    var category = 'other';
    if (/^ABY-/i.test(id)) category = 'abaya';
    else if (/^DR-/i.test(id)) category = 'premium-two-piece';
    items.push({ id: id, name: name, price: price, category: category });
  }
  items.sort(function (a, b) { return a.name.localeCompare(b.name); });
  return items;
}

function fetchProductCatalog_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('ma_product_catalog_v1');
  if (cached) {
    try { return JSON.parse(cached); } catch (cacheErr) {}
  }
  var url = getProductCatalogUrl_();
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() >= 400) {
    throw new Error('CATALOG_FETCH_FAIL HTTP ' + res.getResponseCode());
  }
  var items = parseProductsFromCatalogJs_(res.getContentText());
  cache.put('ma_product_catalog_v1', JSON.stringify(items), 21600);
  return items;
}

function getPickerCatalog() {
  try {
    return fetchProductCatalog_();
  } catch (err) {
    return [];
  }
}

function getPickerSizeOptions() {
  return {
    abaya: { body: '46 [Free size]', lengths: ['50', '52', '54', '56'] },
    'premium-two-piece': { body: '42 (Free size)', lengths: ['37-38 inch'] }
  };
}

function designTextToSlotItems_(designText) {
  return String(designText || '').split(/\n/).map(function (s) {
    return String(s || '').trim();
  }).filter(Boolean);
}

function fillActiveRowProductLines_(linesText) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order') ||
    SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = sheet.getActiveCell().getRow();
  if (row <= 1) throw new Error('Select a data row (row 2+)');
  var text = String(linesText || '').trim();
  if (!text) throw new Error('No product lines');
  formatOnlineOrderProductCell_(sheet, row, text);
  var lines = designTextToSlotItems_(text);
  var totalQty = 0;
  var totalAmt = 0;
  var i;
  for (i = 0; i < lines.length; i++) {
    var line = lines[i];
    var qm = line.match(/×\s*(\d+)\s*pcs/i);
    var pm = line.match(/=\s*৳?\s*([\d,]+)/);
    if (qm) totalQty += parseInt(qm[1], 10) || 0;
    if (pm) totalAmt += parseFloat(String(pm[1]).replace(/,/g, '')) || 0;
  }
  if (totalQty > 0) sheet.getRange(row, 4).setValue(totalQty);
  if (totalAmt > 0) sheet.getRange(row, onlineOrderColumn_(sheet, 8)).setValue(totalAmt);
  return { ok: true, row: row, qty: totalQty, total: totalAmt };
}

function fillActiveRowProductLines(linesText) {
  try {
    return fillActiveRowProductLines_(linesText);
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

function openProductPickerSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('ProductPicker')
    .setTitle('Product Picker')
    .setWidth(340);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openWhatsappOrderMiniFormSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('WhatsAppOrderMiniForm')
    .setTitle('WhatsApp Order Mini Form')
    .setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

function openRealitySoftwareDashboard() {
  var html = HtmlService.createHtmlOutputFromFile('RealityDashboard')
    .setTitle('Reality Operations Dashboard')
    .setWidth(430);
  SpreadsheetApp.getUi().showSidebar(html);
}

function getRealityDashboardToken_() {
  return PropertiesService.getUserProperties().getProperty('REALITY_DASH_TOKEN') || '';
}

function setRealityDashboardToken_(token) {
  if (token) {
    PropertiesService.getUserProperties().setProperty('REALITY_DASH_TOKEN', token);
  } else {
    PropertiesService.getUserProperties().deleteProperty('REALITY_DASH_TOKEN');
  }
}

function verifyOpsSession_(token) {
  var v = verifySession_(token);
  if (!v.ok) return v;
  var role = String(v.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'staff') {
    return { ok: false, error: 'NOT_ALLOWED', message: 'Ops access denied.' };
  }
  return v;
}

function requireRealityAdminSession_() {
  var token = getRealityDashboardToken_();
  if (!token) throw new Error('AUTH_REQUIRED');
  var v = verifyOpsSession_(token);
  if (!v || !v.ok) {
    setRealityDashboardToken_('');
    throw new Error('AUTH_REQUIRED');
  }
  return v;
}

/**
 * Initial deny-by-default permission slice. Add a permission to this matrix
 * deliberately before wiring its API route; unknown permissions/roles deny.
 */
var ADMIN_PERMISSION_MATRIX_ = Object.freeze({
  admin: Object.freeze(['admin.owner_actions', 'ops.protected.manage']),
  staff: Object.freeze([])
});

function adminHasPermission_(session, permission) {
  if (!session || session.ok === false) return false;
  var requested = String(permission || '').trim();
  if (!requested) return false;
  var role = String(session.role || '').trim().toLowerCase();
  var allowed = ADMIN_PERMISSION_MATRIX_[role];
  return Array.isArray(allowed) && allowed.indexOf(requested) !== -1;
}

function requireAdminPermission_(session, permission) {
  if (adminHasPermission_(session, permission)) return null;
  return { ok: false, error: 'FORBIDDEN', message: 'এই কাজের অনুমতি নেই।' };
}

function canManageProtectedOps_(session) {
  return adminHasPermission_(session, 'ops.protected.manage');
}

function effectiveOpsRole_(session) {
  var role = String((session && session.role) || '').toLowerCase();
  if (role === 'staff' && canManageProtectedOps_(session)) return 'owner';
  return role || 'staff';
}

function requireRealityManager_() {
  var v = requireRealityAdminSession_();
  if (requireAdminPermission_(v, 'ops.protected.manage')) {
    throw new Error('ADMIN_ONLY');
  }
  return v;
}

function realityGetAuthState() {
  try {
    var v = requireRealityAdminSession_();
    return {
      ok: true,
      authenticated: true,
      name: v.name || 'Admin',
      email: v.email || '',
      role: v.role || 'staff',
      effectiveRole: effectiveOpsRole_(v),
      canManageSettings: canManageProtectedOps_(v)
    };
  } catch (err) {
    return { ok: true, authenticated: false };
  }
}

function realityLogin(identifier, password) {
  var login = String(identifier || '').trim();
  var pass = String(password || '');
  if (!login || !pass) return { ok: false, message: 'লগইন ও পাসওয়ার্ড দিন।' };
  var res = loginAdmin_({
    parameter: {
      Login: login,
      Password: pass
    }
  });
  if (!res || !res.ok || !res.token) {
    return { ok: false, message: (res && res.message) || 'লগইন ব্যর্থ।' };
  }
  setRealityDashboardToken_(res.token);
  return { ok: true, name: res.name || 'Admin', email: res.email || '', role: res.role || 'staff' };
}

function realityLogout() {
  setRealityDashboardToken_('');
  return { ok: true };
}

function parseNumberOrZero_(value) {
  return parseFloat(String(value || '0').replace(/[^\d.]/g, '')) || 0;
}

function getRealityDashboardData() {
  var viewer = requireRealityAdminSession_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Online Order');
  if (!sheet) {
    return { ok: false, error: 'NO_SHEET', message: 'Online Order শিট পাওয়া যায়নি।' };
  }
  var data = readOnlineOrderRows_(sheet);
  var todayKey = Utilities.formatDate(new Date(), 'GMT+6', 'yyyy-MM-dd');
  var stats = {
    totalToday: 0,
    pending: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    todayRevenue: 0,
    courierPending: 0
  };
  var recent = [];
  var i;
  for (i = data.length - 1; i >= 1; i--) {
    var r = data[i];
    if (!r || (!r[1] && !r[2])) continue;
    var rowDay = dayKeyFromCell_(r[0]);
    var orderStatus = String(r[9] || 'Pending').trim();
    var orderStatusLc = orderStatus.toLowerCase();
    var courierStatus = normalizeSteadfastDeliveryStatus_(String(r[12] || ''));
    var total = parseNumberOrZero_(r[7]);
    if (rowDay === todayKey) {
      stats.totalToday++;
      stats.todayRevenue += total;
      if (orderStatusLc === 'pending') stats.pending++;
      else if (orderStatusLc === 'shipped') stats.shipped++;
      else if (orderStatusLc === 'delivered') stats.delivered++;
      else if (orderStatusLc === 'cancelled') stats.cancelled++;
      if (courierStatus === 'pending' || courierStatus === 'in_review' || courierStatus === 'approval_pending') {
        stats.courierPending++;
      }
    }
    if (recent.length < 25) {
      recent.push({
        row: i + 1,
        time: formatCell_(r[0]),
        orderId: String(r[8] || ''),
        name: String(r[1] || ''),
        phone: String(r[2] || ''),
        district: String(r[13] || ''),
        total: total,
        status: orderStatus || 'Pending',
        courierStatus: courierStatus || '',
        tracking: String(r[10] || ''),
        notes: String(r[16] || '')
      });
    }
  }
  return {
    ok: true,
    today: stats,
    recent: recent,
    sync: {
      statusTrigger: hasSteadfastStatusSyncTrigger_(),
      autoCourier: isAutoCourierEnabled_(),
      autoCourierMode: getAutoCourierMode_(),
      dailyBackupTrigger: hasDailySafetyBackupTrigger_(),
      dailyBackupEnabled: isDailySafetyBackupEnabled_(),
      backupSheetId: PropertiesService.getScriptProperties().getProperty('SAFETY_BACKUP_SPREADSHEET_ID') || ''
    },
    viewer: {
      name: viewer.name || '',
      email: viewer.email || '',
      role: viewer.role || 'staff',
      effectiveRole: effectiveOpsRole_(viewer),
      canManageSettings: canManageProtectedOps_(viewer)
    }
  };
}

function realityRunStatusSyncNow() {
  requireRealityAdminSession_();
  var result = syncSteadfastCourierStatusesCore_({ limit: 120, includeFinal: false });
  if (!result.ok) return result;
  return {
    ok: true,
    scanned: result.scanned,
    updated: result.updated,
    failed: result.failed
  };
}

function realitySetStatusSync(enabled) {
  requireRealityManager_();
  if (enabled) {
    setupSteadfastStatusSyncTrigger();
    return { ok: true, enabled: true };
  }
  disableSteadfastStatusSyncTrigger();
  return { ok: true, enabled: false };
}

function realityRunSafetyBackupNow() {
  requireRealityManager_();
  return runSafetyBackupNow();
}

function realitySetDailyBackup(enabled) {
  requireRealityManager_();
  if (enabled) {
    setupDailySafetyBackupTrigger();
    return { ok: true, enabled: true };
  }
  disableDailySafetyBackupTrigger();
  return { ok: true, enabled: false };
}

function realityOpenOrderRow(rowNumber) {
  requireRealityAdminSession_();
  var row = parseInt(rowNumber, 10);
  if (!row || row < 2) return { ok: false, error: 'INVALID_ROW' };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Online Order');
  if (!sheet) return { ok: false, error: 'NO_SHEET' };
  ss.setActiveSheet(sheet);
  sheet.setActiveRange(sheet.getRange(row, 1, 1, Math.max(1, sheet.getLastColumn())));
  return { ok: true, row: row };
}

function realityChangeMyPassword(currentPassword, newPassword) {
  var v = requireRealityAdminSession_();
  var current = String(currentPassword || '');
  var next = String(newPassword || '');
  if (!current || !next) return { ok: false, message: 'Current/New password দিন।' };
  if (next.length < 8) return { ok: false, message: 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষর।' };

  var admin = v.email ? findAdminByEmail_(v.email) : findAdminByPhone_(v.phone);
  if (!admin) return { ok: false, message: 'Admin account পাওয়া যায়নি।' };
  if (!verifyPassword_(current, admin.salt, admin.hash)) {
    return { ok: false, message: 'Current password ভুল।' };
  }
  var hashed = hashPassword_(next);
  var sheet = getAdminsSheet_();
  sheet.getRange(admin.row, 4).setValue(hashed.hash);
  sheet.getRange(admin.row, 5).setValue(hashed.salt);
  if (sheet.getLastColumn() >= 9) sheet.getRange(admin.row, 9).setValue(new Date());
  return { ok: true, message: 'Password updated.' };
}

function resetAdminPasswordFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var idResp = ui.prompt('Admin reset', 'Email বা Phone দিন', ui.ButtonSet.OK_CANCEL);
  if (idResp.getSelectedButton() !== ui.Button.OK) return;
  var idRaw = String(idResp.getResponseText() || '').trim();
  if (!idRaw) {
    ui.alert('Email/Phone দিন।');
    return;
  }
  var passResp = ui.prompt('New password', 'কমপক্ষে ৮ অক্ষর', ui.ButtonSet.OK_CANCEL);
  if (passResp.getSelectedButton() !== ui.Button.OK) return;
  var next = String(passResp.getResponseText() || '');
  if (next.length < 8) {
    ui.alert('পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে।');
    return;
  }
  var target = null;
  if (idRaw.indexOf('@') !== -1) target = findAdminByEmail_(normalizeEmail_(idRaw));
  if (!target) target = findAdminByPhone_(normalizePhone_(idRaw));
  if (!target) {
    ui.alert('Admin account পাওয়া যায়নি।');
    return;
  }
  var hashed = hashPassword_(next);
  var sheet = getAdminsSheet_();
  sheet.getRange(target.row, 4).setValue(hashed.hash);
  sheet.getRange(target.row, 5).setValue(hashed.salt);
  if (sheet.getLastColumn() >= 9) sheet.getRange(target.row, 9).setValue(new Date());
  ui.alert('Password reset complete for: ' + (target.email || target.phone || 'admin'));
}

function hasDailySafetyBackupTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailySafetyBackupTriggerHandler') return true;
  }
  return false;
}

function isDailySafetyBackupEnabled_() {
  var raw = PropertiesService.getScriptProperties().getProperty('DAILY_BACKUP_ON');
  if (raw === null || raw === undefined || String(raw).trim() === '') return true; // default ON
  var v = String(raw).toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function getSafetyBackupSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var backupId = props.getProperty('SAFETY_BACKUP_SPREADSHEET_ID') || '';
  if (backupId) {
    try {
      return SpreadsheetApp.openById(backupId);
    } catch (err) {}
  }
  var backup = SpreadsheetApp.create('Luxury Dress Safety Backup');
  props.setProperty('SAFETY_BACKUP_SPREADSHEET_ID', backup.getId());
  return backup;
}

function copySheetToBackup_(sourceSheet, backupSpreadsheet, targetName) {
  var target = backupSpreadsheet.getSheetByName(targetName);
  if (!target) target = backupSpreadsheet.insertSheet(targetName);
  target.clear();
  var lastRow = sourceSheet.getLastRow();
  var lastCol = sourceSheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) return 0;
  var vals = sourceSheet.getRange(1, 1, lastRow, lastCol).getValues();
  target.getRange(1, 1, vals.length, vals[0].length).setValues(vals);
  return vals.length - 1;
}

function runSafetyBackupNow() {
  var lock = LockService.getUserLock();
  if (!lock.tryLock(1000)) return { ok: false, error: 'BACKUP_IN_PROGRESS' };
  try {
    var src = SpreadsheetApp.getActiveSpreadsheet();
    if (!src) return { ok: false, error: 'NO_SOURCE_SHEET' };
    var stamp = Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyy-MM-dd HH-mm-ss');
    // Native workbook copy preserves images, formulas and formatting. Never clear an older backup.
    var backup = src.copy('Luxury Dress Safety Backup ' + stamp);
    if (!backup || src.getId() === backup.getId()) throw new Error('BACKUP_COPY_FAILED');
    var copied = [], totalRows = 0;
    src.getSheets().forEach(function(source) {
      var target = backup.getSheetByName(source.getName());
      if (!target || source.getLastRow() !== target.getLastRow() || source.getLastColumn() !== target.getLastColumn()) {
        throw new Error('BACKUP_VERIFICATION_FAILED');
      }
      var rows = Math.max(0, source.getLastRow() - 1);
      copied.push({ name: source.getName(), rows: rows });
      totalRows += rows;
    });
    // Publish the new backup pointer only after every source tab has been verified.
    var props = PropertiesService.getScriptProperties();
    props.setProperties({ SAFETY_BACKUP_SPREADSHEET_ID: backup.getId(), OPS_LAST_BACKUP_AT: new Date().toISOString() });
    console.log('SAFETY_BACKUP_OK ' + JSON.stringify({ tabs: copied.length, rows: totalRows }));
    return { ok: true, backupSpreadsheetId: backup.getId(), backupSpreadsheetUrl: backup.getUrl(), copiedTabs: copied, totalRows: totalRows };
  } finally {
    lock.releaseLock();
  }
}

function runSafetyBackupNowFromMenu() {
  var res = runSafetyBackupNow();
  if (!res.ok) {
    SpreadsheetApp.getUi().alert('Safety backup failed: ' + String(res.error || 'UNKNOWN'));
    return;
  }
  SpreadsheetApp.getUi().alert(
    'Safety backup complete.\n\n' +
    'Rows copied: ' + res.totalRows + '\n' +
    'Backup sheet URL:\n' + res.backupSpreadsheetUrl
  );
}

function dailySafetyBackupTriggerHandler() {
  try {
    var backupResult = runSafetyBackupNow();
    if (typeof recordAutomationLog_ === 'function') {
      recordAutomationLog_(
        'BACKUP',
        !!(backupResult && backupResult.ok),
        0,
        0,
        backupResult && backupResult.ok
          ? 'Safety backup created: ' + backupResult.backupSpreadsheetId
          : String((backupResult && backupResult.error) || 'BACKUP_FAILED')
      );
    }
  } catch (err) {
    if (typeof recordAutomationLog_ === 'function') {
      recordAutomationLog_('BACKUP', false, 0, 0, String(err.message || err));
    }
  }
  try {
    checkLowStockAndEmail_();
  } catch (err2) {}
  try {
    cleanupExpiredSessions_();
  } catch (err3) {}
}

/**
 * Deletes Sessions rows whose ExpiresAt is in the past. Such tokens are
 * already rejected by verifySession_ (EXPIRED), so removing them changes no
 * login behaviour; it only stops old tokens piling up in the sheet.
 * Rows with a missing/unreadable expiry are kept. Runs with the daily backup.
 */
function cleanupExpiredSessions_(nowMs) {
  var now = Number(nowMs) || Date.now();
  var sheet = getSessionsSheet_();
  var data = sheet.getDataRange().getValues();
  var removed = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    var raw = data[i][5];
    var expMs = raw instanceof Date ? raw.getTime() : (raw === '' || raw === null ? NaN : new Date(raw).getTime());
    if (isFinite(expMs) && expMs > 0 && now > expMs) {
      sheet.deleteRow(i + 1);
      removed++;
    }
  }
  return { ok: true, removed: removed };
}

function getLowStockThreshold_() {
  var v = Number(PropertiesService.getScriptProperties().getProperty('LOW_STOCK_THRESHOLD'));
  return (v && v > 0) ? v : 5;
}

function checkLowStockAndEmail_() {
  var sheet = ensureStockSheet_();
  var data = sheet.getDataRange().getValues();
  var threshold = getLowStockThreshold_();
  var low = [];
  var i;
  for (i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;
    var qty = Number(r[2]) || 0;
    if (qty <= threshold) {
      low.push({ id: String(r[0]), name: String(r[1] || ''), qty: qty });
    }
  }
  if (!low.length) return { ok: true, low: [] };
  var lines = low.map(function (item) {
    return '- ' + item.name + ' (' + item.id + '): ' + item.qty + ' pcs বাকি';
  });
  var body =
    'নিচের প্রোডাক্টগুলোর স্টক কমে গেছে (থ্রেশহোল্ড: ' + threshold + ' পিস):\n\n' +
    lines.join('\n') +
    '\n\nস্টক আপডেট করতে: স্টক ও অ্যানালিটিক্স পেজে যান।';
  try {
    MailApp.sendEmail({
      to: Session.getEffectiveUser().getEmail(),
      subject: 'Muslim Abaya — লো স্টক অ্যালার্ট (' + low.length + 'টি প্রোডাক্ট)',
      body: body
    });
  } catch (mailErr) {}
  return { ok: true, low: low };
}

function checkLowStockNowFromMenu_() {
  var res = checkLowStockAndEmail_();
  if (!res.low.length) {
    SpreadsheetApp.getUi().alert('লো স্টকে কোনো প্রোডাক্ট নেই।');
  } else {
    SpreadsheetApp.getUi().alert('লো স্টক ইমেইল পাঠানো হয়েছে (' + res.low.length + 'টি প্রোডাক্ট)।');
  }
}

function setupDailySafetyBackupTriggerInternal_() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailySafetyBackupTriggerHandler') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('dailySafetyBackupTriggerHandler')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
}

function setupDailySafetyBackupTrigger() {
  PropertiesService.getScriptProperties().setProperty('DAILY_BACKUP_ON', 'true');
  setupDailySafetyBackupTriggerInternal_();
  SpreadsheetApp.getUi().alert('Daily safety backup ON (প্রতিদিন ১বার)।');
}

function disableDailySafetyBackupTrigger() {
  PropertiesService.getScriptProperties().setProperty('DAILY_BACKUP_ON', 'false');
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'dailySafetyBackupTriggerHandler') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  SpreadsheetApp.getUi().alert(removed ? 'Daily safety backup OFF করা হয়েছে।' : 'Daily backup trigger আগে থেকেই OFF ছিল।');
}

function selfHealDailySafetyBackupTrigger_() {
  try {
    if (!isDailySafetyBackupEnabled_()) return;
    if (hasDailySafetyBackupTrigger_()) return;
    setupDailySafetyBackupTriggerInternal_();
  } catch (err) {}
}

function parseWhatsappOrderTextForMiniForm(rawText) {
  return parseWhatsappOrderText_(rawText);
}

function parseWhatsappOrderText_(rawText) {
  var text = String(rawText || '').replace(/\r/g, '\n');
  var lines = text.split('\n').map(function (line) {
    return String(line || '').replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
  var parsed = {
    name: '',
    phone: '',
    district: '',
    address: '',
    design: '',
    qty: '',
    total: '',
    payment: '',
    txn: '',
    notes: '',
    confidence: 0
  };

  if (!lines.length) return parsed;

  function parseMoney_(v) {
    return parseFloat(String(v || '').replace(/[^\d.]/g, '')) || 0;
  }

  function parseQty_(v) {
    var n = parseInt(String(v || '').replace(/[^\d]/g, ''), 10);
    return n > 0 ? n : 0;
  }

  function normalizePayment_(v) {
    var x = String(v || '').toLowerCase();
    if (/cod|cash|ডেলিভারি/.test(x)) return 'Cash On Delivery';
    if (/bkash|বিকাশ/.test(x)) return 'Bkash';
    if (/nagad|নগদ/.test(x)) return 'Nagad';
    if (/rocket|রকেট/.test(x)) return 'Rocket';
    if (/card/.test(x)) return 'Card';
    if (/bank/.test(x)) return 'Bank Transfer';
    return String(v || '').trim();
  }

  var keyMap = {
    name: ['name', 'customer name', 'নাম'],
    phone: ['phone', 'mobile', 'contact', 'ফোন', 'মোবাইল'],
    district: ['district', 'zilla', 'জেলা'],
    address: ['address', 'ঠিকানা'],
    design: ['product', 'item', 'design', 'পণ্য', 'প্রোডাক্ট', 'অর্ডার'],
    qty: ['qty', 'quantity', 'পরিমাণ'],
    total: ['total', 'amount', 'মোট'],
    payment: ['payment', 'pay', 'পেমেন্ট'],
    txn: ['txn', 'transaction', 'sender', 'trxid', 'ট্রানজ্যাকশন', 'রেফারেন্স'],
    notes: ['note', 'notes', 'নোট']
  };

  var extractedCount = 0;
  function assign_(key, value) {
    var val = String(value || '').trim();
    if (!val) return;
    if (key === 'phone') {
      val = normalizePhone_(val);
      if (!val) return;
    }
    if (key === 'qty') {
      var qtyNum = parseQty_(val);
      if (qtyNum > 0) val = String(qtyNum);
      else return;
    }
    if (key === 'total') {
      var amount = parseMoney_(val);
      if (amount > 0) val = String(amount);
      else return;
    }
    if (key === 'payment') {
      val = normalizePayment_(val) || 'Cash On Delivery';
    }
    if (!parsed[key]) extractedCount++;
    parsed[key] = val;
  }

  var i;
  for (i = 0; i < lines.length; i++) {
    var line = lines[i];
    var lowerLine = line.toLowerCase();
    var matched = false;
    var key;
    for (key in keyMap) {
      if (!Object.prototype.hasOwnProperty.call(keyMap, key)) continue;
      var aliases = keyMap[key];
      var a;
      for (a = 0; a < aliases.length; a++) {
        var label = aliases[a];
        var re = new RegExp('^' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[:\\-]\\s*(.+)$', 'i');
        var m = line.match(re);
        if (!m) continue;
        assign_(key, m[1]);
        matched = true;
        break;
      }
      if (matched) break;
    }
    if (matched) continue;

    // Flexible fallback patterns in free text
    if (!parsed.phone) {
      var phoneMatch = lowerLine.replace(/[^\d]/g, ' ').match(/\b(8801\d{9}|01\d{9})\b/);
      if (phoneMatch) assign_('phone', phoneMatch[1]);
    }
    if (!parsed.qty) {
      var q1 = line.match(/(?:qty|quantity|x|×)\s*[:=]?\s*(\d{1,3})/i);
      if (q1) assign_('qty', q1[1]);
    }
    if (!parsed.total) {
      var t1 = line.match(/(?:total|amount|মোট)\s*[:=]?\s*([৳\s\d,\.]+)/i);
      if (t1) assign_('total', t1[1]);
      else {
        var t2 = line.match(/৳\s*([\d,]+)/);
        if (t2) assign_('total', t2[1]);
      }
    }
    if (!parsed.payment && /bkash|nagad|rocket|cash|cod|card|ডেলিভারি/i.test(lowerLine)) {
      assign_('payment', line);
    }
    if (!parsed.address && /(road|rd|house|flat|thana|area|village|para|bazar|উপজেলা|থানা|রোড|বাড়ি|এলাকা)/i.test(lowerLine)) {
      assign_('address', line);
    }
    if (!parsed.design && /abaya|hijab|dress|burqa|kaftan|item|design|product|পিস|গাউন|বোরকা/i.test(lowerLine)) {
      assign_('design', line);
    }
    if (!parsed.name && i === 0 && !/order|অর্ডার|qty|total|phone|mobile|contact/i.test(lowerLine)) {
      assign_('name', line);
    }
  }

  // Pipe format fallback: ORDER|Name|Phone|District|Address|Product|Qty|Total|Payment
  if ((!parsed.phone || !parsed.address) && text.indexOf('|') !== -1) {
    var parts = text.split('|').map(function (p) { return String(p || '').trim(); });
    if (parts.length >= 8) {
      assign_('name', parts[1] || '');
      assign_('phone', parts[2] || '');
      assign_('district', parts[3] || '');
      assign_('address', parts[4] || '');
      assign_('design', parts[5] || '');
      assign_('qty', parts[6] || '');
      assign_('total', parts[7] || '');
      assign_('payment', parts[8] || '');
    }
  }

  // Free-text address fallback: pick best location-like line when no explicit "Address:" label exists.
  if (!parsed.address) {
    var addressCandidates = [];
    for (i = 0; i < lines.length; i++) {
      var lnRaw = String(lines[i] || '').trim();
      var ln = lnRaw.toLowerCase();
      if (!lnRaw) continue;
      if (/\b(8801\d{9}|01\d{9})\b/.test(ln.replace(/[^\d]/g, ' '))) continue;
      if (/(মোট|total|amount|qty|quantity|payment|pay|txn|transaction|sender)\s*[:=\-]/i.test(lnRaw)) continue;
      if (/^(name|customer name|নাম)\s*[:=\-]/i.test(lnRaw)) continue;
      if (/^(product|item|design|model|পণ্য|প্রোডাক্ট)\s*[:=\-]/i.test(lnRaw)) continue;
      if (/[,،]/.test(lnRaw) || /(road|rd|house|flat|thana|area|village|para|bazar|upazila|district|উপজেলা|জেলা|থানা|রোড|বাড়ি|এলাকা|বাসা)/i.test(lnRaw)) {
        addressCandidates.push(lnRaw.replace(/[.,\s]+$/, ''));
      }
    }
    if (addressCandidates.length) {
      // Prefer the last location-like line; in WhatsApp users often send location at the end.
      assign_('address', addressCandidates[addressCandidates.length - 1]);
    }
  }

  // If district is empty, infer from address tail (e.g., "kendua, netrokuna").
  if (!parsed.district && parsed.address && /[,،]/.test(parsed.address)) {
    var partsFromAddress = String(parsed.address).split(/[,،]/).map(function (p) {
      return String(p || '').trim();
    }).filter(Boolean);
    if (partsFromAddress.length >= 2) {
      assign_('district', partsFromAddress[partsFromAddress.length - 1]);
    }
  }

  // Try to infer qty/total from design lines if present.
  if (parsed.design) {
    var dLines = String(parsed.design).split(/\n/);
    var qtySum = 0;
    var amountSum = 0;
    var j;
    for (j = 0; j < dLines.length; j++) {
      var ln = dLines[j];
      var q = ln.match(/(?:x|×)\s*(\d+)\s*(?:pcs|pc|পিস)?/i);
      var amt = ln.match(/(?:=|৳)\s*([\d,]+)/);
      if (q) qtySum += parseInt(q[1], 10) || 0;
      if (amt) amountSum += parseFloat(String(amt[1]).replace(/,/g, '')) || 0;
    }
    if ((!parsed.qty || parsed.qty === '1') && qtySum > 0) parsed.qty = String(qtySum);
    if (!parsed.total && amountSum > 0) parsed.total = String(amountSum);
  }

  if (!parsed.payment) parsed.payment = 'Cash On Delivery';
  if (!parsed.qty) parsed.qty = '1';
  if (parsed.phone) parsed.phone = normalizePhone_(parsed.phone);

  var confidenceFields = ['name', 'phone', 'address', 'design', 'qty', 'total'];
  var score = 0;
  var s;
  for (s = 0; s < confidenceFields.length; s++) {
    if (String(parsed[confidenceFields[s]] || '').trim()) score++;
  }
  parsed.confidence = Math.round((score / confidenceFields.length) * 100);

  if (!parsed.notes && extractedCount < 3) {
    parsed.notes = 'Parser confidence low';
  }

  if (parsed.total) {
    var rounded = Math.round(parseFloat(parsed.total) || 0);
    if (rounded > 0) parsed.total = String(rounded);
  }
  if (parsed.qty) {
    var finalQty = parseInt(parsed.qty, 10) || 1;
    parsed.qty = String(finalQty > 0 ? finalQty : 1);
  }

  return parsed;
}

function submitWhatsappMiniOrder(payload) {
  payload = payload || {};
  var name = String(payload.name || '').trim();
  var phone = normalizePhone_(payload.phone);
  var district = String(payload.district || '').trim();
  var address = String(payload.address || '').trim();
  var design = String(payload.design || '').trim();
  var qty = parseInt(String(payload.qty || '1').replace(/[^\d]/g, ''), 10) || 1;
  var total = parseFloat(String(payload.total || '0').replace(/[^\d.]/g, '')) || 0;
  var payment = String(payload.payment || 'Cash On Delivery').trim() || 'Cash On Delivery';
  var txn = String(payload.txn || '').trim();
  var notes = String(payload.notes || '').trim();
  var sendCourierNow = !!payload.sendCourierNow;

  if (!name || name.length < 2) return { ok: false, message: 'নাম দিন (কমপক্ষে ২ অক্ষর)।' };
  if (!/^01\d{9}$/.test(phone)) return { ok: false, message: 'সঠিক ফোন দিন (01XXXXXXXXX)।' };
  if (!address || address.length < 8) return { ok: false, message: 'সম্পূর্ণ ঠিকানা দিন।' };
  if (!design) return { ok: false, message: 'প্রোডাক্ট/ডিজাইন লিখুন।' };
  if (qty < 1) qty = 1;
  if (total < 1) return { ok: false, message: 'মোট টাকার পরিমাণ দিন।' };

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Online Order') || ss.insertSheet('Online Order');
  ensureOnlineOrderHeaders_(sheet);
  ensureOnlineOrderImageHeaders_(sheet);
  setupOrderStatusDropdown_(sheet);

  var now = new Date();
  var timestamp = Utilities.formatDate(now, 'GMT+6', 'dd-MM-yyyy HH:mm:ss');
  var orderId = generateOrderId_();
  var districtChargeMap = getDistrictChargeMap_();
  var charge = qty > 0 && qty < 3 ? (districtChargeMap[district] || 150) : 0;
  var finalNotes = notes ? ('WhatsApp manual | ' + notes) : 'WhatsApp manual';

  var row = appendOnlineOrderRow_(sheet, [
    timestamp,
    name,
    phone,
    qty,
    charge,
    address,
    design,
    String(total),
    orderId,
    'Pending',
    '',
    '',
    '',
    district,
    payment,
    txn,
    finalNotes
  ]);

  formatOnlineOrderProductCell_(sheet, row, design);

  var autoResult = { ok: false, reason: 'SKIPPED' };
  if (sendCourierNow) {
    autoResult = tryAutoCourierForOrder_({
      sheet: sheet,
      row: row,
      orderId: orderId,
      name: name,
      phone: phone,
      address: address,
      design: design,
      slotItems: designTextToSlotItems_(design),
      qty: qty,
      total: total,
      payment: payment
    });
  }

  return {
    ok: true,
    row: row,
    orderId: orderId,
    sentToCourier: !!(autoResult && autoResult.ok),
    tracking: autoResult && autoResult.tracking ? autoResult.tracking : ''
  };
}

function clearOrderProductColumnValidation_(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  var names = ['Online Order', 'Fake'];
  var i;
  for (i = 0; i < names.length; i++) {
    var sh = ss.getSheetByName(names[i]);
    if (!sh) continue;
    var last = Math.max(sh.getLastRow(), 1000);
    try {
      sh.getRange(2, 7, last, 1).clearDataValidations();
    } catch (clearErr) {}
  }
}

function syncProductListDropdown_() {
  var items = fetchProductCatalog_();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('ProductList') || ss.insertSheet('ProductList');
  sh.clear();
  sh.getRange(1, 1, 1, 3).setValues([['Name', 'Price', 'Category']]);
  if (items.length) {
    var rows = items.map(function (p) { return [p.name, p.price, p.category]; });
    sh.getRange(2, 1, items.length, 3).setValues(rows);
  }
  // Column G is a free-text order summary (name + size + qty). A ProductList
  // dropdown on G2:G makes web orders show "Invalid: Input must fall within
  // specified range". Keep ProductList for the picker sidebar only.
  clearOrderProductColumnValidation_(ss);
  SpreadsheetApp.getUi().alert(
    'ProductList updated.\n\n' +
    '• ' + items.length + ' products in ProductList\n' +
    '• Column G validation cleared on Online Order + Fake\n' +
    '  (G is order line-items, not a single product dropdown)\n' +
    '• Sidebar: Muslim Abaya → Product picker sidebar'
  );
}

function getOrderStatusOptions_() {
  return ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Fake'];
}

function setupOrderStatusDropdown_(sheet) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) return false;
  if (onlineOrderHasSizeColumn_(sheet)) sheet.getRange(2, onlineOrderColumn_(sheet, 9), sheet.getMaxRows() - 1, 1).clearDataValidations();
  var options = getOrderStatusOptions_();
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    // Soft validation to avoid disruptive popup while operators are editing quickly.
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, onlineOrderColumn_(sheet, 10), sheet.getMaxRows() - 1, 1).setDataValidation(rule);
  return true;
}

function setupOrderStatusDropdownFromMenu() {
  if (!setupOrderStatusDropdown_()) {
    SpreadsheetApp.getUi().alert('Online Order sheet পাওয়া যায়নি।');
    return;
  }
  SpreadsheetApp.getUi().alert(
    'Status dropdown ready:\n\n' +
    getOrderStatusOptions_().join(' · ') +
    '\n\nConfirmed = Steadfast auto (Confirmed mode)\nShipped = courier পাঠানো হয়েছে'
  );
}

function rateLimitOrder_(phone) {
  var normalized = normalizePhone_(phone);
  var bypassRaw = String(PropertiesService.getScriptProperties().getProperty('ORDER_RATE_LIMIT_BYPASS') || '').trim();
  if (bypassRaw) {
    var bypassParts = bypassRaw.split(/[,;\s]+/);
    var b;
    for (b = 0; b < bypassParts.length; b++) {
      if (normalized && normalizePhone_(bypassParts[b]) === normalized) return;
    }
  }
  var cache = CacheService.getScriptCache();
  var k = 'ord_' + String(normalized || 'x');
  var n = parseInt(cache.get(k) || '0', 10);
  var maxOrders = parseInt(PropertiesService.getScriptProperties().getProperty('ORDER_RATE_LIMIT_MAX') || '6', 10);
  if (n >= maxOrders) throw new Error('ORDER_RATE_LIMIT');
  cache.put(k, String(n + 1), 1800);
}

function checkDuplicateOrder_(phone, total, design) {
  var cache = CacheService.getScriptCache();
  var sig = Utilities.base64EncodeWebSafe(String(phone) + '|' + String(total) + '|' + String(design).slice(0, 48));
  if (cache.get('dup_' + sig)) throw new Error('DUPLICATE_ORDER');
  cache.put('dup_' + sig, '1', 600);
}

/**
 * Returns a one-line risk warning (and writes it to the order's Admin Note)
 * when this phone has earlier Fake/cancelled/returned orders; '' otherwise.
 */
function flagNewOrderRisk_(sheet, row, phone, orderId) {
  if (typeof admHistoryForPhone_ !== 'function' || !row) return '';
  var h = admHistoryForPhone_(admReadHistory_(sheet), normalizePhone_(phone), orderId);
  if (h.risk !== 'high' && h.risk !== 'medium') return '';
  var s = h.stats;
  var line = '⚠ ঝুঁকি ' + (h.risk === 'high' ? 'বেশি' : 'মাঝারি') + ': আগের অর্ডার ' + s.total +
    'টি — ডেলিভারি ' + s.delivered + ', Fake ' + s.fake + ', বাতিল ' + s.cancelled + ', রিটার্ন ' + s.returned +
    (h.successRate === null ? '' : ' (সফলতা ' + h.successRate + '%)');
  var cell = sheet.getRange(row, onlineOrderColumn_(sheet, ADM_COL_ADMIN_NOTE));
  var existing = String(cell.getValue() || '');
  cell.setValue(existing ? line + ' | ' + existing : line);
  return line;
}

function generateOrderId_() {
  var now = new Date();
  var datePart = Utilities.formatDate(now, 'GMT+6', 'yyyyMMdd');
  var rand = Math.floor(Math.random() * 9000) + 1000;
  return 'MA-' + datePart + '-' + rand;
}

function computeCatalogPriceMap_() {
  var map = {};
  try {
    var items = fetchProductCatalog_();
    for (var i = 0; i < items.length; i++) {
      if (items[i] && items[i].id) map[items[i].id] = Number(items[i].price) || 0;
    }
  } catch (catalogErr) {}
  return map;
}

function computeVerifiedOrderPricing_(cartItems, charge, couponCodeVal) {
  var priceMap = computeCatalogPriceMap_();
  var catalogOk = Object.keys(priceMap).length > 0;
  var subtotal = 0;
  var unverifiedIds = [];
  var items = cartItems || [];
  var i;
  for (i = 0; i < items.length; i++) {
    var it = items[i] || {};
    var qty = Math.max(1, parseInt(it.qty, 10) || 1);
    if (catalogOk && Object.prototype.hasOwnProperty.call(priceMap, it.id)) {
      subtotal += priceMap[it.id] * qty;
    } else {
      subtotal += (Number(it.price) || 0) * qty;
      if (it.id) unverifiedIds.push(it.id);
    }
  }
  var couponDiscountVal = 0;
  var couponRowIndex = null;
  if (couponCodeVal) {
    try {
      var couponCheck = validateCouponCode_(couponCodeVal, subtotal);
      if (couponCheck.ok) {
        couponDiscountVal = couponCheck.discount;
        couponRowIndex = couponCheck.rowIndex;
      }
    } catch (couponErr) {}
  }
  return {
    catalogOk: catalogOk,
    subtotal: subtotal,
    unverifiedIds: unverifiedIds,
    couponDiscountVal: couponDiscountVal,
    couponRowIndex: couponRowIndex,
    hasItems: items.length > 0
  };
}

function handleOnlineOrderPost_(e) {
  var validated = validateOrderInput_(e);
  assertLiveStockAvailable_(validated.cartItems);
  if (isPhoneBlocked_(validated.phone)) throw new Error('ORDER_BLOCKED');
  rateLimitOrder_(validated.phone);
  checkDuplicateOrder_(validated.phone, validated.total, validated.design);

  var SHEET_NAME = 'Online Order';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getActiveSheet();

  var now = new Date();
  var timestamp = Utilities.formatDate(now, 'GMT+6', 'dd-MM-yyyy HH:mm:ss');
  var orderId = generateOrderId_();
  var eventID = param_(e, 'EventID') || ('order_' + orderId);

  var districtChargeMap = getDistrictChargeMap_();
  var charge = 0;
  if (validated.qty > 0 && validated.qty < 3) {
    charge = districtChargeMap[validated.district] || 150;
  }

  // ── নিরাপত্তা: সার্ভার নিজে দাম হিসাব করে — ক্লায়েন্টের পাঠানো Total সরাসরি বিশ্বাস করা হয় না ──
  var couponCodeVal = String(param_(e, 'CouponCode') || '').trim().toUpperCase();
  if (validated.cartItems.reduce(function(sum,it){return sum+it.qty;},0) !== validated.qty) throw new Error('INVALID_QTY');
  var pricing = opsVerifiedPricing_(validated.cartItems, charge, couponCodeVal);
  if (Math.abs(pricing.subtotal + charge - pricing.couponDiscountVal - validated.total) > 2) throw new Error('PRICE_CHANGED');
  var couponDiscountVal = pricing.couponDiscountVal;

  var verifiedTotal = validated.total;
  var priceAdjustNote = '';
  if (pricing.catalogOk && pricing.hasItems) {
    var expectedTotal = Math.max(0, pricing.subtotal + charge - couponDiscountVal);
    if (Math.abs(expectedTotal - validated.total) > 2) {
      priceAdjustNote = '⚠️ Total যাচাই করে বদলানো হয়েছে (গ্রাহক ৳' + validated.total + ' → যাচাইকৃত ৳' + expectedTotal + ')';
    }
    verifiedTotal = expectedTotal;
    if (pricing.unverifiedIds.length) {
      priceAdjustNote = (priceAdjustNote ? priceAdjustNote + ' | ' : '') + '⚠️ দাম যাচাই করা যায়নি: ' + pricing.unverifiedIds.join(', ');
    }
  }

  var totalStr = String(verifiedTotal);
  var payment = param_(e, 'PaymentMethod') || 'Cash On Delivery';
  var txn = (param_(e, 'TransactionID') || param_(e, 'SenderNumber') || '').trim();
  var notes = (param_(e, 'SpecialNotes') || '').trim();
  if (priceAdjustNote) notes = notes ? (notes + ' | ' + priceAdjustNote) : priceAdjustNote;
  var district = param_(e, 'District') || validated.district || '';
  var sourceVal = String(param_(e, 'Source') || param_(e, 'UtmSource') || '').trim();

  ensureOnlineOrderHeaders_(sheet);
  ensureOnlineOrderImageHeaders_(sheet);
  ensureOnlineOrderMetaFieldHeaders_(sheet);
  ensureCouponMetaHeaders_(sheet);
  ensureOnlineOrderStockStageHeader_(sheet);
  ensureOnlineOrderSourceHeader_(sheet);
  ensureOnlineOrderTrackingEventIdHeader_(sheet);

  var trackingId = String(eventID || '').trim();
  if (!/^[A-Za-z0-9_.:-]{1,100}$/.test(trackingId)) trackingId = 'order_' + orderId;
  var metaEmailVal = (param_(e, 'Email') || '').trim().toLowerCase();
  var metaFbcVal = (param_(e, 'FBC') || '').trim();
  var metaFbpVal = (param_(e, 'FBP') || '').trim();

  // Hold tracked units before another order can pass the same availability check.
  // Persist the cart and RESERVED stage together so later cancel/delivery can release it.
  var orderLock = LockService.getScriptLock();
  orderLock.waitLock(20000);
  var newRow = 0;
  var reservedVariantCount = 0;
  try {
    reservedVariantCount = reserveStockForOrderItems_(validated.cartItems, orderId, 'order-intake');
    newRow = appendOnlineOrderRowLocked_(sheet, [
      timestamp,
      validated.name,
      validated.phone,
      validated.qty,
      charge,
      validated.address,
      validated.design,
      totalStr,
      orderId,
      'Pending',
      '',
      '',
      '',
      district,
      payment,
      txn,
      notes
    ], formatOnlineOrderSizes_(validated.cartItems, validated.design));

    sheet.getRange(newRow, onlineOrderColumn_(sheet, 30), 1, 3).setValues([[metaEmailVal, metaFbcVal, metaFbpVal]]);
    sheet.getRange(newRow, onlineOrderColumn_(sheet, 33), 1, 6).setValues([[
      JSON.stringify(validated.cartItems || []),
      couponCodeVal,
      couponDiscountVal,
      reservedVariantCount > 0 ? 'RESERVED' : 'NEW',
      sourceVal,
      trackingId
    ]]);
  } catch (orderCreateErr) {
    if (newRow) {
      try { sheet.getRange(newRow, 1, 1, sheet.getLastColumn()).clearContent(); } catch (clearErr) {}
    }
    if (reservedVariantCount > 0) {
      try { releaseStockForOrderItems_(validated.cartItems, orderId, 'order-intake-rollback'); } catch (rollbackErr) {}
    }
    throw orderCreateErr;
  } finally {
    orderLock.releaseLock();
  }

  // নতুন অর্ডারের ঝুঁকি-যাচাই: আগের Fake/বাতিল/রিটার্ন থাকলে Admin Note-এ সতর্কতা।
  var riskLine = '';
  try { riskLine = flagNewOrderRisk_(sheet, newRow, validated.phone, orderId); } catch (riskErr) {}

  try {
    if (typeof sendNewOrderAlertOnce_ === 'function') {
      sendNewOrderAlertOnce_(
        orderId,
        'নতুন online order এসেছে\n' +
        'Order ID: ' + orderId + '\n' +
        'Customer: ' + validated.name + '\n' +
        'Phone: ' + validated.phone + '\n' +
        'Total: ৳' + totalStr + '\n' +
        'Status: Pending' +
        (riskLine ? '\n' + riskLine : '')
      );
    }
  } catch (alertErr) {}

  if (pricing.couponRowIndex != null) {
    try { incrementCouponUsage_(pricing.couponRowIndex); } catch (incErr) {}
  }
  formatOnlineOrderProductCell_(sheet, newRow, validated.design);
  setupOrderStatusDropdown_(sheet);
  var imageUrls = collectOrderImageUrls_(e);
  setOrderProductImages_(sheet, newRow, imageUrls);

  maybeAutoCourierAfterWebOrder_(sheet, newRow, {
    orderId: orderId,
    name: validated.name,
    phone: validated.phone,
    address: validated.address,
    design: validated.design,
    slotItems: validated.slotItems || [],
    qty: validated.qty,
    total: parseFloat(totalStr) || 0,
    payment: payment
  });

  // Purchase event should fire only after manual confirmation (Status=Confirmed),
  // so fake/test submissions do not pollute ads optimization.
  appendAutoCourierNote_(sheet, newRow, 'META_PURCHASE_WAIT: set Status=Confirmed');

  try { markCartConverted_(validated.phone); } catch (mccErr) {}

  return ContentService.createTextOutput('Success|' + orderId).setMimeType(ContentService.MimeType.TEXT);
}

// ── Steadfast Courier (Sheet menu + webhook) ──

function onOpen() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) PropertiesService.getScriptProperties().setProperty('ONLINE_ORDER_SHEET_ID', ss.getId());
  } catch (idErr) {}
  try {
    SpreadsheetApp.getUi()
      .createMenu('Muslim Abaya')
      .addItem('Reality software dashboard', 'openRealitySoftwareDashboard')
      .addItem('Product picker sidebar (column G)', 'openProductPickerSidebar')
      .addItem('WhatsApp order mini form', 'openWhatsappOrderMiniFormSidebar')
      .addItem('WhatsApp — অর্ডার আপডেট পাঠান (সিলেক্টেড রো)', 'openWhatsAppNotifyDialogActiveRow')
      .addItem('ProductList sync (clear G validation)', 'syncProductListDropdown_')
      .addItem('পণ্যের সাইজ H-তে আপডেট করুন', 'syncOnlineOrderSizesNow')
      .addItem('Status dropdown (Pending/Confirmed…)', 'setupOrderStatusDropdownFromMenu')
      .addItem('Reviews — Status ড্রপডাউন সেটআপ (Pending/Approved/Rejected)', 'setupReviewStatusDropdownFromMenu')
      .addItem('Messenger — Get Started বাটন + Greeting সেটআপ (৩ পেজ)', 'setupMessengerProfileForAllPagesFromMenu')
      .addSeparator()
      .addItem('Steadfast — selected row পাঠান', 'steadfastSendActiveRow')
      .addItem('Steadfast — balance দেখুন', 'steadfastShowBalance')
      .addItem('Steadfast — status sync now', 'steadfastSyncCourierStatusesNow')
      .addItem('Steadfast — auto status sync ON (15m)', 'setupSteadfastStatusSyncTrigger')
      .addItem('Steadfast — auto status sync OFF', 'disableSteadfastStatusSyncTrigger')
      .addItem('Safety Backup — run now', 'runSafetyBackupNowFromMenu')
      .addItem('Safety Backup — daily ON', 'setupDailySafetyBackupTrigger')
      .addItem('Safety Backup — daily OFF', 'disableDailySafetyBackupTrigger')
      .addSeparator()
      .addItem('OrderSync — mirror spreadsheet ID সেট করুন', 'setOrderSyncMirrorIdFromMenu')
      .addItem('OrderSync — sync now', 'runOrderSyncNowFromMenu')
      .addItem('OrderSync — live test চালান', 'runOrderSyncLiveTestFromMenu')
      .addItem('OrderSync — auto sync ON (15m)', 'setupOrderSyncTrigger')
      .addItem('OrderSync — new-order automation setup', 'setupOrderSyncNewOrderAutomation')
      .addItem('OrderSync — auto sync OFF', 'disableOrderSyncTrigger')
      .addItem('Operations — daily backup + OrderSync ON', 'setupOperationsTriggersFromMenu')
      .addItem('Automation — 7-day summary এখনই তৈরি করুন', 'generateSevenDayAutomationSummary')
      .addItem('Automation — 7-day summary Email + Telegram-এ পাঠান', 'sendSevenDayAutomationSummaryNow')
      .addItem('Automation — ERROR logs scan + alert', 'scanAndAlertAutomationErrors')
      .addItem('Low Stock — এখনই চেক করুন (ইমেইল)', 'checkLowStockNowFromMenu_')
      .addItem('Coupons শিট খুলুন', 'openCouponsSheetFromMenu_')
      .addItem('Steadfast API URL fix করুন', 'setSteadfastBaseUrlToApi_')
      .addItem('অর্ডার ও ছবি হেডার ঠিক করুন', 'setupOnlineOrderExtraHeaders')
      .addItem('অর্ডার শিটের প্রদর্শন পরিষ্কার করুন', 'setupOnlineOrderDisplayNow')
      .addItem('Selected row — ছবি thumbnail ঠিক করুন', 'repairOnlineOrderImagesActiveRow')
      .addItem('Auto courier — Confirmed হলে পাঠান', 'setupAutoCourierConfirmedMode')
      .addItem('Auto courier — Order হলেই instant', 'setupAutoCourierInstantMode')
      .addItem('Auto courier — status দেখুন', 'showAutoCourierStatus')
      .addItem('Steadfast — selected row retry auto', 'steadfastRetryAutoActiveRow')
      .addSeparator()
      .addItem('Admin password reset', 'resetAdminPasswordFromMenu')
      .addItem('Admin account তৈরি (প্রথমবার)', 'createFirstAdminFromMenu')
      .addToUi();
  } catch (menuErr) {}

  try {
    var orderSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
    if (orderSheet) {
      ensureOnlineOrderHeaders_(orderSheet);
      ensureOnlineOrderImageHeaders_(orderSheet);
      setupOrderStatusDropdown_(orderSheet);
      formatOnlineOrderDisplay_(orderSheet);
    }
  } catch (sheetErr) {}

  try { selfHealSteadfastBaseUrl_(); } catch (baseErr) {}
  try { selfHealAutoCourierSetup_(); } catch (trgErr) {}
  try { selfHealSteadfastStatusSyncTrigger_(); } catch (syncErr) {}
  try { selfHealDailySafetyBackupTrigger_(); } catch (backupErr) {}
  try { selfHealOrderSyncTriggers_(); } catch (orderSyncErr) {}
}

function ensureOnlineOrderMetaFieldHeaders_(sheet) {
  try {
    var existing = sheet.getRange(1, onlineOrderColumn_(sheet, 30), 1, 3).getValues()[0];
    if (!existing[0] && !existing[1] && !existing[2]) {
      sheet.getRange(1, onlineOrderColumn_(sheet, 30), 1, 3).setValues([['Email', 'FBC', 'FBP']]);
    }
    var cartHeader = sheet.getRange(1, onlineOrderColumn_(sheet, 33));
    if (!cartHeader.getValue()) cartHeader.setValue('CartJSON');
    var stockHeader = sheet.getRange(1, onlineOrderColumn_(sheet, 36));
    if (!stockHeader.getValue()) stockHeader.setValue('StockStage');
  } catch (err) {}
}

function getOnlineOrderExtraHeaders_() {
  return [
    'অর্ডার আইডি',
    'স্ট্যাটাস',
    'ট্র্যাকিং',
    'কনসাইনমেন্ট ID',
    'কুরিয়ার স্ট্যাটাস',
    'জেলা',
    'পেমেন্ট',
    'Txn / Sender',
    'নোট'
  ];
}

var ONLINE_ORDER_IMAGE_COL = 18;
var ONLINE_ORDER_IMAGE_COUNT = 12;

function getOnlineOrderImageHeaders_() {
  return [
    'ছবি ১', 'ছবি ২', 'ছবি ৩', 'ছবি ৪', 'ছবি ৫', 'ছবি ৬',
    'ছবি ৭', 'ছবি ৮', 'ছবি ৯', 'ছবি ১০', 'ছবি ১১', 'ছবি ১২'
  ];
}

function collectOrderImageUrls_(e) {
  var urls = [];
  var i;
  for (i = 1; i <= ONLINE_ORDER_IMAGE_COUNT; i++) {
    var v = param_(e, 'Image_' + i);
    if (v && String(v).trim()) urls.push(String(v).trim());
  }
  return urls;
}

function normalizeOrderImageUrl_(url) {
  var u = String(url || '').trim();
  if (!u) return '';
  if (u.indexOf('github.com') !== -1 && u.indexOf('/blob/') !== -1) {
    u = u.replace(/^https:\/\/github\.com\//i, 'https://raw.githubusercontent.com/');
    u = u.replace('/blob/', '/');
    u = u.replace(/\?raw=1$/i, '').replace(/\?raw=true$/i, '');
  }
  return u;
}

function fetchOrderImageBlob_(url) {
  var normalized = normalizeOrderImageUrl_(url);
  var candidates = [];
  if (normalized) candidates.push(normalized);
  if (url && url !== normalized) candidates.push(String(url).trim());
  var j;
  for (j = 0; j < candidates.length; j++) {
    var tryUrl = candidates[j];
    if (!tryUrl || tryUrl.indexOf('http') !== 0) continue;
    try {
      var resp = UrlFetchApp.fetch(tryUrl, {
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: true,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MuslimAbayaOrders/1.0)' }
      });
      if (resp.getResponseCode() !== 200) continue;
      var blob = resp.getBlob();
      if (!blob || !blob.getBytes().length) continue;
      var ct = String(blob.getContentType() || '').toLowerCase();
      if (ct.indexOf('text/html') !== -1) continue;
      return blob;
    } catch (fetchErr) {}
  }
  return null;
}

function setOrderImageCellPreview_(cell, url) {
  var normalized = normalizeOrderImageUrl_(url);
  if (!normalized || normalized.indexOf('http') !== 0) return false;
  var safe = normalized.replace(/"/g, '""');
  cell.setFormula('=IMAGE("' + safe + '", 1)');
  return true;
}

function setOrderProductImages_(sheet, row, urls) {
  if (!sheet || !row || row < 2 || !urls || !urls.length) return;
  var hasAny = false;
  for (var i = 0; i < urls.length && i < ONLINE_ORDER_IMAGE_COUNT; i++) {
    var url = String(urls[i] || '').trim();
    if (!url || url.indexOf('http') !== 0) continue;
    var col = onlineOrderColumn_(sheet, ONLINE_ORDER_IMAGE_COL) + i;
    var cell = sheet.getRange(row, col);
    try {
      cell.clearContent();
      var blob = fetchOrderImageBlob_(url);
      if (blob) {
        var img = sheet.insertImage(blob, col, row);
        img.setWidth(72).setHeight(72);
        hasAny = true;
        continue;
      }
      if (setOrderImageCellPreview_(cell, url)) {
        hasAny = true;
        continue;
      }
      cell.setValue('Photo');
      cell.setNote(url);
    } catch (imgErr) {
      try {
        if (!setOrderImageCellPreview_(cell, url)) {
          cell.setValue('Photo');
          cell.setNote(url);
        } else {
          hasAny = true;
        }
      } catch (cellErr) {}
    }
  }
  if (hasAny) {
    try {
      sheet.setRowHeight(row, 88);
      for (var c = 0; c < ONLINE_ORDER_IMAGE_COUNT; c++) {
        sheet.setColumnWidth(onlineOrderColumn_(sheet, ONLINE_ORDER_IMAGE_COL) + c, 96);
      }
    } catch (heightErr) {}
  }
}

/** Selected row-এর R–W লিংক/নোট থেকে ছবি thumbnail বানায় */
function repairOnlineOrderImagesActiveRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order') ||
    SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = sheet.getActiveRange().getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert('অর্ডার row সিলেক্ট করুন (row 2 বা নিচে)।');
    return;
  }
  var urls = [];
  var i;
  for (i = 0; i < ONLINE_ORDER_IMAGE_COUNT; i++) {
    var cell = sheet.getRange(row, onlineOrderColumn_(sheet, ONLINE_ORDER_IMAGE_COL) + i);
    var note = String(cell.getNote() || '').trim();
    var val = String(cell.getDisplayValue() || cell.getValue() || '').trim();
    if (note.indexOf('http') === 0) urls.push(note);
    else if (val.indexOf('http') === 0) urls.push(val);
    else if (val && val !== 'Photo') urls.push(val);
  }
  if (!urls.length) {
    SpreadsheetApp.getUi().alert('এই অর্ডারের ছবির কলামে কোনো ছবি URL পাওয়া যায়নি।');
    return;
  }
  setOrderProductImages_(sheet, row, urls);
  SpreadsheetApp.getUi().alert('Row ' + row + ': ছবি thumbnail আপডেট হয়েছে।');
}

/** কলাম I–Q (৯–১৭) হেডার — অর্ডার লেখার আগে অটো চালায় */
function ensureOnlineOrderHeaders_(sheet) {
  if (!sheet) return;
  var headers = getOnlineOrderExtraHeaders_();
  var current = sheet.getRange(1, onlineOrderColumn_(sheet, 9), 1, headers.length).getValues()[0];
  var needsUpdate = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(current[i] || '').trim() !== headers[i]) {
      needsUpdate = true;
      break;
    }
  }
  if (!needsUpdate) return;
  var headerRange = sheet.getRange(1, onlineOrderColumn_(sheet, 9), 1, headers.length);
  headerRange.setValues([headers]);
  try {
    headerRange
      .setBackground('#f9a825')
      .setFontColor('#111111')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setWrap(true);
  } catch (fmtErr) {}
}

function ensureOnlineOrderImageHeaders_(sheet) {
  if (!sheet) return;
  var headers = getOnlineOrderImageHeaders_();
  var startCol = onlineOrderColumn_(sheet, ONLINE_ORDER_IMAGE_COL);
  var current = sheet.getRange(1, startCol, 1, headers.length).getValues()[0];
  var needsUpdate = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(current[i] || '').trim() !== headers[i]) {
      needsUpdate = true;
      break;
    }
  }
  if (!needsUpdate) return;
  var headerRange = sheet.getRange(1, startCol, 1, headers.length);
  headerRange.setValues([headers]);
  try {
    headerRange
      .setBackground('#e3f2fd')
      .setFontColor('#111111')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setWrap(true);
    for (var c = 0; c < headers.length; c++) {
      sheet.setColumnWidth(startCol + c, 96);
    }
  } catch (imgHdrErr) {}
}

function setupOnlineOrderExtraHeaders() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order') ||
    SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  ensureOnlineOrderHeaders_(sheet);
  ensureOnlineOrderImageHeaders_(sheet);
  ensureOnlineOrderMetaFieldHeaders_(sheet);
  setupOrderStatusDropdown_(sheet);
  setupOnlineOrderDisplayNow();
  try { SpreadsheetApp.getUi().alert('অর্ডার ও ছবির হেডার সেট হয়েছে। নোট নিজের কলামে থাকবে; অভ্যন্তরীণ ট্র্যাকিং কলাম লুকানো হয়েছে।\n\nStatus dropdown applied.'); } catch (uiErr) { console.log("ORDER_HEADERS_READY"); }
}

function getSteadfastKeys_() {
  var props = PropertiesService.getScriptProperties();
  return {
    apiKey: props.getProperty('STEADFAST_API_KEY') || '',
    secretKey: props.getProperty('STEADFAST_SECRET_KEY') || '',
    baseUrl: props.getProperty('STEADFAST_BASE_URL') || ''
  };
}

function getSteadfastBaseUrls_(preferred) {
  var urls = [];
  // packzy.com = Steadfast API mirror; resolves from Google Apps Script (steadfast.com.bd often DNS-fails)
  var packzyBase = 'https://portal.packzy.com/api/v1';
  var apiBase = 'https://api.steadfast.com.bd/api/v1';
  var portalBase = 'https://portal.steadfast.com.bd/api/v1';
  function pushUnique(u) {
    var x = String(u || '').replace(/\/+$/, '');
    if (!x) return;
    if (urls.indexOf(x) === -1) urls.push(x);
  }
  pushUnique(packzyBase);
  pushUnique(preferred);
  pushUnique(apiBase);
  pushUnique(portalBase);
  return urls;
}

/** Prefer portal.packzy.com — steadfast.com.bd subdomains often fail DNS from Google servers */
function selfHealSteadfastBaseUrl_() {
  var props = PropertiesService.getScriptProperties();
  var cur = String(props.getProperty('STEADFAST_BASE_URL') || '').replace(/\/+$/, '');
  var packzy = 'https://portal.packzy.com/api/v1';
  if (!cur || cur.indexOf('steadfast.com.bd') !== -1) {
    props.setProperty('STEADFAST_BASE_URL', packzy);
    return true;
  }
  return false;
}

function getSteadfastWebhookToken_() {
  return PropertiesService.getScriptProperties().getProperty('STEADFAST_WEBHOOK_TOKEN') || '';
}

function steadfastApiRequest_(method, path, payload) {
  var keys = getSteadfastKeys_();
  if (!keys.apiKey || !keys.secretKey) {
    throw new Error('STEADFAST_KEYS_MISSING');
  }
  var options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      'Api-Key': keys.apiKey,
      'Secret-Key': keys.secretKey,
      'Content-Type': 'application/json'
    }
  };
  if (payload) options.payload = JSON.stringify(payload);

  selfHealSteadfastBaseUrl_();
  keys = getSteadfastKeys_();
  var baseUrls = getSteadfastBaseUrls_(keys.baseUrl);
  var lastErr = null;
  var tried = [];
  var i;
  for (i = 0; i < baseUrls.length; i++) {
    var fullUrl = baseUrls[i] + path;
    tried.push(fullUrl);
    try {
      var res = UrlFetchApp.fetch(fullUrl, options);
      var text = res.getContentText();
      try {
        return JSON.parse(text);
      } catch (err) {
        return { status: res.getResponseCode(), raw: text, baseUrl: baseUrls[i] };
      }
    } catch (fetchErr) {
      lastErr = fetchErr;
    }
  }
  var msg = lastErr && lastErr.message ? lastErr.message : 'STEADFAST_FETCH_FAILED';
  throw new Error(msg + ' (tried: ' + tried.join(', ') + ')');
}

function setSteadfastBaseUrlToApi_() {
  PropertiesService.getScriptProperties().setProperty('STEADFAST_BASE_URL', 'https://portal.packzy.com/api/v1');
  SpreadsheetApp.getUi().alert('STEADFAST_BASE_URL সেট: https://portal.packzy.com/api/v1\n\n(Steadfast-এর official API mirror — Google Script DNS-এ কাজ করে)');
}

function steadfastPlaceOrder_(orderData) {
  return steadfastApiRequest_('post', '/create_order', orderData);
}

function normalizeSteadfastDeliveryStatus_(status) {
  var s = String(status || '').toLowerCase().trim();
  if (!s) return '';
  return s;
}

function sheetOrderStatusFromCourier_(courierStatus, currentStatus) {
  var s = normalizeSteadfastDeliveryStatus_(courierStatus);
  var cur = String(currentStatus || '').trim();
  if (!s) return cur || 'Pending';
  if (s === 'delivered' || s === 'partial_delivered') return 'Delivered';
  if (s === 'cancelled' || s === 'hold' || s === 'holded' || s === 'returned') return 'Cancelled';
  return cur && (cur === 'Delivered' || cur === 'Cancelled') ? cur : 'Shipped';
}

function extractSteadfastDeliveryStatus_(res) {
  if (!res) return '';
  if (typeof res.delivery_status === 'string' && res.delivery_status) return res.delivery_status;
  if (res.consignment && typeof res.consignment.status === 'string') return res.consignment.status;
  if (typeof res.status === 'string' && res.status && !/^\d+$/.test(res.status)) return res.status;
  return '';
}

function steadfastGetStatusByTrackingCode_(trackingCode) {
  var code = String(trackingCode || '').trim();
  if (!code) return null;
  return steadfastApiRequest_('get', '/status_by_trackingcode/' + encodeURIComponent(code), null);
}

function steadfastGetStatusByConsignmentId_(consignmentId) {
  var cid = String(consignmentId || '').trim();
  if (!cid) return null;
  return steadfastApiRequest_('get', '/status_by_cid/' + encodeURIComponent(cid), null);
}

function steadfastGetStatusByInvoice_(invoice) {
  var inv = String(invoice || '').trim();
  if (!inv) return null;
  return steadfastApiRequest_('get', '/status_by_invoice/' + encodeURIComponent(inv), null);
}

function applySteadfastStatusToRow_(sheet, row, payload) {
  if (!sheet || !row || row < 2 || !payload) return false;
  var current = readOnlineOrderRows_(sheet, row, 1, 17)[0];
  var tracking = String(payload.tracking_code || current[10] || '').trim();
  var cid = String(payload.consignment_id || current[11] || '').trim();
  var courierStatus = normalizeSteadfastDeliveryStatus_(payload.status || payload.delivery_status || '');
  if (!courierStatus) return false;
  var prevOrderStatus = String(current[9] || '');
  var orderStatus = sheetOrderStatusFromCourier_(courierStatus, current[9]);
  sheet.getRange(row, onlineOrderColumn_(sheet, 10), 1, 4).setValues([[
    orderStatus,
    tracking,
    cid,
    courierStatus
  ]]);
  if (orderStatus === 'Delivered' && prevOrderStatus !== 'Delivered') {
    try { createReorderOffer_(String(current[8] || ''), String(current[2] || ''), String(current[1] || '')); } catch (roErr) {}
  }
  return true;
}

function syncSteadfastStatusForRow_(sheet, row, vals) {
  var tracking = String(vals[10] || '').trim();
  var cid = String(vals[11] || '').trim();
  var invoice = String(vals[8] || '').trim();
  if (!tracking && !cid && !invoice) return { ok: false, reason: 'NO_IDS' };

  var res = null;
  try {
    if (tracking) res = steadfastGetStatusByTrackingCode_(tracking);
    if (!extractSteadfastDeliveryStatus_(res) && cid) res = steadfastGetStatusByConsignmentId_(cid);
    if (!extractSteadfastDeliveryStatus_(res) && invoice) res = steadfastGetStatusByInvoice_(invoice);
  } catch (err) {
    return { ok: false, reason: String(err && err.message ? err.message : err) };
  }

  var status = extractSteadfastDeliveryStatus_(res);
  if (!status) return { ok: false, reason: 'NO_STATUS' };
  var applied = applySteadfastStatusToRow_(sheet, row, {
    tracking_code: (res && (res.tracking_code || (res.consignment && res.consignment.tracking_code))) || tracking,
    consignment_id: (res && (res.consignment_id || (res.consignment && res.consignment.consignment_id))) || cid,
    delivery_status: status
  });
  return { ok: applied, status: normalizeSteadfastDeliveryStatus_(status) };
}

/**
 * The courier's own final status ends syncing. A hand-set final order status alone does not:
 * those rows keep syncing (if they were sent to the courier) so a stale "pending" gets corrected.
 * Finished orders that never went to the courier are skipped so they don't use API calls.
 */
function steadfastSyncShouldSkip_(orderStatus, courierStatus, r) {
  var c = String(courierStatus || '').toLowerCase().trim();
  if (c === 'delivered' || c === 'cancelled' || c === 'partial_delivered') return true;
  var o = String(orderStatus || '').toLowerCase().trim();
  var orderFinal = o === 'delivered' || o === 'cancelled' || o === 'canceled' || o === 'fake' || o === 'returned';
  var sentToCourier = !!(String(r[10] || '').trim() || String(r[11] || '').trim());
  return orderFinal && !sentToCourier;
}

function syncSteadfastCourierStatusesCore_(opts) {
  opts = opts || {};
  var limit = parseInt(opts.limit, 10) || 40;
  if (limit < 1) limit = 1;
  if (limit > 200) limit = 200;
  var includeFinal = !!opts.includeFinal;

  var ss = getCourierSyncSpreadsheet_();
  if (!ss) return { ok: false, error: 'NO_SPREADSHEET' };
  var sheet = ss.getSheetByName('Online Order');
  if (!sheet) return { ok: false, error: 'NO_SHEET' };
  var data = readOnlineOrderRows_(sheet);
  var scanned = 0;
  var updated = 0;
  var failed = 0;
  var i;
  for (i = data.length - 1; i >= 1; i--) {
    if (scanned >= limit) break;
    var r = data[i];
    var rowNo = i + 1;
    var jStatus = String(r[9] || '').toLowerCase().trim();
    var courierStatus = String(r[12] || '').toLowerCase().trim();
    if (!includeFinal && steadfastSyncShouldSkip_(jStatus, courierStatus, r)) {
      continue;
    }
    if (!String(r[10] || '').trim() && !String(r[11] || '').trim() && !String(r[8] || '').trim()) {
      continue;
    }
    scanned++;
    var sres = syncSteadfastStatusForRow_(sheet, rowNo, r);
    if (sres.ok) updated++;
    else failed++;
    Utilities.sleep(70);
  }
  return { ok: true, scanned: scanned, updated: updated, failed: failed };
}

function steadfastSyncCourierStatusesNow() {
  var result = syncSteadfastCourierStatusesCore_({ limit: 80, includeFinal: false });
  if (!result.ok) {
    SpreadsheetApp.getUi().alert('Courier status sync failed: ' + String(result.error || 'UNKNOWN'));
    return;
  }
  SpreadsheetApp.getUi().alert(
    'Steadfast status sync complete.\n\n' +
    'Scanned: ' + result.scanned + '\n' +
    'Updated: ' + result.updated + '\n' +
    'Failed: ' + result.failed
  );
}

function steadfastStatusSyncTriggerHandler() {
  try {
    syncSteadfastCourierStatusesCore_({ limit: 40, includeFinal: false });
  } catch (err) {}
}

function isSteadfastStatusSyncEnabled_() {
  var raw = PropertiesService.getScriptProperties().getProperty('STEADFAST_STATUS_SYNC_ON');
  if (raw === null || raw === undefined || String(raw).trim() === '') return true; // default ON
  var v = String(raw).toLowerCase().trim();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function hasSteadfastStatusSyncTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'steadfastStatusSyncTriggerHandler') return true;
  }
  return false;
}

function setupSteadfastStatusSyncTriggerInternal_() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'steadfastStatusSyncTriggerHandler') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('steadfastStatusSyncTriggerHandler')
    .timeBased()
    .everyMinutes(15)
    .create();
}

function selfHealSteadfastStatusSyncTrigger_() {
  try {
    if (!isSteadfastStatusSyncEnabled_()) return;
    if (hasSteadfastStatusSyncTrigger_()) return;
    setupSteadfastStatusSyncTriggerInternal_();
  } catch (err) {}
}

function setupSteadfastStatusSyncTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    PropertiesService.getScriptProperties().setProperty('ONLINE_ORDER_SHEET_ID', ss.getId());
  }
  PropertiesService.getScriptProperties().setProperty('STEADFAST_STATUS_SYNC_ON', 'true');
  setupSteadfastStatusSyncTriggerInternal_();
  SpreadsheetApp.getUi().alert('Steadfast auto status sync ON (every 15 minutes).');
}

function disableSteadfastStatusSyncTrigger() {
  PropertiesService.getScriptProperties().setProperty('STEADFAST_STATUS_SYNC_ON', 'false');
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'steadfastStatusSyncTriggerHandler') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  SpreadsheetApp.getUi().alert(
    removed
      ? 'Steadfast auto status sync OFF করা হয়েছে।'
      : 'Steadfast auto status sync trigger আগে থেকেই OFF ছিল।'
  );
}

function getCourierSyncSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) return ss;
  var ssId = PropertiesService.getScriptProperties().getProperty('ONLINE_ORDER_SHEET_ID') || '';
  if (!ssId) return null;
  try {
    return SpreadsheetApp.openById(ssId);
  } catch (err) {
    return null;
  }
}

function isAutoCourierEnabled_() {
  var v = String(PropertiesService.getScriptProperties().getProperty('AUTO_COURIER_ON') || '').toLowerCase();
  if (!v) return true; // default ON for this project
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** Default instant — website order → Steadfast. Menu থেকে confirmed mode চালু করা যায়। */
function getAutoCourierMode_() {
  var raw = PropertiesService.getScriptProperties().getProperty('AUTO_COURIER_MODE');
  if (raw === null || raw === undefined || String(raw).trim() === '') {
    return 'instant';
  }
  return String(raw).toLowerCase().trim();
}

function appendAutoCourierNote_(sheet, row, note) {
  if (!sheet || !row || !note) return;
  try {
    var clean = String(note).replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!clean) return;
    var prev = String(sheet.getRange(row, onlineOrderColumn_(sheet, 17)).getValue() || '');
    if (prev.indexOf(clean) !== -1) return;
    var next = prev ? (prev + ' | ' + clean) : clean;
    if (next.length > 220) next = next.slice(0, 220);
    sheet.getRange(row, onlineOrderColumn_(sheet, 17)).setValue(next);
  } catch (err) {}
}

function tryAutoCourierForOrder_(ctx) {
  try {
    if (!ctx || !ctx.sheet || !ctx.row) return { ok: false, reason: 'CTX_MISSING' };
    if (!isAutoCourierEnabled_()) return { ok: false, reason: 'AUTO_OFF' };

    var keys = getSteadfastKeys_();
    if (!keys.apiKey || !keys.secretKey) {
      var missNote = 'AUTO_COURIER: API Key/Secret missing — Apps Script → Script properties';
      var prevMiss = String(ctx.sheet.getRange(ctx.row, onlineOrderColumn_(ctx.sheet, 17)).getValue() || '');
      ctx.sheet.getRange(ctx.row, onlineOrderColumn_(ctx.sheet, 17)).setValue(prevMiss ? (prevMiss + ' | ' + missNote) : missNote);
      return { ok: false, reason: 'KEYS_MISSING' };
    }

    var payment = String(ctx.payment || 'Cash On Delivery');
    var codAmount = /cash\s*on\s*delivery/i.test(payment) ? (parseFloat(ctx.total) || 0) : 0;
    var payload = {
      invoice: String(ctx.orderId || ('MA-ROW-' + ctx.row)).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40),
      recipient_name: String(ctx.name || '').slice(0, 100),
      recipient_phone: normalizePhone_(ctx.phone),
      recipient_address: String(ctx.address || '').slice(0, 250),
      cod_amount: codAmount,
      note: 'Order ' + String(ctx.orderId || '') + ' · Qty ' + String(ctx.qty || ''),
      item_description: buildCourierItemDescription_(ctx)
    };

    if (!payload.recipient_name || !payload.recipient_phone || !payload.recipient_address) {
      return { ok: false, reason: 'MISSING_FIELDS' };
    }

    var res = steadfastPlaceOrder_(payload);
    var c = res && res.consignment ? res.consignment : null;
    if (!c && res && res.tracking_code) {
      c = {
        tracking_code: res.tracking_code,
        consignment_id: res.consignment_id || res.id || '',
        status: res.status || 'in_review'
      };
    }
    if (!c) {
      var failMsg = String((res && (res.message || res.error || res.raw)) || 'AUTO_FAIL');
      if (typeof res === 'object') {
        try {
          failMsg = JSON.stringify(res).slice(0, 160);
        } catch (jsonErr) {}
      }
      var prevNotes = String(ctx.sheet.getRange(ctx.row, onlineOrderColumn_(ctx.sheet, 17)).getValue() || '');
      var nextNotes = prevNotes ? (prevNotes + ' | ') : '';
      ctx.sheet.getRange(ctx.row, onlineOrderColumn_(ctx.sheet, 17)).setValue(nextNotes + 'AUTO_COURIER_FAIL:' + failMsg.slice(0, 120));
      return { ok: false, reason: 'API_FAIL', raw: res };
    }

    ctx.sheet.getRange(ctx.row, onlineOrderColumn_(ctx.sheet, 10), 1, 4).setValues([[
      'Shipped',
      c.tracking_code || '',
      c.consignment_id || '',
      normalizeSteadfastDeliveryStatus_(c.status || 'in_review')
    ]]);
    return {
      ok: true,
      tracking: c.tracking_code || '',
      consignmentId: c.consignment_id || ''
    };
  } catch (err) {
    try {
      var msg = String(err && err.message ? err.message : err);
      var prev = String(ctx.sheet.getRange(ctx.row, onlineOrderColumn_(ctx.sheet, 17)).getValue() || '');
      ctx.sheet.getRange(ctx.row, onlineOrderColumn_(ctx.sheet, 17)).setValue((prev ? prev + ' | ' : '') + 'AUTO_COURIER_ERR:' + msg.slice(0, 120));
    } catch (innerErr) {}
    return { ok: false, reason: 'EXCEPTION' };
  }
}

function shouldAutoCourierOnConfirmed_() {
  return getAutoCourierMode_() === 'confirmed';
}

function shouldAutoCourierOnNewOrder_() {
  if (!isAutoCourierEnabled_()) return false;
  return getAutoCourierMode_() === 'instant';
}

function maybeAutoCourierAfterWebOrder_(sheet, row, ctx) {
  if (!isAutoCourierEnabled_()) {
    appendAutoCourierNote_(sheet, row, 'AUTO_COURIER_OFF: Muslim Abaya menu → Instant mode');
    return;
  }
  if (!shouldAutoCourierOnNewOrder_()) {
    appendAutoCourierNote_(sheet, row, 'AUTO_COURIER: Confirmed mode — Status=Confirmed করলে Steadfast');
    return;
  }
  // Courier ratio protection: a customer whose earlier orders were often Fake/cancelled/returned is not
  // sent to Steadfast automatically; the order stays Pending (on hold) until a person checks it.
  // Script property RISK_HOLD_LEVEL: 'medium' (default: hold medium + high risk), 'high', or 'off'.
  var holdLevel = String(PropertiesService.getScriptProperties().getProperty('RISK_HOLD_LEVEL') || 'medium').toLowerCase().trim();
  if (holdLevel !== 'off' && ctx && ctx.phone && typeof admHistoryForPhone_ === 'function') {
    try {
      var h = admHistoryForPhone_(admReadHistory_(sheet), normalizePhone_(ctx.phone), ctx.orderId);
      if (h.risk === 'high' || (h.risk === 'medium' && holdLevel !== 'high')) {
        appendAutoCourierNote_(sheet, row, 'AUTO_COURIER_HOLD: ঝুঁকি ' + (h.risk === 'high' ? 'বেশি' : 'মাঝারি') +
          (h.successRate === null ? '' : ' (সফলতা ' + h.successRate + '%)') + ' — যাচাই করে নিজে পাঠান');
        return;
      }
    } catch (holdErr) {}
  }
  tryAutoCourierForOrder_(Object.assign({ sheet: sheet, row: row }, ctx || {}));
}

function getAutoCourierStatusNote_() {
  if (!isAutoCourierEnabled_()) {
    return 'Auto courier OFF — Muslim Abaya menu থেকে Instant mode চালু করুন।';
  }
  var mode = getAutoCourierMode_();
  var keys = getSteadfastKeys_();
  var keyOk = !!(keys.apiKey && keys.secretKey);
  if (mode === 'instant') {
    return keyOk
      ? 'Instant mode ON: website order → Steadfast auto।'
      : 'Instant mode ON কিন্তু STEADFAST_API_KEY/SECRET_KEY Script properties-এ নেই।';
  }
  return keyOk
    ? 'Confirmed mode: Status = Confirmed করলে Steadfast auto।'
    : 'Confirmed mode ON কিন্তু Steadfast API key missing।';
}

function showAutoCourierStatus() {
  var keys = getSteadfastKeys_();
  var keyOk = !!(keys.apiKey && keys.secretKey);
  var mode = getAutoCourierMode_();
  var on = isAutoCourierEnabled_();
  var triggerOk = hasAutoCourierTrigger_();
  SpreadsheetApp.getUi().alert(
    'Auto courier status\n\n' +
    'ON: ' + (on ? 'Yes' : 'No') + '\n' +
    'Mode: ' + mode + '\n' +
    'Steadfast keys: ' + (keyOk ? 'Set ✓' : 'MISSING ✗') + '\n' +
    'Confirmed edit trigger: ' + (triggerOk ? 'Yes' : 'No') + '\n\n' +
    getAutoCourierStatusNote_()
  );
}

function steadfastRetryAutoActiveRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order') ||
    SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = sheet.getActiveCell().getRow();
  if (row <= 1) {
    SpreadsheetApp.getUi().alert('Data row সিলেক্ট করুন (row 2+)');
    return;
  }
  var vals = readOnlineOrderRows_(sheet, row, 1, 17)[0];
  var tracking = String(vals[10] || '').trim();
  if (tracking) {
    SpreadsheetApp.getUi().alert('Tracking already exists: ' + tracking);
    return;
  }
  var res = tryAutoCourierForOrder_({
    sheet: sheet,
    row: row,
    orderId: String(vals[8] || ('MA-ROW-' + row)),
    name: String(vals[1] || ''),
    phone: String(vals[2] || ''),
    address: String(vals[5] || ''),
    design: String(vals[6] || ''),
    slotItems: designTextToSlotItems_(String(vals[6] || '')),
    qty: parseInt(String(vals[3] || '0'), 10) || 0,
    total: parseFloat(String(vals[7] || '0').replace(/[^\d.]/g, '')) || 0,
    payment: String(vals[14] || 'Cash On Delivery')
  });
  if (res && res.ok) {
    SpreadsheetApp.getUi().alert('Steadfast OK!\nTracking: ' + (res.tracking || '—'));
    return;
  }
  var note = String(sheet.getRange(row, onlineOrderColumn_(sheet, 17)).getValue() || '');
  SpreadsheetApp.getUi().alert(
    'Auto courier failed.\n\n' +
    'Reason: ' + String((res && res.reason) || 'UNKNOWN') + '\n' +
    (note ? ('Notes: ' + note.slice(0, 200)) : '') + '\n\n' +
    'Muslim Abaya → Steadfast balance / API URL fix চেক করুন।'
  );
}

function setupAutoCourierEditTriggerInternal_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ssId = ss.getId();
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'autoCourierOnEditTrigger') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('autoCourierOnEditTrigger')
    .forSpreadsheet(ssId)
    .onEdit()
    .create();
}

function setupAutoCourierConfirmedMode() {
  PropertiesService.getScriptProperties().setProperty('AUTO_COURIER_MODE', 'confirmed');
  PropertiesService.getScriptProperties().setProperty('AUTO_COURIER_ON', 'true');
  setupAutoCourierEditTriggerInternal_();
  SpreadsheetApp.getUi().alert(
    'Confirmed mode চালু।\n\n' +
    '① Website order → Status Pending\n' +
    '② ফোনে verify → Status = Confirmed\n' +
    '③ Steadfast-এ auto পাঠাবে (ট্র্যাকিং কলামে নম্বর আসবে)'
  );
}

function setupAutoCourierInstantMode() {
  PropertiesService.getScriptProperties().setProperty('AUTO_COURIER_MODE', 'instant');
  PropertiesService.getScriptProperties().setProperty('AUTO_COURIER_ON', 'true');
  SpreadsheetApp.getUi().alert(
    'Instant mode চালু।\n\n' +
    'Website order Sheet-এ আসার সাথে সাথে Steadfast-এ পাঠানোর চেষ্টা করবে।\n\n' +
    'Script properties-এ STEADFAST_API_KEY + STEADFAST_SECRET_KEY থাকতে হবে।'
  );
}

function setupAutoCourierEditTrigger() {
  setupAutoCourierConfirmedMode();
}

function hasAutoCourierTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'autoCourierOnEditTrigger') return true;
  }
  return false;
}

function selfHealAutoCourierSetup_() {
  try {
    if (!isAutoCourierEnabled_() || !shouldAutoCourierOnConfirmed_()) return;
    if (hasAutoCourierTrigger_()) return;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    ScriptApp.newTrigger('autoCourierOnEditTrigger')
      .forSpreadsheet(ss.getId())
      .onEdit()
      .create();
  } catch (err) {
    // Silent fallback: next open/request will retry.
  }
}

function autoCourierOnEditTrigger(e) {
  try {
    if (!e || !e.range) return;
    var range = e.range;
    var sheet = range.getSheet();
    if (!sheet || sheet.getName() !== 'Online Order') return;
    if (range.getColumn() !== onlineOrderColumn_(sheet, 10)) return; // Resolve the actual Status column (K with size in H).
    if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;
    var newStatus = String(range.getValue() || '').toLowerCase().trim();
    if (newStatus !== 'confirmed') return;

    var row = range.getRow();
    if (row <= 1) return;

    // Send Purchase CAPI only after order is human-verified as Confirmed.
    maybeSendConfirmedPurchaseCapiForRow_(sheet, row);

    if (!isAutoCourierEnabled_() || !shouldAutoCourierOnConfirmed_()) return;

    var vals = readOnlineOrderRows_(sheet, row, 1, 17)[0];
    var tracking = String(vals[10] || '').trim();
    var consignment = String(vals[11] || '').trim();
    if (tracking || consignment) return; // already sent

    var autoRes = tryAutoCourierForOrder_({
      sheet: sheet,
      row: row,
      orderId: String(vals[8] || ('MA-ROW-' + row)),
      name: String(vals[1] || ''),
      phone: String(vals[2] || ''),
      address: String(vals[5] || ''),
      design: String(vals[6] || ''),
      slotItems: designTextToSlotItems_(String(vals[6] || '')),
      qty: parseInt(String(vals[3] || '0'), 10) || 0,
      total: parseFloat(String(vals[7] || '0').replace(/[^\d.]/g, '')) || 0,
      payment: String(vals[14] || 'Cash On Delivery')
    });

    if (!autoRes || !autoRes.ok) {
      var prev = String(sheet.getRange(row, onlineOrderColumn_(sheet, 17)).getValue() || '');
      var note = 'AUTO_CONFIRM_FAIL';
      sheet.getRange(row, onlineOrderColumn_(sheet, 17)).setValue(prev ? (prev + ' | ' + note) : note);
    }
  } catch (err) {
    // Avoid breaking onEdit trigger execution.
  }
}

function ensureOnlineOrderTrackingEventIdHeader_(sheet) {
  var maxCols = sheet.getMaxColumns();
  var lastCol = onlineOrderColumn_(sheet, 38);
  if (maxCols < lastCol) sheet.insertColumnsAfter(maxCols, lastCol - maxCols);
  var cell = sheet.getRange(1, onlineOrderColumn_(sheet, 38));
  var header = String(cell.getValue() || '').trim();
  if (header && header !== 'Tracking Event ID') throw new Error('TRACKING_HEADER_CONFLICT');
  if (!header) cell.setValue('Tracking Event ID');
}

function maybeSendConfirmedPurchaseCapiForRow_(sheet, row) {
  if (!sheet || row <= 1) return { ok: false, code: 'ROW_INVALID' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var vals = readOnlineOrderRows_(sheet, row, 1, 17)[0];
    if (String(vals[9] || '').toLowerCase().trim() !== 'confirmed') return { ok: false, code: 'NOT_CONFIRMED' };
    var notes = String(vals[16] || '');
    if (notes.indexOf('Fake') !== -1) return { ok: false, code: 'SKIP_FAKE_OR_CANCEL' };
    var metaSent = notes.indexOf('META_PURCHASE_SENT') !== -1;
    var tiktokSent = notes.indexOf('TIKTOK_PURCHASE_SENT') !== -1;
    if (metaSent && tiktokSent) return { ok: true, code: 'ALREADY_SENT' };
    var metaVals = sheet.getRange(row, onlineOrderColumn_(sheet, 30), 1, 3).getValues()[0];
    var orderId = String(vals[8] || ('MA-ROW-' + row)).trim();
    var eventID = 'purchase_' + orderId;
    if (sheet.getMaxColumns() >= onlineOrderColumn_(sheet, 38) && String(sheet.getRange(1, onlineOrderColumn_(sheet, 38)).getValue() || '') === 'Tracking Event ID') {
      var storedId = String(sheet.getRange(row, onlineOrderColumn_(sheet, 38)).getValue() || '').trim();
      if (/^[A-Za-z0-9_.:-]{1,100}$/.test(storedId)) eventID = storedId;
    }
    var data = {
      Name: String(vals[1] || ''), Phone: String(vals[2] || ''), Email: String(metaVals[0] || '').trim(),
      FBC: String(metaVals[1] || '').trim(), FBP: String(metaVals[2] || '').trim(),
      Total: String(vals[7] || '0'), Design: String(vals[6] || ''),
      ExternalID: normalizePhone_(String(vals[2] || '')), EventSourceUrl: 'https://muslimabaya.com/checkout'
    };
    var metaCode = metaSent ? 'ALREADY_SENT' : 'UNKNOWN';
    var tiktokCode = tiktokSent ? 'ALREADY_SENT' : 'UNKNOWN';
    if (!metaSent) {
      try {
        var meta = sendToFacebookCAPI(data, eventID);
        metaSent = !!(meta && meta.ok);
        metaCode = (meta && meta.code) || 'UNKNOWN';
        if (metaSent) { appendAutoCourierNote_(sheet, row, 'CAPI_OK'); appendAutoCourierNote_(sheet, row, 'META_PURCHASE_SENT'); }
        else appendAutoCourierNote_(sheet, row, 'CAPI_FAIL:' + metaCode);
      } catch (metaErr) { metaCode = 'EXCEPTION'; appendAutoCourierNote_(sheet, row, 'CAPI_ERR:EXCEPTION'); }
    }
    if (!tiktokSent) {
      try {
        var tt = sendToTikTokCAPI(data, eventID);
        tiktokSent = !!(tt && tt.ok);
        tiktokCode = (tt && tt.code) || 'UNKNOWN';
        appendAutoCourierNote_(sheet, row, tiktokSent ? 'TIKTOK_PURCHASE_SENT' : 'TIKTOK_FAIL:' + tiktokCode);
      } catch (ttErr) { tiktokCode = 'EXCEPTION'; appendAutoCourierNote_(sheet, row, 'TIKTOK_ERR:EXCEPTION'); }
    }
    return { ok: metaSent && tiktokSent, code: metaSent && tiktokSent ? 'SENT' : 'PARTIAL_FAILURE', metaCode: metaCode, tiktokCode: tiktokCode };
  } finally { lock.releaseLock(); }
}

function steadfastSendActiveRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order') ||
    SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = sheet.getActiveCell().getRow();
  if (row < 1) return;
  var vals = readOnlineOrderRows_(sheet, row, 1, 17)[0];
  var name = String(vals[1] || '').trim();
  var phone = normalizePhone_(vals[2]);
  var address = String(vals[5] || '').trim();
  var design = String(vals[6] || '').trim();
  var total = parseFloat(String(vals[7] || '0').replace(/[^\d.]/g, '')) || 0;
  var invoice = String(vals[8] || '').trim() || ('MA-ROW-' + row);
  var tracking = String(vals[10] || '').trim();

  if (!name || !phone || !address) {
    SpreadsheetApp.getUi().alert('নাম, ফোন, ঠিকানা খালি — row ' + row);
    return;
  }
  if (tracking) {
    SpreadsheetApp.getUi().alert('Tracking already exists: ' + tracking);
    return;
  }
  if (address.length > 250) address = address.slice(0, 250);

  var payment = String(vals[14] || 'Cash On Delivery');
  var codAmount = /cash\s*on\s*delivery/i.test(payment) ? total : 0;
  var slotItems = designTextToSlotItems_(design);
  var payload = {
    invoice: invoice.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40),
    recipient_name: name.slice(0, 100),
    recipient_phone: phone,
    recipient_address: address,
    cod_amount: codAmount,
    note: 'Muslim Abaya',
    item_description: buildCourierItemDescription_({
      design: design,
      sizeText: vals.orderSizeText_ || '',
      slotItems: slotItems,
      qty: parseInt(String(vals[3] || '0'), 10) || 0
    })
  };

  var res;
  try {
    res = steadfastPlaceOrder_(payload);
  } catch (apiErr) {
    SpreadsheetApp.getUi().alert(
      'Steadfast সংযোগ ব্যর্থ।\n\n' +
      'সম্ভাব্য কারণ: DNS/নেটওয়ার্ক সমস্যা বা API সার্ভার ডাউন।\n' +
      'Muslim Abaya → "Steadfast API URL fix করুন" চালিয়ে আবার চেষ্টা করুন।\n\n' +
      'Error: ' + String(apiErr && apiErr.message ? apiErr.message : apiErr)
    );
    return;
  }
  if (!res || !res.consignment) {
    SpreadsheetApp.getUi().alert(
      'Steadfast পার্সেল তৈরি হয়নি।\n\n' +
      'Response: ' + JSON.stringify(res).slice(0, 400) + '\n\n' +
      'Tips:\n' +
      '1) API Key/Secret ঠিক আছে কিনা দেখুন\n' +
      '2) "Steadfast API URL fix করুন" চালান\n' +
      '3) ১–২ মিনিট পরে আবার চেষ্টা করুন'
    );
    return;
  }
  var c = res.consignment;
  sheet.getRange(row, onlineOrderColumn_(sheet, 10), 1, 4).setValues([[
    'Shipped',
    c.tracking_code || '',
    c.consignment_id || '',
    normalizeSteadfastDeliveryStatus_(c.status || 'in_review')
  ]]);
  SpreadsheetApp.getUi().alert(
    'Steadfast-এ পার্সেল তৈরি হয়েছে!\n\nTracking: ' + (c.tracking_code || '—') +
      '\nConsignment: ' + (c.consignment_id || '—') +
      '\n\nSteadfast ড্যাশবোর্ডে In Review / Pending তালিকায় দেখুন।'
  );
}

function steadfastShowBalance() {
  try {
    selfHealSteadfastBaseUrl_();
    var res = steadfastApiRequest_('get', '/get_balance', null);
    var bal = res && (res.current_balance != null ? res.current_balance : res.balance);
    if (bal != null) {
      SpreadsheetApp.getUi().alert('Steadfast balance: ৳' + bal);
      return;
    }
    SpreadsheetApp.getUi().alert('Steadfast balance:\n' + JSON.stringify(res));
  } catch (err) {
    SpreadsheetApp.getUi().alert(
      'Steadfast Balance এখন দেখা যাচ্ছে না।\n\n' +
      'সম্ভাব্য কারণ: Steadfast API বন্ধ/নেটওয়ার্ক বা API Key ভুল।\n\n' +
      'যা করবেন:\n' +
      '1) Muslim Abaya → "Steadfast API URL fix করুন" (একবার)\n' +
      '2) URL = portal.packzy.com/api/v1 (Steadfast mirror)\n' +
      '3) Script properties → STEADFAST_API_KEY + STEADFAST_SECRET_KEY\n' +
      '4) ১–২ মিনিট পর আবার "balance দেখুন"\n\n' +
      'Error: ' + String(err && err.message ? err.message : err)
    );
  }
}

function handleSteadfastWebhookPost_(e) {
  var token = (e.parameter && e.parameter.token) || '';
  var expected = getSteadfastWebhookToken_();
  if (!expected || token !== expected) {
    return jsonOut_({ error: 'Unauthorized' });
  }
  var payload = {};
  try {
    payload = JSON.parse(e.postData.contents || '{}');
  } catch (err) {
    return jsonOut_({ error: 'Bad JSON' });
  }
  updateOrderFromSteadfastWebhook_(payload);
  return jsonOut_({ status: 'success' });
}

function updateOrderFromSteadfastWebhook_(payload) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) return;
  var match = findCourierTrackingOrder_(sheet, payload);
  if (!match) return;
  appendCourierTrackingEvent_(match.values, payload, 'webhook');
  var status = payload.status || payload.delivery_status || '';
  if (typeof status !== 'string' || !status) return;
  applySteadfastStatusToRow_(sheet, match.row, {
    tracking_code: payload.tracking_code || match.values[10] || '',
    consignment_id: payload.consignment_id || match.values[11] || '',
    delivery_status: status
  });
}

function getDistrictChargeMap_() {
  return { 'ঢাকা': 80 };
}

function getFacebookCapiConfig_() {
  var props = PropertiesService.getScriptProperties();
  var accessToken =
    props.getProperty('FB_ACCESS_TOKEN') ||
    props.getProperty('META_ACCESS_TOKEN') ||
    props.getProperty('FACEBOOK_ACCESS_TOKEN') ||
    '';
  var pixelId =
    props.getProperty('FB_PIXEL_ID') ||
    props.getProperty('META_PIXEL_ID') ||
    props.getProperty('PIXEL_ID') ||
    '';
  return { accessToken: String(accessToken || '').trim(), pixelId: String(pixelId || '').trim() };
}

/**
 * Ops helper: set Meta CAPI keys via clasp run.
 * Example: clasp run setMetaCapiConfigForOps_ -p '["TOKEN","1465090315322833"]'
 */
function setMetaCapiConfigForOps_(accessToken, pixelId) {
  var token = String(accessToken || '').trim();
  var pixel = String(pixelId || '').trim();
  if (!token || !pixel) {
    return { ok: false, error: 'MISSING_ARGS' };
  }
  var props = PropertiesService.getScriptProperties();
  props.setProperty('FB_ACCESS_TOKEN', token);
  props.setProperty('FB_PIXEL_ID', pixel);
  return {
    ok: true,
    pixelId: pixel,
    tokenMask: token.length > 8 ? (token.slice(0, 4) + '...' + token.slice(-4)) : '****'
  };
}

function getMetaCapiConfigForOps_() {
  var cfg = getFacebookCapiConfig_();
  var token = String(cfg.accessToken || '');
  return {
    ok: !!(cfg.accessToken && cfg.pixelId),
    pixelId: cfg.pixelId || '',
    tokenMask: token ? (token.slice(0, 4) + '...' + token.slice(-4)) : ''
  };
}

function sendToFacebookCAPI(data, eventID, eventName) {
  var cfg = getFacebookCapiConfig_();
  if (!cfg.accessToken || !cfg.pixelId) {
    return { ok: false, code: 'CONFIG_MISSING' };
  }

  var url = 'https://graph.facebook.com/v25.0/' + cfg.pixelId + '/events?access_token=' + cfg.accessToken;
  var cleanPhone = String(data.Phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.indexOf('0') === 0) cleanPhone = '88' + cleanPhone;
  var cleanEmail = String(data.Email || '').trim().toLowerCase();
  var cleanFbc = String(data.FBC || '').trim();
  var cleanFbp = String(data.FBP || '').trim();
  var cleanExternalId = String(data.ExternalID || '').trim().toLowerCase();
  var sourceUrl = String(data.EventSourceUrl || '').trim();
  // Meta blocks CAPI website events without event_source_url for this business category.
  if (!/^https?:\/\//i.test(sourceUrl)) sourceUrl = 'https://muslimabaya.com/checkout';
  var userAgent = String(data.ClientUserAgent || '').trim();
  var testEventCode = String(data.TestEventCode || '').trim();
  var userData = {
    ph: [SHA256_Hash(cleanPhone)],
    fn: [SHA256_Hash(String(data.Name || '').toLowerCase().trim())]
  };
  if (cleanEmail && cleanEmail.indexOf('@') !== -1) {
    userData.em = [SHA256_Hash(cleanEmail)];
  }
  if (cleanFbc) userData.fbc = cleanFbc;
  if (cleanFbp) userData.fbp = cleanFbp;
  if (cleanExternalId) userData.external_id = [SHA256_Hash(cleanExternalId)];
  if (userAgent) userData.client_user_agent = userAgent;

  var payload = {
    data: [{
      event_name: eventName || 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventID,
      action_source: 'website',
      user_data: userData,
      event_source_url: sourceUrl,
      custom_data: {
        currency: 'BDT',
        value: parseOrderValue_(data.Total),
        content_name: data.Design || '',
        content_type: 'product'
      }
    }]
  };
  if (testEventCode) payload.test_event_code = testEventCode;

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = String(res.getContentText() || '');
  var parsed = {};
  try { parsed = JSON.parse(body); } catch (jsonErr) {}
  if (code < 200 || code >= 300 || parsed.error || !(Number(parsed.events_received) > 0)) {
    return {
      ok: false,
      code: 'META_HTTP_' + String(code),
      message: body.slice(0, 200)
    };
  }
  return {
    ok: true,
    code: 'OK',
    eventsReceived: parsed && parsed.events_received != null ? parsed.events_received : ''
  };
}

function getTikTokCapiConfig_() {
  var props = PropertiesService.getScriptProperties();
  var accessToken = props.getProperty('TIKTOK_ACCESS_TOKEN') || '';
  var pixelCode = props.getProperty('TIKTOK_PIXEL_ID') || props.getProperty('TIKTOK_PIXEL_CODE') || 'D6FK9GBC77UC649NNCP0';
  return { accessToken: String(accessToken || '').trim(), pixelCode: String(pixelCode || '').trim() };
}

function sendToTikTokCAPI(data, eventID, eventName) {
  var cfg = getTikTokCapiConfig_();
  if (!cfg.accessToken || !cfg.pixelCode) {
    return { ok: false, code: 'CONFIG_MISSING' };
  }
  var url = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
  var cleanPhone = String(data.Phone || '').replace(/[^0-9]/g, '');
  cleanPhone = normalizePhone_(cleanPhone);
  var e164Phone = /^01\d{9}$/.test(cleanPhone) ? ('+88' + cleanPhone) : '';
  var cleanEmail = String(data.Email || '').trim().toLowerCase();
  var sourceUrl = String(data.EventSourceUrl || '').trim();
  if (!/^https?:\/\//i.test(sourceUrl)) sourceUrl = 'https://muslimabaya.com/checkout';

  var user = {};
  if (e164Phone) user.phone_number = [SHA256_Hash(e164Phone)];
  if (cleanEmail && cleanEmail.indexOf('@') !== -1) user.email = [SHA256_Hash(cleanEmail)];

  var payload = {
    event_source: 'web',
    event_source_id: cfg.pixelCode,
    data: [{
      event: eventName || 'CompletePayment',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventID,
      user: user,
      page: { url: sourceUrl },
      properties: {
        content_type: 'product',
        currency: 'BDT',
        value: parseOrderValue_(data.Total),
        content_name: data.Design || ''
      }
    }]
  };

  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Access-Token': cfg.accessToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  var body = String(res.getContentText() || '');
  var parsed = {};
  try { parsed = JSON.parse(body); } catch (jsonErr) {}
  if (code < 200 || code >= 300 || !Object.prototype.hasOwnProperty.call(parsed, 'code') || Number(parsed.code) !== 0) {
    return { ok: false, code: 'TIKTOK_HTTP_' + String(code), message: body.slice(0, 200) };
  }
  return { ok: true, code: 'OK' };
}

function SHA256_Hash(input) {
  if (!input) return '';
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input);
  var txtHash = '';
  for (var i = 0; i < rawHash.length; i++) {
    var hashVal = rawHash[i];
    if (hashVal < 0) hashVal += 256;
    if (hashVal.toString(16).length === 1) txtHash += '0';
    txtHash += hashVal.toString(16);
  }
  return txtHash;
}

// ── Helpers + Auth ──

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function parseFormBody_(contents) {
  var out = {};
  String(contents || '').split('&').forEach(function (pair) {
    if (!pair) return;
    var idx = pair.indexOf('=');
    var rawKey = idx === -1 ? pair : pair.slice(0, idx);
    var rawVal = idx === -1 ? '' : pair.slice(idx + 1);
    out[decodeURIComponent(rawKey.replace(/\+/g, ' '))] = decodeURIComponent(rawVal.replace(/\+/g, ' '));
  });
  return out;
}

function getParams_(e) {
  var out = {};
  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function (k) {
      out[k] = String(e.parameter[k] || '').trim();
    });
  }
  if (e && e.postData && e.postData.contents) {
    var parsed = parseFormBody_(e.postData.contents);
    Object.keys(parsed).forEach(function (k) {
      if (!out[k]) out[k] = String(parsed[k] || '').trim();
    });
  }
  return out;
}

function param_(e, key) {
  if (!e) return '';
  var params = getParams_(e);
  if (params[key]) return params[key];
  var lower = String(key).toLowerCase();
  var k;
  for (k in params) {
    if (Object.prototype.hasOwnProperty.call(params, k) && String(k).toLowerCase() === lower) {
      return params[k];
    }
  }
  return '';
}

function getAuthSecret_() {
  return PropertiesService.getScriptProperties().getProperty('AUTH_SECRET') || '';
}

function rateLimit_(key) {
  var cache = CacheService.getScriptCache();
  var k = 'rl_' + String(key || 'x').slice(0, 64);
  var n = parseInt(cache.get(k) || '0', 10);
  if (n >= 12) throw new Error('RATE_LIMIT');
  cache.put(k, String(n + 1), 600);
}

function normalizePhone_(value) {
  var digits = String(value || '').replace(/[^\d]/g, '');
  if (digits.indexOf('880') === 0 && digits.length >= 12) digits = '0' + digits.substring(3);
  if (digits.length === 10 && digits.charAt(0) === '1') digits = '0' + digits;
  return digits;
}

function buildWhatsAppMessageForRow_(row) {
  var name = String(row[1] || '').trim();
  var orderId = String(row[8] || '').trim();
  var status = String(row[9] || '').trim();
  var total = String(row[7] || '').trim();
  var tracking = String(row[10] || '').trim();
  var consignment = String(row[11] || '').trim();
  var courierStatus = String(row[12] || '').trim();
  var greeting = name ? ('প্রিয় ' + name + ',') : 'প্রিয় গ্রাহক,';
  var lines = [greeting, ''];
  var st = status.toLowerCase();
  if (st.indexOf('cancel') !== -1) {
    lines.push('দুঃখিত, আপনার অর্ডারটি (ID: ' + orderId + ') বাতিল করা হয়েছে।');
    lines.push('কোনো প্রশ্ন থাকলে রিপ্লাই করুন।');
  } else if (st.indexOf('deliver') !== -1) {
    lines.push('আপনার অর্ডার (ID: ' + orderId + ') সফলভাবে ডেলিভারি সম্পন্ন হয়েছে। আমাদের সাথে থাকার জন্য ধন্যবাদ — Muslim Abaya।');
  } else if (consignment || courierStatus || tracking) {
    lines.push('আপনার অর্ডার (ID: ' + orderId + ') কুরিয়ারে পাঠানো হয়েছে।');
    if (tracking) lines.push('ট্র্যাকিং: ' + tracking);
    lines.push('মোট মূল্য: ৳' + total + ' (ক্যাশ অন ডেলিভারি)');
  } else if (st.indexOf('confirm') !== -1) {
    lines.push('আপনার অর্ডারটি (ID: ' + orderId + ') কনফার্ম করা হয়েছে। শীঘ্রই কুরিয়ারে পাঠানো হবে।');
    lines.push('মোট মূল্য: ৳' + total);
  } else {
    lines.push('আপনার অর্ডার (ID: ' + orderId + ') পেয়েছি, প্রসেস করা হচ্ছে।');
    lines.push('মোট মূল্য: ৳' + total);
  }
  lines.push('');
  lines.push('ধন্যবাদান্তে, Muslim Abaya');
  return lines.join('\n');
}

function openWhatsAppNotifyDialogActiveRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  if (sheet.getName() !== 'Online Order') {
    SpreadsheetApp.getUi().alert('এই ফিচারটা শুধু "Online Order" শিটে কাজ করে। ওই শিটের একটা রো সিলেক্ট করে আবার চেষ্টা করুন।');
    return;
  }
  var row = sheet.getActiveRange().getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert('একটা অর্ডার রো সিলেক্ট করুন (হেডার রো নয়)।');
    return;
  }
  var values = readOnlineOrderRows_(sheet, row, 1, 17)[0];
  var phoneLocal = normalizePhone_(values[2]);
  if (!phoneLocal || phoneLocal.length < 10) {
    SpreadsheetApp.getUi().alert('এই রো-তে সঃকল ফোন নম্বর পাওয়া যায়নি।');
    return;
  }
  var intl = '880' + phoneLocal.replace(/^0/, '');
  var message = buildWhatsAppMessageForRow_(values);
  var waUrl = 'https://wa.me/' + intl + '?text=' + encodeURIComponent(message);
  var html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;padding:16px;text-align:center;">' +
    '<p style="white-space:pre-wrap;text-align:left;background:#f5f5f5;padding:10px;border-radius:8px;font-size:13px;">' +
    message.replace(/</g,'&lt;') +
    '</p>' +
    '<a href="' + waUrl + '" target="_blank" style="display:inline-block;background:#25D366;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:bold;">WhatsApp-এ পাঠান</a>' +
    '</div>'
  ).setWidth(380).setHeight(320);
  SpreadsheetApp.getUi().showModalDialog(html, 'WhatsApp মেসেজ পাঠান');
}

function normalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function hashPassword_(password, salt) {
  salt = salt || Utilities.getUuid();
  var pepper = getAuthSecret_();
  var raw = salt + '|' + pepper + '|' + password;
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return {
    hash: digest.map(function (b) {
      var v = b < 0 ? b + 256 : b;
      return (v < 16 ? '0' : '') + v.toString(16);
    }).join(''),
    salt: salt
  };
}

function verifyPassword_(password, salt, expectedHash) {
  if (!password || !salt || !expectedHash) return false;
  return hashPassword_(password, salt).hash === expectedHash;
}

function ensureSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

/**
 * Last row of the Online Order sheet that holds an actual order, judged by the
 * customer name (B) or phone (C) cells. Returns 1 when there are no orders.
 */
function lastOnlineOrderDataRow_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 1;
  var cells = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
  for (var i = cells.length - 1; i >= 0; i--) {
    if (String(cells[i][0] || '').trim() || String(cells[i][1] || '').trim()) return i + 2;
  }
  return 1;
}

function appendRow_(sheet, values) {
  writeRowAt_(sheet, sheet.getLastRow() + 1, values);
}

function writeRowAt_(sheet, row, values) {
  for (var c = 0; c < values.length; c++) {
    var cell = sheet.getRange(row, c + 1);
    if (typeof values[c] === 'string' && /^0\d{10,}$/.test(values[c])) cell.setNumberFormat('@');
    cell.setValue(values[c]);
  }
}

function getCustomersSheet_() {
  return ensureSheet_('Customers', ['Email', 'Phone', 'Name', 'PasswordHash', 'Salt', 'Status', 'CreatedAt', 'UpdatedAt']);
}

function getSessionsSheet_() {
  var sheet = ensureSheet_('Sessions', ['Token', 'Email', 'Phone', 'Name', 'CreatedAt', 'ExpiresAt', 'Role']);
  if (!sheet.getRange(1, 7).getValue()) sheet.getRange(1, 7).setValue('Role');
  return sheet;
}

function getAdminsSheet_() {
  var sheet = ensureSheet_('Admins', ['Email', 'Phone', 'Name', 'PasswordHash', 'Salt', 'Status', 'CreatedAt', 'Role', 'UpdatedAt']);
  if (!sheet.getRange(1, 8).getValue()) sheet.getRange(1, 8).setValue('Role');
  if (!sheet.getRange(1, 9).getValue()) sheet.getRange(1, 9).setValue('UpdatedAt');
  return sheet;
}

function getAdminNotifyEmails_() {
  try {
    var data = getAdminsSheet_().getDataRange().getValues();
    var emails = [];
    for (var i = 1; i < data.length; i++) {
      var role = String(data[i][7] || 'admin').toLowerCase();
      var status = String(data[i][5] || '').toLowerCase();
      var email = String(data[i][0] || '').trim();
      if (role === 'admin' && status !== 'blocked' && email) emails.push(email);
    }
    if (!emails.length) {
      var fallback = Session.getEffectiveUser().getEmail();
      if (fallback) emails.push(fallback);
    }
    return emails;
  } catch (err) {
    return [];
  }
}

function findCustomerByEmail_(email) {
  var data = getCustomersSheet_().getDataRange().getValues();
  var target = normalizeEmail_(email);
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][0]) === target) {
      return { email: data[i][0], phone: data[i][1], name: data[i][2], hash: data[i][3], salt: data[i][4], status: data[i][5] };
    }
  }
  return null;
}

function findCustomerByPhone_(phone) {
  var data = getCustomersSheet_().getDataRange().getValues();
  var target = normalizePhone_(phone);
  for (var i = 1; i < data.length; i++) {
    if (normalizePhone_(data[i][1]) === target) {
      return { email: data[i][0], phone: data[i][1], name: data[i][2], hash: data[i][3], salt: data[i][4], status: data[i][5] };
    }
  }
  return null;
}

function createSession_(user, role) {
  role = role || 'customer';
  var token = Utilities.getUuid() + Utilities.getUuid();
  var expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (role === 'customer') expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  appendRow_(getSessionsSheet_(), [token, user.email, user.phone, user.name, new Date(), expires, role]);
  var out = {
    ok: true,
    token: token,
    email: user.email,
    phone: user.phone,
    name: user.name,
    expires: expires.getTime(),
    role: role
  };
  if (role === 'admin') {
    try {
      out.sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
      out.scriptUrl = 'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/edit';
    } catch (err) {}
  }
  return out;
}

function registerUser_(e) {
  if (!getAuthSecret_()) {
    return { ok: false, error: 'AUTH_NOT_CONFIGURED', message: 'Apps Script এ AUTH_SECRET সেট করুন।' };
  }
  var name = param_(e, 'Name');
  var phone = normalizePhone_(param_(e, 'Phone'));
  var email = normalizeEmail_(param_(e, 'Email'));
  var password = param_(e, 'Password');
  if (!name || !phone || !email || !password) return { ok: false, error: 'MISSING_FIELDS', message: 'সব তথ্য পূরণ করুন।' };
  if (password.length < 8) return { ok: false, error: 'WEAK_PASSWORD', message: 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষর।' };
  if (findCustomerByEmail_(email)) return { ok: false, error: 'EMAIL_EXISTS', message: 'এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে।' };
  if (findCustomerByPhone_(phone)) return { ok: false, error: 'PHONE_EXISTS', message: 'এই মোবাইলে ইতিমধ্যে অ্যাকাউন্ট আছে।' };
  var hashed = hashPassword_(password);
  appendRow_(getCustomersSheet_(), [email, phone, name, hashed.hash, hashed.salt, 'active', new Date(), new Date()]);
  return createSession_({ email: email, phone: phone, name: name }, 'customer');
}

function loginUser_(e) {
  if (!getAuthSecret_()) {
    return { ok: false, error: 'AUTH_NOT_CONFIGURED', message: 'Apps Script এ AUTH_SECRET সেট করুন।' };
  }
  var email = normalizeEmail_(param_(e, 'Email'));
  var phone = normalizePhone_(param_(e, 'Phone'));
  var login = param_(e, 'Login');
  if (!email && login.indexOf('@') !== -1) email = normalizeEmail_(login);
  if (!phone && login && login.indexOf('@') === -1) phone = normalizePhone_(login);
  var password = param_(e, 'Password');
  if ((!email && !phone) || !password) return { ok: false, error: 'MISSING_FIELDS', message: 'ইমেইল/মোবাইল ও পাসওয়ার্ড দিন।' };
  var user = email ? findCustomerByEmail_(email) : findCustomerByPhone_(phone);
  if (!user) return { ok: false, error: 'NOT_FOUND', message: 'অ্যাকাউন্ট পাওয়া যায়নি। Sign Up করুন।' };
  if (user.status === 'blocked') return { ok: false, error: 'BLOCKED', message: 'অ্যাকাউন্ট বন্ধ।' };
  if (!verifyPassword_(password, user.salt, user.hash)) return { ok: false, error: 'INVALID_PASSWORD', message: 'পাসওয়ার্ড ভুল।' };
  return createSession_({ email: user.email, phone: user.phone, name: user.name }, 'customer');
}

function findAdminByEmail_(email) {
  var data = getAdminsSheet_().getDataRange().getValues();
  var target = normalizeEmail_(email);
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][0]) === target) {
      return {
        row: i + 1,
        email: data[i][0],
        phone: data[i][1],
        name: data[i][2],
        hash: data[i][3],
        salt: data[i][4],
        status: data[i][5],
        role: String(data[i][7] || 'admin').toLowerCase()
      };
    }
  }
  return null;
}

function findAdminByPhone_(phone) {
  var data = getAdminsSheet_().getDataRange().getValues();
  var target = normalizePhone_(phone);
  for (var i = 1; i < data.length; i++) {
    if (normalizePhone_(data[i][1]) === target) {
      return {
        row: i + 1,
        email: data[i][0],
        phone: data[i][1],
        name: data[i][2],
        hash: data[i][3],
        salt: data[i][4],
        status: data[i][5],
        role: String(data[i][7] || 'admin').toLowerCase()
      };
    }
  }
  return null;
}

function loginAdmin_(e) {
  if (!getAuthSecret_()) {
    return { ok: false, error: 'AUTH_NOT_CONFIGURED', message: 'Apps Script এ AUTH_SECRET সেট করুন।' };
  }
  if (getAdminsSheet_().getLastRow() < 2) {
    return {
      ok: false,
      error: 'NO_ADMIN',
      message: 'অ্যাডমিন অ্যাকাউন্ট নেই। Sheet → Muslim Abaya → Admin account তৈরি (প্রথমবার)।'
    };
  }
  var email = normalizeEmail_(param_(e, 'Email'));
  var phone = normalizePhone_(param_(e, 'Phone'));
  var login = param_(e, 'Login');
  if (!email && login.indexOf('@') !== -1) email = normalizeEmail_(login);
  if (!phone && login && login.indexOf('@') === -1) phone = normalizePhone_(login);
  var password = param_(e, 'Password');
  if ((!email && !phone) || !password) {
    return { ok: false, error: 'MISSING_FIELDS', message: 'ইমেইল/মোবাইল ও পাসওয়ার্ড দিন।' };
  }
  rateLimit_('admin_' + (email || phone));
  var user = email ? findAdminByEmail_(email) : findAdminByPhone_(phone);
  if (!user) return { ok: false, error: 'NOT_FOUND', message: 'অ্যাডমিন অ্যাকাউন্ট পাওয়া যায়নি।' };
  if (String(user.status || '').trim().toLowerCase() === 'blocked') return { ok: false, error: 'BLOCKED', message: 'অ্যাকাউন্ট বন্ধ।' };
  if (!verifyPassword_(password, user.salt, user.hash)) {
    return { ok: false, error: 'INVALID_PASSWORD', message: 'পাসওয়ার্ড ভুল।' };
  }
  var role = String(user.role || 'admin').trim().toLowerCase() === 'staff' ? 'staff' : 'admin';
  return createSession_({ email: user.email, phone: user.phone, name: user.name }, role);
}

function verifySession_(token) {
  if (!token) return { ok: false, error: 'NO_TOKEN' };
  var data = getSessionsSheet_().getDataRange().getValues();
  var now = Date.now();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) !== token) continue;
    var expMs = data[i][5] instanceof Date ? data[i][5].getTime() : new Date(data[i][5]).getTime();
    if (expMs && now > expMs) return { ok: false, error: 'EXPIRED' };
    var role = data[i][6] ? String(data[i][6]) : 'customer';
    return {
      ok: true,
      token: token,
      email: data[i][1],
      phone: data[i][2],
      name: data[i][3],
      expires: expMs,
      role: role
    };
  }
  return { ok: false, error: 'INVALID_TOKEN' };
}

/**
 * Admin check with a 60-second cache. Every panel request used to read the whole Sessions and
 * Admins sheets; a successful result is now reused briefly. The key is a hash of the token plus a
 * generation number that staff changes bump, so blocking/removing staff applies immediately.
 * Expiry is re-checked on every hit. Failures are never cached.
 */
var ADMIN_AUTH_CACHE_SECONDS_ = 60;
function adminAuthCacheKey_(token) {
  var gen = PropertiesService.getScriptProperties().getProperty('ADMIN_AUTH_GEN') || '0';
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token));
  var hex = digest.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 32);
  return 'adm_auth_' + gen + '_' + hex;
}
function bumpAdminAuthGeneration_() {
  try { PropertiesService.getScriptProperties().setProperty('ADMIN_AUTH_GEN', String(Date.now())); } catch (err) {}
}
function verifyAdminSession_(token) {
  if (!token) return verifyAdminSessionUncached_(token);
  var cache = null, key = '';
  try { cache = CacheService.getScriptCache(); key = adminAuthCacheKey_(token); } catch (cacheErr) { cache = null; }
  if (cache) {
    try {
      var hit = cache.get(key);
      if (hit) {
        var cachedV = JSON.parse(hit);
        if (cachedV && cachedV.ok && (!cachedV.expires || Date.now() < cachedV.expires)) return cachedV;
      }
    } catch (readErr) {}
  }
  var v = verifyAdminSessionUncached_(token);
  if (cache && v && v.ok) {
    try { cache.put(key, JSON.stringify(v), ADMIN_AUTH_CACHE_SECONDS_); } catch (putErr) {}
  }
  return v;
}

function verifyAdminSessionUncached_(token) {
  var v = verifySession_(token);
  if (!v.ok) return v;
  if (v.role !== 'admin' && v.role !== 'staff') return { ok: false, error: 'NOT_ADMIN', message: 'অ্যাডমিন লগইন প্রয়োজন।' };
  var current = v.email ? findAdminByEmail_(v.email) : null;
  if (!current && v.phone) current = findAdminByPhone_(v.phone);
  if (!current) return { ok: false, error: 'NOT_ADMIN', message: 'অ্যাডমিন অ্যাকাউন্ট আর সক্রিয় নেই।' };
  if (String(current.status || '').trim().toLowerCase() === 'blocked') {
    return { ok: false, error: 'BLOCKED', message: 'অ্যাডমিন অ্যাকাউন্ট বন্ধ।' };
  }
  var currentRole = String(current.role || 'admin').trim().toLowerCase() === 'staff' ? 'staff' : 'admin';
  if (currentRole !== v.role) return { ok: false, error: 'NOT_ADMIN', message: 'অ্যাডমিন ভূমিকা পরিবর্তিত হয়েছে—আবার লগ ইন করুন।' };
  v.email = current.email;
  v.phone = current.phone;
  v.name = current.name;
  v.isOwner = (v.role === 'admin');
  try {
    if (v.isOwner) {
      v.sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
      v.scriptUrl = 'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/edit';
    }
  } catch (err) {}
  return v;
}

function requireOwnerAdmin_(v) {
  if (requireAdminPermission_(v, 'admin.owner_actions')) {
    return { ok: false, error: 'OWNER_ONLY', message: 'শুধুমাত্র মূল অ্যাডমিন এই কাজটি করতে পারবেন।' };
  }
  return null;
}

function listAdminOrders_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var limit = parseInt(param_(e, 'Limit'), 10) || 80;
  if (limit < 1) limit = 1;
  if (limit > 200) limit = 200;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) return { ok: false, error: 'NO_SHEET', message: 'Online Order শীট পাওয়া যায়নি।' };
  var data = readOnlineOrderRows_(sheet);
  var orders = [];
  var i;
  for (i = data.length - 1; i >= 1 && orders.length < limit; i--) {
    var r = data[i];
    if (!r[1] && !r[2]) continue;
    orders.push({
      time: formatCell_(r[0]),
      name: String(r[1] || ''),
      phone: String(r[2] || ''),
      qty: r[3],
      charge: r[4],
      address: String(r[5] || ''),
      design: String(r[6] || ''),
      size: String(r.orderSizeText_ || ''),
      total: String(r[7] || ''),
      orderId: String(r[8] || ''),
      status: String(r[9] || 'Pending'),
      tracking: String(r[10] || ''),
      consignmentId: String(r[11] || ''),
      courierStatus: String(r[12] || ''),
      district: String(r[13] || ''),
      payment: String(r[14] || ''),
      txn: String(r[15] || ''),
      notes: String(r[16] || '')
    });
  }
  return {
    ok: true,
    orders: orders,
    count: orders.length,
    sheetUrl: v.sheetUrl,
    scriptUrl: v.scriptUrl
  };
}

function getAdminTodayStats_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) return { ok: false, error: 'NO_SHEET', message: 'Online Order শীট পাওয়া যায়নি।' };

  var data = readOnlineOrderRows_(sheet);
  var todayKey = Utilities.formatDate(new Date(), 'GMT+6', 'yyyy-MM-dd');
  var todayCount = 0;
  var courierCount = 0;
  var i;
  for (i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[1] && !r[2]) continue;
    var rowDay = dayKeyFromCell_(r[0]);
    if (rowDay !== todayKey) continue;
    todayCount++;
    if (String(r[10] || '').trim() || String(r[11] || '').trim()) courierCount++;
  }
  return {
    ok: true,
    todayCount: todayCount,
    courierCount: courierCount,
    autoCourier: isAutoCourierEnabled_(),
    autoCourierMode: getAutoCourierMode_(),
    note: getAutoCourierStatusNote_()
  };
}

// ===== Stock / Inventory tracking =====
function ensureStockSheet_() {
  return ensureSheet_('Stock', ['Product ID', 'Product Name', 'Qty', 'Updated At']);
}

function sendDailySummaryEmail_() {
  var result = { email: false, telegram: false };
  try {
    var emails = getAdminNotifyEmails_();
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
    if (!sheet) return;
    var data = readOnlineOrderRows_(sheet);
    var yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    var yKey = Utilities.formatDate(yesterday, 'GMT+6', 'yyyy-MM-dd');
    var orders = 0, revenue = 0, pending = 0, delivered = 0;
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      var dk = dayKeyFromCell_(r[0]);
      if (dk !== yKey) continue;
      orders++;
      revenue += parseSignedOrderAmount_(r[7]);
      var status = String(r[9] || '').toLowerCase();
      if (!status || status.indexOf('pending') !== -1) pending++;
      if (status.indexOf('deliver') !== -1) delivered++;
    }
    var body = 'গতকালের (' + yKey + ') সেলস সামারি:\n\n' +
      '📦 মোট অর্ডার: ' + orders + '\n' +
      '💰 মোট বিক্রি: ৳' + revenue.toLocaleString('en-US') + '\n' +
      '⏳ Pending অর্ডার: ' + pending + '\n' +
      '✅ Delivered অর্ডার: ' + delivered + '\n\n' +
      'বিস্তারিত দেখতে Admin Dashboard এ যান।';
    var stuck = [];
    try { stuck = findStuckOrders_(data, Date.now()); } catch (stuckErr) {}
    if (stuck.length) {
      body += '\n\n⚠ নজর দেওয়া দরকার (' + stuck.length + 'টি):\n' + stuck.slice(0, 15).map(function (s) {
        return '• ' + s.orderId + ' (৳' + s.total + ') — ' + s.why;
      }).join('\n') + (stuck.length > 15 ? '\n…আরও ' + (stuck.length - 15) + 'টি' : '') +
      '\n\nঅর্ডার প্যানেলে Order ID দিয়ে খুঁজুন।';
    }
    result.stuck = stuck.length;
    var subject = '📊 গতকালের সেলস সামারি — ' + yKey;
    if (emails.length) {
      try { MailApp.sendEmail({ to: emails.join(','), subject: subject, body: body }); result.email = true; }
      catch (mailErr) { result.emailError = String(mailErr && mailErr.message || mailErr); }
    }
    if (typeof sendTelegramText_ === 'function') {
      var tg = sendTelegramText_(subject + '\n\n' + body);
      result.telegram = tg.ok;
      if (tg.error) result.telegramError = tg.error;
    }
  } catch (err) { result.error = String(err && err.message || err); }
  console.log('DAILY_SUMMARY ' + JSON.stringify(result));
  return result;
}

/**
 * Orders that look forgotten (last 90 days only, so very old legacy rows don't repeat every day):
 *  - Pending/Confirmed for 3+ days and never sent to the courier
 *  - sent to the courier 10+ days ago and the courier still has no final status
 */
var STUCK_WINDOW_DAYS_ = 90, STUCK_UNSENT_DAYS_ = 3, STUCK_COURIER_DAYS_ = 10;
function findStuckOrders_(data, nowMs) {
  var today = Utilities.formatDate(new Date(nowMs), 'GMT+6', 'yyyy-MM-dd');
  function daysSince(key) { return Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(key + 'T00:00:00Z')) / 86400000); }
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i], id = String(r[8] || '').trim();
    var key = dayKeyFromCell_(r[0]);
    if (!id || !key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
    var age = daysSince(key);
    if (age < 0 || age > STUCK_WINDOW_DAYS_) continue;
    var st = String(r[9] || 'Pending').toLowerCase().trim();
    var courier = String(r[12] || '').toLowerCase().trim();
    var sent = !!(String(r[10] || '').trim() || String(r[11] || '').trim());
    var total = parseSignedOrderAmount_(r[7]);
    if ((st === 'pending' || st === 'confirmed') && !sent && age >= STUCK_UNSENT_DAYS_) {
      out.push({ orderId: id, total: total, age: age, why: age + ' দিন ধরে ' + (st === 'pending' ? 'Pending' : 'Confirmed') + ', কুরিয়ারে পাঠানো হয়নি' });
    } else if (sent && age >= STUCK_COURIER_DAYS_ && !/^(delivered|partial_delivered|cancelled)$/.test(courier) && st !== 'cancelled' && st !== 'fake') {
      out.push({ orderId: id, total: total, age: age, why: age + ' দিন আগে কুরিয়ারে গেছে, Steadfast স্ট্যাটাস এখনো "' + (courier || 'নেই') + '"' });
    }
  }
  return out.sort(function (a, b) { return b.age - a.age; });
}

function installDailySummaryTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendDailySummaryEmail_') ScriptApp.deleteTrigger(triggers[i]);
  }
  ScriptApp.newTrigger('sendDailySummaryEmail_').timeBased().atHour(8).everyDays(1).inTimezone('Asia/Dhaka').create();
}

function listAdminStaff_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var data = getAdminsSheet_().getDataRange().getValues();
  var items = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[1]) continue;
    var role = String(r[7] || 'admin').toLowerCase();
    if (role !== 'staff') continue;
    items.push({ email: String(r[0] || ''), phone: String(r[1] || ''), name: String(r[2] || ''), status: String(r[5] || 'active') });
  }
  return { ok: true, items: items };
}

function saveAdminStaff_(e) {
  if (typeof bumpAdminAuthGeneration_ === 'function') bumpAdminAuthGeneration_();
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var email = normalizeEmail_(param_(e, 'Email'));
  var phone = normalizePhone_(param_(e, 'Phone'));
  var name = String(param_(e, 'Name') || '').trim();
  var password = String(param_(e, 'Password') || '');
  if (!email && !phone) return { ok: false, error: 'MISSING_LOGIN', message: 'ইমেইল বা ফোন দিন।' };
  if (!name) return { ok: false, error: 'MISSING_NAME', message: 'স্টাফের নাম দিন।' };
  if (!password || password.length < 6) return { ok: false, error: 'WEAK_PASSWORD', message: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' };
  var sheet = getAdminsSheet_();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, error: 'BUSY', message: 'স্টাফ তালিকা ব্যস্ত—আবার চেষ্টা করুন।' };
  try {
    var data = sheet.getDataRange().getValues();
    var emailRow = 0, phoneRow = 0;
    for (var i = 1; i < data.length; i++) {
      var rowEmail = normalizeEmail_(data[i][0]);
      var rowPhone = normalizePhone_(data[i][1]);
      if (email && rowEmail === email) emailRow = i + 1;
      if (phone && rowPhone === phone) phoneRow = i + 1;
    }
    if (emailRow && phoneRow && emailRow !== phoneRow) {
      return { ok: false, error: 'IDENTIFIER_CONFLICT', message: 'ইমেইল ও ফোন আলাদা অ্যাকাউন্টে ব্যবহৃত—তথ্য যাচাই করুন।' };
    }
    var existingRow = emailRow || phoneRow;
    if (existingRow) {
      var role = String(data[existingRow - 1][7] || 'admin').trim().toLowerCase();
      if (role !== 'staff') {
        return { ok: false, error: 'ACCOUNT_CONFLICT', message: 'এই ইমেইল/ফোন ইতিমধ্যে অ্যাডমিন অ্যাকাউন্টে ব্যবহৃত।' };
      }
    }
    var hp = hashPassword_(password);
    var now = new Date();
    if (existingRow) {
      if (email) sheet.getRange(existingRow, 1).setValue(email);
      if (phone) sheet.getRange(existingRow, 2).setValue(phone);
      sheet.getRange(existingRow, 3).setValue(name);
      sheet.getRange(existingRow, 4).setValue(hp.hash);
      sheet.getRange(existingRow, 5).setValue(hp.salt);
      sheet.getRange(existingRow, 6).setValue('active');
      sheet.getRange(existingRow, 8).setValue('staff');
      sheet.getRange(existingRow, 9).setValue(now);
    } else {
      appendRow_(sheet, [email || '', phone || '', name, hp.hash, hp.salt, 'active', now, 'staff', now]);
    }
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function deleteAdminStaff_(e) {
  if (typeof bumpAdminAuthGeneration_ === 'function') bumpAdminAuthGeneration_();
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var email = normalizeEmail_(param_(e, 'Email'));
  var phone = normalizePhone_(param_(e, 'Phone'));
  var existing = email ? findAdminByEmail_(email) : findAdminByPhone_(phone);
  if (!existing) return { ok: false, error: 'NOT_FOUND' };
  if (String(existing.role || '').toLowerCase() !== 'staff') return { ok: false, error: 'NOT_STAFF', message: 'শুধু স্টাফ অ্যাকাউন্ট মোছা যাবে।' };
  getAdminsSheet_().getRange(existing.row, 6).setValue('blocked');
  return { ok: true };
}

function getAdminStock_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var sheet = ensureStockSheet_();
  var data = sheet.getDataRange().getValues();
  var items = [];
  var i;
  for (i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0]) continue;
    items.push({
      productId: String(r[0]),
      productName: String(r[1] || ''),
      qty: Number(r[2]) || 0,
      updatedAt: formatCell_(r[3])
    });
  }
  return { ok: true, items: items, count: items.length };
}

function findStockRow_(sheet, productId) {
  var data = sheet.getDataRange().getValues();
  var i;
  for (i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(productId).trim()) return i + 1;
  }
  return -1;
}

function setAdminStock_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var productId = String(param_(e, 'ProductId') || '').trim();
  if (!productId) return { ok: false, error: 'MISSING_ID', message: 'Product ID প্রয়োজন।' };
  var productName = String(param_(e, 'ProductName') || '').trim();
  var qty = parseInt(param_(e, 'Qty'), 10);
  if (isNaN(qty) || qty < 0) return { ok: false, error: 'INVALID_QTY', message: 'সঠিক Qty দিন।' };
  var sheet = ensureStockSheet_();
  var row = findStockRow_(sheet, productId);
  var now = new Date();
  var oldQty = 0;
  if (row === -1) {
    appendRow_(sheet, [productId, productName, qty, now]);
  } else {
    oldQty = Number(sheet.getRange(row, 3).getValue()) || 0;
    sheet.getRange(row, 3).setValue(qty);
    sheet.getRange(row, 4).setValue(now);
    if (productName) sheet.getRange(row, 2).setValue(productName);
  }
  if (oldQty <= 0 && qty > 0) {
    try { notifyBackInStockWaitlist_(productId); } catch (nErr) {}
  }
  if (qty > 0 && qty <= 5 && oldQty > 5) {
    try {
      var lowStockEmails = getAdminNotifyEmails_();
      if (lowStockEmails.length) {
        MailApp.sendEmail({
          to: lowStockEmails.join(','),
          subject: '⚠️ কম স্টক সতর্কতা: ' + (productName || productId),
          body: (productName || productId) + ' (' + productId + ') এর স্টক মাত্র ' + qty + ' পিস বাকি আছে। এখনই পুনরায় স্টক করার কথা ভাবুন।\n\nAdmin Panel: স্টক ও অ্যানালিটিক্স পেজ থেকে আপডেট করুন।'
        });
      }
    } catch (mErr) {}
  }
  return { ok: true, productId: productId, qty: qty };
}

function decrementStockForOrder_(cartItems) {
  if (!cartItems || !cartItems.length) return;
  try {
    var sheet = ensureStockSheet_();
    var data = sheet.getDataRange().getValues();
    var idxMap = {};
    var i;
    for (i = 1; i < data.length; i++) {
      var id = String(data[i][0]).trim();
      if (id) idxMap[id] = i + 1;
    }
    cartItems.forEach(function (item) {
      var id = String((item && item.id) || '').trim();
      if (!id) return;
      var qty = parseInt(item.qty, 10) || 0;
      if (qty <= 0) return;
      var row = idxMap[id];
      if (!row) return;
      var current = Number(sheet.getRange(row, 3).getValue()) || 0;
      var next = Math.max(0, current - qty);
      sheet.getRange(row, 3).setValue(next);
      sheet.getRange(row, 4).setValue(new Date());
    });
  } catch (stockErr) {
    // stock tracking must never break order placement
  }
}

// ===== Analytics =====
function getAdminAnalytics_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var days = parseInt(param_(e, 'Days'), 10) || 30;
  if (days < 1) days = 1;
  if (days > 365) days = 365;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) return { ok: false, error: 'NO_SHEET', message: 'Online Order শীট পাওয়া যায়নি।' };
  var data = readOnlineOrderRows_(sheet);

  var cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  var cutoffKey = Utilities.formatDate(cutoffDate, 'GMT+6', 'yyyy-MM-dd');

  var prevCutoffDate = new Date();
  prevCutoffDate.setDate(prevCutoffDate.getDate() - days * 2);
  var prevCutoffKey = Utilities.formatDate(prevCutoffDate, 'GMT+6', 'yyyy-MM-dd');

  // প্রথমে পুরো শীট স্ক্যান করে প্রতিটি ফোন নাম্বারের প্রথম অর্ডারের তারিখ বের করা (new vs returning নির্ণয়ের জন্য)
  var firstOrderDate = {};
  var i;
  for (i = 1; i < data.length; i++) {
    var rr = data[i];
    var phoneKey = String(rr[2] || '').trim();
    if (!phoneKey) continue;
    var dk = dayKeyFromCell_(rr[0]);
    if (!dk) continue;
    if (!firstOrderDate[phoneKey] || dk < firstOrderDate[phoneKey]) firstOrderDate[phoneKey] = dk;
  }

  function summarize(fromKey, toKeyExclusive) {
    var byDay = {};
    var byProduct = {};
    var courierStatusBreakdown = {};
    var totalRevenue = 0;
    var totalOrders = 0;
    var courierOrders = 0;
    var newCustomers = 0;
    var returningCustomers = 0;
    var j;
    for (j = 1; j < data.length; j++) {
      var r = data[j];
      if (!r[1] && !r[2]) continue;
      var dayKey = dayKeyFromCell_(r[0]);
      if (!dayKey || dayKey < fromKey || (toKeyExclusive && dayKey >= toKeyExclusive)) continue;

      var total = parseSignedOrderAmount_(r[7]);
      totalOrders++;
      totalRevenue += total;
      if (String(r[10] || '').trim() || String(r[11] || '').trim()) courierOrders++;

      var cStatus = String(r[12] || '').trim() || 'অজানা';
      courierStatusBreakdown[cStatus] = (courierStatusBreakdown[cStatus] || 0) + 1;

      var phoneKey2 = String(r[2] || '').trim();
      if (phoneKey2 && firstOrderDate[phoneKey2] === dayKey) newCustomers++;
      else if (phoneKey2) returningCustomers++;

      if (!byDay[dayKey]) byDay[dayKey] = { date: dayKey, revenue: 0, orders: 0 };
      byDay[dayKey].revenue += total;
      byDay[dayKey].orders++;

      var cartJsonCell = String(r[32] || '').trim();
      var items = [];
      if (cartJsonCell) {
        try { items = JSON.parse(cartJsonCell); } catch (pe) { items = []; }
      }
      if (items && items.length) {
        items.forEach(function (it) {
          var key = it.id || it.name;
          if (!key) return;
          if (!byProduct[key]) byProduct[key] = { id: it.id || '', name: it.name || key, qty: 0, revenue: 0 };
          byProduct[key].qty += parseInt(it.qty, 10) || 0;
          byProduct[key].revenue += (parseFloat(it.price) || 0) * (parseInt(it.qty, 10) || 0);
        });
      } else {
        var design = String(r[6] || '');
        design.split(/\n/).forEach(function (line) {
          var nameOnly = stripOrderLineToProductName_(line);
          if (!nameOnly) return;
          if (!byProduct[nameOnly]) byProduct[nameOnly] = { id: '', name: nameOnly, qty: 0, revenue: 0, approx: true };
          byProduct[nameOnly].qty += 1;
        });
      }
    }
    return {
      totalOrders: totalOrders,
      totalRevenue: totalRevenue,
      courierOrders: courierOrders,
      newCustomers: newCustomers,
      returningCustomers: returningCustomers,
      courierStatusBreakdown: courierStatusBreakdown,
      byDay: byDay,
      byProduct: byProduct
    };
  }

  var current = summarize(cutoffKey, null);
  var previous = summarize(prevCutoffKey, cutoffKey);

  var dayList = Object.keys(current.byDay).map(function (k) { return current.byDay[k]; }).sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  var allProductsSorted = Object.keys(current.byProduct).map(function (k) { return current.byProduct[k]; }).sort(function (a, b) { return b.qty - a.qty; });
  var productList = allProductsSorted.slice(0, 20);
  var bottomProductList = allProductsSorted.filter(function (p) { return p.qty > 0; }).slice(-10).reverse();

  return {
    ok: true,
    rangeDays: days,
    totalOrders: current.totalOrders,
    totalRevenue: current.totalRevenue,
    avgOrderValue: current.totalOrders ? Math.round((current.totalRevenue / current.totalOrders) * 100) / 100 : 0,
    courierOrders: current.courierOrders,
    newCustomers: current.newCustomers,
    returningCustomers: current.returningCustomers,
    courierStatusBreakdown: current.courierStatusBreakdown,
    previousPeriod: {
      totalOrders: previous.totalOrders,
      totalRevenue: previous.totalRevenue,
      avgOrderValue: previous.totalOrders ? Math.round((previous.totalRevenue / previous.totalOrders) * 100) / 100 : 0
    },
    byDay: dayList,
    topProducts: productList,
    slowProducts: bottomProductList
  };
}

// ===== পাবলিক Stock Status (কাস্টমারদের সাইটে এর জন্য, Token লাগে না) =====
function getPublicStockStatus_() {
  try {
    var items = {};
    try {
      var legacySheet = ensureStockSheet_();
      var legacyData = legacySheet.getDataRange().getValues();
      var li;
      for (li = 1; li < legacyData.length; li++) {
        var lr = legacyData[li];
        var lid = String(lr[0] || '').trim();
        if (!lid) continue;
        var lqty = Number(lr[2]) || 0;
        items[lid] = { qty: lqty, inStock: lqty > 0, legacyTracked: true };
      }
    } catch (legacyErr) {}
    try {
      var vSheet = ensureStockVariantsSheet_();
      var vData = vSheet.getDataRange().getValues();
      var byProduct = {};
      var i;
      for (i = 1; i < vData.length; i++) {
        var r = vData[i];
        var pid = String(r[0] || '').trim();
        if (!pid) continue;
        var tracked = (String(r[4]).toUpperCase() === 'TRUE') || (r[4] === true);
        var variant = String(r[3] || '').trim();
        var available = Number(r[5]) || 0;
        var reserved = Number(r[6]) || 0;
        var threshold = (r[7] === '' || r[7] === null || typeof r[7] === 'undefined') ? null : Number(r[7]);
        if (!byProduct[pid]) byProduct[pid] = { totalAvailable: 0, anyTracked: false, variants: {} };
        if (tracked) {
          byProduct[pid].totalAvailable += Math.max(0, available);
          byProduct[pid].anyTracked = true;
        }
        byProduct[pid].variants[variant || '_default'] = {
          tracked: tracked, available: available, reserved: reserved, threshold: threshold
        };
      }
      Object.keys(byProduct).forEach(function (pid) {
        var p = byProduct[pid];
        if (!items[pid]) items[pid] = { qty: 0, inStock: true };
        if (p.anyTracked) {
          items[pid].qty = p.totalAvailable;
          items[pid].inStock = p.totalAvailable > 0;
        }
        items[pid].variants = p.variants;
      });
    } catch (vErr) {}
    // Explicit admin stock switches take precedence over static catalog flags.
    var liveOverrides = liveStockOverrides_();
    Object.keys(liveOverrides).forEach(function(id) {
      if (!items[id]) items[id] = {};
      items[id].manualOverride = true;
      items[id].inStock = liveOverrides[id];
      items[id].qty = liveOverrides[id] ? Math.max(1, Number(items[id].qty) || 0) : 0;
    });
    return { ok: true, items: items };
  } catch (err) {
    return { ok: false, error: 'STOCK_STATUS_FAILED', message: String(err.message || err) };
  }
}


function getOrderTrackStatus_(e) {
  try {
    var phoneRaw = param_(e, 'Phone');
    var orderId = String(param_(e, 'OrderId') || '').trim();
    var phone = normalizePhone_(phoneRaw);
    if (!phone || phone.length < 10) {
      return { ok: false, error: 'INVALID_PHONE', message: 'সঠিক মোবাইল নম্বর দিন (01XXXXXXXXXX)।' };
    }
    try {
      rateLimit_('track_' + phone);
    } catch (rl) {
      return { ok: false, error: 'RATE_LIMIT', message: 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' };
    }
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
    if (!sheet) return { ok: true, orders: [] };
    var data = readOnlineOrderRows_(sheet);
    var orders = [];
    for (var i = data.length - 1; i >= 1; i--) {
      var r = data[i];
      var rowPhone = normalizePhone_(r[2]);
      if (rowPhone !== phone) continue;
      var rowOrderId = String(r[8] || '').trim();
      if (orderId && rowOrderId.toLowerCase() !== orderId.toLowerCase()) continue;
      orders.push({
        orderId: rowOrderId,
        date: r[0] ? new Date(r[0]).toISOString() : '',
        product: String(r[6] || ''),
        size: String(r.orderSizeText_ || ''),
        qty: r[3] || '',
        total: r[7] || '',
        status: String(r[9] || 'Pending'),
        tracking: String(r[10] || ''),
        courierStatus: String(r[12] || ''),
        district: String(r[13] || '')
      });
      if (orders.length >= 15) break;
    }
    return { ok: true, orders: orders };
  } catch (err) {
    return { ok: false, error: 'ORDER_TRACK_FAILED', message: String(err.message || err) };
  }
}

function getCouponsSheet_() {
  return ensureSheet_('Coupons', ['Code', 'Type', 'Value', 'MinOrder', 'ExpiryDate', 'UsageLimit', 'UsedCount', 'Active']);
}

function ensureCouponMetaHeaders_(sheet) {
  try {
    var existing = sheet.getRange(1, onlineOrderColumn_(sheet, 34), 1, 2).getValues()[0];
    if (!existing[0] && !existing[1]) {
      sheet.getRange(1, onlineOrderColumn_(sheet, 34), 1, 2).setValues([['CouponCode', 'CouponDiscount']]);
    }
  } catch (err) {}
}

function validateCouponCode_(code, subtotal) {
  code = String(code || '').trim().toUpperCase();
  subtotal = Number(subtotal) || 0;
  if (!code) return { ok: false, error: 'EMPTY', message: 'কুপন কোড দিন।' };
  try {
    var sheet = getCouponsSheet_();
    var data = sheet.getDataRange().getValues();
    var i;
    for (i = 1; i < data.length; i++) {
      var r = data[i];
      var rowCode = String(r[0] || '').trim().toUpperCase();
      if (rowCode !== code) continue;
      var type = String(r[1] || 'percent').trim().toLowerCase();
      var value = Number(r[2]) || 0;
      var minOrder = Number(r[3]) || 0;
      var expiry = r[4];
      var usageLimit = Number(r[5]) || 0;
      var usedCount = Number(r[6]) || 0;
      var active = r[7];
      if (active === false || String(active).trim().toUpperCase() === 'FALSE') {
        return { ok: false, error: 'INACTIVE', message: 'এই কুপনটি বর্তমানে সক্রিয় নেই।' };
      }
      if (expiry) {
        var expDate = new Date(expiry);
        if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
          return { ok: false, error: 'EXPIRED', message: 'এই কুপনের মেয়াদ শেষ হয়ে গেছে।' };
        }
      }
      if (usageLimit > 0 && usedCount >= usageLimit) {
        return { ok: false, error: 'LIMIT_REACHED', message: 'এই কুপনের ব্যবহারসীমা শেষ হয়ে গেছে।' };
      }
      if (minOrder > 0 && subtotal < minOrder) {
        return { ok: false, error: 'MIN_ORDER', message: 'এই কুপনের জন্য সর্বনিম্ন অর্ডার \u09F3' + minOrder + ' হতে হবে।' };
      }
      var discount = 0;
      if (type === 'percent') {
        discount = Math.round(subtotal * (value / 100));
      } else {
        discount = Math.round(value);
      }
      if (discount > subtotal) discount = subtotal;
      if (discount < 0) discount = 0;
      return { ok: true, discount: discount, type: type, value: value, rowIndex: i + 1, message: 'কুপন প্রযোজ্য হয়েছে!' };
    }
    return { ok: false, error: 'NOT_FOUND', message: 'এই কুপন কোডটি সঠিক নয়।' };
  } catch (err) {
    return { ok: false, error: 'COUPON_CHECK_FAILED', message: String(err.message || err) };
  }
}

function incrementCouponUsage_(rowIndex) {
  try {
    var sheet = getCouponsSheet_();
    var cell = sheet.getRange(rowIndex, 7);
    var cur = Number(cell.getValue()) || 0;
    cell.setValue(cur + 1);
  } catch (err) {}
}

function getReviewsSheet_() {
  return ensureSheet_('Reviews', ['ReviewID', 'ProductID', 'ProductName', 'Name', 'Rating', 'Comment', 'Date', 'Status']);
}

function submitReview_(e) {
  try {
    var productId = String(param_(e, 'ProductID') || '').trim();
    var productName = String(param_(e, 'ProductName') || '').trim();
    var name = String(param_(e, 'Name') || '').trim();
    var rating = parseInt(param_(e, 'Rating'), 10);
    var comment = String(param_(e, 'Comment') || '').trim();

    if (!productId) return { ok: false, error: 'NO_PRODUCT', message: 'প্রোডাক্ট শনাক্ত করা যায়নি।' };
    if (!name) return { ok: false, error: 'NO_NAME', message: 'আপনার নাম দিন।' };
    if (name.length > 60) name = name.slice(0, 60);
    if (!rating || rating < 1 || rating > 5) return { ok: false, error: 'BAD_RATING', message: 'রেটিং ১ থেকে ৫ এর মধ্যে দিন।' };
    if (comment.length > 600) comment = comment.slice(0, 600);

    try { rateLimit_('review_' + name.slice(0, 40) + '_' + productId.slice(0, 40)); }
    catch (rlErr) { return { ok: false, error: 'RATE_LIMIT', message: 'একটু পর আবার চেষ্টা করুন।' }; }

    var reviewLock = LockService.getScriptLock();
    reviewLock.waitLock(15000);
    try {
      var verified = opsReviewVerification_(e, productId);
      var sheet = getReviewsSheet_();
      opsReviewHeaders_(sheet);
      var reviewId = Utilities.getUuid();
      appendRow_(sheet, [reviewId, productId, productName, admCellText_(name,60), rating, admCellText_(comment,600), new Date(), 'Pending', verified.verified, verified.orderId]);
    } finally { reviewLock.releaseLock(); }
    return { ok: true, message: 'ধন্যবাদ! আপনার রিভিউ পর্যালোচনার পর প্রকাশিত হবে।' };
  } catch (err) {
    return { ok: false, error: 'REVIEW_SUBMIT_FAILED', message: String(err.message || err) };
  }
}

function getProductReviews_(e) {
  try {
    var productId = String(param_(e, 'ProductID') || '').trim();
    if (!productId) return { ok: false, error: 'NO_PRODUCT', reviews: [], average: 0, count: 0 };
    var sheet = getReviewsSheet_();
    var data = sheet.getDataRange().getValues();
    var reviews = [];
    var sum = 0;
    var i;
    for (i = 1; i < data.length; i++) {
      var r = data[i];
      if (String(r[1] || '').trim() !== productId) continue;
      if (String(r[7] || '').trim() !== 'Approved') continue;
      var rating = Number(r[4]) || 0;
      sum += rating;
      reviews.push({
        name: String(r[3] || ''),
        rating: rating,
        comment: String(r[5] || ''),
        verifiedPurchase: r[8] === true,
        date: r[6] instanceof Date ? Utilities.formatDate(r[6], 'GMT+6', 'dd MMM yyyy') : String(r[6] || '')
      });
    }
    reviews.reverse();
    var count = reviews.length;
    var average = count ? Math.round((sum / count) * 10) / 10 : 0;
    return { ok: true, reviews: reviews.slice(0, 50), average: average, count: count };
  } catch (err) {
    return { ok: false, error: 'REVIEWS_FETCH_FAILED', message: String(err.message || err), reviews: [], average: 0, count: 0 };
  }
}

function setupReviewStatusDropdown_(sheet) {
  sheet = sheet || SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Reviews');
  if (!sheet) return false;
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Pending', 'Approved', 'Rejected'], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange('H2:H2000').setDataValidation(rule);
  return true;
}

function setupReviewStatusDropdownFromMenu() {
  getReviewsSheet_();
  if (!setupReviewStatusDropdown_()) {
    SpreadsheetApp.getUi().alert('Reviews sheet পাওয়া যায়নি।');
    return;
  }
  SpreadsheetApp.getUi().alert(
    'Reviews sheet + Column H (Status) dropdown ready:\n\n' +
    'Pending · Approved · Rejected\n\n' +
    'শুধু Approved রিভিউ ওয়েবসাইটে দেখাবে। নতুন রিভিউ Status=Pending থাকে — Approved করলেই লাইভ হবে।'
  );
}

function openCouponsSheetFromMenu_() {
  var sheet = getCouponsSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    appendRow_(sheet, ['WELCOME10', 'percent', 10, 500, '', 100, 0, true]);
  }
  SpreadsheetApp.setActiveSpreadsheet(SpreadsheetApp.getActiveSpreadsheet());
  sheet.activate();
}

// ===== অর্ডার বাতিল/রিটার্ন হলে স্টক স্বয়ংক্রিয়ভাবে ফিরিয়ে দেওয়া (Google Sheet এর নিজস্ব সিমপ্ল ট্রিগার) =====
var CANCEL_STATUS_KEYWORDS_ = ['cancel', 'বাতিল', 'return', 'ফেরত', 'refund'];

function isCancelledStatus_(statusText) {
  var s = String(statusText || '').trim().toLowerCase();
  if (!s) return false;
  var i;
  for (i = 0; i < CANCEL_STATUS_KEYWORDS_.length; i++) {
    if (s.indexOf(CANCEL_STATUS_KEYWORDS_[i]) !== -1) return true;
  }
  return false;
}

function restoreStockForOrder_(cartItems) {
  if (!cartItems || !cartItems.length) return;
  try {
    var sheet = ensureStockSheet_();
    var data = sheet.getDataRange().getValues();
    var idxMap = {};
    var i;
    for (i = 1; i < data.length; i++) {
      var id = String(data[i][0]).trim();
      if (id) idxMap[id] = i + 1;
    }
    cartItems.forEach(function (item) {
      var id = String((item && item.id) || '').trim();
      if (!id) return;
      var qty = parseInt(item.qty, 10) || 0;
      if (qty <= 0) return;
      var row = idxMap[id];
      if (!row) return;
      var current = Number(sheet.getRange(row, 3).getValue()) || 0;
      sheet.getRange(row, 3).setValue(current + qty);
      sheet.getRange(row, 4).setValue(new Date());
    });
  } catch (restoreErr) {
    // stock restore এরর কখনোই শীট এডিট ব্লক করবে না
  }
}

/**
 * Google Sheet এ কেউ সরাসরি একটা সেল এডিট করলেই এটা অটোম্যাটিক চলে (simple trigger) —
 * Online Order-এর Status (H size থাকলে K) এ 'Cancelled'/'বাতিল'/'Return' লেখা হলে
 * সেই অর্ডারের CartJSON (H size থাকলে AH) থেকে Stock শীটে পরিমাণ ফিরিয়ে যোগ করা হয়।
 */
function onEdit(e) {
  if (typeof boostAutoDateOnEdit === "function") boostAutoDateOnEdit(e);
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    if (sheet.getName() !== 'Online Order') return;
    if (e.range.getColumn() !== onlineOrderColumn_(sheet, 10)) return;
    var row = e.range.getRow();
    if (row < 2) return;
    var newStatus = String(e.value || '').trim();
    var statusCell = sheet.getRange(row, onlineOrderColumn_(sheet, 10));
    try {
      applyStockLifecycleForStatusChange_(sheet, row, newStatus);
      statusCell.clearNote();
    } catch (stockErr) {
      var previousStatus = (typeof e.oldValue === 'undefined' || e.oldValue === '') ? 'Pending' : e.oldValue;
      statusCell.setValue(previousStatus);
      statusCell.setNote('স্টক যাচাই/আপডেট ব্যর্থ হয়েছে; স্ট্যাটাস আগের অবস্থায় ফেরানো হয়েছে। ' + String(stockErr.message || stockErr));
    }
  } catch (onEditErr) {
    // অপ্রত্যাশিত trigger error শীট এডিট ব্লক করবে না
  }
}

function dayKeyFromCell_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'GMT+6', 'yyyy-MM-dd');
  }
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (m) {
    var dd = ('0' + m[1]).slice(-2);
    var mm = ('0' + m[2]).slice(-2);
    return m[3] + '-' + mm + '-' + dd;
  }
  var dt = new Date(s);
  if (!isNaN(dt.getTime())) return Utilities.formatDate(dt, 'GMT+6', 'yyyy-MM-dd');
  return '';
}

function formatCell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'GMT+6', 'dd-MM-yyyy HH:mm');
  return String(v || '');
}

function createFirstAdminFromMenu() {
  if (!getAuthSecret_()) {
    SpreadsheetApp.getUi().alert('আগে Project Settings → Script properties → AUTH_SECRET সেট করুন।');
    return;
  }
  var admins = getAdminsSheet_();
  if (admins.getLastRow() > 1) {
    SpreadsheetApp.getUi().alert('Admins শীটে ইতিমধ্যে অ্যাকাউন্ট আছে।\n\nনতুন অ্যাডমিন: Admins শীটে হাতে সারি যোগ করুন (Customers-এর মতো hash/salt)।');
    return;
  }
  var ui = SpreadsheetApp.getUi();
  var emailResp = ui.prompt('অ্যাডমিন ইমেইল', 'লগইনে ব্যবহার করবেন (Gmail)', ui.ButtonSet.OK_CANCEL);
  if (emailResp.getSelectedButton() !== ui.Button.OK) return;
  var email = normalizeEmail_(emailResp.getResponseText());
  if (!email || email.indexOf('@') === -1) {
    ui.alert('সঠিক ইমেইল দিন।');
    return;
  }
  var phoneResp = ui.prompt('মোবাইল (ঐচ্ছিক)', '01XXXXXXXXX', ui.ButtonSet.OK_CANCEL);
  if (phoneResp.getSelectedButton() !== ui.Button.OK) return;
  var phone = normalizePhone_(phoneResp.getResponseText());
  var nameResp = ui.prompt('নাম', 'Admin', ui.ButtonSet.OK_CANCEL);
  if (nameResp.getSelectedButton() !== ui.Button.OK) return;
  var name = String(nameResp.getResponseText() || 'Admin').trim() || 'Admin';
  var passResp = ui.prompt('পাসওয়ার্ড', 'কমপক্ষে ৮ অক্ষর — admin-login.html এ ব্যবহার', ui.ButtonSet.OK_CANCEL);
  if (passResp.getSelectedButton() !== ui.Button.OK) return;
  var password = passResp.getResponseText();
  if (!password || password.length < 8) {
    ui.alert('পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে।');
    return;
  }
  var hashed = hashPassword_(password);
  appendRow_(admins, [email, phone, name, hashed.hash, hashed.salt, 'active', new Date(), 'admin', new Date()]);
  ui.alert(
    'অ্যাডমিন তৈরি হয়েছে।\n\n' +
    'লগইন: আপনার সাইটে /admin-login.html\n' +
    'ইমেইল: ' + email + '\n\n' +
    'কোড আপলোডের পর Deploy → New version করুন।'
  );
}
// ── GitHub Auto-Publish (Admin Panel → সরাসরি লাইভ সাইটে) ──
//
// Script properties প্রয়োজন:
//   GITHUB_TOKEN — Fine-grained Personal Access Token, শুধু এই একটি রিপোর জন্য,
//                  Contents: Read and write পারমিশন দিয়ে বানানো।
//
// এই ফাংশন শুধু নিচের allow-list এ থাকা ফাইলগুলো commit করতে পারবে —
// অন্য যেকোনো ফাইলের নাম দিলে PATH_NOT_ALLOWED ফিরিয়ে দেবে (সুরক্ষার জন্য)।
var GITHUB_PUBLISH_OWNER_ = 'muslim-abaya-landingpage';
var GITHUB_PUBLISH_REPO_ = 'Luxury-Dress-BD';
var GITHUB_PUBLISH_BRANCH_ = 'main';
var GITHUB_PUBLISH_ALLOWED_PATHS_ = [
  'category-products.js',
  'product-links-data.js',
  'product-catalog-sections.js',
  'product-config.js'
];

function publishFileToGitHub_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var ownerErr = requireOwnerAdmin_(v);
  if (ownerErr) return ownerErr;

  var ghToken = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!ghToken) {
    return {
      ok: false,
      error: 'GITHUB_NOT_CONFIGURED',
      message: 'Apps Script → Project Settings → Script Properties এ GITHUB_TOKEN সেট করুন।'
    };
  }

  var path = String(param_(e, 'Path') || '').trim();
  var content = String(param_(e, 'Content') || '');
  var message = String(param_(e, 'Message') || '').trim() || ('Update ' + path + ' — Admin Panel থেকে');

  if (!path || !content) {
    return { ok: false, error: 'MISSING_FIELDS', message: 'Path এবং Content প্রয়োজন।' };
  }
  if (GITHUB_PUBLISH_ALLOWED_PATHS_.indexOf(path) === -1) {
    return { ok: false, error: 'PATH_NOT_ALLOWED', message: 'এই ফাইল পাবলিশ করার অনুমতি নেই: ' + path };
  }

  var apiBase =
    'https://api.github.com/repos/' +
    GITHUB_PUBLISH_OWNER_ +
    '/' +
    GITHUB_PUBLISH_REPO_ +
    '/contents/' +
    encodeURIComponent(path);
  var headers = {
    Authorization: 'token ' + ghToken,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'MuslimAbaya-AdminPanel'
  };

  // ধাপ ১: বর্তমান ফাইলের sha বের করা (আপডেটের জন্য বাধ্যতামূলক)
  var getRes = UrlFetchApp.fetch(apiBase + '?ref=' + GITHUB_PUBLISH_BRANCH_, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  });
  var getCode = getRes.getResponseCode();
  if (getCode !== 200) {
    return {
      ok: false,
      error: 'GITHUB_GET_FAILED',
      message: 'GitHub থেকে ফাইল পাওয়া যায়নি (HTTP ' + getCode + ')',
      detail: getRes.getContentText().slice(0, 300)
    };
  }
  var fileInfo = {};
  try { fileInfo = JSON.parse(getRes.getContentText()); } catch (parseErr) {}
  var sha = fileInfo.sha;
  if (!sha) {
    return { ok: false, error: 'GITHUB_NO_SHA', message: 'ফাইলের sha পাওয়া যায়নি।' };
  }

  // ধাপ ২: নতুন কন্টেন্ট commit করা (UTF-8 সেফ base64)
  var b64 = Utilities.base64Encode(content, Utilities.Charset.UTF_8);
  var putPayload = {
    message: message,
    content: b64,
    sha: sha,
    branch: GITHUB_PUBLISH_BRANCH_
  };
  var putRes = UrlFetchApp.fetch(apiBase, {
    method: 'put',
    headers: headers,
    contentType: 'application/json',
    payload: JSON.stringify(putPayload),
    muteHttpExceptions: true
  });
  var putCode = putRes.getResponseCode();
  var putBody = {};
  try { putBody = JSON.parse(putRes.getContentText()); } catch (parseErr2) {}

  if (putCode !== 200 && putCode !== 201) {
    return {
      ok: false,
      error: 'GITHUB_PUT_FAILED',
      message: 'কমিট ব্যর্থ হয়েছে (HTTP ' + putCode + ')',
      detail: (putBody && putBody.message) || putRes.getContentText().slice(0, 300)
    };
  }

  return {
    ok: true,
    message: 'পাবলিশ সফল — Netlify ১-২ মিনিটে সাইট আপডেট করবে।',
    path: path,
    commitUrl: (putBody && putBody.commit && putBody.commit.html_url) || '',
    sha: (putBody && putBody.content && putBody.content.sha) || ''
  };
}

// ── ছবি আপলোড (Product Manager → drag/drop, Workstream 2) ──
// শুধু "images/" ফোল্ডারের ভেতরে, নির্দিষ্ট mime + সাইজ সীমার মধ্যে ছবি commit করে।
// FileName সার্ভার-সাইডে কড়াভাবে validate হয় (শুধু images/ + a-z 0-9 - . অনুমোদিত) —
// path traversal বা অন্য কোনো ফাইল ওভাররাইট করা সম্ভব না, ক্লায়েন্ট যাই পাঠাক না কেন।
// এই ফাংশনটি সম্পূর্ণ আলাদা — publishFileToGitHub_ বা তার allow-list এ হাত দেওয়া হয়নি।
var GITHUB_IMAGES_PREFIX_ = 'images/';
var GITHUB_IMAGE_ALLOWED_EXT_ = ['webp', 'jpg', 'jpeg', 'png'];
var GITHUB_IMAGE_ALLOWED_MIME_ = ['image/webp', 'image/jpeg', 'image/png'];
var GITHUB_IMAGE_MAX_BYTES_ = Math.round(2.5 * 1024 * 1024); // 2.5MB

function isAllowedGithubImagePath_(path) {
  var value = String(path || '').trim();
  if (value.indexOf(GITHUB_IMAGES_PREFIX_) !== 0) return false;
  var rest = value.slice(GITHUB_IMAGES_PREFIX_.length);
  var extMatch = /\.([a-zA-Z0-9]+)$/.exec(rest);
  var ext = extMatch ? extMatch[1].toLowerCase() : '';
  return /^[a-z0-9-]+(?:\/[a-z0-9-]+)*\.[a-z0-9]+$/.test(rest) &&
    rest.indexOf('..') === -1 && GITHUB_IMAGE_ALLOWED_EXT_.indexOf(ext) !== -1;
}

function validateGithubImagePayload_(b64, mime, path) {
  var value = String(b64 || '').replace(/\s/g, '');
  if (!value || value.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    return { ok: false, error: 'INVALID_IMAGE_DATA', message: 'ছবির ডাটা সঠিক Base64 ফরম্যাটে নেই।' };
  }
  var pathMatch = /\.([a-zA-Z0-9]+)$/.exec(String(path || ''));
  var ext = pathMatch ? pathMatch[1].toLowerCase() : '';
  var expectedMime = ext === 'webp' ? 'image/webp' : (ext === 'png' ? 'image/png' : 'image/jpeg');
  if (GITHUB_IMAGE_ALLOWED_MIME_.indexOf(mime) === -1 || mime !== expectedMime) {
    return { ok: false, error: 'MIME_NOT_ALLOWED', message: 'ফাইলের এক্সটেনশন ও ছবির ধরন মিলতে হবে (WebP/JPEG/PNG)।' };
  }
  if (value.length > Math.ceil(GITHUB_IMAGE_MAX_BYTES_ / 3) * 4) {
    return { ok: false, error: 'FILE_TOO_LARGE', message: 'ছবি ২.৫MB এর বেশি।' };
  }
  var bytes;
  try { bytes = Utilities.base64Decode(value); } catch (err) {
    return { ok: false, error: 'INVALID_IMAGE_DATA', message: 'ছবির ডাটা পড়া যায়নি।' };
  }
  if (!bytes || bytes.length > GITHUB_IMAGE_MAX_BYTES_) {
    return { ok: false, error: 'FILE_TOO_LARGE', message: 'ছবি ২.৫MB এর বেশি।' };
  }
  function byteAt(index) { return (bytes[index] + 256) % 256; }
  var valid = false;
  if (mime === 'image/png') {
    var png = [137, 80, 78, 71, 13, 10, 26, 10];
    valid = bytes.length >= png.length && png.every(function (b, i) { return byteAt(i) === b; });
  } else if (mime === 'image/jpeg') {
    valid = bytes.length >= 3 && byteAt(0) === 255 && byteAt(1) === 216 && byteAt(2) === 255;
  } else if (mime === 'image/webp') {
    valid = bytes.length >= 12 && byteAt(0) === 82 && byteAt(1) === 73 && byteAt(2) === 70 && byteAt(3) === 70 &&
      byteAt(8) === 87 && byteAt(9) === 69 && byteAt(10) === 66 && byteAt(11) === 80;
  }
  if (!valid) return { ok: false, error: 'INVALID_IMAGE_DATA', message: 'ফাইলের ভেতরের ডাটা ঘোষিত ছবির ধরনের সঙ্গে মেলে না।' };
  return { ok: true };
}

function publishImageToGitHub_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var ownerErr = requireOwnerAdmin_(v);
  if (ownerErr) return ownerErr;

  var ghToken = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!ghToken) {
    return {
      ok: false,
      error: 'GITHUB_NOT_CONFIGURED',
      message: 'Apps Script → Project Settings → Script Properties এ GITHUB_TOKEN সেট করুন।'
    };
  }

  var mime = String(param_(e, 'MimeType') || '').trim().toLowerCase();
  var path = String(param_(e, 'FileName') || '').trim();
  if (!isAllowedGithubImagePath_(path)) {
    return {
      ok: false,
      error: 'PATH_NOT_ALLOWED',
      message: 'এই নামে ছবি আপলোড করা যাবে না — শুধু images/ ফোল্ডারে সাধারণ ফাইলনেম (a-z 0-9 -) অনুমোদিত।'
    };
  }

  var b64 = String(param_(e, 'ContentBase64') || '').replace(/\s/g, '');
  var imageValidation = validateGithubImagePayload_(b64, mime, path);
  if (!imageValidation.ok) return imageValidation;

  var apiBase =
    'https://api.github.com/repos/' +
    GITHUB_PUBLISH_OWNER_ +
    '/' +
    GITHUB_PUBLISH_REPO_ +
    '/contents/' +
    encodeURIComponent(path);
  var headers = {
    Authorization: 'token ' + ghToken,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'MuslimAbaya-AdminPanel'
  };

  // ফাইলটা আগে থেকে আছে কিনা দেখা — থাকলে sha পাঠাতে হবে (আপডেট), না থাকলে নতুন কমিট।
  var putPayload = {
    message: 'Upload image ' + path + ' — Admin Panel থেকে',
    content: b64,
    branch: GITHUB_PUBLISH_BRANCH_
  };
  var getRes = UrlFetchApp.fetch(apiBase + '?ref=' + GITHUB_PUBLISH_BRANCH_, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  });
  if (getRes.getResponseCode() === 200) {
    try {
      var existing = JSON.parse(getRes.getContentText());
      if (existing && existing.sha) putPayload.sha = existing.sha;
    } catch (parseErr3) {}
  }

  var putRes = UrlFetchApp.fetch(apiBase, {
    method: 'put',
    headers: headers,
    contentType: 'application/json',
    payload: JSON.stringify(putPayload),
    muteHttpExceptions: true
  });
  var putCode = putRes.getResponseCode();
  var putBody = {};
  try { putBody = JSON.parse(putRes.getContentText()); } catch (parseErr4) {}

  if (putCode !== 200 && putCode !== 201) {
    return {
      ok: false,
      error: 'GITHUB_PUT_FAILED',
      message: 'ছবি আপলোড ব্যর্থ হয়েছে (HTTP ' + putCode + ')',
      detail: (putBody && putBody.message) || putRes.getContentText().slice(0, 300)
    };
  }

  return {
    ok: true,
    message: 'ছবি আপলোড সফল — Netlify ১-২ মিনিটে সাইটে যুক্ত হবে।',
    path: path,
    commitUrl: (putBody && putBody.commit && putBody.commit.html_url) || '',
    sha: (putBody && putBody.content && putBody.content.sha) || ''
  };
}


function listImagesFromGitHub_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;

  var ghToken = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!ghToken) {
    return {
      ok: false,
      error: 'GITHUB_NOT_CONFIGURED',
      message: 'Apps Script → Project Settings → Script Properties এ GITHUB_TOKEN সেট করুন।'
    };
  }

  var headers = {
    Authorization: 'token ' + ghToken,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'MuslimAbaya-AdminPanel'
  };

  var treeUrl =
    'https://api.github.com/repos/' + GITHUB_PUBLISH_OWNER_ + '/' + GITHUB_PUBLISH_REPO_ +
    '/git/trees/' + GITHUB_PUBLISH_BRANCH_ + '?recursive=1';
  var res = UrlFetchApp.fetch(treeUrl, { method: 'get', headers: headers, muteHttpExceptions: true });
  var code = res.getResponseCode();
  if (code !== 200) {
    return {
      ok: false,
      error: 'GITHUB_LIST_FAILED',
      message: 'ছবির তালিকা আনা যায়নি (HTTP ' + code + ')',
      detail: res.getContentText().slice(0, 300)
    };
  }
  var body = {};
  try { body = JSON.parse(res.getContentText()); } catch (parseErr) {}
  var tree = (body && body.tree) || [];
  var images = [];
  var i;
  for (i = 0; i < tree.length; i++) {
    var item = tree[i];
    if (!item || item.type !== 'blob') continue;
    var p = String(item.path || '');
    if (p.indexOf(GITHUB_IMAGES_PREFIX_) !== 0) continue;
    var extMatch = /\.([a-zA-Z0-9]+)$/.exec(p);
    var ext = extMatch ? extMatch[1].toLowerCase() : '';
    if (GITHUB_IMAGE_ALLOWED_EXT_.indexOf(ext) === -1) continue;
    images.push({
      path: p,
      url: 'https://raw.githubusercontent.com/' + GITHUB_PUBLISH_OWNER_ + '/' + GITHUB_PUBLISH_REPO_ + '/' + GITHUB_PUBLISH_BRANCH_ + '/' + p,
      size: item.size || 0
    });
  }
  images.sort(function (a, b) { return a.path < b.path ? 1 : -1; });
  return { ok: true, images: images, count: images.length };
}

function deleteImageFromGitHub_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var ownerErr = requireOwnerAdmin_(v);
  if (ownerErr) return ownerErr;

  var ghToken = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!ghToken) {
    return {
      ok: false,
      error: 'GITHUB_NOT_CONFIGURED',
      message: 'Apps Script → Project Settings → Script Properties এ GITHUB_TOKEN সেট করুন।'
    };
  }

  var path = String(param_(e, 'Path') || '').trim();
  if (!isAllowedGithubImagePath_(path)) {
    return { ok: false, error: 'PATH_NOT_ALLOWED', message: 'শুধু images/ ফোল্ডারের ছবি মোছা যাবে।' };
  }

  var headers = {
    Authorization: 'token ' + ghToken,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'MuslimAbaya-AdminPanel'
  };
  var apiBase =
    'https://api.github.com/repos/' + GITHUB_PUBLISH_OWNER_ + '/' + GITHUB_PUBLISH_REPO_ +
    '/contents/' + path.split('/').map(encodeURIComponent).join('/');

  var getRes = UrlFetchApp.fetch(apiBase + '?ref=' + GITHUB_PUBLISH_BRANCH_, {
    method: 'get',
    headers: headers,
    muteHttpExceptions: true
  });
  if (getRes.getResponseCode() !== 200) {
    return { ok: false, error: 'GITHUB_GET_FAILED', message: 'ছবি খুঁজে পাওয়া যায়নি (HTTP ' + getRes.getResponseCode() + ')' };
  }
  var fileInfo = {};
  try { fileInfo = JSON.parse(getRes.getContentText()); } catch (parseErr) {}
  var sha = fileInfo.sha;
  if (!sha) {
    return { ok: false, error: 'GITHUB_NO_SHA', message: 'ছবির sha পাওয়া যায়নি।' };
  }

  var delRes = UrlFetchApp.fetch(apiBase, {
    method: 'delete',
    headers: headers,
    contentType: 'application/json',
    payload: JSON.stringify({
      message: 'Delete image ' + path + ' — Admin Panel থেকে',
      sha: sha,
      branch: GITHUB_PUBLISH_BRANCH_
    }),
    muteHttpExceptions: true
  });
  var delCode = delRes.getResponseCode();
  if (delCode !== 200) {
    return { ok: false, error: 'GITHUB_DELETE_FAILED', message: 'ছবি মোছা যায়নি (HTTP ' + delCode + ')', detail: delRes.getContentText().slice(0, 300) };
  }
  return { ok: true, message: 'ছবি মুছে ফেলা হয়েছে।', path: path };
}

// ===== Order value parser (Bangla digits, ৳, commas) =====
function parseOrderValue_(raw) {
  var bn = '০১২৩৪৫৬৭৮৯';
  var s = String(raw == null ? '' : raw).replace(/[০-৯]/g, function (d) { return String(bn.indexOf(d)); });
  s = s.replace(/[^0-9.]/g, '');
  var n = parseFloat(s);
  return isFinite(n) && n > 0 ? n : 0;
}

function parseSignedOrderAmount_(raw) {
  var bn = '০১২৩৪৫৬৭৮৯';
  var text = String(raw == null ? '' : raw)
    .replace(/[০-৯]/g, function (d) { return String(bn.indexOf(d)); })
    .replace(/,/g, '');
  var match = text.match(/-?(?:\d+(?:\.\d*)?|\.\d+)/);
  var amount = match ? Number(match[0]) : 0;
  return isFinite(amount) ? amount : 0;
}

// ===== Messenger → Conversions API for Business Messaging =====
var MSGR_PAGE_ID = '964928770039259';
var MSGR_DATASET_ID = '1465090315322833';
var MSGR_SHEET = 'MessengerContacts';

function messengerVerify_(e) {
  var want = PropertiesService.getScriptProperties().getProperty('MSGR_VERIFY_TOKEN') || '';
  if (want && e.parameter['hub.verify_token'] === want) {
    return ContentService.createTextOutput(String(e.parameter['hub.challenge'] || ''));
  }
  return ContentService.createTextOutput('forbidden');
}

// Saves every person who messages the Page: PSID + name + time.
function messengerContactExists_(sh, psid) {
  var data = sh.getRange(1, 1, Math.max(sh.getLastRow(), 1), 1).getValues();
  var i;
  for (i = 1; i < data.length; i++) {
    if (String(data[i][0]) === psid) return true;
  }
  return false;
}

function getPageAccessToken_(pageId) {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty('MSGR_PAGE_TOKEN_' + pageId) || props.getProperty('MSGR_PAGE_TOKEN') || '';
}

function sendMessengerText_(pageId, psid, text) {
  var token = getPageAccessToken_(pageId);
  if (!token || !psid) return { ok: false, code: 'MISSING_TOKEN' };
  var payload = {
    recipient: { id: String(psid) },
    messaging_type: 'RESPONSE',
    message: { text: String(text || '').slice(0, 2000) }
  };
  try {
    var res = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/me/messages?access_token=' + encodeURIComponent(token), {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    return { ok: res.getResponseCode() === 200, body: res.getContentText() };
  } catch (sendErr) {
    return { ok: false, error: String(sendErr.message || sendErr) };
  }
}

function normalizeMsgrText_(s) {
  return String(s || '').toLowerCase().trim();
}

function messengerGreetingText_() {
  return 'আসসালামু আলাইকুম! Muslim Abaya / Luxury Dress BD-তে স্বাগতম। 🌸\n\n' +
    'ওয়েবসাইট: https://muslimabaya.com\n' +
    'WhatsApp: 01971642683\n\n' +
    'অর্ডার স্ট্যাটাস জানতে আপনার ফোন নাম্বার বা অর্ডার আইডি পাঠান।\n' +
    'দাম, ডেলিভারি, পেমেন্ট বা রিটার্ন নিয়ে প্রশ্ন থাকলে লিখুন, সাথে সাথে জানাবো।';
}

function lookupOrderStatusForMessenger_(query) {
  var sheet = SpreadsheetApp.getActive().getSheetByName('Online Order');
  if (!sheet) return [];
  var data = readOnlineOrderRows_(sheet);
  var phoneDigits = String(query || '').replace(/\D/g, '');
  var isPhone = /^01\d{9}$/.test(phoneDigits);
  var qOrderId = String(query || '').trim().toLowerCase();
  var matches = [];
  var i;
  for (i = data.length - 1; i >= 1; i--) {
    var row = data[i];
    var rowPhone = String(row[2] || '').replace(/\D/g, '');
    var rowOrderId = String(row[8] || '').trim().toLowerCase();
    if (isPhone && rowPhone === phoneDigits) {
      matches.push(row);
      if (matches.length >= 3) break;
    } else if (!isPhone && rowOrderId && rowOrderId === qOrderId) {
      matches.push(row);
      break;
    }
  }
  return matches;
}

function buildMessengerAutoReply_(rawText) {
  var text = normalizeMsgrText_(rawText);
  var phoneDigits = text.replace(/\D/g, '');
  var looksLikeOrderId = /^[a-z]{1,4}[-_]?[0-9a-z]{4,}$/i.test(String(rawText || '').trim());

  if (/^01\d{9}$/.test(phoneDigits) || looksLikeOrderId) {
    var found = lookupOrderStatusForMessenger_(phoneDigits.length === 11 ? phoneDigits : String(rawText || '').trim());
    if (found && found.length) {
      return found.map(function (row) {
        return '📦 অর্ডার আইডি: ' + row[8] + '\nস্ট্যাটাস: ' + (row[9] || 'Pending') +
          '\nমোট: ৳' + row[7] + '\nতারিখ: ' + row[0];
      }).join('\n\n');
    }
    if (/^01\d{9}$/.test(phoneDigits)) {
      return 'এই নাম্বারে কোনো অর্ডার খুঁজে পাইনি। সঠিক ফোন নাম্বার (01XXXXXXXXX) দিয়ে আবার চেষ্টা করুন, অথবা WhatsApp করুন: 01971642683';
    }
  }

  if (/(^|\s)(hi|hello|hey|salam|সালাম|আসসালামু|শুরু|start)(\s|$)/i.test(text)) {
    return messengerGreetingText_();
  }
  if (/(দাম|price|rate|কত)/i.test(text)) {
    return '💰 প্রতিটি প্রোডাক্টের দাম আমাদের ওয়েবসাইটে দেখা যাবে:\nhttps://muslimabaya.com\n\nনির্দিষ্ট কোনো প্রোডাক্টের নাম বা ছবি পাঠালে দাম জানিয়ে দিচ্ছি।';
  }
  if (/(delivery|ডেলিভারি|shipping|কতদিন)/i.test(text)) {
    return '🚚 ডেলিভারি সময়: ঢাকার ভিতরে ১-২ কার্যদিবস, ঢাকার বাইরে ৩-৫ কার্যদিবস।\nডেলিভারি চার্জ সাধারণত ৳১৫০ (৩+ পিস অর্ডারে ফ্রি ডেলিভারি)।';
  }
  if (/(payment|পেমেন্ট|bkash|বিকাশ|nagad|নগদ|cod|ক্যাশ)/i.test(text)) {
    return '💳 পেমেন্ট মাধ্যম: ক্যাশ অন ডেলিভারি (COD), বিকাশ ও নগদ।\nঅর্ডার করার সময় আপনি পছন্দমতো মাধ্যম বেছে নিতে পারবেন।';
  }
  if (/(return|রিটার্ন|exchange|এক্সচেঞ্জ|ফেরত)/i.test(text)) {
    return '↩️ প্রোডাক্টে সমস্যা থাকলে ডেলিভারির ২৪ ঘণ্টার মধ্যে জানালে রিটার্ন/এক্সচেঞ্জ করা যাবে। বিস্তারিত জানতে WhatsApp করুন: 01971642683';
  }
  if (/(size|সাইজ|মাপ)/i.test(text)) {
    return '📏 সাইজ গাইড:\nAbaya/Kaftan — Free Size (Body 46), Length: 50/52/54/56\nPremium Two-Piece — Free Size (Body 42), Length: 37-38 inch\nকাস্টম সাইজ দরকার হলে অর্ডারের সময় জানাতে পারবেন।';
  }

  return 'ধন্যবাদ আপনার মেসেজের জন্য! 🙏\n\n' +
    'অর্ডার স্ট্যাটাস জানতে ফোন নাম্বার বা অর্ডার আইডি পাঠান।\n' +
    'দাম/ডেলিভারি/পেমেন্ট/রিটার্ন/সাইজ নিয়ে প্রশ্ন থাকলে লিখুন।\n' +
    'সরাসরি কথা বলতে WhatsApp করুন: 01971642683\nওয়েবসাইট: https://muslimabaya.com';
}

function messengerWebhook_(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    (body.entry || []).forEach(function (entry) {
      var pageId = String(entry.id || MSGR_PAGE_ID);
      (entry.messaging || []).forEach(function (ev) {
        var psid = ev.sender && ev.sender.id;
        if (!psid || String(psid) === pageId) return;
        if (ev.message && ev.message.is_echo) return;

        var fromAd = ev.referral && ev.referral.source === 'ADS' ? 'yes' : '';
        var isNew = true;
        try {
          var contactsSh = msgrContactsSheet_();
          var values = contactsSh.getDataRange().getValues();
          isNew = msgrFindContactRow_(values, pageId, String(psid)) === -1;
        } catch (lookupErr) {}

        try {
          msgrRecordMessage_(pageId, String(psid), 'in', msgrEventText_(ev), (ev.message && ev.message.mid) ? String(ev.message.mid) : '', '', fromAd, ev.message && ev.message.attachments);
        } catch (recErr) {}

        try {
          var replySent = '';
          if (ev.postback && ev.postback.payload === 'GET_STARTED') {
            replySent = messengerGreetingText_();
            sendMessengerText_(pageId, psid, replySent);
          } else if (ev.message && ev.message.text) {
            var replyText = buildMessengerAutoReply_(ev.message.text);
            if (isNew) replyText = messengerGreetingText_() + '\n\n' + replyText;
            replySent = replyText;
            sendMessengerText_(pageId, psid, replyText);
          }
          if (replySent) {
            try { msgrRecordMessage_(pageId, String(psid), 'out', replySent, '', 'Bot', ''); } catch (recErr2) {}
          }
        } catch (replyErr) {}
      });
    });
  } catch (err) {}
  return ContentService.createTextOutput('EVENT_RECEIVED');
}

function setupMessengerProfileForAllPages_() {
  var pageIds = ['964928770039259', '381729145014885', '258170054039575'];
  var results = {};
  pageIds.forEach(function (pid) {
    var token = getPageAccessToken_(pid);
    if (!token) { results[pid] = { ok: false, error: 'NO_TOKEN' }; return; }
    var payload = {
      get_started: { payload: 'GET_STARTED' },
      greeting: [{ locale: 'default', text: 'আসসালামু আলাইকুম {{user_first_name}}! Muslim Abaya-তে স্বাগতম। অর্ডার স্ট্যাটাস, দাম বা ডেলিভারি নিয়ে জানতে মেসেজ করুন।' }]
    };
    var res = UrlFetchApp.fetch('https://graph.facebook.com/v21.0/me/messenger_profile?access_token=' + encodeURIComponent(token), {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    results[pid] = { ok: res.getResponseCode() === 200, body: res.getContentText() };
  });
  return results;
}

function setupMessengerProfileForAllPagesFromMenu() {
  var r = setupMessengerProfileForAllPages_();
  SpreadsheetApp.getUi().alert('Messenger profile setup ফলাফল:\n' + JSON.stringify(r, null, 2).slice(0, 900));
}

var MSGR_PAGE_ID = '964928770039259';
var MSGR_DATASET_ID = '1465090315322833';
var MSGR_SHEET = 'MessengerContacts';
var MSGR_MSG_SHEET = 'MessengerMessages';

// ===== Multi-Page Messenger Inbox =====
// প্রতিটি Page-এর Page Access Token রাখুন Script Properties-এ:
//   MSGR_PAGE_TOKEN_<PageID>   (যেমন MSGR_PAGE_TOKEN_381729145014885)
// পুরোনো MSGR_PAGE_TOKEN শুধু MSGR_PAGE_ID Page-এর জন্য fallback।
var MSGR_PAGES = {
  '964928770039259': 'Luxury Dress BD',
  '381729145014885': 'Muslim Abaya',
  '258170054039575': 'Luxury Dress'
};
var MSGR_STATUSES = ['নতুন', 'দাম জিজ্ঞেস', 'অর্ডার কনফার্ম', 'ডেলিভারি হয়েছে', 'বাতিল'];
var MSGR_CONFIRMED_STATUS = 'অর্ডার কনফার্ম';
var MSGR_DELIVERED_STATUS = 'ডেলিভারি হয়েছে';
// Contacts sheet columns (1-based)
var MC = { PSID: 1, NAME: 2, FIRST: 3, LAST: 4, FROM_AD: 5, PAGE: 6, STATUS: 7, ASSIGNED: 8,
  LAST_MSG: 9, LAST_DIR: 10, UNREAD: 11, ORDER_ID: 12, ORDER_VALUE: 13, PURCHASE_SENT: 14, NOTES: 15, PROFILE: 16 };
var MC_HEADERS = ['PSID', 'Name', 'FirstSeen', 'LastSeen', 'FromAd', 'PageId', 'Status', 'AssignedTo',
  'LastMessage', 'LastDirection', 'Unread', 'OrderId', 'OrderValue', 'PurchaseSent', 'Notes', 'ProfilePic'];

function msgrPageToken_(pageId) {
  var props = PropertiesService.getScriptProperties();
  var t = props.getProperty('MSGR_PAGE_TOKEN_' + String(pageId || ''));
  if (!t && String(pageId) === MSGR_PAGE_ID) t = props.getProperty('MSGR_PAGE_TOKEN');
  return String(t || '').trim();
}

function msgrPageName_(pageId) {
  return MSGR_PAGES[String(pageId)] || String(pageId || '');
}

function msgrContactsSheet_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(MSGR_SHEET) || ss.insertSheet(MSGR_SHEET);
  var lastCol = Math.max(sh.getLastColumn(), 1);
  var head = sh.getLastRow() ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (!head[MC.NOTES - 1]) sh.getRange(1, 1, 1, MC_HEADERS.length).setValues([MC_HEADERS]);
  if (!head[MC.PROFILE - 1]) sh.getRange(1, MC.PROFILE).setValue('ProfilePic');
  return sh;
}

function msgrMessagesSheet_() {
  var sh = ensureSheet_(MSGR_MSG_SHEET, ['Time', 'PageId', 'PSID', 'Direction', 'Text', 'MID', 'By', 'Attachments']);
  if (sh.getRange(1, 8).getValue() !== 'Attachments') sh.getRange(1, 8).setValue('Attachments');
  return sh;
}

// Rows written before multi-Page support have no PageId: they belong to MSGR_PAGE_ID.
function msgrRowPageId_(row) {
  return String(row[MC.PAGE - 1] || '') || MSGR_PAGE_ID;
}

function msgrFindContactRow_(values, pageId, psid) {
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][MC.PSID - 1]) === String(psid) && msgrRowPageId_(values[i]) === String(pageId)) {
      return i + 1;
    }
  }
  return -1;
}

function msgrEventText_(ev) {
  if (ev.message) {
    if (ev.message.text) return String(ev.message.text);
    var atts = ev.message.attachments || [];
    if (atts.length) return '[' + atts.map(function (a) { return a.type || 'attachment'; }).join(', ') + ']';
    return '[message]';
  }
  if (ev.postback) return '[বাটন] ' + String(ev.postback.title || ev.postback.payload || '');
  if (ev.referral) return '[বিজ্ঞাপন/লিংক থেকে এসেছে]';
  return '';
}

// Webhook: saves every conversation (all connected Pages) + each message.

function msgrRecordMessage_(pageId, psid, direction, text, mid, by, fromAd, attachments) {
  var now = new Date();
  msgrMessagesSheet_().appendRow([now, pageId, psid, direction, String(text || '').slice(0, 2000), mid || '', by || '', JSON.stringify(msgrAttachments_(attachments))]);
  var sh = msgrContactsSheet_();
  var values = sh.getDataRange().getValues();
  var rowNum = msgrFindContactRow_(values, pageId, psid);
  var preview = String(text || '').slice(0, 200);
  if (rowNum === -1) {
    var row = new Array(MC_HEADERS.length);
    for (var i = 0; i < row.length; i++) row[i] = '';
    row[MC.PSID - 1] = psid;
    var profile = getMessengerProfile_(psid, pageId);
    row[MC.NAME - 1] = profile.name || '';
    row[MC.PROFILE - 1] = profile.profile_pic || '';
    row[MC.FIRST - 1] = now;
    row[MC.LAST - 1] = now;
    row[MC.FROM_AD - 1] = fromAd || '';
    row[MC.PAGE - 1] = pageId;
    row[MC.STATUS - 1] = MSGR_STATUSES[0];
    row[MC.LAST_MSG - 1] = preview;
    row[MC.LAST_DIR - 1] = direction;
    row[MC.UNREAD - 1] = direction === 'in' ? 1 : 0;
    sh.appendRow(row);
    return;
  }
  var cur = values[rowNum - 1];
  cur[MC.LAST - 1] = now;
  cur[MC.PAGE - 1] = pageId;
  cur[MC.LAST_MSG - 1] = preview;
  cur[MC.LAST_DIR - 1] = direction;
  cur[MC.UNREAD - 1] = direction === 'in' ? (parseInt(cur[MC.UNREAD - 1], 10) || 0) + 1 : 0;
  if (fromAd) cur[MC.FROM_AD - 1] = 'yes';
  if (!cur[MC.STATUS - 1]) cur[MC.STATUS - 1] = MSGR_STATUSES[0];
  if (!cur[MC.NAME - 1]) cur[MC.NAME - 1] = getMessengerName_(psid, pageId);
  while (cur.length < MC_HEADERS.length) cur.push('');
  sh.getRange(rowNum, 1, 1, MC_HEADERS.length).setValues([cur.slice(0, MC_HEADERS.length)]);
}

// Kept for compatibility with older callers.
function upsertMessengerContact_(sh, psid, fromAd) {
  msgrRecordMessage_(MSGR_PAGE_ID, psid, 'in', '', '', '', fromAd);
}

function msgrAttachments_(items) {
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch (e) { items = []; } }
  return (Array.isArray(items) ? items : []).slice(0, 20).map(function (a) {
    var url = String(a.url || (a.payload && a.payload.url) || '');
    return { type: String(a.type || 'file'), url: /^https:\/\//i.test(url) ? url : '' };
  }).filter(function (a) { return a.url; });
}

function getMessengerProfile_(psid, pageId) {
  var key = 'msgr_profile_' + pageId + '_' + psid;
  var cache = CacheService.getScriptCache();
  var cached = cache.get(key);
  if (cached) { try { return JSON.parse(cached); } catch (e) {} }
  try {
    var token = msgrPageToken_(pageId || MSGR_PAGE_ID);
    if (!token) return {};
    var res = UrlFetchApp.fetch('https://graph.facebook.com/v25.0/' + encodeURIComponent(psid) +
      '?fields=first_name,last_name,profile_pic', {
        headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
      });
    if (res.getResponseCode() !== 200) { cache.put(key, '{}', 300); return {}; }
    var body = JSON.parse(res.getContentText()) || {};
    var profile = { name: [body.first_name, body.last_name].filter(Boolean).join(' '), profile_pic: body.profile_pic || '' };
    cache.put(key, JSON.stringify(profile), 3600);
    return profile;
  } catch (e) { return {}; }
}

function getMessengerName_(psid, pageId) {
  return getMessengerProfile_(psid, pageId).name || '';
}

// Call when a Messenger order becomes Confirmed/Delivered.
function sendMessengerPurchase_(psid, value, orderId, pageId) {
  var page = String(pageId || MSGR_PAGE_ID);
  var token = msgrPageToken_(page);
  if (!token || !psid) return { ok: false, code: 'MISSING' };
  var payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: 'msgr_' + String(orderId || psid),
      action_source: 'business_messaging',
      messaging_channel: 'messenger',
      user_data: { page_id: page, page_scoped_user_id: String(psid) },
      custom_data: { currency: 'BDT', value: parseOrderValue_(value) }
    }]
  };
  var datasetId = PropertiesService.getScriptProperties().getProperty('MSGR_DATASET_ID_' + page) || MSGR_DATASET_ID;
  var res = UrlFetchApp.fetch('https://graph.facebook.com/v25.0/' + datasetId +
    '/events?access_token=' + encodeURIComponent(token), {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
  return { ok: res.getResponseCode() === 200, body: res.getContentText() };
}

// ── Inbox admin API (RecordType = Inbox*) ──

function inboxRateLimit_(token) {
  var cache = CacheService.getScriptCache();
  var k = 'rl_inbox_' + String(token || 'x').slice(0, 48);
  var n = parseInt(cache.get(k) || '0', 10);
  if (n >= 600) throw new Error('RATE_LIMIT');
  cache.put(k, String(n + 1), 600);
}

function adminRateLimit_(token) {
  var cache = CacheService.getScriptCache();
  var k = 'rl_admin_' + String(token || 'x').slice(0, 48);
  var n = parseInt(cache.get(k) || '0', 10);
  if (n >= 300) throw new Error('RATE_LIMIT');
  cache.put(k, String(n + 1), 600);
}

// Admin or staff accounts from the Admins sheet can use the inbox.
function verifyInboxSession_(token) {
  return verifyAdminSession_(token);
}

function handleInboxRequest_(type, e) {
  var token = param_(e, 'Token');
  inboxRateLimit_(token);
  var v = verifyInboxSession_(token);
  if (!v.ok) return v;
  if (type === 'InboxList') return inboxList_(e);
  if (type === 'InboxThread') return inboxThread_(e);
  if (type === 'InboxProfile') return inboxProfile_(e);
  if (type === 'InboxReply') return inboxReply_(e, v);
  if (type === 'InboxUpdate') return inboxUpdate_(e, v);
  return { ok: false, error: 'UNKNOWN_TYPE' };
}

function msgrTeamNames_() {
  var out = [];
  try {
    var data = getAdminsSheet_().getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][5] || '') === 'blocked') continue;
      var n = String(data[i][2] || data[i][0] || '').trim();
      if (n && out.indexOf(n) === -1) out.push(n);
    }
  } catch (err) {}
  return out;
}

function msgrContactFromRow_(r) {
  var pageId = msgrRowPageId_(r);
  return {
    psid: String(r[MC.PSID - 1]),
    name: String(r[MC.NAME - 1] || ''),
    profilePic: String(r[MC.PROFILE - 1] || ''),
    firstSeen: formatCell_(r[MC.FIRST - 1]),
    lastSeen: formatCell_(r[MC.LAST - 1]),
    lastSeenMs: r[MC.LAST - 1] instanceof Date ? r[MC.LAST - 1].getTime() : (new Date(r[MC.LAST - 1]).getTime() || 0),
    fromAd: String(r[MC.FROM_AD - 1] || '') === 'yes',
    pageId: pageId,
    pageName: msgrPageName_(pageId),
    status: String(r[MC.STATUS - 1] || MSGR_STATUSES[0]),
    assignedTo: String(r[MC.ASSIGNED - 1] || ''),
    lastMessage: String(r[MC.LAST_MSG - 1] || ''),
    lastDirection: String(r[MC.LAST_DIR - 1] || ''),
    unread: parseInt(r[MC.UNREAD - 1], 10) || 0,
    orderId: String(r[MC.ORDER_ID - 1] || ''),
    orderValue: String(r[MC.ORDER_VALUE - 1] || ''),
    purchaseSent: !!r[MC.PURCHASE_SENT - 1],
    notes: String(r[MC.NOTES - 1] || '')
  };
}

function inboxList_(e) {
  var values = msgrContactsSheet_().getDataRange().getValues();
  var pageFilter = param_(e, 'PageId');
  var statusFilter = param_(e, 'Status');
  var assignedFilter = param_(e, 'AssignedTo');
  var q = String(param_(e, 'Q') || '').toLowerCase();
  var unreadOnly = param_(e, 'Unread') === '1';
  var limit = Math.min(Math.max(parseInt(param_(e, 'Limit'), 10) || 150, 1), 300);
  var all = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][MC.PSID - 1]) continue;
    all.push(msgrContactFromRow_(values[i]));
  }
  // Conversion stats cover every conversation, per Page and overall.
  var stats = { total: 0, unread: 0, fromAd: 0, confirmed: 0, delivered: 0, byPage: {} };
  all.forEach(function (c) {
    var ps = stats.byPage[c.pageId] || (stats.byPage[c.pageId] = { name: c.pageName, total: 0, confirmed: 0, unread: 0 });
    var won = c.status === MSGR_CONFIRMED_STATUS || c.status === MSGR_DELIVERED_STATUS;
    stats.total++; ps.total++;
    if (c.unread) { stats.unread++; ps.unread++; }
    if (c.fromAd) stats.fromAd++;
    if (won) { stats.confirmed++; ps.confirmed++; }
    if (c.status === MSGR_DELIVERED_STATUS) stats.delivered++;
  });
  var list = all.filter(function (c) {
    if (pageFilter && c.pageId !== pageFilter) return false;
    if (statusFilter && c.status !== statusFilter) return false;
    if (assignedFilter === '__none__' && c.assignedTo) return false;
    if (assignedFilter && assignedFilter !== '__none__' && c.assignedTo !== assignedFilter) return false;
    if (unreadOnly && !c.unread) return false;
    if (q && (c.name + ' ' + c.lastMessage + ' ' + c.orderId + ' ' + c.notes).toLowerCase().indexOf(q) === -1) return false;
    return true;
  });
  list.sort(function (a, b) { return b.lastSeenMs - a.lastSeenMs; });
  var pages = Object.keys(MSGR_PAGES).map(function (id) {
    return { id: id, name: MSGR_PAGES[id], connected: !!msgrPageToken_(id) };
  });
  return {
    ok: true,
    contacts: list.slice(0, limit),
    count: list.length,
    stats: stats,
    pages: pages,
    statuses: MSGR_STATUSES,
    team: msgrTeamNames_()
  };
}

function inboxThread_(e) {
  var pageId = param_(e, 'PageId');
  var psid = param_(e, 'PSID');
  if (!pageId || !psid) return { ok: false, error: 'MISSING_FIELDS' };
  var values = msgrMessagesSheet_().getDataRange().getValues();
  var msgs = [];
  for (var i = values.length - 1; i >= 1 && msgs.length < 150; i--) {
    var r = values[i];
    if (String(r[2]) !== psid || String(r[1]) !== pageId) continue;
    msgs.push({ time: formatCell_(r[0]), direction: String(r[3] || ''), text: String(r[4] || ''), by: String(r[6] || ''), attachments: msgrAttachments_(r[7]) });
  }
  msgs.reverse();
  var sh = msgrContactsSheet_();
  var cValues = sh.getDataRange().getValues();
  var rowNum = msgrFindContactRow_(cValues, pageId, psid);
  var contact = null;
  if (rowNum !== -1) {
    if (parseInt(cValues[rowNum - 1][MC.UNREAD - 1], 10)) sh.getRange(rowNum, MC.UNREAD).setValue(0);
    cValues[rowNum - 1][MC.UNREAD - 1] = 0;
    // Message reads must never wait for the external profile API.
    contact = msgrContactFromRow_(cValues[rowNum - 1]);
  }
  return { ok: true, messages: msgs, contact: contact };
}

function inboxProfile_(e) {
  var pageId = param_(e, 'PageId');
  var psid = param_(e, 'PSID');
  if (!pageId || !psid) return { ok: false, error: 'MISSING_FIELDS' };
  var sh = msgrContactsSheet_();
  var values = sh.getDataRange().getValues();
  var rowNum = msgrFindContactRow_(values, pageId, psid);
  if (rowNum === -1) return { ok: false, error: 'NOT_FOUND' };
  var profile = getMessengerProfile_(psid, pageId);
  var row = values[rowNum - 1];
  if (profile.name && row[MC.NAME - 1] !== profile.name) { row[MC.NAME - 1] = profile.name; sh.getRange(rowNum, MC.NAME).setValue(profile.name); }
  if (profile.profile_pic && row[MC.PROFILE - 1] !== profile.profile_pic) { row[MC.PROFILE - 1] = profile.profile_pic; sh.getRange(rowNum, MC.PROFILE).setValue(profile.profile_pic); }
  return { ok: true, contact: msgrContactFromRow_(row) };
}

function inboxReply_(e, session) {
  var pageId = param_(e, 'PageId');
  var psid = param_(e, 'PSID');
  var text = String(param_(e, 'Text') || '').trim();
  if (!pageId || !psid || !text) return { ok: false, error: 'MISSING_FIELDS', message: 'মেসেজ লিখুন।' };
  if (text.length > 2000) return { ok: false, error: 'TOO_LONG', message: 'মেসেজ ২০০০ অক্ষরের বেশি হতে পারবে না।' };
  var token = msgrPageToken_(pageId);
  if (!token) {
    return { ok: false, error: 'NO_PAGE_TOKEN', message: 'এই Page-এর token সেট করা নেই (Script Properties → MSGR_PAGE_TOKEN_' + pageId + ')।' };
  }
  var res = UrlFetchApp.fetch('https://graph.facebook.com/v25.0/me/messages?access_token=' + encodeURIComponent(token), {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text: text } }),
    muteHttpExceptions: true
  });
  var body = {};
  try { body = JSON.parse(res.getContentText()) || {}; } catch (err) {}
  if (res.getResponseCode() !== 200 || !body.message_id) {
    var fbErr = body.error || {};
    var msg = fbErr.message || ('HTTP ' + res.getResponseCode());
    if (fbErr.error_subcode === 2018278 || fbErr.code === 10) {
      msg = 'শেষ মেসেজের ২৪ ঘণ্টা পার হয়ে গেছে — Meta নিয়মে এখন এখান থেকে উত্তর যাবে না। Business Suite থেকে উত্তর দিন।';
    }
    return { ok: false, error: 'SEND_FAILED', message: msg };
  }
  CacheService.getScriptCache().put('msgr_mid_' + body.message_id, '1', 21600);
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    msgrRecordMessage_(pageId, psid, 'out', text, body.message_id, session.name || session.email || 'Admin', '');
  } finally {
    lock.releaseLock();
  }
  return { ok: true, messageId: body.message_id };
}

function inboxUpdate_(e, session) {
  var pageId = param_(e, 'PageId');
  var psid = param_(e, 'PSID');
  if (!pageId || !psid) return { ok: false, error: 'MISSING_FIELDS' };
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = msgrContactsSheet_();
    var values = sh.getDataRange().getValues();
    var rowNum = msgrFindContactRow_(values, pageId, psid);
    if (rowNum === -1) return { ok: false, error: 'NOT_FOUND', message: 'কথোপকথন পাওয়া যায়নি।' };
    var row = values[rowNum - 1];
    while (row.length < MC_HEADERS.length) row.push('');
    var params = getParams_(e);
    if ('Status' in params) {
      if (MSGR_STATUSES.indexOf(params.Status) === -1) return { ok: false, error: 'BAD_STATUS' };
      row[MC.STATUS - 1] = params.Status;
    }
    if ('AssignedTo' in params) row[MC.ASSIGNED - 1] = String(params.AssignedTo).slice(0, 80);
    if ('OrderId' in params) row[MC.ORDER_ID - 1] = String(params.OrderId).slice(0, 60);
    if ('OrderValue' in params) row[MC.ORDER_VALUE - 1] = String(params.OrderValue).slice(0, 20);
    if ('Notes' in params) row[MC.NOTES - 1] = String(params.Notes).slice(0, 500);
    var purchase = null;
    var won = row[MC.STATUS - 1] === MSGR_CONFIRMED_STATUS || row[MC.STATUS - 1] === MSGR_DELIVERED_STATUS;
    var value = parseOrderValue_(row[MC.ORDER_VALUE - 1]);
    // Send the Purchase event to Meta once per conversation, when it is won and has a value.
    if (won && value > 0 && !row[MC.PURCHASE_SENT - 1]) {
      purchase = sendMessengerPurchase_(psid, value, row[MC.ORDER_ID - 1] || (pageId + '_' + psid), pageId);
      if (purchase.ok) row[MC.PURCHASE_SENT - 1] = new Date();
    }
    sh.getRange(rowNum, 1, 1, MC_HEADERS.length).setValues([row.slice(0, MC_HEADERS.length)]);
    return {
      ok: true,
      contact: msgrContactFromRow_(row),
      purchase: purchase ? { ok: purchase.ok, message: purchase.ok ? 'Meta-তে Purchase পাঠানো হয়েছে।' : 'Meta-তে Purchase পাঠানো যায়নি: ' + String(purchase.body || purchase.code || '').slice(0, 200) } : null
    };
  } finally {
    lock.releaseLock();
  }
}

// ================= Abandoned Cart Recovery =================
function ensureAbandonedCartsSheet_() {
  return ensureSheet_('AbandonedCarts', ['Phone', 'Name', 'CartSummary', 'CartValue', 'CreatedAt', 'UpdatedAt', 'Status']);
}

function findAbandonedCartRow_(sheet, phone) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === String(phone).trim()) return i + 1;
  }
  return -1;
}

function saveCartCheckpoint_(e) {
  var phone = normalizePhone_(param_(e, 'Phone'));
  if (!phone || phone.length < 10) return { ok: false, error: 'INVALID_PHONE' };
  try { rateLimit_('cart_' + phone); } catch (rl) { return { ok: false, error: 'RATE_LIMIT' }; }
  var name = String(param_(e, 'Name') || '').trim();
  var summary = String(param_(e, 'CartSummary') || '').trim().slice(0, 500);
  var value = Number(param_(e, 'CartValue')) || 0;
  if (!summary || value <= 0) return { ok: false, error: 'EMPTY_CART' };
  var sheet = ensureAbandonedCartsSheet_();
  var now = new Date();
  var row = findAbandonedCartRow_(sheet, phone);
  if (row === -1) {
    appendRow_(sheet, [phone, name, summary, value, now, now, 'open']);
  } else {
    var createdAt = sheet.getRange(row, 5).getValue();
    sheet.getRange(row, 2, 1, 6).setValues([[name, summary, value, createdAt, now, 'open']]);
  }
  return { ok: true };
}

function markCartConverted_(phone) {
  try {
    var p = normalizePhone_(phone);
    if (!p) return;
    var sheet = ensureAbandonedCartsSheet_();
    var row = findAbandonedCartRow_(sheet, p);
    if (row !== -1) sheet.getRange(row, 7).setValue('converted');
  } catch (err) {}
}

// ================= Back-in-stock waitlist =================
function ensureStockWaitlistSheet_() {
  return ensureSheet_('StockWaitlist', ['ProductId', 'ProductName', 'Contact', 'IsEmail', 'CreatedAt', 'Notified']);
}

function saveBackInStockRequest_(e) {
  var productId = String(param_(e, 'ProductId') || '').trim();
  var productName = String(param_(e, 'ProductName') || '').trim();
  var contactRaw = String(param_(e, 'Contact') || '').trim();
  var contact = normalizeSubscribeContact_(contactRaw);
  if (!productId) return { ok: false, error: 'MISSING_PRODUCT' };
  if (!contact) return { ok: false, error: 'INVALID_CONTACT', message: 'সঠিক ইমেইল বা মোবাইল (01XXXXXXXXX) দিন।' };
  try { rateLimit_('waitlist_' + contact.slice(0, 40)); } catch (rl) { return { ok: false, error: 'RATE_LIMIT' }; }
  var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  var sheet = ensureStockWaitlistSheet_();
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === productId && String(data[i][2] || '').trim().toLowerCase() === contact.toLowerCase()) {
      return { ok: true, message: 'Already on waitlist', duplicate: true };
    }
  }
  appendRow_(sheet, [productId, productName, contact, isEmail ? 'yes' : '', new Date(), '']);
  return { ok: true, message: 'জানানো হবে' };
}

function notifyBackInStockWaitlist_(productId) {
  try {
    var sheet = ensureStockWaitlistSheet_();
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (String(r[0] || '').trim() !== String(productId).trim()) continue;
      if (String(r[5] || '').trim()) continue;
      // Size requests need variant availability; product-level restock is insufficient.
      if (String(r[6] || '').trim()) continue;
      var isEmail = String(r[3] || '') === 'yes';
      if (isEmail) {
        try {
          MailApp.sendEmail({
            to: String(r[2]),
            subject: 'সুখবর! ' + (r[1] || 'পণ্যটি') + ' আবার স্টকে এসেছে — Muslim Abaya',
            body: 'আসসালামু আলাইকুম,\n\nআপনি যে পণ্যটির জন্য অপেক্ষা করছিলেন (' + (r[1] || productId) + ') সেটি আবার স্টকে এসেছে।\n\nএখনই অর্ডার করতে ভিজিট করুন: https://muslimabaya.com/\n\nধন্যবাদ,\nMuslim Abaya'
          });
          sheet.getRange(i + 1, 6).setValue('emailed:' + new Date());
        } catch (mailErr) {
          sheet.getRange(i + 1, 6).setValue('email_failed');
        }
      } else {
        sheet.getRange(i + 1, 6).setValue('pending-whatsapp');
      }
    }
  } catch (err) {}
}

// ================= Reorder discount on delivery =================
function ensureReorderOffersSheet_() {
  return ensureSheet_('ReorderOffers', ['OrderId', 'Phone', 'Name', 'CouponCode', 'CreatedAt', 'Contacted']);
}

function generateReorderCouponCode_(phone) {
  var suffix = String(phone || '').slice(-4) || String(Math.floor(1000 + Math.random() * 9000));
  return 'REORDER' + suffix + Math.floor(Math.random() * 90 + 10);
}

function createReorderOffer_(orderId, phone, name) {
  if (!phone) return;
  try {
    var couponSheet = getCouponsSheet_();
    var code = generateReorderCouponCode_(phone);
    var expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    appendRow_(couponSheet, [code, 'percent', 10, 0, expiry, 1, 0, true]);
    var offersSheet = ensureReorderOffersSheet_();
    appendRow_(offersSheet, [orderId || '', phone, name || '', code, new Date(), '']);
  } catch (err) {}
}

// ================= Admin: Growth dashboard data =================
function getAdminGrowthData_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var out = { ok: true, abandonedCarts: [], stockWaitlist: [], reorderOffers: [] };
  try {
    var cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    var cSheet = ensureAbandonedCartsSheet_();
    var cData = cSheet.getDataRange().getValues();
    for (var i = 1; i < cData.length; i++) {
      var r = cData[i];
      if (String(r[6] || '') !== 'open') continue;
      var updated = r[5] instanceof Date ? r[5] : new Date(r[5]);
      if (updated < cutoff) continue;
      out.abandonedCarts.push({ phone: String(r[0] || ''), name: String(r[1] || ''), summary: String(r[2] || ''), value: Number(r[3]) || 0, updatedAt: updated.toISOString() });
    }
  } catch (err1) {}
  try {
    var wSheet = ensureStockWaitlistSheet_();
    var wData = wSheet.getDataRange().getValues();
    for (var j = 1; j < wData.length; j++) {
      var wr = wData[j];
      var notified = String(wr[5] || '');
      if (notified.indexOf('emailed') === 0 || notified === 'dismissed') continue;
      out.stockWaitlist.push({ productId: String(wr[0] || ''), productName: String(wr[1] || ''), variant: String(wr[6] || ''), contact: String(wr[2] || ''), isEmail: String(wr[3] || '') === 'yes', notified: notified });
    }
  } catch (err2) {}
  try {
    var rSheet = ensureReorderOffersSheet_();
    var rData = rSheet.getDataRange().getValues();
    for (var k = rData.length - 1; k >= 1 && out.reorderOffers.length < 50; k--) {
      var rr = rData[k];
      if (String(rr[5] || '') === 'done') continue;
      out.reorderOffers.push({ orderId: String(rr[0] || ''), phone: String(rr[1] || ''), name: String(rr[2] || ''), coupon: String(rr[3] || ''), createdAt: rr[4] instanceof Date ? rr[4].toISOString() : String(rr[4] || '') });
    }
  } catch (err3) {}
  return out;
}

function markGrowthItemDone_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var kind = String(param_(e, 'Kind') || '');
  var key = String(param_(e, 'Key') || '');
  try {
    if (kind === 'cart') {
      var cSheet = ensureAbandonedCartsSheet_();
      var row = findAbandonedCartRow_(cSheet, key);
      if (row !== -1) cSheet.getRange(row, 7).setValue('dismissed');
    } else if (kind === 'waitlist') {
      var wSheet = ensureStockWaitlistSheet_();
      var wData = wSheet.getDataRange().getValues();
      for (var i = 1; i < wData.length; i++) {
        if ((String(wData[i][0] || '') + '|' + String(wData[i][2] || '') + '|' + String(wData[i][6] || '')) === key) { wSheet.getRange(i + 1, 6).setValue('dismissed'); break; }
      }
    } else if (kind === 'reorder') {
      var rSheet = ensureReorderOffersSheet_();
      var rData = rSheet.getDataRange().getValues();
      for (var j = 1; j < rData.length; j++) {
        if (String(rData[j][0] || '') === key) { rSheet.getRange(j + 1, 6).setValue('done'); break; }
      }
    }
  } catch (err) {}
  return { ok: true };
}

/* ============================================================
 * STOCK ANALYTICS v2 — ভ্যারিয়েন্ট-ভিত্তিক স্টক, অডিট ও অ্যানালিটিক্স
 * (নতুন কোড — পুরনো Stock শীট বা কোনো অর্ডার ডেটা মোছা হয়নি)
 * ============================================================ */

var STOCK_LOW_DEFAULT_THRESHOLD_ = 5;

function ensureStockVariantsSheet_() {
  return ensureSheet_('StockVariants', ['Product ID', 'Product Name', 'Category', 'Variant', 'Tracked', 'Available', 'Reserved', 'LowStockThreshold', 'UpdatedAt', 'UpdatedBy']);
}

function ensureStockLedgerSheet_() {
  return ensureSheet_('StockLedger', ['Timestamp', 'Product ID', 'Variant', 'ChangeType', 'QtyBefore', 'QtyAfter', 'ReservedBefore', 'ReservedAfter', 'Reason', 'OrderId', 'Admin']);
}

function ensureOnlineOrderStockStageHeader_(sheet) {
  try {
    var existing = sheet.getRange(1, onlineOrderColumn_(sheet, 36)).getValue();
    if (!existing) sheet.getRange(1, onlineOrderColumn_(sheet, 36)).setValue('StockStage');
  } catch (err) {}
}

function ensureOnlineOrderSourceHeader_(sheet) {
  try {
    var existing = sheet.getRange(1, onlineOrderColumn_(sheet, 37)).getValue();
    if (!existing) sheet.getRange(1, onlineOrderColumn_(sheet, 37)).setValue('Source');
  } catch (err) {}
}

function normStockVariant_(v) {
  return String(v || '').replace(/\s+/g, ' ').trim();
}

function stockVariantCompareKey_(v) {
  return normStockVariant_(v).toLowerCase();
}

function findStockVariantRowIndex_(data, productId, variant) {
  var pid = String(productId || '').trim();
  var vv = stockVariantCompareKey_(variant);
  var i;
  for (i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === pid && stockVariantCompareKey_(data[i][3]) === vv) return i + 1;
  }
  return -1;
}

function getOrCreateStockVariantRow_(sheet, productId, productName, variant, category) {
  var data = sheet.getDataRange().getValues();
  var row = findStockVariantRowIndex_(data, productId, variant);
  if (row !== -1) return row;
  var now = new Date();
  appendRow_(sheet, [String(productId).trim(), String(productName || ''), String(category || ''), normStockVariant_(variant), false, 0, 0, '', now, 'system']);
  return sheet.getLastRow();
}

function readStockVariantRow_(sheet, row) {
  var r = sheet.getRange(row, 1, 1, 10).getValues()[0];
  return {
    row: row,
    productId: String(r[0] || ''),
    productName: String(r[1] || ''),
    category: String(r[2] || ''),
    variant: String(r[3] || ''),
    tracked: (String(r[4]).toUpperCase() === 'TRUE') || (r[4] === true),
    available: Number(r[5]) || 0,
    reserved: Number(r[6]) || 0,
    threshold: (r[7] === '' || r[7] === null || typeof r[7] === 'undefined') ? null : Number(r[7]),
    updatedAt: r[8],
    updatedBy: String(r[9] || '')
  };
}

function writeStockVariantRow_(sheet, row, fields) {
  if (typeof fields.tracked !== 'undefined') sheet.getRange(row, 5).setValue(!!fields.tracked);
  if (typeof fields.available !== 'undefined') sheet.getRange(row, 6).setValue(Math.max(0, Number(fields.available) || 0));
  if (typeof fields.reserved !== 'undefined') sheet.getRange(row, 7).setValue(Math.max(0, Number(fields.reserved) || 0));
  if (typeof fields.threshold !== 'undefined') sheet.getRange(row, 8).setValue(fields.threshold === null ? '' : Number(fields.threshold));
  if (typeof fields.productName !== 'undefined' && fields.productName) sheet.getRange(row, 2).setValue(fields.productName);
  if (typeof fields.category !== 'undefined' && fields.category) sheet.getRange(row, 3).setValue(fields.category);
  sheet.getRange(row, 9).setValue(new Date());
  if (typeof fields.updatedBy !== 'undefined') sheet.getRange(row, 10).setValue(fields.updatedBy);
}

function appendStockLedger_(entry) {
  try {
    var sheet = ensureStockLedgerSheet_();
    appendRow_(sheet, [
      new Date(),
      entry.productId || '',
      entry.variant || '',
      entry.changeType || '',
      entry.qtyBefore != null ? entry.qtyBefore : '',
      entry.qtyAfter != null ? entry.qtyAfter : '',
      entry.reservedBefore != null ? entry.reservedBefore : '',
      entry.reservedAfter != null ? entry.reservedAfter : '',
      entry.reason || '',
      entry.orderId || '',
      entry.admin || 'system'
    ]);
  } catch (ledgerErr) {}
}

/**
 * একটি ভ্যারিয়েন্টের Available/Reserved পরিবর্তন করে এবং লেজারে হিস্ট্রি রাখে।
 * deltaAvailable/deltaReserved পজিটিভ বা নেগেটিভ হতে পারে। কখনো ০-এর নিচে নামবে না।
 */
/**
 * এই ফাংশন নিজে কোনো লক নেয় না — যেসব জায়গা থেকে এটা কল হয় (reserve/release/finalize
 * হেল্পারগুলোর মাধ্যমে, applyStockLifecycleForStatusChange_-এর ভেতর থেকে) সেখানে লক আগে
 * থেকেই ধরা থাকে। একই এক্সিকিউশনে দ্বিতীয়বার LockService লক নেওয়া (nested lock) Apps
 * Script-এ ডেডলক/টাইমআউট ঘটাতে পারে, তাই ইচ্ছাকৃতভাবে এখানে লক নেওয়া বাদ দেওয়া হয়েছে।
 * সরাসরি বাইরে থেকে কল করলে আগে LockService.getScriptLock().waitLock() করে নিন।
 */
function mutateStockVariant_(opts) {
  var sheet = ensureStockVariantsSheet_();
  var row = getOrCreateStockVariantRow_(sheet, opts.productId, opts.productName, opts.variant, opts.category);
  var before = readStockVariantRow_(sheet, row);
  var nextAvailable = Math.max(0, before.available + (opts.deltaAvailable || 0));
  var nextReserved = Math.max(0, before.reserved + (opts.deltaReserved || 0));
  var fields = { available: nextAvailable, reserved: nextReserved, updatedBy: opts.admin || 'system' };
  if (opts.setTracked) fields.tracked = true;
  if (opts.productName) fields.productName = opts.productName;
  if (opts.category) fields.category = opts.category;
  if (typeof opts.threshold !== 'undefined') fields.threshold = opts.threshold;
  writeStockVariantRow_(sheet, row, fields);
  try { queueLowStockAlert_(before, nextAvailable, !!(before.tracked || opts.setTracked)); } catch (lowErr) {}
  appendStockLedger_({
    productId: before.productId || opts.productId,
    variant: before.variant || opts.variant,
    changeType: opts.changeType,
    qtyBefore: before.available,
    qtyAfter: nextAvailable,
    reservedBefore: before.reserved,
    reservedAfter: nextReserved,
    reason: opts.reason || '',
    orderId: opts.orderId || '',
    admin: opts.admin || 'system'
  });
  return { before: before, after: { available: nextAvailable, reserved: nextReserved } };
}

var LOW_STOCK_DEFAULT_THRESHOLD_ = 2;
var LOW_STOCK_QUEUE_KEY_ = 'LOW_STOCK_ALERT_QUEUE';

/** Queues an alert when a tracked size crosses from above its threshold to at/below it. Cheap; no network. */
function queueLowStockAlert_(before, nextAvailable, tracked) {
  if (!tracked || !before) return false;
  var threshold = before.threshold == null || isNaN(before.threshold) ? LOW_STOCK_DEFAULT_THRESHOLD_ : before.threshold;
  if (!(before.available > threshold && nextAvailable <= threshold)) return false;
  var props = PropertiesService.getScriptProperties();
  var queue = [];
  try { queue = JSON.parse(props.getProperty(LOW_STOCK_QUEUE_KEY_) || '[]') || []; } catch (e) { queue = []; }
  var key = before.productId + '|' + before.variant;
  queue = queue.filter(function (q) { return q.key !== key; });
  queue.push({ key: key, name: before.productName || before.productId, variant: before.variant || 'সব সাইজ', left: nextAvailable, threshold: threshold });
  props.setProperty(LOW_STOCK_QUEUE_KEY_, JSON.stringify(queue.slice(-30)));
  return true;
}

/** Sends queued low-stock alerts (Telegram + email). Called from the 15-minute trigger. */
function flushLowStockAlerts_() {
  var props = PropertiesService.getScriptProperties();
  var raw = props.getProperty(LOW_STOCK_QUEUE_KEY_);
  if (!raw) return 0;
  var queue = [];
  try { queue = JSON.parse(raw) || []; } catch (e) {}
  props.deleteProperty(LOW_STOCK_QUEUE_KEY_);
  if (!queue.length) return 0;
  var lines = queue.map(function (q) {
    return '• ' + q.name + ' — ' + q.variant + ': ' + (q.left > 0 ? q.left + ' পিস বাকি' : 'স্টক শেষ');
  });
  var msg = '📦 স্টক কমে গেছে (' + queue.length + 'টি সাইজ)\n\n' + lines.join('\n') +
    '\n\nস্টক বাড়াতে: muslimabaya.com/stock-analytics';
  if (typeof sendAdminAndTelegramNotification_ === 'function') sendAdminAndTelegramNotification_('Muslim Abaya — স্টক কমে গেছে', msg);
  return queue.length;
}

/** কার্ট-আইটেম থেকে variant key বের করা (size অগ্রাধিকার পায়, না থাকলে color) */
function cartItemVariantKey_(item) {
  var size = String((item && item.size) || '').trim();
  if (size) return size;
  var color = String((item && item.color) || '').trim();
  if (color) return color;
  return '';
}

function stockRowIsTracked_(row) {
  return !!row && ((String(row[4]).toUpperCase() === 'TRUE') || row[4] === true);
}

function stockRequirementsForCart_(cartItems) {
  var byKey = Object.create(null);
  var out = [];
  (cartItems || []).forEach(function (item) {
    var productId = String((item && item.id) || '').trim();
    var qty = parseInt(item && item.qty, 10) || 0;
    if (!productId || qty <= 0) return;
    var variant = normStockVariant_(cartItemVariantKey_(item));
    var key = productId + '\u001f' + stockVariantCompareKey_(variant);
    var req = byKey[key];
    if (!req) {
      req = byKey[key] = {
        productId: productId,
        productName: String((item && item.name) || productId),
        category: String((item && item.category) || ''),
        variant: variant,
        qty: 0
      };
      out.push(req);
    }
    req.qty += qty;
  });
  return out;
}

/**
 * Flexible stock: a StockVariants row with an empty Variant is the product's
 * "all sizes" pool. A cart line whose exact size has no row uses that pool,
 * so the owner can keep one total per product, per-size counts, or a mix,
 * and change between them at any time. Lines that resolve to the same row are
 * merged so availability is checked against the combined quantity.
 */
function resolveStockRequirementsForCart_(cartItems, data) {
  data = data || [];
  var merged = Object.create(null);
  var out = [];
  stockRequirementsForCart_(cartItems).forEach(function (req) {
    var variant = req.variant;
    if (variant && findStockVariantRowIndex_(data, req.productId, variant) === -1 &&
        findStockVariantRowIndex_(data, req.productId, '') !== -1) {
      variant = '';
    }
    var key = req.productId + '\u001f' + stockVariantCompareKey_(variant);
    var target = merged[key];
    if (!target) {
      target = merged[key] = {
        productId: req.productId,
        productName: req.productName,
        category: req.category,
        variant: variant,
        qty: 0
      };
      out.push(target);
    }
    target.qty += req.qty;
  });
  return out;
}

function legacyProductStockRequirements_(cartItems, variantData, legacyData) {
  variantData = variantData || [];
  legacyData = legacyData || [];
  var hasTrackedVariants = Object.create(null);
  for (var i = 1; i < variantData.length; i++) {
    var variantRow = variantData[i];
    var variantProductId = String(variantRow[0] || '').trim();
    if (variantProductId && stockRowIsTracked_(variantRow)) hasTrackedVariants[variantProductId] = true;
  }
  var legacyRows = Object.create(null);
  for (var j = 1; j < legacyData.length; j++) {
    var legacyProductId = String(legacyData[j][0] || '').trim();
    if (legacyProductId) legacyRows[legacyProductId] = { rowIndex: j + 1, row: legacyData[j] };
  }
  var byProduct = Object.create(null);
  stockRequirementsForCart_(cartItems).forEach(function (line) {
    if (hasTrackedVariants[line.productId] || !legacyRows[line.productId]) return;
    var req = byProduct[line.productId];
    if (!req) {
      var legacy = legacyRows[line.productId];
      req = byProduct[line.productId] = {
        productId: line.productId,
        productName: String(legacy.row[1] || line.productName || line.productId),
        rowIndex: legacy.rowIndex,
        available: Number(legacy.row[2]) || 0,
        qty: 0
      };
    }
    req.qty += line.qty;
  });
  return Object.keys(byProduct).map(function (id) { return byProduct[id]; });
}

function trackedStockRequirements_(cartItems, data, strictMissingVariant) {
  data = data || [];
  var trackedProducts = Object.create(null);
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var pid = String(row[0] || '').trim();
    if (pid && stockRowIsTracked_(row)) trackedProducts[pid] = true;
  }
  var requirements = [];
  resolveStockRequirementsForCart_(cartItems, data).forEach(function (req) {
    var rowIndex = findStockVariantRowIndex_(data, req.productId, req.variant);
    if (rowIndex === -1) {
      if (strictMissingVariant && trackedProducts[req.productId]) {
        var missing = new Error('VARIANT_NOT_TRACKED:' + req.productName + (req.variant ? ' (' + req.variant + ')' : ''));
        missing.isStockError = true;
        throw missing;
      }
      return; // এ পণ্যে কোনো tracked variant নেই — legacy/untracked catalog item
    }
    var stockRow = data[rowIndex - 1];
    if (!stockRowIsTracked_(stockRow)) {
      if (strictMissingVariant && trackedProducts[req.productId]) {
        var untracked = new Error('VARIANT_NOT_TRACKED:' + req.productName + (req.variant ? ' (' + req.variant + ')' : ''));
        untracked.isStockError = true;
        throw untracked;
      }
      return;
    }
    req.rowIndex = rowIndex;
    req.available = Number(stockRow[5]) || 0;
    req.reserved = Number(stockRow[6]) || 0;
    requirements.push(req);
  });
  return requirements;
}

function assertStockRequirementsAvailable_(requirements) {
  (requirements || []).forEach(function (req) {
    if (req.available < req.qty) {
      var label = req.productName + (req.variant ? ' (' + req.variant + ')' : '') +
        ' — Available ' + req.available + ', চাওয়া হয়েছে ' + req.qty;
      var err = new Error('OUT_OF_STOCK:' + label);
      err.isStockError = true;
      throw err;
    }
  });
}

function reservedStockRequirements_(cartItems, data) {
  data = data || [];
  var requirements = [];
  resolveStockRequirementsForCart_(cartItems, data).forEach(function (req) {
    var rowIndex = findStockVariantRowIndex_(data, req.productId, req.variant);
    if (rowIndex === -1) return;
    var row = data[rowIndex - 1];
    var tracked = stockRowIsTracked_(row);
    var reserved = Number(row[6]) || 0;
    if (!tracked && reserved <= 0) return;
    req.rowIndex = rowIndex;
    req.tracked = tracked;
    req.available = Number(row[5]) || 0;
    req.reserved = reserved;
    requirements.push(req);
  });
  return requirements;
}

function assertStockRequirementsReserved_(requirements) {
  (requirements || []).forEach(function (req) {
    if (req.reserved < req.qty) {
      var label = req.productName + (req.variant ? ' (' + req.variant + ')' : '');
      var err = new Error('STOCK_LEDGER_MISMATCH:' + label);
      err.isStockError = true;
      throw err;
    }
  });
}

/**
 * নতুন অর্ডার তৈরির সময় — যেসব ভ্যারিয়েন্ট ট্র্যাক করা হয় ও স্টক শেষ, তাতে অর্ডার আটকায়।
 * ট্র্যাক না করা ভ্যারিয়েন্টে কোনো বাধা নেই।
 */
function assertStockAvailableForOrder_(cartItems) {
  if (!cartItems || !cartItems.length) return;
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(15000);
    locked = true;
    var sheet = ensureStockVariantsSheet_();
    var data = sheet.getDataRange().getValues();
    assertStockRequirementsAvailable_(trackedStockRequirements_(cartItems, data, true));
    var legacySheet = ensureStockSheet_();
    legacyProductStockRequirements_(cartItems, data, legacySheet.getDataRange().getValues()).forEach(function (req) {
      if (req.available < req.qty) {
        var out = new Error('OUT_OF_STOCK:' + req.productName + ' — Available ' + req.available + ', চাওয়া হয়েছে ' + req.qty);
        out.isStockError = true;
        throw out;
      }
    });
  } catch (stockCheckErr) {
    if (stockCheckErr && stockCheckErr.isStockError) throw stockCheckErr;
    var unavailable = new Error('STOCK_CHECK_UNAVAILABLE');
    unavailable.isStockError = true;
    throw unavailable;
  } finally {
    if (locked) lock.releaseLock();
  }
}

/** Confirmed → রিজার্ভ করা */
function reserveStockForOrderItems_(cartItems, orderId, admin) {
  // No live-stock switch check here: an order placed before a product was switched off must still be
  // confirmable. New orders are stopped at intake (handleOnlineOrderPost_).
  var sheet = ensureStockVariantsSheet_();
  var data = sheet.getDataRange().getValues();
  var requirements = trackedStockRequirements_(cartItems, data, true);
  assertStockRequirementsAvailable_(requirements);
  var legacySheet = ensureStockSheet_();
  var legacyData = legacySheet.getDataRange().getValues();
  var legacyRequirements = legacyProductStockRequirements_(cartItems, data, legacyData);
  legacyRequirements.forEach(function (req) {
    if (req.available < req.qty) {
      var err = new Error('OUT_OF_STOCK:' + req.productName + ' — Available ' + req.available + ', চাওয়া হয়েছে ' + req.qty);
      err.isStockError = true;
      throw err;
    }
  });
  var applied = [];
  var appliedLegacy = [];
  try {
    requirements.forEach(function (req) {
      mutateStockVariant_({
        productId: req.productId,
        productName: req.productName,
        category: req.category,
        variant: req.variant,
        deltaAvailable: -req.qty,
        deltaReserved: req.qty,
        changeType: 'RESERVE',
        reason: (admin === 'order-intake' ? 'নতুন অর্ডার — Order ' : 'অর্ডার কনফার্ম — Order ') + orderId,
        orderId: orderId,
        admin: admin || 'system'
      });
      applied.push(req);
    });
    legacyRequirements.forEach(function (req) {
      var row = req.rowIndex;
      var before = Number(legacySheet.getRange(row, 3).getValue()) || 0;
      var after = before - req.qty;
      if (after < 0) {
        var out = new Error('OUT_OF_STOCK:' + req.productName + ' — Available ' + before + ', চাওয়া হয়েছে ' + req.qty);
        out.isStockError = true;
        throw out;
      }
      legacySheet.getRange(row, 3).setValue(after);
      legacySheet.getRange(row, 4).setValue(new Date());
      appliedLegacy.push({ req: req, before: before, after: after });
      appendStockLedger_({
        productId: req.productId,
        variant: '',
        changeType: 'RESERVE_PRODUCT_TOTAL',
        qtyBefore: before,
        qtyAfter: after,
        reservedBefore: 0,
        reservedAfter: 0,
        reason: 'নতুন/কনফার্ম অর্ডার — product-total stock, Order ' + orderId,
        orderId: orderId,
        admin: admin || 'system'
      });
    });
  } catch (reserveErr) {
    for (var j = appliedLegacy.length - 1; j >= 0; j--) {
      var legacyApplied = appliedLegacy[j];
      try {
        legacySheet.getRange(legacyApplied.req.rowIndex, 3).setValue(legacyApplied.before);
        legacySheet.getRange(legacyApplied.req.rowIndex, 4).setValue(new Date());
        appendStockLedger_({
          productId: legacyApplied.req.productId,
          variant: '',
          changeType: 'RESERVE_ROLLBACK_PRODUCT_TOTAL',
          qtyBefore: legacyApplied.after,
          qtyAfter: legacyApplied.before,
          reservedBefore: 0,
          reservedAfter: 0,
          reason: 'অর্ডার তৈরি ব্যর্থ — Order ' + orderId,
          orderId: orderId,
          admin: 'system'
        });
      } catch (legacyRollbackErr) {}
    }
    for (var i = applied.length - 1; i >= 0; i--) {
      var req = applied[i];
      try {
        mutateStockVariant_({
          productId: req.productId,
          productName: req.productName,
          category: req.category,
          variant: req.variant,
          deltaAvailable: req.qty,
          deltaReserved: -req.qty,
          changeType: 'RESERVE_ROLLBACK',
          reason: 'অর্ডার তৈরি ব্যর্থ — Order ' + orderId,
          orderId: orderId,
          admin: 'system'
        });
      } catch (rollbackErr) {}
    }
    throw reserveErr;
  }
  return requirements.length + legacyRequirements.length;
}

/** Cancelled → রিজার্ভ ছাড়া (যদি আগে রিজার্ভ করা থাকে) */
function releaseStockForOrderItems_(cartItems, orderId, admin) {
  var sheet = ensureStockVariantsSheet_();
  var variantData = sheet.getDataRange().getValues();
  var requirements = reservedStockRequirements_(cartItems, variantData);
  assertStockRequirementsReserved_(requirements);
  requirements.forEach(function (req) {
    mutateStockVariant_({
      productId: req.productId,
      productName: req.productName,
      category: req.category,
      variant: req.variant,
      deltaAvailable: req.tracked ? req.qty : 0,
      deltaReserved: -req.qty,
      changeType: req.tracked ? 'RELEASE' : 'RELEASE_UNTRACKED_RESERVATION',
      reason: 'অর্ডার বাতিল/ফেরত — Order ' + orderId,
      orderId: orderId,
      admin: admin || 'system'
    });
  });

  var legacySheet = ensureStockSheet_();
  var legacyRequirements = legacyProductStockRequirements_(cartItems, variantData, legacySheet.getDataRange().getValues());
  legacyRequirements.forEach(function (req) {
    var current = Number(legacySheet.getRange(req.rowIndex, 3).getValue()) || 0;
    var next = current + req.qty;
    legacySheet.getRange(req.rowIndex, 3).setValue(next);
    legacySheet.getRange(req.rowIndex, 4).setValue(new Date());
    appendStockLedger_({
      productId: req.productId,
      variant: '',
      changeType: 'RELEASE_PRODUCT_TOTAL',
      qtyBefore: current,
      qtyAfter: next,
      reservedBefore: 0,
      reservedAfter: 0,
      reason: 'অর্ডার বাতিল/ফেরত — product-total stock, Order ' + orderId,
      orderId: orderId,
      admin: admin || 'system'
    });
  });
}

/** Delivered → বিক্রি চূড়ান্ত (রিজার্ভ থেকে সরানো, Available আগেই বাদ গেছে) */
function finalizeSoldStockForOrderItems_(cartItems, orderId, admin) {
  var sheet = ensureStockVariantsSheet_();
  var requirements = reservedStockRequirements_(cartItems, sheet.getDataRange().getValues());
  assertStockRequirementsReserved_(requirements);
  requirements.forEach(function (req) {
    mutateStockVariant_({
      productId: req.productId,
      productName: req.productName,
      category: req.category,
      variant: req.variant,
      deltaAvailable: 0,
      deltaReserved: -req.qty,
      changeType: req.tracked ? 'SELL' : 'SELL_UNTRACKED_RESERVATION',
      reason: 'ডেলিভারি সম্পন্ন — Order ' + orderId,
      orderId: orderId,
      admin: admin || 'system'
    });
  });
}

/** Confirmed ধাপ ছাড়াই সরাসরি Delivered হলে — সরাসরি Available থেকে বাদ */
function finalizeSoldDirectStockForOrderItems_(cartItems, orderId, admin) {
  var sheet = ensureStockVariantsSheet_();
  var data = sheet.getDataRange().getValues();
  var requirements = trackedStockRequirements_(cartItems, data, true);
  assertStockRequirementsAvailable_(requirements);
  var legacySheet = ensureStockSheet_();
  var legacyRequirements = legacyProductStockRequirements_(cartItems, data, legacySheet.getDataRange().getValues());
  legacyRequirements.forEach(function (req) {
    if (req.available < req.qty) {
      var err = new Error('OUT_OF_STOCK:' + req.productName + ' — Available ' + req.available + ', চাওয়া হয়েছে ' + req.qty);
      err.isStockError = true;
      throw err;
    }
  });
  requirements.forEach(function (req) {
    mutateStockVariant_({
      productId: req.productId,
      productName: req.productName,
      category: req.category,
      variant: req.variant,
      deltaAvailable: -req.qty,
      deltaReserved: 0,
      changeType: 'SELL_DIRECT',
      reason: 'ডেলিভারি সম্পন্ন (রিজার্ভ ছাড়াই সরাসরি) — Order ' + orderId,
      orderId: orderId,
      admin: admin || 'system'
    });
  });

  legacyRequirements.forEach(function (req) {
    var before = Number(legacySheet.getRange(req.rowIndex, 3).getValue()) || 0;
    if (before < req.qty) {
      var err = new Error('OUT_OF_STOCK:' + req.productName + ' — Available ' + before + ', চাওয়া হয়েছে ' + req.qty);
      err.isStockError = true;
      throw err;
    }
    var after = before - req.qty;
    legacySheet.getRange(req.rowIndex, 3).setValue(after);
    legacySheet.getRange(req.rowIndex, 4).setValue(new Date());
    appendStockLedger_({
      productId: req.productId,
      variant: '',
      changeType: 'SELL_DIRECT_PRODUCT_TOTAL',
      qtyBefore: before,
      qtyAfter: after,
      reservedBefore: 0,
      reservedAfter: 0,
      reason: 'ডেলিভারি সম্পন্ন — product-total stock, Order ' + orderId,
      orderId: orderId,
      admin: admin || 'system'
    });
  });
}

/**
 * অর্ডারের স্ট্যাটাস পরিবর্তন হলে স্টক লাইফসাইকেল প্রয়োগ — idempotent, oversell-safe।
 * StockStage কলাম (৩৬): '' / 'NEW' → 'RESERVED' → 'SOLD', অথবা যেকোনো ধাপ থেকে 'RELEASED'।
 * একই টার্গেট স্টেজে দ্বিতীয়বার এলে কিছুই করে না (দ্বিতীয়বার প্রয়োগ ঠেকায়)।
 */
function applyStockLifecycleForStatusChange_(sheet, row, newStatus) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return applyStockLifecycleForStatusChangeLocked_(sheet, row, newStatus);
  } finally {
    lock.releaseLock();
  }
}

function applyStockLifecycleForStatusChangeLocked_(sheet, row, newStatus) {
  ensureOnlineOrderStockStageHeader_(sheet);
  var rawStage = String(sheet.getRange(row, onlineOrderColumn_(sheet, 36)).getValue() || '').trim().toUpperCase();
  var isLegacyOrder = !rawStage || rawStage === 'LEGACY_SKIPPED';
  var currentStage = isLegacyOrder ? 'LEGACY_UNKNOWN' : rawStage;
  var status = String(newStatus || '').trim();
  var statusLower = status.toLowerCase();
  var target = null;

  if (isReturnKeywordStatus_(status) || isPlainCancelStatus_(status) || statusLower === 'fake') {
    target = 'RELEASED';
  } else if (status === 'Confirmed') {
    target = 'RESERVED';
  } else if (status === 'Delivered') {
    target = 'SOLD';
  } else if (status === 'Pending' && currentStage === 'RESERVED') {
    target = 'RELEASED';
  } else {
    return; // Pending/Shipped-এ নতুন reserve নয়; Confirmed→Shipped হলে reserve বহাল থাকে
  }

  if (isLegacyOrder) {
    var orderIdCellLegacy = sheet.getRange(row, onlineOrderColumn_(sheet, 9)).getValue();
    var orderIdLegacy = String(orderIdCellLegacy || ('row' + row));
    sheet.getRange(row, onlineOrderColumn_(sheet, 36)).setValue('LEGACY_SKIPPED');
    appendStockLedger_({
      productId: '', variant: '', changeType: 'LEGACY_SKIPPED',
      reason: 'পুরনো (মাইগ্রেশনের আগের) অর্ডার — স্ট্যাটাস \'' + status + '\'-এ পরিবর্তিত হয়েছে, কিন্তু স্টক অটো-আপডেট করা হয়নি। প্রয়োজনে ম্যানুয়ালি স্টক সমন্বয় করুন।',
      orderId: orderIdLegacy, admin: 'system'
    });
    return;
  }

  if (currentStage === target) return;
  var orderIdCell = sheet.getRange(row, onlineOrderColumn_(sheet, 9)).getValue();
  var orderId = String(orderIdCell || ('row' + row));
  var cartJsonCell = String(sheet.getRange(row, onlineOrderColumn_(sheet, 33)).getValue() || '').trim();
  var items = [];
  if (cartJsonCell) {
    try { items = JSON.parse(cartJsonCell); } catch (pe) { items = []; }
  }
  if (!items.length) {
    sheet.getRange(row, onlineOrderColumn_(sheet, 36)).setValue(target);
    return;
  }

  if (target === 'RESERVED') {
    if (currentStage === 'SOLD') {
      appendStockLedger_({ productId: '', variant: '', changeType: 'REVIEW_NEEDED', reason: 'SOLD থেকে আবার Confirmed — ম্যানুয়াল যাচাই দরকার', orderId: orderId, admin: 'system' });
    } else {
      reserveStockForOrderItems_(items, orderId, 'system');
    }
  } else if (target === 'RELEASED') {
    if (currentStage === 'RESERVED') {
      releaseStockForOrderItems_(items, orderId, 'system');
    } else if (currentStage === 'SOLD') {
      appendStockLedger_({ productId: '', variant: '', changeType: 'RETURN_REVIEW_NEEDED', reason: 'ডেলিভারির পর বাতিল/রিটার্ন — স্টক ফেরত দিতে চাইলে অ্যাডমিন প্যানেল থেকে ম্যানুয়ালি যোগ করুন', orderId: orderId, admin: 'system' });
    }
  } else if (target === 'SOLD') {
    if (currentStage === 'RESERVED') {
      finalizeSoldStockForOrderItems_(items, orderId, 'system');
    } else if (currentStage === 'NEW') {
      finalizeSoldDirectStockForOrderItems_(items, orderId, 'system');
    } else if (currentStage === 'RELEASED') {
      appendStockLedger_({ productId: '', variant: '', changeType: 'REVIEW_NEEDED', reason: 'বাতিল থেকে আবার Delivered — ম্যানুয়াল যাচাই দরকার', orderId: orderId, admin: 'system' });
      finalizeSoldDirectStockForOrderItems_(items, orderId, 'system');
    }
  }

  sheet.getRange(row, onlineOrderColumn_(sheet, 36)).setValue(target);
}

function isReturnKeywordStatus_(statusText) {
  var s = String(statusText || '').trim().toLowerCase();
  return s.indexOf('return') !== -1 || s.indexOf('ফেরত') !== -1 || s.indexOf('refund') !== -1;
}
function isPlainCancelStatus_(statusText) {
  var s = String(statusText || '').trim().toLowerCase();
  return s.indexOf('cancel') !== -1 || s.indexOf('বাতিল') !== -1;
}

/* ---------------- Admin endpoints (stock variants + ledger + csv + analytics v2) ---------------- */

function computeVariantStatus_(v, defaultThreshold) {
  if (!v.tracked) return 'UNTRACKED';
  if (v.available <= 0) return 'OUT';
  var threshold = (v.threshold === null || typeof v.threshold === 'undefined') ? defaultThreshold : v.threshold;
  if (v.available <= threshold) return 'LOW';
  return 'OK';
}

function getAdminStockVariants_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var search = String(param_(e, 'Search') || '').trim().toLowerCase();
  var stockStatus = String(param_(e, 'StockStatus') || 'all').trim().toLowerCase();
  var categoryFilter = String(param_(e, 'Category') || '').trim().toLowerCase();
  var categoryMap = {};
  try {
    var cmRaw = param_(e, 'CategoryMap');
    if (cmRaw) categoryMap = JSON.parse(cmRaw) || {};
  } catch (cmErr) { categoryMap = {}; }

  var sheet = ensureStockVariantsSheet_();
  var data = sheet.getDataRange().getValues();
  var defaultThreshold = STOCK_LOW_DEFAULT_THRESHOLD_;
  var rows = [];
  var i;
  for (i = 1; i < data.length; i++) {
    var r = data[i];
    var pid = String(r[0] || '').trim();
    if (!pid) continue;
    var item = {
      productId: pid,
      productName: String(r[1] || ''),
      category: String(r[2] || '') || categoryMap[pid] || '',
      variant: String(r[3] || ''),
      tracked: (String(r[4]).toUpperCase() === 'TRUE') || (r[4] === true),
      available: Number(r[5]) || 0,
      reserved: Number(r[6]) || 0,
      threshold: (r[7] === '' || r[7] === null || typeof r[7] === 'undefined') ? null : Number(r[7]),
      updatedAt: formatCell_(r[8]),
      updatedBy: String(r[9] || '')
    };
    item.status = computeVariantStatus_(item, defaultThreshold);
    rows.push(item);
  }

  if (search) {
    rows = rows.filter(function (it) {
      return it.productId.toLowerCase().indexOf(search) !== -1 ||
        it.productName.toLowerCase().indexOf(search) !== -1;
    });
  }
  if (categoryFilter) {
    rows = rows.filter(function (it) { return String(it.category || '').toLowerCase() === categoryFilter; });
  }
  if (stockStatus && stockStatus !== 'all') {
    var want = stockStatus.toUpperCase();
    rows = rows.filter(function (it) { return it.status === want; });
  }

  var categoryCounts = {};
  rows.forEach(function (it) {
    var c = it.category || 'অজানা';
    categoryCounts[c] = (categoryCounts[c] || 0) + 1;
  });

  return { ok: true, items: rows, count: rows.length, categoryCounts: categoryCounts, defaultThreshold: defaultThreshold };
}

function saveAdminStockVariant_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;

  var productId = String(param_(e, 'ProductId') || '').trim();
  if (!productId) return { ok: false, error: 'MISSING_ID', message: 'Product ID প্রয়োজন।' };
  var productName = String(param_(e, 'ProductName') || '').trim();
  var category = String(param_(e, 'Category') || '').trim();
  var variant = normStockVariant_(param_(e, 'Variant'));
  var reason = String(param_(e, 'Reason') || '').trim();
  if (!reason) return { ok: false, error: 'REASON_REQUIRED', message: 'স্টক পরিবর্তনের কারণ লেখা বাধ্যতামূলক।' };

  var qtyRaw = param_(e, 'Available');
  var hasQty = qtyRaw !== '' && typeof qtyRaw !== 'undefined';
  var qty = parseInt(qtyRaw, 10);
  if (hasQty && (isNaN(qty) || qty < 0)) return { ok: false, error: 'INVALID_QTY', message: 'সঠিক Available সংখ্যা দিন।' };

  var thresholdRaw = param_(e, 'Threshold');
  var threshold;
  if (thresholdRaw === '' || typeof thresholdRaw === 'undefined') {
    threshold = undefined;
  } else {
    var t = parseInt(thresholdRaw, 10);
    threshold = isNaN(t) ? undefined : t;
  }

  var trackedRaw = String(param_(e, 'Tracked') || '').trim().toLowerCase();
  var setTracked = hasQty || trackedRaw === 'true' || trackedRaw === '1';

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = ensureStockVariantsSheet_();
    var row = getOrCreateStockVariantRow_(sheet, productId, productName, variant, category);
    var before = readStockVariantRow_(sheet, row);
    var nextAvailable = hasQty ? qty : before.available;
    var deltaAvailable = nextAvailable - before.available;
    var fields = { available: nextAvailable, updatedBy: v.email || 'admin' };
    if (setTracked) fields.tracked = true;
    if (productName) fields.productName = productName;
    if (category) fields.category = category;
    if (typeof threshold !== 'undefined') fields.threshold = threshold;
    writeStockVariantRow_(sheet, row, fields);
    appendStockLedger_({
      productId: before.productId || productId,
      variant: before.variant || variant,
      changeType: 'MANUAL',
      qtyBefore: before.available,
      qtyAfter: nextAvailable,
      reservedBefore: before.reserved,
      reservedAfter: before.reserved,
      reason: reason,
      orderId: '',
      admin: v.email || 'admin'
    });
    if (setTracked && nextAvailable > 0 && (deltaAvailable > 0 || !before.tracked)) { try { opsNotifyVariant_(productId, variant, nextAvailable); } catch (notifyErr) {} }
    return { ok: true, productId: productId, variant: variant, available: nextAvailable, reserved: before.reserved, delta: deltaAvailable };
  } finally {
    lock.releaseLock();
  }
}

function getAdminStockLedger_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var productId = String(param_(e, 'ProductId') || '').trim();
  var limit = parseInt(param_(e, 'Limit'), 10) || 200;
  if (limit < 1) limit = 1;
  if (limit > 1000) limit = 1000;

  var sheet = ensureStockLedgerSheet_();
  var data = sheet.getDataRange().getValues();
  var rows = [];
  var i;
  for (i = data.length - 1; i >= 1; i--) {
    var r = data[i];
    var pid = String(r[1] || '');
    if (productId && pid !== productId) continue;
    rows.push({
      timestamp: formatCell_(r[0]),
      productId: pid,
      variant: String(r[2] || ''),
      changeType: String(r[3] || ''),
      qtyBefore: r[4],
      qtyAfter: r[5],
      reservedBefore: r[6],
      reservedAfter: r[7],
      reason: String(r[8] || ''),
      orderId: String(r[9] || ''),
      admin: String(r[10] || '')
    });
    if (rows.length >= limit) break;
  }
  return { ok: true, items: rows, count: rows.length };
}

/**
 * CSV ব্যাচ — PreviewOnly=true হলে শুধু যাচাই করে ফলাফল দেখায়, কিছু লেখে না।
 * PreviewOnly না থাকলে যাচাই-সফল সারিগুলো প্রয়োগ করে।
 */
function commitAdminStockCsvBatch_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;

  var rowsRaw = param_(e, 'RowsJSON');
  var previewOnly = String(param_(e, 'PreviewOnly') || '').trim().toLowerCase() === 'true';
  var rows;
  try {
    rows = JSON.parse(rowsRaw || '[]');
  } catch (pe) {
    return { ok: false, error: 'INVALID_JSON', message: 'CSV ডেটা পড়া যায়নি।' };
  }
  if (!Array.isArray(rows) || !rows.length) {
    return { ok: false, error: 'EMPTY', message: 'CSV-তে কোনো সারি পাওয়া যায়নি।' };
  }

  var sheet = ensureStockVariantsSheet_();
  var data = sheet.getDataRange().getValues();
  var knownIds = {};
  var di;
  for (di = 1; di < data.length; di++) {
    var kid = String(data[di][0] || '').trim();
    if (kid) knownIds[kid] = true;
  }

  var seen = {};
  var results = [];
  var validCount = 0;
  rows.forEach(function (row, idx) {
    var productId = String(row.productId || row.ProductId || '').trim();
    var variant = normStockVariant_(row.variant || row.Variant);
    var qtyRaw = row.qty != null ? row.qty : row.Qty;
    var reason = String(row.reason || row.Reason || '').trim();
    var issues = [];
    if (!productId) issues.push('Product ID খালি');
    var qty = parseInt(qtyRaw, 10);
    if (qtyRaw === '' || typeof qtyRaw === 'undefined' || isNaN(qty) || qty < 0) issues.push('Qty সঠিক নয়');
    if (!reason) issues.push('Reason খালি');
    var key = productId + '||' + variant;
    if (seen[key]) issues.push('ডুপ্লিকেট সারি (আগেই এই ব্যাচে আছে)');
    seen[key] = true;
    if (productId && !knownIds[productId]) issues.push('অজানা Product ID (StockVariants-এ নেই — নতুন হিসেবে যোগ হবে)');
    var ok = !issues.some(function (m) { return m !== ('অজানা Product ID (StockVariants-এ নেই — নতুন হিসেবে যোগ হবে)'); }) && productId && !isNaN(qty) && qty >= 0 && reason;
    if (ok) validCount++;
    results.push({ rowIndex: idx, productId: productId, variant: variant, qty: qtyRaw, reason: reason, ok: !!ok, issues: issues });
  });

  if (previewOnly) {
    return { ok: true, preview: true, results: results, validCount: validCount, totalCount: rows.length };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var applied = 0;
  var skipped = 0;
  try {
    results.forEach(function (res) {
      if (!res.ok) { skipped++; return; }
      var row = getOrCreateStockVariantRow_(sheet, res.productId, '', res.variant, '');
      var before = readStockVariantRow_(sheet, row);
      var nextAvailable = parseInt(res.qty, 10);
      writeStockVariantRow_(sheet, row, { available: nextAvailable, tracked: true, updatedBy: v.email || 'admin' });
      appendStockLedger_({
        productId: res.productId,
        variant: res.variant,
        changeType: 'CSV_IMPORT',
        qtyBefore: before.available,
        qtyAfter: nextAvailable,
        reservedBefore: before.reserved,
        reservedAfter: before.reserved,
        reason: res.reason,
        orderId: '',
        admin: v.email || 'admin'
      });
      applied++;
    });
  } finally {
    lock.releaseLock();
  }
  return { ok: true, preview: false, applied: applied, skipped: skipped, totalCount: rows.length };
}

function bdIsValidDateKey_(value) {
  var match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  var year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  var date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function bdRangeBounds_(range, fromStr, toStr) {
  var now = new Date();
  var todayKey = Utilities.formatDate(now, 'GMT+6', 'yyyy-MM-dd');
  var fromKey, toKey;
  if (range === 'today') {
    fromKey = todayKey; toKey = todayKey;
  } else if (range === '7d') {
    var d7 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    fromKey = Utilities.formatDate(d7, 'GMT+6', 'yyyy-MM-dd'); toKey = todayKey;
  } else if (range === '30d') {
    var d30 = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
    fromKey = Utilities.formatDate(d30, 'GMT+6', 'yyyy-MM-dd'); toKey = todayKey;
  } else if (range === 'all') {
    fromKey = ''; toKey = todayKey;
  } else if (range === 'custom') {
    fromKey = fromStr || todayKey; toKey = toStr || todayKey;
    if (!bdIsValidDateKey_(fromKey) || !bdIsValidDateKey_(toKey) || fromKey > toKey) {
      return { ok: false, error: 'INVALID_DATE_RANGE', message: 'সঠিক তারিখের সীমা দিন।' };
    }
  } else {
    fromKey = todayKey; toKey = todayKey;
  }
  return { fromKey: fromKey, toKey: toKey, all: range === 'all' };
}

/**
 * BD টাইমজোন-অ্যাওয়্যার অ্যানালিটিক্স v2 — আসল অর্ডার ডেটা থেকে হিসাব করা হয়।
 * সোর্স/সাইজ/ক্যাটাগরির তথ্য না থাকলে বানানো সংখ্যা দেখানো হয় না।
 */
function getAdminAnalyticsV2_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;

  var range = String(param_(e, 'Range') || 'today').trim().toLowerCase();
  var fromStr = String(param_(e, 'From') || '').trim();
  var toStr = String(param_(e, 'To') || '').trim();
  var bounds = bdRangeBounds_(range, fromStr, toStr);
  if (bounds.ok === false) return bounds;

  var categoryMap = {};
  try {
    var cmRaw = param_(e, 'CategoryMap');
    if (cmRaw) categoryMap = JSON.parse(cmRaw) || {};
  } catch (cmErr) { categoryMap = {}; }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  var summary = {
    totalOrders: 0, confirmedCount: 0, cancelledCount: 0, deliveredCount: 0, returnedCount: 0,
    totalOrderValue: 0, deliveredSalesValue: 0
  };
  var productSales = {}; // id -> { name, qty }
  var categorySales = {}; // category -> qty
  var sizeSales = {}; // size -> qty
  var sourceStats = {}; // source -> { orders, delivered }
  var monthStats = {}; // yyyy-MM -> order and sales totals
  var undatedOrderCount = 0;
  var firstOrderDay = '';
  var lastOrderDay = '';
  var anySourceData = false;

  if (sheet) {
    var data = readOnlineOrderRows_(sheet);
    var i;
    for (i = 1; i < data.length; i++) {
      var r = data[i];
      var dk = dayKeyFromCell_(r[0]);
      if (dk && !bdIsValidDateKey_(dk)) dk = '';
      if (range === 'all') {
        if (dk && dk > bounds.toKey) continue;
      } else if (!dk || dk < bounds.fromKey || dk > bounds.toKey) continue;
      if (!r[1] && !r[2]) continue;
      if (!dk) undatedOrderCount++;
      else {
        if (!firstOrderDay || dk < firstOrderDay) firstOrderDay = dk;
        if (!lastOrderDay || dk > lastOrderDay) lastOrderDay = dk;
      }
      summary.totalOrders++;
      var status = String(r[9] || '').trim().toLowerCase();
      var total = parseSignedOrderAmount_(r[7]);
      summary.totalOrderValue += total;
      if (dk) {
        var monthKey = dk.slice(0, 7);
        if (!monthStats[monthKey]) monthStats[monthKey] = { month: monthKey, orders: 0, revenue: 0, deliveredOrders: 0, deliveredSales: 0 };
        monthStats[monthKey].orders++;
        monthStats[monthKey].revenue += total;
      }

      var isReturn = isReturnKeywordStatus_(status);
      var isPlainCancel = isPlainCancelStatus_(status);
      if (isReturn) summary.returnedCount++;
      else if (isPlainCancel) summary.cancelledCount++;

      if (status === 'confirmed') summary.confirmedCount++;
      if (status === 'delivered') {
        summary.deliveredCount++;
        summary.deliveredSalesValue += total;
        if (dk && monthStats[dk.slice(0, 7)]) {
          monthStats[dk.slice(0, 7)].deliveredOrders++;
          monthStats[dk.slice(0, 7)].deliveredSales += total;
        }
      }

      var sourceVal = String(r[36] || '').trim(); // কলাম ৩৭ (0-ইনডেক্স ৩৬)
      if (sourceVal) {
        anySourceData = true;
        if (!sourceStats[sourceVal]) sourceStats[sourceVal] = { orders: 0, delivered: 0 };
        sourceStats[sourceVal].orders++;
        if (status === 'delivered') sourceStats[sourceVal].delivered++;
      }

      // best-seller হিসাব Confirmed/Shipped/Delivered অর্ডার থেকে (বাতিল/পেন্ডিং বাদ) —
      // Shipped মানে কুরিয়ারে পাঠানো হয়ে গেছে (Steadfast auto), তাই এটাও একটা প্রতিশ্রুত বিক্রি —
      // আগে শুধু Confirmed/Delivered গোনা হতো, ফলে ট্রানজিটে থাকা অর্ডারগুলোর পণ্য বেস্ট-সেলার/
      // ক্যাটাগরি/সাইজ পরিসংখ্যানে বাদ পড়ে যেত।
      if (status === 'confirmed' || status === 'shipped' || status === 'delivered') {
        var cartJsonCell = String(r[32] || '').trim(); // কলাম ৩৩
        if (cartJsonCell) {
          try {
            var items = JSON.parse(cartJsonCell);
            if (Array.isArray(items)) {
              items.forEach(function (it) {
                var pid = String((it && it.id) || '').trim();
                if (!pid) return;
                var qty = parseInt(it.qty, 10) || 0;
                if (qty <= 0) return;
                var name = String((it && it.name) || pid);
                if (!productSales[pid]) productSales[pid] = { name: name, qty: 0 };
                productSales[pid].qty += qty;

                var cat = String((it && it.category) || '').trim() || categoryMap[pid] || 'অজানা ক্যাটাগরি';
                categorySales[cat] = (categorySales[cat] || 0) + qty;

                var size = String((it && it.size) || '').trim();
                if (size) sizeSales[size] = (sizeSales[size] || 0) + qty;
              });
            }
          } catch (cartErr) {}
        }
      }
    }
  }

  summary.cancellationRate = summary.totalOrders ? ((summary.cancelledCount + summary.returnedCount) / summary.totalOrders) : 0;
  summary.deliverySuccessRate = summary.totalOrders ? (summary.deliveredCount / summary.totalOrders) : 0;

  var topProducts = Object.keys(productSales).map(function (pid) {
    return { productId: pid, name: productSales[pid].name, qty: productSales[pid].qty };
  }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 20);

  var topCategories = Object.keys(categorySales).map(function (c) {
    return { category: c, qty: categorySales[c] };
  }).sort(function (a, b) { return b.qty - a.qty; });

  var topSizes = Object.keys(sizeSales).map(function (s) {
    return { size: s, qty: sizeSales[s] };
  }).sort(function (a, b) { return b.qty - a.qty; });

  var sourceBreakdown = Object.keys(sourceStats).map(function (s) {
    return { source: s, orders: sourceStats[s].orders, delivered: sourceStats[s].delivered };
  }).sort(function (a, b) { return b.orders - a.orders; });
  var salesByMonth = Object.keys(monthStats).sort().map(function (month) { return monthStats[month]; });

  // কম স্টক / স্টক শেষ — বর্তমান স্ন্যাপশট (তারিখ-নির্ভর নয়)
  var lowStockList = [];
  var outOfStockList = [];
  try {
    var vSheet = ensureStockVariantsSheet_();
    var vData = vSheet.getDataRange().getValues();
    var vi;
    for (vi = 1; vi < vData.length; vi++) {
      var vr = vData[vi];
      var tracked = (String(vr[4]).toUpperCase() === 'TRUE') || (vr[4] === true);
      if (!tracked) continue;
      var available = Number(vr[5]) || 0;
      var threshold = (vr[7] === '' || vr[7] === null || typeof vr[7] === 'undefined') ? STOCK_LOW_DEFAULT_THRESHOLD_ : Number(vr[7]);
      var entry = { productId: String(vr[0] || ''), productName: String(vr[1] || ''), variant: String(vr[3] || ''), available: available, threshold: threshold };
      if (available <= 0) outOfStockList.push(entry);
      else if (available <= threshold) lowStockList.push(entry);
    }
  } catch (stockListErr) {}

  return {
    ok: true,
    range: range,
    from: range === 'all' ? firstOrderDay : bounds.fromKey,
    to: range === 'all' ? lastOrderDay : bounds.toKey,
    summary: summary,
    topProducts: topProducts,
    topCategories: topCategories,
    topSizes: topSizes,
    salesByMonth: salesByMonth,
    undatedOrderCount: undatedOrderCount,
    lowStockList: lowStockList,
    outOfStockList: outOfStockList,
    sourceBreakdown: sourceBreakdown,
    sourceDataAvailable: anySourceData,
    sourceMessage: anySourceData ? '' : 'এই সময়সীমার অর্ডারে উৎস (Facebook/TikTok) তথ্য নেই। নতুন অর্ডার থেকে এই তথ্য সংরক্ষণ শুরু হয়েছে।'
  };
}

/**
 * পুরনো Stock শীট থেকে StockVariants-এ নিরাপদে মাইগ্রেট করা — idempotent, কোনো ডেটা মোছে না।
 * শুধু owner অ্যাডমিন চালাতে পারবে।
 */
function migrateStockToVariants_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var ownerErr = requireOwnerAdmin_(v);
  if (ownerErr) return ownerErr;

  return migrateLegacyStockCore_(v.email || 'admin');
}

/**
 * Editor-run entry point (only the project owner can run editor functions).
 * Same idempotent migration as the admin API: old "Stock" sheet products get
 * an "all sizes" pool row in StockVariants; nothing is deleted.
 */
function migrateLegacyStockToVariantsFromEditor() {
  var result = migrateLegacyStockCore_('owner-editor');
  console.log('MIGRATE_LEGACY_STOCK ' + JSON.stringify(result));
  return result;
}

function migrateLegacyStockCore_(adminLabel) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var migrated = 0, skipped = 0, total = 0;
  try {
    var legacySheet = ensureStockSheet_();
    var legacyData = legacySheet.getDataRange().getValues();
    var vSheet = ensureStockVariantsSheet_();
    var vData = vSheet.getDataRange().getValues();
    var i;
    for (i = 1; i < legacyData.length; i++) {
      var r = legacyData[i];
      var pid = String(r[0] || '').trim();
      if (!pid) continue;
      total++;
      var existingRow = findStockVariantRowIndex_(vData, pid, '');
      if (existingRow !== -1) { skipped++; continue; }
      var qty = Number(r[2]) || 0;
      var name = String(r[1] || '');
      appendRow_(vSheet, [pid, name, '', '', true, qty, 0, '', new Date(), 'migration']);
      appendStockLedger_({
        productId: pid, variant: '', changeType: 'MIGRATE',
        qtyBefore: 0, qtyAfter: qty, reservedBefore: 0, reservedAfter: 0,
        reason: 'পুরনো Stock শীট থেকে মাইগ্রেশন', orderId: '', admin: adminLabel || 'admin'
      });
      // vData তে নতুন সারি যোগ হলো তা পরবর্তী লুপের জন্য মেমরিতেও যোগ করা দরকার যাতে ডুপ্লিকেট না হয়
      vData.push([pid, name, '', '', true, qty, 0, '', new Date(), 'migration']);
      migrated++;
    }
  } finally {
    lock.releaseLock();
  }
  return { ok: true, migrated: migrated, skipped: skipped, total: total, message: 'মাইগ্রেশন সম্পন্ন — পুরনো Stock শীট অপরিবর্তিত রাখা হয়েছে।' };
}

function quickAdjustAdminStock_(e) {
  var token = param_(e, 'Token');
  var v = verifyAdminSession_(token);
  if (!v.ok) return v;
  var productId = String(param_(e, 'ProductId') || '').trim();
  if (!productId) return { ok: false, error: 'MISSING_ID', message: 'Product ID প্রয়োজন।' };
  var productName = String(param_(e, 'ProductName') || '').trim();
  var category = String(param_(e, 'Category') || '').trim();
  var variant = normStockVariant_(param_(e, 'Variant'));
  var delta = parseInt(param_(e, 'Delta'), 10);
  if (isNaN(delta) || delta === 0) return { ok: false, error: 'INVALID_DELTA', message: 'সঠিক পরিমাণ দিন।' };
  var reason = String(param_(e, 'Reason') || '').trim();
  if (!reason) return { ok: false, error: 'REASON_REQUIRED', message: 'কারণ লেখা বাধ্যতামূলক।' };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = ensureStockVariantsSheet_();
    var row = getOrCreateStockVariantRow_(sheet, productId, productName, variant, category);
    var before = readStockVariantRow_(sheet, row);
    if (delta < 0 && (before.available + delta) < 0) {
      return { ok: false, error: 'INSUFFICIENT_STOCK', message: 'এত স্টক নেই। বর্তমান Available: ' + before.available };
    }
    var nextAvailable = Math.max(0, before.available + delta);
    writeStockVariantRow_(sheet, row, { available: nextAvailable, tracked: true, updatedBy: v.email || 'admin' });
    appendStockLedger_({
      productId: before.productId || productId,
      variant: before.variant || variant,
      changeType: delta < 0 ? 'MANUAL_SALE' : 'MANUAL_RESTOCK',
      qtyBefore: before.available,
      qtyAfter: nextAvailable,
      reservedBefore: before.reserved,
      reservedAfter: before.reserved,
      reason: reason,
      orderId: '',
      admin: v.email || 'admin'
    });
    if (delta > 0) { try { opsNotifyVariant_(productId, variant, nextAvailable); } catch (notifyErr) {} }
    return { ok: true, productId: productId, variant: variant, available: nextAvailable, delta: delta };
  } finally {
    lock.releaseLock();
  }
}


// ── Sign in with Google ──
// Script property GOOGLE_CLIENT_ID (OAuth "Web application" client ID, ends with
// .apps.googleusercontent.com) switches this on. The browser sends the Google ID token;
// we ask Google to validate it (tokeninfo) and then check audience, issuer, expiry and
// email_verified ourselves before creating / finding the customer and issuing a normal
// site session. Google-created customers have no password (PasswordHash/Salt empty), so
// password login can never match them.
function sanitizeCellText_(value, maxLen) {
  var t = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (maxLen) t = t.slice(0, maxLen);
  // a leading = + - @ would be run as a formula by Google Sheets
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}

function googleLogin_(e) {
  if (!getAuthSecret_()) {
    return { ok: false, error: 'AUTH_NOT_CONFIGURED', message: 'Apps Script এ AUTH_SECRET সেট করুন।' };
  }
  var clientId = PropertiesService.getScriptProperties().getProperty('GOOGLE_CLIENT_ID') || '';
  if (!clientId) {
    return { ok: false, error: 'GOOGLE_NOT_CONFIGURED', message: 'Google লগইন চালু করা হয়নি।' };
  }
  var idToken = String(param_(e, 'IdToken') || '');
  if (!idToken || idToken.length > 4096 || idToken.split('.').length !== 3) {
    return { ok: false, error: 'INVALID_GOOGLE_TOKEN', message: 'Google লগইন ব্যর্থ। আবার চেষ্টা করুন।' };
  }
  var info;
  try {
    var resp = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
      { muteHttpExceptions: true }
    );
    if (resp.getResponseCode() !== 200) {
      return { ok: false, error: 'INVALID_GOOGLE_TOKEN', message: 'Google লগইন ব্যর্থ। আবার চেষ্টা করুন।' };
    }
    info = JSON.parse(resp.getContentText());
  } catch (err) {
    return { ok: false, error: 'GOOGLE_VERIFY_FAILED', message: 'Google যাচাই করা যায়নি। আবার চেষ্টা করুন।' };
  }
  var iss = String(info.iss || '');
  var expMs = parseInt(info.exp, 10) * 1000;
  if (String(info.aud || '') !== clientId ||
      (iss !== 'accounts.google.com' && iss !== 'https://accounts.google.com') ||
      !expMs || expMs < Date.now()) {
    return { ok: false, error: 'INVALID_GOOGLE_TOKEN', message: 'Google লগইন ব্যর্থ। আবার চেষ্টা করুন।' };
  }
  if (String(info.email_verified) !== 'true' || !info.email) {
    return { ok: false, error: 'GOOGLE_EMAIL_UNVERIFIED', message: 'আপনার Google ইমেইল যাচাই করা নয়।' };
  }
  var email = normalizeEmail_(info.email);
  var user = findCustomerByEmail_(email);
  if (user && user.status === 'blocked') {
    return { ok: false, error: 'BLOCKED', message: 'অ্যাকাউন্ট বন্ধ।' };
  }
  if (!user) {
    var name = sanitizeCellText_(info.name, 80) || sanitizeCellText_(email.split('@')[0], 80);
    appendRow_(getCustomersSheet_(), [email, '', name, '', '', 'active', new Date(), new Date()]);
    user = { email: email, phone: '', name: name };
  }
  return createSession_({ email: user.email, phone: user.phone || '', name: user.name || '' }, 'customer');
}

// ── Sign in with Facebook ──
// FACEBOOK_LOGIN_APP_ID is public configuration; FACEBOOK_LOGIN_APP_SECRET must stay in
// Script Properties. The app token is used only to verify the browser access token with Meta.
function facebookLogin_(e) {
  if (!getAuthSecret_()) {
    return { ok: false, error: 'AUTH_NOT_CONFIGURED', message: 'Customer sign-in is not configured.' };
  }
  var props = PropertiesService.getScriptProperties();
  var appId = props.getProperty('FACEBOOK_LOGIN_APP_ID') || '';
  var appSecret = props.getProperty('FACEBOOK_LOGIN_APP_SECRET') || '';
  if (!appId || !appSecret) {
    return { ok: false, error: 'FACEBOOK_NOT_CONFIGURED', message: 'Facebook sign-in is not configured yet.' };
  }
  var accessToken = String(param_(e, 'AccessToken') || '');
  if (!accessToken || accessToken.length > 4096 || /[\r\n]/.test(accessToken)) {
    return { ok: false, error: 'INVALID_FACEBOOK_TOKEN', message: 'Facebook sign-in failed. Please try again.' };
  }

  var debug;
  try {
    var debugUrl = 'https://graph.facebook.com/v25.0/debug_token?input_token=' +
      encodeURIComponent(accessToken) + '&access_token=' + encodeURIComponent(appId + '|' + appSecret);
    var debugRes = UrlFetchApp.fetch(debugUrl, { muteHttpExceptions: true });
    if (debugRes.getResponseCode() !== 200) {
      return { ok: false, error: 'INVALID_FACEBOOK_TOKEN', message: 'Facebook sign-in failed. Please try again.' };
    }
    debug = JSON.parse(debugRes.getContentText()).data || {};
  } catch (err) {
    return { ok: false, error: 'FACEBOOK_VERIFY_FAILED', message: 'Facebook could not verify this sign-in. Please try again.' };
  }
  var expiresAt = parseInt(debug.expires_at, 10) * 1000;
  var dataExpiresAt = parseInt(debug.data_access_expires_at, 10) * 1000;
  if (debug.is_valid !== true || String(debug.app_id || '') !== String(appId) || !debug.user_id ||
      (expiresAt && expiresAt < Date.now()) || (dataExpiresAt && dataExpiresAt < Date.now())) {
    return { ok: false, error: 'INVALID_FACEBOOK_TOKEN', message: 'Facebook sign-in failed. Please try again.' };
  }

  var profile;
  try {
    var profileUrl = 'https://graph.facebook.com/v25.0/me?fields=id,name,email&access_token=' + encodeURIComponent(accessToken);
    var profileRes = UrlFetchApp.fetch(profileUrl, { muteHttpExceptions: true });
    if (profileRes.getResponseCode() !== 200) {
      return { ok: false, error: 'FACEBOOK_PROFILE_FAILED', message: 'Facebook profile details could not be verified.' };
    }
    profile = JSON.parse(profileRes.getContentText());
  } catch (err) {
    return { ok: false, error: 'FACEBOOK_PROFILE_FAILED', message: 'Facebook profile details could not be verified.' };
  }
  if (String(profile.id || '') !== String(debug.user_id)) {
    return { ok: false, error: 'INVALID_FACEBOOK_TOKEN', message: 'Facebook sign-in failed. Please try again.' };
  }
  var email = normalizeEmail_(profile.email || '');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'FACEBOOK_EMAIL_REQUIRED', message: 'Facebook did not share an email address. Allow email access or use email sign-in.' };
  }
  var user = findCustomerByEmail_(email);
  if (user && user.status === 'blocked') {
    return { ok: false, error: 'BLOCKED', message: 'This account is unavailable.' };
  }
  if (!user) {
    var name = sanitizeCellText_(profile.name, 80) || sanitizeCellText_(email.split('@')[0], 80);
    appendRow_(getCustomersSheet_(), [email, '', name, '', '', 'active', new Date(), new Date()]);
    user = { email: email, phone: '', name: name };
  }
  return createSession_({ email: user.email, phone: user.phone || '', name: user.name || '' }, 'customer');
}



// Run from the project editor: aggregate setup evidence only, with no tokens or customer data in logs.
function trackingSetupAudit() {
  var meta = getFacebookCapiConfig_();
  var tt = getTikTokCapiConfig_();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  var result = { metaConfigured: !!(meta.accessToken && meta.pixelId), tiktokConfigured: !!(tt.accessToken && tt.pixelCode), orders: 0, confirmed: 0, metaSent: 0, tiktokSent: 0, metaFailures: 0, tiktokFailures: 0, sharedEventIds: 0 };
  if (sheet && sheet.getLastRow() >= 2) {
    var rows = readOnlineOrderRows_(sheet);
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i];
      if (!row[1] && !row[2]) continue;
      result.orders++;
      if (String(row[9] || '').toLowerCase() === 'confirmed') result.confirmed++;
      var note = String(row[16] || '');
      if (note.indexOf('META_PURCHASE_SENT') !== -1) result.metaSent++;
      if (note.indexOf('TIKTOK_PURCHASE_SENT') !== -1) result.tiktokSent++;
      if (/CAPI_(FAIL|ERR):/.test(note)) result.metaFailures++;
      if (/TIKTOK_(FAIL|ERR):/.test(note)) result.tiktokFailures++;
      if (String(rows[0][37] || '') === 'Tracking Event ID' && row[37]) result.sharedEventIds++;
    }
  }
  console.log('TRACKING_SETUP_AUDIT ' + JSON.stringify(result));
  return result;
}

// Exact courier events: store provider text separately from shop workflow statuses.
function courierTrackingCell_(value, max) {
  var text = String(value == null ? '' : value).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max || 1000);
  return /^\s*[=+\-@]/.test(text) ? "'" + text : text;
}

function findCourierTrackingOrder_(sheet, identifiers) {
  var rows = readOnlineOrderRows_(sheet);
  var matches = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i], hit = false, conflict = false;
    [['invoice', 8], ['tracking_code', 10], ['consignment_id', 11]].forEach(function (pair) {
      var supplied = String(identifiers[pair[0]] || '').trim();
      var stored = String(row[pair[1]] || '').trim();
      if (supplied && stored) { if (supplied === stored) hit = true; else conflict = true; }
    });
    if (hit && !conflict) matches.push({ row: i + 1, values: row });
  }
  return matches.length === 1 ? matches[0] : null;
}

function getCourierTrackingSheet_(create) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Courier Tracking');
  if (!sheet && create) {
    sheet = ss.insertSheet('Courier Tracking');
    sheet.appendRow(['Received At', 'Order ID', 'Consignment ID', 'Tracking Code', 'Event Type', 'Courier Status', 'Tracking Message', 'Provider Time', 'Event Key', 'Source']);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function readCourierTrackingEvents_(orderId) {
  var sheet = getCourierTrackingSheet_(false);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var last = sheet.getLastRow(), start = 2;
  var rows = sheet.getRange(start, 1, last - start + 1, 10).getValues();
  return rows.filter(function (r) { return String(r[1]) === String(orderId); }).map(function (r) {
    return { receivedAt: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || ''),
      status: String(r[5] || ''), message: String(r[6] || ''), providerTime: String(r[7] || ''),
      type: String(r[4] || ''), source: String(r[9] || '') };
  }).slice(-100).reverse();
}

function appendCourierTrackingEvent_(order, payload, source) {
  var status = typeof payload.delivery_status === 'string' ? payload.delivery_status : (typeof payload.status === 'string' ? payload.status : '');
  var message = String(payload.tracking_message || '').trim();
  if (!status && !message) return false;
  var event = [String(order[8] || ''), String(payload.consignment_id || order[11] || ''), String(payload.tracking_code || order[10] || ''),
    String(payload.notification_type || (message ? 'tracking_update' : 'delivery_status')), status, message, String(payload.updated_at || '')];
  var key = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(event)));
  var lock = LockService.getScriptLock(); lock.waitLock(5000);
  try {
    var sheet = getCourierTrackingSheet_(true), last = sheet.getLastRow();
    if (last >= 2) {
      var start = 2, keys = sheet.getRange(start, 9, last - start + 1, 1).getValues();
      if (keys.some(function (row) { return String(row[0]) === key; })) return false;
    }
    sheet.appendRow([new Date().toISOString()].concat(event.map(function (value) { return courierTrackingCell_(value, 2000); }), [key, source]));
    return true;
  } finally { lock.releaseLock(); }
}

function adminCourierTracking_(e) {
  var verified = verifyAdminSession_(param_(e, 'Token'));
  if (!verified.ok) return verified;
  var id = String(param_(e, 'OrderId') || '').trim();
  if (!id) return { ok: false, error: 'MISSING_ORDER_ID' };
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) return { ok: false, error: 'NO_SHEET' };
  var match = findCourierTrackingOrder_(sheet, { invoice: id });
  if (!match) return { ok: false, error: 'ORDER_NOT_UNIQUE', message: 'একটি নির্দিষ্ট অর্ডার শনাক্ত করা যায়নি।' };
  var row = match.values, raw = String(row[12] || ''), fetchedAt = '', warning = '';
  var refresh = String(param_(e, 'Refresh') || '') === '1';
  if (refresh && (row[10] || row[11])) {
    try {
      var response = row[11] ? steadfastGetStatusByConsignmentId_(row[11]) : steadfastGetStatusByTrackingCode_(row[10]);
      var status = extractSteadfastDeliveryStatus_(response);
      if (!status) warning = 'কুরিয়ার থেকে নতুন স্ট্যাটাস পাওয়া যায়নি।';
      else {
        raw = String(status); fetchedAt = new Date().toISOString();
        // Preserve the workflow column: fetching tracking never marks an order delivered.
        sheet.getRange(match.row, onlineOrderColumn_(sheet, 13)).setValue(courierTrackingCell_(raw, 100));
        appendCourierTrackingEvent_(row, { delivery_status: raw, notification_type: 'status_check',
          tracking_message: response.tracking_message || '', updated_at: response.updated_at || '' }, 'api');
      }
    } catch (err) { warning = 'কুরিয়ারের সংযোগে নতুন স্ট্যাটাস আনা যায়নি। সংরক্ষিত তথ্য দেখানো হচ্ছে।'; }
  }
  return { ok: true, version: 1, orderId: id, courierStatus: raw, tracking: String(row[10] || ''),
    consignmentId: String(row[11] || ''), fetchedAt: fetchedAt, warning: warning,
    events: readCourierTrackingEvents_(id), historyScope: 'এই সংযোগ চালুর পর পাওয়া সর্বশেষ ১০০টি ঘটনা; পুরোনো সম্পূর্ণ ইতিহাস নয়।' };
}
