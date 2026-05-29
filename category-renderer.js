function ensureCategoryStyles() {
  var link =
    document.getElementById("category-sidebar-css") ||
    document.querySelector('link[href*="category-sidebar.css"]');
  if (!link) {
    link = document.createElement("link");
    link.id = "category-sidebar-css";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
  link.href = "category-sidebar.css?v=20260616";
}

function markCategoryReady() {
  document.documentElement.classList.add("category-ready");
}

function shopHref(route) {
  if (typeof window.siteHref === "function") return window.siteHref(route);
  var r = String(route || "/").split("?")[0];
  var query =
    String(route || "").indexOf("?") >= 0
      ? "?" + String(route).split("?").slice(1).join("?")
      : "";
  if (!r || r === "/") {
    if (typeof window !== "undefined" && window.location && window.location.protocol !== "file:")
      return "/" + query;
    return "index.html" + query;
  }
  if (r.charAt(0) === "/") r = r.slice(1);
  if (!/\.html?$/i.test(r)) r += ".html";
  return r + query;
}

function fixShopPageLinks(root) {
  if (!root) return;
  root.querySelectorAll("a[href]").forEach(function (a) {
    var href = a.getAttribute("href") || "";
    if (
      !href ||
      href.indexOf("http") === 0 ||
      href.indexOf("mailto:") === 0 ||
      href.indexOf("tel:") === 0 ||
      href.indexOf("#") === 0
    )
      return;
    if (href.charAt(0) === "/" || /^\/[A-Za-z]:/.test(href)) {
      a.setAttribute("href", shopHref(href));
    }
  });
}

var shopCartCtx = {
  root: null,
  products: [],
  gridHtml: null,
  gridClassName: "",
  lastCartAddKey: "",
  lastCartAddAt: 0
};

function getActivePqvScope() {
  var root = shopCartCtx.root;
  if (root && root.querySelector(".pqv-anzaar")) return root;
  var modal = document.getElementById("productQuickView");
  if (modal && !modal.hidden) return modal;
  return null;
}

function syncShopCartBadge() {
  if (typeof syncCartBadgeFromStore === "function") {
    syncCartBadgeFromStore();
    return;
  }
  var lines = typeof loadStoreCart === "function" ? loadStoreCart({ readOnly: true }) : [];
  if (typeof refreshCartBadgeUI === "function") refreshCartBadgeUI(lines);
  else if (typeof updateCartBadge === "function") updateCartBadge(lines);
}

function shopAddProductToCart(item, qtyToAdd, sizeValue) {
  var pickedSizeEarly = sizeValue || "50";
  var addGuardKey = (item.id || item.name || "") + "|" + pickedSizeEarly;
  var now = Date.now();
  if (addGuardKey === shopCartCtx.lastCartAddKey && now - shopCartCtx.lastCartAddAt < 450) return;
  shopCartCtx.lastCartAddKey = addGuardKey;
  shopCartCtx.lastCartAddAt = now;

  var cat = typeof findCatalogByName === "function" ? findCatalogByName(item.name) : null;
  var pickedSize = sizeValue || "50";
  var categoryKey =
    (document.body && document.body.getAttribute("data-shop-category")) || "";
  var pickedType = item._cartType || "";
  var unitPrice = resolveProductPrice(item, categoryKey, pickedType);
  var cartName = item.name;
  if (pickedType) cartName += " (" + pickedType + ")";
  cartName += " (Size " + pickedSize + ")";

  var line = {
    id: item.id || (cat ? cat.id : ""),
    name: cartName,
    price: unitPrice,
    quantity: parseInt(qtyToAdd, 10) || 1,
    image: item.image || (cat && cat.image) || "",
    color: item.color || "",
    colorLabel: item.colorLabel || "",
    fabric: item.fabric || "",
    description: item.description || item.fabric || "",
    size: pickedSize,
    productType: item._cartType || ""
  };

  var updated = [];
  if (typeof addOrMergeStoreCartItem === "function") {
    updated = addOrMergeStoreCartItem(typeof loadStoreCart === "function" ? loadStoreCart() : [], line);
  }
  if (typeof afterCartMutation === "function") afterCartMutation(updated);

  if (typeof pushTrackingEvent === "function") {
    pushTrackingEvent("AddToCart", {
      content_ids: [line.id || item.name],
      content_name: item.name,
      value: line.price,
      currency: "BDT",
      quantity: line.quantity
    });
  }

  var msg = document.getElementById("cartMiniMsg");
  if (msg) {
    msg.classList.add("show");
    setTimeout(function () {
      msg.classList.remove("show");
    }, 1400);
  }
}

function resetShopCartContext() {
  shopCartCtx.root = null;
  shopCartCtx.products = [];
}

function getSelectedSizeForIdx(scopeRoot, idx) {
  if (!scopeRoot) return "50";
  var activePill = scopeRoot.querySelector(
    ".pqv-size-opt.is-active[data-product-idx='" + idx + "']"
  );
  if (activePill) return activePill.getAttribute("data-size-value") || "50";
  var sizeEl = scopeRoot.querySelector("[data-size-idx='" + idx + "']");
  return sizeEl ? sizeEl.value : "50";
}

function toAsciiDigits(str) {
  return String(str || "").replace(/[০-৯]/g, function (d) {
    return String.fromCharCode(d.charCodeAt(0) - 2534 + 48);
  });
}

function parsePqvQtyValue(raw) {
  var digits = toAsciiDigits(raw).replace(/\D/g, "");
  var n = parseInt(digits, 10);
  if (!n || n < 1) return 1;
  if (n > 99) return 99;
  return n;
}

function setPqvQtyInput(el, n) {
  if (!el) return;
  el.value = String(parsePqvQtyValue(n));
}

function getPqvQuantity(modal) {
  if (!modal) return 1;
  var qtyEl = modal.querySelector("#pqvQty");
  return parsePqvQtyValue(qtyEl ? qtyEl.value : 1);
}

function getSelectedTypeForIdx(scopeRoot, idx) {
  if (!scopeRoot) return "";
  var activePill = scopeRoot.querySelector(
    ".pqv-type-opt.is-active[data-product-idx='" + idx + "']"
  );
  return activePill ? activePill.getAttribute("data-type-value") || "" : "";
}

function getProductBaseName(name) {
  return String(name || "")
    .trim()
    .replace(/\s*[-–]\s*(back|side|front|detail|view\s*\d*)\s*$/i, "")
    .replace(/\.{2,}.*$/, "")
    .replace(/\s*\.\s*$/, "")
    .trim();
}

function getProductTypes(p, categoryKey) {
  if (Array.isArray(p.types) && p.types.length) return p.types;
  var defs =
    window.SITE_LINKS &&
    window.SITE_LINKS.defaults &&
    window.SITE_LINKS.defaults.byCategory;
  var cat = defs && categoryKey && defs[categoryKey];
  if (cat && Array.isArray(cat.types) && cat.types.length) return cat.types;
  return [];
}

function getCategoryDefaults(categoryKey) {
  var defs =
    window.SITE_LINKS && window.SITE_LINKS.defaults && window.SITE_LINKS.defaults.byCategory;
  return (defs && categoryKey && defs[categoryKey]) || null;
}

function getProductPriceByTypeMap(p, categoryKey) {
  if (p && p.priceByType && typeof p.priceByType === "object") return p.priceByType;
  var cat = getCategoryDefaults(categoryKey);
  if (cat && cat.priceByType) return cat.priceByType;
  return null;
}

function getDefaultProductType(p, categoryKey) {
  var types = getProductTypes(p, categoryKey);
  return types.length ? types[0] : "";
}

function resolveProductPrice(p, categoryKey, typeLabel) {
  var map = getProductPriceByTypeMap(p, categoryKey);
  var type = typeLabel || getDefaultProductType(p, categoryKey);
  if (map && type && map[type] != null) return parseInt(map[type], 10) || 0;
  var base = parseInt(p && p.price, 10) || 550;
  var types = getProductTypes(p, categoryKey);
  if (types.length > 1 && type) {
    var cat = getCategoryDefaults(categoryKey);
    var gap = (cat && cat.typePriceGap) || 200;
    if (/full\s*set/i.test(type)) return base + gap;
    if (/only|abaya|top|bottom|cover/i.test(type)) return base;
  }
  return base;
}

function formatBdtPrice(amount) {
  return "\u09F3 " + (parseInt(amount, 10) || 0);
}

var PQV_SIZE_LABELS = {
  "50": "Small - 50",
  "52": "Medium - 52",
  "54": "Large - 54",
  "56": "Extra Large - 56",
  "Custom Size": "Custom Size"
};

function formatSizeLabel(size) {
  var s = String(size || "").trim();
  return PQV_SIZE_LABELS[s] || s;
}

function getProductShortNote(p, categoryKey) {
  if (p && p.shortNote) return String(p.shortNote);
  var notes =
    window.SITE_LINKS &&
    window.SITE_LINKS.productShortNotes;
  if (notes && categoryKey && Object.prototype.hasOwnProperty.call(notes, categoryKey)) {
    return notes[categoryKey];
  }
  if (notes && notes.default) return notes.default;
  return "* ছবিতে রং সামান্য পার্থক্য হতে পারে। লাইটিংয়ের কারণে প্রকৃত রং একটু আলাদা দেখাতে পারে।";
}

function formatCardPriceText(p, categoryKey) {
  var types = getProductTypes(p, categoryKey);
  if (types.length <= 1) {
    return "\u09F3" + resolveProductPrice(p, categoryKey, "");
  }
  var prices = types.map(function (t) {
    return resolveProductPrice(p, categoryKey, t);
  });
  var min = Math.min.apply(null, prices);
  var max = Math.max.apply(null, prices);
  if (min === max) return "\u09F3" + min;
  return "\u09F3" + min + " – " + max;
}

function updatePqvPriceDisplay(modal, p, categoryKey, typeLabel) {
  if (!modal || !p) return;
  var el = modal.querySelector("#pqvPrice");
  if (!el) return;
  var price = resolveProductPrice(p, categoryKey, typeLabel);
  el.textContent = formatBdtPrice(price);
  el.setAttribute("data-price", String(price));
}

function getSizeChartUrl(categoryKey) {
  var cfg = (window.SITE_LINKS && window.SITE_LINKS.sizeChart) || {};
  var raw =
    (cfg.byCategory && categoryKey && cfg.byCategory[categoryKey]) || cfg.default || "";
  if (!raw) return "";
  if (window.maCatalog && typeof window.maCatalog.resolveImageUrl === "function") {
    return window.maCatalog.resolveImageUrl(raw);
  }
  return raw;
}

function collectGalleryImages(product, allProducts) {
  if (Array.isArray(product.images) && product.images.length) {
    return product.images
      .map(function (u) {
        return resolveCardImageSrc({ image: u });
      })
      .filter(Boolean);
  }
  var main = resolveCardImageSrc(product);
  if (!allProducts || !allProducts.length) return main ? [main] : [];

  var base = getProductBaseName(product.name);
  var colorKey = String(product.color || product.colorLabel || "").toLowerCase();
  var related = [];
  var seen = {};

  allProducts.forEach(function (p) {
    if (getProductBaseName(p.name) !== base) return;
    var pColor = String(p.color || p.colorLabel || "").toLowerCase();
    if (colorKey && pColor && pColor !== colorKey) return;
    var src = resolveCardImageSrc(p);
    if (!src || seen[src]) return;
    seen[src] = true;
    related.push({ src: src, name: p.name || "" });
  });

  if (related.length <= 1) return main ? [main] : [];

  related.sort(function (a, b) {
    var rank = function (name) {
      var n = String(name).toLowerCase();
      if (n.indexOf("back") !== -1) return 2;
      if (n.indexOf("side") !== -1) return 3;
      if (n.indexOf("front") !== -1) return 1;
      return 0;
    };
    return rank(a.name) - rank(b.name);
  });

  var urls = related.map(function (r) {
    return r.src;
  });
  if (main && urls.indexOf(main) === -1) urls.unshift(main);
  return urls;
}

function buildPqvThumbsHtml(images, altText) {
  return images
    .map(function (src, i) {
      var esc = escapeHtml(src);
      return (
        '<button type="button" class="pqv-thumb' +
        (i === 0 ? " is-active" : "") +
        '" data-src="' +
        esc +
        '"><img src="' +
        esc +
        '" alt="' +
        escapeHtml(altText || "") +
        '"></button>'
      );
    })
    .join("");
}

function buildPqvOptionPills(items, idx, extraClass, valueAttr, formatLabel) {
  var attr = valueAttr || "data-size-value";
  var labelFn = typeof formatLabel === "function" ? formatLabel : function (v) {
    return v;
  };
  return items
    .map(function (label, i) {
      var val = String(label);
      return (
        '<button type="button" class="pqv-opt-btn ' +
        (extraClass || "") +
        (i === 0 ? " is-active" : "") +
        '" data-product-idx="' +
        idx +
        '" ' +
        attr +
        '="' +
        escapeHtml(val) +
        '" aria-pressed="' +
        (i === 0 ? "true" : "false") +
        '">' +
        escapeHtml(labelFn(val)) +
        "</button>"
      );
    })
    .join("");
}

function buildPqvTypePills(types, idx, p, categoryKey) {
  return types
    .map(function (label, i) {
      var val = String(label);
      var typePrice = resolveProductPrice(p, categoryKey, val);
      return (
        '<button type="button" class="pqv-opt-btn pqv-type-opt' +
        (i === 0 ? " is-active" : "") +
        '" data-product-idx="' +
        idx +
        '" data-type-value="' +
        escapeHtml(val) +
        '" data-type-price="' +
        typePrice +
        '" aria-pressed="' +
        (i === 0 ? "true" : "false") +
        '">' +
        escapeHtml(val) +
        "</button>"
      );
    })
    .join("");
}

function getProductDescriptionHtml(p, categoryKey) {
  if (p && p.descriptionHtml) return p.descriptionHtml;
  var notes =
    window.SITE_LINKS && window.SITE_LINKS.productNotes && window.SITE_LINKS.productNotes[categoryKey];
  if (notes) return notes;
  if (window.SITE_LINKS && window.SITE_LINKS.productNotes && window.SITE_LINKS.productNotes.default) {
    return window.SITE_LINKS.productNotes.default;
  }
  return (
    "<p><strong>" +
    escapeHtml(p.name) +
    "</strong> — " +
    escapeHtml(p.fabric || "") +
    "। প্রিমিয়াম মুসলিম ফ্যাশন, বাংলাদেশ জুড়ে ডেলিভারি।</p>"
  );
}

function buildPqvRelatedHtml(p, idx, allProducts, categoryKey) {
  if (!allProducts || !allProducts.length) return "";
  var myBase = getProductBaseName(p.name);
  var picked = [];
  var seen = {};

  allProducts.forEach(function (rp, ri) {
    if (ri === idx || !rp || !rp.name) return;
    var base = getProductBaseName(rp.name);
    if (base === myBase) return;
    var key = rp.id || rp.name;
    if (seen[key]) return;
    seen[key] = true;
    picked.push({ product: rp, index: ri });
  });

  if (picked.length < 2) {
    allProducts.forEach(function (rp, ri) {
      if (ri === idx || !rp || picked.length >= 4) return;
      var key = rp.id || rp.name;
      if (seen[key]) return;
      seen[key] = true;
      picked.push({ product: rp, index: ri });
    });
  }

  if (!picked.length) return "";

  var items = picked
    .slice(0, 4)
    .map(function (row) {
      var rp = row.product;
      var price = formatCardPriceText(rp, categoryKey);
      return (
        '<button type="button" class="pqv-related-item js-quickview-trigger" data-product-idx="' +
        row.index +
        '">' +
        '<img src="' +
        escapeHtml(resolveCardImageSrc(rp)) +
        '" alt="" loading="lazy">' +
        '<div class="pqv-related-meta"><span class="pqv-related-name">' +
        escapeHtml(rp.name) +
        '</span><span class="pqv-related-price">' +
        price +
        "</span></div></button>"
      );
    })
    .join("");

  var seeAllHref = shopHref("/category");
  return (
    '<aside class="pqv-related">' +
    '<div class="pqv-related-head"><h3>Related Products</h3>' +
    '<a class="pqv-related-all" href="' +
    escapeHtml(seeAllHref) +
    '">See All</a></div>' +
    '<div class="pqv-related-list">' +
    items +
    "</div></aside>"
  );
}

function syncPqvTopOffset() {
  var header = document.getElementById("site-header-mount");
  var h = header && header.offsetHeight ? header.offsetHeight : 0;
  document.documentElement.style.setProperty("--pqv-top-offset", h + "px");
}

function ensureSizeChartModal() {
  if (document.getElementById("sizeChartModal")) return;
  var el = document.createElement("div");
  el.id = "sizeChartModal";
  el.className = "pqv-sc";
  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML =
    '<div class="pqv-sc-backdrop" data-sc-close="1"></div>' +
    '<div class="pqv-sc-dialog" role="dialog" aria-modal="true" aria-label="Size chart">' +
    '<button type="button" class="pqv-sc-close" data-sc-close="1" aria-label="Close">&times;</button>' +
    '<img id="sizeChartImg" src="" alt="Size chart">' +
    "</div>";
  document.body.appendChild(el);
  el.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-sc-close]")) closeSizeChartModal();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeSizeChartModal();
  });
}

function openSizeChartModal(url) {
  if (!url) return;
  ensureSizeChartModal();
  var modal = document.getElementById("sizeChartModal");
  var img = document.getElementById("sizeChartImg");
  if (!modal || !img) return;
  img.src = url;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("pqv-sc-open");
}

function closeSizeChartModal() {
  var modal = document.getElementById("sizeChartModal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("pqv-sc-open");
  var img = document.getElementById("sizeChartImg");
  if (img) img.src = "";
}

function setPqvGallerySlide(modal, slideIndex) {
  if (!modal) return;
  var thumbs = modal.querySelectorAll(".pqv-thumb");
  if (!thumbs.length) return;
  var i = ((slideIndex % thumbs.length) + thumbs.length) % thumbs.length;
  var thumb = thumbs[i];
  var src = thumb.getAttribute("data-src");
  var mainImg = modal.querySelector("#pqvMainImg");
  if (!src || !mainImg) return;
  mainImg.src = src;
  thumbs.forEach(function (t, j) {
    t.classList.toggle("is-active", j === i);
  });
  modal.setAttribute("data-pqv-slide", String(i));
  mainImg.style.transform = "";
  mainImg.style.transformOrigin = "center center";
  var stage = modal.querySelector(".pqv-zoom-stage");
  if (stage) stage.classList.remove("is-zooming");
  updatePqvGalleryNav(modal);
}

function updatePqvGalleryNav(modal) {
  if (!modal) return;
  var count = modal.querySelectorAll(".pqv-thumb").length;
  var show = count > 1;
  var prev = modal.querySelector(".pqv-nav-prev");
  var next = modal.querySelector(".pqv-nav-next");
  if (prev) prev.hidden = !show;
  if (next) next.hidden = !show;
}

function bindPqvGalleryArrows(modal) {
  if (!modal) return;
  updatePqvGalleryNav(modal);
  if (modal.getAttribute("data-pqv-nav-bound") === "1") return;
  modal.setAttribute("data-pqv-nav-bound", "1");
  modal.addEventListener("click", function (ev) {
    var nav = ev.target.closest("[data-pqv-nav]");
    if (!nav) return;
    ev.preventDefault();
    ev.stopPropagation();
    var i = parseInt(modal.getAttribute("data-pqv-slide") || "0", 10);
    if (nav.getAttribute("data-pqv-nav") === "prev") setPqvGallerySlide(modal, i - 1);
    else setPqvGallerySlide(modal, i + 1);
  });
}

function bindPqvInteractions(p, idx, categoryKey, scopeRoot) {
  var modal = scopeRoot || getActivePqvScope();
  if (!modal) return;
  categoryKey =
    categoryKey || modal.getAttribute("data-category-key") || (document.body && document.body.getAttribute("data-shop-category")) || "";
  var mainImg = modal.querySelector("#pqvMainImg");
  var imgSrc = resolveCardImageSrc(p);

  modal.setAttribute("data-pqv-slide", "0");
  updatePqvGalleryNav(modal);

  modal.querySelectorAll(".pqv-thumb").forEach(function (thumb, thumbIdx) {
    thumb.addEventListener("click", function () {
      setPqvGallerySlide(modal, thumbIdx);
    });
  });

  bindPqvGalleryArrows(modal);

  modal.querySelectorAll(".pqv-size-opt, .pqv-type-opt").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var groupClass = btn.classList.contains("pqv-type-opt") ? ".pqv-type-opt" : ".pqv-size-opt";
      modal.querySelectorAll(groupClass).forEach(function (b) {
        if (b.getAttribute("data-product-idx") !== String(idx)) return;
        b.classList.remove("is-active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", "true");
      if (btn.classList.contains("pqv-type-opt")) {
        var typeVal = btn.getAttribute("data-type-value");
        var typePrice = btn.getAttribute("data-type-price");
        if (typePrice) {
          var priceEl = modal.querySelector("#pqvPrice");
          if (priceEl) {
            priceEl.textContent = formatBdtPrice(typePrice);
            priceEl.setAttribute("data-price", typePrice);
          }
        } else {
          updatePqvPriceDisplay(modal, p, categoryKey, typeVal);
        }
        var specType = modal.querySelector("#pqvSpecType");
        if (specType) {
          specType.textContent =
            typeVal +
            " · " +
            formatBdtPrice(typePrice || resolveProductPrice(p, categoryKey, typeVal));
        }
      }
    });
  });

  var chartBtn = modal.querySelector("[data-pqv-size-chart]");
  if (chartBtn) {
    chartBtn.addEventListener("click", function () {
      var url = chartBtn.getAttribute("data-chart-url");
      if (url) openSizeChartModal(url);
    });
  }

  var qtyInput = modal.querySelector("#pqvQty");
  var minus = modal.querySelector("[data-pqv-qty='minus']");
  var plus = modal.querySelector("[data-pqv-qty='plus']");
  if (qtyInput && minus && plus) {
    minus.addEventListener("click", function () {
      setPqvQtyInput(qtyInput, getPqvQuantity(modal) - 1);
    });
    plus.addEventListener("click", function () {
      setPqvQtyInput(qtyInput, getPqvQuantity(modal) + 1);
    });
  }

  modal.querySelectorAll(".pqv-tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      var key = tab.getAttribute("data-tab");
      modal.querySelectorAll(".pqv-tab").forEach(function (t) {
        t.classList.toggle("is-active", t === tab);
      });
      modal.querySelectorAll(".pqv-tab-panel").forEach(function (panel) {
        panel.classList.toggle("is-active", panel.getAttribute("data-panel") === key);
      });
    });
  });

  if (mainImg && !mainImg.getAttribute("data-bound")) {
    mainImg.setAttribute("data-bound", "1");
    mainImg.src = imgSrc;
  }

  bindPqvImageZoom(modal);
  bindPqvQtyInput(modal);

  var activeType =
    getSelectedTypeForIdx(modal, idx) || getDefaultProductType(p, categoryKey);
  updatePqvPriceDisplay(modal, p, categoryKey, activeType);
}

function bindPqvQtyInput(modal) {
  var qtyInput = modal.querySelector("#pqvQty");
  if (!qtyInput) return;
  setPqvQtyInput(qtyInput, qtyInput.value);
  qtyInput.addEventListener("input", function () {
    setPqvQtyInput(qtyInput, qtyInput.value);
  });
  qtyInput.addEventListener("blur", function () {
    setPqvQtyInput(qtyInput, qtyInput.value);
  });
}

function bindPqvImageZoom(modal) {
  var stage = modal.querySelector(".pqv-zoom-stage");
  var img = modal.querySelector("#pqvMainImg");
  if (!stage || !img) return;

  var zoomScale = 2.2;

  function resetZoom() {
    img.style.transform = "";
    img.style.transformOrigin = "center center";
    stage.classList.remove("is-zooming");
  }

  stage.addEventListener("mousemove", function (e) {
    if (window.matchMedia("(max-width: 900px)").matches) return;
    var rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var x = ((e.clientX - rect.left) / rect.width) * 100;
    var y = ((e.clientY - rect.top) / rect.height) * 100;
    img.style.transformOrigin = x + "% " + y + "%";
    img.style.transform = "scale(" + zoomScale + ")";
    stage.classList.add("is-zooming");
  });

  stage.addEventListener("mouseleave", resetZoom);

  modal.querySelectorAll(".pqv-thumb, .pqv-nav").forEach(function (el) {
    el.addEventListener("click", resetZoom);
  });
}

function getQuickViewModalShellHtml() {
  return (
    '<button type="button" class="pqv-float-close" data-pqv-close="1" aria-label="Close">&times;</button>' +
    '<div class="pqv-dialog" role="dialog" aria-modal="true" aria-labelledby="pqvTitle">' +
    '<div id="pqvBody" class="pqv-body"></div></div>'
  );
}

function ensureQuickViewModal() {
  var existing = document.getElementById("productQuickView");
  if (existing) {
    if (!existing.classList.contains("pqv-page")) {
      existing.className = "pqv pqv-page";
      existing.innerHTML = getQuickViewModalShellHtml();
    } else {
      var oldBar = existing.querySelector(".pqv-toolbar");
      if (oldBar) oldBar.remove();
      if (!existing.querySelector(".pqv-float-close")) {
        existing.insertAdjacentHTML(
          "afterbegin",
          '<button type="button" class="pqv-float-close" data-pqv-close="1" aria-label="Close">&times;</button>'
        );
      }
    }
    return;
  }
  var modal = document.createElement("div");
  modal.id = "productQuickView";
  modal.className = "pqv pqv-page";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = getQuickViewModalShellHtml();
  document.body.appendChild(modal);
  modal.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-pqv-close]")) closeProductQuickView();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeProductQuickView();
  });
  if (!window.__pqvGalleryKeysBound) {
    window.__pqvGalleryKeysBound = true;
    document.addEventListener("keydown", function (ev) {
      var m = getActivePqvScope();
      if (!m) return;
      if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
      ev.preventDefault();
      var i = parseInt(m.getAttribute("data-pqv-slide") || "0", 10);
      setPqvGallerySlide(m, ev.key === "ArrowLeft" ? i - 1 : i + 1);
    });
  }
}

function closeProductQuickView(skipHistory) {
  var root = shopCartCtx.root;
  if (root && shopCartCtx.gridHtml) {
    root.innerHTML = shopCartCtx.gridHtml;
    root.className = shopCartCtx.gridClassName || "";
    shopCartCtx.gridHtml = null;
    shopCartCtx.gridClassName = "";
    document.body.classList.remove("pqv-open", "shop-product-open");
    var legacy = document.getElementById("productQuickView");
    if (legacy) {
      legacy.hidden = true;
      legacy.setAttribute("aria-hidden", "true");
      var legacyBody = document.getElementById("pqvBody");
      if (legacyBody) legacyBody.innerHTML = "";
    }
    if (!skipHistory && history.state && history.state.maProduct != null) {
      history.back();
    }
    window.scrollTo(0, 0);
    return;
  }
  var modal = document.getElementById("productQuickView");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("pqv-open", "shop-product-open");
  var body = document.getElementById("pqvBody");
  if (body) body.innerHTML = "";
}

function buildQuickViewPanelHtml(p, idx, waLink, categoryKey, allProducts) {
  var defaultType = getDefaultProductType(p, categoryKey);
  var productPrice = resolveProductPrice(p, categoryKey, defaultType);
  var imgFallback = getCategoryFallbackImage(categoryKey || "");
  var gallery = collectGalleryImages(p, allProducts || []);
  var imgSrc = escapeHtml(gallery[0] || resolveCardImageSrc(p));
  var priceText = formatBdtPrice(productPrice);
  var fabricText = escapeHtml(p.fabric || "Premium Georgette");
  var sizes = Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ["Free Size"];
  var types = getProductTypes(p, categoryKey);
  var lengthVal = p.detailNote ? String(p.detailNote).replace(/^লং:\s*/i, "").trim() : "";
  var colorLabel = p.colorLabel ? escapeHtml(p.colorLabel) : p.color ? escapeHtml(p.color) : "";
  var chartUrl = getSizeChartUrl(categoryKey);
  var chartBtn = chartUrl
    ? '<button type="button" class="pqv-size-chart-link" data-pqv-size-chart="1" data-chart-url="' +
      escapeHtml(chartUrl) +
      '"><span class="pqv-size-chart-ico" aria-hidden="true">&#128207;</span> Size Chart</button>'
    : "";

  var typeField =
    types.length > 1
      ? '<div class="pqv-field"><span class="pqv-field-label">Type</span><div class="pqv-opt-group pqv-type-group">' +
        buildPqvTypePills(types, idx, p, categoryKey) +
        "</div></div>"
      : "";

  var colorField = colorLabel
    ? '<div class="pqv-field"><span class="pqv-field-label">Color</span><div class="pqv-opt-group">' +
      '<button type="button" class="pqv-opt-btn is-active" aria-pressed="true">' +
      colorLabel +
      "</button></div></div>"
    : "";

  var shortNoteRaw = String(getProductShortNote(p, categoryKey) || "").trim();
  var shortNote = shortNoteRaw ? escapeHtml(shortNoteRaw) : "";
  var stockCount = allProducts && allProducts.length ? allProducts.length : 1;
  var stockText = stockCount + " Products Available";

  var descHtml = getProductDescriptionHtml(p, categoryKey);
  var relatedHtml = buildPqvRelatedHtml(p, idx, allProducts, categoryKey);

  var specRows =
    "<ul class='pqv-spec-table'>" +
    "<li><span>Fabric</span><strong>" +
    fabricText +
    "</strong></li>" +
    (colorLabel ? "<li><span>Color</span><strong>" + colorLabel + "</strong></li>" : "") +
    (lengthVal ? "<li><span>Length</span><strong>" + escapeHtml(lengthVal) + "</strong></li>" : "") +
    (types.length
      ? "<li><span>Type</span><strong id='pqvSpecType'>" +
        escapeHtml(defaultType) +
        " · " +
        escapeHtml(priceText) +
        "</strong></li>"
      : "") +
    "<li><span>SKU</span><strong>" +
    escapeHtml(p.id || "—") +
    "</strong></li></ul>";

  return (
    '<div class="pqv-anzaar">' +
    '<div class="pqv-gallery">' +
    '<div class="pqv-thumbs">' +
    buildPqvThumbsHtml(gallery, p.name) +
    "</div>" +
    '<div class="pqv-main-wrap">' +
    '<div class="pqv-main pqv-zoom-stage">' +
    '<button type="button" class="pqv-nav pqv-nav-prev" data-pqv-nav="prev" aria-label="Previous image" hidden>' +
    '<span aria-hidden="true">&#10094;</span></button>' +
    '<img id="pqvMainImg" class="pqv-zoom-img" src="' +
    imgSrc +
    '" alt="' +
    escapeHtml(p.name) +
    '" onerror="this.onerror=null;this.src=\'' +
    imgFallback.replace(/'/g, "\\'") +
    '\'">' +
    '<button type="button" class="pqv-nav pqv-nav-next" data-pqv-nav="next" aria-label="Next image" hidden>' +
    '<span aria-hidden="true">&#10095;</span></button>' +
    "</div></div></div>" +
    '<div class="pqv-panel">' +
    '<button type="button" class="pqv-panel-back" data-pqv-close="1">&lsaquo; Back to products</button>' +
    '<h1 id="pqvTitle" class="pqv-title">' +
    escapeHtml(p.name) +
    "</h1>" +
    '<p class="pqv-price" id="pqvPrice" data-price="' +
    productPrice +
    '">' +
    priceText +
    "</p>" +
    (shortNote ? '<p class="pqv-note">' + shortNote + "</p>" : "") +
    typeField +
    colorField +
    '<div class="pqv-field pqv-field-size"><div class="pqv-field-head"><span class="pqv-field-label">Size</span>' +
    chartBtn +
    '</div><div class="pqv-opt-group pqv-opt-group-wrap">' +
    buildPqvOptionPills(sizes, idx, "pqv-size-opt", "data-size-value", formatSizeLabel) +
    "</div></div>" +
    '<div class="pqv-qty-row">' +
    '<div class="pqv-qty">' +
    '<button type="button" class="pqv-qty-btn" data-pqv-qty="minus" aria-label="Decrease">−</button>' +
    '<input type="text" id="pqvQty" class="pqv-qty-input" value="1" inputmode="numeric" pattern="[0-9]*" lang="en" autocomplete="off" aria-label="Quantity">' +
    '<button type="button" class="pqv-qty-btn" data-pqv-qty="plus" aria-label="Increase">+</button>' +
    "</div>" +
    '<span class="pqv-stock">' +
    escapeHtml(stockText) +
    '</span>' +
    '<a href="#pqvDescBlock" class="pqv-jump-desc">&#8595; Jump to Description</a></div>' +
    '<div class="pqv-actions-row">' +
    '<button type="button" class="pqv-act pqv-act-cart" data-product-idx="' +
    idx +
    '" data-action="add">Add to Cart</button>' +
    '<button type="button" class="pqv-act pqv-act-buy" data-product-idx="' +
    idx +
    '" data-action="buy-now">Buy Now</button>' +
    '<a class="pqv-act pqv-act-msg" href="' +
    waLink +
    "?text=" +
    encodeURIComponent(p.name + " অর্ডার করতে চাই") +
    '" target="_blank" rel="noopener">Send Message</a>' +
    "</div></div>" +
    relatedHtml +
    '<div class="pqv-bottom" id="pqvDescBlock">' +
    '<div class="pqv-bottom-main">' +
    '<div class="pqv-tabs">' +
    '<button type="button" class="pqv-tab is-active" data-tab="desc">Description</button>' +
    '<button type="button" class="pqv-tab" data-tab="spec">Specification</button>' +
    "</div>" +
    '<div class="pqv-tab-panels">' +
    '<div class="pqv-tab-panel is-active" data-panel="desc">' +
    descHtml +
    "</div>" +
    '<div class="pqv-tab-panel" data-panel="spec">' +
    specRows +
    "</div></div></div></div></div>"
  );
}

function openProductQuickView(idx) {
  var products = shopCartCtx.products;
  if (!products || !products[idx]) return;
  var root = shopCartCtx.root || document.getElementById("list");
  if (!root) return;
  var waLink = (window.SITE_MEDIA && window.SITE_MEDIA.whatsappOrderLink) || "https://wa.me/8801971642683";
  var categoryKey = (document.body && document.body.getAttribute("data-shop-category")) || "";

  if (!shopCartCtx.gridHtml && root.querySelector("#productGrid")) {
    shopCartCtx.gridHtml = root.innerHTML;
    shopCartCtx.gridClassName = root.className || "";
  }

  var html = buildQuickViewPanelHtml(products[idx], idx, waLink, categoryKey, products);
  root.className = (shopCartCtx.gridClassName || "") + " shop-product-detail";
  root.setAttribute("data-category-key", categoryKey);
  root.innerHTML = html;
  bindPqvInteractions(products[idx], idx, categoryKey, root);

  var legacy = document.getElementById("productQuickView");
  if (legacy) {
    legacy.hidden = true;
    legacy.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("pqv-open");
  document.body.classList.add("shop-product-open");

  window.scrollTo(0, 0);
  if (history.pushState) {
    history.pushState({ maProduct: idx }, "", "#p-" + idx);
  }
  updatePqvGalleryNav(root);
}

function onGlobalShopCartClick(ev) {
  if (ev.type === "click" && ev.isTrusted === false) return;

  if (ev.target.closest("[data-pqv-close]")) {
    if (getActivePqvScope() || shopCartCtx.gridHtml) {
      ev.preventDefault();
      closeProductQuickView();
      return;
    }
  }

  var root = shopCartCtx.root;
  var products = shopCartCtx.products;
  var pqvScope = getActivePqvScope();
  var inProductView = !!pqvScope;

  if (inProductView && pqvScope.contains(ev.target)) {
    var modalQuick = ev.target.closest(".js-quickview-trigger");
    if (modalQuick) {
      ev.preventDefault();
      var mqIdx = parseInt(modalQuick.getAttribute("data-product-idx"), 10);
      if (!isNaN(mqIdx)) openProductQuickView(mqIdx);
      return;
    }
  }

  if (!inProductView) {
    if (!root || !document.body.contains(root)) {
      resetShopCartContext();
      return;
    }
    if (!products || !products.length || !root.contains(ev.target)) return;

    var quickTrigger = ev.target.closest(".js-quickview-trigger");
    if (quickTrigger && root.contains(quickTrigger)) {
      ev.preventDefault();
      var qIdx = parseInt(quickTrigger.getAttribute("data-product-idx"), 10);
      if (!isNaN(qIdx)) openProductQuickView(qIdx);
      return;
    }
  }

  var actionEl = ev.target.closest("button[data-action]");
  if (!actionEl) return;
  if (!inProductView && root && !root.contains(actionEl)) return;
  if (inProductView && pqvScope && !pqvScope.contains(actionEl)) return;

  var action = actionEl.getAttribute("data-action");
  var idx = parseInt(actionEl.getAttribute("data-product-idx"), 10);
  if (isNaN(idx) || !products || !products[idx]) return;

  if (action === "quickview") {
    ev.preventDefault();
    openProductQuickView(idx);
    return;
  }

  if (action !== "add" && action !== "buy-now") return;

  var scope = inProductView ? pqvScope : root;
  var selectedSize = getSelectedSizeForIdx(scope, idx);
  var selectedType = inProductView ? getSelectedTypeForIdx(scope, idx) : "";
  var qty = inProductView ? getPqvQuantity(scope) : 1;

  ev.preventDefault();
  ev.stopPropagation();
  var cartItem = Object.assign({}, products[idx], { _cartType: selectedType });
  shopAddProductToCart(cartItem, qty, selectedSize);

  if (action === "buy-now") {
    var checkoutHref =
      typeof window.siteHref === "function" ? window.siteHref("/checkout") : "checkout.html";
    var cartLines =
      typeof loadStoreCart === "function" ? loadStoreCart({ readOnly: true }) : [];
    if (!cartLines.length) {
      alert("অনুগ্রহ করে অন্তত একটি পণ্য কার্টে যোগ করুন।");
      return;
    }
    if (typeof flushStoreCartForCheckout === "function") {
      flushStoreCartForCheckout(cartLines);
    } else if (typeof persistStoreCart === "function") {
      persistStoreCart(cartLines);
      if (typeof markStoreCartSession === "function") markStoreCartSession();
    }
    window.location.href = checkoutHref;
  }
}

if (!window.__maShopCartClickBound) {
  window.__maShopCartClickBound = true;
  document.addEventListener("click", onGlobalShopCartClick);
}

if (!window.__maProductPopBound) {
  window.__maProductPopBound = true;
  window.addEventListener("popstate", function () {
    if (shopCartCtx.gridHtml) closeProductQuickView(true);
  });
}

window.openProductQuickView = openProductQuickView;
window.closeProductQuickView = closeProductQuickView;

window.syncShopCartBadge = syncShopCartBadge;
window.resetShopCartContext = resetShopCartContext;

function getShopBootSpec() {
  var body = document.body;
  if (!body) return null;
  if (body.getAttribute("data-shop-hub") === "1") return { hub: true };
  var key = body.getAttribute("data-shop-category");
  if (key) return { key: key };
  return null;
}

function isShopCategoryRendered() {
  var list = document.getElementById("list");
  if (!list) return false;
  if (list.classList.contains("shop-product-detail")) return true;
  return !!(
    list.querySelector("#productGrid .premium-card") ||
    list.querySelector(".cat-hub-grid .cat-hub-item") ||
    list.querySelector(".filter-empty")
  );
}

function scheduleShopCategoryBoot(force) {
  var spec = getShopBootSpec();
  if (!spec) return;

  function runBoot() {
    if (!force && isShopCategoryRendered()) return true;
    if (!window.CATEGORY_PRODUCTS) return false;
    if (spec.hub) {
      bootShopPage(function () {
        renderAllCategories();
      });
    } else {
      bootShopPage(function () {
        renderCategory(spec.key);
      });
    }
    return true;
  }

  function start() {
    if (runBoot()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (runBoot() || tries >= 60) clearInterval(timer);
    }, 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}

window.scheduleShopCategoryBoot = scheduleShopCategoryBoot;
window.isShopCategoryRendered = isShopCategoryRendered;

window.addEventListener("pageshow", function () {
  var spec = getShopBootSpec();
  if (!spec) return;
  if (!isShopCategoryRendered()) {
    resetShopCartContext();
    document.documentElement.classList.remove("category-ready");
    scheduleShopCategoryBoot(true);
  }
});



function getCategoryNavList() {
  if (window.CATEGORY_NAV && window.CATEGORY_NAV.length) {
    return window.CATEGORY_NAV;
  }
  return [];
}



function escapeHtml(str) {

  return String(str || "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;");

}



/** Unique color keys from products → one checkbox each (auto when `color` is set in category-products.js). */
function formatColorKeyLabel(key) {
  return String(key)
    .replace(/-/g, " ")
    .replace(/\b\w/g, function (ch) {
      return ch.toUpperCase();
    });
}

function getProductColorFilterKey(p) {
  if (p.colorLabel) return String(p.colorLabel).trim();
  if (p.color) return String(p.color).trim();
  return "";
}

function getProductColorFilterLabel(p, colorMap) {
  if (p.colorLabel) return String(p.colorLabel).trim();
  if (p.color && colorMap[p.color] && colorMap[p.color].label) return colorMap[p.color].label;
  if (p.color) return formatColorKeyLabel(p.color);
  return "";
}

function getProductColorOptions(products) {
  var colorMap = window.FILTER_COLOR_MAP || {};
  var seen = {};
  var options = [];

  products.forEach(function (p) {
    var key = getProductColorFilterKey(p);
    if (!key || seen[key]) return;
    seen[key] = true;
    options.push({
      key: key,
      label: getProductColorFilterLabel(p, colorMap)
    });
  });

  options.sort(function (a, b) {
    return a.label.localeCompare(b.label);
  });

  return options;
}



function getPriceBounds(products) {

  var min = 0;

  var max = 5000;

  if (products.length) {

    var prices = products.map(function (p) { return parseInt(p.price, 10) || 550; });

    min = Math.min.apply(null, prices);

    max = Math.max.apply(null, prices);

    if (min === max) max = min + 500;

  }

  return { min: min, max: max };

}



function buildShopSidebar(categoryKey, products) {
  var catLinks = getCategoryNavList()
    .map(function (c) {
      var active = c.key === categoryKey ? " active" : "";
      return (
        "<a href='" +
        escapeHtml(shopHref(c.href || "#")) +
        "' class='sidebar-cat-link" +
        active +
        "'>" +
        escapeHtml(c.label || c.key) +
        "</a>"
      );
    })
    .join("");

  var bounds = getPriceBounds(products);

  var colorOptions = getProductColorOptions(products);

  var colorChecks = colorOptions.length
    ? colorOptions
        .map(function (opt) {
          return (
            "<label class='color-filter-option'>" +
            "<input type='checkbox' class='color-filter-check' value='" +
            escapeHtml(opt.key) +
            "'>" +
            "<span class='color-filter-name'>" +
            escapeHtml(opt.label) +
            "</span>" +
            "</label>"
          );
        })
        .join("")
    : "<p class='color-filter-empty'>No colors listed for this category.</p>";



  return (

    "<aside class='shop-sidebar'>" +

    "<div class='shop-filter-head'>" +
    "<strong>Filter</strong>" +
    "<button type='button' class='shop-filter-close' id='shopFilterClose' aria-label='Close filters'>&times;</button>" +
    "</div>" +

    "<a class='sidebar-home' href='" + escapeHtml(shopHref("/")) + "'>&lsaquo; Home</a>" +

    "<div class='sidebar-filter sidebar-filter-cats'>" +

    "<h4>Categories</h4>" +

    "<nav class='shop-cats' id='shopCategoryNav'>" +

    catLinks +

    "</nav>" +

    "</div>" +

    "<div class='sidebar-filter sidebar-filter-colors'>" +

    "<h4>Color</h4>" +

    "<div class='color-filter-list' id='colorFilters'>" +

    colorChecks +

    "</div>" +

    "</div>" +

    "<div class='sidebar-filter'>" +

    "<h4>Price Range</h4>" +

    "<div class='price-slider-wrap'>" +

    "<div class='price-track'><div class='price-track-fill' id='priceTrackFill'></div></div>" +

    "<input type='range' id='priceMin' min='" +

    bounds.min +

    "' max='" +

    bounds.max +

    "' value='" +

    bounds.min +

    "' aria-label='Minimum price'>" +

    "<input type='range' id='priceMax' min='" +

    bounds.min +

    "' max='" +

    bounds.max +

    "' value='" +

    bounds.max +

    "' aria-label='Maximum price'>" +

    "</div>" +

    "<div class='price-labels'>" +

    "<span>Min &#2547; <span id='priceMinLabel'>" +

    bounds.min +

    "</span></span>" +

    "<span>Max &#2547; <span id='priceMaxLabel'>" +

    bounds.max +

    "</span></span>" +

    "</div>" +

    "</div>" +

    "</aside>"

  );

}



function resolveCardImageSrc(p) {
  if (!p) return "";
  if (window.maCatalog && typeof window.maCatalog.resolveImageUrl === "function") {
    return window.maCatalog.resolveImageUrl(p.image || "");
  }
  return p.image || "";
}

function wrapProductImageLink(innerHtml, p) {
  var pageCfg = window.SITE_LINKS && window.SITE_LINKS.productPage;
  var showLink =
    (pageCfg && pageCfg.enabled) ||
    (window.maCatalog && window.maCatalog.hasExplicitProductLink(p));
  if (!showLink || !p) return innerHtml;
  var href =
    (window.maCatalog && window.maCatalog.resolveProductPageLink(p)) || p.productUrl || p.link || "";
  if (!href) return innerHtml;
  return (
    "<a class='card-img-link' href='" +
    escapeHtml(href) +
    "' aria-label='" +
    escapeHtml("View " + (p.name || "product")) +
    "'>" +
    innerHtml +
    "</a>"
  );
}

function getCategoryFallbackImage(categoryKey) {
  var fallbacks = {
    abaya: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Maroon%20Abaya%20Set.jpeg?raw=1",
    "premium-two-piece": "images/pink-floral-printed-co-ord-set.jpeg",
    "cover-up": "images/Royal-Blue-Golden-Floral-Print.jpeg",
    "tops-kurti": "images/Black-White-Polka-Dots.jpeg",
    embroidery: "images/Black-Base-Rose-Floral.jpeg",
    karchupi: "images/Black-Base-Rose-Floral.jpeg",
    kaftan: "images/Baby-Pink-Floral-Print.jpeg",
    hijab: "images/Black-White-Polka-Dots.jpeg"
  };
  return fallbacks[categoryKey] || "images/Baby-Pink-Floral-Print.jpeg";
}

function isPrimaryHubProductName(name) {
  var s = String(name || "").toLowerCase();
  return (
    s.indexOf(" - back") === -1 &&
    s.indexOf("- back") === -1 &&
    s.indexOf(" - side") === -1 &&
    s.indexOf("- side") === -1
  );
}

/** All Categories টাইল — category-products.js থেকে প্রথম মূল ছবি (অটো আপডেট) */
function getCategoryHubImage(categoryKey) {
  var list = (window.CATEGORY_PRODUCTS && window.CATEGORY_PRODUCTS[categoryKey]) || [];
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (!p || !p.image || !isPrimaryHubProductName(p.name)) continue;
    var img = resolveCardImageSrc(p);
    if (img) return img;
  }
  return getCategoryFallbackImage(categoryKey);
}

function buildCardSpecsBlock(p, fabricText, sizeOptions, idx) {
  var lengthVal = p.detailNote ? String(p.detailNote).replace(/^লং:\s*/i, "").trim() : "";
  var chips =
    "<div class='card-spec-chips'>" +
    "<span class='card-spec-chip'><span class='card-spec-k'>ফেব্রিক</span><span class='card-spec-v'>" +
    fabricText +
    "</span></span>";
  if (lengthVal) {
    chips +=
      "<span class='card-spec-chip'><span class='card-spec-k'>লং</span><span class='card-spec-v'>" +
      escapeHtml(lengthVal) +
      "</span></span>";
  }
  chips += "</div>";
  return (
    "<div class='card-specs'>" +
    chips +
    "<div class='card-size-block'>" +
    "<span class='card-size-heading'>সাইজ</span>" +
    "<select class='card-size-select' data-size-idx='" +
    idx +
    "' aria-label='সাইজ নির্বাচন'>" +
    sizeOptions +
    "</select></div></div>"
  );
}

function buildDetailSpecsBlock(p, fabricText, sizeOptions, idx) {
  var lengthVal = p.detailNote ? String(p.detailNote).replace(/^লং:\s*/i, "").trim() : "";
  return (
    "<ul class='detail-spec-list'>" +
    "<li><span class='detail-spec-k'>ফেব্রিক</span><span class='detail-spec-v'>" +
    fabricText +
    "</span></li>" +
    (lengthVal
      ? "<li><span class='detail-spec-k'>লং</span><span class='detail-spec-v'>" + escapeHtml(lengthVal) + "</span></li>"
      : "") +
    "</ul>" +
    "<div class='card-size-block detail-size-block'>" +
    "<span class='card-size-heading'>সাইজ</span>" +
    "<select class='card-size-select' data-size-idx='" +
    idx +
    "' aria-label='সাইজ নির্বাচন'>" +
    sizeOptions +
    "</select></div>"
  );
}

function buildProductCard(p, idx, waLink, detailMode, categoryKey) {

  var defaultType = getDefaultProductType(p, categoryKey);
  var productPrice = resolveProductPrice(p, categoryKey, defaultType);
  var imgFallback = getCategoryFallbackImage(categoryKey || "");

  var priceText = formatCardPriceText(p, categoryKey);
  var fabricText = escapeHtml(p.fabric || (detailMode ? "দুবাই চেরি" : "Premium Georgette"));
  var sizes = Array.isArray(p.sizes) && p.sizes.length
    ? p.sizes
    : detailMode
      ? ["50", "52", "54", "56"]
      : ["Free Size"];
  var sizeOptions = sizes
    .map(function (s, i) {
      return "<option value='" + escapeHtml(s) + "'" + (i === 0 ? " selected" : "") + ">" + escapeHtml(s) + "</option>";
    })
    .join("");

  var colorAttr = p.color ? " data-color='" + escapeHtml(p.color) + "'" : "";

  if (detailMode) {
    return (
      '<article class="premium-card premium-card-detail" data-product-idx="' +
      idx +
      '" data-price="' +
      productPrice +
      '"' +
      colorAttr +
      ">" +
      '<div class="detail-media">' +
      '<span class="product-sale-badge">Sale!</span>' +
      wrapProductImageLink(
        '<img src="' +
          escapeHtml(resolveCardImageSrc(p)) +
          '" alt="' +
          escapeHtml(p.name) +
          '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' +
          imgFallback.replace(/'/g, "\\'") +
          '\'">',
        p
      ) +
      "</div>" +
      '<div class="detail-content">' +
      "<h3>" +
      escapeHtml(p.name) +
      "</h3>" +
      '<p class="detail-price">' +
      priceText +
      "</p>" +
      buildDetailSpecsBlock(p, fabricText, sizeOptions, idx) +
      '<div class="detail-actions">' +
      '<button type="button" class="msg-btn btn-add-cart" data-product-idx="' +
      idx +
      '" data-action="add">কার্টে যোগ</button>' +
      '<button type="button" class="msg-btn btn-buy-now" data-product-idx="' +
      idx +
      '" data-action="buy-now">অর্ডার করুন</button>' +
      "<a href='" +
      waLink +
      "?text=" +
      encodeURIComponent(p.name + " অর্ডার করতে চাই") +
      "' target='_blank' rel='noopener' class='msg-btn btn-msg'>মেসেজ করুন</a>" +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  return (
    '<article class="card premium-card" data-product-idx="' +
    idx +
    '" data-price="' +
    productPrice +
    '"' +
    colorAttr +
    ">" +
    '<button type="button" class="img-wrap js-quickview-trigger" data-product-idx="' +
    idx +
    '" aria-label="' +
    escapeHtml("View " + p.name) +
    '">' +
    '<span class="product-sale-badge">Sale!</span>' +
    '<img src="' +
    escapeHtml(resolveCardImageSrc(p)) +
    '" alt="' +
    escapeHtml(p.name) +
    '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'' +
    imgFallback.replace(/'/g, "\\'") +
    '\'">' +
    "</button>" +
    '<div class="card-foot">' +
    '<div class="card-meta">' +
    '<button type="button" class="card-title-btn js-quickview-trigger" data-product-idx="' +
    idx +
    '"><span class="card-title-text">' +
    escapeHtml(p.name) +
    "</span></button>" +
    '<span class="card-price">' +
    priceText +
    "</span>" +
    "</div>" +
    "<select class='card-size-select card-size-mobile' data-size-idx='" +
    idx +
    "' aria-hidden='true' tabindex='-1'>" +
    sizeOptions +
    "</select>" +
    '<div class="card-actions-anzaar">' +
    '<button type="button" class="anzaar-btn anzaar-btn-cart" data-product-idx="' +
    idx +
    '" data-action="quickview">Add to Cart</button>' +
    "<a href='" +
    waLink +
    "?text=" +
    encodeURIComponent(p.name + " অর্ডার করতে চাই") +
    "' target='_blank' rel='noopener' class='anzaar-btn anzaar-btn-msg' onclick='event.stopPropagation()'>Send Message</a>" +
    "</div></div></article>"
  );

}



function getPageSearchQuery() {
  try {
    return (new URLSearchParams(window.location.search).get("q") || "").trim();
  } catch (e) {
    return "";
  }
}

function renderAllCategories() {

  var root = document.getElementById("list");

  if (!root) return;

  var searchQ = getPageSearchQuery();
  if (searchQ && window.maSearch) {
    renderCategory("");
    return;
  }

  root.className = "cat-hub-page";

  if (typeof window.syncCatalogFromSections === "function") {
    window.syncCatalogFromSections();
  }

  var nav = window.CATEGORY_NAV || [];

  var tiles = nav.map(function (c) {

    var img = getCategoryHubImage(c.key) || c.image || "images/Baby-Pink-Floral-Print.jpeg";

    return (

      "<a class='cat-hub-item' href='" +

      escapeHtml(shopHref(c.href || "#")) +

      "'>" +

      "<div class='cat-hub-circle'><img src='" +

      img +

      "' alt='" +

      escapeHtml(c.label) +

      "' loading='lazy' decoding='async' onerror=\"this.onerror=null;this.src='images/Baby-Pink-Floral-Print.jpeg'\"></div>" +

      "<span class='cat-hub-label'>" +

      escapeHtml(c.label) +

      "</span></a>"

    );

  }).join("");

  root.innerHTML =

    "<nav class='cat-hub-breadcrumb' aria-label='Breadcrumb'>" +

    "<a href='" + escapeHtml(shopHref("/")) + "'>Home</a><span>&rsaquo;</span><strong>All Categories</strong></nav>" +

    "<h1 class='cat-hub-title'>All Categories</h1>" +

    "<div class='cat-hub-grid'>" +

    tiles +

    "</div>";

  fixShopPageLinks(root);
  markCategoryReady();
}



function renderCategory(categoryKey) {

  ensureCategoryStyles();



  var root = document.getElementById("list");

  if (!root) {
    markCategoryReady();
    return;
  }

  root.className = "";



  var allProducts = window.CATEGORY_PRODUCTS || {};
  var categoryMeta = window.CATEGORY_META || {};

  var searchQ = "";
  try {
    searchQ = (new URLSearchParams(window.location.search).get("q") || "").trim();
  } catch (searchErr) {
    searchQ = "";
  }

  var products;
  if (searchQ && window.maSearch) {
    if (categoryKey) {
      products = window.maSearch.collectProductsInCategory(allProducts, categoryKey, searchQ, categoryMeta);
    } else {
      products = window.maSearch.collectProducts(allProducts, searchQ, categoryMeta);
    }
  } else {
    products = (allProducts[categoryKey] || []).slice();
  }

  if (categoryKey && !searchQ && !products.length) {
    var soonTitle =
      (categoryMeta[categoryKey] && categoryMeta[categoryKey].title) || categoryKey.toUpperCase();
    var soonCrumb =
      "<nav class='shop-breadcrumb' aria-label='Breadcrumb'>" +
      "<a href='" +
      escapeHtml(shopHref("/")) +
      "'>Home</a><span>&rsaquo;</span><a href='" +
      escapeHtml(shopHref("/category")) +
      "'>Category</a><span>&rsaquo;</span><strong>" +
      escapeHtml(soonTitle) +
      "</strong></nav>";
    root.innerHTML =
      soonCrumb +
      "<div class='shop-empty-soon'>" +
      "<h1 class='shop-empty-soon-title'>" +
      escapeHtml(soonTitle) +
      "</h1>" +
      "<p class='shop-empty-soon-text'>এই ক্যাটাগরির প্রোডাক্ট এখনো সেটআপ করা হয়নি। শীঘ্রই যোগ করা হবে।</p>" +
      "<div class='shop-empty-soon-actions'>" +
      "<a class='shop-empty-soon-btn' href='" +
      escapeHtml(shopHref("/abaya")) +
      "'>ABAYA দেখুন</a>" +
      "<a class='shop-empty-soon-btn shop-empty-soon-btn--dark' href='" +
      escapeHtml(shopHref("/premium-two-piece")) +
      "'>PREMIUM TWO-PIECE</a>" +
      "</div></div>";
    fixShopPageLinks(root);
    markCategoryReady();
    return;
  }

  var title = searchQ
    ? 'Search: "' + searchQ + '"'
    : (categoryMeta[categoryKey] && categoryMeta[categoryKey].title) || categoryKey.toUpperCase();

  var waLink = (window.SITE_MEDIA && window.SITE_MEDIA.whatsappOrderLink) || "https://wa.me/8801971642683";



  var breadcrumb = searchQ
    ? "<nav class='shop-breadcrumb' aria-label='Breadcrumb'>" +
      "<a href='" + escapeHtml(shopHref("/")) + "'>Home</a><span>&rsaquo;</span><strong>Search</strong><span>&rsaquo;</span><strong>" +
      escapeHtml(searchQ) +
      "</strong></nav>"
    : "<nav class='shop-breadcrumb' aria-label='Breadcrumb'>" +
      "<a href='" + escapeHtml(shopHref("/")) + "'>Home</a><span>&rsaquo;</span><a href='" + escapeHtml(shopHref("/category")) + "'>Category</a><span>&rsaquo;</span><strong>" +
      escapeHtml(title) +
      "</strong></nav>";



  var sidebar = buildShopSidebar(searchQ ? "" : categoryKey, products);

  var detailMode = false;
  var cards = products.map(function (p, idx) {

    return buildProductCard(p, idx, waLink, detailMode, categoryKey);

  }).join("");



  root.innerHTML =

    breadcrumb +

    "<div class='shop-mobile-toolbar'>" +
    "<button type='button' class='shop-filter-open' id='shopFilterOpen' aria-expanded='false' aria-controls='shopFilterPanel'>" +
    "<svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true'><path d='M4 6h16M7 12h10M10 18h4'/></svg>" +
    "Filter</button>" +
    "<label class='shop-sort-wrap'>Sort By" +
    "<select id='shopSort' class='shop-sort-select' aria-label='Sort products'>" +
    "<option value='default'>Default</option>" +
    "<option value='price-asc'>Price: Low to High</option>" +
    "<option value='price-desc'>Price: High to Low</option>" +
    "<option value='name-asc'>Name: A-Z</option>" +
    "</select></label></div>" +

    "<div class='shop-filter-backdrop' id='shopFilterBackdrop' hidden></div>" +

    "<div class='shop-layout'>" +

    sidebar.replace("class='shop-sidebar'", "class='shop-sidebar' id='shopFilterPanel'") +

    "<section class='shop-main'>" +

    "<div class='shop-top'><h2 class='shop-title'>" +

    escapeHtml(title) +

    "</h2><span class='shop-count' id='shopCount'>" +

    products.length +

    " items</span></div>" +

    "<div class='product-grid" + (detailMode ? " product-grid-detail" : "") + "' id='productGrid'>" +

    (cards ||
      "<p class='filter-empty'>" +
      (searchQ
        ? 'No products found for "' + escapeHtml(searchQ) + '". Try another keyword or browse categories.'
        : "এই ক্যাটাগরিতে এখনো কোনো প্রোডাক্ট যোগ করা হয়নি।") +
      "</p>") +

    "</div></section></div>" +

    "<div id='cartMiniMsg' class='cart-mini-msg'>কার্টে যুক্ত হয়েছে</div>";

  fixShopPageLinks(root);

  shopCartCtx.root = root;
  shopCartCtx.products = products;

  if (!products.length) {
    markCategoryReady();
    syncShopCartBadge();
    return;
  }

  try {

  var filterState = { colors: [], priceMin: null, priceMax: null };



  function applyFilters() {

    var grid = document.getElementById("productGrid");

    var countEl = document.getElementById("shopCount");

    if (!grid) return;

    var cardsEls = grid.querySelectorAll(".premium-card");

    var visible = 0;

    cardsEls.forEach(function (card) {

      var idx = parseInt(card.getAttribute("data-product-idx"), 10);

      var p = products[idx];

      if (!p) return;

      var price = parseInt(p.price, 10) || 550;

      var show = true;

      if (filterState.colors.length) {
        var productColorKey = getProductColorFilterKey(p);
        if (!productColorKey || filterState.colors.indexOf(productColorKey) === -1) {
          show = false;
        }
      }

      if (filterState.priceMin !== null && price < filterState.priceMin) show = false;

      if (filterState.priceMax !== null && price > filterState.priceMax) show = false;

      card.classList.toggle("is-hidden", !show);

      if (show) visible++;

    });

    if (countEl) countEl.textContent = visible + " items";

    var empty = grid.querySelector(".filter-empty-dynamic");

    if (empty) empty.remove();

    if (visible === 0) {

      var el = document.createElement("p");

      el.className = "filter-empty filter-empty-dynamic";

      el.textContent = "এই ফিল্টারে কোনো প্রোডাক্ট পাওয়া যায়নি।";

      grid.appendChild(el);

    }

  }



  function updatePriceTrack() {

    var minInput = document.getElementById("priceMin");

    var maxInput = document.getElementById("priceMax");

    var fill = document.getElementById("priceTrackFill");

    if (!minInput || !maxInput || !fill) return;

    var min = parseInt(minInput.min, 10);

    var max = parseInt(minInput.max, 10);

    var lo = parseInt(minInput.value, 10);

    var hi = parseInt(maxInput.value, 10);

    if (lo > hi) {

      var t = lo;

      lo = hi;

      hi = t;

      minInput.value = lo;

      maxInput.value = hi;

    }

    filterState.priceMin = lo;

    filterState.priceMax = hi;

    var minLbl = document.getElementById("priceMinLabel");

    var maxLbl = document.getElementById("priceMaxLabel");

    if (minLbl) minLbl.textContent = String(lo);

    if (maxLbl) maxLbl.textContent = String(hi);

    var range = max - min || 1;

    var left = ((lo - min) / range) * 100;

    var width = ((hi - lo) / range) * 100;

    fill.style.left = left + "%";

    fill.style.width = width + "%";

    applyFilters();

  }



  var priceMin = document.getElementById("priceMin");

  var priceMax = document.getElementById("priceMax");

  if (priceMin) priceMin.addEventListener("input", updatePriceTrack);

  if (priceMax) priceMax.addEventListener("input", updatePriceTrack);

  updatePriceTrack();



  var colorFilterWrap = document.getElementById("colorFilters");

  if (colorFilterWrap) {
    colorFilterWrap.addEventListener("change", function (ev) {
      if (!ev.target.classList.contains("color-filter-check")) return;
      filterState.colors = [];
      colorFilterWrap.querySelectorAll(".color-filter-check:checked").forEach(function (cb) {
        filterState.colors.push(cb.value);
      });
      applyFilters();
    });
  }



  syncShopCartBadge();

  var filterOpen = document.getElementById("shopFilterOpen");
  var filterPanel = document.getElementById("shopFilterPanel");
  var filterBackdrop = document.getElementById("shopFilterBackdrop");

  function setFilterDrawer(open) {
    if (!filterPanel) return;
    document.body.classList.toggle("shop-filter-open", open);
    filterPanel.classList.toggle("is-open", open);
    if (filterBackdrop) {
      filterBackdrop.hidden = !open;
      filterBackdrop.classList.toggle("is-visible", open);
    }
    if (filterOpen) filterOpen.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (filterOpen) {
    filterOpen.addEventListener("click", function () {
      setFilterDrawer(!document.body.classList.contains("shop-filter-open"));
    });
  }
  var filterClose = document.getElementById("shopFilterClose");
  if (filterClose) {
    filterClose.addEventListener("click", function () {
      setFilterDrawer(false);
    });
  }
  if (filterBackdrop) {
    filterBackdrop.addEventListener("click", function () {
      setFilterDrawer(false);
    });
  }
  if (filterPanel) {
    filterPanel.addEventListener("click", function (ev) {
      if (ev.target.closest(".color-filter-option, .sidebar-cat-link")) {
        if (window.matchMedia("(max-width: 960px)").matches) {
          setFilterDrawer(false);
        }
      }
    });
  }

  var sortSelect = document.getElementById("shopSort");
  if (sortSelect) {
    sortSelect.addEventListener("change", function () {
      var grid = document.getElementById("productGrid");
      if (!grid) return;
      var cards = Array.prototype.slice.call(grid.querySelectorAll(".premium-card:not(.premium-card-detail)"));
      var mode = sortSelect.value;
      cards.sort(function (a, b) {
        var ia = parseInt(a.getAttribute("data-product-idx"), 10);
        var ib = parseInt(b.getAttribute("data-product-idx"), 10);
        var pa = products[ia];
        var pb = products[ib];
        if (!pa || !pb) return 0;
        if (mode === "price-asc") {
          return (parseInt(pa.price, 10) || 0) - (parseInt(pb.price, 10) || 0);
        }
        if (mode === "price-desc") {
          return (parseInt(pb.price, 10) || 0) - (parseInt(pa.price, 10) || 0);
        }
        if (mode === "name-asc") {
          return String(pa.name || "").localeCompare(String(pb.name || ""));
        }
        return ia - ib;
      });
      cards.forEach(function (card) {
        grid.appendChild(card);
      });
    });
  }

  } catch (renderErr) {
    if (typeof console !== "undefined" && console.error) {
      console.error("renderCategory failed:", renderErr);
    }
  } finally {
    markCategoryReady();
    if (typeof window.syncSiteHeaderOffset === "function") {
      window.syncSiteHeaderOffset();
    }
  }
}

function bootShopPage(run) {
  function start() {
    document.body.classList.add("shop-page");
    run();
    window.requestAnimationFrame(function () {
      if (typeof window.syncSiteHeaderOffset === "function") {
        window.syncSiteHeaderOffset();
      }
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}

window.bootShopCategory = function (categoryKey) {
  bootShopPage(function () {
    renderCategory(categoryKey);
  });
};

window.bootAllCategories = function () {
  bootShopPage(function () {
    renderAllCategories();
  });
};

scheduleShopCategoryBoot();

window.addEventListener("load", function () {
  if (getShopBootSpec() && !isShopCategoryRendered()) {
    scheduleShopCategoryBoot(true);
  }
});

