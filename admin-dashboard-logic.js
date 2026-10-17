(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.AdminDashboardLogic = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this), function () {
  "use strict";

  var HOUR = 60 * 60 * 1000;
  var DHAKA_OFFSET = 6 * HOUR;
  var RULES = {
    pending: { threshold: 1 * HOUR, label: "Pending" },
    confirmed: { threshold: 24 * HOUR, label: "Confirmed" },
    shipped: { threshold: 48 * HOUR, label: "Shipped" }
  };

  function parseOrderTime(value) {
    var text = String(value == null ? "" : value).trim();
    if (!text) return null;
    var match = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) {
      var day = Number(match[1]);
      var month = Number(match[2]);
      var year = Number(match[3]);
      var hour = Number(match[4] || 0);
      var minute = Number(match[5] || 0);
      var second = Number(match[6] || 0);
      var check = new Date(Date.UTC(year, month - 1, day));
      if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
      return Date.UTC(year, month - 1, day, hour, minute, second) - DHAKA_OFFSET;
    }
    var parsed = Date.parse(text);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function statusKey(status) {
    var value = String(status || "").trim().toLowerCase();
    if (value.indexOf("pend") !== -1 || value.indexOf("অপেক্ষ") !== -1) return "pending";
    if (value.indexOf("confirm") !== -1 || value.indexOf("নিশ্চিত") !== -1) return "confirmed";
    if (value.indexOf("ship") !== -1 || value.indexOf("কুরিয়ার") !== -1) return "shipped";
    return "other";
  }

  function buildPriorityTasks(orders, nowMs) {
    var now = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    var tasks = [];
    (Array.isArray(orders) ? orders : []).forEach(function (order) {
      order = order || {};
      var key = statusKey(order.status);
      var rule = RULES[key];
      if (!rule) return;
      var createdAt = parseOrderTime(order.time || order.createdAt || order.createdAtMs);
      var ageMs = createdAt == null ? null : Math.max(0, now - createdAt);
      var overdueMs = ageMs == null ? null : ageMs - rule.threshold;
      var overdue = overdueMs != null && overdueMs >= 0;
      if (key !== "pending" && !overdue && ageMs != null) return;
      tasks.push({
        order: order,
        orderId: String(order.orderId || order.id || ""),
        status: key,
        statusLabel: rule.label,
        createdAt: createdAt,
        ageMs: ageMs,
        overdueMs: overdue ? overdueMs : 0,
        overdue: overdue,
        dateUnknown: ageMs == null,
        thresholdMs: rule.threshold
      });
    });
    var rank = { pending: 0, confirmed: 1, shipped: 2 };
    tasks.sort(function (a, b) {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      if (a.overdueMs !== b.overdueMs) return b.overdueMs - a.overdueMs;
      if (a.ageMs == null) return b.ageMs == null ? 0 : 1;
      if (b.ageMs == null) return -1;
      return b.ageMs - a.ageMs;
    });
    return tasks;
  }

  function formatAge(ms) {
    if (ms == null || !Number.isFinite(Number(ms))) return "সময় নির্ণয় করা যায়নি";
    var minutes = Math.floor(Math.max(0, Number(ms)) / 60000);
    if (minutes < 60) return minutes + " মিনিট আগে";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " ঘণ্টা আগে";
    var days = Math.floor(hours / 24);
    return days + " দিন " + (hours % 24) + " ঘণ্টা আগে";
  }

  function formatOverdue(ms) {
    var minutes = Math.max(0, Math.floor(Number(ms || 0) / 60000));
    if (minutes === 0) return "এখনই overdue";
    if (minutes < 60) return minutes + " মিনিট overdue";
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + " ঘণ্টা overdue";
    return Math.floor(hours / 24) + " দিন overdue";
  }

  return {
    parseOrderTime: parseOrderTime,
    statusKey: statusKey,
    buildPriorityTasks: buildPriorityTasks,
    formatAge: formatAge,
    formatOverdue: formatOverdue,
    thresholds: { pendingMs: RULES.pending.threshold, confirmedMs: RULES.confirmed.threshold, shippedMs: RULES.shipped.threshold }
  };
});
