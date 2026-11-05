/* Admin → কার্যকলাপ লগ: who changed what (owner only). */
(function () {
  "use strict";
  function byId(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var timer = 0, busy = false, adminsFilled = false;
  function link(item) {
    var t = String(item.target || "");
    if (/^(AdminOrder|AdminSendCourier|AdminManualOrder)/.test(item.type) && t) return '<a href="admin-order.html?id=' + encodeURIComponent(t) + '">' + esc(t) + "</a>";
    if (item.type === "AdminBlockCustomer" && /^01\d{9}$/.test(t)) return '<a href="admin-customers.html?phone=' + t + '">' + esc(t) + "</a>";
    return esc(t || "—");
  }
  function load() {
    if (busy) return;
    busy = true;
    byId("acError").hidden = true;
    MaAdmin.getActivity({ admin: byId("acAdmin").value, q: byId("acQ").value.trim() }).then(function (res) {
      if (!adminsFilled) {
        adminsFilled = true;
        byId("acAdmin").insertAdjacentHTML("beforeend", (res.admins || []).map(function (a) { return '<option value="' + esc(a) + '">' + esc(a) + "</option>"; }).join(""));
      }
      var items = res.items || [];
      byId("acBody").innerHTML = items.length ? items.map(function (it) {
        return "<tr><td class=\"ac-time\">" + esc(it.time) + "</td><td>" + esc(it.admin) + (it.role === "staff" ? ' <small class="ac-role">স্টাফ</small>' : "") +
          "</td><td>" + esc(it.label) + "</td><td>" + link(it) + '</td><td class="ac-details">' + esc(it.details || "") + "</td></tr>";
      }).join("") : '<tr><td colspan="5" class="adm-empty">এখনো কোনো পরিবর্তন জমা হয়নি। এই আপডেটের পর থেকে যা বদলানো হবে তা এখানে দেখা যাবে।</td></tr>';
    }).catch(function (err) {
      var msg = String(err && err.message || err);
      if (/OWNER_ONLY|শুধুমাত্র মূল/.test(msg)) msg = "এই পেজ শুধু মূল অ্যাডমিন দেখতে পারবেন।";
      byId("acError").textContent = msg; byId("acError").hidden = false;
      byId("acBody").innerHTML = '<tr><td colspan="5" class="adm-empty">লোড হয়নি।</td></tr>';
    }).finally(function () { busy = false; });
  }
  byId("acAdmin").addEventListener("change", load);
  byId("acQ").addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(load, 450); });
  MaAdminShell.start(function () { load(); });
})();
