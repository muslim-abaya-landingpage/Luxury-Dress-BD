/**
 * Muslim Abaya — Newsletter / Subscribe Web App
 * Sheet: Email (বা Contact) | Date & Time
 */

function doGet() {
  return ContentService
    .createTextOutput('Subscribe API is running')
    .setMimeType(ContentService.MimeType.TEXT);
}

function ensureHeaders_(sheet) {
  var a1 = String(sheet.getRange(1, 1).getValue() || '').trim();
  if (!a1) {
    sheet.getRange(1, 1, 1, 2).setValues([['Email', 'Date & Time']]);
  }
}

function isEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

/** বাংলাদেশি মোবাইল: 01XXXXXXXXX (০ সহ) */
function normalizePhoneBD_(raw) {
  var digits = String(raw || '').replace(/[^\d]/g, '');
  if (digits.indexOf('880') === 0 && digits.length >= 12) {
    digits = '0' + digits.substring(3);
  }
  if (digits.length === 10 && digits.charAt(0) === '1') {
    digits = '0' + digits;
  }
  return digits;
}

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    ensureHeaders_(sheet);

    var raw = '';
    if (e && e.parameter) {
      raw = String(e.parameter.contact || e.parameter.email || '').trim();
    }

    if (!raw) {
      return ContentService
        .createTextOutput('Error: contact is required')
        .setMimeType(ContentService.MimeType.TEXT);
    }

    var valueToSave = raw;
    if (isEmail_(raw)) {
      valueToSave = raw;
    } else {
      valueToSave = normalizePhoneBD_(raw);
      var ok = valueToSave.length >= 11 && valueToSave.charAt(0) === '0';
      if (!ok) {
        return ContentService
          .createTextOutput('Error: invalid phone')
          .setMimeType(ContentService.MimeType.TEXT);
      }
    }

    var nextRow = sheet.getLastRow() + 1;
    var contactCell = sheet.getRange(nextRow, 1);
    var dateCell = sheet.getRange(nextRow, 2);

    // মোবাইল নম্বর টেক্সট হিসেবে সেভ — শুরুর ০ হারাবে না
    contactCell.setNumberFormat('@');
    contactCell.setValue(String(valueToSave));
    dateCell.setValue(new Date());

    return ContentService
      .createTextOutput('Success')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return ContentService
      .createTextOutput('Error: ' + err.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}
