/**
 * Muslim Abaya — order panel tools (admin-orders.html + admin-order.html).
 *  - WhatsApp-এ কনফার্ম: wa.me লিংক, অর্ডারের বিবরণ আগে থেকে লেখা
 *  - বাতিল/Fake/রিটার্নের কারণ: Admin Note-এ "[কারণ: …]" ট্যাগ হিসেবে
 *  - একসাথে অনেক অর্ডার: প্যাকিং স্লিপ প্রিন্ট ও Steadfast-এ পাঠানো
 *  - রিপোর্ট: জেলা, পণ্য ও বাতিলের কারণ অনুযায়ী
 * Pure helpers are exported for tests; DOM wiring runs only when the page has the matching elements.
 */
(function (root) {
  "use strict";

  var REASONS = ["সাইজ মেলেনি", "পছন্দ হয়নি", "ফোন ধরেনি", "ঠিকানা ভুল / পাওয়া যায়নি", "দাম বেশি মনে হয়েছে", "দেরিতে পৌঁছেছে", "ক্রেতা অর্ডার করেননি (Fake)", "অন্য কারণ"];
  var REASON_STATUSES = /^(cancelled|canceled|fake|returned|return)$/i;
  var REASON_TAG = /\[কারণ:\s*([^\]]+)\]/;

  function text(v) { return String(v == null ? "" : v).trim(); }
  function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(/[^\d.\-]/g, "")); return isFinite(n) ? n : 0; }
  function money(n) { return "৳" + Math.round(Number(n) || 0).toLocaleString("en-US"); }

  /** 01XXXXXXXXX → 8801XXXXXXXXX; anything else → "" (no link). */
  function waPhone(phone) {
    var d = String(phone || "").replace(/\D/g, "");
    if (/^8801\d{9}$/.test(d)) return d;
    if (/^01\d{9}$/.test(d)) return "88" + d;
    if (/^1\d{9}$/.test(d)) return "880" + d;
    return "";
  }

  function itemsOf(o) {
    if (o && o.items && o.items.length) return o.items;
    return String((o && o.design) || "").split(/\n/).map(function (s) { return s.replace(/^\d+\.\s*/, "").trim(); }).filter(Boolean);
  }

  function confirmMessage(o) {
    var total = num(o.total), advance = num(o.advance);
    var due = o.due != null ? num(o.due) : Math.max(0, total - advance);
    var lines = ["আসসালামু আলাইকুম" + (text(o.name) ? " " + text(o.name) : "") + ",",
      "Muslim Abaya থেকে বলছি। আপনার অর্ডারটি পাঠানোর আগে একবার মিলিয়ে নিতে চাই:", "",
      "অর্ডার নম্বর: " + (text(o.orderId) || "—")];
    var items = itemsOf(o);
    if (items.length) { lines.push("পণ্য:"); items.forEach(function (it) { lines.push("• " + it); }); }
    if (text(o.size) && items.join(" ").indexOf(text(o.size)) === -1) lines.push("সাইজ: " + text(o.size));
    lines.push("মোট: " + money(total) + " (ডেলিভারি চার্জসহ)");
    if (advance > 0) lines.push("অগ্রিম পেয়েছি: " + money(advance) + " · ডেলিভারির সময় দেবেন: " + money(due));
    else lines.push("ডেলিভারির সময় দেবেন: " + money(due));
    if (text(o.address)) lines.push("ঠিকানা: " + text(o.address) + (text(o.district) && text(o.address).indexOf(text(o.district)) === -1 ? ", " + text(o.district) : ""));
    lines.push("", "সব ঠিক থাকলে \"হ্যাঁ\" লিখে জানান। কিছু বদলাতে চাইলে এখানেই বলুন। ধন্যবাদ।");
    return lines.join("\n");
  }

  function waUrl(o) {
    var p = waPhone(o && o.phone);
    return p ? "https://wa.me/" + p + "?text=" + encodeURIComponent(confirmMessage(o)) : "";
  }

  function needsReason(status) { return REASON_STATUSES.test(text(status)); }
  function reasonOf(note) { var m = REASON_TAG.exec(String(note || "")); return m ? m[1].trim() : ""; }
  function withReason(note, reason) {
    var clean = String(note || "").replace(new RegExp(REASON_TAG.source + "\\s*", "g"), "").trim();
    return reason ? ("[কারণ: " + reason + "]" + (clean ? " " + clean : "")) : clean;
  }

  /** delivered | returned | cancelled | fake | active | unknown — courier text wins when present. */
  function outcome(o) {
    var c = text(o.courierStatus).toLowerCase(), s = text(o.status).toLowerCase();
    if (/partial/.test(c)) return "active";
    if (/return/.test(c)) return "returned";
    if (/cancel/.test(c)) return "cancelled";
    if (/^delivered/.test(c)) return "delivered";
    if (s === "delivered") return "delivered";
    if (s === "fake") return "fake";
    if (s === "cancelled" || s === "canceled") return "cancelled";
    if (s === "returned" || s === "return") return "returned";
    if (/^(pending|confirmed|shipped)$/.test(s) || !s) return "active";
    return "unknown";
  }

  /** "Black Abaya (Body 42 · Length 52) × 2" → name "Black Abaya", qty 2 */
  function parseItem(line) {
    var s = text(line), qty = 1, m = /[×x]\s*(\d+)\s*$/i.exec(s);
    if (m) { qty = parseInt(m[1], 10) || 1; s = s.slice(0, m.index).trim(); }
    s = s.replace(/\s*\([^)]*\)\s*$/, "").replace(/\s*[-–—|]\s*(size|সাইজ)\b.*$/i, "").trim();
    return { name: s || "(নাম নেই)", qty: qty };
  }

  function emptyRow() { return { orders: 0, delivered: 0, failed: 0, active: 0, value: 0 }; }
  function tally(row, kind, value) {
    row.orders++;
    if (kind === "delivered") { row.delivered++; row.value += value; }
    else if (kind === "returned" || kind === "cancelled" || kind === "fake") row.failed++;
    else row.active++;
  }
  function failRate(r) { var done = r.delivered + r.failed; return done ? Math.round((r.failed / done) * 100) : null; }

  function report(orders) {
    var byDistrict = {}, byProduct = {}, reasons = {}, totals = emptyRow();
    (orders || []).forEach(function (o) {
      var kind = outcome(o), value = num(o.total);
      var d = text(o.district) || "জেলা লেখা নেই";
      tally(byDistrict[d] = byDistrict[d] || emptyRow(), kind, value);
      tally(totals, kind, value);
      itemsOf(o).forEach(function (line) {
        var it = parseItem(line), p = byProduct[it.name] = byProduct[it.name] || { units: 0, deliveredUnits: 0, failedUnits: 0, orders: 0 };
        p.orders++; p.units += it.qty;
        if (kind === "delivered") p.deliveredUnits += it.qty;
        else if (kind === "returned" || kind === "cancelled" || kind === "fake") p.failedUnits += it.qty;
      });
      if (kind === "returned" || kind === "cancelled" || kind === "fake") {
        var r = reasonOf(o.adminNote) || "কারণ লেখা হয়নি";
        reasons[r] = (reasons[r] || 0) + 1;
      }
    });
    function rows(map, sortKey) {
      return Object.keys(map).map(function (k) { var r = map[k]; r.key = k; return r; })
        .sort(function (a, b) { return (b[sortKey] - a[sortKey]) || a.key.localeCompare(b.key); });
    }
    return { totals: totals, districts: rows(byDistrict, "orders"), products: rows(byProduct, "units"),
      reasons: Object.keys(reasons).map(function (k) { return { reason: k, count: reasons[k] }; }).sort(function (a, b) { return b.count - a.count; }) };
  }

  /** Which selected orders can be sent to the courier, and why the rest are skipped. */
  function courierPlan(orders) {
    var send = [], skip = [];
    (orders || []).forEach(function (o) {
      var kind = outcome(o);
      if (!text(o.orderId)) skip.push({ o: o, why: "Order ID নেই" });
      else if (text(o.tracking) || text(o.consignmentId)) skip.push({ o: o, why: "আগেই কুরিয়ারে গেছে" });
      else if (kind !== "active") skip.push({ o: o, why: "স্ট্যাটাস " + (text(o.status) || kind) });
      else if (o.blocked) skip.push({ o: o, why: "নম্বর Blocked" });
      else send.push(o);
    });
    return { send: send, skip: skip };
  }

  var api = { REASONS: REASONS, waPhone: waPhone, confirmMessage: confirmMessage, waUrl: waUrl, needsReason: needsReason,
    reasonOf: reasonOf, withReason: withReason, outcome: outcome, parseItem: parseItem, report: report,
    courierPlan: courierPlan, failRate: failRate };
  root.MaOrderTools = api;
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  if (typeof document === "undefined") return;

  /* ---------------- DOM ---------------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function toast(msg, bad) { if (root.MaPanel && root.MaPanel.toast) root.MaPanel.toast(msg, bad); else if (bad) alert(msg); }

  var CSS =
    ".ot-wa{display:inline-flex;align-items:center;gap:4px;font-size:.78rem;color:#128c4b;text-decoration:none;font-weight:600}.ot-wa:hover{text-decoration:underline}" +
    ".ot-bulk{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0;padding:8px 10px;border-radius:10px;background:rgba(99,91,255,.07)}" +
    ".ot-bulk[hidden]{display:none}.ot-bulk b{margin-right:4px}.ot-sel{width:18px;height:18px;cursor:pointer}" +
    ".ot-report{margin:12px 0}.ot-report summary{cursor:pointer;font-weight:700;padding:6px 0}" +
    ".ot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-top:8px}" +
    ".ot-grid h3{font-size:.95rem;margin:0 0 6px}.ot-tbl{width:100%;border-collapse:collapse;font-size:.85rem}" +
    ".ot-tbl th,.ot-tbl td{padding:5px 6px;border-bottom:1px solid rgba(127,127,127,.18);text-align:right}.ot-tbl th:first-child,.ot-tbl td:first-child{text-align:left}" +
    ".ot-bad{color:#c62828;font-weight:700}.ot-note{font-size:.8rem;opacity:.75;margin:4px 0 0}" +
    ".ot-reasons{display:flex;flex-direction:column;gap:6px}.ot-reasons button{text-align:left}";
  function addStyle() { if ($("otStyle")) return; var st = document.createElement("style"); st.id = "otStyle"; st.textContent = CSS; document.head.appendChild(st); }

  /* --- single order page --- */
  function initOrderPage() {
    var head = document.querySelector(".pn-head"), statusSel = $("fStatus"), noteEl = $("fAdminNote");
    if (!head || !statusSel || !noteEl) return;
    addStyle();
    var current = null, lastStatus = "";
    var wa = document.createElement("a");
    wa.className = "pn-btn pn-btn-sm"; wa.id = "otWaConfirm"; wa.target = "_blank"; wa.rel = "noopener";
    wa.textContent = "💬 WhatsApp-এ কনফার্ম"; wa.style.display = "none";
    var pr = document.createElement("button");
    pr.type = "button"; pr.className = "pn-btn pn-btn-sm"; pr.id = "otPrint"; pr.textContent = "🖨 ইনভয়েস"; pr.style.display = "none";
    var anchor = $("btnFraud");
    head.insertBefore(pr, anchor ? anchor.nextSibling : null);
    head.insertBefore(wa, pr);
    function liveOrder() {
      if (!current) return null;
      var o = {}; Object.keys(current).forEach(function (k) { o[k] = current[k]; });
      o.name = $("fName") ? $("fName").value : o.name;
      o.address = $("fAddress") ? $("fAddress").value : o.address;
      return o;
    }
    document.addEventListener("ma-order-rendered", function (e) {
      current = e.detail || null; lastStatus = current ? text(current.status) : "";
      var url = current ? waUrl(current) : "";
      wa.style.display = url ? "" : "none";
      if (url) wa.href = url;
      pr.style.display = current && root.MaInvoice ? "" : "none";
    });
    wa.addEventListener("click", function () { var o = liveOrder(); if (o) wa.href = waUrl(o) || wa.href; });
    pr.addEventListener("click", function () { var o = liveOrder(); if (o && root.MaInvoice) root.MaInvoice.print(o); });
    statusSel.addEventListener("change", function () {
      var next = statusSel.value;
      if (!needsReason(next) || needsReason(lastStatus) && reasonOf(noteEl.value)) { lastStatus = next; return; }
      lastStatus = next;
      askReason(function (reason) { if (reason) noteEl.value = withReason(noteEl.value, reason); });
    });
  }

  function askReason(done) {
    if (!(root.MaPanel && root.MaPanel.openModal)) { done(prompt("কারণ লিখুন (ঐচ্ছিক)", "") || ""); return; }
    root.MaPanel.openModal("কেন বাতিল / ফেরত হলো?",
      '<p class="ot-note">কারণটি Admin Note-এ যোগ হবে, পরে রিপোর্টে কোন কারণ বেশি তা দেখা যাবে। "✓ Update Order" চাপলে সেভ হবে।</p>' +
      '<div class="ot-reasons">' + REASONS.map(function (r) { return '<button type="button" class="pn-btn" data-reason="' + esc(r) + '">' + esc(r) + "</button>"; }).join("") + "</div>");
    var body = $("pnModalBody"), bg = $("pnModal");
    body.addEventListener("click", function pick(ev) {
      var b = ev.target.closest("[data-reason]");
      if (!b) return;
      body.removeEventListener("click", pick);
      var r = b.getAttribute("data-reason");
      if (r === "অন্য কারণ") r = (prompt("কারণ লিখুন", "") || "").trim().slice(0, 80);
      if (bg) bg.classList.remove("open");
      done(r);
    });
  }

  /* --- order list page --- */
  var selected = {};
  function ordersNow() { return (root.MaOrdersState && root.MaOrdersState.all) || []; }
  function selectedOrders() { return ordersNow().filter(function (o) { return o.orderId && selected[o.orderId]; }); }

  function slipsHtml(list) {
    var first = root.MaInvoice.html(list[0]);
    var style = (/<style>([\s\S]*?)<\/style>/.exec(first) || [])[1] || "";
    var pages = list.map(function (o) { return (/<body>([\s\S]*?)<\/body>/.exec(root.MaInvoice.html(o)) || [])[1] || ""; });
    return "<!DOCTYPE html><html><head><meta charset='utf-8'><title>প্যাকিং স্লিপ (" + list.length + ")</title><style>" + style +
      ".inv{break-after:page;page-break-after:always}.inv:last-child{break-after:auto;page-break-after:auto}</style></head><body>" + pages.join("") + "</body></html>";
  }
  function printSlips(list) {
    if (!list.length || !root.MaInvoice) return;
    var f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    var d = f.contentWindow.document; d.open(); d.write(slipsHtml(list)); d.close();
    var done = false;
    function go() { if (done) return; done = true; try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert("প্রিন্ট চালু করা যায়নি।"); } setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 60000); }
    f.onload = go; setTimeout(go, 500);
  }

  function sendBulk(btn) {
    var plan = courierPlan(selectedOrders());
    if (!plan.send.length) { toast("পাঠানোর মতো অর্ডার নেই" + (plan.skip.length ? " — " + plan.skip.map(function (s) { return (s.o.orderId || "?") + ": " + s.why; }).join(", ") : ""), true); return; }
    var due = plan.send.reduce(function (sum, o) { return sum + (o.due != null ? num(o.due) : Math.max(0, num(o.total) - num(o.advance))); }, 0);
    var msg = plan.send.length + "টি অর্ডার Steadfast-এ পাঠাবেন? মোট COD: " + money(due) + "\n\n" + plan.send.map(function (o) { return o.orderId + " · " + o.name; }).join("\n") +
      (plan.skip.length ? "\n\nবাদ যাবে: " + plan.skip.map(function (s) { return (s.o.orderId || "?") + " (" + s.why + ")"; }).join(", ") : "");
    if (!confirm(msg)) return;
    btn.disabled = true;
    var ok = 0, failed = [];
    plan.send.reduce(function (p, o, i) {
      return p.then(function () {
        btn.textContent = "পাঠানো হচ্ছে " + (i + 1) + "/" + plan.send.length + "…";
        return root.MaAdmin.call("AdminSendCourier", { OrderId: o.orderId }).then(function () { ok++; delete selected[o.orderId]; }, function (err) { failed.push(o.orderId + ": " + (err && err.message || "ব্যর্থ")); });
      });
    }, Promise.resolve()).then(function () {
      btn.disabled = false; btn.textContent = "🚚 Steadfast-এ পাঠান";
      toast(ok + "টি পাঠানো হয়েছে" + (failed.length ? " · ব্যর্থ: " + failed.join("; ") : ""), failed.length > 0);
      var r = $("ordRefresh"); if (r) r.click();
    });
  }

  function paintBulk() {
    var bar = $("otBulk"); if (!bar) return;
    var n = selectedOrders().length;
    bar.hidden = n === 0;
    $("otBulkCount").textContent = n + "টি নির্বাচিত";
  }

  function decorateRows() {
    var body = $("ordBody"); if (!body) return;
    var map = {}; ordersNow().forEach(function (o) { if (o.orderId) map[o.orderId] = o; });
    Array.prototype.forEach.call(body.querySelectorAll("tr[data-oid]"), function (tr) {
      var o = map[tr.getAttribute("data-oid")], cb = tr.querySelector(".ot-sel");
      if (cb) cb.checked = !!selected[tr.getAttribute("data-oid")];
      var slot = tr.querySelector(".ot-wa-slot");
      if (o && slot && !slot.firstChild) { var u = waUrl(o); if (u) slot.innerHTML = '<a class="ot-wa" target="_blank" rel="noopener" href="' + esc(u) + '" title="অর্ডার কনফার্ম করতে WhatsApp খুলুন">💬 কনফার্ম</a>'; }
    });
    paintBulk();
  }

  function table(head, rows) {
    return '<table class="ot-tbl"><thead><tr>' + head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      (rows.length ? rows.join("") : '<tr><td colspan="' + head.length + '">তথ্য নেই</td></tr>') + "</tbody></table>";
  }
  function rateCell(r) { return r == null ? "—" : '<span class="' + (r >= 30 ? "ot-bad" : "") + '">' + r + "%</span>"; }

  function paintReport() {
    var box = $("otReportBody"); if (!box || !$("otReport").open) return;
    var list = ordersNow(), rep = report(list), total = root.MaOrdersState && root.MaOrdersState.total;
    box.innerHTML =
      '<p class="ot-note">লোড হওয়া ' + list.length + (total && total > list.length ? " / " + total : "") + 'টি অর্ডারের হিসাব। "ব্যর্থ" মানে বাতিল, Fake বা রিটার্ন। ব্যর্থতার হার = ব্যর্থ ÷ (ডেলিভারড + ব্যর্থ); চলমান অর্ডার এতে ধরা হয়নি।</p>' +
      '<div class="ot-grid"><div><h3>জেলা অনুযায়ী</h3>' +
      table(["জেলা", "অর্ডার", "ডেলিভারড", "ব্যর্থ", "ব্যর্থতার হার", "ডেলিভারড মূল্য"], rep.districts.map(function (r) {
        return "<tr><td>" + esc(r.key) + "</td><td>" + r.orders + "</td><td>" + r.delivered + "</td><td>" + r.failed + "</td><td>" + rateCell(failRate(r)) + "</td><td>" + money(r.value) + "</td></tr>";
      })) + "</div><div><h3>পণ্য অনুযায়ী (পিস)</h3>" +
      table(["পণ্য", "অর্ডার হয়েছে", "ডেলিভারড", "ব্যর্থ", "ব্যর্থতার হার"], rep.products.map(function (p) {
        var done = p.deliveredUnits + p.failedUnits;
        return "<tr><td>" + esc(p.key) + "</td><td>" + p.units + "</td><td>" + p.deliveredUnits + "</td><td>" + p.failedUnits + "</td><td>" + rateCell(done ? Math.round(p.failedUnits / done * 100) : null) + "</td></tr>";
      })) + "</div><div><h3>বাতিল / ফেরতের কারণ</h3>" +
      table(["কারণ", "অর্ডার"], rep.reasons.map(function (r) { return "<tr><td>" + esc(r.reason) + "</td><td>" + r.count + "</td></tr>"; })) +
      '<p class="ot-note">অর্ডার Cancelled, Fake বা Returned করার সময় কারণ বেছে নিলে এখানে যোগ হবে।</p></div></div>';
  }

  function initListPage() {
    var body = $("ordBody"), tableWrap = document.querySelector(".pn-table-wrap");
    if (!body || !tableWrap) return;
    addStyle();
    var bar = document.createElement("div");
    bar.className = "ot-bulk"; bar.id = "otBulk"; bar.hidden = true;
    bar.innerHTML = '<b id="otBulkCount"></b>' +
      '<button type="button" class="pn-btn pn-btn-sm" id="otPrintSel">🖨 প্যাকিং স্লিপ প্রিন্ট</button>' +
      '<button type="button" class="pn-btn pn-btn-sm pn-btn-blue" id="otSendSel">🚚 Steadfast-এ পাঠান</button>' +
      '<button type="button" class="pn-btn pn-btn-sm" id="otClearSel">বাছাই মুছুন</button>';
    tableWrap.parentNode.insertBefore(bar, tableWrap);
    var rep = document.createElement("details");
    rep.className = "pn-card ot-report"; rep.id = "otReport";
    rep.innerHTML = "<summary>📊 রিপোর্ট: জেলা, পণ্য ও বাতিলের কারণ</summary><div id=\"otReportBody\"></div>";
    var insights = $("ordInsights");
    (insights && insights.parentNode ? insights.parentNode : tableWrap.parentNode).insertBefore(rep, insights ? insights.nextSibling : bar);
    rep.addEventListener("toggle", paintReport);

    body.addEventListener("change", function (e) {
      var cb = e.target.closest(".ot-sel"); if (!cb) return;
      var id = cb.getAttribute("data-oid"); if (cb.checked) selected[id] = true; else delete selected[id];
      paintBulk();
    });
    var all = $("otSelAll");
    if (all) all.addEventListener("change", function () {
      Array.prototype.forEach.call(body.querySelectorAll(".ot-sel"), function (cb) {
        cb.checked = all.checked; var id = cb.getAttribute("data-oid");
        if (all.checked) selected[id] = true; else delete selected[id];
      });
      paintBulk();
    });
    $("otClearSel").addEventListener("click", function () { selected = {}; if (all) all.checked = false; decorateRows(); });
    $("otPrintSel").addEventListener("click", function () { printSlips(selectedOrders()); });
    $("otSendSel").addEventListener("click", function () { sendBulk(this); });
    document.addEventListener("ma-orders-rendered", function () { if (all) all.checked = false; decorateRows(); paintReport(); });
    decorateRows();
  }

  function boot() { initOrderPage(); initListPage(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
