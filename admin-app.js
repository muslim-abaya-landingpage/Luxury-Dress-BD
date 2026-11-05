/* Admin as an installable app + new-order notifications (while any admin page is open, even in the background).
   Turn on from Setup ও স্ট্যাটাস → "এই ডিভাইস" or the dashboard's desktop-alert button (same setting). */
(function () {
  "use strict";
  var OPT_KEY = "ma_admin_desktop_alerts", SEEN_KEY = "ma_order_seen", LEAD_KEY = "ma_order_poll_at";
  var POLL_MS = 2 * 60 * 1000;
  var deferredPrompt = null;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function dhakaDay() { return new Date(Date.now() + 6 * 3600 * 1000).toISOString().slice(0, 10); }

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/admin-sw.js", { scope: "/admin" }).catch(function () {});
    });
  }

  function notify(title, body, url) {
    var opts = { body: body, tag: "ma-new-order", renotify: true, icon: "/images/admin/admin-icon-192.png", badge: "/images/admin/admin-icon-192.png", data: { url: url } };
    var fallback = function () { try { var n = new Notification(title, opts); n.onclick = function () { window.focus(); location.href = url; }; } catch (e) {} };
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration("/admin").then(function (reg) { if (reg && reg.showNotification) reg.showNotification(title, opts); else fallback(); }).catch(fallback);
    } else fallback();
  }
  function enabled() { return get(OPT_KEY) === "1" && "Notification" in window && Notification.permission === "granted"; }

  function poll() {
    if (!enabled() || !window.MaAdmin || !MaAdmin.getSession || !MaAdmin.getSession() || !MaAdmin.getAnalyticsV2) return;
    var now = Date.now(), last = Number(get(LEAD_KEY)) || 0;
    if (now - last < POLL_MS - 5000) return; // another admin tab checked moments ago
    set(LEAD_KEY, String(now));
    MaAdmin.getAnalyticsV2({ range: "today" }).then(function (res) {
      var count = Number(res && res.summary && res.summary.totalOrders) || 0;
      var day = dhakaDay(), seen = String(get(SEEN_KEY) || "").split("|");
      if (seen[0] === day && count > Number(seen[1] || 0)) {
        var added = count - Number(seen[1] || 0);
        notify(added === 1 ? "🛍 নতুন অর্ডার এসেছে" : "🛍 " + added + "টি নতুন অর্ডার", "আজ মোট " + count + "টি অর্ডার। দেখতে চাপুন।", "/admin-orders");
      }
      set(SEEN_KEY, day + "|" + count);
    }).catch(function () {});
  }
  setTimeout(poll, 8000);
  setInterval(poll, 30000); // cheap check; the leader key keeps real requests to one per 2 minutes

  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    document.documentElement.classList.add("ma-can-install");
    var foot = document.querySelector(".adm-sidebar-foot");
    if (foot && !document.getElementById("maInstallBtn")) {
      var b = document.createElement("button");
      b.type = "button"; b.id = "maInstallBtn"; b.className = "adm-btn adm-btn-secondary ma-install-btn";
      b.textContent = "📲 অ্যাপ হিসেবে ইনস্টল";
      b.addEventListener("click", function () { window.MaAdminApp.install(); });
      foot.insertBefore(b, foot.firstChild);
    }
  });
  window.addEventListener("appinstalled", function () {
    deferredPrompt = null;
    document.documentElement.classList.remove("ma-can-install");
    var b = document.getElementById("maInstallBtn"); if (b) b.remove();
  });

  window.MaAdminApp = {
    canInstall: function () { return !!deferredPrompt; },
    installed: function () { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; },
    install: function () {
      if (!deferredPrompt) return Promise.resolve(false);
      var p = deferredPrompt; deferredPrompt = null;
      p.prompt();
      return p.userChoice.then(function (c) { return c && c.outcome === "accepted"; });
    },
    alertsOn: enabled,
    enableAlerts: function () {
      if (!("Notification" in window)) return Promise.reject(new Error("এই ব্রাউজারে নোটিফিকেশন নেই।"));
      return Notification.requestPermission().then(function (perm) {
        if (perm !== "granted") throw new Error("ব্রাউজারে নোটিফিকেশনের অনুমতি দেওয়া হয়নি। ঠিকানার পাশের 🔒 আইকন থেকে Allow করুন।");
        set(OPT_KEY, "1");
        set(SEEN_KEY, ""); set(LEAD_KEY, "0");
        poll();
        return true;
      });
    },
    disableAlerts: function () { set(OPT_KEY, "0"); },
    test: function () { notify("🛍 টেস্ট নোটিফিকেশন", "নতুন অর্ডার এলে এভাবে জানানো হবে।", "/admin-orders"); }
  };
})();
