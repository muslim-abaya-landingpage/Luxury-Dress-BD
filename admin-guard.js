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

  function recentlyVerified() {
    try { return Date.now() - Number(sessionStorage.getItem(STAMP_KEY) || 0) < FRESH_MS; } catch (e) { return false; }
  }
  function markVerified() {
    try { sessionStorage.setItem(STAMP_KEY, String(Date.now())); } catch (e) {}
  }

  function verifyNow() {
    if (!g.MaAdmin || !g.MaAdmin.verifySession) {
      location.href = loginUrl();
      return Promise.resolve(null);
    }
    return g.MaAdmin.verifySession().then(function (s) {
      if (!s) {
        try { sessionStorage.removeItem(STAMP_KEY); } catch (e) {}
        location.href = loginUrl();
        return null;
      }
      markVerified();
      return s;
    });
  }

  // সেশন সম্প্রতি যাচাই হয়ে থাকলে পেজ সঙ্গে সঙ্গে চালু হয় (সার্ভার প্রতিটি ডেটা কলেই টোকেন যাচাই করে);
  // যাচাই ব্যাকগ্রাউন্ডে চলে, অবৈধ হলে লগইনে পাঠায়।
  function requireAdmin() {
    var cached = g.MaAdmin && g.MaAdmin.getSession && g.MaAdmin.getSession();
    if (cached && recentlyVerified()) return Promise.resolve(cached);
    return verifyNow();
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
