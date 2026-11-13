/**
 * On-site popup checkout (Order Now / অর্ডার করুন).
 *
 * Opens over the current page for ONE product line that the product page / quick view already built
 * (same size, colour, measurement and price rules as Add to Cart — nothing about sizes is decided here).
 * The order goes to the same backend as /checkout: the Cloudflare Worker (/_ma/order) on the live site,
 * otherwise straight to the Apps Script. The server re-checks price, stock, phone and duplicates, and
 * answers "Success|<Order ID>" or "Error|<message>". WhatsApp is offered only AFTER the order is saved.
 *
 * Loaded lazily by window.maOpenCheckoutPopup (cart-utils.js) on the first Order Now click.
 * Public API: window.maCheckoutPopup.open(line, { stockCap, sourceProduct }) and .close().
 */
(function () {
  "use strict";
  if (window.maCheckoutPopup && window.maCheckoutPopup.version) return;

  var WA_NUMBER = "8801971642683";
  var MAX_QTY_DEFAULT = 10;
  var FREE_DELIVERY_QTY = 3;
  var FEE_DHAKA = 80;
  var FEE_OUTSIDE = 150;
  var MAX_SITE_AGE_MS = 25 * 60 * 1000;

  var state = null; // the open popup
  var lastFocus = null;

  function $(sel, rootEl) { return (rootEl || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function money(n) {
    var v = Math.round(Number(n) || 0);
    return "৳" + v.toLocaleString("en-US");
  }
  function toAsciiDigits(s) {
    return String(s || "").replace(/[০-৯]/g, function (d) { return String(d.charCodeAt(0) - 0x09E6); });
  }
  /** "+880 1712-345678" / "০১৭১২৩৪৫৬৭৮" → "01712345678"; anything else is returned digits-only. */
  function normalizeBdPhone(raw) {
    var d = toAsciiDigits(raw).replace(/\D/g, "");
    if (d.indexOf("880") === 0 && d.length === 13) d = d.slice(2);
    else if (d.indexOf("88") === 0 && d.length === 13) d = d.slice(2);
    return d;
  }
  function isValidBdPhone(p) { return /^01[3-9]\d{8}$/.test(p); }

  function lineBaseName(line) {
    if (typeof window.getCartLineBaseName === "function") return window.getCartLineBaseName(line);
    return String(line.name || "").replace(/\s*\((Size|Body|Length)[^)]*\)\s*$/i, "");
  }
  function lineSizeLabel(line) {
    if (typeof window.getCartLineSizeLabel === "function") return window.getCartLineSizeLabel(line) || "";
    return String(line.size || line.selectedSize || "").trim();
  }
  function lineImage(line) {
    if (typeof window.resolveAbsoluteStoreImageUrl === "function") {
      try { var u = window.resolveAbsoluteStoreImageUrl(line); if (u) return u; } catch (e) {}
    }
    return String(line.image || line.img || "");
  }
  function measurementText(line) {
    if (!Array.isArray(line.measurements) || !line.measurements.length) return "";
    return line.measurements.map(function (m) {
      return String(m.label || m.key || "") + ": " + String(m.value == null ? "" : m.value);
    }).join(", ");
  }

  function districts() {
    var list = window.CHECKOUT_DISTRICTS;
    return Array.isArray(list) ? list : [];
  }
  function upazilasFor(bnDistrict) {
    var map = window.CHECKOUT_UPAZILAS_BY_DISTRICT || {};
    var list = map[bnDistrict];
    if (!Array.isArray(list)) return [];
    var seen = {};
    return list.map(function (x) { return String(x || "").trim(); }).filter(function (x) {
      if (!x || seen[x]) return false;
      seen[x] = true;
      return true;
    });
  }

  function apiUrl() {
    var u = "";
    try { if (typeof window.getSiteApiUrl === "function") u = window.getSiteApiUrl() || ""; } catch (e) {}
    if (!u && window.MA_AUTH_CONFIG && window.MA_AUTH_CONFIG.apiUrl) u = window.MA_AUTH_CONFIG.apiUrl;
    return String(u || "");
  }
  function isLiveHost() {
    var h = String(location.hostname || "").toLowerCase();
    return h === "muslimabaya.com" || h === "www.muslimabaya.com";
  }
  function newEventId() {
    return "order_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- totals ---------- */
  function totals() {
    var qty = state.qty;
    var unit = parseInt(state.line.price, 10) || 0;
    var subtotal = unit * qty;
    var fee = null;
    if (qty >= FREE_DELIVERY_QTY) fee = 0;
    else if (typeof window.allLinesVirtual === "function" && window.allLinesVirtual([state.line])) fee = 0;
    else if (state.district) fee = state.district.fee === FEE_DHAKA ? FEE_DHAKA : (parseInt(state.district.fee, 10) || FEE_OUTSIDE);
    return { qty: qty, unit: unit, subtotal: subtotal, fee: fee, total: subtotal + (fee || 0) };
  }

  /* ---------- markup ---------- */
  function css() {
    if (document.getElementById("ma-cop-css")) return;
    var s = document.createElement("style");
    s.id = "ma-cop-css";
    s.textContent = [
      ".ma-cop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;font-family:inherit;color:#111}",
      ".ma-cop *{box-sizing:border-box}",
      ".ma-cop__back{position:absolute;inset:0;background:rgba(10,10,10,.55);opacity:0;transition:opacity .22s ease}",
      ".ma-cop__panel{position:relative;width:100%;max-width:560px;max-height:92vh;max-height:92dvh;background:#fff;border-radius:18px 18px 0 0;box-shadow:0 -10px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;transform:translateY(24px);opacity:0;transition:transform .26s cubic-bezier(.2,.8,.2,1),opacity .22s ease}",
      ".ma-cop.is-open .ma-cop__back{opacity:1}.ma-cop.is-open .ma-cop__panel{transform:none;opacity:1}",
      "@media (min-width:700px){.ma-cop{align-items:center;padding:24px}.ma-cop__panel{border-radius:16px;max-height:90vh;transform:translateY(12px) scale(.98)}}",
      "@media (prefers-reduced-motion:reduce){.ma-cop__back,.ma-cop__panel{transition:none}}",
      ".ma-cop__head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid #eee;background:#0e0e0e;color:#fff;border-radius:inherit;border-bottom-left-radius:0;border-bottom-right-radius:0}",
      ".ma-cop__title{margin:0;font-size:17px;font-weight:700;letter-spacing:.2px}.ma-cop__title b{color:#c9a96e;font-weight:700}",
      ".ma-cop__x{appearance:none;border:0;background:rgba(255,255,255,.12);color:#fff;width:36px;height:36px;border-radius:50%;font-size:22px;line-height:36px;cursor:pointer;flex:0 0 auto}",
      ".ma-cop__x:focus-visible,.ma-cop button:focus-visible,.ma-cop a:focus-visible{outline:2px solid #c9a96e;outline-offset:2px}",
      ".ma-cop__body{overflow-y:auto;-webkit-overflow-scrolling:touch;padding:16px 18px 20px;overscroll-behavior:contain}",
      ".ma-cop__item{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid #ece7dd;border-radius:12px;background:#fbfaf7}",
      ".ma-cop__img{width:76px;height:95px;flex:0 0 76px;border-radius:8px;object-fit:cover;background:#f1eee8}",
      ".ma-cop__meta{min-width:0;flex:1}.ma-cop__name{font-weight:700;font-size:15px;line-height:1.35;margin:0 0 4px}",
      ".ma-cop__attr{font-size:13px;color:#555;margin:2px 0}.ma-cop__attr b{color:#222;font-weight:600}",
      ".ma-cop__price{font-weight:700;color:#0e0e0e;margin-top:4px}",
      ".ma-cop__qty{display:flex;align-items:center;gap:10px;margin-top:8px}.ma-cop__qty span{font-size:13px;color:#555}",
      ".ma-cop__step{display:inline-flex;align-items:center;border:1px solid #d9d2c3;border-radius:999px;overflow:hidden;background:#fff}",
      ".ma-cop__step button{appearance:none;border:0;background:transparent;width:38px;height:36px;font-size:20px;cursor:pointer;color:#111}",
      ".ma-cop__step button:disabled{color:#bbb;cursor:not-allowed}.ma-cop__step output{min-width:30px;text-align:center;font-weight:700}",
      ".ma-cop__note{font-size:12px;color:#8a6d3b;margin:6px 0 0}",
      ".ma-cop__sum{margin:14px 0 4px;padding:12px 14px;border-radius:12px;background:#0e0e0e;color:#fff;font-size:14px}",
      ".ma-cop__row{display:flex;justify-content:space-between;gap:12px;padding:3px 0}.ma-cop__row--total{border-top:1px solid rgba(255,255,255,.18);margin-top:6px;padding-top:8px;font-size:16px;font-weight:700}.ma-cop__row--total span:last-child{color:#c9a96e}",
      ".ma-cop__h{font-size:14px;font-weight:700;margin:16px 0 8px;color:#0e0e0e}",
      ".ma-cop__f{margin:0 0 10px}.ma-cop__f label{display:block;font-size:13px;font-weight:600;margin:0 0 5px;color:#222}.ma-cop__f label i{color:#b3261e;font-style:normal}",
      ".ma-cop__f input,.ma-cop__f select,.ma-cop__f textarea{width:100%;font:inherit;font-size:16px;padding:11px 12px;border:1px solid #d6d0c4;border-radius:10px;background:#fff;color:#111}",
      ".ma-cop__f textarea{min-height:72px;resize:vertical}",
      ".ma-cop__f input:focus,.ma-cop__f select:focus,.ma-cop__f textarea:focus{outline:none;border-color:#a8875c;box-shadow:0 0 0 3px rgba(201,169,110,.25)}",
      ".ma-cop__f.is-bad input,.ma-cop__f.is-bad select,.ma-cop__f.is-bad textarea{border-color:#b3261e}",
      ".ma-cop__err{display:none;color:#b3261e;font-size:12.5px;margin-top:4px}.ma-cop__f.is-bad .ma-cop__err{display:block}",
      ".ma-cop__2{display:grid;grid-template-columns:1fr;gap:0 10px}@media (min-width:480px){.ma-cop__2{grid-template-columns:1fr 1fr}}",
      ".ma-cop__pay{display:flex;gap:10px;align-items:center;padding:10px 12px;border:1px solid #e5dccb;border-radius:10px;background:#fbf7ef;font-size:13.5px}",
      ".ma-cop__alert{display:none;margin:10px 0 0;padding:10px 12px;border-radius:10px;background:#fdecea;color:#7f1d1d;font-size:13.5px;line-height:1.45;white-space:pre-line}.ma-cop__alert.is-on{display:block}",
      ".ma-cop__go{appearance:none;border:0;width:100%;margin-top:14px;min-height:54px;border-radius:12px;background:#0e0e0e;color:#fff;font:inherit;font-size:17px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:inset 0 -3px 0 #c9a96e}",
      ".ma-cop__go:disabled{opacity:.75;cursor:progress}",
      ".ma-cop__spin{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:maCopSpin .8s linear infinite;display:none}.ma-cop__go.is-busy .ma-cop__spin{display:inline-block}",
      "@keyframes maCopSpin{to{transform:rotate(360deg)}}",
      ".ma-cop__fine{font-size:12px;color:#777;text-align:center;margin:8px 0 0}",
      ".ma-cop__ok{text-align:center;padding:6px 0 4px}.ma-cop__tick{width:58px;height:58px;border-radius:50%;margin:4px auto 10px;background:#0e0e0e;color:#c9a96e;font-size:30px;line-height:58px}",
      ".ma-cop__oid{display:inline-flex;align-items:center;gap:8px;margin:6px 0 4px;padding:8px 12px;border:1px dashed #a8875c;border-radius:10px;font-weight:700;font-size:16px;letter-spacing:.3px}",
      ".ma-cop__copy{appearance:none;border:1px solid #d6d0c4;background:#fff;border-radius:8px;padding:4px 8px;font:inherit;font-size:12px;cursor:pointer}",
      ".ma-cop__det{text-align:left;margin:14px 0 0;border:1px solid #ece7dd;border-radius:12px;padding:10px 14px;font-size:13.5px;background:#fbfaf7}",
      ".ma-cop__det div{display:flex;justify-content:space-between;gap:14px;padding:4px 0;border-bottom:1px solid #f0ebe1}.ma-cop__det div:last-child{border-bottom:0}.ma-cop__det dt{color:#666;flex:0 0 auto}.ma-cop__det dd{margin:0;text-align:right;font-weight:600;word-break:break-word}",
      ".ma-cop__acts{display:grid;gap:10px;margin-top:16px}",
      ".ma-cop__btn2{display:flex;align-items:center;justify-content:center;gap:8px;min-height:50px;border-radius:12px;font:inherit;font-size:15.5px;font-weight:700;text-decoration:none;cursor:pointer;border:1px solid #0e0e0e;background:#fff;color:#0e0e0e}",
      ".ma-cop__btn2--dark{background:#0e0e0e;color:#fff;box-shadow:inset 0 -3px 0 #c9a96e}",
      ".ma-cop__btn2--wa{border-color:#1f8f4e;color:#1f6e3f}",
      "html.ma-cop-lock,html.ma-cop-lock body{overflow:hidden!important}",
      "html.ma-cop-lock #maChatFab,html.ma-cop-lock #stickyOrderBar{visibility:hidden!important}"
    ].join("");
    document.head.appendChild(s);
  }

  function itemHtml(line) {
    var size = lineSizeLabel(line);
    var color = String(line.colorLabel || line.color || "").trim();
    var meas = measurementText(line);
    var type = String(line.productType || "").trim();
    var img = lineImage(line);
    return "<div class='ma-cop__item'>" +
      (img ? "<img class='ma-cop__img' src='" + esc(img) + "' alt='" + esc(lineBaseName(line)) + "' width='76' height='95' decoding='async'>" : "") +
      "<div class='ma-cop__meta'>" +
      "<p class='ma-cop__name'>" + esc(lineBaseName(line)) + "</p>" +
      (type ? "<p class='ma-cop__attr'>ধরন: <b>" + esc(type) + "</b></p>" : "") +
      (size ? "<p class='ma-cop__attr'>সাইজ: <b>" + esc(size) + "</b></p>" : "") +
      (meas ? "<p class='ma-cop__attr'>মাপ: <b>" + esc(meas) + "</b></p>" : "") +
      (color ? "<p class='ma-cop__attr'>কালার: <b>" + esc(color) + "</b></p>" : "") +
      "<p class='ma-cop__price' data-cop-unit>" + money(line.price) + "</p>" +
      "<div class='ma-cop__qty'><span>পরিমাণ</span><div class='ma-cop__step'>" +
      "<button type='button' data-cop-qty='-1' aria-label='পরিমাণ কমান'>&minus;</button>" +
      "<output data-cop-qtyv aria-live='polite'>1</output>" +
      "<button type='button' data-cop-qty='1' aria-label='পরিমাণ বাড়ান'>+</button>" +
      "</div></div>" +
      "<p class='ma-cop__note' data-cop-stocknote hidden></p>" +
      "</div></div>";
  }

  function formHtml() {
    var opts = districts().map(function (d, i) {
      return "<option value='" + i + "'>" + esc(d.bn) + (d.en ? " (" + esc(d.en) + ")" : "") + "</option>";
    }).join("");
    return "<form class='ma-cop__form' novalidate autocomplete='on'>" +
      "<div class='ma-cop__sum' aria-live='polite'>" +
      "<div class='ma-cop__row'><span>সাবটোটাল</span><span data-cop-sub></span></div>" +
      "<div class='ma-cop__row'><span>ডেলিভারি চার্জ</span><span data-cop-fee></span></div>" +
      "<div class='ma-cop__row ma-cop__row--total'><span data-cop-totallabel>সর্বমোট</span><span data-cop-total></span></div>" +
      "</div>" +
      "<p class='ma-cop__fine'>ঢাকা ৳" + FEE_DHAKA + " · ঢাকার বাইরে ৳" + FEE_OUTSIDE + " · " + FREE_DELIVERY_QTY + "টি বা বেশি পণ্যে ফ্রি ডেলিভারি</p>" +
      "<p class='ma-cop__h'>আপনার তথ্য</p>" +
      "<input type='text' name='_hp' tabindex='-1' autocomplete='off' aria-hidden='true' style='position:absolute;left:-9999px;width:1px;height:1px;opacity:0'>" +
      field("name", "আপনার পূর্ণ নাম", true, "<input id='ma-cop-name' name='name' type='text' autocomplete='name' maxlength='80' placeholder='যেমন: ফাতেমা আক্তার'>", "আপনার নাম লিখুন।") +
      field("phone", "মোবাইল নম্বর", true, "<input id='ma-cop-phone' name='phone' type='tel' inputmode='numeric' autocomplete='tel' maxlength='17' placeholder='01XXXXXXXXX'>", "সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন 017XXXXXXXX)।") +
      "<div class='ma-cop__2'>" +
      field("district", "জেলা", true, "<select id='ma-cop-district' name='district'><option value=''>জেলা বাছাই করুন</option>" + opts + "</select>", "জেলা বাছাই করুন।") +
      field("area", "উপজেলা / এলাকা", true, "<select id='ma-cop-area' name='area' disabled><option value=''>আগে জেলা বাছাই করুন</option></select>", "উপজেলা / এলাকা বাছাই করুন।") +
      "</div>" +
      field("address", "পূর্ণ ডেলিভারি ঠিকানা", true, "<textarea id='ma-cop-address' name='address' maxlength='300' autocomplete='street-address' placeholder='বাসা/হোল্ডিং, রোড, গ্রাম/মহল্লা'></textarea>", "পূর্ণ ঠিকানা লিখুন (কমপক্ষে ৮ অক্ষর)।") +
      field("note", "অর্ডার নোট (ঐচ্ছিক)", false, "<textarea id='ma-cop-note' name='note' maxlength='300' placeholder='যেমন: ডেলিভারির আগে কল করবেন'></textarea>", "") +
      "<div class='ma-cop__pay'><span aria-hidden='true'>💵</span><span><b>ক্যাশ অন ডেলিভারি</b> — পণ্য হাতে পেয়ে টাকা দিন</span></div>" +
      "<div class='ma-cop__alert' role='alert' data-cop-alert></div>" +
      "<button type='submit' class='ma-cop__go' data-cop-go><span class='ma-cop__spin' aria-hidden='true'></span><span data-cop-golabel>অর্ডার কনফার্ম করুন</span></button>" +
      "<p class='ma-cop__fine'>অর্ডার করার পর আমরা কল করে কনফার্ম করব। WhatsApp লাগবে না।</p>" +
      "</form>";
  }
  function field(key, label, required, control, err) {
    return "<div class='ma-cop__f' data-cop-f='" + key + "'><label for='ma-cop-" + key + "'>" + esc(label) + (required ? " <i>*</i>" : "") + "</label>" +
      control + (err ? "<div class='ma-cop__err'>" + esc(err) + "</div>" : "") + "</div>";
  }

  /* ---------- rendering ---------- */
  function renderTotals() {
    var t = totals();
    var root = state.root;
    $("[data-cop-qtyv]", root).textContent = String(t.qty);
    $("[data-cop-sub]", root).textContent = money(t.subtotal);
    $("[data-cop-fee]", root).textContent = t.fee === null ? "জেলা বাছাই করুন" : (t.fee === 0 ? "ফ্রি" : money(t.fee));
    $("[data-cop-total]", root).textContent = money(t.total);
    // Before a district is chosen the total has no delivery charge yet: say so, so it is not a surprise later.
    var totalLabel = $("[data-cop-totallabel]", root);
    if (totalLabel) totalLabel.textContent = t.fee === null ? "সর্বমোট (ডেলিভারি চার্জ ছাড়া)" : "সর্বমোট";
    var minus = $("[data-cop-qty='-1']", root);
    var plus = $("[data-cop-qty='1']", root);
    if (minus) minus.disabled = state.busy || t.qty <= 1;
    if (plus) plus.disabled = state.busy || t.qty >= state.maxQty;
    var note = $("[data-cop-stocknote]", root);
    if (note) {
      var showCap = typeof state.stockCap === "number" && t.qty >= state.maxQty;
      note.hidden = !showCap;
      note.textContent = showCap ? "এই সাইজে স্টকে আছে " + state.stockCap + "টি।" : "";
    }
    if (!state.busy) $("[data-cop-golabel]", root).textContent = "অর্ডার কনফার্ম করুন · " + money(t.total);
  }

  function fillAreas() {
    var sel = $("#ma-cop-area", state.root);
    var fWrap = sel.parentNode;
    var list = state.district ? upazilasFor(state.district.bn) : [];
    var existingText = $("#ma-cop-area-text", state.root);
    if (state.district && !list.length) {
      // No upazila list for this district: let the customer type the area.
      sel.style.display = "none";
      sel.disabled = true;
      if (!existingText) {
        var inp = document.createElement("input");
        inp.id = "ma-cop-area-text";
        inp.type = "text";
        inp.maxLength = 80;
        inp.placeholder = "উপজেলা / থানা / এলাকা লিখুন";
        fWrap.insertBefore(inp, sel.nextSibling);
      }
      return;
    }
    if (existingText) existingText.parentNode.removeChild(existingText);
    sel.style.display = "";
    sel.disabled = !state.district;
    sel.innerHTML = "<option value=''>" + (state.district ? "উপজেলা / এলাকা বাছাই করুন" : "আগে জেলা বাছাই করুন") + "</option>" +
      list.map(function (u) { return "<option>" + esc(u) + "</option>"; }).join("");
  }

  function areaValue() {
    var t = $("#ma-cop-area-text", state.root);
    if (t) return t.value.trim();
    return ($("#ma-cop-area", state.root).value || "").trim();
  }

  function setBad(key, bad) {
    var f = $("[data-cop-f='" + key + "']", state.root);
    if (f) f.classList.toggle("is-bad", !!bad);
  }

  function showAlert(msg) {
    var a = $("[data-cop-alert]", state.root);
    if (!a) return;
    a.textContent = msg || "";
    a.classList.toggle("is-on", !!msg);
    if (msg) {
      try { a.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
    }
  }

  function readForm() {
    var r = state.root;
    var phone = normalizeBdPhone($("#ma-cop-phone", r).value);
    return {
      name: $("#ma-cop-name", r).value.replace(/\s+/g, " ").trim(),
      phone: phone,
      district: state.district,
      area: areaValue(),
      address: $("#ma-cop-address", r).value.replace(/\s+/g, " ").trim(),
      note: $("#ma-cop-note", r).value.replace(/\s+/g, " ").trim(),
      hp: ($("input[name='_hp']", r).value || "")
    };
  }

  function validate(v) {
    var bad = {
      name: v.name.length < 2 || v.name.length > 80,
      phone: !isValidBdPhone(v.phone),
      district: !v.district,
      area: !v.area,
      address: v.address.length < 8
    };
    Object.keys(bad).forEach(function (k) { setBad(k, bad[k]); });
    var first = ["name", "phone", "district", "area", "address"].filter(function (k) { return bad[k]; })[0];
    if (first) {
      var el = $("[data-cop-f='" + first + "'] input:not([type=hidden]), [data-cop-f='" + first + "'] select:not([disabled]), [data-cop-f='" + first + "'] textarea", state.root);
      if (el) try { el.focus(); } catch (e) {}
      return false;
    }
    return true;
  }

  /* ---------- order payload (same fields as /checkout) ---------- */
  function buildPayload(v) {
    var line = state.line;
    var t = totals();
    var base = lineBaseName(line);
    var color = String(line.colorLabel || line.color || "").trim();
    var slot = "1. " + base + (color ? " [Color: " + color.replace(/[\[\]\r\n]/g, " ").trim() + "]" : "");
    var fullAddress = v.address;
    if (v.area && fullAddress.toLowerCase().indexOf(v.area.toLowerCase()) === -1) fullAddress += ", " + v.area;
    if (v.district && fullAddress.indexOf(v.district.bn) === -1) fullAddress += ", " + v.district.bn;
    fullAddress = fullAddress.slice(0, 400);
    var fd = new URLSearchParams();
    if (Date.now() - state.openedAt > MAX_SITE_AGE_MS) state.openedAt = Date.now() - 5000;
    fd.append("RecordType", "Order");
    fd.append("SiteTs", String(state.openedAt));
    fd.append("_hp", v.hp);
    fd.append("Name", v.name);
    fd.append("Phone", v.phone);
    fd.append("Address", fullAddress);
    fd.append("District", v.district.bn);
    fd.append("Thana", v.area);
    fd.append("Quantity", String(t.qty));
    fd.append("Design", slot);
    fd.append("Total", String(t.total));
    fd.append("EventID", state.eventId);
    fd.append("EventTime", String(Math.floor(Date.now() / 1000)));
    fd.append("ProductSlotCount", "50");
    fd.append("PaymentMethod", "Cash On Delivery");
    fd.append("PaymentPlan", "Cash On Delivery");
    fd.append("SenderNumber", "");
    fd.append("TransactionID", "");
    fd.append("BankReference", "");
    fd.append("CouponCode", "");
    fd.append("SpecialNotes", v.note ? ("গ্রাহকের নোট: " + v.note) : "");
    fd.append("Product_1", slot);
    for (var i = 2; i <= 50; i++) fd.append("Product_" + i, "");
    var cartJson = [{
      id: String(line.id || "").trim(),
      name: base,
      qty: t.qty,
      price: Number(line.price) || 0,
      size: String(line.size || line.selectedSize || "").trim(),
      color: String(line.color || "").trim(),
      productType: String(line.productType || "").trim(),
      category: String(line.category || "").trim(),
      measurements: Array.isArray(line.measurements) && line.measurements.length
        ? line.measurements.map(function (m) { return { key: m.key, value: m.value }; })
        : undefined
    }];
    fd.append("CartJSON", JSON.stringify(cartJson));
    fd.append("Source", sourceValue());
    var img = lineImage(line);
    fd.append("Image_1", img || "");
    for (var j = 2; j <= 12; j++) fd.append("Image_" + j, "");
    if (typeof window.applyMetaTrackingFields === "function") {
      try {
        var snap = trackingSnapshot();
        var meta = window.applyMetaTrackingFields({
          phone: v.phone, first_name: v.name, event_id: state.eventId, transaction_id: state.eventId,
          value: t.total, currency: "BDT", content_type: "product",
          content_ids: snap.content_ids, contents: snap.contents
        }) || {};
        if (meta.fbc) fd.append("FBC", meta.fbc);
        if (meta.fbp) fd.append("FBP", meta.fbp);
        if (meta.external_id) fd.append("ExternalID", String(meta.external_id));
        if (meta.event_source_url) fd.append("EventSourceUrl", String(meta.event_source_url));
        if (meta.client_user_agent) fd.append("ClientUserAgent", String(meta.client_user_agent));
        if (meta.content_ids && meta.content_ids.length) fd.append("ContentIDs", meta.content_ids.join(","));
      } catch (metaErr) {}
    }
    return fd;
  }

  function sourceValue() {
    try {
      var qp = new URLSearchParams(window.location.search);
      var s = qp.get("utm_source") || qp.get("source") || "";
      if (!s) { try { s = localStorage.getItem("ma_source") || ""; } catch (e) {} }
      if (!s && document.referrer) {
        if (/facebook\.com|fb\.com|instagram\.com/i.test(document.referrer)) s = "Facebook";
        else if (/tiktok\.com/i.test(document.referrer)) s = "TikTok";
      }
      return s;
    } catch (e2) { return ""; }
  }

  function trackingLine() {
    return Object.assign({}, state.line, { quantity: state.qty });
  }
  function trackingSnapshot() {
    if (typeof window.buildCartTrackingSnapshot === "function") {
      try { return window.buildCartTrackingSnapshot([trackingLine()]); } catch (e) {}
    }
    return { content_ids: [String(state.line.id || "")], contents: [], value: totals().total, currency: "BDT" };
  }

  /* ---------- sending ---------- */
  function postEdge(fd) {
    if (!isLiveHost()) return Promise.reject(new Error("EDGE_NOT_AVAILABLE"));
    var body = new FormData();
    fd.forEach(function (value, key) { body.append(key, value); });
    body.append("_ma_target", apiUrl());
    return fetch("/_ma/order", { method: "POST", body: body, credentials: "same-origin", cache: "no-store" })
      .then(function (res) {
        return res.text().then(function (text) {
          var t = String(text || "").trim();
          if (t.indexOf("Success") === 0 || t.indexOf("Error|") === 0) return t;
          throw new Error("EDGE_UNAVAILABLE");
        });
      });
  }
  function postDirect(fd) {
    var url = apiUrl();
    if (!url) return Promise.reject(new Error("NO_API_URL"));
    return fetch(url, { method: "POST", body: fd, mode: "cors", credentials: "omit", cache: "no-store" })
      .then(function (res) { return res.text(); })
      .then(function (text) { return String(text || "").trim(); });
  }
  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error("TIMEOUT")); }, ms);
      promise.then(function (v) { clearTimeout(timer); resolve(v); }, function (e) { clearTimeout(timer); reject(e); });
    });
  }

  function setBusy(on) {
    state.busy = on;
    var go = $("[data-cop-go]", state.root);
    if (go) {
      go.disabled = on;
      go.classList.toggle("is-busy", on);
      go.setAttribute("aria-busy", on ? "true" : "false");
    }
    if (on) $("[data-cop-golabel]", state.root).textContent = "অর্ডার পাঠানো হচ্ছে…";
    Array.prototype.forEach.call(state.root.querySelectorAll(".ma-cop__form input, .ma-cop__form select, .ma-cop__form textarea"), function (el) {
      if (el.name === "_hp") return;
      el.readOnly = on;
    });
    renderTotals();
  }

  function submit(ev) {
    if (ev) ev.preventDefault();
    if (!state || state.busy || state.done) return;
    showAlert("");
    var v = readForm();
    if (!validate(v)) return;
    var t = totals();
    if (t.total < 100) { showAlert("ন্যূনতম অর্ডার ৳১০০।"); return; }
    // Same attempt keeps its EventID (a retry after a lost answer returns the saved order);
    // a changed order (qty / details) is a new attempt.
    var sig = [t.qty, v.phone, v.district.bn, v.area, v.address, v.note].join("|");
    if (!state.eventId || state.attemptSig !== sig) {
      state.eventId = newEventId();
      state.attemptSig = sig;
    }
    var fd = buildPayload(v);
    setBusy(true);
    withTimeout(postEdge(fd).catch(function () { return postDirect(fd); }), 45000)
      .then(function (text) {
        if (text.indexOf("Success") === 0) {
          var oid = text.indexOf("|") !== -1 ? text.split("|")[1].trim() : "";
          onSuccess(v, oid);
          return;
        }
        var msg = text.indexOf("Error|") === 0 ? text.slice(6).trim() : "অর্ডার সেভ করা যায়নি। আবার চেষ্টা করুন।";
        if (/দাম নতুন করে যাচাই/.test(msg)) {
          msg += "\nপেজটি রিফ্রেশ করে আবার অর্ডার করুন।";
        }
        setBusy(false);
        showAlert(msg);
      })
      .catch(function () {
        setBusy(false);
        var offline = typeof navigator !== "undefined" && navigator.onLine === false;
        showAlert(offline
          ? "ইন্টারনেট সংযোগ নেই। সংযোগ ঠিক হলে আবার \"অর্ডার কনফার্ম করুন\" চাপুন — একই অর্ডার দুবার হবে না।"
          : "সার্ভারে পৌঁছানো যায়নি। কিছুক্ষণ পর আবার \"অর্ডার কনফার্ম করুন\" চাপুন — একই অর্ডার দুবার হবে না।");
      });
  }

  function onSuccess(v, orderId) {
    state.done = true;
    state.busy = false;
    var t = totals();
    var line = state.line;
    var shownId = orderId || state.eventId.replace(/^order_/, "");
    try { sessionStorage.setItem("ma_last_order_id", shownId); } catch (e) {}
    // Analytics: same events as the checkout page (Purchase itself is sent by the server on Confirmed).
    try {
      var snap = trackingSnapshot();
      if (typeof window.saveOrderTracking === "function") {
        window.saveOrderTracking(Object.assign({}, snap, {
          first_name: v.name, phone: v.phone, order_value: t.total, value: t.total,
          content_type: "product", order_items: lineBaseName(line),
          transaction_id: state.eventId, event_id: state.eventId, currency: "BDT"
        }));
      }
      if (typeof window.pushPurchaseCompleteEvent === "function") {
        window.pushPurchaseCompleteEvent({ transaction_id: state.eventId, event_id: state.eventId });
      }
    } catch (trackErr) {}
    if (typeof state.onOrdered === "function") {
      try { state.onOrdered({ orderId: shownId, line: line, qty: t.qty }); } catch (cbErr) {}
    }

    var size = lineSizeLabel(line);
    var color = String(line.colorLabel || line.color || "").trim();
    var meas = measurementText(line);
    var addr = v.address + (v.area ? ", " + v.area : "") + ", " + v.district.bn;
    var waText = [
      "আসসালামু আলাইকুম, আমি ওয়েবসাইটে অর্ডার করেছি।",
      "অর্ডার আইডি: " + shownId,
      "পণ্য: " + lineBaseName(line),
      size ? "সাইজ: " + size : "",
      meas ? "মাপ: " + meas : "",
      color ? "কালার: " + color : "",
      "পরিমাণ: " + t.qty,
      "সর্বমোট: " + money(t.total),
      "নাম: " + v.name,
      "মোবাইল: " + v.phone,
      "ঠিকানা: " + addr
    ].filter(Boolean).join("\n");
    var rows = [
      ["অর্ডার আইডি", shownId],
      ["পণ্য", lineBaseName(line)],
      size ? ["সাইজ", size] : null,
      meas ? ["মাপ", meas] : null,
      color ? ["কালার", color] : null,
      ["পরিমাণ", String(t.qty)],
      ["সাবটোটাল", money(t.subtotal)],
      ["ডেলিভারি চার্জ", t.fee ? money(t.fee) : "ফ্রি"],
      ["সর্বমোট (ক্যাশ অন ডেলিভারি)", money(t.total)],
      ["নাম", v.name],
      ["মোবাইল", v.phone],
      ["ঠিকানা", addr],
      v.note ? ["নোট", v.note] : null
    ].filter(Boolean);
    var body = $(".ma-cop__body", state.root);
    body.innerHTML =
      "<div class='ma-cop__ok' data-cop-success>" +
      "<div class='ma-cop__tick' aria-hidden='true'>✓</div>" +
      "<h3 style='margin:0 0 4px;font-size:19px'>অর্ডার সফল হয়েছে</h3>" +
      "<p style='margin:0;color:#555;font-size:14px'>ধন্যবাদ! আমাদের টিম শীঘ্রই কল করে অর্ডার কনফার্ম করবে।</p>" +
      "<div class='ma-cop__oid'><span data-cop-oid>" + esc(shownId) + "</span><button type='button' class='ma-cop__copy' data-cop-copy>কপি</button></div>" +
      "<dl class='ma-cop__det'>" + rows.map(function (r) { return "<div><dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd></div>"; }).join("") + "</dl>" +
      (typeof window.orderNotesHtml === "function" && typeof window.orderNotesForLines === "function" ? window.orderNotesHtml(window.orderNotesForLines([line])) : "") +
      "<div class='ma-cop__acts'>" +
      "<button type='button' class='ma-cop__btn2 ma-cop__btn2--dark' data-cop-close>কেনাকাটা চালিয়ে যান</button>" +
      "<a class='ma-cop__btn2 ma-cop__btn2--wa' data-cop-wa target='_blank' rel='noopener' href='https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(waText) + "'>WhatsApp-এ অর্ডারের বিবরণ পাঠান (ঐচ্ছিক)</a>" +
      "</div></div>";
    $(".ma-cop__title", state.root).innerHTML = "<b>✓</b> অর্ডার সম্পন্ন";
    body.scrollTop = 0;
    var first = $("[data-cop-close]", body);
    if (first) try { first.focus(); } catch (e) {}
  }

  /* ---------- open / close ---------- */
  function onKey(e) {
    if (!state) return;
    if (e.key === "Escape") {
      if (!state.busy) close();
      return;
    }
    if (e.key !== "Tab") return;
    var f = state.root.querySelectorAll("button:not([disabled]), a[href], input:not([type=hidden]):not([name=_hp]):not([disabled]), select:not([disabled]), textarea");
    var list = Array.prototype.filter.call(f, function (el) { return el.offsetParent !== null; });
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function onClick(e) {
    var t = e.target;
    if (t.closest("[data-cop-close]") || t.classList.contains("ma-cop__back")) {
      if (!state.busy) close();
      return;
    }
    var q = t.closest("[data-cop-qty]");
    if (q && !state.busy && !state.done) {
      var next = state.qty + parseInt(q.getAttribute("data-cop-qty"), 10);
      state.qty = Math.max(1, Math.min(state.maxQty, next));
      renderTotals();
      return;
    }
    var c = t.closest("[data-cop-copy]");
    if (c) {
      var id = ($("[data-cop-oid]", state.root) || {}).textContent || "";
      try {
        navigator.clipboard.writeText(id).then(function () { c.textContent = "কপি হয়েছে"; });
      } catch (err) { c.textContent = id; }
    }
  }

  function fireInitiateCheckoutOnce() {
    if (!state || state.icFired) return;
    state.icFired = true;
    if (typeof window.pushTrackingEvent === "function") {
      try { window.pushTrackingEvent("InitiateCheckout", trackingSnapshot()); } catch (e) {}
    }
  }

  function open(line, opts) {
    if (!line || !line.id) return false;
    opts = opts || {};
    if (state) close(true);
    css();
    lastFocus = document.activeElement;
    var cap = typeof opts.stockCap === "number" && opts.stockCap >= 0 ? Math.floor(opts.stockCap) : null;
    if (cap === 0) return false;
    var maxQty = cap === null ? MAX_QTY_DEFAULT : Math.max(1, Math.min(MAX_QTY_DEFAULT, cap));
    var root = document.createElement("div");
    root.className = "ma-cop";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "ma-cop-title");
    root.innerHTML =
      "<div class='ma-cop__back' data-cop-close></div>" +
      "<div class='ma-cop__panel'>" +
      "<div class='ma-cop__head'><h2 class='ma-cop__title' id='ma-cop-title'>অর্ডার <b>করুন</b></h2>" +
      "<button type='button' class='ma-cop__x' data-cop-close aria-label='বন্ধ করুন'>&times;</button></div>" +
      "<div class='ma-cop__body'>" + itemHtml(line) + formHtml() + "</div>" +
      "</div>";
    state = {
      root: root,
      line: Object.assign({}, line),
      qty: Math.max(1, Math.min(maxQty, parseInt(line.quantity, 10) || 1)),
      maxQty: maxQty,
      stockCap: cap,
      district: null,
      busy: false,
      done: false,
      eventId: "",
      attemptSig: "",
      openedAt: Date.now(),
      onOrdered: opts.onOrdered
    };
    document.body.appendChild(root);
    document.documentElement.classList.add("ma-cop-lock");
    root.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey, true);
    var form = $(".ma-cop__form", root);
    form.addEventListener("submit", submit);
    form.addEventListener("focusin", fireInitiateCheckoutOnce);
    $("#ma-cop-district", root).addEventListener("change", function () {
      var i = this.value === "" ? -1 : parseInt(this.value, 10);
      state.district = i >= 0 ? districts()[i] || null : null;
      setBad("district", false);
      fillAreas();
      renderTotals();
    });
    form.addEventListener("input", function (e) {
      var f = e.target.closest("[data-cop-f]");
      if (f) f.classList.remove("is-bad");
    });
    $("#ma-cop-phone", root).addEventListener("blur", function () {
      var p = normalizeBdPhone(this.value);
      if (p && isValidBdPhone(p)) this.value = p;
      if (this.value) setBad("phone", !isValidBdPhone(p));
    });
    renderTotals();
    // Next frame: start the open animation.
    requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add("is-open"); }); });
    setTimeout(function () {
      var n = $("#ma-cop-name", root);
      if (n && state && state.root === root) try { n.focus({ preventScroll: true }); } catch (e) {}
    }, 60);
    return true;
  }

  function close(immediate) {
    if (!state) return;
    var root = state.root;
    state = null;
    document.removeEventListener("keydown", onKey, true);
    document.documentElement.classList.remove("ma-cop-lock");
    root.classList.remove("is-open");
    setTimeout(function () { if (root.parentNode) root.parentNode.removeChild(root); }, immediate ? 0 : 240);
    if (lastFocus && typeof lastFocus.focus === "function") {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  window.maCheckoutPopup = {
    version: 1,
    open: open,
    close: close,
    isOpen: function () { return !!state; },
    // exposed for tests
    _normalizeBdPhone: normalizeBdPhone,
    _isValidBdPhone: isValidBdPhone
  };
})();
