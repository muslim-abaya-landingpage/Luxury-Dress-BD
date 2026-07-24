/* ==========================================================================
   CUSTOM SIZE — add-on module for product.html (single-product page)
   ---------------------------------------------------------------------
   product-page.js নিজের ভেতরেই বন্ধ (IIFE) — তার state/functions বাইরে
   থেকে অ্যাক্সেস করা যায় না। তাই category পেজের custom-size.js এখানে
   কাজ করবে না, এই আলাদা মডিউলটা লাগবে। এটাও কোনো মূল ফাইল এডিট করে না —
   শুধু ২টা জিনিস ব্যবহার করে যেগুলো সত্যিই global/সাধারণ:
     ১) DOM ক্লিক ইভেন্ট (#pdSizeGroup .pd-option-btn, #pdAddCart, #pdBuyNow)
     ২) window.addOrMergeStoreCartItem — যেটা সব পেজে (ক্যাটাগরি + প্রোডাক্ট
        পেজ) কার্টে আইটেম ঢোকানোর একমাত্র জায়গা।

   কাজ করানোর শর্ত: প্রোডাক্টের sizes array-তে (category-products.js)
   "Custom Size" স্ট্রিং থাকতে হবে — ঠিক আগের মতোই।

   এই ফাইল custom-size.css এর সাথে শেয়ার করে (একই #csmOverlay মার্কআপ),
   তাই product.html-এ শুধু custom-size.css + এই ফাইলটা যোগ করলেই চলবে।
   ========================================================================== */
(function () {
  "use strict";

  var CUSTOM_SIZE_VALUE = "Custom Size";

  // এখানেও category-page মডিউলের মতো একই ডিফল্ট টেবিল — বদলাতে চাইলে
  // দুই জায়গাতেই (custom-size.js ও এই ফাইলে) মিলিয়ে বদলান।
  var CUSTOM_SIZE_CHARGE_TABLE = [
    { length: 57, lengthExtra: 0,   width: 47, widthExtra: 0   },
    { length: 58, lengthExtra: 0,   width: 48, widthExtra: 0   },
    { length: 59, lengthExtra: 250, width: 49, widthExtra: 250 },
    { length: 60, lengthExtra: 250, width: 50, widthExtra: 250 },
    { length: 61, lengthExtra: 250, width: 51, widthExtra: 250 },
    { length: 62, lengthExtra: 450, width: 52, widthExtra: 250 },
    { length: 63, lengthExtra: 450, width: 53, widthExtra: 250 },
    { length: 64, lengthExtra: 450, width: 54, widthExtra: 250 },
    { length: 65, lengthExtra: 450, width: 55, widthExtra: 250 },
    { length: 66, lengthExtra: 450, width: 56, widthExtra: 250 },
    { length: 67, lengthExtra: 450, width: 57, widthExtra: 250 },
    { length: 68, lengthExtra: 450, width: 58, widthExtra: 250 }
  ];

  function extraFor(value, key, extraKey) {
    var v = parseFloat(value);
    if (!v || v <= 0) return 0;
    var rows = CUSTOM_SIZE_CHARGE_TABLE.slice().sort(function (a, b) { return a[key] - b[key]; });
    var extra = 0;
    for (var i = 0; i < rows.length; i++) {
      if (v >= rows[i][key]) extra = rows[i][extraKey];
    }
    return extra;
  }

  function computeExtra(length, width) {
    return extraFor(length, "length", "lengthExtra") + extraFor(width, "width", "widthExtra");
  }

  function formatTaka(n) {
    return "\u09F3" + (parseInt(n, 10) || 0);
  }

  // এই পেজে একবারে একটাই প্রোডাক্ট থাকে — তাই idx লাগবে না, একটামাত্র অবজেক্ট
  var customData = null;

  /* ---------------- Modal (category পেজের সাথে একই markup/CSS শেয়ার করে) ---------------- */

  function ensureModal() {
    if (document.getElementById("csmOverlay")) return;
    var el = document.createElement("div");
    el.id = "csmOverlay";
    el.className = "csm-overlay";
    el.innerHTML =
      '<div class="csm-modal" role="dialog" aria-modal="true" aria-label="Custom size">' +
        '<button type="button" class="csm-close" id="csmClose" aria-label="Close">&times;</button>' +
        '<h2>Give Your Preferred Size</h2>' +
        '<p class="csm-subtitle">Price increases based on size (inch)</p>' +
        '<div class="csm-row">' +
          '<div class="csm-field"><label>Length</label><input type="number" min="0" inputmode="decimal" id="csmLength" placeholder="Length"></div>' +
          '<div class="csm-field"><label>Width</label><input type="number" min="0" inputmode="decimal" id="csmWidth" placeholder="Width"></div>' +
          '<div class="csm-field"><label>Sleeve</label><input type="number" min="0" inputmode="decimal" id="csmSleeve" placeholder="Sleeve"></div>' +
        '</div>' +
        '<div class="csm-note"><label>Product Note</label><textarea id="csmNote" placeholder="Write any instruction (optional)"></textarea></div>' +
        '<div class="csm-price">Extra Charge: <strong id="csmExtra">\u09F30</strong></div>' +
        '<div class="csm-buttons"><button type="button" id="csmSave" class="csm-save">Save Size</button></div>' +
        '<p class="csm-hint">Standard range-এর বাইরে গেলে উপরে দেখানো এক্সট্রা চার্জ যোগ হবে। সঠিক মাপ নিশ্চিত করতে অর্ডারের পর আমাদের টিম যোগাযোগ করতে পারে।</p>' +
      "</div>";
    document.body.appendChild(el);

    el.addEventListener("click", function (ev) {
      if (ev.target === el || ev.target.closest("#csmClose")) closeModal();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeModal();
    });
    ["csmLength", "csmWidth"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", updateExtraPreview);
    });
    document.getElementById("csmSave").addEventListener("click", saveCustomSize);
  }

  function updateExtraPreview() {
    var length = document.getElementById("csmLength").value;
    var width = document.getElementById("csmWidth").value;
    document.getElementById("csmExtra").textContent = formatTaka(computeExtra(length, width));
  }

  function openModal() {
    ensureModal();
    document.getElementById("csmLength").value = customData ? customData.length : "";
    document.getElementById("csmWidth").value = customData ? customData.width : "";
    document.getElementById("csmSleeve").value = customData ? customData.sleeve : "";
    document.getElementById("csmNote").value = customData ? customData.note || "" : "";
    updateExtraPreview();
    document.getElementById("csmOverlay").classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    var overlay = document.getElementById("csmOverlay");
    if (overlay) overlay.classList.remove("active");
    document.body.style.overflow = "";
  }

  function saveCustomSize() {
    var length = document.getElementById("csmLength").value;
    var width = document.getElementById("csmWidth").value;
    var sleeve = document.getElementById("csmSleeve").value;
    var note = document.getElementById("csmNote").value.trim();
    if (!length || !width) {
      alert("Please enter both Length and Width.");
      return;
    }
    var extra = computeExtra(length, width);
    var labelParts = ["L:" + length, "W:" + width];
    if (sleeve) labelParts.push("Sleeve:" + sleeve);
    customData = {
      length: length,
      width: width,
      sleeve: sleeve,
      note: note,
      extra: extra,
      label: "Custom (" + labelParts.join(" ") + ")" + (extra ? " +" + formatTaka(extra) : "")
    };
    closeModal();
    renderExtraChargeLine();
    renderSizeHint();
  }

  /* ---------------- এক্সট্রা চার্জ লাইন (pdPrice এর ভেতরের HTML রিরাইট না করে, পাশে আলাদা লাইন) ---------------- */

  function ensureExtraChargeEl() {
    var priceEl = document.getElementById("pdPrice");
    if (!priceEl) return null;
    var extraEl = document.getElementById("csmPdExtraLine");
    if (!extraEl) {
      extraEl = document.createElement("div");
      extraEl.id = "csmPdExtraLine";
      extraEl.className = "csm-pd-extra-line";
      priceEl.insertAdjacentElement("afterend", extraEl);
    }
    return extraEl;
  }

  function renderExtraChargeLine() {
    var extraEl = ensureExtraChargeEl();
    if (!extraEl) return;
    if (customData && customData.extra) {
      extraEl.textContent = "Custom Size Extra Charge: " + formatTaka(customData.extra);
      extraEl.style.display = "";
    } else if (customData) {
      extraEl.textContent = "Custom Size selected (no extra charge)";
      extraEl.style.display = "";
    } else {
      extraEl.style.display = "none";
    }
  }

  function hideExtraChargeLine() {
    var extraEl = document.getElementById("csmPdExtraLine");
    if (extraEl) extraEl.style.display = "none";
  }

  /* ---------------- সিলেক্টেড সাইজের হিন্ট (Edit লিংকসহ) ---------------- */

  function renderSizeHint() {
    var group = document.getElementById("pdSizeGroup");
    if (!group) return;
    var hint = group.querySelector(".csm-selected-hint");
    if (!customData) {
      if (hint) hint.style.display = "none";
      return;
    }
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "csm-selected-hint";
      group.appendChild(hint);
    }
    hint.innerHTML = "Your size: " + customData.label + ' — <button type="button" class="csm-edit-link">Edit</button>';
    hint.style.display = "";
    hint.querySelector(".csm-edit-link").addEventListener("click", function () {
      openModal();
    });
  }

  /* ---------------- ক্লিক ইভেন্ট ---------------- */

  document.addEventListener(
    "click",
    function (ev) {
      var btn = ev.target.closest("#pdSizeGroup .pd-option-btn");
      if (!btn) return;
      if (btn.getAttribute("data-val") === CUSTOM_SIZE_VALUE) {
        openModal();
      } else {
        customData = null;
        hideExtraChargeLine();
        renderSizeHint();
      }
    },
    true
  );

  // মাপ না দেওয়া পর্যন্ত Add to Cart / Buy Now আটকায় (capture phase-এ, product-page.js
  // এর নিজস্ব ক্লিক হ্যান্ডলারের আগেই চলে)
  document.addEventListener(
    "click",
    function (ev) {
      var actionEl = ev.target.closest("#pdAddCart, #pdBuyNow");
      if (!actionEl) return;
      var activeBtn = document.querySelector("#pdSizeGroup .pd-option-btn.is-active");
      if (!activeBtn || activeBtn.getAttribute("data-val") !== CUSTOM_SIZE_VALUE) return;
      if (!customData) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        openModal();
      }
    },
    true
  );

  /* ---------------- কার্ট ইন্টিগ্রেশন (এই পেজের একমাত্র কার্ট-এন্ট্রি পয়েন্ট) ---------------- */

  var originalAddOrMerge = window.addOrMergeStoreCartItem;
  if (typeof originalAddOrMerge === "function") {
    window.addOrMergeStoreCartItem = function (existing, line) {
      if (line && line.size === CUSTOM_SIZE_VALUE && customData) {
        line.price = (parseInt(line.price, 10) || 0) + (parseInt(customData.extra, 10) || 0);
        line.size = customData.label;
        line.customNote = customData.note || "";
      }
      return originalAddOrMerge(existing, line);
    };
  }
})();
