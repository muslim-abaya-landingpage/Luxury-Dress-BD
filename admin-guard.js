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
