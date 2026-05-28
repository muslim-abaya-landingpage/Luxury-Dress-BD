(function (g) {
  function stripControl(s) {
    return String(s || "").replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  }

  function sanitizeText(value, maxLen) {
    var s = stripControl(value).trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }

  function validateEmail(email) {
    var e = sanitizeText(email, 120).toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
  }

  function normalizePhoneBd(phone) {
    var digits = String(phone || "").replace(/[^\d]/g, "");
    if (digits.indexOf("880") === 0 && digits.length >= 12) digits = "0" + digits.slice(3);
    if (digits.length === 10 && digits.charAt(0) === "1") digits = "0" + digits;
    return /^01\d{9}$/.test(digits) ? digits : "";
  }

  function checkPasswordStrength(password) {
    var p = String(password || "");
    if (p.length < 8) {
      return { ok: false, message: "পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে।" };
    }
    if (/\s/.test(p)) {
      return { ok: false, message: "পাসওয়ার্ডে স্পেস ব্যবহার করবেন না।" };
    }
    if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) {
      return {
        ok: false,
        message: "পাসওয়ার্ডে অন্তত একটি অক্ষর ও একটি সংখ্যা থাকতে হবে।"
      };
    }
    return { ok: true };
  }

  var submitGuards = {};

  function guardSubmit(key, cooldownMs) {
    var now = Date.now();
    var last = submitGuards[key] || 0;
    if (now - last < (cooldownMs || 2000)) return false;
    submitGuards[key] = now;
    return true;
  }

  g.MaSecurity = {
    sanitizeText: sanitizeText,
    validateEmail: validateEmail,
    normalizePhoneBd: normalizePhoneBd,
    checkPasswordStrength: checkPasswordStrength,
    guardSubmit: guardSubmit
  };
})(window);
