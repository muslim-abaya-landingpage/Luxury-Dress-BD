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
    return ({ pending: "অপেক্ষমাণ", hold: "সাময়িক আটকে", cleared: "ঝুঁকিমুক্ত", rejected: "প্রতারণা সন্দেহ" })[value] || "অজানা";
  }
  function errorMessage(error) {
    var code = String(error && error.message || error || "");
    var messages = {
      NOT_CONFIGURED: "Fraud Review-এর সার্ভার সংযোগ এখনো সম্পূর্ণ সেটআপ হয়নি। Cloudflare Pages-এর ORDERS_DB ও GOOGLE_SA_JSON সেটিংস যাচাই করতে হবে।",
      AUTH_UNAVAILABLE: "অ্যাডমিন পরিচয় যাচাই করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন; সমস্যা থাকলে Google সংযোগ যাচাই করতে হবে।",
      LOGIN_REQUIRED: "আপনার অ্যাডমিন লগইনের মেয়াদ শেষ হয়েছে। আবার লগইন করুন।",
      NO_TOKEN: "অ্যাডমিন সেশন পাওয়া যায়নি। আবার লগইন করুন।",
      NOT_LOGGED_IN: "আপনার লগইন যাচাই হয়নি। আবার লগইন করুন।",
      OWNER_ONLY: "এই কাজটি শুধু মালিকের অ্যাকাউন্ট থেকে করা যাবে।",
      DB_ERROR: "রিভিউয়ের ডেটাবেজে সমস্যা হয়েছে। Cloudflare D1-এর টেবিল ও সংযোগ যাচাই করতে হবে।",
      INVALID_TOKEN: "অ্যাডমিন সেশন গ্রহণ করা হয়নি। আবার লগইন করে চেষ্টা করুন।",
      NOT_FOUND: "এই রিভিউটি আর পাওয়া যাচ্ছে না। তালিকা আপডেট করে দেখুন।",
      VERSION_CONFLICT: "অন্য একটি পরিবর্তনের কারণে রিভিউটি আপডেট হয়েছে। তালিকা নতুন করে লোড করুন।",
      INVALID_TRANSITION: "এই অবস্থায় রিভিউটির জন্য ওই সিদ্ধান্ত দেওয়া যাবে না।",
      HTTP_401: "লগইন যাচাই হয়নি। আবার লগইন করুন।",
      HTTP_403: "এই কাজের অনুমতি আপনার নেই।",
      HTTP_503: "সার্ভার সাময়িকভাবে সাড়া দিচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।"
    };
    if (messages[code]) return messages[code];
    if (/^HTTP_/.test(code)) return "সার্ভার থেকে উত্তর পাওয়া যায়নি (" + code.slice(5) + ")। আবার চেষ্টা করুন।";
    return "রিভিউ লোড বা কাজটি সম্পন্ন করা যায়নি। ইন্টারনেট ও সার্ভার সংযোগ যাচাই করে আবার চেষ্টা করুন।";
  }
  function showError(error) {
    var el = byId("frError");
    el.textContent = errorMessage(error);
    el.hidden = false;
    if (window.console && console.warn) console.warn("[Fraud Review]", error && error.message || error);
  }
  function protectionRow(label, detail, state, badge) {
    return '<div class="fr-protection-row"><div><strong>' + esc(label) + '</strong><small>' + esc(detail) + '</small></div><span class="fr-status-pill is-' + state + '">' + esc(badge) + '</span></div>';
  }
  function loadProtectionStatus() {
    var target = byId("frProtectionDetails"), state = byId("frProtectionState");
    var s = session();
    target.innerHTML = '<p class="fr-inline-loading">সুরক্ষার সেটিংস যাচাই হচ্ছে…</p>';
    state.textContent = "যাচাই হচ্ছে…";
    state.className = "fr-state-badge is-loading";
    if (!s || !s.token) {
      state.textContent = "লগইন প্রয়োজন";
      state.className = "fr-state-badge is-warning";
      target.textContent = "অ্যাডমিন সেশন পাওয়া যায়নি। আবার লগইন করুন।";
      return;
    }
    fetch("/_ma/admin/order-settings?token=" + encodeURIComponent(s.token), { cache: "no-store", credentials: "same-origin" })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          if (!r.ok || !data.ok) throw new Error(data.error || ("HTTP_" + r.status));
          return data;
        });
      })
      .then(function (data) {
        var settings = data.settings || {}, integrations = data.integrations || {};
        var otp = !!integrations.whatsappOtp;
        var otpPolicy = !!settings.mobileVerification;
        var courier = !!settings.courierProtection;
        var duplicate = !!settings.duplicateBlock;
        var ratio = settings.courierSuccessRatio;
        var allReady = otp && otpPolicy && courier && duplicate;
        state.textContent = "সংযোগ সচল";
        state.className = "fr-state-badge " + (allReady ? "is-success" : "is-warning");
        target.innerHTML =
          protectionRow("WhatsApp OTP সংযোগ", otp ? "OTP পাঠানোর প্রয়োজনীয় তথ্য পাওয়া গেছে" : "WhatsApp সংযোগের প্রয়োজনীয় তথ্য এখনো সম্পূর্ণ নয়", otp ? "success" : "warning", otp ? "সেটআপ সম্পন্ন" : "সেটআপ বাকি") +
          protectionRow("ঝুঁকিপূর্ণ অর্ডারে OTP নীতি", otpPolicy ? "যোগ্য ঝুঁকির অর্ডারে যাচাইয়ের নিয়ম চালু" : "OTP যাচাইয়ের নিয়ম বন্ধ", otpPolicy ? "success" : "danger", otpPolicy ? "চালু" : "বন্ধ") +
          protectionRow("কুরিয়ার সুরক্ষা", courier ? "কুরিয়ার সফলতার হার অনুযায়ী সুরক্ষা চালু" : "কুরিয়ার সুরক্ষা বন্ধ", courier ? "success" : "danger", courier ? "চালু" : "বন্ধ") +
          protectionRow("কুরিয়ার সফলতার ন্যূনতম হার", "নির্ধারিত সীমা: " + esc(ratio == null ? "—" : ratio + "%"), ratio == null ? "warning" : "success", ratio == null ? "সেটআপ বাকি" : "সেট করা") +
          protectionRow("ডুপ্লিকেট অর্ডার সুরক্ষা", duplicate ? "একই তথ্য দিয়ে পুনরাবৃত্ত অর্ডার-চেষ্টা নিয়ন্ত্রণ" : "ডুপ্লিকেট সুরক্ষা বন্ধ", duplicate ? "success" : "danger", duplicate ? "চালু" : "বন্ধ") +
          protectionRow("ডুপ্লিকেট যাচাইয়ের সময়", "সময়-সীমা: " + esc(settings.duplicateWindowMinutes == null ? "—" : settings.duplicateWindowMinutes + " মিনিট"), settings.duplicateWindowMinutes == null ? "warning" : "success", settings.duplicateWindowMinutes == null ? "সেটআপ বাকি" : "সেট করা");
      })
      .catch(function (error) {
        state.textContent = "যাচাই করা যায়নি";
        state.className = "fr-state-badge is-danger";
        target.innerHTML = '<p class="fr-config-error">' + esc(errorMessage(error)) + '</p>';
        if (window.console && console.warn) console.warn("[Fraud protection settings]", error && error.message || error);
      });
  }
  function load(append) {
    append = append === true;
    if (busy) return Promise.resolve();
    busy = true;
    byId("frError").hidden = true;
    if (!append) {
      nextCursor = null;
      byId("frRows").innerHTML = '<tr><td colspan="6" class="adm-empty"><span class="fr-spinner" aria-hidden="true"></span> রিভিউ লোড হচ্ছে…</td></tr>';
      byId("frMore").hidden = true;
    } else {
      byId("frMore").disabled = true;
      byId("frMore").textContent = "লোড হচ্ছে…";
    }
    var fields = { Action: "list", Status: byId("frStatus").value, Limit: "50" };
    if (append && nextCursor) fields.Cursor = nextCursor;
    return request(fields).then(function (data) {
      var rows = data.reviews || [];
      var markup = rows.length ? rows.map(function (row) {
        var reasons = (row.reasons || []);
        var reasonMarkup = reasons.length ? reasons.map(function (reason) {
          return '<span class="fr-reason-line">' + esc(reason) + '</span>';
        }).join("") : '<span class="fr-reason-line">ঝুঁকির সংকেত সংরক্ষিত আছে</span>';
        var risk = row.riskLevel === "high" ? "উচ্চ ঝুঁকি" : row.riskLevel === "review" ? "যাচাই প্রয়োজন" : "কম ঝুঁকি";
        var riskClass = row.riskLevel === "high" ? "high" : row.riskLevel === "review" ? "review" : "low";
        var terminal = row.status === "cleared" || row.status === "rejected";
        return '<tr class="fr-review-row" data-review-row="' + esc(row.reviewId) + '">' +
          '<td data-label="অর্ডার"><strong>' + esc(row.orderId || "অর্ডার নম্বর পাওয়া যায়নি") + '</strong><small>' + esc(row.reviewId) + '</small></td>' +
          '<td data-label="ঝুঁকি"><strong class="fr-risk-score">' + esc(row.riskScore) + '/100</strong><span class="fr-risk-pill is-' + riskClass + '">' + risk + '</span></td>' +
          '<td data-label="সংকেত ও কারণ"><div class="fr-reason-list">' + reasonMarkup + '</div></td>' +
          '<td data-label="অবস্থা"><span class="fr-status-pill is-' + esc(row.status) + '">' + esc(statusLabel(row.status)) + '</span></td>' +
          '<td data-label="তৈরির সময়">' + esc(date(row.createdAt)) + '</td>' +
          '<td data-label="করণীয়"><div class="fr-row-actions">' +
            '<button type="button" class="adm-btn adm-btn-secondary fr-open" data-review="' + esc(row.reviewId) + '">বিস্তারিত</button>' +
            '<button type="button" class="adm-btn adm-btn-primary" data-fr-quick="cleared" data-review="' + esc(row.reviewId) + '"' + (terminal ? " disabled" : "") + '>ঠিক আছে (ছেড়ে দিন)</button>' +
            '<button type="button" class="adm-btn adm-btn-danger" data-fr-quick="rejected" data-review="' + esc(row.reviewId) + '"' + (terminal ? " disabled" : "") + '>Fraud নিশ্চিত করুন</button>' +
            '<button type="button" class="adm-btn adm-btn-secondary" data-fr-quick="block" data-review="' + esc(row.reviewId) + '"' + (!row.orderId ? " disabled" : "") + '>নম্বর ব্লক করুন</button>' +
          '</div></td></tr>';
      }).join("") : (append ? "" : '<tr><td colspan="6" class="adm-empty fr-empty-state"><strong>এই অবস্থায় কোনো রিভিউ পাওয়া যায়নি</strong><span>নতুন ঝুঁকিপূর্ণ অর্ডার এলে এখানে দেখা যাবে।</span></td></tr>');
      if (append) byId("frRows").insertAdjacentHTML("beforeend", markup);
      else byId("frRows").innerHTML = markup;
      nextCursor = data.nextCursor || null;
      byId("frMore").hidden = !nextCursor;
      byId("frMore").textContent = "আরও রিভিউ দেখুন";
    }).catch(function (error) {
      showError(error);
      if (!append) byId("frRows").innerHTML = '<tr><td colspan="6" class="adm-empty fr-error-state"><strong>রিভিউ লোড করা যায়নি</strong><span>' + esc(errorMessage(error)) + '</span><button type="button" class="adm-btn adm-btn-secondary" data-fr-retry>আবার চেষ্টা করুন</button></td></tr>';
    }).finally(function () {
      busy = false;
      byId("frMore").disabled = false;
      if (!byId("frMore").hidden) byId("frMore").textContent = "আরও রিভিউ দেখুন";
    });
  }
  function openReview(id) {
    byId("frError").hidden = true;
    request({ Action: "detail", ReviewId: id }).then(function (data) {
      selected = data.review;
      var r = selected;
      byId("frDetail").hidden = false;
      byId("frTitle").textContent = "অর্ডার " + (r.orderId || "নম্বর পাওয়া যায়নি");
      byId("frMeta").textContent = "ঝুঁকি " + r.riskScore + "/100 · " + (r.riskLevel === "high" ? "উচ্চ ঝুঁকি" : "যাচাই প্রয়োজন") + " · " + statusLabel(r.status) + " · সংস্করণ " + r.version;
      byId("frReasons").innerHTML = '<h3>ঝুঁকির কারণ</h3><ul>' + (r.reasons || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul><h3>সংকেতের সারাংশ</h3><pre>' + esc(JSON.stringify(r.signals || {}, null, 2)) + '</pre>';
      loadCustomerContext(r);
      byId("frHistory").innerHTML = (data.history || []).map(function (item) {
        return '<li><strong>' + esc(({created:"তৈরি",cleared:"ঝুঁকিমুক্ত",rejected:"প্রতারণা সন্দেহ",hold:"সাময়িক আটকে",reopened:"আবার চালু"}[item.action] || "পরিবর্তন")) + '</strong> · ' + esc(item.previousStatus || "—") + ' → ' + esc(item.newStatus) +
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
    var kpis = [["মোট অর্ডার",stats.total||0],["ডেলিভারি সম্পন্ন",stats.delivered||0],["বাতিল",stats.cancelled||0],["প্রতারণা",stats.fake||0],["ফেরত",stats.returned||0],["সফলতার হার",rate==null?"তথ্য নেই":rate+"%"]];
    var html = '<p><strong>ফোন:</strong> '+esc(order&&order.phone||"পাওয়া যায়নি")+' &nbsp; <strong>নিজস্ব হিস্ট্রি রিস্ক:</strong> '+esc(history&&history.risk||"তথ্য নেই")+' &nbsp; <strong>Phone status:</strong> '+(blocked?"Blocked":"সক্রিয়")+'</p>';
    html += '<div class="fr-customer-kpis">'+kpis.map(function(x){return '<div class="fr-customer-kpi"><strong>'+esc(x[1])+'</strong><small>'+esc(x[0])+'</small></div>';}).join("")+'</div>';
    if(blocked) html += '<p><strong>Block reason:</strong> '+esc(order.blockReason||"কারণ দেওয়া হয়নি")+'</p>';
    html += '<div class="fr-customer-actions"><button type="button" class="adm-btn adm-btn-secondary" id="frTogglePhoneBlock">'+(blocked?"নম্বরের ব্লক তুলুন":"নম্বর ব্লক করুন")+'</button>'+(order&&order.orderId?'<a class="adm-btn adm-btn-secondary" href="admin-order.html?id='+encodeURIComponent(order.orderId)+'">অর্ডার খুলুন</a>':"")+'</div>';
    html += '<h4>সাম্প্রতিক অর্ডার</h4><div class="adm-table-wrap"><table class="fr-customer-table"><thead><tr><th>অর্ডার</th><th>তারিখ</th><th>অবস্থা</th><th>কুরিয়ার</th><th>মোট</th></tr></thead><tbody>';
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
  function runQuickAction(id, action) {
    if (action === "block") {
      request({ Action: "detail", ReviewId: id }).then(function (data) {
        var review = data.review;
        if (!review || !review.orderId) throw new Error("NOT_FOUND");
        return MaAdmin.call("AdminOrderGet", { OrderId: review.orderId });
      }).then(function (result) {
        var order = result.order || {};
        if (!order.phone) throw new Error("PHONE_NOT_FOUND");
        if (order.blocked) { window.alert("এই নম্বরটি আগে থেকেই ব্লক করা আছে।"); return; }
        var reason = window.prompt("এই নম্বর ব্লক করার কারণ লিখুন:");
        if (!reason || !reason.trim()) return;
        if (!window.confirm("এই ফোন নম্বরের নতুন অর্ডার ব্লক করবেন?")) return;
        return MaAdmin.call("AdminBlockCustomer", { Phone: order.phone, Block: "1", Reason: reason.trim() })
          .then(function () { window.alert("ফোন নম্বরটি ব্লক করা হয়েছে।"); if (selected && selected.orderId === order.orderId) loadCustomerContext(selected); });
      }).catch(showError);
      return;
    }
    request({ Action: "detail", ReviewId: id }).then(function (data) {
      var review = data.review;
      if (!review) throw new Error("NOT_FOUND");
      if (action === "cleared" && !window.confirm("এই রিভিউ ঝুঁকিমুক্ত হিসেবে চিহ্নিত করবেন? এতে অর্ডার নিশ্চিত হবে না।")) return null;
      var reason = action === "rejected" ? window.prompt("প্রতারণা সন্দেহের কারণ লিখুন:") : "";
      if (action === "rejected" && (!reason || !reason.trim())) return null;
      return request({ Action: "decide", ReviewId: review.reviewId, Status: action, Reason: reason, ExpectedVersion: String(review.version) });
    }).then(function (result) {
      if (result) return load(false);
    }).catch(showError);
  }
  function decide(status) {
    if (!selected) return;
    var reason = "";
    if (status === "rejected" || status === "hold" || status === "pending") {
      reason = window.prompt(status === "pending" ? "রিভিউ আবার চালুর কারণ লিখুন:" : "সিদ্ধান্তের কারণ লিখুন:");
      if (!reason || !reason.trim()) return;
    } else if (!window.confirm("এই রিভিউ ঝুঁকিমুক্ত হিসেবে চিহ্নিত করবেন? এতে অর্ডার নিশ্চিত হবে না।")) return;
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
    var quick = event.target.closest("[data-fr-quick]");
    if (quick) { event.preventDefault(); runQuickAction(quick.getAttribute("data-review"), quick.getAttribute("data-fr-quick")); return; }
    var button = event.target.closest("[data-review]");
    if (button) { openReview(button.getAttribute("data-review")); return; }
    if (event.target.closest("[data-fr-retry]")) load(false);
  });
  MaAdminGuard.requireOwner().then(function (owner) {
    if (owner) { MaAdminShell.start(load); loadProtectionStatus(); }
  }).catch(showError);
})();
