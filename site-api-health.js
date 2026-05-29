/**
 * Apps Script API স্বাস্থ্য পরীক্ষা (doGet → Muslim Abaya API OK)
 */
(function (g) {
  var CACHE_KEY = "ma_api_health_v1";
  var CACHE_MS = 5 * 60 * 1000;

  function getApiUrl() {
    if (typeof g.getSiteApiUrl === "function") return g.getSiteApiUrl();
    return (g.MA_SITE_API && g.MA_SITE_API.url) || "";
  }

  function isLocalPreview() {
    var p = window.location.protocol || "";
    return p === "file:" || p === "blob:";
  }

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || Date.now() - c.at > CACHE_MS) return null;
      return c;
    } catch (e) {
      return null;
    }
  }

  function writeCache(ok, detail) {
    try {
      sessionStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ ok: !!ok, detail: detail || "", at: Date.now() })
      );
    } catch (e) {}
  }

  function checkSiteApiHealth(force) {
    if (isLocalPreview()) {
      return Promise.resolve({
        ok: true,
        localPreview: true,
        skipErrorBanner: true,
        message: "লোকাল ফাইল — http সার্ভার দরকার।"
      });
    }
    var url = getApiUrl();
    if (!url) {
      return Promise.resolve({ ok: false, error: "NO_URL", message: "site-api-config.js এ URL নেই।" });
    }
    if (!force) {
      var cached = readCache();
      if (cached && cached.ok) return Promise.resolve(cached);
    }
    return fetch(url, { method: "GET", mode: "cors", cache: "no-store" })
      .then(function (res) {
        return res.text();
      })
      .then(function (text) {
        if (text.indexOf("Muslim Abaya API OK") !== -1) {
          var ok = { ok: true, message: "API ঠিক আছে।" };
          writeCache(true, "");
          return ok;
        }
        if (text.indexOf("doGet") !== -1) {
          var err = {
            ok: false,
            error: "NO_DOGET",
            message: "Google Script এ doGet নেই। API-দ্রুত-ঠিক.bat চালান।"
          };
          writeCache(false, "doGet");
          return err;
        }
        var unk = { ok: false, error: "BAD_RESPONSE", message: text.slice(0, 80) };
        writeCache(false, unk.message);
        return unk;
      })
      .catch(function () {
        var fail = { ok: false, error: "NETWORK", message: "API সংযোগ ব্যর্থ।" };
        writeCache(false, fail.message);
        return fail;
      });
  }

  /** Sign in / Sign up — শুধু আসল API সমস্যায় ব্যানার (file:// তে পেজ লোডে কিছু দেখায় না) */
  function showAuthApiNotice(cardSelector) {
    return checkSiteApiHealth().then(function (h) {
      if (h.ok || h.localPreview) return h;

      var card = document.querySelector(cardSelector || ".auth-card");
      if (!card || card.querySelector(".auth-api-notice")) return h;

      var b = document.createElement("p");
      b.className = "auth-api-notice auth-api-notice-warn";
      b.innerHTML =
        (h.message || "API সংযোগ ব্যর্থ") +
        ' — <a href="api-setup.html">সেটআপ গাইড</a> অথবা <strong>START-HERE.bat</strong> চালান।';
      card.insertBefore(b, card.firstChild);
      return h;
    });
  }

  function getLocalFileAuthHint() {
    return "লগইন/সাইনআপের জন্য file:// কাজ করে না।\n\nফোল্ডারে ADMIN-লোকাল-টেস্ট.bat ডাবল-ক্লিক করুন, তারপর ব্রাউজারে খুলুন:\nhttp://127.0.0.1/signin.html";
  }

  g.checkSiteApiHealth = checkSiteApiHealth;
  g.showAuthApiNotice = showAuthApiNotice;
  g.isLocalPreview = isLocalPreview;
  g.getLocalFileAuthHint = getLocalFileAuthHint;
})(window);
