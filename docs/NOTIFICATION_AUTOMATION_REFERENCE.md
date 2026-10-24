# Muslim Abaya Notification ও Automation Reference

## ১. Script Properties

Google Sheet → Extensions → Apps Script → Project Settings → Script Properties:

```text
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
NOTIFICATION_ALERT_EMAIL
```

## ২. Email + Telegram core notification

```javascript
function sendAdminAndTelegramNotification_(subject, message) {
  var result = { email: false, telegram: false };
  var props = PropertiesService.getScriptProperties();

  try {
    var emails = [];
    var configuredEmail = props.getProperty('NOTIFICATION_ALERT_EMAIL') || '';
    if (configuredEmail) emails.push(configuredEmail);
    if (typeof getAdminNotifyEmails_ === 'function') {
      emails = emails.concat(getAdminNotifyEmails_());
    }
    emails = emails.filter(function (email, index, list) {
      return email && list.indexOf(email) === index;
    });
    if (emails.length) {
      MailApp.sendEmail({
        to: emails.join(','),
        subject: subject,
        body: message
      });
      result.email = true;
    }
  } catch (emailErr) {
    result.emailError = String(emailErr.message || emailErr);
  }

  try {
    var token = props.getProperty('TELEGRAM_BOT_TOKEN') || '';
    var chatId = props.getProperty('TELEGRAM_CHAT_ID') || '';
    if (token && chatId) {
      var response = UrlFetchApp.fetch(
        'https://api.telegram.org/bot' +
          encodeURIComponent(token) +
          '/sendMessage',
        {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify({
            chat_id: chatId,
            text: message
          }),
          muteHttpExceptions: true
        }
      );
      result.telegram = response.getResponseCode() >= 200 &&
        response.getResponseCode() < 300;
      if (!result.telegram) {
        result.telegramError = response.getContentText().slice(0, 500);
      }
    } else {
      result.telegramError =
        'TELEGRAM_BOT_TOKEN বা TELEGRAM_CHAT_ID সেট করা হয়নি।';
    }
  } catch (telegramErr) {
    result.telegramError = String(telegramErr.message || telegramErr);
  }

  recordAutomationLog_(
    'ALERT',
    result.email || result.telegram,
    0,
    0,
    JSON.stringify(result)
  );
  return result;
}

function testNewOrderNotifications() {
  var testOrderId = 'TEST-NOTIFICATION-' +
    Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyyMMdd-HHmmss');

  var message =
    'Muslim Abaya notification test\n\n' +
    'Order ID: ' + testOrderId + '\n' +
    'Customer: QA Notification Test\n' +
    'Phone: 01971642683\n' +
    'Total: ৳1079\n' +
    'Status: TEST ONLY — DO NOT SHIP';

  return sendAdminAndTelegramNotification_(
    'Order notification test — ' + testOrderId,
    message
  );
}
```

## ৩. OrderSync ১৫-মিনিট polling

```javascript
function setupOrderSyncNewOrderAutomation() {
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

  return {
    ok: true,
    trigger: 'orderSyncTriggerHandler',
    interval: 'every 15 minutes'
  };
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
    recordAutomationLog_(
      'SYNC',
      false,
      0,
      0,
      String(err.message || err)
    );
    PropertiesService.getScriptProperties().setProperty(
      'ORDERSYNC_LAST_TRIGGER_RESULT',
      JSON.stringify({ ok: false, error: String(err.message || err) })
    );
  }
}
```

## ৪. Polling health check ও live test

```javascript
function verifyOrderSyncPollingHealth() {
  var props = PropertiesService.getScriptProperties();
  var matching = ScriptApp.getProjectTriggers().filter(function (trigger) {
    return trigger.getHandlerFunction() === 'orderSyncTriggerHandler' &&
      trigger.getEventType() === ScriptApp.EventType.CLOCK;
  });

  var lastTriggerAt = props.getProperty('ORDERSYNC_LAST_TRIGGER_AT') || '';
  var lastResultText = props.getProperty('ORDERSYNC_LAST_TRIGGER_RESULT') || '{}';
  var lastTrigger = lastTriggerAt ? new Date(lastTriggerAt) : null;
  var ageMinutes = lastTrigger
    ? (Date.now() - lastTrigger.getTime()) / 60000
    : null;
  var lastResult = {};
  try { lastResult = JSON.parse(lastResultText); } catch (err) {}

  var result = {
    ok: matching.length === 1 && ageMinutes !== null &&
      ageMinutes <= 20 && lastResult.ok !== false,
    triggerCount: matching.length,
    lastTriggerAt: lastTriggerAt,
    ageMinutes: ageMinutes,
    lastResult: lastResult
  };

  recordAutomationLog_('SYNC_HEALTH', result.ok, 0, 0, JSON.stringify(result));
  return result;
}

function runOrderSyncLiveTestFromMenu() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert(
    'OrderSync live test',
    'Source order data sync হবে এবং নতুন Order ID পাওয়া গেলে notification যেতে পারে। চালাবেন?',
    ui.ButtonSet.YES_NO
  );
  if (answer !== ui.Button.YES) return { ok: false, cancelled: true };

  try {
    var sync = runOrderSyncNow();
    var health = verifyOrderSyncPollingHealth();
    ui.alert(
      'OrderSync live test complete\n\n' +
      'Added: ' + sync.added + '\n' +
      'Updated: ' + sync.updated + '\n' +
      'Total synced: ' + sync.synced + '\n' +
      'Polling health: ' + (health.ok ? 'OK' : 'CHECK REQUIRED')
    );
    return { sync: sync, health: health };
  } catch (err) {
    recordAutomationLog_('SYNC_LIVE_TEST', false, 0, 0, String(err.message || err));
    ui.alert('OrderSync live test failed:\n\n' + String(err.message || err));
    return { ok: false, error: String(err.message || err) };
  }
}
```

## ৫. Daily safety backup trigger

```javascript
function runSafetyBackupNow() {
  var lock = LockService.getUserLock();
  if (!lock.tryLock(1000)) {
    return { ok: false, error: 'BACKUP_IN_PROGRESS' };
  }

  try {
    var source = SpreadsheetApp.getActiveSpreadsheet();
    if (!source) return { ok: false, error: 'NO_SOURCE_SHEET' };

    var stamp = Utilities.formatDate(
      new Date(),
      'Asia/Dhaka',
      'yyyy-MM-dd HH-mm-ss'
    );
    var backup = source.copy('Luxury Dress Safety Backup ' + stamp);
    if (!backup || source.getId() === backup.getId()) {
      throw new Error('BACKUP_COPY_FAILED');
    }

    var copied = [];
    source.getSheets().forEach(function (sourceSheet) {
      var target = backup.getSheetByName(sourceSheet.getName());
      if (!target ||
          sourceSheet.getLastRow() !== target.getLastRow() ||
          sourceSheet.getLastColumn() !== target.getLastColumn()) {
        throw new Error('BACKUP_VERIFICATION_FAILED');
      }
      copied.push({
        name: sourceSheet.getName(),
        rows: Math.max(0, sourceSheet.getLastRow() - 1)
      });
    });

    PropertiesService.getScriptProperties().setProperties({
      SAFETY_BACKUP_SPREADSHEET_ID: backup.getId(),
      OPS_LAST_BACKUP_AT: new Date().toISOString()
    });

    return {
      ok: true,
      backupSpreadsheetId: backup.getId(),
      backupSpreadsheetUrl: backup.getUrl(),
      copiedTabs: copied
    };
  } finally {
    lock.releaseLock();
  }
}

function dailySafetyBackupTriggerHandler() {
  try {
    var result = runSafetyBackupNow();
    recordAutomationLog_(
      'BACKUP',
      !!(result && result.ok),
      0,
      0,
      result && result.ok
        ? 'Safety backup created: ' + result.backupSpreadsheetId
        : String((result && result.error) || 'BACKUP_FAILED')
    );
  } catch (err) {
    recordAutomationLog_('BACKUP', false, 0, 0, String(err.message || err));
  }
}

function setupDailySafetyBackupTrigger() {
  PropertiesService.getScriptProperties().setProperty('DAILY_BACKUP_ON', 'true');
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'dailySafetyBackupTriggerHandler') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger('dailySafetyBackupTriggerHandler')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
}
```

## ৬. Daily verification ও ERROR alert

```javascript
function verifyAutomationLogs() {
  var mirror = getOrderSyncMirror_();
  var log = getOrCreateAutomationLogSheet_(mirror);
  var rows = log.getDataRange().getValues();
  var cutoff = Date.now() - 24 * 60 * 60 * 1000;
  var syncOk = 0, syncError = 0, backupOk = 0, backupError = 0;

  for (var i = 1; i < rows.length; i++) {
    var when = parseAutomationLogDate_(rows[i][0]);
    if (!when || when.getTime() < cutoff) continue;
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
    if (!when || when.getTime() < cutoff || String(rows[i][2] || '') !== 'ERROR') continue;
    errors.push(
      Utilities.formatDate(when, 'Asia/Dhaka', 'dd-MM-yyyy HH:mm:ss') +
      ' | ' + String(rows[i][1] || '') +
      ' | ' + String(rows[i][5] || '').slice(0, 300)
    );
  }

  if (!errors.length) {
    recordAutomationLog_('ERROR_SCAN', true, 0, 0, 'No errors in the last 24 hours');
    return { ok: true, errorCount: 0, alerted: false };
  }

  var message =
    'Automation error alert — গত ২৪ ঘণ্টায় ' + errors.length + 'টি ERROR পাওয়া গেছে।\n\n' +
    errors.slice(-20).join('\n') +
    '\n\nবিস্তারিত: AutomationLogs tab';
  var notify = sendAdminAndTelegramNotification_('AutomationLogs error alert', message);
  recordAutomationLog_('ERROR_ALERT', notify.email || notify.telegram, 0, 0, JSON.stringify(notify));
  return { ok: false, errorCount: errors.length, alerted: true, notify: notify };
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
```

## ৭. Daily operations setup

```javascript
function setupOperationsTriggersFromMenu() {
  setupDailySafetyBackupTrigger();
  setupOrderSyncNewOrderAutomation();
  setupAutomationLogVerificationTrigger();
  setupAutomationSummaryTrigger();
  setupWhatsAppQuotaMonitorTrigger();

  SpreadsheetApp.getUi().alert(
    'Operations automation চালু হয়েছে।\n\n' +
    '• Safety backup: প্রতিদিন রাত ২টা\n' +
    '• OrderSync: প্রতি ১৫ মিনিটে\n' +
    '• Log verification: প্রতিদিন রাত ৩টা\n' +
    '• 7-day report: প্রতিদিন রাত ৩:১৫'
  );
}
```

## ৮. ব্যবহারের ক্রম

```text
১. Script Properties সেট করুন
২. testNewOrderNotifications() চালান
৩. setupOperationsTriggersFromMenu() চালান
৪. runOrderSyncLiveTestFromMenu() চালান
৫. verifyOrderSyncPollingHealth() চালান
৬. AutomationLogs tab যাচাই করুন
```

## গুরুত্বপূর্ণ সতর্কতা

Token code, GitHub বা chat-এ রাখবেন না। Live test চালালে নতুন Order ID পাওয়া গেলে Email/Telegram alert যেতে পারে। Test order-এর status বা note-এ লিখুন:

```text
TEST ONLY — DO NOT SHIP
```
