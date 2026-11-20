/**
 * Customer one-time codes by email (free: sent with MailApp from the owner's Gmail).
 *   CustomerCodeRequest  { Login, Purpose: 'login' | 'reset' }  -> emails a 6-digit code
 *   CustomerCodeLogin    { Login, Code }                        -> signs the customer in
 *   CustomerPasswordReset{ Login, Code, Password }              -> sets a new password and signs in
 * Login may be the account email or mobile number; the code always goes to the account's email.
 * Replies never say whether an account exists. Codes: 10 minutes, one use, 5 wrong tries,
 * one new code per minute per account. Every sign-up has an email, so every account can use this.
 */
var CUSTOMER_CODE_TTL_MS_ = 10 * 60 * 1000;
var CUSTOMER_CODE_RESEND_MS_ = 60 * 1000;
var CUSTOMER_CODE_MAX_TRIES_ = 5;

function customerCodeSentReply_() {
  return { ok: true, message: 'If an account exists for this email or mobile number, a 6-digit code has been sent to its email. Check Inbox and Spam.' };
}

function customerCodeKey_(email) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalizeEmail_(email), Utilities.Charset.UTF_8);
  var hex = bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  return 'CUST_CODE_' + hex;
}

/** Account for an email or mobile number typed into one box; null when none. */
function findCustomerByLogin_(login) {
  login = String(login || '').trim();
  if (!login) return null;
  if (login.indexOf('@') !== -1) {
    var email = normalizeEmail_(login);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? findCustomerByEmail_(email) : null;
  }
  var phone = normalizePhone_(login);
  return /^01\d{9}$/.test(phone) ? findCustomerByPhone_(phone) : null;
}

function requestCustomerCode_(e) {
  if (!getAuthSecret_()) return { ok: false, error: 'AUTH_NOT_CONFIGURED', message: 'Customer sign-in is not configured.' };
  var purpose = String(param_(e, 'Purpose') || 'login') === 'reset' ? 'reset' : 'login';
  var login = String(param_(e, 'Login') || '').trim();
  if (!login) return { ok: false, error: 'MISSING_FIELDS', message: 'Enter your email or mobile number.' };
  // Out of daily email quota: say so plainly (true for every account, so it reveals nothing).
  try {
    if (MailApp.getRemainingDailyQuota() < 3) {
      return { ok: false, error: 'EMAIL_LIMIT', message: 'We cannot send codes right now. Please sign in with your password, or contact us on WhatsApp.' };
    }
  } catch (quotaErr) {}

  var user = findCustomerByLogin_(login);
  var email = user ? normalizeEmail_(user.email) : '';
  if (!user || !email || String(user.status || '').toLowerCase() === 'blocked') return customerCodeSentReply_();

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { ok: false, error: 'BUSY', message: 'Please try again.' };
  var props = PropertiesService.getScriptProperties();
  var key = customerCodeKey_(email);
  try {
    var old = null;
    try { old = JSON.parse(props.getProperty(key) || 'null'); } catch (parseErr) {}
    if (old && Date.now() - Number(old.sentAt || 0) < CUSTOMER_CODE_RESEND_MS_) return customerCodeSentReply_();

    var code = ('000000' + (parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 1000000)).slice(-6);
    var hashed = hashPassword_(code);
    props.setProperty(key, JSON.stringify({ hash: hashed.hash, salt: hashed.salt, purpose: purpose, expires: Date.now() + CUSTOMER_CODE_TTL_MS_, sentAt: Date.now(), attempts: 0 }));

    var what = purpose === 'reset' ? 'reset your password' : 'sign in';
    var subject = 'Muslim Abaya code: ' + code;
    var body = 'Your Muslim Abaya code to ' + what + ' is: ' + code +
      '\n\nIt expires in 10 minutes and works once. If you did not ask for it, ignore this email.';
    var htmlBody = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111">' +
      '<h2 style="margin:0 0 12px">Muslim Abaya</h2><p>Your code to ' + what + ' is:</p>' +
      '<div style="font-size:30px;font-weight:700;letter-spacing:8px;padding:16px;background:#f4f4f4;text-align:center">' + code + '</div>' +
      '<p>It expires in 10 minutes and works once. If you did not ask for it, ignore this email.</p></div>';
    MailApp.sendEmail({ to: email, subject: subject, body: body, htmlBody: htmlBody, name: 'Muslim Abaya' });
    customerCodeCount_();
  } catch (err) {
    props.deleteProperty(key);
    console.error('Customer code email failed: ' + String(err && err.message || err));
    return { ok: false, error: 'EMAIL_FAILED', message: 'The code could not be sent. Please try again in a minute.' };
  } finally {
    lock.releaseLock();
  }
  return customerCodeSentReply_();
}

/** Checks a code; on success the code is used up. Returns { user } or an error reply. */
function useCustomerCode_(login, code, purpose) {
  if (!/^\d{6}$/.test(String(code || ''))) return { error: { ok: false, error: 'INVALID_CODE', message: 'Enter the 6-digit code from your email.' } };
  var user = findCustomerByLogin_(login);
  var bad = { error: { ok: false, error: 'INVALID_CODE', message: 'That code is not right or has expired. Ask for a new code.' } };
  if (!user || !user.email) return bad;
  if (String(user.status || '').toLowerCase() === 'blocked') return { error: { ok: false, error: 'BLOCKED', message: 'This account is unavailable.' } };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return { error: { ok: false, error: 'BUSY', message: 'Please try again.' } };
  var props = PropertiesService.getScriptProperties();
  var key = customerCodeKey_(user.email);
  try {
    var rec = null;
    try { rec = JSON.parse(props.getProperty(key) || 'null'); } catch (parseErr) {}
    if (!rec || rec.purpose !== purpose) return bad;
    if (Date.now() > Number(rec.expires) || Number(rec.attempts || 0) >= CUSTOMER_CODE_MAX_TRIES_) {
      props.deleteProperty(key);
      return bad;
    }
    if (hashPassword_(String(code), rec.salt).hash !== rec.hash) {
      rec.attempts = Number(rec.attempts || 0) + 1;
      if (rec.attempts >= CUSTOMER_CODE_MAX_TRIES_) props.deleteProperty(key);
      else props.setProperty(key, JSON.stringify(rec));
      return bad;
    }
    props.deleteProperty(key);
    return { user: user };
  } finally {
    lock.releaseLock();
  }
}

function customerCodeLogin_(e) {
  if (!getAuthSecret_()) return { ok: false, error: 'AUTH_NOT_CONFIGURED', message: 'Customer sign-in is not configured.' };
  var r = useCustomerCode_(param_(e, 'Login'), String(param_(e, 'Code') || '').trim(), 'login');
  if (r.error) return r.error;
  return createSession_({ email: r.user.email, phone: r.user.phone || '', name: r.user.name || '' }, 'customer');
}

function customerPasswordReset_(e) {
  if (!getAuthSecret_()) return { ok: false, error: 'AUTH_NOT_CONFIGURED', message: 'Customer sign-in is not configured.' };
  var password = String(param_(e, 'Password') || '');
  if (password.length < 8 || password.length > 128) return { ok: false, error: 'WEAK_PASSWORD', message: 'Use at least 8 characters for the new password.' };
  var r = useCustomerCode_(param_(e, 'Login'), String(param_(e, 'Code') || '').trim(), 'reset');
  if (r.error) return r.error;
  var email = normalizeEmail_(r.user.email);
  var sheet = getCustomersSheet_();
  var rows = sheet.getDataRange().getValues();
  var row = 0;
  for (var i = 1; i < rows.length; i++) if (normalizeEmail_(rows[i][0]) === email) { row = i + 1; break; }
  if (!row) return { ok: false, error: 'INVALID_CODE', message: 'That code is not right or has expired. Ask for a new code.' };
  var hashed = hashPassword_(password);
  sheet.getRange(row, 4).setValue(hashed.hash);
  sheet.getRange(row, 5).setValue(hashed.salt);
  sheet.getRange(row, 8).setValue(new Date());
  // Sign out every other device that was using the old password.
  var sessions = getSessionsSheet_();
  var srows = sessions.getDataRange().getValues();
  for (var j = srows.length - 1; j >= 1; j--) {
    if (normalizeEmail_(srows[j][1]) === email && String(srows[j][6] || 'customer') === 'customer') sessions.deleteRow(j + 1);
  }
  var out = createSession_({ email: r.user.email, phone: r.user.phone || '', name: r.user.name || '' }, 'customer');
  out.message = 'Your password has been changed.';
  return out;
}

/* Daily count of codes sent (Asia/Dhaka days, last 14 kept) for Admin → Setup ও স্ট্যাটাস. */
function customerCodeDay_(ms) {
  return Utilities.formatDate(new Date(ms == null ? Date.now() : ms), 'Asia/Dhaka', 'yyyy-MM-dd');
}

function customerCodeCount_() {
  try {
    var props = PropertiesService.getScriptProperties();
    var days = {};
    try { days = JSON.parse(props.getProperty('CUST_CODES_DAILY') || '{}') || {}; } catch (parseErr) { days = {}; }
    var today = customerCodeDay_();
    days[today] = (Number(days[today]) || 0) + 1;
    Object.keys(days).sort().slice(0, -14).forEach(function (d) { delete days[d]; });
    props.setProperty('CUST_CODES_DAILY', JSON.stringify(days));
  } catch (err) {}
}

/** { today, peak7, avg7, quotaLeft } — numbers only, no customer data. */
function customerCodeStats_() {
  var days = {};
  try { days = JSON.parse(PropertiesService.getScriptProperties().getProperty('CUST_CODES_DAILY') || '{}') || {}; } catch (err) { days = {}; }
  var last7 = [];
  for (var i = 0; i < 7; i++) last7.push(Number(days[customerCodeDay_(Date.now() - i * 86400000)]) || 0);
  var quota = null;
  try { quota = MailApp.getRemainingDailyQuota(); } catch (quotaErr) {}
  return {
    today: last7[0],
    peak7: Math.max.apply(null, last7),
    avg7: Math.round(last7.reduce(function (a, b) { return a + b; }, 0) / 7),
    quotaLeft: quota
  };
}

/** Row for the Setup page; warns when today's free Gmail allowance (100) is nearly used, or busy days approach it. */
function customerCodeSetupRow_() {
  var st = customerCodeStats_();
  var left = st.quotaLeft;
  var line = 'আজ ' + st.today + 'টি কোড গেছে · গত ৭ দিনে সর্বোচ্চ ' + st.peak7 + 'টি/দিন, গড় ' + st.avg7 + 'টি/দিন' +
    (left != null ? ' · আজ আর ' + left + 'টি ই-মেইল পাঠানো যাবে (ফ্রি Gmail-এ দিনে ১০০)' : '');
  var low = left != null && left < 20;
  var busy = st.peak7 >= 60;
  return {
    id: 'customerCodes',
    label: 'ক্রেতার লগইন / পাসওয়ার্ড কোড (ই-মেইল)',
    ok: !low && !busy,
    partial: low || busy,
    detail: line,
    help: line + (low ? ' — আজকের ফ্রি সীমা প্রায় শেষ। ক্রেতারা আজ পাসওয়ার্ড বা Google দিয়ে লগইন করতে পারবেন; কাল সীমা আবার পূর্ণ হবে।' : '') +
      (busy ? ' — ব্যস্ত দিনে সীমার কাছাকাছি যাচ্ছে। এমন নিয়মিত হলে বেশি সীমার (পেইড) ই-মেইল সার্ভিস ভেবে দেখার সময়।' : '')
  };
}
