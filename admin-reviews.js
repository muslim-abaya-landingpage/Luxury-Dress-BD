/* Admin → Reviews: approve / reject customer reviews (with photos). Only approved reviews are public. */
(function () {
  "use strict";
  var all = [], status = "Pending";
  function byId(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function stars(n) { n = Math.max(0, Math.min(5, Math.round(Number(n) || 0))); return "★★★★★".slice(0, n) + '<span class="rv-off">' + "★★★★★".slice(0, 5 - n) + "</span>"; }
  function counts(c) { ["Pending", "Approved", "Rejected"].forEach(function (k) { byId("rvCount" + k).textContent = String((c && c[k]) || 0); }); }
  function render() {
    var list = all.filter(function (r) { return r.status === status; });
    byId("rvStatus").textContent = list.length ? "" : (status === "Pending" ? "নতুন কোনো রিভিউ অপেক্ষায় নেই।" : "এখানে কোনো রিভিউ নেই।");
    byId("rvList").innerHTML = list.map(function (r) {
      var actions = (r.status !== "Approved" ? '<button type="button" class="rv-ok" data-act="Approved">✓ Approve</button>' : "") +
        (r.status !== "Rejected" ? '<button type="button" class="rv-no" data-act="Rejected">✕ Reject</button>' : "") +
        (r.status !== "Pending" ? '<button type="button" data-act="Pending">অপেক্ষমাণে ফেরত</button>' : "");
      return '<li class="rv-item" data-id="' + esc(r.id) + '">' +
        '<div class="rv-top"><span class="rv-stars" aria-label="' + r.rating + ' / 5">' + stars(r.rating) + '</span><b>' + esc(r.name) + '</b>' +
        (r.verifiedPurchase ? '<span class="rv-ver">✓ যাচাইকৃত ক্রেতা' + (r.orderId ? " · অর্ডার " + esc(r.orderId) : "") + '</span>' : '<span>যাচাই ছাড়া</span>') +
        '<span class="rv-date">' + esc(r.date) + '</span></div>' +
        '<div class="rv-prod">পণ্য: <a href="/product/' + encodeURIComponent(r.productId) + '" target="_blank" rel="noopener">' + esc(r.productName || r.productId) + '</a></div>' +
        (r.comment ? '<p class="rv-text">' + esc(r.comment) + '</p>' : "") +
        (r.photos && r.photos.length ? '<div class="rv-photos">' + r.photos.map(function (u) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="রিভিউয়ের ছবি" loading="lazy"></a>'; }).join("") + "</div>" : "") +
        '<div class="rv-actions">' + actions + "</div></li>";
    }).join("");
  }
  function load() {
    byId("rvStatus").textContent = "লোড হচ্ছে…";
    MaAdmin.call("AdminReviewList", {}, { timeoutMs: 30000 }).then(function (res) {
      all = res.reviews || [];
      counts(res.counts);
      render();
    }).catch(function (err) { byId("rvStatus").textContent = "রিভিউ আনা যায়নি: " + (err && err.message || err); });
  }
  document.addEventListener("click", function (ev) {
    var tab = ev.target.closest && ev.target.closest(".rv-tab");
    if (tab) {
      status = tab.getAttribute("data-status");
      document.querySelectorAll(".rv-tab").forEach(function (t) { t.classList.toggle("is-active", t === tab); });
      render();
      return;
    }
    var btn = ev.target.closest && ev.target.closest("[data-act]");
    if (!btn) return;
    var item = btn.closest(".rv-item"), id = item.getAttribute("data-id"), next = btn.getAttribute("data-act");
    item.querySelectorAll("button").forEach(function (b) { b.disabled = true; });
    MaAdmin.call("AdminReviewStatus", { ReviewID: id, Status: next }, { timeoutMs: 30000 }).then(function () {
      var c = { Pending: 0, Approved: 0, Rejected: 0 };
      all.forEach(function (r) { if (r.id === id) r.status = next; c[r.status] = (c[r.status] || 0) + 1; });
      counts(c);
      render();
    }).catch(function (err) {
      item.querySelectorAll("button").forEach(function (b) { b.disabled = false; });
      byId("rvStatus").textContent = "বদলানো যায়নি: " + (err && err.message || err);
    });
  });
  MaAdminShell.start(function () { load(); });
})();
