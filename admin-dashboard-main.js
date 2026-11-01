/* Main admin dashboard: recent orders, KPIs, sync status, and page controls. */
(function () {
  var session = null;

  function statusClass(s) {
    var x = String(s || "").toLowerCase();
    if (x.indexOf("ship") !== -1) return "shipped";
    if (x.indexOf("confirm") !== -1) return "confirmed";
    return "pending";
  }

  function phoneStats(orders) {
    var stats = {};
    orders.forEach(function (o) {
      var p = String(o.phone || "").trim();
      if (!p) return;
      if (!stats[p]) stats[p] = { total: 0, badOutcome: 0 };
      stats[p].total++;
      var s = String(o.status || "").toLowerCase();
      if (s.indexOf("cancel") !== -1 || s.indexOf("return") !== -1) stats[p].badOutcome++;
    });
    return stats;
  }

  function waLink(phone, text) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (/^01\d{9}$/.test(digits)) digits = "88" + digits;
    else if (/^1\d{9}$/.test(digits)) digits = "880" + digits;
    return /^8801\d{9}$/.test(digits) ? "https://wa.me/" + digits + "?text=" + encodeURIComponent(text || "") : "";
  }

  window.printInvoice = function (o) { window.MaInvoice.print(o); };

  var STATUS_COLORS = { pending: "#c9831a", confirmed: "#2a55a8", shipped: "#5b3aa6", delivered: "#16794a", cancelled: "#c0362c", returned: "#c0362c", other: "#9aa0a9" };

  function statusKey(s) {
    var x = String(s || "").toLowerCase();
    if (!x || x.indexOf("pend") !== -1) return "pending";
    if (x.indexOf("deliver") !== -1) return "delivered";
    if (x.indexOf("ship") !== -1) return "shipped";
    if (x.indexOf("confirm") !== -1) return "confirmed";
    if (x.indexOf("cancel") !== -1) return "cancelled";
    if (x.indexOf("return") !== -1) return "returned";
    return "other";
  }

  function parseDate(t) {
    return MaOrderInsights.dateKey(t);
  }
  function num(v) {
    var bn = "০১২৩৪৫৬৭৮৯";
    var text = String(v || "0").replace(/[০-৯]/g, function (d) { return String(bn.indexOf(d)); }).replace(/,/g, "");
    var match = text.match(/-?(?:\d+(?:\.\d*)?|\.\d+)/);
    var amount = match ? Number(match[0]) : 0;
    return Number.isFinite(amount) ? amount : 0;
  }
  function dayKey(d) { return d.toISOString().slice(0, 10); }

  var recentQuery = "";
  var recentOrders = [];
  function renderOrders(orders) {
    recentOrders = Array.isArray(orders) ? orders : [];
    var filtered = recentOrders.filter(function(o){ return !recentQuery || [o.orderId,o.name,o.phone].join(" ").toLowerCase().indexOf(recentQuery)!==-1; });
    var count = document.getElementById("admRecentCount");
    if(count)count.textContent = "Showing " + Math.min(8,filtered.length) + " of " + recentOrders.length + " loaded orders";
    var body = document.getElementById("admOrdersBody");
    if (!filtered.length) { body.innerHTML = '<tr><td colspan="7" class="dz-empty">' + (recentQuery ? 'No matching orders among the loaded records.' : 'No recent orders available.') + '</td></tr>'; return; }
    var stats = phoneStats(recentOrders);
    window.__admOrdersById = {};
    body.innerHTML = filtered.slice(0, 8).map(function (o, idx) {
      var rowId = "admOrderRow" + idx;
      window.__admOrdersById[rowId] = o;
      var st = stats[String(o.phone || "").trim()] || { total: 0, badOutcome: 0 };
      var tags = "";
      if (st.total >= 2) tags += "<em>Returning Customers (" + st.total + ")</em>";
      if (st.badOutcome >= 2) tags += '<em class="bad">⚠️ রিস্কি</em>';
      var key = statusKey(o.status);
      var displayStatus = MaOrderStatus.describe(o);
      key = displayStatus.badgeKey;
      var confirmMsg = "আসসালামু আলাইকুম " + (o.name || "") + ", আপনার অর্ডার #" + (o.orderId || "") + " (৳" + (o.total || 0) + ") কনফার্ম হয়েছে। শীঘ্রই ডেলিভারি করা হবে, ধন্যবাদ।";
      var orderLink = o.orderId ? '<a class="adm-order-open" href="admin-order.html?id=' + encodeURIComponent(o.orderId) + '">#' + escapeHtml(o.orderId) + '</a>' : '<span>—</span>';
      var productText = (o.design || (Array.isArray(o.items) ? o.items.join(", ") : "") || "No product details").replace(/\s*\n\s*/g, " ").slice(0, 120);
      var wa = waLink(o.phone, confirmMsg);
      return '<tr class="adm-recent-order-row" data-order-id="' + escapeHtml(o.orderId || "") + '">' +
        '<td class="adm-recent-order-id">' + orderLink + '</td>' +
        '<td class="adm-recent-date">' + escapeHtml(o.time || "—") + '</td>' +
        '<td class="adm-recent-customer"><strong>' + escapeHtml(o.name || "—") + '</strong><small>' + escapeHtml(o.phone || "—") + '</small>' + (tags ? '<span class="adm-recent-tags">' + tags + '</span>' : '') + '</td>' +
        '<td class="adm-recent-products">' + escapeHtml(productText) + '</td>' +
        '<td class="adm-recent-total"><strong>৳' + escapeHtml(o.total) + '</strong><small>' + escapeHtml(o.payment || "") + (o.district ? " · " + escapeHtml(o.district) : "") + '</small></td>' +
        '<td class="adm-recent-status" title="' + escapeHtml(displayStatus.note) + '"><span class="dz-chip ' + key + '">' + escapeHtml(displayStatus.orderRaw) + '</span><small class="adm-courier-state">Courier: ' + escapeHtml(displayStatus.hasCourier ? displayStatus.courierLabel : 'Not sent') + '</small></td>' +
        '<td><div class="dz-row-actions">' + (wa ? '<a target="_blank" rel="noopener" href="' + wa + '">WhatsApp</a>' : '') + '<button type="button" onclick="printInvoice(window.__admOrdersById[\'' + rowId + '\'])">Print</button></div></td>' +
        '</tr>';
    }).join("");
  }

  function renderStats(orders) {
    var statsEl = document.getElementById("admStats");
    if (!orders || !orders.length) {
      statsEl.hidden = true;
      document.getElementById("dzWeekTotal").textContent = "";
      document.getElementById("dzBars").innerHTML = '<div class="dz-empty">অর্ডার এলে সাপ্তাহিক চার্ট দেখা যাবে।</div>';
      document.getElementById("dzSplit").innerHTML = "";
      document.getElementById("dzLegend").innerHTML = '<div class="dz-empty">এখনো স্ট্যাটাস ডেটা নেই।</div>';
      document.getElementById("dzDist").innerHTML = "";
      return;
    }
    var revenue = 0, pending = 0, shipped = 0, counts = {}, districts = {};
    var todayKey = MaOrderInsights.dhakaToday(), todayCount = 0, todayRev = 0;
    var days = [];
    var todayParts = todayKey.split("-").map(Number);
    for (var d = 6; d >= 0; d--) { var dt = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2] - d)); days.push({ key: dayKey(dt), date: dt, n: 0 }); }
    orders.forEach(function (o) {
      var amt = num(o.total);
      revenue += amt;
      var k = statusKey(o.status);
      counts[k] = (counts[k] || 0) + 1;
      if (k === "pending") pending++;
      if (k === "shipped" || k === "delivered") shipped++;
      if (o.district) districts[o.district] = (districts[o.district] || 0) + 1;
      var od = parseDate(o.time);
      if (od) {
        var ok = od;
        if (ok === todayKey) { todayCount++; todayRev += amt; }
        days.forEach(function (x) { if (x.key === ok) x.n++; });
      }
    });
    document.getElementById("admStatCount").textContent = orders.length;
    document.getElementById("admStatRevenue").textContent = "৳" + revenue.toLocaleString("en-US");
    document.getElementById("admStatDeliveredValue").textContent = "৳" + MaOrderInsights.analyze(orders).groups.delivered.value.toLocaleString("en-US");
    document.getElementById("admStatPending").textContent = pending;
    document.getElementById("admStatShipped").textContent = shipped;
    document.getElementById("dzTodayCount").textContent = todayCount;
    document.getElementById("dzTodayRev").textContent = "৳" + todayRev.toLocaleString("en-US");
    var ps = phoneStats(orders), rep = 0;
    Object.keys(ps).forEach(function (p) { if (ps[p].total >= 2) rep++; });
    document.getElementById("dzRepeat").textContent = rep;

    var max = Math.max.apply(null, days.map(function (x) { return x.n; }).concat([1]));
    var names = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"];
    document.getElementById("dzWeekTotal").textContent = "মোট " + days.reduce(function (a, x) { return a + x.n; }, 0);
    var weekEl = document.getElementById("dzWeekCount"); if (weekEl) weekEl.textContent = days.reduce(function (a, x) { return a + x.n; }, 0);
    document.getElementById("dzBars").innerHTML = days.map(function (x) {
      return '<div class="dz-bar' + (x.key === todayKey ? " is-today" : "") + '"><em>' + x.n + '</em><div style="height:' + Math.max(3, Math.round(x.n / max * 100)) + '%"></div><span>' + names[x.date.getUTCDay()] + "</span></div>";
    }).join("");

    var order = ["pending", "confirmed", "shipped", "delivered", "cancelled", "returned", "other"];
    var labels = { pending: "Pending", confirmed: "Confirmed", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", returned: "Returned", other: "অন্যান্য" };
    var present = order.filter(function (k) { return counts[k]; });
    document.getElementById("dzSplit").innerHTML = present.map(function (k) {
      return '<i style="width:' + (counts[k] / orders.length * 100) + "%;background:" + STATUS_COLORS[k] + '"></i>';
    }).join("");
    document.getElementById("dzLegend").innerHTML = present.map(function (k) {
      return '<div><s style="--c:' + STATUS_COLORS[k] + '"></s>' + labels[k] + "<b>" + counts[k] + "</b></div>";
    }).join("");
    var top = Object.keys(districts).sort(function (a, b) { return districts[b] - districts[a]; }).slice(0, 5);
    document.getElementById("dzDist").innerHTML = top.map(function (d) { return "<span>" + escapeHtml(d) + " · " + districts[d] + "</span>"; }).join("");
    statsEl.hidden = false;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function setSyncState(state, text) {
    var status = document.getElementById("admSyncStatus");
    status.className = "adm-sync " + state;
    document.getElementById("admSyncText").textContent = text;
  }

  function friendlyError(err) {
    var code = String(err && (err.code || err.message) || "").toUpperCase();
    if (/INVALID_TOKEN|EXPIRED|NOT_ADMIN|NO_TOKEN|NOT_LOGGED_IN/.test(code)) return "আপনার অ্যাডমিন সেশন শেষ হয়েছে। আবার লগ ইন করে চেষ্টা করুন।";
    if (code.indexOf("API_MISSING") !== -1) return "অ্যাডমিন API কনফিগার করা নেই। সাইট কনফিগারেশন যাচাই করুন।";
    if (code.indexOf("TIMEOUT") !== -1) return "সার্ভার সাড়া দিতে সময় নিচ্ছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।";
    if (code.indexOf("DEPLOY_OLD") !== -1 || code.indexOf("INVALID_RESPONSE") !== -1) return "সার্ভার From অপ্রত্যাশিত উত্তর এসেছে। Apps Script-এর বর্তমান deployment যাচাই করুন।";
    if (code.indexOf("NO_SHEET") !== -1) return "অর্ডার শিট পাওয়া যায়নি। Google Sheet সংযোগ যাচাই করুন।";
    return "সার্ভারের সঙ্গে সংযোগ করা যায়নি। ইন্টারনেট পরীক্ষা করে আবার চেষ্টা করুন।";
  }

  function setAdminLink(id, rawUrl, host) {
    var link = document.getElementById(id);
    link.hidden = true;
    try {
      var url = new URL(String(rawUrl || ""));
      if (url.protocol !== "https:" || url.hostname !== host) return;
      link.href = url.href;
      link.hidden = false;
    } catch (e) {}
  }

  var ordersShown = false;
  function applyOrders(res) {
    var orders = Array.isArray(res.orders) ? res.orders : [];
    ordersShown = true;
    document.getElementById("admOrderCount").textContent = orders.length + "টি লোড করা অর্ডার";
    renderOrders(orders);
    renderStats(orders);
    document.getElementById("admOrdersBody").setAttribute("aria-busy", "false");
    if (res.sheetUrl) setAdminLink("admOpenSheet", res.sheetUrl, "docs.google.com");
    if (res.scriptUrl) setAdminLink("admOpenScript", res.scriptUrl, "script.google.com");
  }
  function loadOrders(options) {
    var cached = MaAdmin.cached("AdminOrders", { Limit: 100 });
    if (cached) {
      applyOrders(cached);
      setSyncState("checking", "সংরক্ষিত ডেটা দেখানো হচ্ছে · লাইভ আপডেট যাচাই হচ্ছে…");
    } else {
      setSyncState("checking", "অর্ডার ডেটা আপডেট হচ্ছে…");
    }
    var btn = document.getElementById("admRefresh");
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    btn.textContent = "আপডেট হচ্ছে…";
    document.getElementById("admOrdersBody").setAttribute("aria-busy", "true");
    return MaAdmin.fetchOrders(100, options).then(function (res) {
      applyOrders(res);
      document.getElementById("admLoadNotice").hidden = true;
      var time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date());
      setSyncState("ok", "সর্বশেষ সফল আপডেট " + time + " (বাংলাদেশ সময়)");
    }).catch(function (err) {
      var message = friendlyError(err);
      setSyncState("error", ordersShown ? "আপডেট ব্যর্থ · আগের ডেটা দেখানো হচ্ছে" : "অর্ডার ডেটা লোড করা যায়নি");
      if (ordersShown) {
        var notice = document.getElementById("admLoadNotice");
        notice.textContent = message + " আগের লোড করা তথ্য অপরিবর্তিত রাখা হয়েছে।";
        notice.hidden = false;
      } else {
        var body = document.getElementById("admOrdersBody");
        body.innerHTML = '<tr><td colspan="7"><div class="dz-error" role="alert"><b>অর্ডার ডেটা পাওয়া যায়নি</b><span>' + escapeHtml(message) + '</span><button type="button" id="admRetry">আবার চেষ্টা করুন</button></div></td></tr>';
        var retry = document.getElementById("admRetry");
        if (retry) retry.addEventListener("click", function () { loadOrders(); });
      }
    }).then(function () {
      btn.disabled = false;
      btn.setAttribute("aria-busy", "false");
      btn.textContent = "Refresh";
      document.getElementById("admOrdersBody").setAttribute("aria-busy", "false");
    });
  }

  MaAdminGuard.require().then(function (s) {
    if (!s) return;
    session = s;
    document.getElementById("admUserLabel").textContent =
      (s.name || "Admin") + (s.email ? " · " + s.email : "");
    document.getElementById("dzName").textContent = s.name || "Admin";
    document.getElementById("dzDate").textContent = new Intl.DateTimeFormat("bn-BD", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Dhaka" }).format(new Date());
    if (s.sheetUrl) setAdminLink("admOpenSheet", s.sheetUrl, "docs.google.com");
    if (s.scriptUrl) setAdminLink("admOpenScript", s.scriptUrl, "script.google.com");
    loadOrders({ maxAgeMs: 15000 });
  });

  document.getElementById("admRefresh").addEventListener("click", loadOrders);
  document.getElementById("admRecentSearch").addEventListener("input", function(e){ recentQuery=e.target.value.trim().toLowerCase(); renderOrders(recentOrders); });
  document.getElementById("admLogout").addEventListener("click", function () {
    MaAdmin.logout();
    location.href = "admin-login.html";
  });

  // Mobile sidebar drawer
  var sidebar = document.getElementById("admSidebar");
  var backdrop = document.getElementById("admSbBackdrop");
  var menuBtn = document.getElementById("admMenuBtn");
  var closeBtn = document.getElementById("admSbClose");
  function openDrawer() { sidebar.classList.add("is-open"); backdrop.classList.add("is-open"); }
  function closeDrawer() { sidebar.classList.remove("is-open"); backdrop.classList.remove("is-open"); }
  if (menuBtn) menuBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (backdrop) backdrop.addEventListener("click", closeDrawer);
})();
