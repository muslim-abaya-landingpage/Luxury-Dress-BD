/* Admin → পণ্যভিত্তিক লাভ: sold qty, sales and profit per product for a date range. Buying prices stay server-side. */
(function () {
  "use strict";
  function byId(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function money(n) { return n == null ? "—" : "৳" + Math.round(Number(n) || 0).toLocaleString("en-US"); }
  var state = { range: "30d", data: null, edits: {}, busy: false };
  try { state.range = localStorage.getItem("ma_profit_range") || "30d"; } catch (e) {}

  function syncChips() {
    Array.prototype.forEach.call(document.querySelectorAll("#pfRange [data-range]"), function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-range") === state.range));
    });
    byId("pfCustom").hidden = state.range !== "custom";
  }
  function costInput(p) {
    var v = Object.prototype.hasOwnProperty.call(state.edits, p.productId) ? state.edits[p.productId] : (p.cost == null ? "" : p.cost);
    return '<input type="number" min="0" step="1" inputmode="numeric" class="pf-cost" data-id="' + esc(p.productId) + '" data-name="' + esc(p.name) + '" value="' + esc(v) + '" aria-label="' + esc(p.name) + ' — কেনা দাম">';
  }
  function render() {
    var d = state.data;
    if (!d) return;
    var t = d.totals || {};
    byId("pfQty").textContent = Number(t.qty || 0).toLocaleString("en-US");
    byId("pfSales").textContent = money(t.sales);
    byId("pfOrders").textContent = Number(d.orders || 0) + "টি অর্ডার · " + (d.from ? d.from + " – " + d.to : "সব সময়");
    byId("pfProfit").textContent = t.costedSales ? money(t.profit) : "—";
    byId("pfProfitNote").textContent = t.missingCost ? t.missingCost + "টি পণ্যের কেনা দাম নেই — নিচে বসান" : "সব পণ্যের কেনা দাম আছে";
    var rows = d.products || [];
    if (!rows.length) { byId("pfBody").innerHTML = '<tr><td colspan="7" class="adm-empty">এই সময়ে কোনো বিক্রি নেই।</td></tr>'; return; }
    byId("pfBody").innerHTML = rows.map(function (p) {
      var cls = p.profit == null ? "" : (p.profit < 0 ? " pf-neg" : " pf-pos");
      return "<tr><td><b>" + esc(p.name) + "</b><small class=\"pf-id\">" + esc(p.productId) + (p.unpricedQty ? " · " + p.unpricedQty + " পিসের দাম অর্ডারে নেই" : "") + "</small></td>" +
        "<td>" + p.qty + "</td><td>" + money(p.sales) + "</td><td>" + costInput(p) + "</td><td>" + money(p.totalCost) + "</td>" +
        '<td class="' + cls + '">' + money(p.profit) + "</td><td>" + (p.margin == null ? "—" : p.margin + "%") + "</td></tr>";
    }).join("");
  }
  function load() {
    if (state.busy) return;
    if (state.range === "custom" && (!byId("pfFrom").value || !byId("pfTo").value || byId("pfFrom").value > byId("pfTo").value)) {
      byId("pfError").textContent = "শুরু ও শেষের সঠিক তারিখ দিন।"; byId("pfError").hidden = false; return;
    }
    state.busy = true;
    byId("pfError").hidden = true;
    byId("pfBody").innerHTML = '<tr><td colspan="7" class="adm-empty">হিসাব হচ্ছে…</td></tr>';
    MaAdmin.getProductProfit({ range: state.range, from: byId("pfFrom").value, to: byId("pfTo").value, basis: byId("pfBasis").value })
      .then(function (res) { state.data = res; render(); })
      .catch(function (err) {
        var msg = String(err && err.message || err);
        if (/OWNER_ONLY|শুধুমাত্র মূল/.test(msg)) msg = "এই পেজ শুধু মূল অ্যাডমিন দেখতে পারবেন।";
        byId("pfError").textContent = msg; byId("pfError").hidden = false;
        byId("pfBody").innerHTML = '<tr><td colspan="7" class="adm-empty">লোড হয়নি।</td></tr>';
      })
      .finally(function () { state.busy = false; });
  }
  function save() {
    var ids = Object.keys(state.edits);
    if (!ids.length) return;
    var payload = {};
    for (var i = 0; i < ids.length; i++) {
      var raw = String(state.edits[ids[i]]).trim();
      if (raw !== "" && (!/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) > 1000000)) {
        byId("pfResult").className = "st-result is-bad"; byId("pfResult").textContent = "× কেনা দাম শুধু সংখ্যা (০ – ১০,০০,০০০) দিন।"; return;
      }
      var input = document.querySelector('.pf-cost[data-id="' + ids[i].replace(/"/g, "") + '"]');
      payload[ids[i]] = { cost: raw === "" ? "" : Number(raw), name: input ? input.getAttribute("data-name") : "" };
    }
    byId("pfSave").disabled = true;
    byId("pfSave").textContent = "সেভ হচ্ছে…";
    MaAdmin.saveProductCosts(payload).then(function (res) {
      state.edits = {};
      byId("pfResult").className = "st-result is-ok";
      byId("pfResult").textContent = "✓ " + (res.saved || 0) + "টি কেনা দাম সেভ হয়েছে" + (res.removed ? ", " + res.removed + "টি মুছে ফেলা হয়েছে" : "") + "।";
      load();
    }).catch(function (err) {
      byId("pfResult").className = "st-result is-bad";
      byId("pfResult").textContent = "× " + String(err && err.message || err) + " — পরিবর্তন হারায়নি, আবার চাপুন।";
      byId("pfSave").disabled = false;
    }).finally(function () { byId("pfSave").textContent = "কেনা দাম সেভ করুন"; });
  }

  byId("pfRange").addEventListener("click", function (e) {
    var b = e.target.closest("[data-range]"); if (!b) return;
    state.range = b.getAttribute("data-range");
    try { localStorage.setItem("ma_profit_range", state.range); } catch (x) {}
    syncChips();
    if (state.range !== "custom") load();
  });
  byId("pfGo").addEventListener("click", load);
  byId("pfBasis").addEventListener("change", load);
  byId("pfBody").addEventListener("input", function (e) {
    var el = e.target.closest(".pf-cost"); if (!el) return;
    state.edits[el.getAttribute("data-id")] = el.value;
    byId("pfSave").disabled = false;
    byId("pfResult").textContent = Object.keys(state.edits).length + "টি পরিবর্তন সেভ হয়নি";
    byId("pfResult").className = "st-result";
  });
  byId("pfSave").addEventListener("click", save);
  window.addEventListener("beforeunload", function (e) { if (Object.keys(state.edits).length) { e.preventDefault(); e.returnValue = ""; } });

  syncChips();
  MaAdminShell.start(function () { if (state.range !== "custom") load(); });
})();
