/**
 * অ্যাডমিন পেজ সুরক্ষা — লগইন ছাড়া প্রবেশ বন্ধ
 */
(function (g) {
  function loginUrl() {
    var page = "admin-login.html";
    var next = location.pathname.split("/").pop() || "admin-dashboard.html";
    if (location.search) next += location.search;
    return page + "?next=" + encodeURIComponent(next);
  }

  var STAMP_KEY = "ma_admin_verified_at";
  var FRESH_MS = 10 * 60 * 1000;
  var verifying = null;

  function recentlyVerified(token) {
    try {
      var stamp = JSON.parse(sessionStorage.getItem(STAMP_KEY) || "null");
      return stamp && stamp.token === token && Date.now() - stamp.at < FRESH_MS;
    } catch (e) { return false; }
  }
  function verifyNow() {
    if (verifying) return verifying;
    verifying = g.MaAdmin.verifySession().then(function (s) {
      if (!s) { location.href = loginUrl(); return null; }
      try { sessionStorage.setItem(STAMP_KEY, JSON.stringify({ token: s.token, at: Date.now() })); } catch (e) {}
      return s;
    }).catch(function () { return g.MaAdmin.getSession(); });
    verifying.then(function () { verifying = null; });
    return verifying;
  }

  // The shell can start immediately; every API request still validates authorization.
  function requireAdmin() {
    var cached = g.MaAdmin && g.MaAdmin.getSession && g.MaAdmin.getSession();
    if (!cached) { location.href = loginUrl(); return Promise.resolve(null); }
    if (!recentlyVerified(cached.token)) verifyNow();
    return Promise.resolve(cached);
  }

  function requireOwner() {
    return requireAdmin().then(function (s) {
      if (!s) return null;
      if (s.role !== "admin") {
        alert("এই পেজ শুধুমাত্র মূল অ্যাডমিনের জন্য।");
        location.href = "admin-dashboard.html";
        return null;
      }
      return s;
    });
  }

  g.MaAdminGuard = { require: requireAdmin, requireOwner: requireOwner };

  if (document.documentElement.getAttribute("data-admin-guard") === "1") {
    document.addEventListener("DOMContentLoaded", function () {
      requireAdmin();
    });
  }
})(window);
