/**
 * Muslim Abaya — Stock & Analytics পেজ
 */
(function () {
  "use strict";

  var LOW_STOCK_THRESHOLD_DEFAULT = 5;

  function toast(msg) {
    var el = document.getElementById("saToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-visible");
    setTimeout(function () { el.classList.remove("is-visible"); }, 3500);
  }

  function fmtMoney(n) {
    var num = Number(n) || 0;
    return "\u09F3" + num.toLocaleString("en-BD", { maximumFractionDigits: 2 });
  }

  function pctChange(curr, prev) {
    curr = Number(curr) || 0;
    prev = Number(prev) || 0;
    if (prev === 0) return curr > 0 ? "\u2014" : "0%";
    var pct = ((curr - prev) / prev) * 100;
    var sign = pct > 0 ? "+" : "";
    return sign + pct.toFixed(1) + "%";
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

  function downloadCsv(filename, rows) {
    var csv = rows.map(function (row) {
      return row.map(function (cell) {
        var s = String(cell == null ? "" : cell);
        if (s.indexOf(",") !== -1 || s.indexOf('"') !== -1 || s.indexOf("\n") !== -1) {
          s = '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(",");
    }).join("\r\n");
    var blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function parseCsv(text) {
    var lines = String(text || "").split(/\r?\n/).filter(function (l) { return l.trim() !== ""; });
    return lines.map(function (line) {
      return line.split(",").map(function (c) { return c.trim().replace(/^"|"$/g, ""); });
    });
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
  var lastStockItems = [];
  var lastStockMap = {};

  function renderStockTable() {
    var body = document.getElementById("saStockBody");
    var threshold = parseInt(document.getElementById("saLowStockThreshold").value, 10);
    if (isNaN(threshold) || threshold < 0) threshold = LOW_STOCK_THRESHOLD_DEFAULT;
    body.innerHTML = "";

    var products = allProducts();
    products.forEach(function (p) {
      var stockRow = lastStockMap[p.id];
      var qtyVal = stockRow ? stockRow.qty : null;
      var isLow = qtyVal !== null && qtyVal <= threshold;

      var tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #eee";
      if (isLow) tr.style.background = "#fff2f2";

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
      if (qtyVal !== null) {
        tdQty.textContent = qtyVal;
        if (isLow) {
          tdQty.style.color = "#c0392b";
          tdQty.style.fontWeight = "700";
          tdQty.textContent += " \u26a0\ufe0f";
        }
      } else {
        tdQty.textContent = "ট্র্যাক করা হয়নি";
        tdQty.style.color = "#999";
      }
      tr.appendChild(tdQty);

      var tdInput = document.createElement("td");
      tdInput.style.padding = "6px";
      var input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.style.width = "80px";
      input.style.padding = "4px 6px";
      input.placeholder = qtyVal !== null ? String(qtyVal) : "0";
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

    var statusEl = document.getElementById("saStockStatus");
    var lowCount = products.filter(function (p) {
      var s = lastStockMap[p.id];
      return s && s.qty <= threshold;
    }).length;
    statusEl.textContent = products.length + "টি প্রোডাক্ট, " + lastStockItems.length + "টি ট্র্যাক করা হচ্ছে" + (lowCount ? " — " + lowCount + "টি কম স্টকে" : "");
  }

  function loadStock() {
    var statusEl = document.getElementById("saStockStatus");
    statusEl.textContent = "লোড হচ্ছে...";

    MaAdmin.getStock().then(function (res) {
      lastStockItems = res.items || [];
      lastStockMap = {};
      lastStockItems.forEach(function (it) { lastStockMap[it.productId] = it; });
      renderStockTable();
    }).catch(function (err) {
      statusEl.textContent = "ব্যর্থ: " + (err && err.message);
    });
  }

  function handleCsvImport(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var rows = parseCsv(String(reader.result || ""));
      if (!rows.length) {
        toast("CSV ফাইলে কোনো ডেটা নেই");
        return;
      }
      // হেডার লাইন থাকলে বাদ দিন (প্রথম কলামে "ProductId" বা "Product ID" লেখা থাকলে)
      var firstCell = String(rows[0][0] || "").toLowerCase();
      if (firstCell.indexOf("product") !== -1 || firstCell.indexOf("id") !== -1) {
        rows = rows.slice(1);
      }
      var valid = rows.filter(function (r) { return r[0] && r.length >= 3 && !isNaN(parseInt(r[2], 10)); });
      if (!valid.length) {
        toast("সঠিক ফরম্যাট পাওয়া যায়নি — কলাম হওয়া উচিত: ProductId,ProductName,Qty");
        return;
      }
      toast(valid.length + "টি প্রোডাক্টের স্টক আপডেট হচ্ছে...");
      var chain = Promise.resolve();
      var done = 0;
      valid.forEach(function (r) {
        chain = chain.then(function () {
          return MaAdmin.setStock(r[0].trim(), (r[1] || "").trim(), parseInt(r[2], 10)).then(function () {
            done++;
          }).catch(function () {});
        });
      });
      chain.then(function () {
        toast("\u2705 " + done + "/" + valid.length + "টি প্রোডাক্ট আপডেট সম্পন্ন");
        loadStock();
      });
    };
    reader.readAsText(file);
  }

  // ===== Analytics tab =====
  function loadAnalytics() {
    var panel = document.getElementById("saAnalyticsPanel");
    var statusEl = document.getElementById("saAnalyticsStatus");
    var days = parseInt(document.getElementById("saAnalyticsDays").value, 10) || 30;
    statusEl.textContent = "লোড হচ্ছে...";

    MaAdmin.getAnalytics(days).then(function (res) {
      panel.dataset.loaded = "1";
      panel.dataset.lastResult = JSON.stringify(res);

      var prev = res.previousPeriod || {};
      var cards = document.getElementById("saSummaryCards");
      cards.innerHTML = "";
      var summary = [
        { label: "মোট অর্ডার", value: res.totalOrders, change: pctChange(res.totalOrders, prev.totalOrders) },
        { label: "মোট রেভিনিউ", value: fmtMoney(res.totalRevenue), change: pctChange(res.totalRevenue, prev.totalRevenue) },
        { label: "গড় অর্ডার ভ্যালু", value: fmtMoney(res.avgOrderValue), change: pctChange(res.avgOrderValue, prev.avgOrderValue) },
        { label: "কুরিয়ারে পাঠানো", value: res.courierOrders, change: null },
        { label: "নতুন কাস্টমার", value: res.newCustomers, change: null },
        { label: "ফিরে আসা কাস্টমার", value: res.returningCustomers, change: null }
      ];
      summary.forEach(function (s) {
        var card = document.createElement("div");
        card.style.cssText = "background:#fff;border:1px solid #e2e2e2;border-radius:10px;padding:14px 16px";
        var changeHtml = "";
        if (s.change) {
          var isUp = s.change.indexOf("+") === 0;
          var isDown = s.change.indexOf("-") === 0;
          var color = isUp ? "#1a8a3c" : (isDown ? "#c0392b" : "#888");
          changeHtml = "<div style='font-size:0.78rem;color:" + color + ";margin-top:4px'>আগের সময়ের তুলনায় " + s.change + "</div>";
        }
        card.innerHTML = "<div style='font-size:0.8rem;color:#888;margin-bottom:6px'>" + s.label + "</div><div style='font-size:1.3rem;font-weight:700'>" + s.value + "</div>" + changeHtml;
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

      var courierBody = document.getElementById("saCourierBody");
      if (courierBody) {
        courierBody.innerHTML = "";
        var breakdown = res.courierStatusBreakdown || {};
        Object.keys(breakdown).sort(function (a, b) { return breakdown[b] - breakdown[a]; }).forEach(function (statusName) {
          var tr = document.createElement("tr");
          tr.style.borderBottom = "1px solid #eee";
          tr.innerHTML = "<td style='padding:6px'>" + statusName + "</td><td style='padding:6px'>" + breakdown[statusName] + "</td>";
          courierBody.appendChild(tr);
        });
      }

      statusEl.textContent = "সর্বশেষ " + res.rangeDays + " দিনের তথ্য";
    }).catch(function (err) {
      statusEl.textContent = "ব্যর্থ: " + (err && err.message);
    });
  }

  function exportAnalyticsCsv() {
    var panel = document.getElementById("saAnalyticsPanel");
    var raw = panel.dataset.lastResult;
    if (!raw) {
      toast("আগে অ্যানালিটিক্স লোড করুন");
      return;
    }
    var res = JSON.parse(raw);
    var rows = [["তারিখ", "অর্ডার", "রেভিনিউ"]];
    (res.byDay || []).forEach(function (d) { rows.push([d.date, d.orders, d.revenue]); });
    rows.push([]);
    rows.push(["প্রোডাক্ট", "বিক্রি (পিস)", "রেভিনিউ"]);
    (res.topProducts || []).forEach(function (p) { rows.push([p.name, p.qty, p.revenue || ""]); });
    downloadCsv("analytics-" + res.rangeDays + "days.csv", rows);
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTabs();

    document.getElementById("saStockRefresh").addEventListener("click", loadStock);
    document.getElementById("saLowStockThreshold").addEventListener("input", renderStockTable);

    var csvInput = document.getElementById("saCsvImportInput");
    if (csvInput) {
      csvInput.addEventListener("change", function () {
        if (csvInput.files && csvInput.files[0]) handleCsvImport(csvInput.files[0]);
        csvInput.value = "";
      });
    }
    var csvExportStockBtn = document.getElementById("saCsvExportStock");
    if (csvExportStockBtn) {
      csvExportStockBtn.addEventListener("click", function () {
        var rows = [["ProductId", "ProductName", "Qty"]];
        allProducts().forEach(function (p) {
          var s = lastStockMap[p.id];
          rows.push([p.id, p.name, s ? s.qty : ""]);
        });
        downloadCsv("stock-export.csv", rows);
      });
    }

    document.getElementById("saAnalyticsRefresh").addEventListener("click", function () {
      document.getElementById("saAnalyticsPanel").dataset.loaded = "";
      loadAnalytics();
    });
    document.getElementById("saAnalyticsDays").addEventListener("change", function () {
      document.getElementById("saAnalyticsPanel").dataset.loaded = "";
      loadAnalytics();
    });
    var csvExportAnalyticsBtn = document.getElementById("saCsvExportAnalytics");
    if (csvExportAnalyticsBtn) {
      csvExportAnalyticsBtn.addEventListener("click", exportAnalyticsCsv);
    }

    // admin-guard.js আগেই পেজে একবার AdminVerify কল করে (data-admin-guard="1") এবং অবৈধ সেশন থাকলেই
    // রিডায়রেক্ট করে দেয়; এখানে আলাদা করে আবার AdminVerify কল করলে রেট-লিমিট বাড়ে এবং অহেতুক লগআউটের সম্ভাবনা বাড়ে।
    loadStock();
  });
})();
