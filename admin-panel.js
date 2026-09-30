/**
 * Muslim Abaya — Admin Order Panel: শেয়ার্ড শেল (সাইডবার, টোস্ট, হেল্পার)
 * ব্যবহার: MaPanel.init("orders") — পেজে <aside id="pnSide"></aside> থাকতে হবে
 */
(function (g) {
  var NAV = [
    { key: "dashboard", href: "admin-dashboard.html", ico: "▦", label: "ড্যাশবোর্ড" },
    { key: "orders", href: "admin-orders.html", ico: "🧾", label: "অর্ডার প্যানেল" },
    { key: "inbox", href: "admin-inbox.html", ico: "💬", label: "Messenger ইনবক্স" },
    { key: "growth", href: "admin-growth.html", ico: "📈", label: "Growth" },
    { key: "products", href: "product-manager.html", ico: "🛍", label: "প্রোডাক্ট ম্যানেজার" },
    { key: "links", href: "admin-links.html", ico: "🔗", label: "পরিচালনা লিংক" },
    { key: "stock", href: "stock-analytics.html", ico: "📊", label: "স্টক ও অ্যানালিটিক্স" },
    { key: "staff", href: "admin-staff.html", ico: "👥", label: "স্টাফ" }
  ];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(n) {
    var v = Number(n) || 0;
    return "৳" + v.toLocaleString("en-US");
  }

  function statusClass(s) {
    return String(s || "pending").toLowerCase().replace(/[^a-z]/g, "") || "pending";
  }

  var toastTimer = null;
  function toast(msg, isErr) {
    var el = document.getElementById("pnToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "pnToast";
      el.className = "pn-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = "pn-toast show" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = "pn-toast"; }, isErr ? 6000 : 3000);
  }

  function renderSide(active, session) {
    var side = document.getElementById("pnSide");
    if (!side) return;
    var html = '<div class="pn-brand">Muslim <span>Abaya</span></div><nav class="pn-nav">';
    NAV.forEach(function (n) {
      html += '<a href="' + n.href + '" class="' + (n.key === active ? "active" : "") + '"><span class="ico">' + n.ico + "</span>" + n.label + "</a>";
    });
    html += "</nav>";
    if (session && session.sheetUrl) {
      html += '<div class="pn-nav" style="margin-top:8px"><a href="' + esc(session.sheetUrl) + '" target="_blank" rel="noopener"><span class="ico">📄</span>Google Sheet</a></div>';
    }
    html += '<div class="pn-side-foot"><div>' + esc((session && (session.name || session.email)) || "Admin") + '</div><button type="button" class="pn-btn pn-btn-sm" id="pnLogout">Logout</button></div>';
    side.innerHTML = html;
    document.getElementById("pnLogout").addEventListener("click", function () {
      MaAdmin.logout();
      location.href = "admin-login.html";
    });
    var btn = document.getElementById("pnMenuBtn");
    if (btn) btn.addEventListener("click", function () { side.classList.toggle("open"); });
  }

  // লগইন যাচাই করে সাইডবার আঁকে; session না থাকলে লগইন পেজে পাঠায়
  function init(active) {
    return MaAdminGuard.require().then(function (s) {
      if (s) renderSide(active, s);
      return s;
    });
  }

  function openModal(title, html) {
    var bg = document.getElementById("pnModal");
    if (!bg) {
      bg = document.createElement("div");
      bg.id = "pnModal";
      bg.className = "pn-modal-bg";
      bg.innerHTML = '<div class="pn-modal"><h3 id="pnModalTitle"></h3><div id="pnModalBody"></div><div style="text-align:right;margin-top:14px"><button type="button" class="pn-btn" id="pnModalClose">বন্ধ করুন</button></div></div>';
      document.body.appendChild(bg);
      bg.addEventListener("click", function (e) { if (e.target === bg) bg.classList.remove("open"); });
      bg.querySelector("#pnModalClose").addEventListener("click", function () { bg.classList.remove("open"); });
    }
    bg.querySelector("#pnModalTitle").textContent = title;
    bg.querySelector("#pnModalBody").innerHTML = html;
    bg.classList.add("open");
  }

  g.MaPanel = {
    init: init,
    esc: esc,
    money: money,
    statusClass: statusClass,
    toast: toast,
    openModal: openModal
  };
})(window);
