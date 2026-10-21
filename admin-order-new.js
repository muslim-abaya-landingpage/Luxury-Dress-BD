/**
 * Muslim Abaya — "নতুন অর্ডার" page (admin-order-new.html), laid out like WooCommerce → Orders → Add new.
 * Saves in ONE step with AdminOrderCreate: items as cart lines (stock is reserved like a website order),
 * exact date/charge/discount/coupon/advance/status/source, Blocked list and risk note.
 * Pure helpers are exported for tests.
 */
(function (root) {
  "use strict";

  var STATUSES = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"];

  function num(v) { var n = Number(String(v == null ? "" : v).replace(/[^\d.\-]/g, "")); return isFinite(n) ? n : 0; }
  function money(n) { return "৳" + Math.round(Number(n) || 0).toLocaleString("en-US"); }
  function clean(v) { return String(v == null ? "" : v).replace(/\s+/g, " ").trim(); }

  /** One line per item, in the same shape the checkout writes, so reports and invoices read it. */
  function itemLine(it) {
    var bits = [clean(it.name)];
    if (clean(it.type)) bits.push(clean(it.type));
    if (clean(it.size)) bits.push("Size " + clean(it.size));
    var qty = Math.max(1, Math.round(num(it.qty)) || 1);
    return bits.join(" · ") + " × " + qty + " pcs = " + money(num(it.price) * qty);
  }

  function totals(items, shipping, discount, coupon, advance) {
    var subtotal = 0, qty = 0;
    (items || []).forEach(function (it) { var q = Math.max(1, Math.round(num(it.qty)) || 1); qty += q; subtotal += num(it.price) * q; });
    var ship = Math.max(0, num(shipping)), disc = Math.max(0, num(discount)), cp = Math.max(0, num(coupon));
    var total = Math.max(0, subtotal + ship - disc - cp);
    var adv = Math.max(0, num(advance));
    return { qty: qty, subtotal: subtotal, shipping: ship, discount: disc, coupon: cp, total: total, advance: adv, due: Math.max(0, total - adv) };
  }

  /** District → delivery charge, from the checkout's own list. */
  function chargeFor(district, districts) {
    var d = clean(district);
    var hit = (districts || []).filter(function (x) { return x.bn === d || x.en === d; })[0];
    return hit ? num(hit.fee) : 150;
  }

  /** Latest details per phone from loaded orders, for the "Customer" search. */
  function customers(orders) {
    var map = {};
    (orders || []).forEach(function (o) {
      var phone = String(o.phone || "").replace(/\D/g, "");
      if (!/^01\d{9}$/.test(phone)) return;
      var c = map[phone] || (map[phone] = { phone: phone, name: "", address: "", district: "", orders: 0 });
      c.orders++;
      if (!c.name && o.name) c.name = clean(o.name);
      if (!c.address && o.address) c.address = clean(o.address);
      if (!c.district && o.district) c.district = clean(o.district);
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  function validate(state) {
    var b = state.billing || {}, s = state.shipping || {};
    if (clean(b.name).length < 2) return "ক্রেতার নাম দিন (Billing)।";
    if (!/^01\d{9}$/.test(String(b.phone || "").replace(/\D/g, ""))) return "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (Billing)।";
    if (clean(s.address).length < 8) return "পূর্ণ ঠিকানা দিন (Shipping)।";
    if (!state.items || !state.items.length) return "অন্তত একটি পণ্য যোগ করুন (Add item)।";
    if (state.items.some(function (it) { return !clean(it.name) || num(it.price) <= 0; })) return "প্রতিটি পণ্যের নাম ও দাম দিন।";
    var t = totals(state.items, state.shippingCharge, state.discount, state.coupon && state.coupon.amount, state.advance);
    if (t.total < 1) return "মোট টাকা শূন্য হতে পারে না।";
    if (t.advance > t.total) return "অগ্রিম মোট টাকার বেশি হতে পারে না।";
    if (STATUSES.indexOf(state.status) === -1) return "স্ট্যাটাস বাছুন।";
    return "";
  }

  /** The single AdminOrderCreate payload. The server recomputes totals and the coupon itself. */
  function payloads(state) {
    var t = totals(state.items, state.shippingCharge, state.discount, state.coupon && state.coupon.amount, state.advance);
    var when = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(clean(state.date)) || [];
    var items = state.items.map(function (it) {
      return { id: clean(it.sku), name: clean(it.name), type: clean(it.type), size: clean(it.size), category: clean(it.category),
        price: num(it.price), qty: Math.max(1, Math.round(num(it.qty)) || 1) };
    });
    var create = {
      Name: clean(state.billing.name), Phone: String(state.billing.phone).replace(/\D/g, ""), Email: clean(state.billing.email),
      District: clean(state.shipping.district), Address: clean(state.shipping.address), CourierNote: clean(state.shipping.courierNote),
      ItemsJSON: JSON.stringify(items), Charge: t.shipping, Discount: t.discount, Advance: t.advance,
      CouponCode: state.coupon && state.coupon.code ? state.coupon.code : "",
      Status: state.status, Date: when[1] || "", Time: when[2] || "",
      Payment: clean(state.payment) || "Cash On Delivery", Txn: clean(state.txn),
      Source: clean(state.source) || "Other", AdminNote: clean(state.note)
    };
    return { create: create, totals: t };
  }

  var api = { STATUSES: STATUSES, itemLine: itemLine, totals: totals, chargeFor: chargeFor, customers: customers, validate: validate, payloads: payloads };
  root.MaNewOrder = api;
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  if (typeof document === "undefined") return;

  /* ---------------------------------- page ---------------------------------- */
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toast(msg, bad) { if (root.MaPanel && root.MaPanel.toast) root.MaPanel.toast(msg, bad); }

  var state = { items: [], coupon: null }, districts = [], customerList = [], catalog = [], busy = false;

  function dhakaNow() {
    var d = new Date(Date.now() + 6 * 3600000);
    return { date: d.toISOString().slice(0, 10), hh: d.toISOString().slice(11, 13), mm: d.toISOString().slice(14, 16) };
  }

  function readForm() {
    state.date = $("noDate").value && $("noHour").value !== "" && $("noMin").value !== ""
      ? $("noDate").value + "T" + String($("noHour").value).padStart(2, "0") + ":" + String($("noMin").value).padStart(2, "0") : "";
    state.status = $("noStatus").value;
    state.billing = { name: $("noName").value, phone: $("noPhone").value, email: $("noEmail").value };
    state.shipping = { address: $("noAddress").value, district: $("noDistrict").value, courierNote: $("noCourierNote").value };
    state.shippingCharge = $("noShipping").value;
    state.discount = $("noDiscount").value;
    state.advance = $("noAdvance").value;
    state.payment = $("noPayment").value;
    state.txn = $("noTxn").value;
    state.source = $("noSource").value;
    state.note = $("noNote").value;
  }

  function summary(id, lines) {
    var parts = lines.filter(function (x) { return clean(x); });
    $(id).innerHTML = parts.length ? parts.map(esc).join("<br>") : '<span class="no-muted">' + (id === "noBillView" ? "No billing address set." : "No shipping address set.") + "</span>";
  }
  function paintAddresses() {
    summary("noBillView", [$("noName").value, $("noPhone").value, $("noEmail").value]);
    summary("noShipView", [$("noAddress").value, $("noDistrict").value]);
  }

  function paintItems() {
    var body = $("noItems");
    if (!state.items.length) {
      body.innerHTML = '<tr class="no-empty"><td colspan="5">কোনো পণ্য যোগ করা হয়নি। নিচে "Add item(s)" চাপুন।</td></tr>';
    } else {
      body.innerHTML = state.items.map(function (it, i) {
        return '<tr><td class="no-item"><b>' + esc(it.name) + "</b>" + (it.type || it.size ? '<small>' + esc([it.type, it.size ? "Size " + it.size : ""].filter(Boolean).join(" · ")) + "</small>" : "") + (it.sku ? '<small class="no-sku">SKU: ' + esc(it.sku) + "</small>" : "") + "</td>" +
          '<td><input class="no-mini" type="number" min="1" step="1" data-i="' + i + '" data-k="price" value="' + esc(it.price) + '" aria-label="দাম"></td>' +
          '<td><input class="no-mini no-qty" type="number" min="1" step="1" data-i="' + i + '" data-k="qty" value="' + esc(it.qty) + '" aria-label="পরিমাণ"></td>' +
          "<td>" + money(num(it.price) * Math.max(1, num(it.qty))) + "</td>" +
          '<td><button type="button" class="no-x" data-del="' + i + '" aria-label="পণ্য সরান">×</button></td></tr>';
      }).join("");
    }
    paintTotals();
  }

  function paintTotals() {
    readForm();
    var t = totals(state.items, state.shippingCharge, state.discount, state.coupon && state.coupon.amount, state.advance);
    $("noSub").textContent = money(t.subtotal);
    $("noShipLine").textContent = money(t.shipping);
    $("noDiscLine").textContent = "−" + money(t.discount);
    $("noCouponRow").hidden = !state.coupon;
    if (state.coupon) { $("noCouponLbl").textContent = "Coupon (" + state.coupon.code + "):"; $("noCouponLine").textContent = "−" + money(t.coupon); }
    $("noTotal").textContent = money(t.total);
    $("noDue").textContent = money(t.due);
    $("noTitleTotal").textContent = t.qty ? "· " + t.qty + " পিস · " + money(t.total) : "";
  }

  /* ---- Add item dialog ---- */
  function loadCatalog() {
    var all = root.CATEGORY_PRODUCTS || {};
    catalog = [];
    Object.keys(all).forEach(function (cat) {
      (all[cat] || []).forEach(function (p) {
        if (!p || !p.name) return;
        catalog.push({ p: p, cat: cat, label: p.name + " · " + (p.id || "") });
      });
    });
    $("noProdList").innerHTML = catalog.map(function (x) { return '<option value="' + esc(x.label) + '">'; }).join("");
  }
  function pickProduct() {
    var v = $("noProdSearch").value, hit = catalog.filter(function (x) { return x.label === v; })[0];
    var p = hit && hit.p;
    $("noProdPick").hidden = !p;
    if (!p) return;
    $("noProdName").textContent = p.name;
    var types = p.priceByType ? Object.keys(p.priceByType) : [];
    $("noTypeWrap").hidden = !types.length;
    $("noType").innerHTML = types.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + " — " + money(p.priceByType[t]) + "</option>"; }).join("");
    if (types.indexOf("Full Set") !== -1) $("noType").value = "Full Set";
    var sizes = p.lengthSizes || p.sizes || [];
    $("noSize").innerHTML = '<option value="">— সাইজ —</option>' + sizes.map(function (s) { return '<option>' + esc(s) + "</option>"; }).join("");
    $("noItemPrice").value = types.length ? p.priceByType[$("noType").value] : (p.price || "");
    $("noItemQty").value = 1;
  }
  function addPicked() {
    var v = $("noProdSearch").value, hit = catalog.filter(function (x) { return x.label === v; })[0];
    if (!hit) { toast("তালিকা থেকে একটি পণ্য বাছুন", true); return; }
    var price = num($("noItemPrice").value), qty = Math.max(1, Math.round(num($("noItemQty").value)) || 1);
    if (price <= 0) { toast("দাম দিন", true); return; }
    state.items.push({ name: hit.p.name, sku: hit.p.id || "", category: hit.cat || "", type: $("noTypeWrap").hidden ? "" : $("noType").value, size: $("noSize").value, price: price, qty: qty });
    $("noAddDialog").close();
    paintItems();
  }
  function addCustom() {
    var name = clean($("noCustName").value), price = num($("noCustPrice").value), qty = Math.max(1, Math.round(num($("noCustQty").value)) || 1);
    if (name.length < 2 || price <= 0) { toast("পণ্যের নাম ও দাম দিন", true); return; }
    state.items.push({ name: name, sku: "", type: "", size: clean($("noCustSize").value), price: price, qty: qty });
    $("noAddDialog").close();
    paintItems();
  }
  function openAdd() {
    ["noProdSearch", "noCustName", "noCustPrice", "noCustSize"].forEach(function (id) { $(id).value = ""; });
    $("noCustQty").value = 1;
    $("noProdPick").hidden = true;
    $("noAddDialog").showModal();
    $("noProdSearch").focus();
  }

  /* ---- coupon ---- */
  function applyCoupon() {
    var code = clean(prompt("কুপন কোড লিখুন", "") || "").toUpperCase();
    if (!code) return;
    readForm();
    var sub = totals(state.items).subtotal;
    root.MaAdmin.call("AdminCouponCheck", { Code: code, Subtotal: sub }).then(function (r) {
      var amount = num(r && (r.discount != null ? r.discount : r.amount));
      if (!(r && r.ok !== false) || amount <= 0) throw new Error((r && r.message) || "কুপনটি বৈধ নয়");
      state.coupon = { code: code, amount: amount };
      paintTotals();
      toast("কুপন যোগ হয়েছে: −" + money(amount));
    }).catch(function (err) { toast((err && err.message) || "কুপনটি বৈধ নয়", true); });
  }

  /* ---- customer search ---- */
  function fillCustomer() {
    var v = $("noCustomer").value;
    var c = customerList.filter(function (x) { return (x.name + " · " + x.phone) === v || x.phone === v.replace(/\D/g, ""); })[0];
    if (!c) return;
    $("noName").value = c.name; $("noPhone").value = c.phone;
    $("noAddress").value = c.address; if (c.district) setDistrict(c.district);
    $("noCustHint").textContent = "আগের অর্ডার: " + c.orders + "টি। ঠিকানা আগের অর্ডার থেকে বসানো হয়েছে, মিলিয়ে নিন।";
    paintAddresses(); paintTotals();
  }
  function setDistrict(d) {
    var sel = $("noDistrict");
    if (!Array.prototype.some.call(sel.options, function (o) { return o.value === d; })) { var o = document.createElement("option"); o.value = d; o.textContent = d; sel.appendChild(o); }
    sel.value = d;
    $("noShipping").value = chargeFor(d, districts);
  }

  /* ---- create ---- */
  function create() {
    if (busy) return;
    readForm();
    var problem = validate(state);
    if (problem) { toast(problem, true); $("noStatusMsg").textContent = problem; $("noStatusMsg").className = "no-msg is-error"; return; }
    var p = payloads(state), action = $("noAction").value;
    busy = true; $("noCreate").disabled = true; $("noCreate").textContent = "তৈরি হচ্ছে…";
    var msg = $("noStatusMsg"); msg.className = "no-msg"; msg.textContent = "অর্ডার তৈরি হচ্ছে…";
    var orderId = "";
    function doCreate(extra) { return root.MaAdmin.call("AdminOrderCreate", Object.assign({}, p.create, extra || {})); }
    doCreate().catch(function (err) {
      if (err && err.code === "PHONE_BLOCKED" && confirm("এই নম্বরটি Blocked তালিকায় আছে। তবুও অর্ডার তৈরি করবেন?")) return doCreate({ AllowBlocked: "1" });
      throw err;
    }).then(function (res) {
      orderId = res.orderId;
      if (res.stockNote) toast(res.stockNote, true);
      return root.MaAdmin.call("AdminOrderGet", { OrderId: orderId }).catch(function () { return {}; });
    }).then(function (res) {
      if (action === "courier") return root.MaAdmin.call("AdminSendCourier", { OrderId: orderId }).then(function () { return res; });
      return res;
    }).then(function (res) {
      if (action === "print" && root.MaInvoice && res && res.order) root.MaInvoice.print(res.order);
      msg.className = "no-msg is-ok";
      msg.innerHTML = "✅ অর্ডার <b>" + esc(orderId) + "</b> তৈরি হয়েছে" + (action === "courier" ? " ও Steadfast-এ পাঠানো হয়েছে" : "") + '। <a href="admin-order.html?id=' + encodeURIComponent(orderId) + '">অর্ডারটি খুলুন →</a> · <a href="admin-order-new.html">আরেকটি নতুন অর্ডার</a>';
      $("noCreate").textContent = "তৈরি হয়েছে";
      toast("অর্ডার " + orderId + " তৈরি হয়েছে");
    }).catch(function (err) {
      busy = false;
      $("noCreate").disabled = false; $("noCreate").textContent = "Create";
      msg.className = "no-msg is-error";
      msg.innerHTML = esc((err && err.message) || "অর্ডার তৈরি করা যায়নি") + (orderId ? ' — অর্ডার ' + esc(orderId) + ' তৈরি হয়েছে, বাকিটা <a href="admin-order.html?id=' + encodeURIComponent(orderId) + '">অর্ডার পেজে</a> ঠিক করুন।' : "");
    });
  }

  function trash() {
    if (!confirm("ফর্মের সব তথ্য মুছে নতুন করে শুরু করবেন?")) return;
    location.href = "admin-order-new.html";
  }

  function toggle(view, edit, btn) {
    btn.addEventListener("click", function () { var open = $(edit).hidden; $(edit).hidden = !open; $(view).hidden = open; btn.setAttribute("aria-expanded", String(open)); if (open) { var f = $(edit).querySelector("input,select,textarea"); if (f) f.focus(); } else paintAddresses(); });
  }

  function loadDistricts() {
    return fetch("/checkout-location-labels.js").then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) {
      var m = /CHECKOUT_DISTRICTS\s*=\s*(\[[\s\S]*?\]);/.exec(t || "");
      districts = m ? JSON.parse(m[1]) : [];
    }).catch(function () { districts = []; }).then(function () {
      var sel = $("noDistrict");
      sel.innerHTML = '<option value="">— জেলা বাছুন —</option>' + districts.map(function (d) { return '<option value="' + esc(d.bn) + '">' + esc(d.bn) + " (" + esc(d.en) + ")</option>"; }).join("");
    });
  }

  function loadCustomers() {
    return root.MaAdmin.call("AdminOrderList", { Limit: 300 }).then(function (res) {
      customerList = customers(res.orders || []);
      $("noCustList").innerHTML = customerList.map(function (c) { return '<option value="' + esc(c.name + " · " + c.phone) + '">'; }).join("");
      $("noNextId").textContent = "নতুন";
    }).catch(function () {});
  }

  function boot() {
    if (!$("noForm")) return;
    var now = dhakaNow();
    $("noDate").value = now.date; $("noHour").value = now.hh; $("noMin").value = now.mm;
    $("noStatus").innerHTML = STATUSES.map(function (s) { return "<option>" + s + "</option>"; }).join("");
    paintItems(); paintAddresses();
    toggle("noBillView", "noBillEdit", $("noBillToggle"));
    toggle("noShipView", "noShipEdit", $("noShipToggle"));
    $("noForm").addEventListener("input", function (e) {
      if (e.target.matches("[data-i]")) { var it = state.items[+e.target.getAttribute("data-i")]; it[e.target.getAttribute("data-k")] = e.target.value; var row = e.target.closest("tr"); row.cells[3].textContent = money(num(it.price) * Math.max(1, num(it.qty))); }
      paintTotals();
    });
    $("noItems").addEventListener("click", function (e) { var b = e.target.closest("[data-del]"); if (!b) return; state.items.splice(+b.getAttribute("data-del"), 1); paintItems(); });
    $("noDistrict").addEventListener("change", function () { $("noShipping").value = chargeFor(this.value, districts); paintAddresses(); paintTotals(); });
    $("noCustomer").addEventListener("change", fillCustomer);
    $("noAddBtn").addEventListener("click", openAdd);
    $("noCouponBtn").addEventListener("click", applyCoupon);
    $("noCouponRemove").addEventListener("click", function () { state.coupon = null; paintTotals(); });
    $("noRecalc").addEventListener("click", function () { paintItems(); toast("হিসাব আবার করা হয়েছে"); });
    $("noProdSearch").addEventListener("change", pickProduct);
    $("noType").addEventListener("change", function () { var hit = catalog.filter(function (x) { return x.label === $("noProdSearch").value; })[0]; if (hit && hit.p.priceByType) $("noItemPrice").value = hit.p.priceByType[this.value]; });
    $("noAddPicked").addEventListener("click", addPicked);
    $("noAddCustom").addEventListener("click", addCustom);
    $("noAddClose").addEventListener("click", function () { $("noAddDialog").close(); });
    $("noForm").addEventListener("submit", function (e) { e.preventDefault(); create(); });
    $("noTrash").addEventListener("click", trash);
    document.querySelectorAll(".no-box-toggle").forEach(function (b) { b.addEventListener("click", function () { var box = b.closest(".no-box"); box.classList.toggle("is-closed"); b.setAttribute("aria-expanded", String(!box.classList.contains("is-closed"))); }); });
    loadCatalog();
    loadDistricts();
    var start = root.MaPanel && root.MaPanel.init ? root.MaPanel.init("orders") : Promise.resolve(true);
    Promise.resolve(start).then(function (s) { if (s) loadCustomers(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})(typeof window !== "undefined" ? window : globalThis);
