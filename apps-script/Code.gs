/**
 * Muslim Abaya — সম্পূর্ণ Web App (এক ফাইলে পেস্ট করুন)
 * Code.gs → Ctrl+A → Ctrl+V → Save → Deploy → New version
 *
 * Script properties:
 *   AUTH_SECRET — Sign Up
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
  try {
    var type = param_(e, 'RecordType');
    if (type === 'Subscribe') {
      var contact = String(param_(e, 'contact') || param_(e, 'email') || '').trim();
      var saved = saveSubscribeContact_(contact);
      if (!saved.ok) return jsonOut_(saved);
      return jsonOut_({ ok: true, message: 'Subscribed', sheet: 'Subscribe' });
    }
    if (type === 'AuthVerify' || type === 'AdminVerify') {
      var tok = param_(e, 'Token');
      if (type === 'AdminVerify') return jsonOut_(verifyAdminSession_(tok));
      return jsonOut_(verifySession_(tok));
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
    selfHealSteadfastBaseUrl_();
    selfHealAutoCourierSetup_();
    if (e && e.postData && e.postData.type && String(e.postData.type).indexOf('json') !== -1) {
      return handleSteadfastWebhookPost_(e);
    }
    var type = param_(e, 'RecordType');
    var isOrder = type === 'Order' || (!type && param_(e, 'Name') && param_(e, 'Phone'));
    var isSubscribe =
      type === 'Subscribe' ||
      (!type && !isOrder && (param_(e, 'contact') || param_(e, 'email')));

    if (!isOrder && !isSubscribe) {
      rateLimit_(param_(e, 'Email') || param_(e, 'Phone') || param_(e, 'Login') || 'global');
    }

    if (type === 'AuthRegister' || type === 'CustomerRegister') {
      return jsonOut_(registerUser_(e));
    }
    if (type === 'AuthLogin' || type === 'CustomerLogin') {
      return jsonOut_(loginUser_(e));
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
    if (isSubscribe) {
      var contact = String(param_(e, 'contact') || param_(e, 'email') || '').trim();
      var saved = saveSubscribeContact_(contact);
      if (!saved.ok) return jsonOut_(saved);
      return jsonOut_({ ok: true, message: 'Subscribed', sheet: 'Subscribe' });
    }

    return handleOnlineOrderPost_(e);
  } catch (err) {
    var errCode = String(err.message || err);
    try { console.error('doPost error: ' + errCode); } catch (logErr) {}
    var orderType = param_(e, 'RecordType');
    var isOrderReq = orderType === 'Order' || (!orderType && param_(e, 'Name') && param_(e, 'Phone'));
    if (isOrderReq) {
      var friendly = orderErrorMessage_(errCode);
      if (friendly.indexOf('WhatsApp') === -1 && errCode && errCode.length < 120) {
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

// ── Online Order (A–H + Order ID কলাম I) ──

function orderErrorMessage_(code) {
  var map = {
    SPAM: 'অবৈধ অনুরোধ।',
    TOO_FAST: 'অনুগ্রহ করে ফর্ম পূরণ করে আবার চেষ্টা করুন।',
    EXPIRED: 'সেশন শেষ। পেজ রিফ্রেশ করে আবার অর্ডার করুন।',
    INVALID_NAME: 'সঠিক নাম লিখুন।',
    INVALID_PHONE: 'সঠিক ১১ ডিজিট মোবাইল নম্বর দিন (01XXXXXXXXX)।',
    INVALID_ADDRESS: 'সম্পূর্ণ ডেলিভারি ঠিকানা লিখুন।',
    INVALID_QTY: 'অর্ডার পরিমাণ সঠিক নয়।',
    MIN_ORDER: 'ন্যূনতম অর্ডার ৳১০০।',
    EMPTY_CART: 'কার্টে কোনো পণ্য নেই।',
    ORDER_RATE_LIMIT: 'এই নম্বর থেকে খুব দ্রুত অর্ডার হয়েছে। ৩০ মিনিট পর আবার চেষ্টা করুন।',
    DUPLICATE_ORDER: 'একই অর্ডার ইতিমধ্যে পাঠানো হয়েছে।'
  };
  return map[code] || 'অর্ডার গ্রহণ করা যায়নি। WhatsApp এ যোগাযোগ করুন।';
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

  return {
    name: name,
    phone: phone,
    address: address,
    qty: qty,
    total: total,
    district: param_(e, 'District'),
    slotItems: slotItems,
    design: slotItems.length ? formatOrderDesignLines_(slotItems) : design
  };
}

/** প্রতিটি প্রোডাক্ট আলাদা লাইনে — Sheet column G পড়তে সহজ */
function formatOrderDesignLines_(slotItems) {
  var lines = [];
  var i;
  for (i = 0; i < slotItems.length; i++) {
    var raw = String(slotItems[i] || '').trim();
    if (!raw) continue;
    if (/^\d+\.\s/.test(raw)) {
      lines.push(raw);
    } else {
      lines.push((lines.length + 1) + '. ' + raw);
    }
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
    cell.setWrap(true);
    cell.setVerticalAlignment('top');
    var lineCount = text.split('\n').length;
    sheet.setRowHeight(row, Math.min(420, Math.max(72, lineCount * 20 + 16)));
  } catch (fmtErr) {}
}

function buildCourierItemDescription_(ctx) {
  var lines = [];
  if (ctx && ctx.slotItems && ctx.slotItems.length) {
    lines = ctx.slotItems.slice();
  } else if (ctx && ctx.design) {
    lines = String(ctx.design).split(/\n|,/).map(function (s) { return String(s || '').trim(); }).filter(Boolean);
  }
  var qty = parseInt(ctx && ctx.qty, 10) || 0;
  var prefix = qty > 0 ? ('Total ' + qty + ' pcs · ') : '';
  if (!lines.length) return prefix + String((ctx && ctx.design) || 'Muslim Abaya order').slice(0, 200);
  var summary = lines.slice(0, 4).join(' | ');
  if (lines.length > 4) summary += ' | +' + (lines.length - 4) + ' more';
  return (prefix + summary).slice(0, 200);
}

function rateLimitOrder_(phone) {
  var normalized = normalizePhone_(phone);
  var bypassRaw = PropertiesService.getScriptProperties().getProperty('ORDER_RATE_LIMIT_BYPASS') || '01971642683';
  var bypassParts = String(bypassRaw).split(/[,;\s]+/);
  var b;
  for (b = 0; b < bypassParts.length; b++) {
    if (normalizePhone_(bypassParts[b]) === normalized) return;
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

function generateOrderId_() {
  var now = new Date();
  var datePart = Utilities.formatDate(now, 'GMT+6', 'yyyyMMdd');
  var rand = Math.floor(Math.random() * 9000) + 1000;
  return 'MA-' + datePart + '-' + rand;
}

function handleOnlineOrderPost_(e) {
  var validated = validateOrderInput_(e);
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

  var totalStr = String(validated.total);
  var payment = param_(e, 'PaymentMethod') || 'Cash On Delivery';
  var txn = (param_(e, 'TransactionID') || param_(e, 'SenderNumber') || '').trim();
  var notes = (param_(e, 'SpecialNotes') || '').trim();
  var district = param_(e, 'District') || validated.district || '';

  ensureOnlineOrderHeaders_(sheet);
  ensureOnlineOrderImageHeaders_(sheet);

  appendRow_(sheet, [
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
  ]);

  var newRow = sheet.getLastRow();
  formatOnlineOrderProductCell_(sheet, newRow, validated.design);
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

  try {
    sendToFacebookCAPI({
      Name: validated.name,
      Phone: validated.phone,
      Total: totalStr,
      Design: validated.design
    }, eventID);
  } catch (err) {
    console.log('CAPI Error: ' + err.message);
  }

  return ContentService.createTextOutput('Success|' + orderId).setMimeType(ContentService.MimeType.TEXT);
}

// ── Steadfast Courier (Sheet menu + webhook) ──

function onOpen() {
  try {
    var orderSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
    if (orderSheet) {
      ensureOnlineOrderHeaders_(orderSheet);
      ensureOnlineOrderImageHeaders_(orderSheet);
    }
    selfHealSteadfastBaseUrl_();
    selfHealAutoCourierSetup_();
    SpreadsheetApp.getUi()
      .createMenu('Muslim Abaya')
      .addItem('Steadfast — selected row পাঠান', 'steadfastSendActiveRow')
      .addItem('Steadfast — balance দেখুন', 'steadfastShowBalance')
      .addItem('Steadfast API URL fix করুন', 'setSteadfastBaseUrlToApi_')
      .addItem('Sheet headers (J–Q + ছবি R–AC) সেট করুন', 'setupOnlineOrderExtraHeaders')
      .addItem('Selected row — ছবি thumbnail ঠিক করুন', 'repairOnlineOrderImagesActiveRow')
      .addItem('Auto courier — Confirmed হলে পাঠান', 'setupAutoCourierConfirmedMode')
      .addItem('Auto courier — Order হলেই instant', 'setupAutoCourierInstantMode')
      .addItem('Auto courier — status দেখুন', 'showAutoCourierStatus')
      .addItem('Steadfast — selected row retry auto', 'steadfastRetryAutoActiveRow')
      .addSeparator()
      .addItem('Admin account তৈরি (প্রথমবার)', 'createFirstAdminFromMenu')
      .addToUi();
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
    var col = ONLINE_ORDER_IMAGE_COL + i;
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
        sheet.setColumnWidth(ONLINE_ORDER_IMAGE_COL + c, 96);
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
    var cell = sheet.getRange(row, ONLINE_ORDER_IMAGE_COL + i);
    var note = String(cell.getNote() || '').trim();
    var val = String(cell.getDisplayValue() || cell.getValue() || '').trim();
    if (note.indexOf('http') === 0) urls.push(note);
    else if (val.indexOf('http') === 0) urls.push(val);
    else if (val && val !== 'Photo') urls.push(val);
  }
  if (!urls.length) {
    SpreadsheetApp.getUi().alert('এই row-এ R–W তে কোনো ছবি URL পাওয়া যায়নি।');
    return;
  }
  setOrderProductImages_(sheet, row, urls);
  SpreadsheetApp.getUi().alert('Row ' + row + ': ছবি thumbnail আপডেট হয়েছে।');
}

/** কলাম I–Q (৯–১৭) হেডার — অর্ডার লেখার আগে অটো চালায় */
function ensureOnlineOrderHeaders_(sheet) {
  if (!sheet) return;
  var headers = getOnlineOrderExtraHeaders_();
  var current = sheet.getRange(1, 9, 1, headers.length).getValues()[0];
  var needsUpdate = false;
  for (var i = 0; i < headers.length; i++) {
    if (!String(current[i] || '').trim()) {
      needsUpdate = true;
      break;
    }
  }
  if (!needsUpdate) return;
  var headerRange = sheet.getRange(1, 9, 1, headers.length);
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
  var startCol = ONLINE_ORDER_IMAGE_COL;
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
  SpreadsheetApp.getUi().alert('কলাম I–Q ও R–W (ছবি) হেডার সেট হয়েছে। A–H আগে থেকে থাকলে সেগুলো অপরিবর্তিত।');
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
    var prev = String(sheet.getRange(row, 17).getValue() || '');
    if (prev.indexOf(note) !== -1) return;
    sheet.getRange(row, 17).setValue(prev ? (prev + ' | ' + note) : note);
  } catch (err) {}
}

function tryAutoCourierForOrder_(ctx) {
  try {
    if (!ctx || !ctx.sheet || !ctx.row) return { ok: false, reason: 'CTX_MISSING' };
    if (!isAutoCourierEnabled_()) return { ok: false, reason: 'AUTO_OFF' };

    var keys = getSteadfastKeys_();
    if (!keys.apiKey || !keys.secretKey) {
      var missNote = 'AUTO_COURIER: API Key/Secret missing — Apps Script → Script properties';
      var prevMiss = String(ctx.sheet.getRange(ctx.row, 17).getValue() || '');
      ctx.sheet.getRange(ctx.row, 17).setValue(prevMiss ? (prevMiss + ' | ' + missNote) : missNote);
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
      var prevNotes = String(ctx.sheet.getRange(ctx.row, 17).getValue() || '');
      var nextNotes = prevNotes ? (prevNotes + ' | ') : '';
      ctx.sheet.getRange(ctx.row, 17).setValue(nextNotes + 'AUTO_COURIER_FAIL:' + failMsg.slice(0, 120));
      return { ok: false, reason: 'API_FAIL', raw: res };
    }

    ctx.sheet.getRange(ctx.row, 10, 1, 4).setValues([[
      'Shipped',
      c.tracking_code || '',
      c.consignment_id || '',
      c.status || 'in_review'
    ]]);
    return {
      ok: true,
      tracking: c.tracking_code || '',
      consignmentId: c.consignment_id || ''
    };
  } catch (err) {
    try {
      var msg = String(err && err.message ? err.message : err);
      var prev = String(ctx.sheet.getRange(ctx.row, 17).getValue() || '');
      ctx.sheet.getRange(ctx.row, 17).setValue((prev ? prev + ' | ' : '') + 'AUTO_COURIER_ERR:' + msg.slice(0, 120));
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
    appendAutoCourierNote_(sheet, row, 'AUTO_COURIER: Confirmed mode — J=Confirmed করলে Steadfast');
    return;
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
    ? 'Confirmed mode: Status (J) = Confirmed করলে Steadfast auto।'
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
  var vals = sheet.getRange(row, 1, 1, 17).getValues()[0];
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
    slotItems: [],
    qty: parseInt(String(vals[3] || '0'), 10) || 0,
    total: parseFloat(String(vals[7] || '0').replace(/[^\d.]/g, '')) || 0,
    payment: String(vals[14] || 'Cash On Delivery')
  });
  if (res && res.ok) {
    SpreadsheetApp.getUi().alert('Steadfast OK!\nTracking: ' + (res.tracking || '—'));
    return;
  }
  var note = String(sheet.getRange(row, 17).getValue() || '');
  SpreadsheetApp.getUi().alert(
    'Auto courier failed.\n\n' +
    'Reason: ' + String((res && res.reason) || 'UNKNOWN') + '\n' +
    (note ? ('Notes (Q): ' + note.slice(0, 200)) : '') + '\n\n' +
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
    '② ফোনে verify → Status (J) = Confirmed\n' +
    '③ Steadfast-এ auto পাঠাবে (Tracking K-তে)'
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
    if (range.getColumn() !== 10) return; // J = Status
    if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;
    var newStatus = String(range.getValue() || '').toLowerCase().trim();
    if (newStatus !== 'confirmed') return;
    if (!isAutoCourierEnabled_() || !shouldAutoCourierOnConfirmed_()) return;

    var row = range.getRow();
    if (row <= 1) return;
    var vals = sheet.getRange(row, 1, 1, 17).getValues()[0];
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
      total: parseFloat(String(vals[7] || '0').replace(/[^\d.]/g, '')) || 0,
      payment: String(vals[14] || 'Cash On Delivery')
    });

    if (!autoRes || !autoRes.ok) {
      var prev = String(sheet.getRange(row, 17).getValue() || '');
      var note = 'AUTO_CONFIRM_FAIL';
      sheet.getRange(row, 17).setValue(prev ? (prev + ' | ' + note) : note);
    }
  } catch (err) {
    // Avoid breaking onEdit trigger execution.
  }
}

function steadfastSendActiveRow() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order') ||
    SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = sheet.getActiveCell().getRow();
  if (row < 1) return;
  var vals = sheet.getRange(row, 1, 1, 17).getValues()[0];
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
  var payload = {
    invoice: invoice.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 40),
    recipient_name: name.slice(0, 100),
    recipient_phone: phone,
    recipient_address: address,
    cod_amount: codAmount,
    note: 'Muslim Abaya',
    item_description: design.slice(0, 200)
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
  sheet.getRange(row, 10, 1, 4).setValues([[
    'Shipped',
    c.tracking_code || '',
    c.consignment_id || '',
    c.status || 'in_review'
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
  var invoice = String(payload.invoice || '').trim();
  if (!invoice) return;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  var i;
  for (i = 1; i < data.length; i++) {
    if (String(data[i][8] || '').trim() !== invoice) continue;
    sheet.getRange(i + 1, 11, 1, 3).setValues([[
      payload.tracking_code || data[i][10] || '',
      payload.consignment_id || data[i][11] || '',
      payload.status || ''
    ]]);
    if (payload.status === 'delivered') {
      sheet.getRange(i + 1, 10).setValue('Delivered');
    }
    return;
  }
}

function getDistrictChargeMap_() {
  return { 'ঢাকা': 80 };
}

function sendToFacebookCAPI(data, eventID) {
  var props = PropertiesService.getScriptProperties();
  var accessToken = props.getProperty('FB_ACCESS_TOKEN');
  var pixelId = props.getProperty('FB_PIXEL_ID');
  if (!accessToken || !pixelId) return;

  var url = 'https://graph.facebook.com/v18.0/' + pixelId + '/events?access_token=' + accessToken;
  var cleanPhone = String(data.Phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.indexOf('0') === 0) cleanPhone = '88' + cleanPhone;

  var payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventID,
      action_source: 'website',
      user_data: {
        ph: [SHA256_Hash(cleanPhone)],
        fn: [SHA256_Hash(String(data.Name || '').toLowerCase().trim())]
      },
      custom_data: {
        currency: 'BDT',
        value: parseFloat(data.Total) || 0,
        content_name: data.Design || '',
        content_type: 'product'
      }
    }]
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
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

function appendRow_(sheet, values) {
  var row = sheet.getLastRow() + 1;
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
  return ensureSheet_('Admins', ['Email', 'Phone', 'Name', 'PasswordHash', 'Salt', 'Status', 'CreatedAt']);
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
      return { email: data[i][0], phone: data[i][1], name: data[i][2], hash: data[i][3], salt: data[i][4], status: data[i][5] };
    }
  }
  return null;
}

function findAdminByPhone_(phone) {
  var data = getAdminsSheet_().getDataRange().getValues();
  var target = normalizePhone_(phone);
  for (var i = 1; i < data.length; i++) {
    if (normalizePhone_(data[i][1]) === target) {
      return { email: data[i][0], phone: data[i][1], name: data[i][2], hash: data[i][3], salt: data[i][4], status: data[i][5] };
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
  if (user.status === 'blocked') return { ok: false, error: 'BLOCKED', message: 'অ্যাকাউন্ট বন্ধ।' };
  if (!verifyPassword_(password, user.salt, user.hash)) {
    return { ok: false, error: 'INVALID_PASSWORD', message: 'পাসওয়ার্ড ভুল।' };
  }
  return createSession_({ email: user.email, phone: user.phone, name: user.name }, 'admin');
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

function verifyAdminSession_(token) {
  var v = verifySession_(token);
  if (!v.ok) return v;
  if (v.role !== 'admin') return { ok: false, error: 'NOT_ADMIN', message: 'অ্যাডমিন লগইন প্রয়োজন।' };
  try {
    v.sheetUrl = SpreadsheetApp.getActiveSpreadsheet().getUrl();
    v.scriptUrl = 'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/edit';
  } catch (err) {}
  return v;
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
  var data = sheet.getDataRange().getValues();
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

  var data = sheet.getDataRange().getValues();
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
  appendRow_(admins, [email, phone, name, hashed.hash, hashed.salt, 'active', new Date()]);
  ui.alert(
    'অ্যাডমিন তৈরি হয়েছে।\n\n' +
    'লগইন: আপনার সাইটে /admin-login.html\n' +
    'ইমেইল: ' + email + '\n\n' +
    'কোড আপলোডের পর Deploy → New version করুন।'
  );
}
