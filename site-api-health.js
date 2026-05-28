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
    var url = getApiUrl();
    if (!url) {
      return Promise.resolve({ ok: false, error: "NO_URL", message: "site-api-config.js এ URL নেই।" });
    }
    if (!force) {
      var cached = readCache();
      if (cached) return Promise.resolve(cached);
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

  g.checkSiteApiHealth = checkSiteApiHealth;
})(window);
