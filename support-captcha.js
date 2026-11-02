/* Cloudflare Turnstile token for Supabase Auth calls on the support-agent pages
   (sign in, sign up, password reset). When CAPTCHA protection is on in Supabase Auth,
   every one of those calls must carry options.captchaToken or Supabase refuses it.
   The site key is public; the secret key lives only in Supabase (Auth → Attack Protection). */
(function (global) {
  "use strict";
  var DEFAULT_SITE_KEY = "0x4AAAAAAFfxnZO3GtKn9kh3";
  var scriptPromise = null;
  var widgets = {};

  function siteKey() {
    var cfg = (global.SITE_FOOTER_CONFIG || {}).supportChat || {};
    return cfg.turnstileSiteKey || DEFAULT_SITE_KEY;
  }

  function loadScript() {
    if (global.turnstile) return Promise.resolve();
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { scriptPromise = null; reject(new Error("CAPTCHA could not load. Check your connection and try again.")); };
      document.head.appendChild(s);
    });
    return scriptPromise;
  }

  /* Renders a fresh Turnstile widget in `box` and resolves with its one-time token.
     A token can be used once, so call this again before every Auth request. */
  function getToken(box, action) {
    if (!box) return Promise.reject(new Error("CAPTCHA box missing."));
    return loadScript().then(function () {
      var key = box.id || action;
      if (widgets[key] !== undefined) {
        try { global.turnstile.remove(widgets[key]); } catch (_) {}
        delete widgets[key];
      }
      box.hidden = false;
      return new Promise(function (resolve, reject) {
        widgets[key] = global.turnstile.render(box, {
          sitekey: siteKey(),
          action: action,
          callback: function (token) { resolve(token); },
          "error-callback": function () { reject(new Error("CAPTCHA failed. Please try again.")); },
          "expired-callback": function () { reject(new Error("CAPTCHA expired. Please try again.")); }
        });
      });
    });
  }

  global.maSupportCaptcha = { getToken: getToken, siteKey: siteKey };
})(window);
