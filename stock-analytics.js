/**
 * Muslim Abaya — Stock & Analytics পেজ
 */
(function () {
  "use strict";

  function toast(msg) {
    var el = document.getElementById("saToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    setTimeout(function () { el.classList.remove("is-visible"); }, 3000);
  }

  function fmtMoney(n) {
    var num = Number(n) || 0;
    return "\u09F3" + num.toLocaleString("en-BD", { maximumFractionDigits: 2 });
  }

  function allProducts() {
    var cats = window.CATEGORY_PRODUCTS || {};
    var out = [];
    var seen = {};
    Object.keys(cats).forEach(function (key) {
      var list = cats[key];
      if (!Array.isArray(list)) return;
      list.forEach(function (p) {
        if (!p || !p.id || seen[p.id]) return;
        seen[p.id] = true;
        out.push({ id: p.id, name: p.name || p.id, category: key });
      });
    });
    return out;
  }

  // ===== Tabs =====
  function initTabs() {
    var stockBtn = document.getElementById("saTabStockBtn");
    var analyticsBtn = document.getElementById("saTabAnalyticsBtn");
    var stockPanel = document.getElementById("saStockPanel");
    var analyticsPanel = document.getElementById("saAnalyticsPanel");

    function activate(tab) {
      var isStock = tab === "stock";
      stockPanel.hidden = !isStock;
      analyticsPanel.hidden = isStock;
      stockBtn.classList.toggle("is-active", isStock);
      analyticsBtn.classList.toggle("is-active", !isStock);
      if (!isStock && !analyticsPanel.dataset.loaded) {
        loadAnalytics();
      }
    }

    stockBtn.addEventListener("click", function () { activate("stock"); });
    analyticsBtn.addEventListener("click", function () { activate("analytics"); });
  }

  // ===== Stock tab =====
  function loadStock() {
    var statusEl = document.getElementById("saStockStatus");
    var body = document.getElementById("saStockBody");
    statusEl.textContent = "লোড হচ্ছে...";
    body.innerHTML = "";

    MaAdmin.getStock().then(function (res) {
      var stockMap = {};
      (res.items || []).forEach(function (it) { stockMap[it.productId] = it; });

      var products = allProducts();
      if (!products.length) {
        statusEl.textContent = "কোনো প্রোডাক্ট পাওয়া যায়নি।";
        return;
      }

      products.forEach(function (p) {
        var stockRow = stockMap[p.id];
        var tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #eee";

        var tdId = document.createElement("td");
        tdId.style.padding = "6px";
        tdId.textContent = p.id;
        tr.appendChild(tdId);

        var tdName = document.createElement("td");
        tdName.style.padding = "6px";
        tdName.textContent = p.name;
        tr.appendChild(tdName);

        var tdQty = document.createElement("td");
        tdQty.style.padding = "6px";
        tdQty.textContent = stockRow ? stockRow.qty : "ট্র্যাক করা হয়নি";
        tr.appendChild(tdQty);

        var tdInput = document.createElement("td");
        tdInput.style.padding = "6px";
        var input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.style.width = "80px";
        input.style.padding = "4px 6px";
        input.placeholder = stockRow ? String(stockRow.qty) : "0";
        tdInput.appendChild(input);
        tr.appendChild(tdInput);

        var tdBtn = document.createElement("td");
        tdBtn.style.padding = "6px";
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pl-btn pl-btn-secondary";
        btn.textContent = "সেভ";
        btn.addEventListener("click", function () {
          var val = parseInt(input.value, 10);
          if (isNaN(val) || val < 0) {
            toast("সঠিক Qty দিন");
            return;
          }
          btn.disabled = true;
          MaAdmin.setStock(p.id, p.name, val).then(function () {
            toast("\u2705 " + p.name + " — স্টক আপডেট হয়েছে");
            loadStock();
          }).catch(function (err) {
            toast("\u26a0\ufe0f ব্যর্থ: " + (err && err.message));
            btn.disabled = false;
          });
        });
        tdBtn.appendChild(btn);
        tr.appendChild(tdBtn);

        var tdUpdated = document.createElement("td");
        tdUpdated.style.padding = "6px";
        tdUpdated.style.color = "#888";
        tdUpdated.style.fontSize = "0.85rem";
        tdUpdated.textContent = stockRow ? stockRow.updatedAt : "—";
        tr.appendChild(tdUpdated);

        body.appendChild(tr);
      });

      statusEl.textContent = products.length + "টি প্রোডাক্ট, " + (res.items || []).length + "টি ট্র্যাক করা হচ্ছে";
    }).catch(function (err) {
      statusEl.textContent = "ব্যর্থ: " + (err && err.message);
    });
  }

  // ===== Analytics tab =====
  function loadAnalytics() {
    var panel = document.getElementById("saAnalyticsPanel");
    var statusEl = document.getElementById("saAnalyticsStatus");
    var days = parseInt(document.getElementById("saAnalyticsDays").value, 10) || 30;
    statusEl.textContent = "লোড হচ্ছে...";

    MaAdmin.getAnalytics(days).then(function (res) {
      panel.dataset.loaded = "1";

      var cards = document.getElementById("saSummaryCards");
      cards.innerHTML = "";
      var summary = [
        { label: "মোট অর্ডার", value: res.totalOrders },
        { label: "মোট রেভিনিউ", value: fmtMoney(res.totalRevenue) },
        { label: "গড় অর্ডার ভ্যালু", value: fmtMoney(res.avgOrderValue) },
        { label: "কুরিয়ারে পাঠানো", value: res.courierOrders }
      ];
      summary.forEach(function (s) {
        var card = document.createElement("div");
        card.style.cssText = "background:#fff;border:1px solid #e2e2e2;border-radius:10px;padding:14px 16px";
        card.innerHTML = "<div style='font-size:0.8rem;color:#888;margin-bottom:6px'>" + s.label + "</div><div style='font-size:1.3rem;font-weight:700'>" + s.value + "</div>";
        cards.appendChild(card);
      });

      var byDayBody = document.getElementById("saByDayBody");
      byDayBody.innerHTML = "";
      (res.byDay || []).slice().reverse().forEach(function (d) {
        var tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #eee";
        tr.innerHTML = "<td style='padding:6px'>" + d.date + "</td><td style='padding:6px'>" + d.orders + "</td><td style='padding:6px'>" + fmtMoney(d.revenue) + "</td>";
        byDayBody.appendChild(tr);
      });

      var topBody = document.getElementById("saTopProductsBody");
      topBody.innerHTML = "";
      (res.topProducts || []).forEach(function (p) {
        var tr = document.createElement("tr");
        tr.style.borderBottom = "1px solid #eee";
        var name = p.name + (p.approx ? " (approx)" : "");
        tr.innerHTML = "<td style='padding:6px'>" + name + "</td><td style='padding:6px'>" + p.qty + "</td><td style='padding:6px'>" + (p.revenue ? fmtMoney(p.revenue) : "—") + "</td>";
        topBody.appendChild(tr);
      });

      statusEl.textContent = "সর্বশেষ " + res.rangeDays + " দিনের তথ্য";
    }).catch(function (err) {
      statusEl.textContent = "ব্যর্থ: " + (err && err.message);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTabs();

    document.getElementById("saStockRefresh").addEventListener("click", loadStock);
    document.getElementById("saAnalyticsRefresh").addEventListener("click", function () {
      document.getElementById("saAnalyticsPanel").dataset.loaded = "";
      loadAnalytics();
    });
    document.getElementById("saAnalyticsDays").addEventListener("change", function () {
      document.getElementById("saAnalyticsPanel").dataset.loaded = "";
      loadAnalytics();
    });

    if (window.MaAdminGuard && MaAdminGuard.require) {
      MaAdminGuard.require().then(function (session) {
        if (session) loadStock();
      });
    } else {
      loadStock();
    }
  });
})();
