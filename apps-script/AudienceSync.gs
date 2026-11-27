/**
 * Weekly Meta audience sync: keeps customer-list Custom Audiences in the chosen ad account in step with the
 * shop's own orders (same lists as Admin → Ad audiences), so nobody has to download and upload CSV files.
 *
 * Uses the Meta Business System User token already stored for Messenger (MSGR_SYSTEM_TOKEN). It works only
 * when that system user has the ad account assigned and the token includes the ads_management permission;
 * otherwise status() says exactly what is missing. Only SHA-256 hashes of phone, first name and country are
 * sent (Meta's customer-list format); nothing is stored at Meta in plain text.
 *
 * Script properties:
 *   AUDIENCE_SYNC_ACCOUNT  ad account id (digits) chosen by the owner on the page
 *   AUDIENCE_SYNC_IDS      JSON { list: audienceId } — audiences this sync created
 *   AUDIENCE_SYNC_LAST     JSON { at, ok, message, counts }
 */
var AUDIENCE_SYNC_LISTS_ = {
  buyers: 'MA auto · আসল ক্রেতা',
  repeat: 'MA auto · বারবার কেনা',
  all: 'MA auto · সব কাস্টমার',
  abandoned: 'MA auto · চেকআউট থেমে গেছে',
  exclude: 'MA auto · বাদ দেওয়ার তালিকা'
};
var AUDIENCE_SYNC_MONTHS_ = 6; // the same default period as the page
var AUDIENCE_SYNC_BATCH_ = 5000;

function audienceSyncGraph_(method, path, token, payload) {
  var opt = { method: method, headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true };
  if (payload) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(payload); }
  var res = UrlFetchApp.fetch('https://graph.facebook.com/v25.0/' + path, opt);
  var body = {};
  try { body = JSON.parse(res.getContentText() || '{}'); } catch (err) {}
  return { status: res.getResponseCode(), body: body };
}

function audienceSyncGraphError_(r) {
  var e = r.body && r.body.error;
  return e ? String(e.error_user_msg || e.message || 'Meta error').slice(0, 300) : 'Meta HTTP ' + r.status;
}

function audienceSyncSha256_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var h = (b < 0 ? b + 256 : b).toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}

/** Rows in Meta's ["PHONE","FN","COUNTRY"] schema, hashed. People without a valid BD mobile are skipped. */
function audienceSyncRows_(people) {
  var out = [];
  people.forEach(function (p) {
    var phone = audiencePhone880_(p.phone);
    if (!phone) return;
    var fn = audienceSplitName_(p.name).fn.toLowerCase();
    out.push([audienceSyncSha256_(phone), fn ? audienceSyncSha256_(fn) : '', audienceSyncSha256_('bd')]);
  });
  return out;
}

/** What the token can do: { ok, accounts:[{id,name}], hasAdsPermission, message }. Never returns the token. */
function audienceSyncTokenInfo_() {
  var token = PropertiesService.getScriptProperties().getProperty('MSGR_SYSTEM_TOKEN');
  if (!token) return { ok: false, code: 'NO_TOKEN', message: 'Meta System User Token বসানো নেই। Setup → Messenger অংশে "সব Page একসাথে" বেছে System User Token দিন।' };
  var dbg = audienceSyncGraph_('get', 'debug_token?input_token=' + encodeURIComponent(token), token);
  var scopes = (dbg.body && dbg.body.data && dbg.body.data.scopes) || [];
  var hasAds = scopes.indexOf('ads_management') !== -1;
  var acc = audienceSyncGraph_('get', 'me/adaccounts?fields=account_id,name&limit=100', token);
  var accounts = ((acc.body && acc.body.data) || []).map(function (a) { return { id: String(a.account_id || ''), name: String(a.name || a.account_id || '') }; });
  return { ok: hasAds && accounts.length > 0, token: token, hasAdsPermission: hasAds, accounts: accounts,
    message: !hasAds ? 'Token-এ ads_management অনুমতি নেই — নতুন System User Token বানানোর সময় ads_management টিক দিন।'
      : !accounts.length ? 'এই System User-কে কোনো Ad account দেওয়া হয়নি — Business Settings → System Users → Assign assets → Ad accounts।' : '' };
}

function audienceSyncState_() {
  var props = PropertiesService.getScriptProperties();
  var parse = function (k) { try { return JSON.parse(props.getProperty(k) || '{}') || {}; } catch (e) { return {}; } };
  return { account: String(props.getProperty('AUDIENCE_SYNC_ACCOUNT') || ''), ids: parse('AUDIENCE_SYNC_IDS'), last: parse('AUDIENCE_SYNC_LAST') };
}

function audienceSyncTriggerOn_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'audienceSyncWeekly'; });
}

/** Owner: status for the page. */
function adminAudienceSyncStatus_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var info = audienceSyncTokenInfo_();
  var st = audienceSyncState_();
  return { ok: true, ready: info.ok, message: info.message || '', hasAdsPermission: !!info.hasAdsPermission,
    accounts: info.accounts || [], account: st.account, audiences: st.ids, last: st.last, weekly: audienceSyncTriggerOn_() };
}

/** Owner: choose the ad account (must be one the token can reach) and turn the weekly sync on or off. */
function adminAudienceSyncSave_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var account = String(param_(e, 'Account') || '').replace(/^act_/, '').trim();
  var weekly = String(param_(e, 'Weekly') || '') === '1';
  var info = audienceSyncTokenInfo_();
  if (!info.ok) return { ok: false, error: 'NOT_READY', message: info.message };
  if (!info.accounts.some(function (a) { return a.id === account; })) return { ok: false, error: 'BAD_ACCOUNT', message: 'তালিকা থেকে একটি Ad account বেছে নিন।' };
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('AUDIENCE_SYNC_ACCOUNT') !== account) props.deleteProperty('AUDIENCE_SYNC_IDS'); // new account → new audiences
  props.setProperty('AUDIENCE_SYNC_ACCOUNT', account);
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'audienceSyncWeekly') ScriptApp.deleteTrigger(t); });
  if (weekly) ScriptApp.newTrigger('audienceSyncWeekly').timeBased().onWeekDay(ScriptApp.WeekDay.SATURDAY).atHour(5).create();
  return { ok: true, account: account, weekly: weekly };
}

/** Owner: run the sync now. */
function adminAudienceSyncRun_(e) {
  var v = verifyAdminSession_(param_(e, 'Token'));
  if (!v.ok) return v;
  var owner = requireOwnerAdmin_(v);
  if (owner) return owner;
  var r = audienceSyncRun_();
  return r.ok ? { ok: true, last: r } : { ok: false, error: 'SYNC_FAILED', message: r.message };
}

/** Time trigger (weekly). */
function audienceSyncWeekly() { audienceSyncRun_(); }

function audienceSyncRun_() {
  var props = PropertiesService.getScriptProperties();
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { ok: false, message: 'অন্য একটি সিঙ্ক চলছে।' };
  var result;
  try {
    var info = audienceSyncTokenInfo_();
    var st = audienceSyncState_();
    if (!info.ok) result = { ok: false, message: info.message };
    else if (!st.account) result = { ok: false, message: 'Ad account বেছে নেওয়া হয়নি।' };
    else {
      var built = audienceBuildLists_(AUDIENCE_SYNC_MONTHS_);
      var ids = st.ids, counts = {}, errors = [];
      Object.keys(AUDIENCE_SYNC_LISTS_).forEach(function (list) {
        try {
          var id = ids[list];
          if (id) {
            var chk = audienceSyncGraph_('get', id + '?fields=id', info.token);
            if (chk.status !== 200) id = ''; // deleted in Ads Manager → make it again
          }
          if (!id) {
            var made = audienceSyncGraph_('post', 'act_' + st.account + '/customaudiences', info.token, {
              name: AUDIENCE_SYNC_LISTS_[list], subtype: 'CUSTOM', customer_file_source: 'USER_PROVIDED_ONLY',
              description: 'muslimabaya.com অ্যাডমিন থেকে প্রতি সপ্তাহে নিজে থেকে হালনাগাদ হয়। হাতে বদলাবেন না।'
            });
            if (!made.body || !made.body.id) throw new Error(audienceSyncGraphError_(made));
            id = String(made.body.id);
            ids[list] = id;
            props.setProperty('AUDIENCE_SYNC_IDS', JSON.stringify(ids));
          }
          var rows = audienceSyncRows_(built.picked[list] || []);
          // Meta refuses an empty replace; an empty list keeps the last members until people appear again.
          if (!rows.length) { counts[list] = 0; return; }
          // usersreplace swaps the whole member list in one session (batches share session_id).
          var session = { session_id: Math.floor(Math.random() * 9e15) + 1, estimated_num_total: rows.length };
          var batches = Math.max(1, Math.ceil(rows.length / AUDIENCE_SYNC_BATCH_));
          for (var b = 0; b < batches; b++) {
            var part = rows.slice(b * AUDIENCE_SYNC_BATCH_, (b + 1) * AUDIENCE_SYNC_BATCH_);
            var r = audienceSyncGraph_('post', id + '/usersreplace', info.token, {
              session: { session_id: session.session_id, batch_seq: b + 1, last_batch_flag: b === batches - 1, estimated_num_total: session.estimated_num_total },
              payload: { schema: ['PHONE', 'FN', 'COUNTRY'], data: part }
            });
            if (r.status !== 200 || (r.body && r.body.error)) throw new Error(audienceSyncGraphError_(r));
          }
          counts[list] = rows.length;
        } catch (listErr) {
          errors.push(AUDIENCE_SYNC_LISTS_[list] + ': ' + String(listErr && listErr.message || listErr).slice(0, 200));
        }
      });
      result = { ok: errors.length === 0, counts: counts,
        message: errors.length ? 'কিছু তালিকা হয়নি — ' + errors.join(' · ') : 'সব তালিকা Meta-তে হালনাগাদ হয়েছে।' };
    }
  } catch (err) {
    result = { ok: false, message: String(err && err.message || err).slice(0, 300) };
  } finally {
    lock.releaseLock();
  }
  result.at = Utilities.formatDate(new Date(), 'Asia/Dhaka', 'yyyy-MM-dd HH:mm');
  props.setProperty('AUDIENCE_SYNC_LAST', JSON.stringify(result));
  return result;
}
