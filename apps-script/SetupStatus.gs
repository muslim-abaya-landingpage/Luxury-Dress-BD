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
    setupGithubConnection_(props),
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
    messengerPages: messengerPageTokenStatus_(props),
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
  installSteadfastSync: function () { setupSteadfastStatusSyncTriggerInternal_(); return 'Steadfast স্ট্যাটাস আপডেট চালু হয়েছে।'; },
  messengerReceipts: function () { return 'Messenger “দেখেছে” — ' + msgrSubscribeReceipts_().join(' · '); },
  messengerProfileCheck: function () { return msgrProfileCheck_(); },
  messengerRefreshTokens: function () { return msgrRefreshFromSystemToken_(); }
};

function messengerPageTokenStatus_(props) {
  return Object.keys(MSGR_PAGES).map(function (pageId) {
    var token = String(props.getProperty('MSGR_PAGE_TOKEN_' + pageId) || '').trim();
    if (!token && String(pageId) === MSGR_PAGE_ID) token = String(props.getProperty('MSGR_PAGE_TOKEN') || '').trim();
    var row = { id: pageId, name: MSGR_PAGES[pageId], configured: !!token,
      source: props.getProperty('MSGR_PAGE_SOURCE_' + pageId) === 'system' ? 'system' : (token ? 'manual' : '') };
    if (token) row.health = msgrTokenHealth_(pageId, token, false);
    return row;
  });
}

/**
 * Is a Page token still accepted by Facebook, and when does it expire? Asks Facebook's debug_token with the
 * token itself (nothing else is sent). Cached 6 hours so the Setup page stays fast; fresh=true skips the cache.
 * Returns {state:'ok'|'warn'|'bad'|'unknown', expires:'never'|'yyyy-MM-dd'|'', message}. Never returns the token.
 */
var MSGR_HEALTH_WARN_DAYS_ = 14;
function msgrTokenHealth_(pageId, token, fresh) {
  var cache = null, key = 'msgr_health_' + pageId;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  if (cache && !fresh) {
    var hit = cache.get(key);
    if (hit) { try { return JSON.parse(hit); } catch (e2) {} }
  }
  var out;
  try {
    var res = UrlFetchApp.fetch('https://graph.facebook.com/v25.0/debug_token?input_token=' + encodeURIComponent(token), {
      headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    var body = {};
    try { body = JSON.parse(res.getContentText() || '{}'); } catch (e3) {}
    var d = body.data || {};
    if (res.getResponseCode() !== 200 || body.error || d.is_valid === false) {
      var why = (d.error && d.error.message) || (body.error && body.error.message) || ('HTTP ' + res.getResponseCode());
      out = { state: 'bad', expires: '', message: 'বাতিল — Facebook আর এই Token মানছে না (' + String(why).slice(0, 120) + ')' };
    } else {
      var at = Number(d.expires_at || 0);
      if (!at) out = { state: 'ok', expires: 'never', message: 'চালু · মেয়াদ: কখনো শেষ হবে না' };
      else {
        var days = Math.floor((at * 1000 - Date.now()) / 86400000);
        var date = Utilities.formatDate(new Date(at * 1000), 'Asia/Dhaka', 'yyyy-MM-dd');
        out = days <= MSGR_HEALTH_WARN_DAYS_
          ? { state: 'warn', expires: date, message: 'মেয়াদ শেষ হবে ' + date + ' (' + Math.max(0, days) + ' দিন বাকি) — নতুন Token দিন' }
          : { state: 'ok', expires: date, message: 'চালু · মেয়াদ শেষ ' + date };
      }
    }
  } catch (err) {
    out = { state: 'unknown', expires: '', message: 'এখন যাচাই করা যায়নি' };
  }
  if (cache && out.state !== 'unknown') { try { cache.put(key, JSON.stringify(out), 6 * 3600); } catch (e4) {} }
  return out;
}

/**
 * Once a day (called from the hourly siteUptimeCheck): check every Page token. A broken token from the System
 * User is fetched again automatically; anything still broken or about to expire is sent to e-mail/Telegram once,
 * and once more when it is fixed. Returns a short summary for the log.
 */
function messengerTokenDailyCheck_(props) {
  var today = Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyy-MM-dd');
  if (props.getProperty('MSGR_HEALTH_DAY') === today) return 'SKIP';
  props.setProperty('MSGR_HEALTH_DAY', today);
  var check = function () {
    var problems = {};
    messengerPageTokenStatus_(props).forEach(function (p) {
      if (!p.configured) return;
      var token = String(props.getProperty('MSGR_PAGE_TOKEN_' + p.id) || '').trim() || (String(p.id) === MSGR_PAGE_ID ? String(props.getProperty('MSGR_PAGE_TOKEN') || '').trim() : '');
      var h = msgrTokenHealth_(p.id, token, true);
      if (h.state === 'bad' || h.state === 'warn') problems[p.id] = p.name + ': ' + h.message;
    });
    return problems;
  };
  var problems = check();
  if (Object.keys(problems).length && props.getProperty('MSGR_SYSTEM_TOKEN')) {
    try { msgrRefreshFromSystemToken_(); problems = check(); } catch (e) {}
  }
  var before = {};
  try { before = JSON.parse(props.getProperty('MSGR_HEALTH_ALERTED') || '{}'); } catch (e2) {}
  var fresh = Object.keys(problems).filter(function (id) { return !before[id]; });
  var fixed = Object.keys(before).filter(function (id) { return !problems[id]; });
  if (fresh.length) {
    monitorNotify_('⚠ Messenger Page Token সমস্যা',
      fresh.map(function (id) { return problems[id]; }).join('\n') +
      '\n\nAdmin → Setup → Messenger Page Access Token-এ Page বেছে নতুন Token দিন। এই Page-এর Inbox-এ ততক্ষণ মেসেজ আসবে/যাবে না।');
  }
  if (fixed.length) {
    monitorNotify_('✅ Messenger Page Token আবার ঠিক', fixed.map(function (id) { return MSGR_PAGES[id] || id; }).join(', ') + ' — Inbox আবার চালু।');
  }
  props.setProperty('MSGR_HEALTH_ALERTED', JSON.stringify(problems));
  return Object.keys(problems).length ? 'PROBLEMS ' + Object.keys(problems).length : 'OK';
}

/** Accept a Page token only after Facebook confirms it belongs to the selected Page. Never return or log the token. */
function saveMessengerPageToken_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var pageId = String(param_(e, 'PageId') || '').trim();
  var accessToken = String(param_(e, 'AccessToken') || '').trim();
  if (pageId === 'system') return saveMessengerSystemToken_(accessToken);
  if (!Object.prototype.hasOwnProperty.call(MSGR_PAGES, pageId)) {
    return { ok: false, error: 'INVALID_PAGE', message: 'তালিকার একটি Facebook Page নির্বাচন করুন।' };
  }
  if (accessToken.length < 20 || accessToken.length > 5000 || /\s/.test(accessToken)) {
    return { ok: false, error: 'INVALID_TOKEN_FORMAT', message: 'সম্পূর্ণ Page Access Token পেস্ট করুন; শুরু বা শেষে অতিরিক্ত ফাঁকা স্থান রাখবেন না।' };
  }
  try {
    var response = UrlFetchApp.fetch('https://graph.facebook.com/v25.0/me?fields=id,name', {
      headers: { Authorization: 'Bearer ' + accessToken }, muteHttpExceptions: true
    });
    var body = {};
    try { body = JSON.parse(response.getContentText() || '{}'); } catch (parseErr) {}
    if (response.getResponseCode() !== 200 || body.error || !body.id) {
      var message = body.error && body.error.message ? String(body.error.message) : 'Facebook Token যাচাই করতে পারেনি।';
      return { ok: false, error: 'FACEBOOK_TOKEN_INVALID', message: message.slice(0, 220) };
    }
    if (String(body.id) !== pageId) {
      return { ok: false, error: 'TOKEN_PAGE_MISMATCH',
        message: 'এই Tokenটি "' + String(body.name || 'অন্য Page') + '" Page-এর। নির্বাচিত Page "' + MSGR_PAGES[pageId] + '"-এর Token ব্যবহার করুন।' };
    }
    var props = PropertiesService.getScriptProperties();
    props.setProperty('MSGR_PAGE_TOKEN_' + pageId, accessToken);
    props.setProperty('MSGR_PAGE_SOURCE_' + pageId, 'manual');
    try { CacheService.getScriptCache().remove('msgr_health_' + pageId); } catch (cacheErr) {}
    return { ok: true, pageId: pageId, pageName: MSGR_PAGES[pageId],
      message: MSGR_PAGES[pageId] + ' Page-এর Token যাচাই করে নিরাপদে সংরক্ষণ করা হয়েছে।' };
  } catch (err) {
    return { ok: false, error: 'TOKEN_VERIFY_FAILED', message: 'Facebook-এর সঙ্গে যাচাই করা যায়নি: ' + String(err && err.message || err).slice(0, 160) };
  }
}

/**
 * One Meta Business "System User" token (made with expiry "Never") for all Pages: Facebook gives back each
 * assigned Page's own token, which also does not expire and does not depend on anyone's personal login.
 * The system token is kept so the Page tokens can be fetched again later (Setup → "Messenger token নতুন করে আনুন").
 * Never returns or logs a token.
 */
function msgrGraphGet_(path, token) {
  var res = UrlFetchApp.fetch('https://graph.facebook.com/v25.0/' + path, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
  var body = {};
  try { body = JSON.parse(res.getContentText() || '{}'); } catch (err) {}
  return { status: res.getResponseCode(), body: body };
}

function msgrPagesFromSystemToken_(token) {
  var me = msgrGraphGet_('me?fields=id,name', token);
  if (me.status !== 200 || me.body.error || !me.body.id) {
    return { ok: false, error: 'FACEBOOK_TOKEN_INVALID', message: String((me.body.error && me.body.error.message) || 'Facebook Token যাচাই করতে পারেনি।').slice(0, 220) };
  }
  if (Object.prototype.hasOwnProperty.call(MSGR_PAGES, String(me.body.id))) {
    return { ok: false, error: 'NOT_SYSTEM_TOKEN', message: 'এটা একটি Page-এর Token। এখানে Business Settings → System Users থেকে বানানো Token দিন, অথবা উপরের তালিকা থেকে সেই Page বেছে নিন।' };
  }
  var list = msgrGraphGet_('me/accounts?fields=id,name,access_token&limit=100', token);
  if (list.status !== 200 || list.body.error) {
    return { ok: false, error: 'PAGES_NOT_READABLE', message: 'Page-এর তালিকা পাওয়া যায়নি: ' + String((list.body.error && list.body.error.message) || list.status).slice(0, 200) };
  }
  var found = {};
  (list.body.data || []).forEach(function (p) { if (p && p.id && p.access_token) found[String(p.id)] = String(p.access_token); });
  var expires = '';
  var dbg = msgrGraphGet_('debug_token?input_token=' + encodeURIComponent(token), token);
  if (dbg.status === 200 && dbg.body.data) {
    var at = Number(dbg.body.data.expires_at || 0);
    expires = at > 0 ? Utilities.formatDate(new Date(at * 1000), 'Asia/Dhaka', 'yyyy-MM-dd') : 'never';
  }
  return { ok: true, pages: found, expires: expires };
}

function msgrStoreSystemPages_(token, found) {
  var props = PropertiesService.getScriptProperties();
  var saved = [], missing = [];
  Object.keys(MSGR_PAGES).forEach(function (pid) {
    if (found[pid]) { props.setProperty('MSGR_PAGE_TOKEN_' + pid, found[pid]); props.setProperty('MSGR_PAGE_SOURCE_' + pid, 'system'); saved.push(MSGR_PAGES[pid]); }
    else missing.push(MSGR_PAGES[pid]);
  });
  if (saved.length) props.setProperty('MSGR_SYSTEM_TOKEN', token);
  return { saved: saved, missing: missing };
}

function saveMessengerSystemToken_(token) {
  if (token.length < 20 || token.length > 5000 || /\s/.test(token)) {
    return { ok: false, error: 'INVALID_TOKEN_FORMAT', message: 'সম্পূর্ণ System User Token পেস্ট করুন; শুরু বা শেষে অতিরিক্ত ফাঁকা স্থান রাখবেন না।' };
  }
  try {
    var r = msgrPagesFromSystemToken_(token);
    if (!r.ok) return r;
    var s = msgrStoreSystemPages_(token, r.pages);
    if (!s.saved.length) {
      return { ok: false, error: 'NO_PAGES_ASSIGNED', message: 'Token ঠিক আছে, কিন্তু তালিকার কোনো Page এই System User-কে দেওয়া হয়নি। Business Settings → System Users → Assign assets থেকে Page-গুলো দিন (Full control)।' };
    }
    return { ok: true, pageId: 'system', saved: s.saved, missing: s.missing, expires: r.expires,
      message: 'System User Token থেকে ' + s.saved.length + 'টি Page-এর Token সংরক্ষণ হয়েছে: ' + s.saved.join(', ') + '।' +
        (s.missing.length ? ' পাওয়া যায়নি: ' + s.missing.join(', ') + '।' : '') +
        (r.expires === 'never' ? ' মেয়াদ: কখনো শেষ হবে না।' : r.expires ? ' মেয়াদ শেষ: ' + r.expires + ' — মেয়াদ "Never" দিয়ে নতুন Token বানান।' : '') };
  } catch (err) {
    return { ok: false, error: 'TOKEN_VERIFY_FAILED', message: 'Facebook-এর সঙ্গে যাচাই করা যায়নি: ' + String(err && err.message || err).slice(0, 160) };
  }
}

function msgrRefreshFromSystemToken_() {
  var token = PropertiesService.getScriptProperties().getProperty('MSGR_SYSTEM_TOKEN');
  if (!token) return 'System User Token বসানো নেই — Messenger Page Access Token অংশে "সব Page একসাথে" বেছে Token দিন।';
  var r = msgrPagesFromSystemToken_(token);
  if (!r.ok) return 'হয়নি — ' + r.message;
  var s = msgrStoreSystemPages_(token, r.pages);
  return 'নতুন করে আনা হয়েছে: ' + (s.saved.join(', ') || 'কোনো Page না') + (s.missing.length ? ' · পাওয়া যায়নি: ' + s.missing.join(', ') : '');
}

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


/**
 * Apps Script GITHUB_TOKEN (used when the fast Cloudflare save is unavailable): checks it against GitHub and
 * reads its expiry from the "github-authentication-token-expiration" response header (absent = no expiry).
 */
function setupGithubConnection_(props) {
  if (props.getProperty('GITHUB_APP_PRIVATE_KEY')) {
    var appLabel = 'প্রোডাক্ট সেভ — Apps Script (বিকল্প পথ) · GitHub App';
    try {
      ghAppTokenFromKey_(props.getProperty('GITHUB_APP_PRIVATE_KEY'), true);
      return { id: 'publisher', label: appLabel, ok: true, detail: 'ঠিক আছে · GitHub App — টোকেন নিজে থেকে নবায়ন হয়, কখনো বদলাতে হবে না' };
    } catch (appErr) {
      if (!props.getProperty('GITHUB_TOKEN')) return { id: 'publisher', label: appLabel, ok: false, help: 'GitHub App key কাজ করছে না (' + String(appErr && appErr.message).slice(0, 40) + ')। Setup-এ নতুন .pem দিন।' };
    }
  }
  var label = 'প্রোডাক্ট সেভ — Apps Script GITHUB_TOKEN (বিকল্প পথ)';
  var token = props.getProperty('GITHUB_TOKEN');
  if (!token) return { id: 'publisher', label: label, ok: false, help: 'Apps Script → Project Settings → Script Properties-এ GITHUB_TOKEN বসান।' };
  try {
    var res = UrlFetchApp.fetch('https://api.github.com/repos/muslim-abaya-landingpage/Luxury-Dress-BD', {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'MuslimAbaya-Setup' }, muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code === 401) return { id: 'publisher', label: label, ok: false, help: 'টোকেন কাজ করছে না (মেয়াদ শেষ বা মুছে ফেলা)। নতুন টোকেন বানিয়ে Script Properties-এ GITHUB_TOKEN বদলান।' };
    if (code < 200 || code >= 300) return { id: 'publisher', label: label, ok: false, partial: true, help: 'GitHub উত্তর দিয়েছে ' + code + '। টোকেনে Luxury-Dress-BD রিপো ও Contents: Read and write আছে কিনা দেখুন।' };
    var headers = res.getAllHeaders(), exp = '';
    Object.keys(headers).forEach(function (k) { if (k.toLowerCase() === 'github-authentication-token-expiration') exp = String(headers[k]); });
    if (!exp) return { id: 'publisher', label: label, ok: true, detail: 'ঠিক আছে · মেয়াদ নেই (No expiration)' };
    var when = new Date(exp.replace(' UTC', 'Z').replace(/^(\d{4}-\d\d-\d\d) /, '$1T'));
    var days = isNaN(when) ? null : Math.floor((when.getTime() - Date.now()) / 86400000);
    var date = isNaN(when) ? exp : Utilities.formatDate(when, 'Asia/Dhaka', 'yyyy-MM-dd');
    if (days !== null && days < 0) return { id: 'publisher', label: label, ok: false, help: 'মেয়াদ শেষ হয়েছে ' + date + '। নতুন টোকেন বানিয়ে বদলান।' };
    if (days !== null && days <= 14) return { id: 'publisher', label: label, ok: false, partial: true, help: 'মেয়াদ শেষ হবে ' + date + ' (' + days + ' দিন বাকি)। এখনই নতুন টোকেন বানিয়ে বদলান।' };
    return { id: 'publisher', label: label, ok: true, detail: 'ঠিক আছে · মেয়াদ শেষ ' + date };
  } catch (e) {
    return { id: 'publisher', label: label, ok: false, partial: true, help: 'GitHub-এ যাচাই করা যায়নি: ' + String(e.message || e).slice(0, 80) };
  }
}
