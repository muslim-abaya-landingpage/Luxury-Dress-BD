/* ==========================================================================
   CUSTOM SIZE — add-on module (Muslim Abaya)
   ---------------------------------------------------------------------
   এই ফাইলটা category-renderer.js এর পরে লোড হবে। এটা মূল ফাইলে কোনো
   পরিবর্তন ছাড়াই কাজ করে — শুধু existing global function গুলোকে wrap
   করে (buildShopCartLineItem, updatePqvPriceDisplay) এবং ক্লিক ইভেন্ট
   শোনে (event delegation)। তাই category-renderer.js আপডেট হলেও এটা
   ভাঙবে না, যতক্ষণ ঐ ফাংশনগুলোর নাম একই থাকে।

   ================= কীভাবে কোনো প্রোডাক্টে এই ফিচার চালু করবেন =================
   category-products.js -এ যে প্রোডাক্টে Custom Size অপশন চান, তার
   sizes অ্যারেতে ঠিক এই স্ট্রিং টুকু যোগ করুন:

       sizes: ["50", "52", "54", "56", "Custom Size"]

   ================= এক্সট্রা চার্জ টেবিল কীভাবে বদলাবেন =================
   নিচের CUSTOM_SIZE_CHARGE_TABLE এডিট করুন। সব ক্যাটাগরিতে এই একই
   টেবিল প্রযোজ্য হবে। কোনো নির্দিষ্ট ক্যাটাগরির জন্য আলাদা টেবিল
   চাইলে CUSTOM_SIZE_CHARGE_TABLE_BY_CATEGORY-তে সেই ক্যাটাগরির key
   (যেমন "abaya", "cover-up", "embroidery", "hijab") বসিয়ে একটা
   অ্যারে দিন — সেটা থাকলে ডিফল্ট টেবিলের বদলে সেটাই ব্যবহার হবে।
   ========================================================================== */
(function () {
  "use strict";

  var CUSTOM_SIZE_VALUE = "Custom Size";

  // ডিফল্ট এক্সট্রা চার্জ টেবিল (আপনার আগের size-data.js থেকে নেওয়া)
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

  // চাইলে নির্দিষ্ট ক্যাটাগরির জন্য আলাদা টেবিল বসান, নাহলে খালি রাখুন
  var CUSTOM_SIZE_CHARGE_TABLE_BY_CATEGORY = {
    // "abaya": [ { length: 57, lengthExtra: 0, width: 47, widthExtra: 0 }, ... ]
  };

  function getChargeTable(categoryKey) {
    return (
      (categoryKey && CUSTOM_SIZE_CHARGE_TABLE_BY_CATEGORY[categoryKey]) ||
      CUSTOM_SIZE_CHARGE_TABLE
    );
  }

  // টেবিলে ঠিক ম্যাচ না পেলে, এন্টার করা মানের নিচের সবচেয়ে কাছের ধাপ ব্যবহার হয়
  function extraFor(table, value, key, extraKey) {
    var v = parseFloat(value);
    if (!v || v <= 0) return 0;
    var rows = table.slice().sort(function (a, b) { return a[key] - b[key]; });
    var extra = 0;
    for (var i = 0; i < rows.length; i++) {
      if (v >= rows[i][key]) extra = rows[i][extraKey];
    }
    return extra;
  }

  function computeExtra(categoryKey, length, width) {
    var table = getChargeTable(categoryKey);
    return extraFor(table, length, "length", "lengthExtra") + extraFor(table, width, "width", "widthExtra");
  }

  function formatTaka(n) {
    return "\u09F3" + (parseInt(n, 10) || 0);
  }

  // idx -> { length, width, sleeve, note, extra, label }
  var customData = {};
  // idx -> প্রথমবার মডাল ব্যবহারের সময়ের আসল (extra যোগ হওয়ার আগের) দাম
  var basePriceByIdx = {};

  /* ---------------- Modal তৈরি ---------------- */

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

  var openIdx = null;
  var openCategoryKey = "";

  function updateExtraPreview() {
    var length = document.getElementById("csmLength").value;
    var width = document.getElementById("csmWidth").value;
    document.getElementById("csmExtra").textContent = formatTaka(computeExtra(openCategoryKey, length, width));
  }

  function openModal(idx, categoryKey) {
    ensureModal();
    openIdx = idx;
    openCategoryKey = categoryKey || "";
    var existing = customData[idx];
    document.getElementById("csmLength").value = existing ? existing.length : "";
    document.getElementById("csmWidth").value = existing ? existing.width : "";
    document.getElementById("csmSleeve").value = existing ? existing.sleeve : "";
    document.getElementById("csmNote").value = existing ? existing.note || "" : "";
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
    var extra = computeExtra(openCategoryKey, length, width);
    var labelParts = ["L:" + length, "W:" + width];
    if (sleeve) labelParts.push("Sleeve:" + sleeve);
    customData[openIdx] = {
      length: length,
      width: width,
      sleeve: sleeve,
      note: note,
      extra: extra,
      label: "Custom (" + labelParts.join(" ") + ")" + (extra ? " +" + formatTaka(extra) : "")
    };
    closeModal();
    refreshPriceDisplay(openIdx);
  }

  /* ---------------- প্রাইস ডিসপ্লে সিঙ্ক ---------------- */

  function refreshPriceDisplay(idx) {
    var priceEl = document.getElementById("pqvPrice");
    if (!priceEl) return;
    var data = customData[idx];
    if (!data) return;
    if (basePriceByIdx[idx] == null) {
      basePriceByIdx[idx] = parseInt(priceEl.getAttribute("data-price"), 10) || 0;
    }
    var newPrice = basePriceByIdx[idx] + (data.extra || 0);
    priceEl.textContent = formatTaka(newPrice);
    priceEl.setAttribute("data-price", newPrice);
    renderSizeHint(idx, data);
  }

  function renderSizeHint(idx, data) {
    var pill = document.querySelector(
      '.pqv-size-opt[data-product-idx="' + idx + '"][data-size-value="' + CUSTOM_SIZE_VALUE + '"]'
    );
    if (!pill || !pill.parentElement) return;
    var hint = pill.parentElement.querySelector(".csm-selected-hint[data-product-idx='" + idx + "']");
    if (!hint) {
      hint = document.createElement("div");
      hint.className = "csm-selected-hint";
      hint.setAttribute("data-product-idx", idx);
      pill.parentElement.appendChild(hint);
    }
    hint.innerHTML = "Your size: " + data.label + ' — <button type="button" class="csm-edit-link">Edit</button>';
    hint.style.display = "";
    hint.querySelector(".csm-edit-link").addEventListener("click", function () {
      openModal(idx, openCategoryKey);
    });
  }

  function hideSizeHint(idx) {
    var hint = document.querySelector(".csm-selected-hint[data-product-idx='" + idx + "']");
    if (hint) hint.style.display = "none";
  }

  /* ---------------- ক্লিক ইভেন্ট ---------------- */

  // "Custom Size" পিলে ক্লিক করলে মডাল খোলে; অন্য সাইজ পিলে গেলে হিন্ট/এক্সট্রা মুছে যায়
  document.addEventListener("click", function (ev) {
    var pill = ev.target.closest(".pqv-size-opt");
    if (!pill) return;
    var idx = pill.getAttribute("data-product-idx");
    var val = pill.getAttribute("data-size-value");
    var categoryKey = (window.getShopCategoryKey && window.getShopCategoryKey()) || "";
    if (val === CUSTOM_SIZE_VALUE) {
      openModal(idx, categoryKey);
    } else {
      hideSizeHint(idx);
      var priceEl = document.getElementById("pqvPrice");
      if (priceEl && basePriceByIdx[idx] != null) {
        priceEl.textContent = formatTaka(basePriceByIdx[idx]);
        priceEl.setAttribute("data-price", basePriceByIdx[idx]);
      }
    }
  });

  // কাস্টম সাইজ সিলেক্ট করা থাকলে, মাপ না দেওয়া পর্যন্ত Add to Cart / Buy Now আটকে
  // মডাল খুলে দেয় (capture phase-এ, যাতে মূল Add-to-cart লজিকের আগেই চেক হয়)
  document.addEventListener(
    "click",
    function (ev) {
      var actionEl = ev.target.closest(
        'button[data-action="add"], button[data-action="buy-now"], .sob-cart, .sob-buy'
      );
      if (!actionEl) return;
      var activePill = document.querySelector(
        '.pqv-size-opt.is-active[data-size-value="' + CUSTOM_SIZE_VALUE + '"]'
      );
      if (!activePill) return;
      var idx = activePill.getAttribute("data-product-idx");
      if (!customData[idx]) {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        var categoryKey = (window.getShopCategoryKey && window.getShopCategoryKey()) || "";
        openModal(idx, categoryKey);
      }
    },
    true
  );

  /* ---------------- কার্ট ইন্টিগ্রেশন ---------------- */

  var originalBuildShopCartLineItem = window.buildShopCartLineItem;
  if (typeof originalBuildShopCartLineItem === "function") {
    window.buildShopCartLineItem = function (item, qtyToAdd, sizeValue, categoryKeyOpt, selectedTypeOpt) {
      var line = originalBuildShopCartLineItem(item, qtyToAdd, sizeValue, categoryKeyOpt, selectedTypeOpt);
      if (sizeValue === CUSTOM_SIZE_VALUE) {
        var activePill = document.querySelector(
          '.pqv-size-opt.is-active[data-size-value="' + CUSTOM_SIZE_VALUE + '"]'
        );
        var idx = activePill ? activePill.getAttribute("data-product-idx") : null;
        var data = idx != null ? customData[idx] : null;
        if (data) {
          line.price = (parseInt(line.price, 10) || 0) + (parseInt(data.extra, 10) || 0);
          line.size = data.label;
          line.customNote = data.note || "";
          line.name = line.name.replace(/\(Size [^)]*\)\s*$/i, "(" + data.label + ")");
        }
      }
      return line;
    };
  }

  // প্রোডাক্ট টাইপ (Full Set / Only ইত্যাদি) বদলালেও কাস্টম এক্সট্রা যেন হারিয়ে না যায়
  var originalUpdatePqvPriceDisplay = window.updatePqvPriceDisplay;
  if (typeof originalUpdatePqvPriceDisplay === "function") {
    window.updatePqvPriceDisplay = function (modal, p, categoryKey, typeLabel) {
      originalUpdatePqvPriceDisplay(modal, p, categoryKey, typeLabel);
      if (!modal) return;
      var activePill = modal.querySelector(
        '.pqv-size-opt.is-active[data-size-value="' + CUSTOM_SIZE_VALUE + '"]'
      );
      if (!activePill) return;
      var idx = activePill.getAttribute("data-product-idx");
      var priceEl = modal.querySelector("#pqvPrice");
      if (priceEl) {
        basePriceByIdx[idx] = parseInt(priceEl.getAttribute("data-price"), 10) || 0;
        refreshPriceDisplay(idx);
      }
    };
  }
})();
