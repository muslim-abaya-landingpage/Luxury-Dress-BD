/**
 * OrderSync — Online Order sheet mirror
 *
 * Setup:
 * 1. Run setOrderSyncMirrorIdFromMenu() once, or set the
 *    ORDERSYNC_MIRROR_SPREADSHEET_ID script property manually.
 * 2. Run setupOrderSyncTrigger() once for a 15-minute sync.
 * 3. Run runOrderSyncNowFromMenu() to test immediately.
 */

var ORDERSYNC_MIRROR_PROPERTY_ = 'ORDERSYNC_MIRROR_SPREADSHEET_ID';
var ORDERSYNC_DEFAULT_MIRROR_ID_ = '15zmNokNrI7-0Tb5pWPLUvH_s4d84o8g13Ozo9i5yHyc';
var ORDERSYNC_SHEET_NAME_ = 'OrderSync';
var ORDERSYNC_LOG_SHEET_NAME_ = 'AutomationLogs';
var ORDERSYNC_REPORT_SHEET_NAME_ = 'AutomationReports';

function getOrderSyncMirrorId_() {
  return String(
    PropertiesService.getScriptProperties()
      .getProperty(ORDERSYNC_MIRROR_PROPERTY_) ||
      ORDERSYNC_DEFAULT_MIRROR_ID_ || ''
  ).trim();
}

function getOrderSyncMirror_() {
  var id = getOrderSyncMirrorId_();
  if (!id) {
    throw new Error(
      'OrderSync mirror spreadsheet ID সেট করা হয়নি। ' +
      'Muslim Abaya → OrderSync — mirror spreadsheet ID সেট করুন।'
    );
  }
  return SpreadsheetApp.openById(id);
}

function getOrCreateOrderSyncSheet_(spreadsheet) {
  return spreadsheet.getSheetByName(ORDERSYNC_SHEET_NAME_) ||
    spreadsheet.insertSheet(ORDERSYNC_SHEET_NAME_);
}

function getOrCreateAutomationLogSheet_(spreadsheet) {
  var sheet = spreadsheet.getSheetByName(ORDERSYNC_LOG_SHEET_NAME_) ||
    spreadsheet.insertSheet(ORDERSYNC_LOG_SHEET_NAME_);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, 6).setValues([[
      'Timestamp', 'Type', 'Status', 'Added', 'Updated', 'Message'
    ]]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function recordAutomationLog_(type, ok, added, updated, message) {
  try {
    var mirror = getOrderSyncMirror_();
    var log = getOrCreateAutomationLogSheet_(mirror);
    log.appendRow([
      new Date(), String(type || ''), ok ? 'OK' : 'ERROR',
      Number(added || 0), Number(updated || 0), String(message || '')
    ]);
    log.getRange(log.getLastRow(), 1).setNumberFormat('dd-MM-yyyy HH:mm:ss');
  } catch (logErr) {
    console.error('AUTOMATION_LOG_FAILED ' + String(logErr.stack || logErr));
  }
}

function configureNotificationProperties(telegramToken, telegramChatId, alertEmail) {
  var props = PropertiesService.getScriptProperties();
  if (telegramToken) props.setProperty('TELEGRAM_BOT_TOKEN', String(telegramToken).trim());
  if (telegramChatId) props.setProperty('TELEGRAM_CHAT_ID', String(telegramChatId).trim());
  if (alertEmail) props.setProperty('NOTIFICATION_ALERT_EMAIL', String(alertEmail).trim());
  return { ok: true, configured: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'NOTIFICATION_ALERT_EMAIL'] };
}

/** Telegram-only message. Returns { ok, error }. Never throws. */
function sendTelegramText_(message) {
  try {
    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty('TELEGRAM_BOT_TOKEN') || '';
    var chatId = props.getProperty('TELEGRAM_CHAT_ID') || '';
    if (!token || !chatId) return { ok: false, error: 'TELEGRAM_BOT_TOKEN বা TELEGRAM_CHAT_ID সেট করা হয়নি।' };
    var response = UrlFetchApp.fetch('https://api.telegram.org/bot' + encodeURIComponent(token) + '/sendMessage', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: message }), muteHttpExceptions: true
    });
    var ok = response.getResponseCode() >= 200 && response.getResponseCode() < 300;
    return ok ? { ok: true } : { ok: false, error: response.getContentText().slice(0, 500) };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
}

function sendAdminAndTelegramNotification_(subject, message) {
  var result = { email: false, telegram: false };
  var props = PropertiesService.getScriptProperties();
  try {
    var emails = [];
    var configuredEmail = props.getProperty('NOTIFICATION_ALERT_EMAIL') || '';
    if (configuredEmail) emails.push(configuredEmail);
    if (typeof getAdminNotifyEmails_ === 'function') emails = emails.concat(getAdminNotifyEmails_());
    emails = emails.filter(function (email, index, list) { return email && list.indexOf(email) === index; });
    if (emails.length) {
      MailApp.sendEmail({ to: emails.join(','), subject: subject, body: message });
      result.email = true;
    }
  } catch (emailErr) { result.emailError = String(emailErr.message || emailErr); }

  var tg = sendTelegramText_(message);
  result.telegram = tg.ok;
  if (tg.error) result.telegramError = tg.error;

  recordAutomationLog_('ALERT', result.email || result.telegram, 0, 0, JSON.stringify(result));
  return result;
}

function testNewOrderNotifications() {
  var testOrderId = 'TEST-NOTIFICATION-' + Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyyMMdd-HHmmss');
  var message = 'Muslim Abaya notification test\n\n' +
    'Order ID: ' + testOrderId + '\n' +
    'Customer: QA Notification Test\n' +
    'Phone: 01971642683\n' +
    'Total: ৳1079\n' +
    'Status: TEST ONLY — DO NOT SHIP';
  return sendAdminAndTelegramNotification_('Order notification test — ' + testOrderId, message);
}

function sendNewOrderAlertOnce_(orderId, message) {
  var id = String(orderId || '').trim();
  if (!id) return;

  var props = PropertiesService.getScriptProperties();
  var sent = {};
  try { sent = JSON.parse(props.getProperty('ORDERSYNC_ALERTED_ORDER_IDS') || '{}') || {}; } catch (err) {}
  if (sent[id]) return;

  var delivered = false;
  try {
    var emails = typeof getAdminNotifyEmails_ === 'function' ? getAdminNotifyEmails_() : [];
    if (emails.length) {
      MailApp.sendEmail({ to: emails.join(','), subject: 'নতুন অর্ডার — ' + id, body: String(message || '') });
      delivered = true;
    }
  } catch (emailErr) {
    console.error('ORDERSYNC_EMAIL_ALERT_FAILED ' + String(emailErr));
  }

  var token = props.getProperty('TELEGRAM_BOT_TOKEN') || '';
  var chatId = props.getProperty('TELEGRAM_CHAT_ID') || '';
  if (token && chatId) {
    try {
      var response = UrlFetchApp.fetch(
        'https://api.telegram.org/bot' + encodeURIComponent(token) + '/sendMessage',
        { method: 'post', contentType: 'application/json',
          payload: JSON.stringify({ chat_id: chatId, text: String(message || '') }),
          muteHttpExceptions: true }
      );
      if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) delivered = true;
    } catch (telegramErr) {
      console.error('ORDERSYNC_TELEGRAM_ALERT_FAILED ' + String(telegramErr));
    }
  }

  if (delivered) {
    sent[id] = new Date().toISOString();
    try {
      props.setProperty('ORDERSYNC_ALERTED_ORDER_IDS', serializeAlertedOrderIds_(sent));
    } catch (propErr) {
      console.error('ORDERSYNC_ALERT_LOG_SAVE_FAILED ' + String(propErr));
    }
    recordAutomationLog_('ALERT', true, 0, 0, 'New order alert sent: ' + id);
  }
}

// Script properties allow at most 9 KB per value. Keep only the newest
// entries that fit (well under the limit) so setProperty never throws.
var ORDERSYNC_ALERTED_MAX_CHARS_ = 7000;
function serializeAlertedOrderIds_(sent) {
  var keys = Object.keys(sent || {}).sort(function (a, b) {
    return String(sent[a]).localeCompare(String(sent[b]));
  });
  var kept = {};
  var json = '{}';
  for (var i = keys.length - 1; i >= 0; i--) {
    kept[keys[i]] = sent[keys[i]];
    var next = JSON.stringify(kept);
    if (next.length > ORDERSYNC_ALERTED_MAX_CHARS_) { delete kept[keys[i]]; break; }
    json = next;
  }
  return json;
}

function configureWhatsAppProperties(accessToken, phoneNumberId, recipient) {
  var props = PropertiesService.getScriptProperties();
  if (accessToken) props.setProperty('WHATSAPP_ACCESS_TOKEN', String(accessToken).trim());
  if (phoneNumberId) props.setProperty('WHATSAPP_PHONE_NUMBER_ID', String(phoneNumberId).trim());
  if (recipient) props.setProperty('WHATSAPP_TEST_RECIPIENT', String(recipient).replace(/\D/g, ''));
  return { ok: true, configured: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_TEST_RECIPIENT'] };
}

function sendWhatsAppUtilityTemplate_(order) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('WHATSAPP_ACCESS_TOKEN');
  var phoneNumberId = props.getProperty('WHATSAPP_PHONE_NUMBER_ID');
  var recipient = String(order.recipient || props.getProperty('WHATSAPP_TEST_RECIPIENT') || '').replace(/\D/g, '');
  var templateName = props.getProperty('WHATSAPP_TEMPLATE_NAME') || 'order_alert';
  var language = props.getProperty('WHATSAPP_TEMPLATE_LANGUAGE') || 'en_US';
  if (!token || !phoneNumberId || !recipient) throw new Error('WhatsApp credentials/recipient are not configured.');

  var payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: [{ type: 'body', parameters: [
        { type: 'text', text: String(order.orderId || '') },
        { type: 'text', text: String(order.name || '') },
        { type: 'text', text: String(order.total || '') },
        { type: 'text', text: String(order.status || 'Pending') }
      ] }]
    }
  };
  var response = UrlFetchApp.fetch(
    'https://graph.facebook.com/v23.0/' + encodeURIComponent(phoneNumberId) + '/messages',
    { method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + token },
      payload: JSON.stringify(payload), muteHttpExceptions: true }
  );
  var code = response.getResponseCode();
  var body = response.getContentText();
  var ok = code >= 200 && code < 300;
  recordAutomationLog_('WHATSAPP_SEND', ok, 0, 0, 'HTTP ' + code + ' ' + body.slice(0, 500));
  if (!ok) throw new Error('WhatsApp API error ' + code + ': ' + body);
  return JSON.parse(body);
}

function logWhatsAppDeliveryStatus_(messageId, status, recipient) {
  recordAutomationLog_('WHATSAPP_DELIVERY', true, 0, 0,
    JSON.stringify({ messageId: messageId, status: status, recipient: recipient }));
}

function monitorWhatsAppQuotaDaily() {
  var mirror = getOrderSyncMirror_();
  var log = getOrCreateAutomationLogSheet_(mirror);
  var rows = log.getDataRange().getValues();
  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  var sent = 0, delivered = 0, failed = 0;
  for (var i = 1; i < rows.length; i++) {
    var when = parseAutomationLogDate_(rows[i][0]);
    if (!when || when.getTime() < monthStart) continue;
    var type = String(rows[i][1] || '');
    var status = String(rows[i][2] || '');
    if (type === 'WHATSAPP_SEND' && status === 'OK') sent++;
    if (type === 'WHATSAPP_SEND' && status !== 'OK') failed++;
    if (type === 'WHATSAPP_DELIVERY' && status === 'OK') delivered++;
  }
  var result = { ok: failed === 0, monthSent: sent, delivered: delivered, failed: failed, freeTierReference: 1000 };
  recordAutomationLog_('WHATSAPP_QUOTA', result.ok, 0, 0, JSON.stringify(result));
  if (sent >= 800) {
    var emails = typeof getAdminNotifyEmails_ === 'function' ? getAdminNotifyEmails_() : [];
    if (emails.length) MailApp.sendEmail({ to: emails.join(','), subject: 'WhatsApp quota warning: ' + sent, body: JSON.stringify(result, null, 2) });
  }
  return result;
}

function whatsappQuotaMonitorTriggerHandler() {
  try { monitorWhatsAppQuotaDaily(); }
  catch (err) { recordAutomationLog_('WHATSAPP_QUOTA', false, 0, 0, String(err.message || err)); }
}

function setupWhatsAppQuotaMonitorTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'whatsappQuotaMonitorTriggerHandler') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('whatsappQuotaMonitorTriggerHandler').timeBased().atHour(4).everyDays(1).create();
}

function findOrderIdColumn_(headers) {
  var aliases = [
    'অর্ডার আইডি',
    'অর্ডার আইডি ',
    'Order ID',
    'OrderId',
    'Order ID '
  ];

  for (var i = 0; i < headers.length; i++) {
    if (aliases.indexOf(String(headers[i] || '').trim()) !== -1) {
      return i;
    }
  }

  // Current Online Order layout: J is Order ID.
  return 9;
}

// In-cell images (CellImage) cannot be written to another spreadsheet with
// setValues ("Service error: Spreadsheets"). Mirror them as their URL instead.
function mirrorSafeValue_(value) {
  if (value && typeof value === 'object' && !(value instanceof Date) &&
      typeof value.toBuilder === 'function') {
    var url = '';
    try { url = (typeof value.getUrl === 'function' && value.getUrl()) || ''; } catch (e) {}
    if (!url) { try { url = (typeof value.getContentUrl === 'function' && value.getContentUrl()) || ''; } catch (e2) {} }
    return url || '[image]';
  }
  return value;
}

function phoneColumnIndexes_(headers) {
  var out = [];
  (headers || []).forEach(function (h, i) {
    if (/মোবাইল|ফোন|phone/i.test(String(h || ''))) out.push(i);
  });
  return out;
}

function mirrorPhoneText_(value) {
  if (value === '' || value === null || typeof value === 'undefined') return '';
  var text = String(value).trim();
  if (/^1[3-9]\d{8}$/.test(text)) text = '0' + text; // BD mobile that lost its leading 0
  return text;
}

function runOrderSyncNow() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var sourceSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var source = sourceSpreadsheet.getSheetByName('Online Order');
    if (!source) {
      throw new Error('Online Order শিট পাওয়া যায়নি।');
    }

    var targetSpreadsheet = getOrderSyncMirror_();
    if (targetSpreadsheet.getId() === sourceSpreadsheet.getId()) {
      throw new Error('Mirror spreadsheet source spreadsheet-এর মতো একই হতে পারবে না।');
    }

    var target = getOrCreateOrderSyncSheet_(targetSpreadsheet);
    var sourceValues = source.getDataRange().getValues();
    if (!sourceValues.length || !sourceValues[0].length) {
      return { ok: true, synced: 0, added: 0, updated: 0 };
    }

    var sourceHeaders = sourceValues[0];
    var orderIdColumn = findOrderIdColumn_(sourceHeaders);
    var targetValues = target.getDataRange().getValues();
    var width = sourceHeaders.length;

    if (target.getMaxColumns() < width) {
      target.insertColumnsAfter(
        target.getMaxColumns(),
        width - target.getMaxColumns()
      );
    }

    // First sync initializes the mirror headers.
    if (!targetValues.length || !targetValues[0].some(function (v) { return v !== ''; })) {
      target.clearContents();
      target.getRange(1, 1, 1, width).setValues([sourceHeaders]);
      targetValues = [sourceHeaders];
    } else if (targetValues[0].length !== width ||
               JSON.stringify(targetValues[0]) !== JSON.stringify(sourceHeaders)) {
      target.getRange(1, 1, 1, width).setValues([sourceHeaders]);
      targetValues[0] = sourceHeaders;
    }

    // Build the whole mirror in memory and write it with ONE setValues call.
    // (Writing row-by-row made every 15-minute run take ~1 call per order and
    // could exhaust the 90 min/day trigger-runtime quota shared with backups
    // and courier sync.)
    var body = [];
    var mirrorRowsById = {};
    for (var r = 1; r < targetValues.length; r++) {
      var existing = targetValues[r].slice(0, width).map(mirrorSafeValue_);
      while (existing.length < width) existing.push('');
      body.push(existing);
      var existingId = String(existing[orderIdColumn] || '').trim();
      if (existingId) mirrorRowsById[existingId] = body.length - 1;
    }

    // First fill of an empty mirror: copy everything but send NO alerts,
    // otherwise every historical order would be e-mailed as "new" (gmail.com
    // accounts may send to only 100 recipients/day).
    var isInitialFill = Object.keys(mirrorRowsById).length === 0;
    var ORDERSYNC_MAX_ALERTS_PER_RUN = 10;
    var added = 0;
    var updated = 0;
    var newOrders = [];

    for (var s = 1; s < sourceValues.length; s++) {
      var row = sourceValues[s].slice(0, width).map(mirrorSafeValue_);
      while (row.length < width) row.push('');

      var orderId = String(row[orderIdColumn] || '').trim();
      if (!orderId) continue;

      if (mirrorRowsById[orderId] != null) {
        body[mirrorRowsById[orderId]] = row;
        updated++;
      } else {
        body.push(row);
        mirrorRowsById[orderId] = body.length - 1;
        added++;
        if (!isInitialFill) newOrders.push(row);
      }
    }

    if (body.length) {
      if (target.getMaxRows() < body.length + 1) {
        target.insertRowsAfter(target.getMaxRows(), body.length + 1 - target.getMaxRows());
      }
      // Phone columns: keep the leading 0 (01XXXXXXXXX). Format as plain text
      // and restore a 0 that an earlier numeric write may have dropped.
      phoneColumnIndexes_(sourceHeaders).forEach(function (c) {
        target.getRange(2, c + 1, body.length, 1).setNumberFormat('@');
        body.forEach(function (r) { r[c] = mirrorPhoneText_(r[c]); });
      });
      target.getRange(2, 1, body.length, width).setValues(body);
    }

    newOrders.slice(-ORDERSYNC_MAX_ALERTS_PER_RUN).forEach(function (newRow) {
      var newId = String(newRow[orderIdColumn] || '').trim();
      sendNewOrderAlertOnce_(
        newId,
        'নতুন অর্ডার এসেছে\n' +
        'Order ID: ' + newId + '\n' +
        'Customer: ' + String(newRow[1] || '') + '\n' +
        'Phone: ' + String(newRow[2] || '') + '\n' +
        'Total: ৳' + String(newRow[8] || '') + '\n' +
        'Status: ' + String(newRow[10] || 'Pending')
      );
    });
    if (newOrders.length > ORDERSYNC_MAX_ALERTS_PER_RUN) {
      recordAutomationLog_('ALERT', true, 0, 0,
        'Alert cap reached: ' + newOrders.length + ' new orders, alerted newest ' + ORDERSYNC_MAX_ALERTS_PER_RUN);
    }

    target.setFrozenRows(1);
    target.getRange(1, 1, 1, width).setFontWeight('bold');
    target.autoResizeColumns(1, Math.min(width, 18));

    PropertiesService.getScriptProperties().setProperty(
      'ORDERSYNC_LAST_SYNC_AT',
      new Date().toISOString()
    );

    var result = {
      ok: true,
      synced: added + updated,
      added: added,
      updated: updated,
      initialFill: isInitialFill,
      alerted: Math.min(newOrders.length, ORDERSYNC_MAX_ALERTS_PER_RUN),
      mirrorSpreadsheetId: targetSpreadsheet.getId(),
      mirrorSheet: ORDERSYNC_SHEET_NAME_
    };
    recordAutomationLog_('SYNC', true, added, updated, 'OrderSync completed');
    console.log('ORDERSYNC_OK ' + JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function runOrderSyncNowFromMenu() {
  try {
    var result = runOrderSyncNow();
    SpreadsheetApp.getUi().alert(
      'OrderSync complete.\n\n' +
      'Added: ' + result.added + '\n' +
      'Updated: ' + result.updated + '\n' +
      'Total synced: ' + result.synced
    );
  } catch (err) {
    SpreadsheetApp.getUi().alert(
      'OrderSync failed:\n\n' + String(err.message || err)
    );
  }
}

function runOrderSyncLiveTestFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var confirmation = ui.alert(
    'OrderSync live test',
    'এটি source order data পড়ে mirror sheet sync করবে এবং নতুন Order ID পাওয়া গেলে notification পাঠাতে পারে। চালাবেন?',
    ui.ButtonSet.YES_NO
  );
  if (confirmation !== ui.Button.YES) return { ok: false, cancelled: true };

  try {
    var result = runOrderSyncNow();
    var health = verifyOrderSyncPollingHealth();
    ui.alert(
      'OrderSync live test complete\n\n' +
      'Added: ' + result.added + '\n' +
      'Updated: ' + result.updated + '\n' +
      'Total synced: ' + result.synced + '\n' +
      'Polling health: ' + (health.ok ? 'OK' : 'CHECK REQUIRED')
    );
    return { sync: result, health: health };
  } catch (err) {
    recordAutomationLog_('SYNC_LIVE_TEST', false, 0, 0, String(err.message || err));
    ui.alert('OrderSync live test failed:\n\n' + String(err.message || err));
    return { ok: false, error: String(err.message || err) };
  }
}

function setOrderSyncMirrorIdFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var current = getOrderSyncMirrorId_();
  var prompt = ui.prompt(
    'OrderSync mirror spreadsheet ID',
    'যে আলাদা Google Sheet-এ OrderSync tab থাকবে তার spreadsheet ID দিন।\n\n' +
      'Current: ' + (current || 'not set'),
    ui.ButtonSet.OK_CANCEL
  );

  if (prompt.getSelectedButton() !== ui.Button.OK) return;

  var id = String(prompt.getResponseText() || '').trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    ui.alert('ভুল spreadsheet ID। Google Sheet URL-এর /d/ এবং /edit-এর মাঝের ID দিন।');
    return;
  }

  // Validate access before saving the property.
  SpreadsheetApp.openById(id).getName();
  PropertiesService.getScriptProperties().setProperty(
    ORDERSYNC_MIRROR_PROPERTY_,
    id
  );
  ui.alert('OrderSync mirror spreadsheet ID সংরক্ষণ করা হয়েছে।');
}

// API/automation setup helper. Safe to call again; it only replaces the
// configured destination after validating that the spreadsheet is accessible.
function configureOrderSyncMirror(spreadsheetId) {
  var id = String(spreadsheetId || '').trim();
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    throw new Error('Invalid mirror spreadsheet ID.');
  }

  var mirror = SpreadsheetApp.openById(id);
  var source = SpreadsheetApp.getActiveSpreadsheet();
  if (source && source.getId() === mirror.getId()) {
    throw new Error('Mirror spreadsheet source spreadsheet-এর মতো একই হতে পারবে না।');
  }

  PropertiesService.getScriptProperties().setProperty(
    ORDERSYNC_MIRROR_PROPERTY_,
    id
  );
  return {
    ok: true,
    mirrorSpreadsheetId: id,
    mirrorSpreadsheetName: mirror.getName()
  };
}

function hasOrderSyncTrigger_() {
  return ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'orderSyncTriggerHandler';
  });
}

function orderSyncTriggerHandler() {
  PropertiesService.getScriptProperties().setProperty(
    'ORDERSYNC_LAST_TRIGGER_AT',
    new Date().toISOString()
  );
  try {
    var result = runOrderSyncNow();
    PropertiesService.getScriptProperties().setProperty(
      'ORDERSYNC_LAST_TRIGGER_RESULT',
      JSON.stringify(result)
    );
  } catch (err) {
    recordAutomationLog_('SYNC', false, 0, 0, String(err.message || err));
    PropertiesService.getScriptProperties().setProperty(
      'ORDERSYNC_LAST_TRIGGER_RESULT',
      JSON.stringify({ ok: false, error: String(err.message || err) })
    );
    console.error('ORDERSYNC_FAILED ' + String(err.stack || err));
  }
}

function verifyOrderSyncPollingHealth() {
  var props = PropertiesService.getScriptProperties();
  var triggers = ScriptApp.getProjectTriggers();
  var matching = triggers.filter(function (trigger) {
    return trigger.getHandlerFunction() === 'orderSyncTriggerHandler' &&
      trigger.getEventType() === ScriptApp.EventType.CLOCK;
  });
  var lastTriggerAt = props.getProperty('ORDERSYNC_LAST_TRIGGER_AT') || '';
  var lastResultText = props.getProperty('ORDERSYNC_LAST_TRIGGER_RESULT') || '{}';
  var lastTrigger = lastTriggerAt ? new Date(lastTriggerAt) : null;
  var ageMinutes = lastTrigger ? (Date.now() - lastTrigger.getTime()) / 60000 : null;
  var lastResult = {};
  try { lastResult = JSON.parse(lastResultText); } catch (err) {}
  var result = {
    ok: matching.length === 1 && ageMinutes !== null && ageMinutes <= 20 && lastResult.ok !== false,
    triggerCount: matching.length,
    lastTriggerAt: lastTriggerAt,
    ageMinutes: ageMinutes,
    lastResult: lastResult,
    recommendation: matching.length !== 1
      ? 'Run setupOrderSyncNewOrderAutomation() once.'
      : (ageMinutes === null || ageMinutes > 20
        ? 'Wait for the next run or run orderSyncTriggerHandler() manually.'
        : 'Polling trigger appears healthy.')
  };
  recordAutomationLog_('SYNC_HEALTH', result.ok, 0, 0, JSON.stringify(result));
  return result;
}

function setupOrderSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'orderSyncTriggerHandler') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('orderSyncTriggerHandler')
    .timeBased()
    .everyMinutes(15)
    .create();

  try { SpreadsheetApp.getUi().alert('OrderSync ON — প্রতি ১৫ মিনিটে sync হবে।'); } catch (uiErr) {}
}

function setupOrderSyncNewOrderAutomation() {
  setupOrderSyncTrigger();
  return {
    ok: true,
    trigger: 'orderSyncTriggerHandler',
    interval: 'every 15 minutes',
    note: 'Website/API writes are detected by polling; manual edits are covered when the sheet is opened and the trigger is authorized.'
  };
}

function disableOrderSyncTrigger() {
  var removed = false;
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'orderSyncTriggerHandler') {
      ScriptApp.deleteTrigger(trigger);
      removed = true;
    }
  });
  SpreadsheetApp.getUi().alert(
    removed
      ? 'OrderSync ১৫-মিনিট trigger বন্ধ করা হয়েছে।'
      : 'OrderSync trigger আগে থেকেই বন্ধ ছিল।'
  );
}

function getOrderSyncStatus_() {
  var props = PropertiesService.getScriptProperties();
  return {
    mirrorSpreadsheetId: getOrderSyncMirrorId_(),
    lastSyncAt: props.getProperty('ORDERSYNC_LAST_SYNC_AT') || '',
    triggerEnabled: hasOrderSyncTrigger_()
  };
}

function verifyAutomationLogs() {
  var mirror = getOrderSyncMirror_();
  var log = getOrCreateAutomationLogSheet_(mirror);
  var rows = log.getDataRange().getValues();
  var cutoff = Date.now() - 24 * 60 * 60 * 1000;
  var syncOk = 0, syncError = 0, backupOk = 0, backupError = 0;

  for (var i = 1; i < rows.length; i++) {
    var when = rows[i][0] instanceof Date ? rows[i][0].getTime() : 0;
    if (when < cutoff) continue;
    var type = String(rows[i][1] || '');
    var status = String(rows[i][2] || '');
    if (type === 'SYNC' && status === 'OK') syncOk++;
    if (type === 'SYNC' && status !== 'OK') syncError++;
    if (type === 'BACKUP' && status === 'OK') backupOk++;
    if (type === 'BACKUP' && status !== 'OK') backupError++;
  }

  var result = {
    ok: syncError === 0 && backupError === 0,
    syncOk: syncOk,
    syncError: syncError,
    backupOk: backupOk,
    backupError: backupError
  };
  recordAutomationLog_('VERIFY', result.ok, 0, 0, JSON.stringify(result));
  return result;
}

function scanAndAlertAutomationErrors() {
  var mirror = getOrderSyncMirror_();
  var log = getOrCreateAutomationLogSheet_(mirror);
  var rows = log.getDataRange().getValues();
  var cutoff = Date.now() - 24 * 60 * 60 * 1000;
  var errors = [];

  for (var i = 1; i < rows.length; i++) {
    var when = parseAutomationLogDate_(rows[i][0]);
    var type = String(rows[i][1] || '');
    var status = String(rows[i][2] || '');
    if (!when || when.getTime() < cutoff || status !== 'ERROR') continue;
    errors.push({
      timestamp: Utilities.formatDate(when, 'Asia/Dhaka', 'dd-MM-yyyy HH:mm:ss'),
      type: type,
      message: String(rows[i][5] || '').slice(0, 300)
    });
  }

  if (!errors.length) {
    recordAutomationLog_('ERROR_SCAN', true, 0, 0, 'No errors in the last 24 hours');
    return { ok: true, errorCount: 0, alerted: false };
  }

  var lines = errors.slice(-20).map(function(item) {
    return item.timestamp + ' | ' + item.type + ' | ' + item.message;
  });
  var message =
    'Automation error alert — গত ২৪ ঘণ্টায় ' + errors.length + 'টি ERROR পাওয়া গেছে।\n\n' +
    lines.join('\n') +
    '\n\nবিস্তারিত: AutomationLogs tab';
  var notify = sendAdminAndTelegramNotification_('AutomationLogs error alert', message);
  recordAutomationLog_('ERROR_ALERT', notify.email || notify.telegram, 0, 0, JSON.stringify({ count: errors.length, notify: notify }));
  return { ok: false, errorCount: errors.length, alerted: true, notify: notify };
}

function parseAutomationLogDate_(value) {
  if (value instanceof Date) return value;
  var text = String(value || '').trim();
  var match = text.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6]));
  var parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function generateSevenDayAutomationSummary() {
  var mirror = getOrderSyncMirror_();
  var log = getOrCreateAutomationLogSheet_(mirror);
  var report = mirror.getSheetByName(ORDERSYNC_REPORT_SHEET_NAME_) || mirror.insertSheet(ORDERSYNC_REPORT_SHEET_NAME_);
  var rows = log.getDataRange().getValues();
  var now = new Date();
  var cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var daily = {};

  for (var i = 1; i < rows.length; i++) {
    var when = parseAutomationLogDate_(rows[i][0]);
    if (!when || when < cutoff) continue;
    var day = Utilities.formatDate(when, 'Asia/Dhaka', 'yyyy-MM-dd');
    if (!daily[day]) daily[day] = { syncOk: 0, syncError: 0, backupOk: 0, backupError: 0, alerts: 0, verifyError: 0 };
    var type = String(rows[i][1] || '');
    var status = String(rows[i][2] || '');
    if (type === 'SYNC') status === 'OK' ? daily[day].syncOk++ : daily[day].syncError++;
    if (type === 'BACKUP') status === 'OK' ? daily[day].backupOk++ : daily[day].backupError++;
    if (type === 'ALERT' && status === 'OK') daily[day].alerts++;
    if (type === 'VERIFY' && status !== 'OK') daily[day].verifyError++;
  }

  var output = [['Generated At', 'Period Start', 'Period End', 'Sync OK', 'Sync Errors', 'Backup OK', 'Backup Errors', 'Alerts', 'Verification Errors']];
  var totals = { syncOk: 0, syncError: 0, backupOk: 0, backupError: 0, alerts: 0, verifyError: 0 };
  for (var d = 6; d >= 0; d--) {
    var date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    var key = Utilities.formatDate(date, 'Asia/Dhaka', 'yyyy-MM-dd');
    var item = daily[key] || { syncOk: 0, syncError: 0, backupOk: 0, backupError: 0, alerts: 0, verifyError: 0 };
    output.push([new Date(), key, key, item.syncOk, item.syncError, item.backupOk, item.backupError, item.alerts, item.verifyError]);
    Object.keys(totals).forEach(function (k) { totals[k] += item[k]; });
  }
  output.push(['7-day total', Utilities.formatDate(cutoff, 'Asia/Dhaka', 'yyyy-MM-dd'), Utilities.formatDate(now, 'Asia/Dhaka', 'yyyy-MM-dd'), totals.syncOk, totals.syncError, totals.backupOk, totals.backupError, totals.alerts, totals.verifyError]);
  report.clearContents();
  report.getRange(1, 1, output.length, output[0].length).setValues(output);
  report.setFrozenRows(1);
  report.getRange(1, 1, 1, output[0].length).setFontWeight('bold');
  report.getRange(2, 1, 7, 1).setNumberFormat('dd-MM-yyyy HH:mm:ss');
  report.autoResizeColumns(1, output[0].length);
  refreshAutomationReportChart_(report);
  recordAutomationLog_('REPORT', true, 0, 0, 'Seven-day summary generated');
  return { ok: true, rows: output.length - 1, totals: totals };
}

function refreshAutomationReportChart_(report) {
  // AutomationReports is a dedicated report tab, so replace only its charts.
  report.getCharts().forEach(function (chart) {
    report.removeChart(chart);
  });

  var chart = report.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(report.getRange('B1:B8'))
    .addRange(report.getRange('D1:G8'))
    .setPosition(12, 1, 0, 0)
    .setOption('title', 'গত ৭ দিনের Sync ও Backup Performance')
    .setOption('legend', { position: 'bottom' })
    .setOption('height', 360)
    .setOption('width', 760)
    .build();

  report.insertChart(chart);
}

function automationSummaryTriggerHandler() {
  try {
    var summary = generateSevenDayAutomationSummary();
    sendSevenDayAutomationSummary_(summary);
  }
  catch (err) { recordAutomationLog_('REPORT', false, 0, 0, String(err.message || err)); }
}

function sendSevenDayAutomationSummary_(summary) {
  var totals = summary.totals || {};
  var message =
    'গত ৭ দিনের Automation Summary\n\n' +
    'Sync OK: ' + Number(totals.syncOk || 0) + '\n' +
    'Sync Errors: ' + Number(totals.syncError || 0) + '\n' +
    'Backup OK: ' + Number(totals.backupOk || 0) + '\n' +
    'Backup Errors: ' + Number(totals.backupError || 0) + '\n' +
    'Alerts: ' + Number(totals.alerts || 0) + '\n' +
    'Verification Errors: ' + Number(totals.verifyError || 0) + '\n\n' +
    'AutomationReports tab-এ বিস্তারিত report ও chart আপডেট হয়েছে।';

  var result = sendAdminAndTelegramNotification_(
    '7-day OrderSync automation summary',
    message
  );
  recordAutomationLog_('REPORT_NOTIFY', result.email || result.telegram, 0, 0, JSON.stringify(result));
  return result;
}

function sendSevenDayAutomationSummaryNow() {
  var summary = generateSevenDayAutomationSummary();
  return sendSevenDayAutomationSummary_(summary);
}

function setupAutomationSummaryTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'automationSummaryTriggerHandler') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('automationSummaryTriggerHandler').timeBased().atHour(3).nearMinute(15).everyDays(1).create();
}

function automationLogVerificationTriggerHandler() {
  try {
    verifyAutomationLogs();
    scanAndAlertAutomationErrors();
  } catch (err) {
    recordAutomationLog_('VERIFY', false, 0, 0, String(err.message || err));
  }
}

function setupAutomationLogVerificationTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'automationLogVerificationTriggerHandler') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('automationLogVerificationTriggerHandler')
    .timeBased()
    .atHour(3)
    .everyDays(1)
    .create();
}

function selfHealOrderSyncTriggers_() {
  // The default mirror ID is validated before creating installable triggers.
  // If the destination is unavailable, the next sheet open can retry safely.
  try {
    getOrderSyncMirror_().getName();
  } catch (mirrorErr) {
    return;
  }

  if (!hasOrderSyncTrigger_()) {
    ScriptApp.newTrigger('orderSyncTriggerHandler')
      .timeBased()
      .everyMinutes(15)
      .create();
  }

  var hasVerification = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'automationLogVerificationTriggerHandler';
  });
  if (!hasVerification) setupAutomationLogVerificationTrigger();

  var hasSummary = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'automationSummaryTriggerHandler';
  });
  if (!hasSummary) setupAutomationSummaryTrigger();

  var hasWhatsAppQuota = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'whatsappQuotaMonitorTriggerHandler';
  });
  if (!hasWhatsAppQuota) setupWhatsAppQuotaMonitorTrigger();
}

/**
 * One-click setup for both operational automations.
 * The existing daily safety backup function creates one backup per day;
 * OrderSync runs every 15 minutes.
 */
function setupOperationsTriggersFromMenu() {
  setupDailySafetyBackupTriggerInternal_();

  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'orderSyncTriggerHandler') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('orderSyncTriggerHandler')
    .timeBased()
    .everyMinutes(15)
    .create();

  setupAutomationLogVerificationTrigger();
  setupAutomationSummaryTrigger();
  setupWhatsAppQuotaMonitorTrigger();

  SpreadsheetApp.getUi().alert(
    'Operations automation চালু হয়েছে।\n\n' +
    '• Safety backup: প্রতিদিন রাত ২টা (Asia/Dhaka)\n' +
    '• OrderSync: প্রতি ১৫ মিনিটে'
  );
}
