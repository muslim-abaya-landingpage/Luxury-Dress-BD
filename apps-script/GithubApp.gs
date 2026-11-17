/**
 * GitHub App sign-in for Apps Script's own GitHub writes (the backup save path, image upload/list).
 *
 * The owner pastes the GitHub App's .pem once in Admin → Setup (stored in Script Properties as
 * GITHUB_APP_PRIVATE_KEY, converted to PKCS#8). Every save then asks GitHub for a 1-hour installation token;
 * nothing to renew. Without the key the old GITHUB_TOKEN property is used, exactly as before.
 * No key or token is ever returned or logged.
 */
var GH_APP_ID_ = '5791466';
var GH_APP_INSTALLATION_ID_ = '182727794';
var GH_REPO_ = 'muslim-abaya-landingpage/Luxury-Dress-BD';

function ghB64url_(bytesOrString) {
  return Utilities.base64EncodeWebSafe(bytesOrString).replace(/=+$/, '');
}

function ghDerLen_(n) {
  if (n < 0x80) return [n];
  var out = [];
  while (n > 0) { out.unshift(n & 0xff); n = n >> 8; }
  return [0x80 | out.length].concat(out);
}

/** GitHub's .pem (PKCS#1 "BEGIN RSA PRIVATE KEY") or a PKCS#8 key → PKCS#8 PEM text, as Apps Script needs. */
function ghPkcs8Pem_(pem) {
  var text = String(pem || '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
  var m = /-----BEGIN ((?:RSA )?PRIVATE KEY)-----([\s\S]+?)-----END \1-----/.exec(text);
  if (!m) throw new Error('BAD_PRIVATE_KEY');
  var body = m[2].replace(/\s+/g, '');
  if (m[1] === 'RSA PRIVATE KEY') {
    var raw = Utilities.base64Decode(body).map(function (b) { return b & 0xff; });
    var octet = [0x04].concat(ghDerLen_(raw.length), raw);
    var inner = [0x02, 0x01, 0x00, 0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00].concat(octet);
    var der = [0x30].concat(ghDerLen_(inner.length), inner).map(function (b) { return b > 127 ? b - 256 : b; });
    body = Utilities.base64Encode(der);
  }
  return '-----BEGIN PRIVATE KEY-----\n' + body.replace(/(.{64})/g, '$1\n').replace(/\n$/, '') + '\n-----END PRIVATE KEY-----\n';
}

function ghAppJwt_(pkcs8Pem, nowMs) {
  var now = Math.floor(nowMs / 1000);
  var input = ghB64url_(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' +
    ghB64url_(JSON.stringify({ iat: now - 60, exp: now + 540, iss: GH_APP_ID_ }));
  return input + '.' + ghB64url_(Utilities.computeRsaSha256Signature(input, pkcs8Pem));
}

/** A fresh (or cached, >5 min left) installation token from a PKCS#8 key; throws Error(code) on failure. */
function ghAppTokenFromKey_(pkcs8Pem, useCache) {
  var cache = null;
  try { cache = CacheService.getScriptCache(); } catch (e) {}
  if (useCache && cache) { var hit = cache.get('gh_app_token'); if (hit) return hit; }
  var res = UrlFetchApp.fetch('https://api.github.com/app/installations/' + GH_APP_INSTALLATION_ID_ + '/access_tokens', {
    method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ghAppJwt_(pkcs8Pem, Date.now()), Accept: 'application/vnd.github+json', 'User-Agent': 'MuslimAbaya-GitHubApp' } });
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('APP_TOKEN_' + code);
  var data = JSON.parse(res.getContentText() || '{}');
  if (!data.token) throw new Error('APP_TOKEN_EMPTY');
  if (useCache && cache) { try { cache.put('gh_app_token', data.token, 50 * 60); } catch (e2) {} }
  return data.token;
}

/** Token for Apps Script's GitHub calls: the GitHub App when its key is saved, else the old GITHUB_TOKEN. */
function githubToken_() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('GITHUB_APP_PRIVATE_KEY');
  if (key) {
    try { return ghAppTokenFromKey_(key, true); } catch (err) { console.warn('GitHub App token: ' + (err && err.message)); }
  }
  return props.getProperty('GITHUB_TOKEN') || '';
}

/** Admin → Setup: owner pastes the .pem; saved only after GitHub accepts it for Luxury-Dress-BD. */
function saveGithubAppKey_(e) {
  var v = verifyAdminSession_(String(param_(e, 'Token') || ''));
  if (!v.ok) return { ok: false, error: v.error || 'NOT_LOGGED_IN' };
  var ownerErr = requireOwnerAdmin_(v);
  if (ownerErr) return ownerErr;
  var pem;
  try { pem = ghPkcs8Pem_(param_(e, 'PrivateKey')); }
  catch (err) { return { ok: false, error: 'BAD_PRIVATE_KEY', message: '.pem ফাইলের পুরো লেখা পেস্ট করুন — -----BEGIN … থেকে -----END … পর্যন্ত।' }; }
  try {
    var token = ghAppTokenFromKey_(pem, false);
    var res = UrlFetchApp.fetch('https://api.github.com/repos/' + GH_REPO_, { muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'User-Agent': 'MuslimAbaya-GitHubApp' } });
    if (res.getResponseCode() !== 200) return { ok: false, error: 'REPO_NOT_REACHABLE', message: 'Key ঠিক আছে, কিন্তু App-টা Luxury-Dress-BD রিপো দেখতে পাচ্ছে না (HTTP ' + res.getResponseCode() + ')।' };
  } catch (err2) {
    var why = String(err2 && err2.message || err2);
    return { ok: false, error: 'APP_KEY_REJECTED', message: why === 'APP_TOKEN_401'
      ? 'GitHub এই key গ্রহণ করেনি — Muslim Abaya Site Bot App-এর সর্বশেষ .pem ফাইলটা দিন।'
      : 'GitHub-এর সঙ্গে যাচাই করা যায়নি (' + why.slice(0, 60) + ')।' };
  }
  var props = PropertiesService.getScriptProperties();
  props.setProperty('GITHUB_APP_PRIVATE_KEY', pem);
  try { CacheService.getScriptCache().remove('gh_app_token'); } catch (e3) {}
  return { ok: true, message: 'GitHub App সংযুক্ত হয়েছে। বিকল্প পথের সেভও এখন নিজে থেকে নবায়ন হওয়া টোকেনে চলবে — আর কখনো নবায়ন লাগবে না।' };
}
