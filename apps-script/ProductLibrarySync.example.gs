/*
 * ProductLibrary two-way sync example.
 * This file is NOT wired into the live Apps Script deployment yet.
 * Existing helpers required in the same Apps Script project:
 *   param_(), verifyAdminSession_(), requireOwnerAdmin_(), cpHead_()
 * Route both RecordTypes inside doPost() after the existing Admin rate limit:
 *   if (type === 'AdminProductSheetRead' || type === 'AdminProductSheetWrite')
 *     return jsonOut_(productLibrarySheetHandle_(type, e));
 * Use the dedicated ProductLibrary tab; never overwrite ProductList.
 */
var PRODUCT_LIBRARY_HEADERS_ = [
  'SKU', 'Name', 'Category', 'Price', 'Image', 'Sizes JSON', 'Color',
  'Color Label', 'Fabric', 'Stock', 'Detail Note', 'Images JSON',
  'Variant Matrix JSON', 'Price By Type JSON', 'Color Variants JSON'
];
var PRODUCT_LIBRARY_MAX_ROWS_ = 1000;

function productLibrarySafeText_(value) {
  var text = String(value == null ? '' : value);
  // Prevent product text from being interpreted as a spreadsheet formula.
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function productLibrarySpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('PRODUCT_LIBRARY_SPREADSHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('PRODUCT_LIBRARY_SPREADSHEET_ID_REQUIRED');
  return ss;
}

function productLibrarySheet_() {
  var ss = productLibrarySpreadsheet_();
  var sheet = ss.getSheetByName('ProductLibrary') || ss.insertSheet('ProductLibrary');
  if (sheet.getMaxColumns() < PRODUCT_LIBRARY_HEADERS_.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), PRODUCT_LIBRARY_HEADERS_.length - sheet.getMaxColumns());
  }
  var headerRange = sheet.getRange(1, 1, 1, PRODUCT_LIBRARY_HEADERS_.length);
  var current = headerRange.getDisplayValues()[0];
  var needsWrite = false;
  for (var i = 0; i < PRODUCT_LIBRARY_HEADERS_.length; i++) {
    if (String(current[i] || '').trim() && String(current[i]).trim() !== PRODUCT_LIBRARY_HEADERS_[i]) {
      throw new Error('PRODUCT_LIBRARY_HEADER_CONFLICT');
    }
    if (!String(current[i] || '').trim()) needsWrite = true;
  }
  if (needsWrite) headerRange.setValues([PRODUCT_LIBRARY_HEADERS_]);
  return sheet;
}

function productLibraryJsonCell_(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return JSON.stringify(value);
  return String(value || '');
}

function productLibrarySheetHandle_(type, e) {
  var who = verifyAdminSession_(param_(e, 'Token'));
  if (!who || !who.ok) return who || { ok: false, error: 'NOT_ADMIN' };
  var ownerError = requireOwnerAdmin_(who);
  if (ownerError) return ownerError;

  var sheet = productLibrarySheet_();
  var properties = PropertiesService.getScriptProperties();

  if (type === 'AdminProductSheetRead') {
    var current = cpHead_();
    var values = sheet.getDataRange().getDisplayValues();
    var items = [];
    for (var i = 1; i < values.length; i++) {
      var r = values[i];
      if (!String(r[0] || '').trim()) continue;
      items.push({
        id: String(r[0]).trim(), name: String(r[1] || '').trim(),
        category: String(r[2] || '').trim(), price: r[3], image: String(r[4] || '').trim(),
        sizes: String(r[5] || ''), color: String(r[6] || '').trim(),
        colorLabel: String(r[7] || '').trim(), fabric: String(r[8] || '').trim(),
        stock: r[9], detailNote: String(r[10] || ''), images: String(r[11] || ''),
        variantMatrix: String(r[12] || ''), priceByType: String(r[13] || ''),
        colorVariants: String(r[14] || '')
      });
    }
    var baseHead = properties.getProperty('PRODUCT_LIBRARY_BASE_HEAD') || '';
    return { ok: true, items: items, baseHead: baseHead, currentHead: current.head, stale: !!baseHead && baseHead !== current.head };
  }

  if (type !== 'AdminProductSheetWrite') return { ok: false, error: 'UNKNOWN_TYPE' };

  var expectedHead = String(param_(e, 'ExpectedHead') || '').trim();
  var before = cpHead_();
  if (!/^[a-f0-9]{40}$/.test(expectedHead) || before.head !== expectedHead) {
    return { ok: false, error: 'CATALOG_CONFLICT', message: 'সাইটের ক্যাটালগ বদলেছে। Product Manager থেকে বর্তমান ডেটা আবার লোড করে পুনরায় export করুন।' };
  }

  var payload;
  try { payload = JSON.parse(param_(e, 'Payload') || '{}'); }
  catch (err) { return { ok: false, error: 'INVALID_JSON', message: 'শিট export-এর ডেটা পড়া যায়নি।' }; }
  var rows = payload && payload.items;
  if (!Array.isArray(rows) || rows.length > PRODUCT_LIBRARY_MAX_ROWS_) {
    return { ok: false, error: 'INVALID_ROWS', message: 'পণ্য তালিকা নেই অথবা 1000 সারির বেশি।' };
  }

  var seen = Object.create(null), table = [PRODUCT_LIBRARY_HEADERS_];
  for (var j = 0; j < rows.length; j++) {
    var p = rows[j] || {};
    var id = String(p.id || p.sku || '').trim();
    var name = String(p.name || '').trim();
    var category = String(p.category || '').trim();
    var price = Number(p.price);
    if (!id || !name || !category || !Number.isFinite(price) || price < 0 || seen[id.toLowerCase()]) {
      return { ok: false, error: 'INVALID_PRODUCT_ROW', message: 'সারি ' + (j + 2) + '-এ SKU, নাম, ক্যাটাগরি, দাম যাচাই করুন; SKU অনন্য হতে হবে।' };
    }
    seen[id.toLowerCase()] = true;
    var stock = p.stock === '' || p.stock == null ? '' : Number(p.stock);
    if (stock !== '' && (!Number.isInteger(stock) || stock < 0)) {
      return { ok: false, error: 'INVALID_STOCK', message: 'সারি ' + (j + 2) + '-এ Stock শূন্য বা ধনাত্মক পূর্ণসংখ্যা হতে হবে।' };
    }
    table.push([
      productLibrarySafeText_(id), productLibrarySafeText_(name), productLibrarySafeText_(category), price,
      productLibrarySafeText_(p.image || ''), productLibrarySafeText_(productLibraryJsonCell_(p.sizes)),
      productLibrarySafeText_(p.color || ''), productLibrarySafeText_(p.colorLabel || ''),
      productLibrarySafeText_(p.fabric || ''), stock, productLibrarySafeText_(p.detailNote || ''),
      productLibrarySafeText_(productLibraryJsonCell_(p.images)),
      productLibrarySafeText_(productLibraryJsonCell_(p.variantMatrix)),
      productLibrarySafeText_(productLibraryJsonCell_(p.priceByType)),
      productLibrarySafeText_(productLibraryJsonCell_(p.colorVariants))
    ]);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var lockedCurrent = cpHead_();
    if (lockedCurrent.head !== expectedHead) {
      return { ok: false, error: 'CATALOG_CONFLICT', message: 'Export চলাকালে সাইটের catalog বদলেছে। Product Manager থেকে reload করে আবার export করুন।' };
    }
    // Replace only the dedicated mirror tab after the full batch has validated.
    sheet.clearContents();
    sheet.getRange(1, 1, table.length, PRODUCT_LIBRARY_HEADERS_.length).setValues(table);
    sheet.setFrozenRows(1);
    properties.setProperty('PRODUCT_LIBRARY_BASE_HEAD', expectedHead);
    properties.setProperty('PRODUCT_LIBRARY_SYNCED_AT', new Date().toISOString());
    return { ok: true, count: rows.length, baseHead: expectedHead, syncedAt: properties.getProperty('PRODUCT_LIBRARY_SYNCED_AT') };
  } finally {
    lock.releaseLock();
  }
}
