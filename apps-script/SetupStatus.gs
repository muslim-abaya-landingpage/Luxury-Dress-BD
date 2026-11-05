/**
 * Admin → "Setup ও স্ট্যাটাস" page backend.
 * AdminSetupStatus: which connections and automatic jobs are ready (owner only).
 *   Only says whether a secret is SET — never returns any key, token or ID.
 * AdminSetupAction: one-click turn-on / test for a fixed list of jobs (owner only).
 */

var SETUP_TRIGGERS_ = [
  { handler: 'orderSyncTriggerHandler', label: 'অর্ডার সিঙ্ক (প্রতি ১৫ মিনিট)', action: 'installOrderSync' },
  { handler: 'dailySafetyBackupTriggerHandler', label: 'প্রতিদিন শিটের ব্যাকআপ', action: 'installBackup' },
  { handler: 'sendDailySummaryEmail_', label: 'প্রতিদিন সকাল ৮টায় বিক্রির সারাংশ', action: 'installDailySummary' },
  { handler: 'siteUptimeCheck', label: 'সাইট বন্ধ হলে সতর্কবার্তা (প্রতি ঘণ্টা)', action: 'installUptimeMonitor' },
  { handler: 'steadfastStatusSyncTriggerHandler', label: 'Steadfast ডেলিভারি স্ট্যাটাস আপডেট', action: 'installSteadfastSync' },
  { handler: 'autoCourierOnEditTrigger', label: 'Confirmed হলে কুরিয়ারে পাঠানো', action: '' },
  { handler: 'automationSummaryTriggerHandler', label: 'সাপ্তাহিক অটোমেশন রিপোর্ট', action: '' },
  { handler: 'automationLogVerificationTriggerHandler', label: 'অটোমেশন ত্রুটি যাচাই', action: '' }
];

function setupHasProp_(props, name) {
  return !!String(props.getProperty(name) || '').trim();
}

function setupTriggerCounts_() {
  var counts = {};
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      var h = t.getHandlerFunction();
      counts[h] = (counts[h] || 0) + 1;
    });
  } catch (err) { counts.__error = String(err && err.message || err); }
  return counts;
}

function getAdminSetupStatus_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var props = PropertiesService.getScriptProperties();
  var has = function (name) { return setupHasProp_(props, name); };
  var emails = [];
  try { emails = getAdminNotifyEmails_(); } catch (mailErr) {}
  var quota = null;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (quotaErr) {}
  var counts = setupTriggerCounts_();
  var connections = [
    { id: 'telegram', label: 'Telegram নোটিফিকেশন', ok: has('TELEGRAM_BOT_TOKEN') && has('TELEGRAM_CHAT_ID'),
      partial: has('TELEGRAM_BOT_TOKEN') && !has('TELEGRAM_CHAT_ID'),
      help: has('TELEGRAM_BOT_TOKEN') ? 'বটকে একটা মেসেজ পাঠিয়ে Apps Script-এ telegramSetupChatId চালান।' : 'Apps Script → Project Settings → Script Properties-এ TELEGRAM_BOT_TOKEN বসান।' },
    { id: 'email', label: 'অ্যাডমিন ই-মেইল', ok: emails.length > 0 || has('NOTIFICATION_ALERT_EMAIL'),
      detail: emails.length + 'টি ঠিকানা' + (quota != null ? ' · আজ আরও ' + quota + 'টি ই-মেইল পাঠানো যাবে' : ''),
      help: 'Staff পেজে মূল অ্যাডমিনের ই-মেইল দিন।' },
    { id: 'steadfast', label: 'Steadfast কুরিয়ার', ok: has('STEADFAST_API_KEY') && has('STEADFAST_SECRET_KEY'),
      help: 'Script Properties-এ STEADFAST_API_KEY ও STEADFAST_SECRET_KEY বসান।' },
    { id: 'publisher', label: 'প্রোডাক্ট পাবলিশ (GitHub)', ok: has('GITHUB_TOKEN'),
      help: 'Script Properties-এ GITHUB_TOKEN বসান।' },
    { id: 'backup', label: 'ব্যাকআপ শিট', ok: has('SAFETY_BACKUP_SPREADSHEET_ID'),
      detail: props.getProperty('OPS_LAST_BACKUP_AT') ? 'শেষ ব্যাকআপ: ' + props.getProperty('OPS_LAST_BACKUP_AT') : 'এখনো কোনো ব্যাকআপ রেকর্ড নেই',
      help: 'প্রথম ব্যাকআপ চালু হলে এটি নিজে তৈরি হয়।' },
    { id: 'meta', label: 'Facebook Conversions API', ok: has('META_ACCESS_TOKEN') && (has('META_PIXEL_ID') || has('PIXEL_ID')), optional: true,
      help: 'ঐচ্ছিক — Script Properties-এ META_ACCESS_TOKEN ও META_PIXEL_ID।' },
    { id: 'tiktok', label: 'TikTok Events API', ok: has('TIKTOK_ACCESS_TOKEN') && (has('TIKTOK_PIXEL_ID') || has('TIKTOK_PIXEL_CODE')), optional: true,
      help: 'ঐচ্ছিক — Script Properties-এ TIKTOK_ACCESS_TOKEN ও TIKTOK_PIXEL_ID।' },
    { id: 'whatsapp', label: 'WhatsApp Cloud API', ok: has('WHATSAPP_ACCESS_TOKEN') && has('WHATSAPP_PHONE_NUMBER_ID'), optional: true,
      help: 'ঐচ্ছিক — configureWhatsAppProperties দিয়ে সেট করুন।' }
  ];
  var jobs = SETUP_TRIGGERS_.map(function (t) {
    return { handler: t.handler, label: t.label, on: (counts[t.handler] || 0) > 0, duplicates: Math.max(0, (counts[t.handler] || 0) - 1), action: t.action };
  });
  return {
    ok: true,
    checkedAt: Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyy-MM-dd HH:mm'),
    connections: connections,
    jobs: jobs,
    triggerError: counts.__error || '',
    lastOrderSyncAt: props.getProperty('ORDERSYNC_LAST_SYNC_AT') || '',
    siteDown: props.getProperty('MONITOR_DOWN') === '1' || props.getProperty('MONITOR_DOWN') === 'true'
  };
}

var SETUP_ACTIONS_ = {
  installDailySummary: function () { installDailySummaryTrigger_(); return 'প্রতিদিন সকাল ৮টায় সারাংশ চালু হয়েছে।'; },
  sendDailySummaryNow: function () {
    var r = sendDailySummaryEmail_() || {};
    if (r.error) throw new Error(r.error);
    if (!r.email && !r.telegram) throw new Error('পাঠানো যায়নি: ই-মেইল বা Telegram কোনোটাই সেট নেই।' + (r.telegramError ? ' (' + r.telegramError + ')' : ''));
    return 'গতকালের সারাংশ পাঠানো হয়েছে' + (r.email ? ' · ই-মেইল' : '') + (r.telegram ? ' · Telegram' : '') + '।';
  },
  testTelegram: function () {
    var r = sendTelegramText_('✅ Muslim Abaya অ্যাডমিন: Telegram টেস্ট মেসেজ।');
    if (!r.ok) throw new Error(r.error || 'Telegram মেসেজ যায়নি।');
    return 'Telegram-এ টেস্ট মেসেজ পাঠানো হয়েছে।';
  },
  installUptimeMonitor: function () { setupUptimeMonitorTrigger(); return 'সাইট মনিটর চালু হয়েছে (প্রতি ঘণ্টা)।'; },
  installOrderSync: function () { setupOrderSyncNewOrderAutomation(); return 'অর্ডার সিঙ্ক চালু হয়েছে (প্রতি ১৫ মিনিট)।'; },
  installBackup: function () { setupDailySafetyBackupTriggerInternal_(); return 'প্রতিদিনের ব্যাকআপ চালু হয়েছে।'; },
  installSteadfastSync: function () { setupSteadfastStatusSyncTriggerInternal_(); return 'Steadfast স্ট্যাটাস আপডেট চালু হয়েছে।'; }
};

function runAdminSetupAction_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var name = String(param_(e, 'Action') || '');
  if (!Object.prototype.hasOwnProperty.call(SETUP_ACTIONS_, name)) return { ok: false, error: 'UNKNOWN_ACTION', message: 'অজানা কাজ।' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'BUSY', message: 'অন্য একটি সেটআপ চলছে, একটু পরে আবার চাপুন।' };
  try {
    return { ok: true, action: name, message: SETUP_ACTIONS_[name]() };
  } catch (err) {
    return { ok: false, error: 'ACTION_FAILED', message: String(err && err.message || err) };
  } finally {
    lock.releaseLock();
  }
}
