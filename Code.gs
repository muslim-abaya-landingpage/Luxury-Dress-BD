/**
 * Muslim Abaya — সম্পূর্ণ Web App (এক ফাইলে পেস্ট করুন)
 * Code.gs → Ctrl+A → Ctrl+V → Save → Deploy → New version
 *
 * Script properties: AUTH_SECRET (Sign Up এর জন্য)
 * ঐচ্ছিক: FB_ACCESS_TOKEN, FB_PIXEL_ID
 */

function doGet(e) {
  try {
    var type = param_(e, 'RecordType');
    if (type === 'AuthVerify') {
      return jsonOut_(verifySession_(param_(e, 'Token')));
    }
  } catch (err) {}
  return ContentService.createTextOutput('Muslim Abaya API OK').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var type = param_(e, 'RecordType');
    var isOrder = type === 'Order' || (!type && param_(e, 'Name') && param_(e, 'Phone'));
    var isSubscribe = !!(param_(e, 'contact') || param_(e, 'email'));

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
    if (isSubscribe) {
      var sub = ensureSheet_('Subscribe', ['Contact', 'Date & Time']);
      appendRow_(sub, [param_(e, 'contact') || param_(e, 'email'), new Date()]);
      return ContentService.createTextOutput('Success').setMimeType(ContentService.MimeType.TEXT);
    }

    return handleOnlineOrderPost_(e);
  } catch (err) {
    if (String(err.message || err) === 'RATE_LIMIT') {
      return jsonOut_({ ok: false, error: 'RATE_LIMIT', message: 'অনেকবার চেষ্টা। কিছুক্ষণ পর আবার করুন।' });
    }
    return jsonOut_({ ok: false, error: String(err.message || err) });
  }
}

// ── Online Order (আপনার A–H শিট ফরম্যাট) ──

function handleOnlineOrderPost_(e) {
  var SHEET_NAME = 'Online Order';
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getActiveSheet();

  var now = new Date();
  var timestamp = Utilities.formatDate(now, 'GMT+6', 'dd-MM-yyyy HH:mm:ss');

  var name = param_(e, 'Name');
  var phone = param_(e, 'Phone');
  var qty = parseInt(param_(e, 'Quantity'), 10) || 0;
  var district = param_(e, 'District');
  var address = param_(e, 'Address');
  var design = param_(e, 'Design');
  var total = param_(e, 'Total') || '0';
  var eventID = param_(e, 'EventID') || 'order_' + Date.now();

  var slotItems = [];
  var i;
  for (i = 1; i <= 20; i++) {
    var v = param_(e, 'Product_' + i);
    if (v && String(v).trim() !== '') slotItems.push(String(v).trim());
  }
  var finalDesign = slotItems.length ? slotItems.join(', ') : design;

  var districtChargeMap = getDistrictChargeMap_();
  var charge = 0;
  if (qty > 0 && qty < 3) {
    charge = districtChargeMap[district] || 150;
  }

  var row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, row, 8).setValues([
    [timestamp, name, phone, qty, charge, address, finalDesign, total]
  ]);
  sheet.getRange(row, 3).setNumberFormat('@');

  try {
    sendToFacebookCAPI({ Name: name, Phone: phone, Total: total, Design: finalDesign }, eventID);
  } catch (err) {
    console.log('CAPI Error: ' + err.message);
  }

  return ContentService.createTextOutput('Success').setMimeType(ContentService.MimeType.TEXT);
}

function getDistrictChargeMap_() {
  return {
    'ঢাকা': 80,
    'গাজীপুর': 100, 'নারায়ণগঞ্জ': 100, 'নরসিংদী': 100, 'মুন্সীগঞ্জ': 100, 'মানিকগঞ্জ': 100,
    'টাঙ্গাইল': 150, 'কিশোরগঞ্জ': 150, 'ময়মনসিংহ': 150, 'শেরপুর': 150, 'জামালপুর': 150, 'নেত্রকোনা': 150,
    'মাদারীপুর': 150, 'রাজবাড়ী': 150, 'ফরিদপুর': 150, 'গোপালগঞ্জ': 150, 'শরীয়তপুর': 150,
    'চট্টগ্রাম': 150, 'কুমিল্লা': 150, 'চাঁদপুর': 150, 'ফেনী': 150, 'ব্রাহ্মণবাড়িয়া': 150,
    'নোয়াখালী': 150, 'লক্ষ্মীপুর': 150, 'কক্সবাজার': 150, 'খাগড়াছড়ি': 150, 'রাঙ্গামাটি': 150, 'বান্দরবান': 150,
    'রাজশাহী': 150, 'নওগাঁ': 150, 'নাটোর': 150, 'চাঁপাইনবাবগঞ্জ': 150, 'পাবনা': 150, 'সিরাজগঞ্জ': 150,
    'জয়পুরহাট': 150, 'বগুড়া': 150,
    'রংপুর': 150, 'দিনাজপুর': 150, 'পঞ্চগড়': 150, 'নীলফামারী': 150, 'লালমনিরহাট': 150, 'কুড়িগ্রাম': 150,
    'গাইবান্ধা': 150, 'ঠাকুরগাঁও': 150,
    'সিলেট': 150, 'সুনামগঞ্জ': 150, 'হবিগঞ্জ': 150, 'মৌলভীবাজার': 150,
    'খুলনা': 150, 'বাগেরহাট': 150, 'সাতক্ষীরা': 150, 'নড়াইল': 150, 'যশোর': 150, 'মাগুরা': 150,
    'ঝিনাইদহ': 150, 'কুষ্টিয়া': 150, 'চুয়াডাঙ্গা': 150, 'মেহেরপুর': 150,
    'বরিশাল': 150, 'পটুয়াখালী': 150, 'ভোলা': 150, 'বরগুনা': 150, 'ঝালকাঠি': 150, 'পিরোজপুর': 150
  };
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
  return getParams_(e)[key] || '';
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
  return ensureSheet_('Sessions', ['Token', 'Email', 'Phone', 'Name', 'CreatedAt', 'ExpiresAt']);
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

function createSession_(user) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  appendRow_(getSessionsSheet_(), [token, user.email, user.phone, user.name, new Date(), expires]);
  return { ok: true, token: token, email: user.email, phone: user.phone, name: user.name, expires: expires.getTime() };
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
  return createSession_({ email: email, phone: phone, name: name });
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
  return createSession_({ email: user.email, phone: user.phone, name: user.name });
}

function verifySession_(token) {
  if (!token) return { ok: false, error: 'NO_TOKEN' };
  var data = getSessionsSheet_().getDataRange().getValues();
  var now = Date.now();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) !== token) continue;
    var expMs = data[i][5] instanceof Date ? data[i][5].getTime() : new Date(data[i][5]).getTime();
    if (expMs && now > expMs) return { ok: false, error: 'EXPIRED' };
    return { ok: true, token: token, email: data[i][1], phone: data[i][2], name: data[i][3], expires: expMs };
  }
  return { ok: false, error: 'INVALID_TOKEN' };
}
