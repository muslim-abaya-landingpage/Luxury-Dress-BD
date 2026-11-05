/* Admin → কাস্টমার প্রোফাইল: look up a customer by mobile number — order history, risk, block/unblock. */
(function () {
  "use strict";
  function byId(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function money(n) { return "৳" + Math.round(Number(n) || 0).toLocaleString("en-US"); }
  var RISK = { high: ["ঝুঁকি বেশি", "is-bad"], medium: ["কিছুটা ঝুঁকি", "is-warn"], low: ["বিশ্বস্ত", "is-ok"], "new": ["নতুন কাস্টমার", ""], unknown: ["এখনো ডেলিভারি হয়নি", ""] };
  var current = null, busy = false;

  function normalize(raw) {
    var d = String(raw || "").replace(/[০-৯]/g, function (c) { return "০১২৩৪৫৬৭৮৯".indexOf(c); }).replace(/\D/g, "");
    if (d.indexOf("880") === 0) d = d.slice(2);
    if (d.length === 10 && d.charAt(0) === "1") d = "0" + d;
    return d;
  }
  function remember(phone, name) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem("ma_cust_recent") || "[]"); } catch (e) {}
    list = [{ p: phone, n: name || "" }].concat(list.filter(function (x) { return x && x.p !== phone; })).slice(0, 6);
    try { localStorage.setItem("ma_cust_recent", JSON.stringify(list)); } catch (e) {}
    paintRecentSearches();
  }
  function paintRecentSearches() {
    var list = [];
    try { list = JSON.parse(localStorage.getItem("ma_cust_recent") || "[]"); } catch (e) {}
    byId("cuRecentSearches").innerHTML = list.length ? '<span>সাম্প্রতিক:</span>' + list.map(function (x) {
      return '<button type="button" data-phone="' + esc(x.p) + '">' + esc(x.n ? x.n + " · " + x.p : x.p) + "</button>";
    }).join("") : "";
  }
  function render(res) {
    current = res;
    var st = res.stats || {};
    var risk = RISK[res.risk] || [res.risk || "—", ""];
    byId("cuProfile").hidden = false;
    byId("cuName").textContent = res.found ? (res.name || "নাম নেই") : "এই নম্বরে কোনো অর্ডার নেই";
    byId("cuAvatar").textContent = (res.name || "?").trim().charAt(0).toUpperCase() || "?";
    byId("cuMeta").textContent = [res.phone, res.district, res.address, res.email].filter(Boolean).join(" · ");
    byId("cuRisk").textContent = res.blocked ? "ব্লক করা" : risk[0];
    byId("cuRisk").className = "cu-risk " + (res.blocked ? "is-bad" : risk[1]);
    byId("cuTotal").textContent = st.total || 0;
    byId("cuDelivered").textContent = st.delivered || 0;
    byId("cuFailed").textContent = (st.cancelled || 0) + (st.returned || 0) + (st.fake || 0);
    byId("cuRate").textContent = res.successRate == null ? "—" : res.successRate + "%";
    var wa = "880" + res.phone.slice(1);
    byId("cuCall").href = "tel:" + res.phone;
    byId("cuWa").href = "https://wa.me/" + wa;
    byId("cuOrders").href = "admin-orders.html?q=" + encodeURIComponent(res.phone);
    byId("cuNewOrder").href = "admin-order-new.html?phone=" + encodeURIComponent(res.phone);
    byId("cuBlock").textContent = res.blocked ? "আনব্লক করুন" : "ব্লক করুন";
    byId("cuBlock").classList.toggle("is-danger", !res.blocked);
    var recent = res.recent || [];
    byId("cuRecent").innerHTML = recent.length ? recent.map(function (o) {
      return '<tr><td><a href="admin-order.html?id=' + encodeURIComponent(o.orderId) + '">' + esc(o.orderId || "—") + "</a></td><td>" + esc(o.time) +
        "</td><td>" + esc(o.status) + "</td><td>" + esc(o.courierStatus || "—") + "</td><td>" + money(o.total) + "</td></tr>";
    }).join("") : '<tr><td colspan="5" class="adm-empty">কোনো অর্ডার নেই</td></tr>';
    if (res.found) remember(res.phone, res.name);
  }
  function lookup(raw) {
    var phone = normalize(raw);
    byId("cuError").hidden = true;
    if (!/^01\d{9}$/.test(phone)) { byId("cuError").textContent = "সঠিক ১১ সংখ্যার মোবাইল নম্বর দিন (01XXXXXXXXX)।"; byId("cuError").hidden = false; return; }
    if (busy) return;
    busy = true;
    byId("cuPhone").value = phone;
    try { history.replaceState(null, "", "?phone=" + phone); } catch (e) {}
    MaAdmin.lookupCustomer(phone).then(render).catch(function (err) {
      byId("cuError").textContent = String(err && err.message || err); byId("cuError").hidden = false;
    }).finally(function () { busy = false; });
  }
  function toggleBlock() {
    if (!current) return;
    var block = !current.blocked;
    if (block && !window.confirm(current.phone + " নম্বর ব্লক করবেন? এই নম্বর থেকে আর অর্ডার নেওয়া হবে না।")) return;
    var btn = byId("cuBlock");
    btn.disabled = true;
    MaAdmin.blockCustomer(current.phone, block).then(function () { lookup(current.phone); })
      .catch(function (err) { byId("cuError").textContent = String(err && err.message || err); byId("cuError").hidden = false; })
      .finally(function () { btn.disabled = false; });
  }

  byId("cuForm").addEventListener("submit", function (e) { e.preventDefault(); lookup(byId("cuPhone").value); });
  byId("cuRecentSearches").addEventListener("click", function (e) { var b = e.target.closest("[data-phone]"); if (b) lookup(b.getAttribute("data-phone")); });
  byId("cuBlock").addEventListener("click", toggleBlock);
  paintRecentSearches();
  MaAdminShell.start(function (s, isRefresh) {
    var q = "";
    try { q = new URLSearchParams(location.search).get("phone") || ""; } catch (e) {}
    if (isRefresh && current) lookup(current.phone);
    else if (q) lookup(q);
    else byId("cuPhone").focus();
  });
})();
