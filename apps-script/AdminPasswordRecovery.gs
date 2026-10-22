/**
 * Muslim Abaya — self-service admin/staff password recovery.
 * This is a PUBLIC Apps Script web-app entry point; never trust a caller's role
 * or email. Only an existing active Admins row can be reset, after possession
 * of its registered mailbox is proven with an unguessable, single-use token.
 *
 * Install in the SAME bound Apps Script project as Code.gs; no secrets in HTML.
 */
var ADMIN_RECOVERY_SUCCESS_ = {
  ok: true,
  message: 'এই ইমেইলে অ্যাডমিন অ্যাকাউন্ট থাকলে রিসেট লিংক পাঠানো হবে। ইনবক্স ও Spam দেখুন।'
};
var ADMIN_RECOVERY_TTL_MS_ = 20 * 60 * 1000;
var ADMIN_RECOVERY_COOLDOWN_MS_ = 5 * 60 * 1000;
var ADMIN_RECOVERY_GLOBAL_LIMIT_ = 40;

function adminRecoveryDigest_(input) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(input), Utilities.Charset.UTF_8)
    .map(function(b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function adminRecoveryKey_(email) {
  return 'ma_admin_recovery_' + adminRecoveryDigest_(normalizeEmail_(email)).slice(0, 40);
}
function adminRecoveryTokenDigest_(email, token) {
  return adminRecoveryDigest_('admin-recovery-v1|' + getAuthSecret_() + '|' + normalizeEmail_(email) + '|' + token);
}
function adminRecoveryEqual_(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (!a || a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function adminRecoveryRecord_(props, key) {
  try { return JSON.parse(props.getProperty(key) || '{}') || {}; }
  catch (err) { return {}; }
}
function adminRecoveryValidEmail_(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Never reveal whether an email exists in the Admins sheet. */
function adminPasswordResetRequest_(e) {
  var email = normalizeEmail_(param_(e, 'Email'));
  if (!adminRecoveryValidEmail_(email)) return ADMIN_RECOVERY_SUCCESS_;
  if (!getAuthSecret_()) return { ok: false, error: 'RECOVERY_NOT_CONFIGURED', message: 'পাসওয়ার্ড রিকভারি এখন উপলব্ধ নয়।' };

  var pendingMail = null;
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var props = PropertiesService.getScriptProperties();
    var now = Date.now();
    var rate = adminRecoveryRecord_(props, 'ma_admin_recovery_global_rate');
    if (!rate.start || now - rate.start >= 3600000) rate = { start: now, count: 0 };
    if (Number(rate.count) >= ADMIN_RECOVERY_GLOBAL_LIMIT_) return ADMIN_RECOVERY_SUCCESS_;
    rate.count = Number(rate.count) + 1;
    props.setProperty('ma_admin_recovery_global_rate', JSON.stringify(rate));

    var key = adminRecoveryKey_(email);
    var previous = adminRecoveryRecord_(props, key);
    if (previous.requestedAt && now - Number(previous.requestedAt) < ADMIN_RECOVERY_COOLDOWN_MS_) {
      return ADMIN_RECOVERY_SUCCESS_;
    }
    var user = findAdminByEmail_(email);
    var eligible = user && String(user.status || '').trim().toLowerCase() !== 'blocked'
      && adminRecoveryValidEmail_(normalizeEmail_(user.email));
    var record = { requestedAt: now };
    if (eligible) {
      var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
      record.digest = adminRecoveryTokenDigest_(email, token);
      record.expiresAt = now + ADMIN_RECOVERY_TTL_MS_;
      record.failures = 0;
      record.passwordFingerprint = adminRecoveryDigest_(String(user.hash) + '|' + String(user.salt));
      pendingMail = {
        to: String(user.email).trim(),
        link: 'https://muslimabaya.com/admin-reset-password.html?email='
          + encodeURIComponent(email) + '&token=' + encodeURIComponent(token)
      };
    }
    // Store cooldown for known and unknown addresses to avoid account probing.
    props.setProperty(key, JSON.stringify(record));
  } finally {
    lock.releaseLock();
  }

  if (pendingMail) {
    try {
      MailApp.sendEmail({
        to: pendingMail.to,
        subject: 'Muslim Abaya — Admin password recovery',
        body: 'A password reset was requested for your Muslim Abaya admin account.\n\n'
          + 'To choose a new password, open this one-time link (valid for 20 minutes):\n'
          + pendingMail.link
          + '\n\nIf you did not request this, ignore the message. Your current password remains unchanged.'
      });
    } catch (mailErr) {
      // Never leak whether this address was an admin account or the token itself.
      console.error('Admin recovery email could not be delivered.');
    }
  }
  return ADMIN_RECOVERY_SUCCESS_;
}

/** New password is committed only after the single-use email token is verified. */
function adminPasswordResetConfirm_(e) {
  var email = normalizeEmail_(param_(e, 'Email'));
  var token = String(param_(e, 'Token') || '').trim();
  var password = String(param_(e, 'NewPassword') || '');
  if (!adminRecoveryValidEmail_(email) || !/^[a-f0-9]{64}$/.test(token)) {
    return { ok: false, error: 'INVALID_RECOVERY_LINK', message: 'রিসেট লিংক ভুল বা মেয়াদোত্তীর্ণ। নতুন লিংক নিন।' };
  }
  if (password.length < 12 || password.length > 128) {
    return { ok: false, error: 'WEAK_PASSWORD', message: '১২–১২৮ অক্ষরের নতুন পাসওয়ার্ড দিন।' };
  }
  if (!getAuthSecret_()) return { ok: false, error: 'RECOVERY_NOT_CONFIGURED', message: 'পাসওয়ার্ড রিকভারি এখন উপলব্ধ নয়।' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    var key = adminRecoveryKey_(email);
    var record = adminRecoveryRecord_(props, key);
    var now = Date.now();
    if (!record.digest || !record.expiresAt || now >= Number(record.expiresAt)
        || Number(record.failures || 0) >= 8) {
      return { ok: false, error: 'INVALID_RECOVERY_LINK', message: 'রিসেট লিংক ভুল বা মেয়াদোত্তীর্ণ। নতুন লিংক নিন।' };
    }
    if (!adminRecoveryEqual_(record.digest, adminRecoveryTokenDigest_(email, token))) {
      record.failures = Number(record.failures || 0) + 1;
      props.setProperty(key, JSON.stringify(record));
      return { ok: false, error: 'INVALID_RECOVERY_LINK', message: 'রিসেট লিংক ভুল বা মেয়াদোত্তীর্ণ। নতুন লিংক নিন।' };
    }
    var user = findAdminByEmail_(email);
    if (!user || String(user.status || '').trim().toLowerCase() === 'blocked'
        || record.passwordFingerprint !== adminRecoveryDigest_(String(user.hash) + '|' + String(user.salt))) {
      props.deleteProperty(key);
      return { ok: false, error: 'INVALID_RECOVERY_LINK', message: 'রিসেট লিংক ভুল বা মেয়াদোত্তীর্ণ। নতুন লিংক নিন।' };
    }
    if (verifyPassword_(password, user.salt, user.hash)) {
      return { ok: false, error: 'SAME_PASSWORD', message: 'আগের পাসওয়ার্ডের বদলে নতুন একটি পাসওয়ার্ড দিন।' };
    }

    var hashed = hashPassword_(password);
    var sheet = getAdminsSheet_();
    sheet.getRange(user.row, 4, 1, 2).setValues([[hashed.hash, hashed.salt]]);
    sheet.getRange(user.row, 9).setValue(new Date());

    // Revoke admin/staff sessions for this mailbox; customer sessions are untouched.
    var sessions = getSessionsSheet_();
    var rows = sessions.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      var role = String(rows[i][6] || '').trim().toLowerCase();
      if (normalizeEmail_(rows[i][1]) === email && (role === 'admin' || role === 'staff')) {
        sessions.getRange(i + 1, 1).clearContent();
      }
    }
    SpreadsheetApp.flush();
    props.deleteProperty(key);
    bumpAdminAuthGeneration_();
    return { ok: true, message: 'পাসওয়ার্ড পরিবর্তন হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।' };
  } finally {
    lock.releaseLock();
  }
}

function adminPasswordRecoveryHandle_(type, e) {
  if (type === 'AdminPasswordResetRequest') return adminPasswordResetRequest_(e);
  if (type === 'AdminPasswordResetConfirm') return adminPasswordResetConfirm_(e);
  return { ok: false, error: 'UNKNOWN_TYPE' };
}
