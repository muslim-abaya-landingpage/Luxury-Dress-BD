/**
 * MFA Phase 2 foundation — pure TOTP verification only.
 *
 * This module deliberately does not generate or persist secrets, issue login
 * challenges, or create sessions. Integrate those only after secure secret
 * storage, challenge expiry, rate limits, and atomic replay-state storage are
 * implemented and tested in staging.
 *
 * verifyTotpCode_ returns the matched 30-second counter, or null. A caller must
 * persist that counter atomically (for example under ScriptLock) and pass it as
 * lastAcceptedCounter on the next verification; otherwise replay prevention is
 * not provided by this pure verifier alone.
 */
var MFA_TOTP_STEP_SECONDS_ = 30;
var MFA_TOTP_DIGITS_ = 6;
var MFA_TOTP_WINDOW_STEPS_ = 1;

function mfaDecodeBase32Secret_(secretBase32) {
  var raw = String(secretBase32 || '').replace(/\s+/g, '').toUpperCase();
  if (!raw || raw.length > 128) return null;

  var text = raw;
  var firstPadding = raw.indexOf('=');
  if (firstPadding !== -1) {
    text = raw.slice(0, firstPadding);
    var padding = raw.slice(firstPadding);
    if (!/^=+$/.test(padding) || raw.length % 8 !== 0) return null;
    var paddingByRemainder = { 0: 0, 2: 6, 4: 4, 5: 3, 7: 1 };
    var expectedPadding = paddingByRemainder[text.length % 8];
    if (expectedPadding == null || expectedPadding === 0 || padding.length !== expectedPadding) return null;
  }

  if (text.length < 26 || !/^[A-Z2-7]+$/.test(text)) return null;
  var remainder = text.length % 8;
  if ([0, 2, 4, 5, 7].indexOf(remainder) === -1) return null;

  var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  var bytes = [];
  var buffer = 0;
  var bits = 0;
  for (var i = 0; i < text.length; i++) {
    var value = alphabet.indexOf(text.charAt(i));
    if (value < 0) return null;
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 255);
      buffer &= (1 << bits) - 1;
    }
  }
  // RFC 6238 requires at least 128 bits; 160-bit secrets are recommended for SHA-1.
  if (bytes.length < 16 || (bits > 0 && buffer !== 0)) return null;
  return bytes;
}

function mfaCounterBytes_(counter) {
  if (!isFinite(counter) || counter < 0 || Math.floor(counter) !== counter || counter > 9007199254740991) return null;
  var high = Math.floor(counter / 4294967296);
  var low = counter - high * 4294967296;
  return [
    (high >>> 24) & 255,
    (high >>> 16) & 255,
    (high >>> 8) & 255,
    high & 255,
    (low >>> 24) & 255,
    (low >>> 16) & 255,
    (low >>> 8) & 255,
    low & 255
  ];
}

function mfaTotpCodeForCounter_(secretBytes, counter) {
  var message = mfaCounterBytes_(counter);
  if (!message || typeof Utilities === 'undefined' || !Utilities.MacAlgorithm || !Utilities.MacAlgorithm.HMAC_SHA_1) return null;
  var digest;
  try {
    digest = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, message, secretBytes);
  } catch (err) {
    return null;
  }
  if (!digest || digest.length < 20) return null;

  var offset = Number(digest[digest.length - 1]) & 15;
  if (offset + 3 >= digest.length) return null;
  var binary = ((Number(digest[offset]) & 127) * 16777216) +
    ((Number(digest[offset + 1]) & 255) * 65536) +
    ((Number(digest[offset + 2]) & 255) * 256) +
    (Number(digest[offset + 3]) & 255);
  var modulus = Math.pow(10, MFA_TOTP_DIGITS_);
  var code = String(binary % modulus);
  while (code.length < MFA_TOTP_DIGITS_) code = '0' + code;
  return code;
}

function mfaConstantTimeCodeEquals_(expected, supplied) {
  if (typeof expected !== 'string' || typeof supplied !== 'string' || expected.length !== supplied.length) return false;
  var difference = 0;
  for (var i = 0; i < expected.length; i++) {
    difference |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  }
  return difference === 0;
}

/**
 * Verify a six-digit SHA-1 TOTP (RFC 6238) within the current and adjacent
 * 30-second steps. Returns the matched counter, or null for every failure.
 */
function verifyTotpCode_(secretBase32, code, nowMs, lastAcceptedCounter) {
  var supplied = String(code == null ? '' : code).trim();
  if (!/^\d{6}$/.test(supplied)) return null;
  var secretBytes = mfaDecodeBase32Secret_(secretBase32);
  if (!secretBytes) return null;

  var time = nowMs == null ? Date.now() : Number(nowMs);
  if (!isFinite(time) || time < 0 || time > 9007199254740991) return null;
  var currentCounter = Math.floor(Math.floor(time / 1000) / MFA_TOTP_STEP_SECONDS_);

  var lastCounter = -1;
  if (lastAcceptedCounter != null && lastAcceptedCounter !== '') {
    lastCounter = Number(lastAcceptedCounter);
    if (!isFinite(lastCounter) || lastCounter < -1 || lastCounter > 9007199254740991 || Math.floor(lastCounter) !== lastCounter) return null;
  }

  for (var delta = -MFA_TOTP_WINDOW_STEPS_; delta <= MFA_TOTP_WINDOW_STEPS_; delta++) {
    var counter = currentCounter + delta;
    if (counter < 0 || counter <= lastCounter) continue;
    var expected = mfaTotpCodeForCounter_(secretBytes, counter);
    if (expected && mfaConstantTimeCodeEquals_(expected, supplied)) return counter;
  }
  return null;
}
