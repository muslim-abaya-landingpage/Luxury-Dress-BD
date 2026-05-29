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

  function requireAdmin() {
    if (!g.MaAdmin || !g.MaAdmin.verifySession) {
      location.href = loginUrl();
      return Promise.resolve(null);
    }
    return g.MaAdmin.verifySession().then(function (s) {
      if (!s) {
        location.href = loginUrl();
        return null;
      }
      return s;
    });
  }

  g.MaAdminGuard = { require: requireAdmin };

  if (document.documentElement.getAttribute("data-admin-guard") === "1") {
    document.addEventListener("DOMContentLoaded", function () {
      requireAdmin();
    });
  }
})(window);
