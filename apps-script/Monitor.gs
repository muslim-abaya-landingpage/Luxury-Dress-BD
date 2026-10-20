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
  var result = { ok: true, failures: failures, streak: streak, notified: notified };
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
