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
var ORDERSYNC_SHEET_NAME_ = 'OrderSync';

function getOrderSyncMirrorId_() {
  return String(
    PropertiesService.getScriptProperties()
      .getProperty(ORDERSYNC_MIRROR_PROPERTY_) || ''
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

    var mirrorRowsById = {};
    for (var r = 1; r < targetValues.length; r++) {
      var existingId = String(targetValues[r][orderIdColumn] || '').trim();
      if (existingId) mirrorRowsById[existingId] = r + 1;
    }

    var added = 0;
    var updated = 0;

    for (var s = 1; s < sourceValues.length; s++) {
      var row = sourceValues[s].slice(0, width);
      while (row.length < width) row.push('');

      var orderId = String(row[orderIdColumn] || '').trim();
      if (!orderId) continue;

      if (mirrorRowsById[orderId]) {
        target.getRange(mirrorRowsById[orderId], 1, 1, width).setValues([row]);
        updated++;
      } else {
        var nextRow = Math.max(2, target.getLastRow() + 1);
        target.getRange(nextRow, 1, 1, width).setValues([row]);
        mirrorRowsById[orderId] = nextRow;
        added++;
      }
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
      mirrorSpreadsheetId: targetSpreadsheet.getId(),
      mirrorSheet: ORDERSYNC_SHEET_NAME_
    };
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

function hasOrderSyncTrigger_() {
  return ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === 'orderSyncTriggerHandler';
  });
}

function orderSyncTriggerHandler() {
  try {
    runOrderSyncNow();
  } catch (err) {
    console.error('ORDERSYNC_FAILED ' + String(err.stack || err));
  }
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

  SpreadsheetApp.getUi().alert('OrderSync ON — প্রতি ১৫ মিনিটে sync হবে।');
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

  SpreadsheetApp.getUi().alert(
    'Operations automation চালু হয়েছে।\n\n' +
    '• Safety backup: প্রতিদিন রাত ২টা (Asia/Dhaka)\n' +
    '• OrderSync: প্রতি ১৫ মিনিটে'
  );
}
