/** Editor-only, read-only audit. Never logs keys, tokens or customer data. */
function courierIntegrationAudit() {
  var props = PropertiesService.getScriptProperties();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Online Order');
  var events = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Courier Tracking');
  var result = {
    trackingHandlerInstalled: typeof adminCourierTracking_ === 'function',
    apiKeysConfigured: !!(props.getProperty('STEADFAST_API_KEY') && props.getProperty('STEADFAST_SECRET_KEY')),
    webhookTokenConfigured: !!props.getProperty('STEADFAST_WEBHOOK_TOKEN'),
    automaticStatusSync: hasSteadfastStatusSyncTrigger_(),
    dailyBackupTrigger: hasDailySafetyBackupTrigger_(),
    lastBackup: props.getProperty('OPS_LAST_BACKUP_AT') || '',
    receivedTrackingEvents: events ? Math.max(0, events.getLastRow() - 1) : 0
  };
  try {
    var sample = sheet && findCourierTrackingOrder_(sheet, { invoice: 'MA-20261011-4777' });
    if (sample) {
      var response = sample.values[11] ? steadfastGetStatusByConsignmentId_(sample.values[11]) : steadfastGetStatusByTrackingCode_(sample.values[10]);
      result.providerStatus = extractSteadfastDeliveryStatus_(response) || '';
      result.statusRequestOk = !!result.providerStatus;
    } else result.statusRequestOk = false;
  } catch (err) { result.statusRequestOk = false; result.statusError = 'COURIER_REQUEST_FAILED'; }
  try { var catalog = opsCatalog_(); result.catalogVerified = true; result.catalogProducts = catalog.products.length; }
  catch (err) { result.catalogVerified = false; result.catalogError = String(err.message || err).slice(0, 80); }
  console.log('COURIER_INTEGRATION_AUDIT ' + JSON.stringify(result));
  return result;
}
