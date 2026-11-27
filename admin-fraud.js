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
  // Served by the Cloudflare Worker (/_ma/admin/fraud): it has the review database and checks the login
  // with Apps Script, so no Google service-account secret is needed.
  function request(fields) {
    var s = session();
    if (!s || !s.token) return Promise.reject(new Error("LOGIN_REQUIRED"));
    var body = { token: s.token, action: fields.Action };
    if (fields.Status != null) body.status = fields.Status;
    if (fields.Limit != null) body.limit = Number(fields.Limit);
    if (fields.Cursor != null) body.cursor = fields.Cursor;
    if (fields.ReviewId != null) body.reviewId = fields.ReviewId;
    if (fields.Reason != null) body.reason = fields.Reason;
    if (fields.ExpectedVersion != null) body.expectedVersion = Number(fields.ExpectedVersion);
    return fetch("/_ma/admin/fraud", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
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
  function loadProtectionStatus() {
    var target=byId("frProtectionDetails"), state=byId("frProtectionState");
    var s=window.MaAdmin&&MaAdmin.getSession?MaAdmin.getSession():null;
    if(!s||!s.token){state.textContent="Login required";target.textContent="অ্যাডমিন সেশন পাওয়া যায়নি।";return;}
    fetch("/_ma/admin/order-settings?token="+encodeURIComponent(s.token),{cache:"no-store"})
      .then(function(r){return r.json().then(function(data){if(!r.ok||!data.ok)throw new Error(data.error||("HTTP_"+r.status));return data;});})
      .then(function(data){
        var settings=data.settings||{}, integrations=data.integrations||{};
        var otp=!!integrations.whatsappOtp, courier=!!settings.courierProtection;
        state.textContent="Connected";
        target.innerHTML='<p><strong>WhatsApp OTP:</strong> '+(otp?"Credentials configured":"Not configured")+'</p>'+
          '<p><strong>OTP policy:</strong> '+(settings.mobileVerification?"Enabled for eligible risk orders":"Disabled")+'</p>'+
          '<p><strong>Courier protection:</strong> '+(courier?"Enabled":"Disabled")+'</p>'+
          '<p><strong>Minimum delivery success ratio:</strong> '+esc(settings.courierSuccessRatio==null?"—":settings.courierSuccessRatio+"%")+'</p>'+
          '<p><strong>Duplicate protection:</strong> '+(settings.duplicateBlock?"Enabled":"Disabled")+' · '+esc(settings.duplicateWindowMinutes||"—")+' minutes</p>';
      }).catch(function(error){state.textContent="Unavailable";target.textContent="Worker configuration পাওয়া যায়নি: "+String(error.message||error)+". Secrets-এর মান এখানে দেখানো হয় না।";});
  }
  function load(append) {
    append = append === true;
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
      loadCustomerContext(r);
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
  function customerMarkup(order, history) {
    var stats = history && history.stats || {};
    var rate = history && history.successRate;
    var blocked = !!(order && order.blocked);
    var recent = history && history.recent || [];
    var kpis = [["মোট অর্ডার",stats.total||0],["ডেলিভার্ড",stats.delivered||0],["ক্যানসেল",stats.cancelled||0],["Fraud",stats.fake||0],["রিটার্ন",stats.returned||0],["সফলতার হার",rate==null?"N/A":rate+"%"]];
    var html = '<p><strong>ফোন:</strong> '+esc(order&&order.phone||"পাওয়া যায়নি")+' &nbsp; <strong>নিজস্ব হিস্ট্রি রিস্ক:</strong> '+esc(history&&history.risk||"N/A")+' &nbsp; <strong>Phone status:</strong> '+(blocked?"Blocked":"Active")+'</p>';
    html += '<div class="fr-customer-kpis">'+kpis.map(function(x){return '<div class="fr-customer-kpi"><strong>'+esc(x[1])+'</strong><small>'+esc(x[0])+'</small></div>';}).join("")+'</div>';
    if(blocked) html += '<p><strong>Block reason:</strong> '+esc(order.blockReason||"কারণ দেওয়া হয়নি")+'</p>';
    html += '<div class="fr-customer-actions"><button type="button" class="adm-btn adm-btn-secondary" id="frTogglePhoneBlock">'+(blocked?"Unblock phone":"Block phone number")+'</button>'+(order&&order.orderId?'<a class="adm-btn adm-btn-secondary" href="admin-order.html?id='+encodeURIComponent(order.orderId)+'">Open order</a>':"")+'</div>';
    html += '<h4>সাম্প্রতিক অর্ডার</h4><div class="adm-table-wrap"><table class="fr-customer-table"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Courier</th><th>Total</th></tr></thead><tbody>';
    html += recent.length?recent.map(function(x){return '<tr><td>'+(x.orderId?'<a href="admin-order.html?id='+encodeURIComponent(x.orderId)+'">'+esc(x.orderId)+'</a>':"—")+'</td><td>'+esc(x.time||"—")+'</td><td>'+esc(x.status||"—")+'</td><td>'+esc(x.courierStatus||"—")+'</td><td>'+esc(x.total==null?"—":x.total)+'</td></tr>';}).join(""):'<tr><td colspan="5">আগের অর্ডার পাওয়া যায়নি।</td></tr>';
    return html+'</tbody></table></div>';
  }
  function loadCustomerContext(review) {
    var target=byId("frCustomerData");
    target.innerHTML='<p class="adm-empty">কাস্টমারের অর্ডার ইতিহাস লোড হচ্ছে…</p>';
    if(!review||!review.orderId||!window.MaAdmin||!MaAdmin.call){target.innerHTML='<p class="adm-empty">এই রিভিউর সঙ্গে অর্ডার আইডি নেই; কাস্টমার ইতিহাস দেখানো যাচ্ছে না।</p>';return;}
    MaAdmin.call("AdminOrderGet",{OrderId:review.orderId}).then(function(result){
      if(!selected||selected.reviewId!==review.reviewId)return;
      var order=result.order||{}, history=result.history||{};
      target.innerHTML=customerMarkup(order,history);
      var toggle=byId("frTogglePhoneBlock");
      if(toggle&&order.phone)toggle.addEventListener("click",function(){
        var blocking=!order.blocked;
        var reason=blocking?window.prompt("এই নম্বর ব্লক করার কারণ লিখুন:"):"Admin fraud review unblock";
        if(blocking&&(!reason||!reason.trim()))return;
        if(!window.confirm(blocking?"এই ফোন নম্বরের নতুন অর্ডার ব্লক করবেন?":"এই ফোন নম্বরের ব্লক তুলে দেবেন?"))return;
        toggle.disabled=true;
        MaAdmin.call("AdminBlockCustomer",{Phone:order.phone,Block:blocking?"1":"0",Reason:reason||""})
          .then(function(){return loadCustomerContext(review);})
          .catch(function(error){showError(error);toggle.disabled=false;});
      });
    }).catch(function(error){target.innerHTML='<p class="adm-empty">কাস্টমার ইতিহাস লোড হয়নি: '+esc(error.message||error)+'</p>';});
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
    if (owner) { MaAdminShell.start(load); loadProtectionStatus(); }
  }).catch(showError);
})();
