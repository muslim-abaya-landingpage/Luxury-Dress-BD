/**
 * Admin password recovery for the Google Sheets Admins account.
 * Uses a short-lived email OTP; never exposes whether an account exists.
 */
function adminPasswordRecoveryReply_() {
  return { ok: true, message: 'If this email belongs to an active admin, a recovery code has been sent.' };
}

function adminPasswordRecoveryKey_(email) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalizeEmail_(email), Utilities.Charset.UTF_8);
  var hex = bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  return 'ADMIN_PW_RESET_' + hex;
}

function requestAdminPasswordReset_(e) {
  var email = normalizeEmail_(param_(e, 'Email'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return adminPasswordRecoveryReply_();
  try { rateLimit_('admin_pw_reset_' + email); } catch (err) { return adminPasswordRecoveryReply_(); }

  var user = findAdminByEmail_(email);
  if (!user || String(user.status || '').trim().toLowerCase() === 'blocked') return adminPasswordRecoveryReply_();

  var role = String(user.role || 'admin').trim().toLowerCase();
  if (role !== 'admin' && role !== 'staff') return adminPasswordRecoveryReply_();

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return adminPasswordRecoveryReply_();
  try {
    var code = ('000000' + (parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 1000000)).slice(-6);
    var hashed = hashPassword_(code);
    var expires = Date.now() + 10 * 60 * 1000;
    var record = { hash: hashed.hash, salt: hashed.salt, expires: expires, attempts: 0 };
    PropertiesService.getScriptProperties().setProperty(adminPasswordRecoveryKey_(email), JSON.stringify(record));

    var subject = 'Muslim Abaya Admin password recovery';
    var body = 'Your Muslim Abaya Admin password recovery code is: ' + code +
      '\n\nThis code expires in 10 minutes and can be used once. If you did not request this, ignore this email.';
    var htmlBody = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#20242a">' +
      '<h2>Muslim Abaya Admin</h2><p>Your password recovery code is:</p>' +
      '<div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:16px;background:#f3f5f8;border-radius:10px;text-align:center">' + code + '</div>' +
      '<p>This code expires in 10 minutes and can be used once. If you did not request this, ignore this email.</p></div>';
    MailApp.sendEmail({ to: user.email, subject: subject, body: body, htmlBody: htmlBody, name: 'Muslim Abaya Admin' });
  } catch (err) {
    PropertiesService.getScriptProperties().deleteProperty(adminPasswordRecoveryKey_(email));
    console.error('Admin password recovery email failed: ' + String(err && err.message || err));
  } finally {
    lock.releaseLock();
  }
  return adminPasswordRecoveryReply_();
}

function confirmAdminPasswordReset_(e) {
  var email = normalizeEmail_(param_(e, 'Email'));
  var code = String(param_(e, 'Code') || '').trim();
  var password = String(param_(e, 'Password') || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code) || password.length < 8 || password.length > 128) {
    return { ok: false, error: 'INVALID_RESET', message: 'ইমেইল, ৬ সংখ্যার কোড এবং কমপক্ষে ৮ অক্ষরের নতুন পাসওয়ার্ড দিন।' };
  }
  try { rateLimit_('admin_pw_confirm_' + email); } catch (err) {
    return { ok: false, error: 'RATE_LIMIT', message: 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' };
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, error: 'BUSY', message: 'অনুগ্রহ করে আবার চেষ্টা করুন।' };
  var key = adminPasswordRecoveryKey_(email);
  try {
    var props = PropertiesService.getScriptProperties();
    var raw = props.getProperty(key);
    if (!raw) return { ok: false, error: 'INVALID_RESET', message: 'কোডটি ভুল বা মেয়াদোত্তীর্ণ। নতুন কোড নিন।' };
    var record;
    try { record = JSON.parse(raw); } catch (parseErr) { props.deleteProperty(key); return { ok: false, error: 'INVALID_RESET', message: 'নতুন কোড নিন।' }; }
    if (!record || Date.now() > Number(record.expires) || Number(record.attempts || 0) >= 5) {
      props.deleteProperty(key);
      return { ok: false, error: 'EXPIRED_RESET', message: 'কোডটির মেয়াদ শেষ। নতুন কোড নিন।' };
    }
    if (hashPassword_(code, record.salt).hash !== record.hash) {
      record.attempts = Number(record.attempts || 0) + 1;
      if (record.attempts >= 5) props.deleteProperty(key);
      else props.setProperty(key, JSON.stringify(record));
      return { ok: false, error: 'INVALID_RESET', message: 'কোডটি সঠিক নয়। আবার চেষ্টা করুন।' };
    }

    var user = findAdminByEmail_(email);
    if (!user || String(user.status || '').trim().toLowerCase() === 'blocked') {
      props.deleteProperty(key);
      return { ok: false, error: 'INVALID_RESET', message: 'অ্যাকাউন্টটি পাওয়া যায়নি বা বন্ধ রয়েছে।' };
    }
    var hashed = hashPassword_(password);
    var adminSheet = getAdminsSheet_();
    adminSheet.getRange(user.row, 4).setValue(hashed.hash);
    adminSheet.getRange(user.row, 5).setValue(hashed.salt);
    if (adminSheet.getLastColumn() >= 9) adminSheet.getRange(user.row, 9).setValue(new Date());

    // Revoke every existing session for this account immediately.
    var sessions = getSessionsSheet_();
    var rows = sessions.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      if (normalizeEmail_(rows[i][1]) === email) sessions.deleteRow(i + 1);
    }
    props.deleteProperty(key);
    bumpAdminAuthGeneration_();
    return { ok: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে। এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Run once from the Apps Script editor as the deployment owner.
 * This grants MailApp permission before the public web app attempts to send recovery codes.
 */
function authorizeAdminPasswordRecoveryMail() {
  var remaining = MailApp.getRemainingDailyQuota();
  Logger.log('Admin password recovery mail authorization is ready. Remaining recipient quota: ' + remaining);
  return { ok: true, remainingDailyQuota: remaining };
}
