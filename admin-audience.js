/* Admin → বিজ্ঞাপনের অডিয়েন্স: customer lists from the shop's own orders, as Meta "Customer list" CSV (owner only). */
(function () {
  "use strict";
  function byId(id) { return document.getElementById(id); }
  var NAMES = { buyers: "asol-kreta", repeat: "barbar-kena", all: "sob-customer", abandoned: "checkout-theme-geche", exclude: "baad-deoar-talika" };
  function months() { return Number(byId("auMonths").value) || 0; }
  function bn(n) { return String(n).replace(/\d/g, function (d) { return "০১২৩৪৫৬৭৮৯"[d]; }); }
  function showError(err) {
    var msg = String(err && err.message || err);
    if (/OWNER_ONLY|শুধুমাত্র মূল/.test(msg)) msg = "এই পেজ শুধু মূল অ্যাডমিন দেখতে পারবেন।";
    else if (/RATE_LIMIT/.test(msg)) msg = "অল্প সময়ে অনেক রিকোয়েস্ট গেছে। কয়েক মিনিট পরে আবার চেষ্টা করুন।";
    byId("auError").textContent = msg; byId("auError").hidden = false;
  }
  function loadCounts() {
    byId("auError").hidden = true;
    document.querySelectorAll("[data-count]").forEach(function (el) { el.textContent = "…"; });
    MaAdmin.getAudienceCounts(months()).then(function (res) {
      document.querySelectorAll(".au-card").forEach(function (card) {
        var n = (res.counts || {})[card.getAttribute("data-list")] || 0;
        card.querySelector("[data-count]").innerHTML = bn(n) + " <small>জন</small>";
      });
    }).catch(showError);
  }
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function download(list, btn) {
    var old = btn.textContent;
    btn.disabled = true; btn.textContent = "তৈরি হচ্ছে…";
    byId("auError").hidden = true;
    MaAdmin.exportAudience(list, months()).then(function (res) {
      var rows = res.rows || [];
      if (!rows.length) { showError("এই সময়সীমায় এই তালিকায় কেউ নেই।"); return; }
      var cols = list === "buyers" ? ["phone", "fn", "ln", "country", "value"] : ["phone", "fn", "ln", "country"];
      var lines = [cols.join(",")].concat(rows.map(function (r) { return cols.map(function (c) { return csvCell(r[c]); }).join(","); }));
      var blob = new Blob([lines.join("\n") + "\n"], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "muslimabaya-" + NAMES[list] + "-" + (months() ? months() + "m" : "all") + "-" + new Date().toISOString().slice(0, 10) + ".csv";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }).catch(showError).finally(function () { btn.disabled = false; btn.textContent = old; });
  }
  byId("auMonths").addEventListener("change", loadCounts);
  document.querySelectorAll(".au-card [data-download]").forEach(function (btn) {
    btn.addEventListener("click", function () { download(btn.closest(".au-card").getAttribute("data-list"), btn); });
  });
  MaAdminShell.start(function () { loadCounts(); });
})();
