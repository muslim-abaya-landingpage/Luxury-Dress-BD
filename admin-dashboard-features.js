(function () {
  "use strict";

  var ALERT_POLL_MS = 5 * 60 * 1000;
  var TASK_LIMIT = 1000;
  var state = {
    alertBusy: false,
    taskBusy: false,
    stockBaseline: false,
    inboxBaseline: false,
    stockSignature: [],
    inboxUnread: {},
    desktopEnabled: false,
    analyticsBusy: false,
    lastTaskRefresh: 0
  };

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function money(value) {
    var amount = Number(value) || 0;
    return "৳" + amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }
  function percent(value) { return ((Number(value) || 0) * 100).toFixed(1) + "%"; }
  function safeText(value, fallback) { return String(value == null || value === "" ? (fallback || "—") : value); }
  function errorText(error) {
    var message = String(error && (error.code || error.message) || "").toUpperCase();
    if (/INVALID_TOKEN|EXPIRED|NOT_ADMIN|NO_TOKEN|NOT_LOGGED_IN/.test(message)) return "অ্যাডমিন সেশন শেষ হয়েছে—আবার লগ ইন করুন।";
    if (message.indexOf("API_MISSING") !== -1) return "অ্যাডমিন API কনফিগার করা নেই।";
    if (message.indexOf("INVALID_DATE_RANGE") !== -1) return "তারিখের সীমা সঠিক নয়।";
    return "সার্ভার থেকে ডেটা পাওয়া যায়নি। সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।";
  }
  function setStatus(id, text, isError) {
    var node = byId(id);
    if (!node) return;
    node.textContent = text;
    node.classList.toggle("is-error", !!isError);
  }
  function dateTimeDhaka() {
    return new Intl.DateTimeFormat("bn-BD", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date());
  }
  function storedDesktopOptIn() {
    try { return localStorage.getItem("ma_admin_desktop_alerts") === "1"; } catch (e) { return false; }
  }
  function setDesktopOptIn(value) {
    state.desktopEnabled = !!value;
    try { localStorage.setItem("ma_admin_desktop_alerts", state.desktopEnabled ? "1" : "0"); } catch (e) {}
    updateDesktopButton();
  }
  function updateDesktopButton() {
    var button = byId("admDesktopAlerts");
    if (!button) return;
    if (!("Notification" in window)) {
      button.hidden = true;
      setStatus("admDesktopStatus", "এই ব্রাউজারে ডেস্কটপ নোটিফিকেশন সমর্থিত নয়।", false);
      return;
    }
    button.hidden = false;
    var granted = Notification.permission === "granted";
    var enabled = granted && state.desktopEnabled;
    button.textContent = enabled ? "ডেস্কটপ অ্যালার্ট বন্ধ করুন" : "ডেস্কটপ অ্যালার্ট চালু করুন";
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
    if (Notification.permission === "denied") setStatus("admDesktopStatus", "ব্রাউজার সেটিংসে নোটিফিকেশন ব্লক করা আছে।", true);
    else if (enabled) setStatus("admDesktopStatus", "অ্যালার্ট শুধু এই ড্যাশবোর্ড খোলা থাকলে দেখাবে।", false);
    else setStatus("admDesktopStatus", "অনুমতি দিলে নতুন অ্যালার্ট ডেস্কটপে দেখানো হবে।", false);
  }
  function requestDesktopPermission() {
    if (!("Notification" in window)) return;
    if (state.desktopEnabled && Notification.permission === "granted") {
      setDesktopOptIn(false);
      return;
    }
    Notification.requestPermission().then(function (permission) {
      if (permission === "granted") setDesktopOptIn(true);
      else {
        setDesktopOptIn(false);
        setStatus("admDesktopStatus", permission === "denied" ? "ব্রাউজার সেটিংসে নোটিফিকেশন ব্লক করা আছে।" : "নোটিফিকেশন অনুমতি দেওয়া হয়নি।", true);
      }
    }).catch(function () { setStatus("admDesktopStatus", "নোটিফিকেশন অনুমতি নেওয়া যায়নি।", true); });
  }
  function desktopNotify(title, body, tag) {
    if (!state.desktopEnabled || !("Notification" in window) || Notification.permission !== "granted") return;
    try { new Notification(title, { body: body, tag: tag, icon: "favicon.ico", renotify: false }); } catch (e) {}
  }
  function stockKey(item) { return [item.productId || "", item.variant || "", item.status || ""].join("|"); }
  function inboxKey(contact) { return [contact.pageId || "", contact.psid || ""].join("|"); }

  function renderStockAlerts(items, defaultThreshold) {
    var node = byId("admStockAlerts");
    if (!node) return;
    var tracked = Array.isArray(items) ? items.filter(function (item) { return item && item.tracked && (item.status === "LOW" || item.status === "OUT"); }) : [];
    var out = tracked.filter(function (item) { return item.status === "OUT"; });
    var low = tracked.filter(function (item) { return item.status === "LOW"; });
    byId("admStockAlertCount").textContent = tracked.length.toLocaleString("en-US");
    byId("admStockAlertCount").classList.toggle("is-danger", out.length > 0);
    if (!tracked.length) {
      node.innerHTML = '<div class="adm-feature-empty">স্টক threshold-এর নিচে নেই। (ডিফল্ট threshold ' + escapeHtml(defaultThreshold || 5) + ')</div>';
      return tracked;
    }
    node.innerHTML = tracked.slice(0, 6).map(function (item) {
      var isOut = item.status === "OUT";
      return '<a class="adm-alert-item ' + (isOut ? "is-danger" : "is-warning") + '" href="stock-analytics.html">' +
        '<span class="adm-alert-mark" aria-hidden="true">' + (isOut ? "!" : "↓") + '</span>' +
        '<span class="adm-alert-copy"><b>' + escapeHtml(item.productName || item.productId || "প্রোডাক্ট") + (item.variant ? " · " + escapeHtml(item.variant) : "") + '</b>' +
        '<small>' + (isOut ? "স্টক শেষ" : "কম স্টক") + " · আছে " + escapeHtml(item.available) + " · threshold " + escapeHtml(item.threshold == null ? defaultThreshold || 5 : item.threshold) + '</small></span></a>';
    }).join("") + (tracked.length > 6 ? '<a class="adm-feature-more" href="stock-analytics.html">আরও ' + (tracked.length - 6) + 'টি দেখুন →</a>' : "");
    return tracked;
  }

  function renderInboxAlerts(result) {
    var node = byId("admInboxAlerts");
    if (!node) return [];
    var contacts = Array.isArray(result && result.contacts) ? result.contacts : [];
    var unread = contacts.filter(function (contact) { return Number(contact && contact.unread) > 0; });
    var count = Number(result && result.stats && result.stats.unread);
    if (!Number.isFinite(count)) count = unread.length;
    byId("admInboxAlertCount").textContent = count.toLocaleString("en-US");
    byId("admInboxAlertCount").classList.toggle("is-danger", count > 0);
    if (!count) {
      node.innerHTML = '<div class="adm-feature-empty">এখন কোনো অপঠিত conversation নেই।</div>';
      return unread;
    }
    if (!unread.length) {
      node.innerHTML = '<a class="adm-alert-item is-warning" href="admin-inbox.html"><span class="adm-alert-mark" aria-hidden="true">✉</span><span class="adm-alert-copy"><b>' + count + 'টি অপঠিত conversation</b><small>সরাসরি ইনবক্সে দেখুন</small></span></a>';
      return unread;
    }
    node.innerHTML = unread.slice(0, 5).map(function (contact) {
      return '<a class="adm-alert-item is-warning" href="admin-inbox.html"><span class="adm-alert-mark" aria-hidden="true">✉</span><span class="adm-alert-copy"><b>' + escapeHtml(contact.name || "Messenger গ্রাহক") + '</b><small>' + Number(contact.unread || 0) + 'টি অপঠিত · ' + escapeHtml(contact.lastMessage || "নতুন বার্তা") + '</small></span></a>';
    }).join("") + '<a class="adm-feature-more" href="admin-inbox.html">সব অপঠিত দেখুন →</a>';
    return unread;
  }

  function refreshAlerts() {
    if (state.alertBusy || document.hidden || !window.MaAdmin || !MaAdmin.getSession || !MaAdmin.getSession()) return Promise.resolve();
    state.alertBusy = true;
    setStatus("admAlertState", "অ্যালার্ট আপডেট হচ্ছে…", false);
    var stockPromise = MaAdmin.getStockVariants({ stockStatus: "all" }).then(function (res) { return { ok: true, data: res }; }, function (error) { return { ok: false, error: error }; });
    var inboxPromise = MaAdmin.inboxCall("InboxList", { Unread: "1", Limit: 300 }, { edgeSummary: true }).then(function (res) { return { ok: true, data: res }; }, function (error) { return { ok: false, error: error }; });
    // Each card renders as soon as its own data arrives (the inbox is slower and must not hold up stock).
    var currentStock = [], currentInbox = [];
    stockPromise = stockPromise.then(function (stockResult) {
      var stockNode = byId("admStockAlerts");
      if (stockResult.ok) currentStock = renderStockAlerts(stockResult.data.items, stockResult.data.defaultThreshold) || [];
      else if (stockNode) stockNode.innerHTML = '<div class="adm-feature-error" role="alert">' + escapeHtml(errorText(stockResult.error)) + '</div>';
      return stockResult;
    });
    inboxPromise = inboxPromise.then(function (inboxResult) {
      var inboxNode = byId("admInboxAlerts");
      if (inboxResult.ok) currentInbox = renderInboxAlerts(inboxResult.data) || [];
      else if (inboxNode) inboxNode.innerHTML = '<div class="adm-feature-error" role="alert">' + escapeHtml(errorText(inboxResult.error)) + '</div>';
      return inboxResult;
    });
    return Promise.all([stockPromise, inboxPromise]).then(function (results) {
      var stockResult = results[0], inboxResult = results[1];

      var stockSignature = currentStock.map(stockKey).sort();
      var inboxMap = {};
      currentInbox.forEach(function (contact) { inboxMap[inboxKey(contact)] = Number(contact.unread) || 0; });
      if (stockResult.ok) {
        var oldStock = Object.create(null);
        state.stockSignature.forEach(function (key) { oldStock[key] = true; });
        var newStock = stockSignature.filter(function (key) { return !oldStock[key]; });
        if (state.stockBaseline && newStock.length) desktopNotify("স্টক অ্যালার্ট", newStock.length + "টি নতুন পণ্য কম/শেষ স্টকে", "ma-low-stock");
        state.stockSignature = stockSignature;
        state.stockBaseline = true;
      }
      if (inboxResult.ok) {
        var newConversations = Object.keys(inboxMap).filter(function (key) { return !state.inboxUnread[key] || inboxMap[key] > state.inboxUnread[key]; });
        if (state.inboxBaseline && newConversations.length) desktopNotify("Messenger-এ নতুন বার্তা", newConversations.length + "টি conversation-এ অপঠিত বার্তা আছে", "ma-inbox-unread");
        state.inboxUnread = inboxMap;
        state.inboxBaseline = true;
      }
      var failed = (!stockResult.ok ? 1 : 0) + (!inboxResult.ok ? 1 : 0);
      setStatus("admAlertState", (failed ? failed + "টি উৎস আপডেট হয়নি · " : "সর্বশেষ আপডেট ") + dateTimeDhaka() + " (বাংলাদেশ সময়)", failed > 0);
    }).finally(function () { state.alertBusy = false; });
  }

  function ageLabel(task) {
    if (task.dateUnknown) return "সময় যাচাই দরকার";
    return AdminDashboardLogic.formatAge(task.ageMs);
  }
  function renderTasks(result) {
    var node = byId("admPriorityTasks");
    if (!node) return;
    var orders = Array.isArray(result && result.orders) ? result.orders : [];
    var allTasks = AdminDashboardLogic.buildPriorityTasks(orders, Date.now());
    // Orders older than 90 days are kept on purpose (owner's decision) and would otherwise bury today's work.
    var OLD_MS = 90 * 24 * 3600 * 1000;
    var tasks = allTasks.filter(function (task) { return task.dateUnknown || task.ageMs == null || task.ageMs <= OLD_MS; });
    var oldCount = allTasks.length - tasks.length;
    var oldNote = oldCount ? '<a class="adm-feature-more adm-old-note" href="admin-orders.html">৯০ দিনের বেশি পুরোনো ' + oldCount.toLocaleString("en-US") + 'টি অর্ডার এই তালিকায় দেখানো হচ্ছে না — অর্ডার প্যানেলে দেখুন →</a>' : "";
    var overdue = tasks.filter(function (task) { return task.overdue; }).length;
    var pending = tasks.filter(function (task) { return task.status === "pending"; }).length;
    byId("admTaskPendingCount").textContent = pending.toLocaleString("en-US");
    byId("admTaskOverdueCount").textContent = overdue.toLocaleString("en-US");
    byId("admTaskScope").textContent = "সাম্প্রতিক " + orders.length.toLocaleString("en-US") + " / " + Number(result && result.counts && result.counts.all || orders.length).toLocaleString("en-US") + " অর্ডার যাচাই করা হয়েছে";
    if (!tasks.length) {
      node.innerHTML = '<div class="adm-feature-empty">এই মুহূর্তে কোনো জরুরি কাজ নেই ✓</div>' + oldNote;
      return;
    }
    node.innerHTML = tasks.slice(0, 10).map(function (task) {
      var order = task.order;
      var className = task.overdue ? "is-overdue" : (task.dateUnknown ? "is-unknown" : "is-open");
      var stateText = task.overdue ? AdminDashboardLogic.formatOverdue(task.overdueMs) : (task.dateUnknown ? "তারিখ যাচাই দরকার" : (task.status === "pending" ? "Pending · " + ageLabel(task) : ""));
      var taskHref = task.orderId ? "admin-order.html?id=" + encodeURIComponent(task.orderId) : "admin-orders.html";
      return '<div class="adm-task-row ' + className + '"><span class="adm-task-priority" aria-hidden="true"></span>' +
        '<div class="adm-task-main"><b>' + escapeHtml(order.name || "গ্রাহক") + ' · #' + escapeHtml(task.orderId || "—") + '</b>' +
        '<span>' + escapeHtml(task.statusLabel) + ' · ' + escapeHtml(order.time || "তারিখ নেই") + ' · ' + escapeHtml(stateText || ageLabel(task)) + '</span></div>' +
        '<div class="adm-task-value">' + money(order.total) + '</div>' +
        '<a class="adm-task-open" href="' + escapeHtml(taskHref) + '" aria-label="অর্ডার ' + escapeHtml(task.orderId || "বিস্তারিত") + ' খুলুন">দেখুন →</a></div>';
    }).join("") + (tasks.length > 10 ? '<a class="adm-feature-more" href="admin-orders.html">আরও ' + (tasks.length - 10) + 'টি কাজ অর্ডার প্যানেলে দেখুন →</a>' : "") + oldNote;
  }
  function refreshTasks(force) {
    if (state.taskBusy || document.hidden || !window.MaAdmin || !MaAdmin.getSession || !MaAdmin.getSession()) return Promise.resolve();
    if (!force && Date.now() - state.lastTaskRefresh < ALERT_POLL_MS) return Promise.resolve();
    state.taskBusy = true;
    setStatus("admTaskState", "অর্ডার যাচাই হচ্ছে…", false);
    return MaAdmin.call("AdminOrderList", { Limit: TASK_LIMIT }).then(function (result) {
      renderTasks(result);
      state.lastTaskRefresh = Date.now();
      setStatus("admTaskState", "সর্বশেষ যাচাই " + dateTimeDhaka() + " · Pending ≥ ১ ঘণ্টা, Confirmed ≥ ২৪ ঘণ্টা, Shipped ≥ ৪৮ ঘণ্টা overdue", false);
    }).catch(function (error) {
      setStatus("admTaskState", errorText(error), true);
      byId("admPriorityTasks").innerHTML = '<div class="adm-feature-error" role="alert">' + escapeHtml(errorText(error)) + ' <button type="button" id="admRetryTasks">আবার চেষ্টা করুন</button></div>';
      byId("admRetryTasks").addEventListener("click", function () { refreshTasks(true); });
    }).finally(function () { state.taskBusy = false; });
  }

  function rangeLabel(data) {
    if (data.range === "all") return "সমস্ত সময়" + (data.from ? " · " + data.from + " – " + data.to : "");
    return data.from === data.to ? data.from : data.from + " – " + data.to;
  }
  function renderMonths(rows) {
    var node = byId("admSalesMonths");
    rows = Array.isArray(rows) ? rows.slice(-12) : [];
    if (!rows.length) { node.innerHTML = '<div class="adm-feature-empty">এই সময়সীমায় মাসিক বিক্রয় ডেটা নেই।</div>'; return; }
    var max = Math.max.apply(null, rows.map(function (row) { return Number(row.revenue) || 0; }).concat([1]));
    node.innerHTML = rows.slice().reverse().map(function (row) {
      var value = Number(row.revenue) || 0;
      var width = Math.max(value > 0 ? 2 : 0, Math.round(value / max * 100));
      return '<div class="adm-month-row"><span class="adm-month-label">' + escapeHtml(row.month || "—") + '</span><span class="adm-month-bar"><i style="width:' + width + '%"></i></span><b>' + money(value) + '</b><small>' + Number(row.orders || 0) + ' অর্ডার</small></div>';
    }).join("");
  }
  function renderRanked(nodeId, rows, primary, secondary) {
    var node = byId(nodeId);
    rows = Array.isArray(rows) ? rows.slice(0, 8) : [];
    if (!rows.length) { node.innerHTML = '<div class="adm-feature-empty">এই সময়সীমায় তথ্য নেই।</div>'; return; }
    node.innerHTML = rows.map(function (row) {
      return '<div class="adm-report-row"><span>' + escapeHtml(row[primary] || "—") + '</span><b>' + escapeHtml(row[secondary] || 0) + '</b></div>';
    }).join("");
  }
  function renderAnalytics(data) {
    if (!data || data.range !== byId("admReportRange").value || !Array.isArray(data.salesByMonth) || typeof data.undatedOrderCount !== "number") {
      throw new Error("RANGE_NOT_SUPPORTED");
    }
    var summary = data.summary || {};
    byId("admReportRangeLabel").textContent = rangeLabel(data);
    byId("admReportOrders").textContent = Number(summary.totalOrders || 0).toLocaleString("en-US");
    byId("admReportOrderValue").textContent = money(summary.totalOrderValue);
    byId("admReportDeliveredValue").textContent = money(summary.deliveredSalesValue);
    byId("admReportDelivered").textContent = Number(summary.deliveredCount || 0).toLocaleString("en-US");
    byId("admReportCancelRate").textContent = percent(summary.cancellationRate);
    byId("admReportDeliveryRate").textContent = percent(summary.deliverySuccessRate);
    byId("admUndatedNote").hidden = !(Number(data.undatedOrderCount) > 0);
    if (Number(data.undatedOrderCount) > 0) byId("admUndatedNote").textContent = Number(data.undatedOrderCount) + "টি তারিখহীন অর্ডার মোট lifetime সংখ্যা/মূল্যে অন্তর্ভুক্ত; মাসিক চার্টে নেই।";
    renderMonths(data.salesByMonth);
    renderRanked("admReportProducts", data.topProducts, "name", "qty");
    renderRanked("admReportSources", data.sourceBreakdown, "source", "orders");
    var note = data.sourceMessage || "";
    if (data.range === "all") note = "পূর্ণ সময়ের অর্ডার হিসাব" + (note ? " · " + note : "");
    setStatus("admReportState", note || ("রিপোর্ট আপডেট " + dateTimeDhaka() + " (বাংলাদেশ সময়)"), false);
    byId("admReportBody").hidden = false;
    byId("admReportError").hidden = true;
    window.__maDashboardSalesReport = data;
    byId("admReportExport").disabled = false;
  }
  function loadAnalytics() {
    if (state.analyticsBusy || !window.MaAdmin || !MaAdmin.getSession || !MaAdmin.getSession()) return Promise.resolve();
    var range = byId("admReportRange").value;
    var from = byId("admReportFrom").value;
    var to = byId("admReportTo").value;
    if (range === "custom") {
      if (!from || !to || from > to) {
        setStatus("admReportState", "Custom রিপোর্টের জন্য সঠিক From ও To তারিখ দিন।", true);
        return Promise.resolve();
      }
    }
    state.analyticsBusy = true;
    window.__maDashboardSalesReport = null;
    byId("admReportExport").disabled = true;
    byId("admReportBody").hidden = true;
    byId("admReportLoad").disabled = true;
    byId("admReportLoad").textContent = "লোড হচ্ছে…";
    setStatus("admReportState", "সার্ভার থেকে রিপোর্ট তৈরি হচ্ছে…", false);
    byId("admReportError").hidden = true;
    return MaAdmin.getAnalyticsV2({ range: range, from: from, to: to }).then(function (data) {
      renderAnalytics(data);
    }).catch(function (error) {
      var message = String(error && error.message || "");
      if (message === "RANGE_NOT_SUPPORTED") message = "এই Apps Script deployment-এ পূর্ণসময়ের রিপোর্ট সমর্থিত নয়। Backend source sync করে নতুন Apps Script version deploy করতে হবে।";
      else message = errorText(error);
      byId("admReportError").textContent = message;
      byId("admReportError").hidden = false;
      byId("admReportBody").hidden = true;
      setStatus("admReportState", "রিপোর্ট লোড হয়নি।", true);
    }).finally(function () {
      state.analyticsBusy = false;
      byId("admReportLoad").disabled = false;
      byId("admReportLoad").textContent = "রিপোর্ট দেখুন";
    });
  }
  function csvCell(value) {
    var text = String(value == null ? "" : value);
    if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function exportCsv() {
    var data = window.__maDashboardSalesReport;
    if (!data) return;
    var summary = data.summary || {};
    var lines = [
      ["সময়সীমা", rangeLabel(data)].map(csvCell).join(","),
      ["মোট অর্ডার", summary.totalOrders || 0].map(csvCell).join(","),
      ["মোট অর্ডার মূল্য (৳)", summary.totalOrderValue || 0].map(csvCell).join(","),
      ["Delivered অর্ডার মূল্য (৳)", summary.deliveredSalesValue || 0].map(csvCell).join(","),
      ["Delivered অর্ডার", summary.deliveredCount || 0].map(csvCell).join(","),
      ["বাতিল/রিটার্ন হার", percent(summary.cancellationRate)].map(csvCell).join(","),
      ["ডেলিভারি সফলতার হার", percent(summary.deliverySuccessRate)].map(csvCell).join(","),
      "",
      ["মাস", "অর্ডার", "অর্ডার মূল্য (৳)", "Delivered অর্ডার", "Delivered মূল্য (৳)"].map(csvCell).join(",")
    ];
    (data.salesByMonth || []).forEach(function (row) {
      lines.push([row.month, row.orders, row.revenue, row.deliveredOrders, row.deliveredSales].map(csvCell).join(","));
    });
    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "muslim-abaya-sales-report-" + String(data.range || "all") + ".csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function toggleCustomDates() {
    byId("admReportCustomDates").hidden = byId("admReportRange").value !== "custom";
  }

  function init() {
    if (!window.MaAdmin || !MaAdmin.getSession || !MaAdmin.getSession()) return;
    updateDesktopButton();
    state.desktopEnabled = storedDesktopOptIn() && ("Notification" in window) && Notification.permission === "granted";
    updateDesktopButton();
    byId("admDesktopAlerts").addEventListener("click", requestDesktopPermission);
    byId("admAlertsRefresh").addEventListener("click", refreshAlerts);
    byId("admTasksRefresh").addEventListener("click", function () { refreshTasks(true); });
    byId("admReportLoad").addEventListener("click", loadAnalytics);
    byId("admRefresh").addEventListener("click", function () { refreshAlerts(); refreshTasks(true); loadAnalytics(); });
    byId("admReportRange").addEventListener("change", function () { toggleCustomDates(); if (this.value !== "custom") loadAnalytics(); });
    byId("admReportExport").addEventListener("click", exportCsv);
    toggleCustomDates();
    refreshAlerts();
    refreshTasks(true);
    loadAnalytics();
    window.setInterval(function () {
      if (document.hidden) return;
      refreshAlerts();
      refreshTasks(false);
    }, ALERT_POLL_MS);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        refreshAlerts();
        refreshTasks(false);
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
