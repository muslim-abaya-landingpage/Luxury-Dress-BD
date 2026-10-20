/**
 * Free uptime monitor: checks the storefront every hour and e-mails the admin
 * (and Telegram, if configured) after 2 failed checks in a row, then once more
 * when the site is reachable again. One-time setup: run setupUptimeMonitorTrigger().
 */
var MONITOR_URLS_ = ['https://muslimabaya.com/', 'https://muslimabaya.com/checkout'];

function siteUptimeCheck() {
  var props = PropertiesService.getScriptProperties();
  var failures = [];
  MONITOR_URLS_.forEach(function (url) {
    try {
      var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
      var code = res.getResponseCode();
      if (code >= 400) failures.push(url + ' → HTTP ' + code);
    } catch (err) {
      failures.push(url + ' → ' + String(err && err.message || err).slice(0, 150));
    }
  });
  var wasDown = props.getProperty('MONITOR_DOWN') === '1';
  var streak = failures.length ? (parseInt(props.getProperty('MONITOR_FAIL_STREAK') || '0', 10) || 0) + 1 : 0;
  props.setProperty('MONITOR_FAIL_STREAK', String(streak));
  props.setProperty('MONITOR_LAST_CHECK', new Date().toISOString());
  var notified = '';
  if (streak >= 2 && !wasDown) {
    props.setProperty('MONITOR_DOWN', '1');
    notified = 'DOWN';
    monitorNotify_('⚠ muslimabaya.com খোলা যাচ্ছে না',
      'পরপর ' + streak + ' বার যাচাইয়ে সমস্যা পাওয়া গেছে:\n' + failures.join('\n') +
      '\n\nCloudflare ড্যাশবোর্ড ও ডোমেইন যাচাই করুন। ঠিক হলে আবার জানানো হবে।');
  } else if (!failures.length && wasDown) {
    props.setProperty('MONITOR_DOWN', '0');
    notified = 'RECOVERED';
    monitorNotify_('✅ muslimabaya.com আবার চালু', 'সাইট আবার স্বাভাবিকভাবে খুলছে।');
  }
  var backup = '';
  try { backup = ensureRecentBackup_(); } catch (backupErr) { backup = 'ERROR'; }
  var result = { ok: true, failures: failures, streak: streak, notified: notified, backup: backup };
  console.log('UPTIME ' + JSON.stringify(result));
  return result;
}

function monitorNotify_(subject, body) {
  if (typeof sendAdminAndTelegramNotification_ === 'function') {
    sendAdminAndTelegramNotification_(subject, subject + '\n\n' + body);
    return;
  }
  var emails = typeof getAdminNotifyEmails_ === 'function' ? getAdminNotifyEmails_() : [];
  if (emails.length) MailApp.sendEmail({ to: emails.join(','), subject: subject, body: body });
}

function setupUptimeMonitorTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'siteUptimeCheck') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('siteUptimeCheck').timeBased().everyHours(1).create();
  return { ok: true, interval: 'every hour' };
}

/**
 * Backup catch-up. The daily backup trigger occasionally dies with a Google
 * "server error" before our code can catch it. If the last successful backup
 * is older than 26 hours, run it again (at most every 3 hours); if it is still
 * missing after 30 hours, alert once per day.
 */
var BACKUP_STALE_MS_ = 26 * 3600 * 1000;
var BACKUP_ALERT_MS_ = 30 * 3600 * 1000;
var BACKUP_RETRY_GAP_MS_ = 3 * 3600 * 1000;

function ensureRecentBackup_(nowMs) {
  var now = Number(nowMs) || Date.now();
  var props = PropertiesService.getScriptProperties();
  if (typeof runSafetyBackupNow !== 'function' || typeof hasDailySafetyBackupTrigger_ !== 'function') return 'NO_BACKUP';
  if (!hasDailySafetyBackupTrigger_()) return 'NO_TRIGGER';
  var last = Date.parse(props.getProperty('OPS_LAST_BACKUP_AT') || '');
  var age = isFinite(last) ? now - last : Infinity;
  if (age < BACKUP_STALE_MS_) return 'FRESH';
  var lastTry = Date.parse(props.getProperty('BACKUP_CATCHUP_AT') || '');
  if (isFinite(lastTry) && now - lastTry < BACKUP_RETRY_GAP_MS_) return 'WAITING';
  props.setProperty('BACKUP_CATCHUP_AT', new Date(now).toISOString());
  var res = null;
  try { res = runSafetyBackupNow(); } catch (err) { res = { ok: false, error: String(err && err.message || err) }; }
  if (typeof recordAutomationLog_ === 'function') {
    recordAutomationLog_('BACKUP', !!(res && res.ok), 0, 0, 'catch-up: ' + (res && res.ok ? 'ok' : String(res && res.error || 'failed')));
  }
  if (res && res.ok) return 'CAUGHT_UP';
  var today = new Date(now + 6 * 3600 * 1000).toISOString().slice(0, 10);
  if (age >= BACKUP_ALERT_MS_ && props.getProperty('BACKUP_ALERT_DAY') !== today) {
    props.setProperty('BACKUP_ALERT_DAY', today);
    monitorNotify_('⚠ অর্ডার শিটের ব্যাকআপ হচ্ছে না',
      'শেষ সফল ব্যাকআপ ' + (isFinite(last) ? Math.round(age / 3600000) + ' ঘণ্টা আগে' : 'পাওয়া যায়নি') +
      '। আবার চেষ্টা করেও হয়নি: ' + String(res && res.error || 'অজানা কারণ') +
      '\n\nApps Script → Executions দেখুন, বা এডিটর থেকে runSafetyBackupNow চালান।');
    return 'ALERTED';
  }
  return 'RETRY_FAILED';
}
