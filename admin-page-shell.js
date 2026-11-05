/* Shared wiring for simple admin pages: login check, user label, Refresh, Log out and the mobile menu.
   Usage: MaAdminShell.start(function load(session) { ... }); */
(function (g) {
  "use strict";
  function byId(id) { return document.getElementById(id); }
  function start(load) {
    var sidebar = byId("admSidebar"), backdrop = byId("admSbBackdrop");
    function openDrawer() { if (sidebar) sidebar.classList.add("is-open"); if (backdrop) backdrop.classList.add("is-open"); }
    function closeDrawer() { if (sidebar) sidebar.classList.remove("is-open"); if (backdrop) backdrop.classList.remove("is-open"); }
    if (byId("admMenuBtn")) byId("admMenuBtn").addEventListener("click", openDrawer);
    if (byId("admSbClose")) byId("admSbClose").addEventListener("click", closeDrawer);
    if (backdrop) backdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });
    if (byId("admLogout")) byId("admLogout").addEventListener("click", function () { g.MaAdmin.logout(); location.href = "admin-login.html"; });
    var session = null;
    if (byId("admRefresh")) byId("admRefresh").addEventListener("click", function () { if (session) load(session, true); });
    g.MaAdminGuard.require().then(function (s) {
      if (!s) return;
      session = s;
      if (byId("admUserLabel")) byId("admUserLabel").textContent = (s.name || "Admin") + (s.email ? " · " + s.email : "");
      load(s, false);
    });
  }
  g.MaAdminShell = { start: start };
})(window);
