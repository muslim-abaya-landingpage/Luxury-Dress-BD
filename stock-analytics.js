/**
 * Muslim Abaya — Stock (variant-level) & Analytics v2 পেজ
 */
(function () {
  "use strict";

  var DEFAULT_LOW_THRESHOLD = 5;

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

  function fmtPct(n) {
    return (Number(n) * 100 || 0).toFixed(1) + "%";
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
      var out = [];
      var cur = "";
      var inQ = false;
      for (var i = 0; i < line.length; i++) {
        var ch = line[i];
        if (ch === '"') { inQ = !inQ; continue; }
        if (ch === ',' && !inQ) { out.push(cur.trim()); cur = ""; continue; }
        cur += ch;
      }
      out.push(cur.trim());
      return out;
    });
  }

  // ===== ক্যাটাগরি ও প্রোডাক্ট (Product Manager-এর বিদ্যমান তালিকা থেকে — নতুন করে বানানো হয়নি) =====
  var categoryLabels = {};
  function initCategoryLabels() {
    var sections = window.CATALOG_SECTIONS || [];
    sections.forEach(function (s) {
      if (!s) return;
      var key = s.key || s.id || s.slug;
      var label = s.label || s.name || s.title || key;
      if (key) categoryLabels[key] = label;
    });
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
        out.push({ id: p.id, name: p.name || p.id, category: key, image: (p.images && p.images[0]) || p.image || "" });
      });
    });
    return out;
  }

  function buildCategoryMap() {
    var map = {};
    allProducts().forEach(function (p) { map[p.id] = p.category; });
    return map;
  }

  var productsById = {};
  var categoryMap = {};

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
      if (!isStock) loadAnalytics();
    }

    stockBtn.addEventListener("click", function () { activate("stock"); });
    analyticsBtn.addEventListener("click", function () { activate("analytics"); });
  }

  // ===== ক্যাটাগরি ফিল্টার ড্রপডাউন + চিপ =====
  var activeCategory = "";

  function populateCategoryFilter(items) {
    var select = document.getElementById("saCategoryFilter");
    var counts = {};
    items.forEach(function (it) {
      var c = it.category || "অজানা";
      counts[c] = (counts[c] || 0) + 1;
    });
    var keys = Object.keys(categoryLabels).length ? Object.keys(categoryLabels) : Object.keys(counts);
    var html = '<option value="">সব ক্যাটাগরি (' + items.length + ')</option>';
    keys.forEach(function (key) {
      var label = categoryLabels[key] || key;
      var n = counts[key] || 0;
      html += '<option value="' + key + '">' + label + ' (' + n + ')</option>';
    });
    select.innerHTML = html;
    select.value = activeCategory;

    var chipWrap = document.getElementById("saCategoryCounts");
    var chipsHtml = '<span class="sa-cat-chip' + (!activeCategory ? ' is-active' : '') + '" data-cat="">সব (' + items.length + ')</span>';
    keys.forEach(function (key) {
      var n = counts[key] || 0;
      if (!n) return;
      var label = categoryLabels[key] || key;
      chipsHtml += '<span class="sa-cat-chip' + (activeCategory === key ? ' is-active' : '') + '" data-cat="' + key + '">' + label + ' (' + n + ')</span>';
    });
    chipWrap.innerHTML = chipsHtml;
    Array.prototype.forEach.call(chipWrap.querySelectorAll(".sa-cat-chip"), function (chip) {
      chip.addEventListener("click", function () {
        activeCategory = chip.getAttribute("data-cat") || "";
        select.value = activeCategory;
        loadStock();
      });
    });
  }

  // ===== স্টক ট্যাব =====
  var lastVariantRows = []; // ব্যাকএন্ড থেকে যা এসেছে (শুধু StockVariants-এ থাকা সারি)

  function statusBadge(status) {
    var map = {
      OK: ['sa-badge-ok', 'ঠিক আছে'],
      LOW: ['sa-badge-low', 'কম স্টক'],
      OUT: ['sa-badge-out', 'স্টক শেষ'],
      UNTRACKED: ['sa-badge-untracked', 'ট্র্যাক করা হয়নি']
    };
    var m = map[status] || map.UNTRACKED;
    return '<span class="sa-badge ' + m[0] + '">' + m[1] + '</span>';
  }

  function buildProductGroups(variantRows, threshold) {
    // প্রতিটি প্রোডাক্টের নিচে তার ভ্যারিয়েন্টগুলো — যেসব প্রোডাক্টের কোনো StockVariants সারি নেই, তারা "ট্র্যাক করা হয়নি" হিসেবে দেখানো হবে
    var byProduct = {};
    variantRows.forEach(function (v) {
      if (!byProduct[v.productId]) byProduct[v.productId] = [];
      byProduct[v.productId].push(v);
    });
    var groups = [];
    var seenIds = {};
    allProducts().forEach(function (p) {
      seenIds[p.id] = true;
      var rows = byProduct[p.id];
      if (!rows || !rows.length) {
        groups.push({
          productId: p.id, productName: p.name, category: p.category, image: p.image,
          variants: [{ productId: p.id, productName: p.name, category: p.category, variant: "", tracked: false, available: 0, reserved: 0, threshold: null, status: "UNTRACKED", updatedAt: "", updatedBy: "" }]
        });
        return;
      }
      groups.push({ productId: p.id, productName: p.name, category: p.category, image: p.image, variants: rows });
    });
    // ক্যাটালগে নেই এমন প্রোডাক্ট আইডি (পুরনো/মুছে যাওয়া প্রোডাক্ট) — তাও দেখাও যাতে ডেটা হারিয়ে না যায়
    Object.keys(byProduct).forEach(function (pid) {
      if (seenIds[pid]) return;
      var rows = byProduct[pid];
      groups.push({ productId: pid, productName: rows[0].productName || pid, category: rows[0].category || "", image: "", variants: rows });
    });
    return groups;
  }

  function renderStockTable(variantRows) {
    var body = document.getElementById("saStockBody");
    var threshold = parseInt(document.getElementById("saLowStockThreshold").value, 10);
    if (isNaN(threshold) || threshold < 0) threshold = DEFAULT_LOW_THRESHOLD;
    var sortLowFirst = document.getElementById("saSortLowFirst").checked;

    var groups = buildProductGroups(variantRows, threshold);

    if (sortLowFirst) {
      groups.sort(function (a, b) {
        var aBad = a.variants.some(function (v) { return v.status === "OUT" || v.status === "LOW"; }) ? 0 : 1;
        var bBad = b.variants.some(function (v) { return v.status === "OUT" || v.status === "LOW"; }) ? 0 : 1;
        return aBad - bBad;
      });
    }

    if (!groups.length) {
      body.innerHTML = '<tr><td colspan="10" style="padding:20px;text-align:center;color:#888">কোনো প্রোডাক্ট পাওয়া যায়নি।</td></tr>';
      return;
    }

    var html = "";
    groups.forEach(function (g, gi) {
      var multi = g.variants.length > 1;
      var worst = g.variants.reduce(function (acc, v) {
        var rank = { OUT: 3, LOW: 2, UNTRACKED: 1, OK: 0 };
        return (rank[v.status] || 0) > (rank[acc] || 0) ? v.status : acc;
      }, "OK");
      var groupId = "saGrp" + gi;
      var catLabel = categoryLabels[g.category] || g.category || "অজানা";
      var imgHtml = g.image ? '<img src="' + g.image + '" style="width:36px;height:36px;object-fit:cover;border-radius:6px">' : '<div style="width:36px;height:36px;border-radius:6px;background:#eee"></div>';

      html += '<tr style="border-bottom:1px solid #eee' + (worst === 'OUT' ? ';background:#fff2f2' : worst === 'LOW' ? ';background:#fff9ee' : '') + '">' +
        '<td style="padding:6px">' + (multi ? '<button type="button" class="sa-expand-btn" data-target="' + groupId + '" style="border:none;background:none;cursor:pointer;font-size:1rem">▸</button>' : '') + '</td>' +
        '<td style="padding:6px">' + imgHtml + '</td>' +
        '<td style="padding:6px"><strong>' + g.productName + '</strong><br><span style="color:#888;font-size:0.8rem">' + catLabel + '</span></td>' +
        '<td style="padding:6px;font-family:monospace;font-size:0.85rem">' + g.productId + '</td>' +
        '<td style="padding:6px">' + (multi ? (g.variants.length + ' টি') : (g.variants[0].variant || '—')) + '</td>' +
        '<td style="padding:6px">' + (multi ? '—' : g.variants[0].available) + '</td>' +
        '<td style="padding:6px">' + (multi ? '—' : g.variants[0].reserved) + '</td>' +
        '<td style="padding:6px">' + statusBadge(worst) + '</td>' +
        '<td style="padding:6px;font-size:0.8rem;color:#888">' + (multi ? '—' : (g.variants[0].updatedAt || '—')) + '</td>' +
        '<td style="padding:6px">' + (multi ? '' : '<button type="button" class="pl-btn pl-btn-secondary sa-edit-btn" data-pid="' + g.productId + '" data-variant="" data-name="' + g.productName.replace(/"/g,'&quot;') + '" data-cat="' + (g.category||'') + '" style="padding:4px 10px;font-size:0.82rem">এডিট</button>') + '</td>' +
        '</tr>';

      if (multi) {
        html += '<tr id="' + groupId + '" class="sa-variant-row" style="display:none"><td></td><td colspan="9" style="padding:4px 6px 12px">' +
          '<table style="width:100%;border-collapse:collapse;font-size:0.85rem">' +
          g.variants.map(function (v) {
            return '<tr style="border-bottom:1px solid #eee">' +
              '<td style="padding:4px 8px;width:120px">' + (v.variant || '(কোনো ভ্যারিয়েন্ট নেই)') + '</td>' +
              '<td style="padding:4px 8px">Available: <strong>' + v.available + '</strong></td>' +
              '<td style="padding:4px 8px">Reserved: <strong>' + v.reserved + '</strong></td>' +
              '<td style="padding:4px 8px">' + statusBadge(v.status) + '</td>' +
              '<td style="padding:4px 8px;color:#888">' + (v.updatedAt || '—') + '</td>' +
              '<td style="padding:4px 8px"><button type="button" class="pl-btn pl-btn-secondary sa-edit-btn" data-pid="' + g.productId + '" data-variant="' + (v.variant||'').replace(/"/g,'&quot;') + '" data-name="' + g.productName.replace(/"/g,'&quot;') + '" data-cat="' + (g.category||'') + '" style="padding:3px 8px;font-size:0.78rem">এডিট</button></td>' +
              '</tr>';
          }).join("") +
          '</table></td></tr>';
      }
    });

    body.innerHTML = html;

    Array.prototype.forEach.call(body.querySelectorAll(".sa-expand-btn"), function (btn) {
      btn.addEventListener("click", function () {
        var target = document.getElementById(btn.getAttribute("data-target"));
        var isHidden = target.style.display === "none";
        target.style.display = isHidden ? "" : "none";
        btn.textContent = isHidden ? "▾" : "▸";
      });
    });
    Array.prototype.forEach.call(body.querySelectorAll(".sa-edit-btn"), function (btn) {
      btn.addEventListener("click", function () {
        openStockEditModal(btn.getAttribute("data-pid"), btn.getAttribute("data-variant"), btn.getAttribute("data-name"), btn.getAttribute("data-cat"));
      });
    });
  }

  function loadStock() {
    var statusEl = document.getElementById("saStockStatus");
    statusEl.textContent = "লোড হচ্ছে...";
    var search = document.getElementById("saSearchInput").value.trim();
    var stockStatus = document.getElementById("saStockStatusFilter").value;
    window.MaAdmin.getStockVariants({ search: search, stockStatus: stockStatus, category: activeCategory, categoryMap: categoryMap })
      .then(function (res) {
        lastVariantRows = res.items || [];
        // ক্যাটাগরি/সার্চ ফিল্টার প্রয়োগের পরেও পুরো প্রোডাক্ট তালিকার সাপেক্ষে গ্রুপ কাউন্ট দেখাতে allProducts ব্যবহার হয়
        var visibleProducts = allProducts().filter(function (p) {
          if (activeCategory && p.category !== activeCategory) return false;
          if (search) {
            var s = search.toLowerCase();
            if (p.name.toLowerCase().indexOf(s) === -1 && p.id.toLowerCase().indexOf(s) === -1) return false;
          }
          return true;
        });
        populateCategoryFilter(allProducts());
        renderStockTable(lastVariantRows.filter(function (v) {
          if (activeCategory && (categoryMap[v.productId] || v.category) !== activeCategory) return false;
          return true;
        }).concat(
          // untracked visible products না থাকলে buildProductGroups নিজেই allProducts থেকে untracked যোগ করে, তাই এখানে filteredVariantRows যথেষ্ট
          []
        ));
        statusEl.textContent = "সর্বশেষ আপডেট: " + new Date().toLocaleTimeString("bn-BD");
      })
      .catch(function (err) {
        statusEl.textContent = "";
        toast("স্টক লোড করা যায়নি: " + (err.message || err));
      });
  }

  // ===== ম্যানুয়াল স্টক এডিট মোডাল =====
  var editCtx = null;

  function openStockEditModal(productId, variant, productName, category) {
    editCtx = { productId: productId, variant: variant || "", productName: productName, category: category };
    document.getElementById("saStockEditTitle").textContent = "স্টক পরিবর্তন — " + productName + (variant ? " (" + variant + ")" : "");
    var existing = lastVariantRows.find(function (v) { return v.productId === productId && (v.variant || "") === (variant || ""); });
    document.getElementById("saStockEditQty").value = existing ? existing.available : 0;
    document.getElementById("saStockEditReasonPreset").value = "";
    document.getElementById("saStockEditReasonText").value = "";
    document.getElementById("saStockEditModal").hidden = false;
  }

  function closeStockEditModal() {
    document.getElementById("saStockEditModal").hidden = true;
    editCtx = null;
  }

  function initStockEditModal() {
    document.getElementById("saStockEditCancel").addEventListener("click", closeStockEditModal);
    document.getElementById("saStockEditSave").addEventListener("click", function () {
      if (!editCtx) return;
      var qty = parseInt(document.getElementById("saStockEditQty").value, 10);
      if (isNaN(qty) || qty < 0) { toast("সঠিক Qty দিন।"); return; }
      var preset = document.getElementById("saStockEditReasonPreset").value;
      var detail = document.getElementById("saStockEditReasonText").value.trim();
      var reason = [preset, detail].filter(Boolean).join(" — ");
      if (!reason) { toast("স্টক পরিবর্তনের কারণ লেখা বাধ্যতামূলক।"); return; }
      window.MaAdmin.saveStockVariant({
        productId: editCtx.productId, productName: editCtx.productName, category: editCtx.category,
        variant: editCtx.variant, available: qty, reason: reason, tracked: true
      }).then(function () {
        toast("স্টক আপডেট হয়েছে।");
        closeStockEditModal();
        loadStock();
      }).catch(function (err) {
        toast("সংরক্ষণ ব্যর্থ: " + (err.message || err));
      });
    });
  }

  // ===== CSV এক্সপোর্ট/ইমপোর্ট (প্রিভিউ-সহ) =====
  function initCsvExport() {
    document.getElementById("saCsvExportStock").addEventListener("click", function () {
      var rows = [["ProductId", "ProductName", "Category", "Variant", "Tracked", "Available", "Reserved", "Threshold", "UpdatedAt", "UpdatedBy"]];
      lastVariantRows.forEach(function (v) {
        rows.push([v.productId, v.productName, v.category, v.variant, v.tracked ? "TRUE" : "FALSE", v.available, v.reserved, v.threshold == null ? "" : v.threshold, v.updatedAt, v.updatedBy]);
      });
      downloadCsv("stock-export-" + new Date().toISOString().slice(0, 10) + ".csv", rows);
    });
  }

  var pendingCsvRows = [];

  function initCsvImport() {
    document.getElementById("saCsvImportInput").addEventListener("change", function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var lines = parseCsv(String(reader.result || ""));
        if (!lines.length) { toast("CSV খালি।"); return; }
        var header = lines[0].map(function (h) { return h.toLowerCase(); });
        var startIdx = (header.indexOf("productid") !== -1 || header.indexOf("product id") !== -1) ? 1 : 0;
        var rows = [];
        for (var i = startIdx; i < lines.length; i++) {
          var cols = lines[i];
          if (!cols.length || !cols[0]) continue;
          rows.push({ productId: cols[0], variant: cols[1] || "", qty: cols[2], reason: cols[3] || "CSV আপলোড" });
        }
        pendingCsvRows = rows;
        window.MaAdmin.commitStockCsv(rows, true).then(function (res) {
          renderCsvPreview(res);
        }).catch(function (err) {
          toast("CSV প্রিভিউ ব্যর্থ: " + (err.message || err));
        });
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  }

  function renderCsvPreview(res) {
    var body = document.getElementById("saCsvPreviewBody");
    var results = res.results || [];
    body.innerHTML = results.map(function (r) {
      return '<tr style="border-bottom:1px solid #eee' + (r.ok ? '' : ';background:#fff2f2') + '">' +
        '<td style="padding:4px">' + (r.rowIndex + 1) + '</td>' +
        '<td style="padding:4px">' + r.productId + '</td>' +
        '<td style="padding:4px">' + (r.variant || '—') + '</td>' +
        '<td style="padding:4px">' + r.qty + '</td>' +
        '<td style="padding:4px">' + r.reason + '</td>' +
        '<td style="padding:4px">' + (r.ok ? '✅ ঠিক আছে' : '⚠️ ' + r.issues.join(', ')) + '</td>' +
        '</tr>';
    }).join("");
    document.getElementById("saCsvPreviewSummary").textContent =
      res.validCount + " / " + res.totalCount + " সারি সঠিক — শুধু সঠিক সারিগুলো প্রয়োগ হবে।";
    document.getElementById("saCsvPreviewModal").hidden = false;
  }

  function initCsvPreviewModal() {
    document.getElementById("saCsvPreviewCancel").addEventListener("click", function () {
      document.getElementById("saCsvPreviewModal").hidden = true;
      pendingCsvRows = [];
    });
    document.getElementById("saCsvPreviewConfirm").addEventListener("click", function () {
      if (!pendingCsvRows.length) { document.getElementById("saCsvPreviewModal").hidden = true; return; }
      window.MaAdmin.commitStockCsv(pendingCsvRows, false).then(function (res) {
        toast(res.applied + " টি সারি প্রয়োগ হয়েছে, " + res.skipped + " টি বাদ পড়েছে।");
        document.getElementById("saCsvPreviewModal").hidden = true;
        pendingCsvRows = [];
        loadStock();
      }).catch(function (err) {
        toast("CSV প্রয়োগ ব্যর্থ: " + (err.message || err));
      });
    });
  }

  function initMigrateBtn() {
    document.getElementById("saMigrateBtn").addEventListener("click", function () {
      if (!confirm("পুরনো Stock শীট থেকে StockVariants-এ মাইগ্রেট করবেন? এটি কোনো ডেটা মুছবে না।")) return;
      window.MaAdmin.migrateStockVariants().then(function (res) {
        toast("মাইগ্রেশন সম্পন্ন — " + res.migrated + " টি নতুন, " + res.skipped + " টি আগে থেকেই ছিল।");
        loadStock();
      }).catch(function (err) {
        toast("মাইগ্রেশন ব্যর্থ: " + (err.message || err));
      });
    });
  }

  // ===== Analytics ট্যাব v2 =====
  function initAnalyticsControls() {
    var rangeSel = document.getElementById("saRangeSelect");
    var fromEl = document.getElementById("saRangeFrom");
    var toEl = document.getElementById("saRangeTo");
    rangeSel.addEventListener("change", function () {
      var isCustom = rangeSel.value === "custom";
      fromEl.hidden = !isCustom;
      toEl.hidden = !isCustom;
    });
    document.getElementById("saAnalyticsRefresh").addEventListener("click", loadAnalytics);
  }

  function renderSummaryCards(s) {
    var cards = [
      { label: "মোট অর্ডার", value: s.totalOrders },
      { label: "কনফার্ম", value: s.confirmedCount },
      { label: "ডেলিভারি সম্পন্ন", value: s.deliveredCount },
      { label: "বাতিল", value: s.cancelledCount },
      { label: "রিটার্ন", value: s.returnedCount },
      { label: "মোট অর্ডার মূল্য", value: fmtMoney(s.totalOrderValue) },
      { label: "ডেলিভারি সম্পন্ন বিক্রয় মূল্য", value: fmtMoney(s.deliveredSalesValue) },
      { label: "বাতিলের হার", value: fmtPct(s.cancellationRate) },
      { label: "ডেলিভারি সফলতার হার", value: fmtPct(s.deliverySuccessRate) }
    ];
    document.getElementById("saSummaryCards").innerHTML = cards.map(function (c) {
      return '<div style="background:#fff;border:1px solid #eee;border-radius:10px;padding:14px"><div style="font-size:0.78rem;color:#888;margin-bottom:6px">' + c.label + '</div><div style="font-size:1.3rem;font-weight:700">' + c.value + '</div></div>';
    }).join("");
  }

  function loadAnalytics() {
    var statusEl = document.getElementById("saAnalyticsStatus");
    statusEl.textContent = "লোড হচ্ছে...";
    var range = document.getElementById("saRangeSelect").value;
    var from = document.getElementById("saRangeFrom").value;
    var to = document.getElementById("saRangeTo").value;
    window.MaAdmin.getAnalyticsV2({ range: range, from: from, to: to, categoryMap: categoryMap })
      .then(function (res) {
        renderSummaryCards(res.summary || {});

        document.getElementById("saTopProductsBody").innerHTML = (res.topProducts || []).map(function (p) {
          return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px">' + p.name + '</td><td style="padding:6px">' + p.qty + '</td></tr>';
        }).join("") || '<tr><td colspan="2" style="padding:10px;color:#888">এই সময়সীমায় কোনো বিক্রি নেই।</td></tr>';

        document.getElementById("saTopCategoriesBody").innerHTML = (res.topCategories || []).map(function (c) {
          return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px">' + (categoryLabels[c.category] || c.category) + '</td><td style="padding:6px">' + c.qty + '</td></tr>';
        }).join("") || '<tr><td colspan="2" style="padding:10px;color:#888">তথ্য নেই।</td></tr>';

        document.getElementById("saTopSizesBody").innerHTML = (res.topSizes || []).map(function (sz) {
          return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px">' + sz.size + '</td><td style="padding:6px">' + sz.qty + '</td></tr>';
        }).join("") || '<tr><td colspan="2" style="padding:10px;color:#888">সাইজ-ভিত্তিক তথ্য নেই।</td></tr>';

        document.getElementById("saLowStockBody").innerHTML = (res.lowStockList || []).map(function (l) {
          return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px">' + l.productName + '</td><td style="padding:6px">' + (l.variant || '—') + '</td><td style="padding:6px">' + l.available + '</td></tr>';
        }).join("") || '<tr><td colspan="3" style="padding:10px;color:#888">কম স্টক নেই।</td></tr>';

        document.getElementById("saOutStockBody").innerHTML = (res.outOfStockList || []).map(function (o) {
          return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px">' + o.productName + '</td><td style="padding:6px">' + (o.variant || '—') + '</td></tr>';
        }).join("") || '<tr><td colspan="2" style="padding:10px;color:#888">স্টক শেষ কিছু নেই।</td></tr>';

        var sourceMsgEl = document.getElementById("saSourceMessage");
        if (!res.sourceDataAvailable) {
          sourceMsgEl.textContent = res.sourceMessage || "উৎসের তথ্য নেই।";
          document.getElementById("saSourceBody").innerHTML = "";
        } else {
          sourceMsgEl.textContent = "";
          document.getElementById("saSourceBody").innerHTML = (res.sourceBreakdown || []).map(function (s) {
            return '<tr style="border-bottom:1px solid #eee"><td style="padding:6px">' + s.source + '</td><td style="padding:6px">' + s.orders + '</td><td style="padding:6px">' + s.delivered + '</td></tr>';
          }).join("");
        }

        statusEl.textContent = "সর্বশেষ আপডেট: " + new Date().toLocaleTimeString("bn-BD") + " (" + res.from + " – " + res.to + ")";
      })
      .catch(function (err) {
        statusEl.textContent = "";
        toast("অ্যানালিটিক্স লোড করা যায়নি: " + (err.message || err));
      });
  }

  // ===== Init =====
  function init() {
    if (!window.MaAdmin || !window.MaAdmin.isLoggedIn()) return; // admin-guard.js redirect করবে
    initCategoryLabels();
    categoryMap = buildCategoryMap();

    initTabs();
    initStockEditModal();
    initCsvExport();
    initCsvImport();
    initCsvPreviewModal();
    initMigrateBtn();
    initAnalyticsControls();

    document.getElementById("saStockRefresh").addEventListener("click", loadStock);
    document.getElementById("saCategoryFilter").addEventListener("change", function () {
      activeCategory = this.value;
      loadStock();
    });
    document.getElementById("saStockStatusFilter").addEventListener("change", loadStock);
    document.getElementById("saSortLowFirst").addEventListener("change", loadStock);
    var searchDebounce = null;
    document.getElementById("saSearchInput").addEventListener("input", function () {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(loadStock, 350);
    });

    loadStock();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
