/* Admin → Setup ও স্ট্যাটাস: shows which connections / automatic jobs are ready and turns jobs on in one click. */
(function () {
  "use strict";
  function byId(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  var busy = false;

  function row(state, title, detail, actionHtml) {
    var icon = state === "ok" ? "✓" : state === "warn" ? "!" : state === "off" ? "–" : "×";
    return '<li class="st-row st-' + state + '"><span class="st-dot" aria-hidden="true">' + icon + '</span>' +
      '<div class="st-text"><b>' + esc(title) + '</b>' + (detail ? '<small>' + esc(detail) + '</small>' : "") + '</div>' +
      (actionHtml || "") + '</li>';
  }

  function render(res) {
    var jobs = res.jobs || [], conns = res.connections || [];
    var required = conns.filter(function (c) { return !c.optional; });
    var okCount = jobs.filter(function (j) { return j.on; }).length + required.filter(function (c) { return c.ok; }).length;
    var total = jobs.length + required.length;
    byId("stScore").textContent = okCount + "/" + total;
    byId("stScore").className = "st-score" + (okCount === total ? " is-ok" : "");
    byId("stHeadline").textContent = okCount === total ? "সব ঠিক আছে" : (total - okCount) + "টি জিনিস দেখা দরকার";
    byId("stSub").textContent = "শেষ যাচাই: " + (res.checkedAt || "—") + " (বাংলাদেশ সময়)" +
      (res.lastOrderSyncAt ? " · শেষ অর্ডার সিঙ্ক: " + res.lastOrderSyncAt : "") +
      (res.siteDown ? " · ⚠ সাইট মনিটর শেষবার সাইট বন্ধ পেয়েছে" : "");

    byId("stJobs").innerHTML = jobs.map(function (j) {
      var detail = j.on ? (j.duplicates ? "চালু · একই কাজ " + (j.duplicates + 1) + " বার সেট করা — “আবার সেট করুন” চাপলে একটিতে নামবে" : "চালু") : "বন্ধ";
      var btn = j.action ? '<button type="button" class="adm-btn ' + (j.on ? "adm-btn-secondary" : "adm-btn-primary") + '" data-action="' + esc(j.action) + '">' + (j.on ? (j.duplicates ? "আবার সেট করুন" : "আবার সেট") : "চালু করুন") + "</button>" : "";
      return row(j.on ? (j.duplicates ? "warn" : "ok") : "bad", j.label, detail, btn);
    }).join("") || '<li class="st-empty">তথ্য নেই</li>';
    if (res.triggerError) byId("stJobs").insertAdjacentHTML("afterbegin", row("warn", "অটোমেটিক কাজের তালিকা পড়া যায়নি", res.triggerError));

    byId("stConnections").innerHTML = conns.map(function (c) {
      var state = c.ok ? "ok" : c.partial ? "warn" : c.optional ? "off" : "bad";
      var detail = c.ok ? (c.detail || "সেট করা আছে") : (c.optional ? "ঐচ্ছিক · " : "") + (c.help || "সেট করা নেই");
      return row(state, c.label, detail, "");
    }).join("");
  }

  function load() {
    if (busy) return;
    busy = true;
    byId("stError").hidden = true;
    byId("admRefresh").disabled = true;
    MaAdmin.getSetupStatus().then(render).catch(function (err) {
      var msg = String(err && err.message || err);
      if (/OWNER_ONLY|শুধুমাত্র মূল/.test(msg)) msg = "এই পেজ শুধু মূল অ্যাডমিন দেখতে পারবেন।";
      else if (/Unknown|UNKNOWN_RECORD|RecordType|not supported/i.test(msg)) msg = "সার্ভার এখনো নতুন সংস্করণে আপডেট হয়নি। কয়েক মিনিট পরে আবার চেষ্টা করুন।";
      byId("stError").textContent = msg;
      byId("stError").hidden = false;
      byId("stHeadline").textContent = "যাচাই করা যায়নি";
    }).finally(function () {
      busy = false;
      byId("admRefresh").disabled = false;
    });
  }

  function runAction(btn) {
    var action = btn.getAttribute("data-action");
    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "চলছে…";
    var inTests = !!btn.closest(".st-tests");
    var out = inTests ? byId("stResult") : byId("stJobResult");
    out.className = "st-result";
    out.textContent = "";
    MaAdmin.runSetupAction(action).then(function (res) {
      out.textContent = "✓ " + (res.message || "হয়ে গেছে।");
      out.className = "st-result is-ok";
      if (!inTests) load();
    }).catch(function (err) {
      out.textContent = "× " + String(err && err.message || err);
      out.className = "st-result is-bad";
    }).finally(function () {
      btn.disabled = false;
      btn.textContent = label;
    });
  }

  function paintDevice() {
    var app = window.MaAdminApp;
    var node = byId("stDevice");
    if (!app) { node.innerHTML = row("off", "এই ব্রাউজারে সমর্থিত নয়", ""); return; }
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    var installRow = app.installed() ? row("ok", "অ্যাপ হিসেবে চলছে", "হোম স্ক্রিন থেকে খোলা হয়েছে")
      : app.canInstall() ? row("bad", "অ্যাপ হিসেবে ইনস্টল করা নেই", "এক চাপে হোম স্ক্রিন / ডেস্কটপে যোগ হবে", '<button type="button" class="adm-btn adm-btn-primary" data-device="install">ইনস্টল করুন</button>')
      : row("off", "অ্যাপ হিসেবে ইনস্টল", ios ? "iPhone: Safari-তে Share ⬆ → “Add to Home Screen”" : "ব্রাউজারের মেনু (⋮) → “Install app” / “Add to Home screen”");
    var perm = ("Notification" in window) ? Notification.permission : "unsupported";
    var alertRow = perm === "unsupported" ? row("off", "নতুন অর্ডারের নোটিফিকেশন", ios ? "iPhone-এ আগে অ্যাপ হিসেবে যোগ করুন, তারপর এখানে চালু করুন" : "এই ব্রাউজারে নোটিফিকেশন নেই")
      : app.alertsOn() ? row("ok", "নতুন অর্ডারের নোটিফিকেশন চালু", "প্রতি ২ মিনিটে নতুন অর্ডার দেখা হয়", '<span class="st-btns"><button type="button" class="adm-btn adm-btn-secondary" data-device="test">টেস্ট</button><button type="button" class="adm-btn adm-btn-secondary" data-device="off">বন্ধ করুন</button></span>')
      : row(perm === "denied" ? "warn" : "bad", "নতুন অর্ডারের নোটিফিকেশন বন্ধ", perm === "denied" ? "ব্রাউজারে ব্লক করা — ঠিকানার পাশের 🔒 আইকন থেকে Notifications → Allow করুন" : "চালু করলে ব্রাউজার অনুমতি চাইবে", perm === "denied" ? "" : '<button type="button" class="adm-btn adm-btn-primary" data-device="on">চালু করুন</button>');
    node.innerHTML = installRow + alertRow;
  }
  function deviceAction(btn) {
    var kind = btn.getAttribute("data-device"), app = window.MaAdminApp, out = byId("stDeviceResult");
    out.className = "st-result"; out.textContent = "";
    var done = function (msg) { out.className = "st-result is-ok"; out.textContent = "✓ " + msg; paintDevice(); };
    var fail = function (err) { out.className = "st-result is-bad"; out.textContent = "× " + String(err && err.message || err); paintDevice(); };
    if (kind === "install") app.install().then(function (ok) { if (ok) done("অ্যাপ যোগ হচ্ছে।"); else paintDevice(); });
    else if (kind === "on") app.enableAlerts().then(function () { done("নোটিফিকেশন চালু হয়েছে।"); }).catch(fail);
    else if (kind === "off") { app.disableAlerts(); done("নোটিফিকেশন বন্ধ করা হয়েছে।"); }
    else if (kind === "test") { app.test(); done("টেস্ট নোটিফিকেশন পাঠানো হয়েছে।"); }
  }
  window.addEventListener("beforeinstallprompt", function () { setTimeout(paintDevice, 0); });
  window.addEventListener("load", paintDevice);
  document.addEventListener("click", function (event) {
    var dev = event.target.closest("[data-device]");
    if (dev) { deviceAction(dev); return; }
    var btn = event.target.closest("[data-action]");
    if (btn && !btn.disabled) runAction(btn);
  });

  MaAdminShell.start(function () { load(); });
})();
