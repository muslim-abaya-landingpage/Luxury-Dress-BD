(function () {
  "use strict";
  var selected = null;
  var busy = false;
  var nextCursor = null;
  function byId(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function session() { return window.MaAdmin && MaAdmin.getSession ? MaAdmin.getSession() : null; }
  function request(fields) {
    var s = session();
    if (!s || !s.token) return Promise.reject(new Error("LOGIN_REQUIRED"));
    var body = new URLSearchParams(Object.assign({ Token: s.token }, fields));
    return fetch("/api/admin-fraud", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: body.toString()
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || !data.ok) throw new Error(data.error || ("HTTP_" + response.status));
        return data;
      });
    });
  }
  function date(value) {
    if (!value) return "—";
    try { return new Date(Number(value)).toLocaleString(); } catch (e) { return "—"; }
  }
  function statusLabel(value) {
    return ({ pending: "Pending", hold: "On hold", cleared: "Cleared", rejected: "Suspicious" })[value] || value;
  }
  function showError(error) {
    var el = byId("frError");
    el.textContent = String(error && error.message || error);
    el.hidden = false;
  }
  function load(append) {
    if (busy) return Promise.resolve();
    busy = true;
    byId("frError").hidden = true;
    if (!append) { nextCursor = null; byId("frRows").innerHTML = '<tr><td colspan="6" class="adm-empty">Loading…</td></tr>'; }
    var fields = { Action: "list", Status: byId("frStatus").value, Limit: "50" };
    if (append && nextCursor) fields.Cursor = nextCursor;
    return request(fields).then(function (data) {
      var rows = data.reviews || [];
      var markup = rows.length ? rows.map(function (row) {
        var reason = (row.reasons || []).slice(0, 2).join(" · ");
        return '<tr><td><strong>' + esc(row.orderId || "Order pending ID") + '</strong><small>' + esc(row.reviewId) + '</small></td>' +
          '<td><strong>' + esc(row.riskScore) + '/100</strong><small>' + esc(row.riskLevel) + ' · ' + esc(row.riskAction) + '</small></td>' +
          '<td>' + esc(reason || "Risk signals recorded") + '</td><td>' + esc(statusLabel(row.status)) + '</td>' +
          '<td>' + esc(date(row.createdAt)) + '</td><td><button type="button" class="adm-btn adm-btn-secondary fr-open" data-review="' + esc(row.reviewId) + '">Review</button></td></tr>';
      }).join("") : (append ? "" : '<tr><td colspan="6" class="adm-empty">No fraud reviews in this view.</td></tr>');
      if (append) byId("frRows").insertAdjacentHTML("beforeend", markup); else byId("frRows").innerHTML = markup;
      nextCursor = data.nextCursor || null;
      byId("frMore").hidden = !nextCursor;
    }).catch(showError).finally(function () { busy = false; });
  }
  function openReview(id) {
    byId("frError").hidden = true;
    request({ Action: "detail", ReviewId: id }).then(function (data) {
      selected = data.review;
      var r = selected;
      byId("frDetail").hidden = false;
      byId("frTitle").textContent = "Order " + (r.orderId || "pending ID");
      byId("frMeta").textContent = "Risk " + r.riskScore + "/100 · " + r.riskLevel + " · " + statusLabel(r.status) + " · Version " + r.version;
      byId("frReasons").innerHTML = '<h3>Risk reasons</h3><ul>' + (r.reasons || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul><h3>Signal summary</h3><pre>' + esc(JSON.stringify(r.signals || {}, null, 2)) + '</pre>';
      byId("frHistory").innerHTML = (data.history || []).map(function (item) {
        return '<li><strong>' + esc(item.action) + '</strong> · ' + esc(item.previousStatus || "—") + ' → ' + esc(item.newStatus) +
          '<small>' + esc(item.actorId) + ' · ' + esc(date(item.createdAt)) + '</small>' +
          (item.reason ? '<p>' + esc(item.reason) + '</p>' : '') + '</li>';
      }).join("") || "<li>No history yet.</li>";
      var terminal = r.status === "cleared" || r.status === "rejected";
      document.querySelectorAll("[data-fr-decision]").forEach(function (button) {
        var action = button.getAttribute("data-fr-decision");
        button.hidden = terminal ? action !== "pending" : action === "pending";
      });
      byId("frDetail").scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(showError);
  }
  function decide(status) {
    if (!selected) return;
    var reason = "";
    if (status === "rejected" || status === "hold" || status === "pending") {
      reason = window.prompt(status === "pending" ? "Reason for reopening this review:" : "Enter a review reason:");
      if (!reason || !reason.trim()) return;
    } else if (!window.confirm("Clear this fraud review? This will not confirm the order.")) return;
    request({
      Action: "decide",
      ReviewId: selected.reviewId,
      Status: status,
      Reason: reason,
      ExpectedVersion: String(selected.version)
    }).then(function () {
      return load().then(function () { return openReview(selected.reviewId); });
    }).catch(showError);
  }
  byId("frRows").addEventListener("click", function (event) {
    var button = event.target.closest("[data-review]");
    if (button) openReview(button.getAttribute("data-review"));
  });
  byId("frStatus").addEventListener("change", function () { load(false); });
  byId("frMore").addEventListener("click", function () { if (nextCursor) load(true); });
  byId("frRefresh").addEventListener("click", load);
  byId("admRefresh").addEventListener("click", load);
  byId("frClose").addEventListener("click", function () { byId("frDetail").hidden = true; selected = null; });
  document.querySelectorAll("[data-fr-decision]").forEach(function (button) {
    button.addEventListener("click", function () { decide(button.getAttribute("data-fr-decision")); });
  });
  MaAdminGuard.requireOwner().then(function (owner) {
    if (owner) MaAdminShell.start(load);
  }).catch(showError);
})();
