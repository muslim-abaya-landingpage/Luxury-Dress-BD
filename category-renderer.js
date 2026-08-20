/* ============================================================================
   category-renderer.js — ফাইলের মূল সেকশনগুলো (উপর থেকে নিচে সাজানো):

   1. CSS LINK করা / ক্যাটাগরি কী হেল্পার              (এখান থেকে শুরু)
   2. কার্ট স্টেট ও কার্টে প্রোডাক্ট যোগ করার লজিক        ("shopCartCtx" থেকে)
   3. কোয়ান্টিটি স্টেপার (+/- বাটন)                     ("buildShopCardQtyStepper")
   4. কুইক-ভিউ মডাল — গ্যালারি/HTML বিল্ডার              ("collectGalleryImages")
   5. কুইক-ভিউ মডাল — ইভেন্ট বাইন্ডিং                    ("bindPqvInteractions")
   6. মোবাইল স্টিকি অর্ডার বার                          ("ensureStickyOrderBarStyles")
   7. কুইক-ভিউ প্যানেলের সম্পূর্ণ HTML                    ("buildQuickViewPanelHtml")
   8. গ্লোবাল ক্লিক হ্যান্ডলার (কার্ট/বাই নাউ ক্লিক ধরা)   ("onGlobalShopCartClick")
   9. পেজ বুট/ইনিশিয়ালাইজেশন শিডিউলিং                   ("getShopBootSpec")
   10. সাইডবার ও ফিল্টার (কালার, প্রাইস, ক্যাটাগরি লিস্ট)  ("getCategoryNavList")
   11. ★ প্রোডাক্ট কার্ডের ছবি ব্লক                       ("buildCardImageBlock")
   12. ★ প্রোডাক্ট কার্ডের মূল HTML — কার্ট বাটন/Send
       Message/দাম/নাম সব এখানে তৈরি হয়                  ("buildProductCard")
   13. URL / ক্যাটাগরি কী রাউটিং হেল্পার                 ("getPageSearchQuery")
   14. ক্যাটাগরি পেজ কন্ট্রোল বাইন্ডিং (ফিল্টার/সর্ট)      ("bindShopCategoryControls")
   15. SPA নেভিগেশন (মেনু ক্লিকে রিলোড ছাড়া পেজ বদলানো)   ("softSwitchShopCategory")
   16. ★ ক্যাটাগরি পেজ রেন্ডার — পেজ লোড হলে এখান থেকেই
       সব শুরু হয়                                        ("renderCategory")

   ★ চিহ্নিত সেকশনগুলোই সবচেয়ে বেশি এডিট করা লাগতে পারে (বাটনের লেখা/আইকন,
   কার্ড লেআউট)। বাকিগুলো মূলত ভেতরের লজিক — হাত না দেওয়াই ভালো।
   ============================================================================ */

function productStockStatus(p) {
  if (window.maCatalog && typeof window.maCatalog.getStockStatus === "function") {
    return window.maCatalog.getStockStatus(p);
  }
  if (typeof window.getStockStatus === "function") {
    return window.getStockStatus(p);
  }
  return {
    inStock: true,
    qty: null,
    label: "In Stock",
    badge: "In Stock",
    buttonLabel: "Add to Cart"
  };
}
function productIsInStock(p) {
  return productStockStatus(p).inStock !== false;
}
function stockImageBadgeHtml(p) {
  var st = productStockStatus(p);
  if (!st.inStock) {
    return '<span class="product-sale-badge product-soldout-badge">Sold Out</span>';
  }
  return (
    '<span class="product-sale-badge">Sale</span>' +
    '<span class="product-instock-badge">In Stock</span>'
  );
}

function ensureCategoryStyles() {
  // ⚠️ SPEED FIX — this used to unconditionally overwrite .href on links
  // that the page's own <head> already declares, using DIFFERENT
  // cache-busting query strings ("?v=20260603vc14" here vs
  // "?v=20260603wholesale" / "?v=20260603cart14" in the HTML). A stylesheet
  // <link> re-fetches whenever its href string changes, so on every single
  // category-page load this silently downloaded category-sidebar.css (45KB),
  // qty-stepper.css, and shop-page.css a SECOND time under a different URL —
  // pure wasted bandwidth/latency, on top of whatever the HTML already loaded.
  // Fix: only set href when WE create the link (page didn't already have
  // one). If the HTML already declared it, leave its href alone.
  var link =
    document.getElementById("category-sidebar-css") ||
    document.querySelector('link[href*="category-sidebar.css"]');
  if (!link) {
    link = document.createElement("link");
    link.id = "category-sidebar-css";
    link.rel = "stylesheet";
    link.href = "category-sidebar.css?v=20260821gap";
    document.head.appendChild(link);
  }
  var qtyLink =
    document.getElementById("qty-stepper-css") ||
    document.querySelector('link[href*="qty-stepper.css"]');
  if (!qtyLink) {
    qtyLink = document.createElement("link");
    qtyLink.id = "qty-stepper-css";
    qtyLink.rel = "stylesheet";
    qtyLink.href = "qty-stepper.css?v=20260531qty2";
    document.head.appendChild(qtyLink);
  }
  // shop-page.css: only touch it if this page genuinely never declared it
  // (it always does on shop/category pages) — otherwise leave the
  // HTML-declared version alone so it isn't fetched twice.
  var shopLink = document.querySelector('link[href*="shop-page.css"]');
  if (!shopLink) {
    shopLink = document.createElement("link");
    shopLink.rel = "stylesheet";
    shopLink.href = "shop-page.css?v=20260821gap";
    document.head.appendChild(shopLink);
  }
}

/** Category key on <html> (SEO) or <body> (legacy SPA). */
function getShopCategoryKey() {
  var root = document.documentElement;
  var body = document.body;
  return (
    (root && root.getAttribute("data-shop-category")) ||
    (body && body.getAttribute("data-shop-category")) ||
    shopCartCtx.categoryKey ||
    ""
  );
}

function setShopCategoryKey(key) {
  if (!key) return;
  var root = document.documentElement;
  var body = document.body;
  
  // সেফটি কন্ডিশন: HTML উপাদানগুলো আসলেই রেডি কি না তা চেক করা
  if (root && typeof root.setAttribute === "function") {
    root.setAttribute("data-shop-category", key);
  }
  if (body && typeof body.setAttribute === "function") {
    body.setAttribute("data-shop-category", key);
  }
}
// আপনার ফাইলের পরবর্তী ফাংশনটি ঠিক এখান থেকে স্বাভাবিকভাবে চলতে থাকবে...
function maShopBagIcon(size) {
  // size না থাকলে বা ভুল থাকলে ডিফল্ট ১৮ হবে
  var s = parseInt(size, 10) || 18; 
  return (
    '<span class="ma-shop-bag-ico muslim-abaya-btn-ico" aria-hidden="true">' +
    '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>' +
    '<path d="M6 6L5 3H2"/></svg></span>'
  );
}
function fireShopViewContent(product, categoryKey) {
  if (!product) return;
  var cat =
    categoryKey ||
    getShopCategoryKey() ||
    "";
  var defaultType =
    typeof getDefaultProductType === "function" ? getDefaultProductType(product, cat) : "";
  var price =
    typeof resolveProductPrice === "function"
      ? resolveProductPrice(product, cat, defaultType)
      : parseInt(product.price, 10) || 0;
  var payload = {
    content_type: "product",
    currency: "BDT",
    content_ids: [String(product.id || product.name || "")],
    content_name: String(product.name || ""),
    value: price
  };
  if (cat) payload.content_category = cat;
  if (typeof pushTrackingEvent === "function") {
    pushTrackingEvent("ViewContent", payload);
  } else if (typeof window !== "undefined") {
    window.dataLayer = window.dataLayer || [];
    var dlPayload = Object.assign({ event: "ViewContent" }, payload);
    if (typeof applyMetaTrackingFields === "function") {
      dlPayload = applyMetaTrackingFields(dlPayload);
    }
    window.dataLayer.push(dlPayload);
  }
}
function displayFabricLabel(fabric, fallback) {
  var raw = String(fabric || "").trim() || String(fallback || "Premium Georgette").trim();
  if (typeof formatFabricLabelEn === "function") return formatFabricLabelEn(raw);
  return raw;
}
function syncShopScrollHeights() {
  if (!document.body || !document.body.classList.contains("shop-page")) return;
  var header = document.getElementById("site-header-mount");
  var root = document.documentElement;
  if (header && header.offsetHeight) {
    root.style.setProperty("--site-header-h", header.offsetHeight + "px");
  }
}
function bindShopScrollHeights() {
  if (window.__shopScrollHeightsBound) return;
  window.__shopScrollHeightsBound = true;
  syncShopScrollHeights();
  window.addEventListener("resize", syncShopScrollHeights);
  if (typeof ResizeObserver !== "undefined") {
    var ro = new ResizeObserver(syncShopScrollHeights);
    ["site-header-mount", "site-footer-mount"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) ro.observe(el);
    });
  }
  window.setTimeout(syncShopScrollHeights, 500);
  window.setTimeout(syncShopScrollHeights, 1500);
}
function markCategoryReady() {
  document.documentElement.classList.add("category-ready");
  bindShopScrollHeights();
}
function shopBreadcrumbVariants(html) {
  return {
    mobile: html.replace(
      "class='shop-breadcrumb'",
      "class='shop-breadcrumb shop-breadcrumb--mobile'"
    ),
    desktop: html.replace(
      "class='shop-breadcrumb'",
      "class='shop-breadcrumb shop-breadcrumb--desktop'"
    ),
  };
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
/* ----------------------------------------------------------------------
   SECTION 2: কার্ট স্টেট ও কার্টে প্রোডাক্ট যোগ করার লজিক
   কোন প্রোডাক্ট কার্টে আছে, কত quantity, সাইজ/টাইপ অনুযায়ী মার্জ করা —
   এই লজিক এখানে। সাধারণত এখানে হাত না দেওয়াই নিরাপদ।
   ---------------------------------------------------------------------- */
var shopCartCtx = {
  root: null,
  products: [],
  categoryKey: "",
  gridHtml: null,
  gridClassName: "",
  lastCartAddKey: "",
  lastCartAddAt: 0
};
function getActivePqvScope() {
  var root = shopCartCtx.root;
  if (root && root.classList.contains("shop-product-detail") && root.querySelector(".pqv-muslim-abaya")) {
    return root;
  }
  return null;
}
function productFullPageHref(product) {
  var id = product && product.id ? String(product.id) : "";
  if (!id) return "product.html";
  return "product.html?id=" + encodeURIComponent(id);
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
function resolveTwoPieceCartLength(item, sizeValue) {
  var picked = String(sizeValue || "").trim();
  if (picked) return picked;
  if (item && Array.isArray(item.sizeSpecs) && item.sizeSpecs.length) {
    return item.sizeSpecs
      .map(function (row) {
        var label = String((row && row.label) || "").trim();
        var value = String((row && row.value) || "").trim();
        return (label + " " + value).trim();
      })
      .filter(Boolean)
      .join(" | ");
  }
  var tpCfg = typeof getTwoPieceSizeConfig === "function" ? getTwoPieceSizeConfig(item) : null;
  return (tpCfg && tpCfg.lengthSizeLabel) || "37-38 inch";
}
function resolveTwoPieceCartBody(item, bodyValueOpt) {
  var picked = String(bodyValueOpt || "").trim();
  if (picked) return picked;
  var tpCfg = typeof getTwoPieceSizeConfig === "function" ? getTwoPieceSizeConfig(item) : null;
  return (tpCfg && tpCfg.bodySizeLabel) || "42 (Free size)";
}
function buildShopCartLineSizeKey(item, sizeValue, categoryKey, bodyValueOpt) {
  var isAbaya = typeof isAbayaProduct === "function" && isAbayaProduct(item, categoryKey);
  var isTwoPiece = typeof isTwoPieceProduct === "function" && isTwoPieceProduct(item, categoryKey);
  if (isTwoPiece && typeof formatTwoPieceCartSize === "function") {
    return formatTwoPieceCartSize(
      resolveTwoPieceCartLength(item, sizeValue),
      resolveTwoPieceCartBody(item, bodyValueOpt)
    );
  }
  var abayaCfg = isAbaya && typeof getAbayaSizeConfig === "function" ? getAbayaSizeConfig(item) : null;
  var pickedLength =
    String(sizeValue || "").trim() ||
    (abayaCfg ? abayaCfg.lengthSizes[0] : "50");
  if (isAbaya && typeof formatAbayaCartSize === "function") {
    return formatAbayaCartSize(pickedLength, bodyValueOpt);
  }
  return pickedLength;
}
function shopCartHasMatchingLine(item, sizeValue, categoryKey, bodyValueOpt) {
  var id = String(item && item.id || "").trim();
  if (!id) return false;
  var sizeKey = buildShopCartLineSizeKey(item, sizeValue, categoryKey, bodyValueOpt);
  var probe = {
    id: id,
    size: sizeKey,
    color: (item && (item.color || item.colorLabel)) || "",
    colorLabel: (item && (item.colorLabel || item.color)) || "",
    productType: (item && (item._cartType || item.productType)) || "",
    category: categoryKey || (item && item.category) || ""
  };
  var mergeKey =
    typeof cartLineMergeKey === "function"
      ? cartLineMergeKey(probe)
      : id + "|" + sizeKey;
  var lines = typeof loadStoreCart === "function" ? loadStoreCart({ readOnly: true }) : [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line) continue;
    var lineKey =
      typeof cartLineMergeKey === "function"
        ? cartLineMergeKey(line)
        : String(line.id || "") + "|" + String(line.size || line.selectedSize || "");
    if (lineKey === mergeKey) return true;
  }
  return false;
}
function buildShopCartLineItem(item, qtyToAdd, sizeValue, categoryKeyOpt, selectedTypeOpt, bodyValueOpt) {
  var categoryKey =
    categoryKeyOpt ||
    (item && item.category) ||
    getShopCategoryKey() ||
    "";
  var isAbaya = typeof isAbayaProduct === "function" && isAbayaProduct(item, categoryKey);
  var isTwoPiece = typeof isTwoPieceProduct === "function" && isTwoPieceProduct(item, categoryKey);
  var abayaCfg = isAbaya && typeof getAbayaSizeConfig === "function" ? getAbayaSizeConfig(item) : null;
  var pickedLength = isTwoPiece
    ? resolveTwoPieceCartLength(item, sizeValue)
    : String(sizeValue || "").trim() ||
      (abayaCfg ? abayaCfg.lengthSizes[0] : "50");
  var cat = typeof findCatalogByName === "function" ? findCatalogByName(item.name) : null;
  var pickedSize = pickedLength;
  var pickedType = selectedTypeOpt || item._cartType || "";
  /** কাস্টমার body-size pill থেকে যা সিলেক্ট করেছে (bodyValueOpt) — সেটাই
   *  আসল সোর্স অফ ট্রুথ। কিছু সিলেক্ট না করলে (ফিক্সড বডি সাইজ প্রোডাক্টে
   *  pill থাকেই না) ক্যাটাগরি/প্রোডাক্টের static bodySizeLabel-এ ফলব্যাক
   *  করবে — আগের আচরণ অক্ষুণ্ণ থাকলো। */
  var pickedBodyLabel = String(bodyValueOpt || "").trim();
  var resolvedBodyLabel = isTwoPiece
    ? resolveTwoPieceCartBody(item, bodyValueOpt)
    : pickedBodyLabel || (isAbaya && abayaCfg ? abayaCfg.bodySizeLabel : "");
  var unitPrice = resolveProductPrice(item, categoryKey, pickedType);
  var cartName = item.name;
  if (pickedType) cartName += " (" + pickedType + ")";
  var sizeLabel =
    isAbaya && typeof formatAbayaCartSize === "function"
      ? formatAbayaCartSize(pickedLength, resolvedBodyLabel)
      : isTwoPiece && typeof formatTwoPieceCartSize === "function"
        ? formatTwoPieceCartSize(pickedLength, resolvedBodyLabel)
        : "Size " + pickedSize;
  cartName += " (" + sizeLabel + ")";
  return {
    id: item.id || (cat ? cat.id : ""),
    name: cartName,
    price: unitPrice,
    quantity: parseInt(qtyToAdd, 10) || 1,
    image: item.image || (cat && cat.image) || "",
    color: item.color || "",
    colorLabel: item.colorLabel || "",
    fabric: item.fabric || "",
    description: item.description || item.fabric || "",
    size:
      isAbaya && typeof formatAbayaCartSize === "function"
        ? formatAbayaCartSize(pickedLength, resolvedBodyLabel)
        : isTwoPiece && typeof formatTwoPieceCartSize === "function"
          ? formatTwoPieceCartSize(pickedLength, resolvedBodyLabel)
          : pickedSize,
    lengthSize: isAbaya || isTwoPiece ? pickedLength : "",
    bodySize: resolvedBodyLabel,
    productType: pickedType,
    category: item.category || categoryKey || "",
    categoryLabel: item.categoryLabel || ""
  };
}
function shopAddProductToCart(item, qtyToAdd, sizeValue, categoryKeyOpt, bodyValueOpt) {
  if (!productIsInStock(item)) return;
  var categoryKey =
    categoryKeyOpt ||
    (item && item.category) ||
    getShopCategoryKey() ||
    "";
  var isAbaya = typeof isAbayaProduct === "function" && isAbayaProduct(item, categoryKey);
  var isTwoPiece = typeof isTwoPieceProduct === "function" && isTwoPieceProduct(item, categoryKey);
  var abayaCfg = isAbaya && typeof getAbayaSizeConfig === "function" ? getAbayaSizeConfig(item) : null;
  var pickedLength = isTwoPiece
    ? resolveTwoPieceCartLength(item, sizeValue)
    : String(sizeValue || "").trim() || (abayaCfg ? abayaCfg.lengthSizes[0] : "50");
  var pickedSizeEarly = isAbaya || isTwoPiece ? pickedLength : pickedLength;
  var addGuardKey =
    (item.id || item.name || "") +
    "|" +
    pickedSizeEarly +
    "|" +
    String(bodyValueOpt || "") +
    "|" +
    String((item && (item.color || item.colorLabel)) || "");
  var now = Date.now();
  if (addGuardKey === shopCartCtx.lastCartAddKey && now - shopCartCtx.lastCartAddAt < 450) return;
  shopCartCtx.lastCartAddKey = addGuardKey;
  shopCartCtx.lastCartAddAt = now;
  var line = buildShopCartLineItem(item, qtyToAdd, sizeValue, categoryKeyOpt, item._cartType || "", bodyValueOpt);
  var updated = [];
  if (typeof addOrMergeStoreCartItem === "function") {
    updated = addOrMergeStoreCartItem(
      typeof loadStoreCart === "function" ? loadStoreCart({ readOnly: true }) : [],
      line
    );
  }
  if (typeof afterCartMutation === "function") afterCartMutation(updated);

  if (typeof pushTrackingEvent === "function") {
    pushTrackingEvent("AddToCart", {
      content_ids: [line.id || item.name],
      content_name: item.name,
      content_type: "product",
      value: line.price,
      currency: "BDT",
      quantity: line.quantity
    });
  }
  if (typeof showCartAddedToast === "function") {
    showCartAddedToast({
      name: item.name || line.name,
      image: line.image,
      price: line.price
    });
  }
  refreshShopCardsAfterCartChange();
}
function parseWholesaleQtyValue(raw) {
  var digits = toAsciiDigits(raw).replace(/\D/g, "");
  var n = parseInt(digits, 10);
  if (!n || n < 0) return 0;
  if (n > 999) return 999;
  return n;
}
function getPqvWholesaleEntries(scopeRoot) {
  var out = [];
  if (!scopeRoot) return out;
  scopeRoot.querySelectorAll(".pqv-wh-qty-input[data-wh-size]").forEach(function (input) {
    var qty = parseWholesaleQtyValue(input.value);
    if (qty <= 0) return;
    out.push({
      size: input.getAttribute("data-wh-size") || "",
      qty: qty
    });
  });
  return out;
}
function shopAddBulkProductsToCart(item, entries, categoryKey, selectedType) {
  if (!item || !entries || !entries.length) return 0;
  if (!productIsInStock(item)) return 0;
  var cart = typeof loadStoreCart === "function" ? loadStoreCart({ readOnly: true }) : [];
  var addedLines = 0;
  var totalQty = 0;
  var firstLine = null;
  entries.forEach(function (entry) {
    var qty = parseInt(entry.qty, 10) || 0;
    if (qty <= 0 || !entry.size) return;
    var line = buildShopCartLineItem(item, qty, entry.size, categoryKey, selectedType || "");
    if (typeof addOrMergeStoreCartItem === "function") {
      cart = addOrMergeStoreCartItem(cart, line);
    } else {
      cart.push(line);
    }
    if (!firstLine) firstLine = line;
    addedLines += 1;
    totalQty += qty;
  });
  if (!addedLines) return 0;
  if (typeof persistStoreCart === "function") persistStoreCart(cart);
  if (typeof afterCartMutation === "function") afterCartMutation(cart);
  if (typeof pushTrackingEvent === "function") {
    pushTrackingEvent("AddToCart", {
      content_ids: [firstLine && firstLine.id ? firstLine.id : item.name],
      content_name: item.name,
      content_type: "product",
      value: firstLine ? firstLine.price * totalQty : 0,
      currency: "BDT",
      quantity: totalQty
    });
  }
  if (typeof showCartAddedToast === "function") {
    showCartAddedToast({
      name: (item.name || "Product") + " · " + totalQty + " pcs (" + addedLines + " sizes)",
      image: firstLine && firstLine.image ? firstLine.image : item.image,
      price: firstLine ? firstLine.price : resolveProductPrice(item, categoryKey, selectedType || "")
    });
  }
  refreshShopCardsAfterCartChange();
  return totalQty;
}
function resetShopCartContext() {
  shopCartCtx.root = null;
  shopCartCtx.products = [];
  shopCartCtx.categoryKey = "";
}
function getSelectedBodyValueForIdx(scopeRoot, idx) {
  if (!scopeRoot) return "";
  var bodyPill = scopeRoot.querySelector(
    ".pqv-body-opt.is-active[data-product-idx='" + idx + "']"
  );
  return bodyPill ? bodyPill.getAttribute("data-body-value") || "" : "";
}
function getSelectedPalazzoForIdx(scopeRoot, idx) {
  if (!scopeRoot) return "";
  var pill = scopeRoot.querySelector(
    ".pqv-palazzo-opt.is-active[data-product-idx='" + idx + "']"
  );
  return pill ? pill.getAttribute("data-palazzo-value") || "" : "";
}
function getSelectedSizeForIdx(scopeRoot, idx) {
  if (!scopeRoot) return "50";
  var lengthVal = "";
  var activePill = scopeRoot.querySelector(
    ".pqv-length-opt.is-active[data-product-idx='" + idx + "']"
  );
  if (activePill) {
    lengthVal = activePill.getAttribute("data-length-value") || "50";
  } else {
    activePill = scopeRoot.querySelector(
      ".pqv-size-opt.is-active[data-product-idx='" + idx + "']"
    );
    if (activePill) {
      lengthVal = activePill.getAttribute("data-size-value") || "50";
    } else {
      var sizeEl = scopeRoot.querySelector("[data-size-idx='" + idx + "']");
      lengthVal = sizeEl ? sizeEl.value : "50";
    }
  }
  var palazzoVal = getSelectedPalazzoForIdx(scopeRoot, idx);
  if (palazzoVal) {
    return String(lengthVal || "").trim() + " · Palazzo " + palazzoVal;
  }
  return lengthVal;
}
const toAsciiDigits = (str) => 
  String(str || "").replace(/[০-৯]/g, d => String.fromCharCode(d.charCodeAt(0) - 2486));
  
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
function shopProductHasTypeChoice(p, categoryKey) {
  return getProductTypes(p, categoryKey).length > 1;
}
function getShopCartQtyForProduct(p) {
  if (!p) return 0;
  var lines = typeof loadStoreCart === "function" ? loadStoreCart({ readOnly: true }) : [];
  var pid = String(p.id || "").trim();
  var baseName = getProductBaseName(p.name).toLowerCase();
  var total = 0;
  lines.forEach(function (line) {
    if (!line) return;
    if (pid && String(line.id || "").trim() === pid) {
      total += parseInt(line.quantity, 10) || 0;
      return;
    }
    var lineName = String(line.name || "").replace(/\s*\([^)]*\)\s*$/g, "").trim().toLowerCase();
    if (baseName && lineName.indexOf(baseName) === 0) {
      total += parseInt(line.quantity, 10) || 0;
    }
  });
  return total;
}
function getShopCardQty(root, idx) {
  if (!root) return 1;
  var el = root.querySelector('.shop-card-qty-val[data-product-idx="' + idx + '"]');
  return parsePqvQtyValue(el ? el.textContent : 1);
}
function setShopCardQty(root, idx, n) {
  if (!root) return;
  var qty = parsePqvQtyValue(n);
  var val = root.querySelector('.shop-card-qty-val[data-product-idx="' + idx + '"]');
  var minus = root.querySelector(
    '.shop-card-qty-btn[data-shop-qty="minus"][data-product-idx="' + idx + '"]'
  );
  if (val) val.textContent = String(qty);
  if (minus) minus.disabled = qty <= 1;
}
/* ----------------------------------------------------------------------
   SECTION 3: কোয়ান্টিটি স্টেপার (+ / - বাটন) — প্রোডাক্ট কার্টে থাকলে
   এই ছোট বক্সটা দেখায় যাতে quantity বাড়ানো-কমানো যায়।
   ---------------------------------------------------------------------- */
function buildShopCardQtyStepper(idx, qty, inCart) {
  var q = parsePqvQtyValue(qty);
  return (
    '<div class="ma-qty-stepper shop-card-qty is-visible' +
    (inCart ? " in-cart" : "") +
    '" data-product-idx="' +
    idx +
   '" role="group" aria-label="Quantity">' +
    '<button type="button" class="ma-qty-stepper__btn shop-card-qty-btn" data-shop-qty="minus" data-product-idx="' +
    idx +
    '" aria-label="Decrease quantity"' +
    (q <= 1 ? " disabled" : "") +
    ">−</button>" +
    '<span class="ma-qty-stepper__value shop-card-qty-val" data-product-idx="' +
    idx +
    '" aria-live="polite">' +
    q +
    "</span>" +
    '<button type="button" class="ma-qty-stepper__btn shop-card-qty-btn" data-shop-qty="plus" data-product-idx="' +
    idx +
    '" aria-label="Increase quantity">+</button>' +
    "</div>"
  );
}
function refreshShopCardsAfterCartChange() {
  var root = shopCartCtx.root;
  var products = shopCartCtx.products;
  if (!root || !products || !products.length) return;
  if (shopCartCtx.gridHtml || getActivePqvScope()) return;
  products.forEach(function (p, idx) {
    var card = root.querySelector('.premium-card[data-product-idx="' + idx + '"]');
    if (!card) return;
    var cartQty = getShopCartQtyForProduct(p);
    var displayQty = cartQty > 0 ? cartQty : getShopCardQty(root, idx);
    card.classList.toggle("in-cart", cartQty > 0);
    var stepper = card.querySelector(".shop-card-qty");
    if (stepper) stepper.classList.toggle("in-cart", cartQty > 0);
    setShopCardQty(root, idx, displayQty);
    var addBtn = card.querySelector(".muslim-abaya-btn-cart[data-product-idx='" + idx + "']");
    if (addBtn) addBtn.classList.toggle("is-active", cartQty > 0);
  });
  syncShopCartBadge();
}
function changeShopCartProductQty(p, delta, categoryKey) {
  var lines = typeof loadStoreCart === "function" ? loadStoreCart({ readOnly: true }) : [];
  var pid = String(p.id || "").trim();
  var lineIdx = -1;
  var i;
  for (i = 0; i < lines.length; i++) {
    if (pid && String(lines[i].id || "").trim() === pid) {
      lineIdx = i;
      break;
    }
  }
  if (lineIdx === -1) {
    if (delta > 0) {
      if (shopProductHasColorChoice(p) || shopProductHasTypeChoice(p, categoryKey)) {
        var openIdx = -1;
        (shopCartCtx.products || []).forEach(function (row, i) {
          if (row === p) openIdx = i;
        });
        if (openIdx < 0 && p.id) openIdx = findProductIdxById(p.id);
        if (openIdx >= 0) openProductQuickView(openIdx);
        return;
      }
      var defaultSize = Array.isArray(p.sizes) && p.sizes.length ? p.sizes[0] : "50";
      var defaultType = getDefaultProductType(p, categoryKey);
      shopAddProductToCart(Object.assign({}, p, { _cartType: defaultType }), delta, defaultSize, categoryKey);
    }
    return;
  }
  var line = lines[lineIdx];
  var newQty = (parseInt(line.quantity, 10) || 0) + delta;
  var updated;
  if (newQty <= 0) {
    updated = lines.slice(0, lineIdx).concat(lines.slice(lineIdx + 1));
  } else {
    updated = lines.slice();
    updated[lineIdx] = Object.assign({}, line, { quantity: newQty });
  }
  if (typeof persistStoreCart === "function") persistStoreCart(updated);
  if (typeof afterCartMutation === "function") afterCartMutation(updated);
  refreshShopCardsAfterCartChange();
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
  var types = [];
  if (Array.isArray(p.types) && p.types.length) types = p.types.slice();
  else {
    var defs =
      window.SITE_LINKS &&
      window.SITE_LINKS.defaults &&
      window.SITE_LINKS.defaults.byCategory;
    var cat = defs && categoryKey && defs[categoryKey];
    if (cat && Array.isArray(cat.types) && cat.types.length) types = cat.types.slice();
  }
  if (categoryKey === "premium-two-piece") {
    types = types.filter(function (t) {
      return t !== "Top Only" && t !== "Bottom Only";
    });
  }
  return types;
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
  return "\u09F3" + (parseInt(amount, 10) || 0);
}
function colorLabelDiffersFromName(p, colorLabel) {
  if (!colorLabel) return false;
  var name = String(p && p.name ? p.name : "")
    .trim()
    .toLowerCase();
  var color = String(colorLabel)
    .replace(/<[^>]*>/g, "")
    .trim()
    .toLowerCase();
  return color && color !== name;
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
  return "* \"Note: Product color may slightly vary due to photographic lighting sources.\"";
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
  return "\u09F3" + min;
}
function updatePqvPriceDisplay(modal, p, categoryKey, typeLabel) {
  if (!modal || !p) return;
  var el = modal.querySelector("#pqvPrice");
  if (!el) return;
  var price = resolveProductPrice(p, categoryKey, typeLabel);
  el.textContent = formatBdtPrice(price);
  el.setAttribute("data-price", String(price));
}
function getSizeChartData(categoryKey) {
  var cfg = (window.SITE_LINKS && window.SITE_LINKS.sizeChart) || {};
  var data = (cfg.byCategory && categoryKey && cfg.byCategory[categoryKey]) || cfg.default;
  return data || null;
}
function escapeHtmlText(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function buildSizeChartTableHtml(data) {
  if (!data) return "";
  var html = "";
  if (Array.isArray(data.regularFit) && data.regularFit.length) {
    var headers = data.headers || {};
    html +=
      '<div class="pqv-sc-card">' +
      '<div class="pqv-sc-card-title">' +
      escapeHtmlText(data.tableTitle || "Regular Fit (Inch)") +
      "</div>" +
      "<table><thead><tr><th>" +
      escapeHtmlText(headers.size || "Size") +
      "</th><th>" +
      escapeHtmlText(headers.length || "Length") +
      "</th><th>" +
      escapeHtmlText(headers.width || "Width") +
      "</th><th>" +
      escapeHtmlText(headers.sleeve || "Sleeve") +
      "</th></tr></thead><tbody>" +
      data.regularFit
        .map(function (row) {
          return (
            "<tr><td>" +
            escapeHtmlText(row.size) +
            "</td><td>" +
            escapeHtmlText(row.length) +
            "</td><td>" +
            escapeHtmlText(row.width) +
            "</td><td>" +
            escapeHtmlText(row.sleeve) +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>";
  }
  if (Array.isArray(data.customSize) && data.customSize.length) {
    html +=
      '<div class="pqv-sc-card">' +
      '<div class="pqv-sc-card-title">Custom Size Charge</div>' +
      "<table><thead><tr><th>Length</th><th>Extra</th><th>Width</th><th>Extra</th></tr></thead><tbody>" +
      data.customSize
        .map(function (row) {
          return (
            "<tr><td>" +
            escapeHtmlText(row.length) +
            "</td><td>" +
            (row.lengthExtra ? "৳" + escapeHtmlText(row.lengthExtra) : "—") +
            "</td><td>" +
            escapeHtmlText(row.width) +
            "</td><td>" +
            (row.widthExtra ? "৳" + escapeHtmlText(row.widthExtra) : "—") +
            "</td></tr>"
          );
        })
        .join("") +
      "</tbody></table></div>";
  }
  return html;
}
/* ----------------------------------------------------------------------
   SECTION 4: কুইক-ভিউ মডাল — গ্যালারি ও অন্যান্য HTML বিল্ডার
   প্রোডাক্টে ক্লিক করলে যে পপআপ (Quick View) খোলে, তার ছবি গ্যালারি,
   সাইজ চার্ট, রিলেটেড প্রোডাক্ট ইত্যাদির HTML এখান থেকে তৈরি হয়।
   ---------------------------------------------------------------------- */
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
function fileNameFromProductUrl(url) {
  var clean = String(url || "").split("?")[0].split("#")[0];
  var parts = clean.split("/");
  var file = parts[parts.length - 1] || "";
  try {
    file = decodeURIComponent(file);
  } catch (e) {}
  return file;
}
function colorLabelFromImageUrl(url) {
  var base = fileNameFromProductUrl(url)
    .replace(/\.(jpe?g|png|webp|gif|avif)$/i, "")
    .replace(/womens?-two-piece-dress/gi, "")
    .replace(/two-piece-dress/gi, "")
    .replace(/premium-tc-cotton/gi, "")
    .replace(/tc-cotton/gi, "")
    .replace(/premium-/gi, "")
    .replace(/-bangladesh.*$/i, "")
    .replace(/muslim-abaya/gi, "")
    .replace(/for-women/gi, "")
    .replace(/\bgowns?\b/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\btc cotton\b/gi, "")
    .replace(/\bprinted\b/gi, "")
    .replace(/\blong kurti\b/gi, "")
    .replace(/\bkurti\b/gi, "")
    .replace(/\bkurta\b/gi, "")
    .replace(/\bdress\b/gi, "")
    .replace(/\bfashion\b/gi, "")
    .replace(/\bwebp\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return "Color";
  var words = base.split(" ").filter(Boolean);
  if (words.length > 3) words = words.slice(0, 3);
  return words
    .join(" ")
    .replace(/\b\w/g, function (ch) {
      return ch.toUpperCase();
    });
}
function colorKeyFromLabel(label) {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function galleryLooksLikeColorways(p) {
  if (!p) return false;
  var label = String(p.colorLabel || p.color || "").toLowerCase();
  if (label.indexOf("multiple") !== -1) return true;
  if (Array.isArray(p.colorVariants) && p.colorVariants.length > 1) return true;
  var gallery = Array.isArray(p.images) ? p.images : [];
  if (gallery.length < 2) return false;
  for (var i = 0; i < gallery.length; i++) {
    if (/(^|[-_\s])(back|side)(\.|[-_\s]|$)/i.test(String(gallery[i] || ""))) return false;
  }
  return true;
}
function getProductColorVariants(p) {
  if (!p) return [];
  if (Array.isArray(p.colorVariants) && p.colorVariants.length) {
    return p.colorVariants
      .map(function (row) {
        if (!row) return null;
        var image = resolveCardImageSrc({ image: row.image || row.src || "" });
        var colorLabel = String(row.colorLabel || row.label || row.color || "").trim();
        if (!colorLabel && image) colorLabel = colorLabelFromImageUrl(image);
        if (!image && !colorLabel) return null;
        return {
          color: String(row.color || colorKeyFromLabel(colorLabel)),
          colorLabel: colorLabel,
          image: image
        };
      })
      .filter(Boolean);
  }
  var gallery = Array.isArray(p.images) && p.images.length ? p.images : [];
  if (galleryLooksLikeColorways(p) && gallery.length > 1) {
    var seen = {};
    var out = [];
    gallery.forEach(function (raw) {
      var image = resolveCardImageSrc({ image: raw });
      if (!image || seen[image]) return;
      seen[image] = true;
      var colorLabel = colorLabelFromImageUrl(image);
      out.push({
        color: colorKeyFromLabel(colorLabel),
        colorLabel: colorLabel,
        image: image
      });
    });
    if (out.length > 1) return out;
  }
  if (p.color || p.colorLabel) {
    return [
      {
        color: String(p.color || colorKeyFromLabel(p.colorLabel)),
        colorLabel: String(p.colorLabel || p.color || ""),
        image: resolveCardImageSrc(p)
      }
    ];
  }
  return [];
}
function shopProductHasColorChoice(p) {
  return getProductColorVariants(p).length > 1;
}
function getSelectedColorVariantForIdx(scopeRoot, idx, product) {
  var variants = getProductColorVariants(product);
  if (scopeRoot) {
    var pill = scopeRoot.querySelector(".pqv-color-opt.is-active[data-product-idx='" + idx + "']");
    if (pill) {
      return {
        color: pill.getAttribute("data-color-value") || "",
        colorLabel: pill.getAttribute("data-color-label") || "",
        image: pill.getAttribute("data-color-image") || ""
      };
    }
  }
  return variants[0] || {
    color: (product && product.color) || "",
    colorLabel: (product && product.colorLabel) || "",
    image: product ? resolveCardImageSrc(product) : ""
  };
}
function applySelectedColorToProduct(product, colorVariant) {
  if (!product) return product;
  if (!colorVariant) return product;
  var next = Object.assign({}, product);
  if (colorVariant.color) next.color = colorVariant.color;
  if (colorVariant.colorLabel) next.colorLabel = colorVariant.colorLabel;
  if (colorVariant.image) next.image = colorVariant.image;
  return next;
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
  escapeHtml(displayFabricLabel(p.fabric, "")) +
  " | Premium Muslim Fashion, Delivering Nationwide Across Bangladesh.</p>"
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
        '<div class="pqv-related-meta"><span class="pqv-related-name" lang="en">' +
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
    '<div class="pqv-sc-title">Size Chart</div>' +
    '<div id="sizeChartBody"></div>' +
    '<p id="sizeChartError" class="pqv-sc-error" hidden>Size chart is not available right now. Please contact us for size details.</p>' +
    "</div>";
  document.body.appendChild(el);
  el.addEventListener("click", function (ev) {
    if (ev.target.closest("[data-sc-close]")) closeSizeChartModal();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") closeSizeChartModal();
  });
}
function openSizeChartModal(categoryKey) {
  ensureSizeChartModal();
  var modal = document.getElementById("sizeChartModal");
  var body = document.getElementById("sizeChartBody");
  var err = document.getElementById("sizeChartError");
  if (!modal || !body) return;
  var data = getSizeChartData(categoryKey);
  var html = buildSizeChartTableHtml(data);
  body.innerHTML = html;
  body.hidden = !html;
  if (err) err.hidden = !!html;
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
  var colorPills = modal.querySelectorAll(".pqv-color-opt");
  var colorMatched = false;
  colorPills.forEach(function (pill) {
    var match = (pill.getAttribute("data-color-image") || "") === src;
    if (match) colorMatched = true;
    pill.classList.toggle("is-active", match);
    pill.setAttribute("aria-pressed", match ? "true" : "false");
  });
  if (colorMatched) {
    var specColor = modal.querySelector("#pqvSpecColor");
    var activeColor = modal.querySelector(".pqv-color-opt.is-active");
    if (specColor && activeColor) {
      specColor.textContent = activeColor.getAttribute("data-color-label") || "";
    }
  }
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
/* ----------------------------------------------------------------------
   SECTION 5: কুইক-ভিউ মডাল — ইভেন্ট বাইন্ডিং
   পপআপের ভেতরের বাটন/সাইজ/কালার ক্লিক করলে কী হবে, সেই ইভেন্ট লিসেনার
   এখানে সেট হয়।
   ---------------------------------------------------------------------- */
function bindPqvInteractions(p, idx, categoryKey, scopeRoot) {
  var modal = scopeRoot || getActivePqvScope();
  if (!modal) return;
  categoryKey =
    categoryKey || modal.getAttribute("data-category-key") || getShopCategoryKey() || "";
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
  modal.querySelectorAll(".pqv-color-opt").forEach(function (btn) {
    btn.addEventListener("click", function () {
      modal.querySelectorAll(".pqv-color-opt").forEach(function (b) {
        if (b.getAttribute("data-product-idx") !== String(idx)) return;
        b.classList.remove("is-active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-pressed", "true");
      var specColor = modal.querySelector("#pqvSpecColor");
      if (specColor) specColor.textContent = btn.getAttribute("data-color-label") || "";
      var img = btn.getAttribute("data-color-image") || "";
      var thumbs = modal.querySelectorAll(".pqv-thumb");
      for (var t = 0; t < thumbs.length; t++) {
        if (thumbs[t].getAttribute("data-src") === img) {
          setPqvGallerySlide(modal, t);
          break;
        }
      }
    });
  });
  modal.querySelectorAll(".pqv-size-opt, .pqv-length-opt, .pqv-type-opt, .pqv-body-opt, .pqv-palazzo-opt").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var groupClass = btn.classList.contains("pqv-type-opt")
        ? ".pqv-type-opt"
        : btn.classList.contains("pqv-length-opt")
          ? ".pqv-length-opt"
          : btn.classList.contains("pqv-palazzo-opt")
            ? ".pqv-palazzo-opt"
          : btn.classList.contains("pqv-body-opt")
            ? ".pqv-body-opt"
            : ".pqv-size-opt";
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
      openSizeChartModal(chartBtn.getAttribute("data-chart-category") || "");
    });
  }
  var customSizeBtnEl = modal.querySelector("[data-pqv-custom-size]");
  if (customSizeBtnEl && typeof window.openCustomSizeModal === "function") {
    customSizeBtnEl.addEventListener("click", function () {
      window.openCustomSizeModal({
        id: customSizeBtnEl.getAttribute("data-product-id"),
        name: customSizeBtnEl.getAttribute("data-product-name"),
        price: Number(customSizeBtnEl.getAttribute("data-product-price")) || 0,
        image: customSizeBtnEl.getAttribute("data-product-image"),
        category: customSizeBtnEl.getAttribute("data-category")
      });
    });
  }
  var jumpDesc = modal.querySelector("[data-pqv-jump-desc]");
  if (jumpDesc) {
    jumpDesc.addEventListener("click", function () {
      var block = modal.querySelector("#pqvDescBlock");
      if (block) block.scrollIntoView({ behavior: "smooth", block: "start" });
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
  bindPqvWholesale(modal);
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
    existing.className = "pqv pqv-overlay";
    if (!existing.querySelector(".pqv-dialog")) {
      existing.innerHTML = getQuickViewModalShellHtml();
    }
    return existing;
  }
  var modal = document.createElement("div");
  modal.id = "productQuickView";
  modal.className = "pqv pqv-overlay";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = getQuickViewModalShellHtml();
  document.body.appendChild(modal);
  modal.addEventListener("click", function (ev) {
    if (ev.target === modal || ev.target.closest("[data-pqv-close]")) {
      closeProductQuickView();
    }
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
  return modal;
}
/* ----------------------------------------------------------------------
   SECTION 6: মোবাইল স্টিকি অর্ডার বার
   কুইক-ভিউ পপআপে স্ক্রল করলে নিচে ফিক্সড "Add to Cart / Buy Now" বার
   দেখানোর জন্য এই ফাংশনগুলো।
   ---------------------------------------------------------------------- */
function ensureStickyOrderBarStyles() {
  if (document.getElementById("sticky-order-bar-style")) return;
  var style = document.createElement("style");
  style.id = "sticky-order-bar-style";
  style.textContent =
    "#stickyOrderBar{position:fixed;left:0;right:0;bottom:64px;z-index:600;" +
    "background:#fff;border-top:1px solid #ececec;box-shadow:0 -3px 14px rgba(0,0,0,.08);" +
    "display:none;padding:10px 14px;gap:10px;}" +
    "@media (min-width:769px){#stickyOrderBar{display:none !important;}}" +
    "#stickyOrderBar.is-visible{display:flex;}" +
    "#stickyOrderBar .sob-btn{flex:1;border-radius:10px;border:1.5px solid #111;" +
    "background:#fff;color:#111;font-size:13.5px;font-weight:700;padding:12px 0;cursor:pointer;" +
    "font-family:inherit;text-align:center;text-decoration:none;}" +
    "#stickyOrderBar .sob-buy{background:#111;color:#fff;}" +
    "@media (max-width:768px){body.pqv-open{padding-bottom:138px;}}";
  document.head.appendChild(style);
}

var stickyOrderObserver = null;

function initStickyOrderBar(root) {
  teardownStickyOrderBar();
  var actionsRow = root.querySelector(".pqv-actions-row");
  if (!actionsRow || typeof IntersectionObserver !== "function") return;
  ensureStickyOrderBarStyles();

  var bar = document.getElementById("stickyOrderBar");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "stickyOrderBar";
    document.body.appendChild(bar);
  }
  bar.innerHTML =
    '<button type="button" class="sob-btn sob-cart">Add to Cart</button>' +
    '<button type="button" class="sob-btn sob-buy">Buy Now</button>' +
    '<a class="sob-btn sob-msg" target="_blank" rel="noopener">Send Message</a>';

  bar.querySelector(".sob-cart").addEventListener("click", function () {
    var realBtn = actionsRow.querySelector(".pqv-act-cart");
    if (realBtn && !realBtn.disabled) realBtn.click();
  });
  bar.querySelector(".sob-buy").addEventListener("click", function () {
    var realBtn = actionsRow.querySelector(".pqv-act-buy");
    if (realBtn && !realBtn.disabled) realBtn.click();
  });
  var cartBtn = actionsRow.querySelector(".pqv-act-cart");
  var buyBtn = actionsRow.querySelector(".pqv-act-buy");
  var stickyCart = bar.querySelector(".sob-cart");
  var stickyBuy = bar.querySelector(".sob-buy");
  if (cartBtn && cartBtn.disabled && stickyCart) {
    stickyCart.disabled = true;
    stickyCart.textContent = cartBtn.textContent || "Out of Stock";
  }
  if (buyBtn && buyBtn.disabled && stickyBuy) {
    stickyBuy.disabled = true;
  }
  var msgBtn = actionsRow.querySelector(".pqv-act-msg");
  var stickyMsg = bar.querySelector(".sob-msg");
  if (msgBtn && stickyMsg) stickyMsg.href = msgBtn.getAttribute("href") || "#";

  stickyOrderObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        var scrolledPast = entry.boundingClientRect.bottom < 0;
        bar.classList.toggle("is-visible", scrolledPast);
      });
    },
    { threshold: 0 }
  );
  stickyOrderObserver.observe(actionsRow);
}

function teardownStickyOrderBar() {
  if (stickyOrderObserver) {
    stickyOrderObserver.disconnect();
    stickyOrderObserver = null;
  }
  var bar = document.getElementById("stickyOrderBar");
  if (bar) bar.classList.remove("is-visible");
}
function closeProductQuickView(skipHistory) {
  teardownStickyOrderBar();
  var root = shopCartCtx.root;
  if (root && shopCartCtx.gridHtml) {
    root.innerHTML = shopCartCtx.gridHtml;
    root.className = shopCartCtx.gridClassName || "";
    shopCartCtx.gridHtml = null;
    shopCartCtx.gridClassName = "";
    document.body.classList.remove("pqv-open", "shop-product-open");
    if (!skipHistory && history.state && history.state.maProduct != null) {
      try {
        history.replaceState({}, "", window.location.pathname + window.location.search);
      } catch (e) {}
    }
    window.scrollTo(0, 0);
    refreshShopCardsAfterCartChange();
    return;
  }
  document.body.classList.remove("pqv-open", "shop-product-open");
}
function openProductQuickView(idx) {
  var products = shopCartCtx.products;
  if (!products || !products[idx]) return;
  var p = products[idx];
  var root = shopCartCtx.root || document.getElementById("list");
  if (!root) return;
  var waLink = (window.SITE_MEDIA && window.SITE_MEDIA.whatsappOrderLink) || "https://wa.me/8801970831783";
  var categoryKey = getShopCategoryKey();
  if (!shopCartCtx.gridHtml && root.querySelector("#productGrid")) {
    shopCartCtx.gridHtml = root.innerHTML;
    shopCartCtx.gridClassName = root.className || "";
  }
  var cardQty = getShopCardQty(root, idx);
  var html = buildQuickViewPanelHtml(p, idx, waLink, categoryKey, products);
  root.className = (shopCartCtx.gridClassName || "") + " shop-product-detail";
  root.setAttribute("data-category-key", categoryKey);
  root.innerHTML = html;
  bindPqvInteractions(p, idx, categoryKey, root);
  initStickyOrderBar(root);
  var pqvQtyInput = root.querySelector("#pqvQty");
  if (pqvQtyInput) setPqvQtyInput(pqvQtyInput, cardQty);
  var legacy = document.getElementById("productQuickView");
  if (legacy) {
    legacy.hidden = true;
    legacy.setAttribute("aria-hidden", "true");
  }
  document.body.classList.remove("pqv-open");
  document.body.classList.add("shop-product-open");
  window.scrollTo(0, 0);
  if (history.pushState) {
    history.pushState({ maProduct: idx }, "", "#p=" + encodeURIComponent(p.id || String(idx)));
  }
  fireShopViewContent(p, categoryKey);
  updatePqvGalleryNav(root);
}
function buildPqvWholesaleSectionHtml(sizes, idx, isAbaya) {
  var sizeLabel = isAbaya ? "Length" : "Size";
  var rows = sizes
    .map(function (sizeVal) {
      var safeSize = escapeHtml(String(sizeVal));
      return (
        '<div class="pqv-wh-row">' +
        '<span class="pqv-wh-size-label">' +
        escapeHtml(sizeLabel) +
        " " +
        escapeHtml(formatSizeLabel(sizeVal)) +
        "</span>" +
        '<div class="ma-qty-stepper pqv-wh-qty" role="group" aria-label="Quantity for size ' +
        safeSize +
        '">' +
        '<button type="button" class="ma-qty-stepper__btn pqv-wh-qty-btn" data-pqv-wh-qty="minus" data-wh-size="' +
        safeSize +
        '" aria-label="Decrease">−</button>' +
        '<input type="text" class="ma-qty-stepper__input pqv-wh-qty-input" data-wh-size="' +
        safeSize +
        '" value="0" inputmode="numeric" pattern="[0-9]*" lang="en" autocomplete="off" aria-label="Quantity">' +
        '<button type="button" class="ma-qty-stepper__btn pqv-wh-qty-btn" data-pqv-wh-qty="plus" data-wh-size="' +
        safeSize +
        '" aria-label="Increase">+</button>' +
        "</div></div>"
      );
    })
    .join("");
  return (
    '<div class="pqv-wholesale" id="pqvWholesale">' +
    '<button type="button" class="pqv-wholesale-toggle" data-pqv-wh-toggle="1" aria-expanded="false">' +
    '<span class="pqv-wholesale-toggle__title">Wholesale order</span>' +
    '<span class="pqv-wholesale-toggle__hint">Multiple sizes · same color</span>' +
    '<span class="pqv-wholesale-toggle__chev" aria-hidden="true">▼</span>' +
    "</button>" +
    '<div class="pqv-wholesale-panel" hidden>' +
    '<p class="pqv-wholesale-hint">Enter quantity for each size. Leave 0 to skip. Example: Length 50 × 5, Length 52 × 10.</p>' +
    '<div class="pqv-wholesale-grid">' +
    rows +
    "</div>" +
    '<p class="pqv-wholesale-total">Total pieces: <strong id="pqvWhTotal">0</strong></p>' +
    '<button type="button" class="pqv-act pqv-act-cart pqv-wholesale-add" data-product-idx="' +
    idx +
    '" data-action="add-bulk" disabled>Add all sizes to cart</button>' +
    "</div></div>"
  );
}
function updatePqvWholesaleTotal(modal) {
  if (!modal) return;
  var totalEl = modal.querySelector("#pqvWhTotal");
  var addBtn = modal.querySelector("[data-action='add-bulk']");
  if (!totalEl || !addBtn) return;
  var total = 0;
  modal.querySelectorAll(".pqv-wh-qty-input[data-wh-size]").forEach(function (input) {
    total += parseWholesaleQtyValue(input.value);
  });
  totalEl.textContent = String(total);
  addBtn.disabled = total <= 0;
  addBtn.textContent = total > 0 ? "Add " + total + " pcs to cart" : "Add all sizes to cart";
}
function resetPqvWholesaleInputs(modal) {
  if (!modal) return;
  modal.querySelectorAll(".pqv-wh-qty-input[data-wh-size]").forEach(function (input) {
    input.value = "0";
  });
  updatePqvWholesaleTotal(modal);
}
function bindPqvWholesale(modal) {
  var block = modal.querySelector("#pqvWholesale");
  if (!block || block.getAttribute("data-wh-bound") === "1") return;
  block.setAttribute("data-wh-bound", "1");
  var toggle = block.querySelector("[data-pqv-wh-toggle]");
  var panel = block.querySelector(".pqv-wholesale-panel");
  if (toggle && panel) {
    toggle.addEventListener("click", function () {
      var open = panel.hidden;
      panel.hidden = !open;
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.classList.toggle("is-open", open);
      if (open) updatePqvWholesaleTotal(modal);
    });
  }
  block.addEventListener("click", function (ev) {
    var btn = ev.target.closest("[data-pqv-wh-qty]");
    if (!btn || !block.contains(btn)) return;
    var sizeKey = btn.getAttribute("data-wh-size") || "";
    var input = modal.querySelector('.pqv-wh-qty-input[data-wh-size="' + sizeKey + '"]');
    if (!input) return;
    var cur = parseWholesaleQtyValue(input.value);
    var next = btn.getAttribute("data-pqv-wh-qty") === "plus" ? cur + 1 : Math.max(0, cur - 1);
    input.value = String(next);
    updatePqvWholesaleTotal(modal);
  });
  block.querySelectorAll(".pqv-wh-qty-input[data-wh-size]").forEach(function (input) {
    input.addEventListener("input", function () {
      input.value = String(parseWholesaleQtyValue(input.value));
      updatePqvWholesaleTotal(modal);
    });
    input.addEventListener("blur", function () {
      input.value = String(parseWholesaleQtyValue(input.value));
      updatePqvWholesaleTotal(modal);
    });
  });
  updatePqvWholesaleTotal(modal);
}
function buildTwoPiecePqvSizeHtml(p, idx, twoPieceCfg, chartBtn, customSizeBtn) {
  var bodyHtml =
    '<div class="pqv-field pqv-field-body"><span class="pqv-field-label">Body Size</span><div class="pqv-opt-group">' +
    (Array.isArray(twoPieceCfg.bodySizes) && twoPieceCfg.bodySizes.length
      ? buildPqvOptionPills(twoPieceCfg.bodySizes, idx, "pqv-body-opt", "data-body-value")
      : '<button type="button" class="pqv-opt-btn is-active" aria-pressed="true" disabled>' +
        escapeHtml(twoPieceCfg.bodySizeLabel) +
        "</button>") +
    "</div></div>";
  var dressLengths = p && Array.isArray(p.dressLengths) ? p.dressLengths : [];
  var palazzoLengths = p && Array.isArray(p.palazzoLengths) ? p.palazzoLengths : [];
  var extraHtml = "";
  if (dressLengths.length) {
    extraHtml +=
      '<div class="pqv-field pqv-field-size"><div class="pqv-field-head"><span class="pqv-field-label">Dress Length</span>' +
      (palazzoLengths.length ? "" : chartBtn) +
      '</div><div class="pqv-opt-group pqv-opt-group-wrap">' +
      buildPqvOptionPills(dressLengths, idx, "pqv-length-opt", "data-length-value") +
      (palazzoLengths.length ? "" : customSizeBtn) +
      "</div></div>";
  }
  if (palazzoLengths.length) {
    extraHtml +=
      '<div class="pqv-field pqv-field-size"><div class="pqv-field-head"><span class="pqv-field-label">Palazzo Length</span>' +
      chartBtn +
      '</div><div class="pqv-opt-group pqv-opt-group-wrap">' +
      buildPqvOptionPills(palazzoLengths, idx, "pqv-palazzo-opt", "data-palazzo-value") +
      customSizeBtn +
      "</div></div>";
  }
  if (!dressLengths.length && !palazzoLengths.length) {
    extraHtml =
      Array.isArray(p.sizeSpecs) && p.sizeSpecs.length
        ? p.sizeSpecs
            .map(function (spec, specI) {
              var isLast = specI === p.sizeSpecs.length - 1;
              return (
                '<div class="pqv-field pqv-field-size"><div class="pqv-field-head"><span class="pqv-field-label">' +
                escapeHtml(spec.label) +
                "</span>" +
                (isLast ? chartBtn : "") +
                '</div><div class="pqv-opt-group pqv-opt-group-wrap">' +
                '<button type="button" class="pqv-opt-btn is-active" aria-pressed="true" disabled>' +
                escapeHtml(spec.value) +
                "</button>" +
                (isLast ? customSizeBtn : "") +
                "</div></div>"
              );
            })
            .join("")
        : '<div class="pqv-field pqv-field-size"><div class="pqv-field-head"><span class="pqv-field-label">Length Size</span>' +
          chartBtn +
          '</div><div class="pqv-opt-group pqv-opt-group-wrap">' +
          '<button type="button" class="pqv-opt-btn is-active" aria-pressed="true" disabled>' +
          escapeHtml(twoPieceCfg.lengthSizeLabel) +
          "</button>" +
          customSizeBtn +
          "</div></div>";
  }
  return bodyHtml + extraHtml;
}
/* ----------------------------------------------------------------------
   SECTION 7: কুইক-ভিউ প্যানেলের সম্পূর্ণ HTML
   প্রোডাক্ট পপআপের পুরো কাঠামো (ছবি, দাম, সাইজ, বাটন) এখানে জোড়া লাগানো
   হয়ে একটা বড় HTML স্ট্রিং তৈরি হয়।
   ---------------------------------------------------------------------- */
function buildQuickViewPanelHtml(p, idx, waLink, categoryKey, allProducts) {
  var defaultType = getDefaultProductType(p, categoryKey);
  var productPrice = resolveProductPrice(p, categoryKey, defaultType);
  var imgFallback = getCategoryFallbackImage(categoryKey || "");
  var gallery = collectGalleryImages(p, allProducts || []);
  var imgSrc = escapeHtml(gallery[0] || resolveCardImageSrc(p));
  var priceText = formatBdtPrice(productPrice);
  var fabricText = escapeHtml(displayFabricLabel(p.fabric, "Premium Georgette"));
  var isAbaya = typeof isAbayaProduct === "function" && isAbayaProduct(p, categoryKey);
  var isTwoPiece = typeof isTwoPieceProduct === "function" && isTwoPieceProduct(p, categoryKey);
  var abayaCfg = isAbaya && typeof getAbayaSizeConfig === "function" ? getAbayaSizeConfig(p) : null;
  var twoPieceCfg = isTwoPiece && typeof getTwoPieceSizeConfig === "function" ? getTwoPieceSizeConfig(p) : null;
  var sizes =
    isAbaya && abayaCfg
      ? abayaCfg.lengthSizes.slice()
      : isTwoPiece && twoPieceCfg
        ? twoPieceCfg.lengthSizes.slice()
      : Array.isArray(p.sizes) && p.sizes.length
        ? p.sizes
        : ["Free Size"];
  var types = getProductTypes(p, categoryKey);
  var lengthVal = p.detailNote ? String(p.detailNote).replace(/^Length:\s*/i, "").trim() : "";
  var colorLabel = p.colorLabel ? escapeHtml(p.colorLabel) : p.color ? escapeHtml(p.color) : "";
  var chartData = getSizeChartData(categoryKey);
  var chartBtn = chartData
    ? '<button type="button" class="pqv-size-chart-link" data-pqv-size-chart="1" data-chart-category="' +
      escapeHtml(categoryKey || "") +
      '">Size chart</button>'
    : "";
  var customSizeBtn =
    chartData && Array.isArray(chartData.customSize) && chartData.customSize.length
      ? '<button type="button" class="pqv-opt-btn pqv-custom-size-btn" data-pqv-custom-size="1" ' +
        'data-product-id="' + escapeHtml(p.id || "") + '" data-product-name="' + escapeHtml(p.name || "") + '" ' +
        'data-product-price="' + productPrice + '" data-product-image="' + escapeHtml(imgSrc || "") + '" ' +
        'data-category="' + escapeHtml(categoryKey || "") + '">Custom Size</button>'
      : "";
  var typeField =
    types.length > 1
      ? '<div class="pqv-field"><span class="pqv-field-label">Type</span><div class="pqv-opt-group pqv-type-group">' +
        buildPqvTypePills(types, idx, p, categoryKey) +
        "</div></div>"
      : "";
  var colorVariants = getProductColorVariants(p);
  var colorField = "";
  if (colorVariants.length > 1) {
    colorField =
      '<div class="pqv-field"><span class="pqv-field-label">Color</span><div class="pqv-opt-group pqv-opt-group-wrap pqv-color-group">' +
      colorVariants
        .map(function (row, i) {
          return (
            '<button type="button" class="pqv-opt-btn pqv-color-opt' +
            (i === 0 ? " is-active" : "") +
            '" data-product-idx="' +
            idx +
            '" data-color-value="' +
            escapeHtml(row.color) +
            '" data-color-label="' +
            escapeHtml(row.colorLabel) +
            '" data-color-image="' +
            escapeHtml(row.image || "") +
            '" aria-pressed="' +
            (i === 0 ? "true" : "false") +
            '">' +
            escapeHtml(row.colorLabel) +
            "</button>"
          );
        })
        .join("") +
      "</div></div>";
  } else if (colorLabel && colorLabelDiffersFromName(p, colorLabel)) {
    colorField =
      '<div class="pqv-field"><span class="pqv-field-label">Color</span><div class="pqv-opt-group">' +
      '<button type="button" class="pqv-opt-btn is-active" aria-pressed="true">' +
      colorLabel +
      "</button></div></div>";
  }
  var shortNoteRaw = String(getProductShortNote(p, categoryKey) || "").trim();
  var stock = productStockStatus(p);
  var descHtml = getProductDescriptionHtml(p, categoryKey);
  var relatedHtml = buildPqvRelatedHtml(p, idx, allProducts, categoryKey);
  var specRows =
    "<ul class='pqv-spec-table'>" +
    "<li><span>Fabric</span><strong>" +
    fabricText +
    "</strong></li>" +
    (colorVariants.length
      ? "<li><span>Color</span><strong id='pqvSpecColor'>" +
        escapeHtml(colorVariants[0].colorLabel || "") +
        "</strong></li>"
      : colorLabel
        ? "<li><span>Color</span><strong id='pqvSpecColor'>" + colorLabel + "</strong></li>"
        : "") +
    (Array.isArray(p.sizeSpecs) && p.sizeSpecs.length
      ? p.sizeSpecs
          .map(function (spec) {
            return (
              "<li><span>" +
              escapeHtml(spec.label) +
              "</span><strong>" +
              escapeHtml(spec.value) +
              "</strong></li>"
            );
          })
          .join("")
      : lengthVal
        ? "<li><span>Length</span><strong>" + escapeHtml(lengthVal) + "</strong></li>"
        : "") +
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
  var sizeField =
    isAbaya && abayaCfg
      ? '<div class="pqv-field pqv-field-body"><span class="pqv-field-label">Body Size</span><div class="pqv-opt-group">' +
        (Array.isArray(abayaCfg.bodySizes) && abayaCfg.bodySizes.length
          ? buildPqvOptionPills(abayaCfg.bodySizes, idx, "pqv-body-opt", "data-body-value")
          : '<button type="button" class="pqv-opt-btn is-active" aria-pressed="true" disabled>' +
            escapeHtml(abayaCfg.bodySizeLabel) +
            "</button>") +
        "</div></div>" +
        '<div class="pqv-field pqv-field-size"><div class="pqv-field-head"><span class="pqv-field-label">Length Size</span>' +
        chartBtn +
        '</div><div class="pqv-opt-group pqv-opt-group-wrap">' +
        buildPqvOptionPills(sizes, idx, "pqv-length-opt", "data-length-value", formatSizeLabel) +
        customSizeBtn +
        "</div></div>"
      : isTwoPiece && twoPieceCfg
        ? buildTwoPiecePqvSizeHtml(p, idx, twoPieceCfg, chartBtn, customSizeBtn)
      : '<div class="pqv-field pqv-field-size"><div class="pqv-field-head"><span class="pqv-field-label">Size</span>' +
        chartBtn +
        '</div><div class="pqv-opt-group pqv-opt-group-wrap">' +
        buildPqvOptionPills(sizes, idx, "pqv-size-opt", "data-size-value", formatSizeLabel) +
        customSizeBtn +
        "</div></div>";
  var isPanjabi =
    typeof isPanjabiProduct === "function" &&
    isPanjabiProduct(p, categoryKey);
  var showWholesale =
    ((isAbaya && sizes.length > 1) ||
     (!isTwoPiece && !isPanjabi && sizes.length > 1));
  var wholesaleHtml = showWholesale ? buildPqvWholesaleSectionHtml(sizes, idx, isAbaya) : "";
  return (
    '<div class="pqv-muslim-abaya">' +
    '<div class="pqv-top">' +
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
    '" fetchpriority="high" decoding="async" onerror="this.onerror=null;this.src=\'' +
    imgFallback.replace(/'/g, "\\'") +
    '\'">' +
    '<button type="button" class="pqv-nav pqv-nav-next" data-pqv-nav="next" aria-label="Next image" hidden>' +
    '<span aria-hidden="true">&#10095;</span></button>' +
    "</div></div></div>" +
    '<div class="pqv-panel-col">' +
    '<div class="pqv-panel">' +
    '<button type="button" class="pqv-panel-back" data-pqv-close="1">&lsaquo; Back to products</button>' +
    '<h1 id="pqvTitle" class="pqv-title" lang="en">' +
    escapeHtml(p.name) +
    "</h1>" +
    '<p class="pqv-price" id="pqvPrice" data-price="' +
    productPrice +
    '">' +
    priceText +
    "</p>" +
    (shortNoteRaw
      ? '<p class="pqv-note">' + escapeHtml(shortNoteRaw) + "</p>"
      : "") +
    '<div class="pqv-options">' +
    typeField +
    colorField +
    sizeField +
    wholesaleHtml +
    "</div>" +
    '<div class="pqv-qty-row">' +
    '<span class="pqv-field-label pqv-qty-label">Quantity</span>' +
    '<div class="ma-qty-stepper pqv-qty" role="group" aria-label="Quantity">' +
    '<button type="button" class="ma-qty-stepper__btn pqv-qty-btn" data-pqv-qty="minus" aria-label="Decrease quantity">−</button>' +
    '<input type="text" id="pqvQty" class="ma-qty-stepper__input pqv-qty-input" value="1" inputmode="numeric" pattern="[0-9]*" lang="en" autocomplete="off" aria-label="Quantity">' +
    '<button type="button" class="ma-qty-stepper__btn pqv-qty-btn" data-pqv-qty="plus" aria-label="Increase quantity">+</button>' +
    "</div>" +
    '<span class="pqv-stock' +
    (stock.inStock ? "" : " is-oos") +
    '">' +
    escapeHtml(stock.label) +
    "</span>" +
    '<button type="button" class="pqv-jump-desc" data-pqv-jump-desc="1">Jump to Description <span aria-hidden="true">↓</span></button>' +
    "</div>" +
    '<div class="pqv-actions-row pqv-actions-row--three">' +
    '<button type="button" class="pqv-act pqv-act-cart" data-product-idx="' +
    idx +
    '" data-action="add"' +
    (stock.inStock ? "" : " disabled") +
    ">" +
    escapeHtml(stock.buttonLabel) +
    "</button>" +
    '<button type="button" class="pqv-act pqv-act-buy" data-product-idx="' +
    idx +
    '" data-action="buy-now"' +
    (stock.inStock ? "" : " disabled") +
    ">" +
    maShopBagIcon(16) +
    '<span lang="en">Buy Now</span></button>' +
    '<a class="pqv-act pqv-act-msg" href="' +
    waLink +
    "?text=" +
    encodeURIComponent(p.name + " \u0985\u09B0\u09CD\u09A1\u09BE\u09B0 \u0995\u09B0\u09A4\u09C7 \u099A\u09BE\u09AF\u09BC") +
    '" target="_blank" rel="noopener">Send Message</a>' +
    "</div>" +
    "</div>" +
    "</div>" +
    "</div>" +
    '<div class="pqv-bottom-row">' +
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
    "</div></div></div></div>" +
    relatedHtml +
    "</div>" +
    "</div>"
  );
}
/* ----------------------------------------------------------------------
   SECTION 8: গ্লোবাল ক্লিক হ্যান্ডলার
   পেজের যেকোনো জায়গায় কার্ট বাটন/বাই নাউ ক্লিক হলে সেটা এখানে ধরা হয়ে
   সঠিক প্রোডাক্টের সাথে ম্যাচ করানো হয়।
   ---------------------------------------------------------------------- */
function onGlobalShopCartClick(ev) {
  if (ev.type === "click" && ev.isTrusted === false) return;
  if (ev.target.closest(".ah-card") && !ev.target.closest("#productQuickView")) return;
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
      return;
    }
    if (!products || !products.length || !root.contains(ev.target)) return;
    var qtyBtn = ev.target.closest("[data-shop-qty]");
    if (qtyBtn && root.contains(qtyBtn)) {
      ev.preventDefault();
      ev.stopPropagation();
      var qIdx = parseInt(qtyBtn.getAttribute("data-product-idx"), 10);
      if (isNaN(qIdx) || !products[qIdx]) return;
      var categoryKey =
        getShopCategoryKey() || "";
      var cartQty = getShopCartQtyForProduct(products[qIdx]);
      if (cartQty > 0) {
        changeShopCartProductQty(
          products[qIdx],
          qtyBtn.getAttribute("data-shop-qty") === "plus" ? 1 : -1,
          categoryKey
        );
      } else {
        var next =
          getShopCardQty(root, qIdx) + (qtyBtn.getAttribute("data-shop-qty") === "plus" ? 1 : -1);
        setShopCardQty(root, qIdx, next);
      }
      return;
    }
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
  if (action !== "add" && action !== "buy-now" && action !== "add-bulk") return;
  if (!productIsInStock(products[idx])) {
    ev.preventDefault();
    return;
  }
  var categoryKey =
    getShopCategoryKey() || "";
  if (action === "add-bulk") {
    ev.preventDefault();
    ev.stopPropagation();
    var scopeBulk = inProductView ? pqvScope : root;
    var selectedTypeBulk = inProductView ? getSelectedTypeForIdx(scopeBulk, idx) : "";
    var entries = getPqvWholesaleEntries(scopeBulk);
    if (!entries.length) {
      alert("Enter quantity for at least one size.");
      return;
    }
    var cartItemBulk = applySelectedColorToProduct(
      Object.assign({}, products[idx], { _cartType: selectedTypeBulk }),
      getSelectedColorVariantForIdx(scopeBulk, idx, products[idx])
    );
    var addedQty = shopAddBulkProductsToCart(cartItemBulk, entries, categoryKey, selectedTypeBulk);
    if (addedQty > 0 && scopeBulk) resetPqvWholesaleInputs(scopeBulk);
    return;
  }
  if (
    !inProductView &&
    (shopProductHasTypeChoice(products[idx], categoryKey) || shopProductHasColorChoice(products[idx]))
  ) {
    ev.preventDefault();
    openProductQuickView(idx);
    return;
  }
  var scope = inProductView ? pqvScope : root;
  var selectedSize = getSelectedSizeForIdx(scope, idx);
  var selectedBodyValue = getSelectedBodyValueForIdx(scope, idx);
  var selectedType = inProductView ? getSelectedTypeForIdx(scope, idx) : "";
  var qty = inProductView ? getPqvQuantity(scope) : getShopCardQty(root, idx);
  ev.preventDefault();
  ev.stopPropagation();
  var cartItem = applySelectedColorToProduct(
    Object.assign({}, products[idx], { _cartType: selectedType }),
    getSelectedColorVariantForIdx(scope, idx, products[idx])
  );

  if (action === "buy-now") {
    if (!shopCartHasMatchingLine(cartItem, selectedSize, categoryKey, selectedBodyValue)) {
      shopAddProductToCart(cartItem, qty, selectedSize, categoryKey, selectedBodyValue);
    }
    var checkoutHref =
      typeof window.siteHref === "function" ? window.siteHref("/checkout") : "checkout.html";
    var cartLines =
      typeof loadStoreCart === "function" ? loadStoreCart({ readOnly: true }) : [];
    if (!cartLines.length) {
      alert("Please add at least one product to your cart.");
      return;
    }
    if (typeof flushStoreCartForCheckout === "function") {
      flushStoreCartForCheckout(cartLines);
    } else if (typeof persistStoreCart === "function") {
      persistStoreCart(cartLines);
      if (typeof markStoreCartSession === "function") markStoreCartSession();
    }
    window.location.href = checkoutHref;
    return;
  }
  shopAddProductToCart(cartItem, qty, selectedSize, categoryKey, selectedBodyValue);
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
function findProductIdxById(id) {
  var list = shopCartCtx.products || [];
  var target = String(id);
  for (var i = 0; i < list.length; i++) {
    if (list[i] && String(list[i].id) === target) return i;
  }
  return -1;
}
/* হোম/বাইরে থেকে #p=<id> বা #p-<idx> দিয়ে এসে নির্দিষ্ট প্রোডাক্টের বড় ভিউ খোলে */
function openProductFromLocationHash() {
  var hash = window.location.hash || "";
  var idx = -1;
  var byId = hash.match(/^#p=(.+)$/);
  if (byId) {
    idx = findProductIdxById(decodeURIComponent(byId[1]));
  } else {
    var byIdx = hash.match(/^#p-(\d+)$/);
    if (byIdx) idx = parseInt(byIdx[1], 10);
  }
  if (idx >= 0 && shopCartCtx.products && shopCartCtx.products[idx]) {
    openProductQuickView(idx);
  }
}
window.openProductFromLocationHash = openProductFromLocationHash;
window.openProductQuickView = openProductQuickView;
window.openProductQuickViewById = function (categoryKey, productId) {
  var key = String(categoryKey || "");
  var id = String(productId || "");
  if (!id) return false;
  var list = [];
  if (key && window.CATEGORY_PRODUCTS && window.CATEGORY_PRODUCTS[key]) {
    list = window.CATEGORY_PRODUCTS[key];
  } else {
    var cats = window.CATEGORY_PRODUCTS || {};
    Object.keys(cats).some(function (catKey) {
      var found = (cats[catKey] || []).some(function (row) {
        return row && String(row.id) === id;
      });
      if (!found) return false;
      key = catKey;
      list = cats[catKey];
      return true;
    });
  }
  if (!list || !list.length) return false;
  shopCartCtx.products = list;
  shopCartCtx.categoryKey = key;
  shopCartCtx.root = document.getElementById("list") || document.getElementById("homeSections") || shopCartCtx.root;
  var idx = findProductIdxById(id);
  if (idx < 0) return false;
  openProductQuickView(idx);
  return true;
};
window.closeProductQuickView = closeProductQuickView;
window.syncShopCartBadge = syncShopCartBadge;
window.resetShopCartContext = resetShopCartContext;
/* ----------------------------------------------------------------------
   SECTION 9: পেজ বুট / ইনিশিয়ালাইজেশন শিডিউলিং
   পেজ প্রথমবার লোড হওয়ার সময় কোন ক্যাটাগরি রেন্ডার হবে তা ঠিক করে।
   ---------------------------------------------------------------------- */
function getShopBootSpec() {
  var body = document.body;
  if (!body) return null;
  if (body.getAttribute("data-shop-hub") === "1") return { hub: true };
  var key =
    (document.documentElement && document.documentElement.getAttribute("data-shop-category")) ||
    body.getAttribute("data-shop-category") ||
    "";
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
/* ----------------------------------------------------------------------
   SECTION 10: সাইডবার ও ফিল্টার
   বাম পাশের ক্যাটাগরি লিস্ট, প্রাইস রেঞ্জ স্লাইডার, কালার ফিল্টার —
   সব এই সেকশনের ফাংশনগুলো দিয়ে তৈরি হয়।
   ---------------------------------------------------------------------- */
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
function buildProductListHtml(products) {
  function isPrimaryName(name) {
    var s = String(name || "").toLowerCase();
    return (
      s.indexOf(" - back") === -1 &&
      s.indexOf("- back") === -1 &&
      s.indexOf(" - side") === -1 &&
      s.indexOf("- side") === -1
    );
  }
  var seen = {};
  var items = [];
  products.forEach(function (p, idx) {
    if (!p || !p.name || !isPrimaryName(p.name)) return;
    var key = String(p.name).trim().toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    items.push({ name: p.name, idx: idx });
  });
  if (!items.length) return "";
  return (
    "<nav class='shop-product-list'>" +
    items
      .map(function (item) {
        return (
          "<a href='#p-" + item.idx + "' class='sidebar-product-link' data-idx='" + item.idx + "'>" +
          escapeHtml(item.name) +
          "</a>"
        );
      })
      .join("") +
    "</nav>"
  );
}
function buildShopSidebar(categoryKey, products) {
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
    "<a class='sidebar-all-category' href='" + escapeHtml(shopHref("/")) + "'>All Category</a>" +
    buildProductListHtml(products) +
    "<div class='sidebar-filter sidebar-filter-price'>" +
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
    "<div class='sidebar-filter sidebar-filter-colors'>" +
    "<h4>Color</h4>" +
    "<div class='color-filter-list' id='colorFilters'>" +
    colorChecks +
    "</div>" +
    "</div>" +
    "</aside>"
  );
}
  function resolveCardHoverImage(p, allProducts) {
  var gallery = collectGalleryImages(p, allProducts || []);
  var main = resolveCardImageSrc(p);
  for (var i = 0; i < gallery.length; i++) {
    if (gallery[i] && gallery[i] !== main) return gallery[i];
  }
  return "";
}
/* ----------------------------------------------------------------------
   SECTION 11 ★: প্রোডাক্ট কার্ডের ছবি ব্লক
   কার্ডের উপরের ছবি (হোভার করলে দ্বিতীয় ছবি দেখানো, sale ব্যাজ ইত্যাদি)।
   ---------------------------------------------------------------------- */
function buildCardImageBlock(p, idx, categoryKey, allProducts) {
  var main = resolveCardImageSrc(p);
  var hover = resolveCardHoverImage(p, allProducts);
  var imgFallback = getCategoryFallbackImage(categoryKey || "");
  var fb = imgFallback.replace(/'/g, "\\'");
  var errOn = "this.onerror=null;this.src='" + fb + "'";
  var hoverHtml = hover
    ? '<img class="card-img-hover" src="' +
      escapeHtml(hover) +
      '" alt="" loading="lazy" decoding="async" aria-hidden="true" onerror="this.removeAttribute(\'src\')">'
    : "";
  return (
    '<button type="button" class="img-wrap js-quickview-trigger" data-product-idx="' +
    idx +
    '" aria-label="' +
    escapeHtml("View " + p.name) +
    '">' +
    stockImageBadgeHtml(p) +
    '<span class="card-img-stack">' +
    '<img class="card-img-primary" src="' +
    escapeHtml(main) +
    '" alt="' +
    escapeHtml(p.name) +
    '" loading="lazy" decoding="async" onerror="' +
    errOn +
    '">' +
    hoverHtml +
    "</span>" +
    "</button>"
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
    abaya: "https://raw.githubusercontent.com/muslim-abaya-landingpage/Luxury-Dress-BD/main/images/Maroon%20Abaya%20Set.jpeg",
    "premium-two-piece": "images/pink-floral-printed-co-ord-set.jpeg",
    "cover-up": "images/Royal-Blue-Golden-Floral-Print.jpeg",
    "tops-kurti": "images/Black-White-Polka-Dots.jpeg",
    embroidery: "images/Black-Base-Rose-Floral.jpeg",
    karchupi: "images/Black-Base-Rose-Floral.jpeg",
    kaftan: "images/Baby-Pink-Floral-Print.jpeg",
    hijab: "images/Black-White-Polka-Dots.jpeg",
    panjabi: "https://raw.githubusercontent.com/muslim-abaya-landingpage/Luxury-Dress-BD/main/images/premium-white-islamic-mens-kurta-full-sleeve-outdoor-portrait-bangladesh.webp"
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
  var lengthVal = p.detailNote ? String(p.detailNote).replace(/^Length:\s*/i, "").trim() : "";
  var chips =
    "<div class='card-spec-chips'>" +
    "<span class='card-spec-chip'><span class='card-spec-k'>Fabric</span><span class='card-spec-v'>" +
    fabricText +
    "</span></span>";
  if (lengthVal) {
    chips +=
      "<span class='card-spec-chip'><span class='card-spec-k'>Length</span><span class='card-spec-v'>" +
      escapeHtml(lengthVal) +
      "</span></span>";
  }
  chips += "</div>";
  return (
    "<div class='card-specs'>" +
    chips +
    "<div class='card-size-block'>" +
    "<span class='card-size-heading'>Size</span>" +
    "<select class='card-size-select' data-size-idx='" +
    idx +
    "' aria-label='Select Size'>" +
    sizeOptions +
    "</select></div></div>"
  );
}
function buildTwoPieceSizeFields(p) {
  var cfg =
    typeof getTwoPieceSizeConfig === "function"
      ? getTwoPieceSizeConfig(p)
      : { bodySizeLabel: "42 (Free size)", lengthSizeLabel: "37-38 inch" };
  var dressLengths = p && Array.isArray(p.dressLengths) ? p.dressLengths : [];
  var palazzoLengths = p && Array.isArray(p.palazzoLengths) ? p.palazzoLengths : [];
  var hasCustomSpecs = p && Array.isArray(p.sizeSpecs) && p.sizeSpecs.length;
  var lengthRows = "";
  if (dressLengths.length || palazzoLengths.length) {
    if (dressLengths.length) {
      lengthRows +=
        "<div class='card-size-row'><span class='card-size-heading'>Dress Length</span>" +
        "<span class='card-body-size-val'>" +
        escapeHtml(dressLengths.join(", ") + " inches") +
        "</span></div>";
    }
    if (palazzoLengths.length) {
      lengthRows +=
        "<div class='card-size-row'><span class='card-size-heading'>Palazzo Length</span>" +
        "<span class='card-body-size-val'>" +
        escapeHtml(palazzoLengths.join(", ") + " inches") +
        "</span></div>";
    }
  } else if (hasCustomSpecs) {
    lengthRows = p.sizeSpecs
      .map(function (spec) {
        return (
          "<div class='card-size-row'><span class='card-size-heading'>" +
          escapeHtml(spec.label) +
          "</span><span class='card-body-size-val'>" +
          escapeHtml(spec.value) +
          "</span></div>"
        );
      })
      .join("");
  } else {
    lengthRows =
      "<div class='card-size-row'><span class='card-size-heading'>Length Size</span>" +
      "<span class='card-body-size-val'>" +
      escapeHtml(cfg.lengthSizeLabel) +
      "</span></div>";
  }
  return (
    "<div class='card-size-block card-size-block--abaya card-size-block--twopiece'>" +
    "<div class='card-size-row'><span class='card-size-heading'>Body Size</span>" +
    "<span class='card-body-size-val'>" +
    escapeHtml(cfg.bodySizeLabel) +
    "</span></div>" +
    lengthRows +
    "</div>"
  );
}
function buildAbayaSizeFields(idx, lengthSizes, p) {
  var cfg = typeof getAbayaSizeConfig === "function" ? getAbayaSizeConfig(p) : { bodySizeLabel: "46 [Free size]", lengthSizes: ["50", "52", "54", "56"] };
  var lengths = lengthSizes && lengthSizes.length ? lengthSizes : cfg.lengthSizes;
  var sizeOptions = lengths
    .map(function (s, i) {
      return (
        "<option value='" +
        escapeHtml(s) +
        "'" +
        (i === 0 ? " selected" : "") +
        ">" +
        escapeHtml(typeof formatSizeLabel === "function" ? formatSizeLabel(s) : s) +
        "</option>"
      );
    })
    .join("");
  return (
    "<div class='card-size-block card-size-block--abaya'>" +
    "<div class='card-size-row'><span class='card-size-heading'>Body Size</span>" +
    "<span class='card-body-size-val'>" +
    escapeHtml(cfg.bodySizeLabel) +
    "</span></div>" +
    "<div class='card-size-row'><span class='card-size-heading'>Length Size</span>" +
    "<select class='card-size-select' data-size-idx='" +
    idx +
    "' aria-label='Length size'>" +
    sizeOptions +
    "</select></div></div>"
  );
}
function buildDetailSpecsBlock(p, fabricText, sizeOptions, idx, categoryKey) {
  var lengthVal = p.detailNote ? String(p.detailNote).replace(/^Length:\s*/i, "").trim() : "";
  var isAbaya = typeof isAbayaProduct === "function" && isAbayaProduct(p, categoryKey);
  var isTwoPiece = typeof isTwoPieceProduct === "function" && isTwoPieceProduct(p, categoryKey);

  var sizeBlock = isAbaya
    ? buildAbayaSizeFields(idx, typeof getAbayaSizeConfig === "function" ? getAbayaSizeConfig(p).lengthSizes : null, p)
    : isTwoPiece
      ? buildTwoPieceSizeFields(p)
      : "<div class='card-size-block detail-size-block'>" +
        "<span class='card-size-heading'>Size</span>" +
        "<select class='card-size-select' data-size-idx='" +
        idx +
        "' aria-label='Select Size'>" +
        sizeOptions +
        "</select></div>";

  return (
    "<ul class='detail-spec-list'>" +
    "<li><span class='detail-spec-k'>Fabric</span><span class='detail-spec-v'>" +
    fabricText +
    "</span></li>" +
    (lengthVal
      ? "<li><span class='detail-spec-k'>Length</span><span class='detail-spec-v'>" + escapeHtml(lengthVal) + "</span></li>"
      : "") +
    "</ul>" +
    sizeBlock
  );
}
/* ============================================================================
   SECTION 12 ★★: প্রোডাক্ট কার্ডের মূল HTML (buildProductCard)
   ক্যাটাগরি পেজে প্রতিটা প্রোডাক্টের কার্ড (ছবি, নাম, দাম, সাইজ, কার্ট
   বাটন, Send Message বাটন) এই ফাংশন থেকেই তৈরি হয়।

   এখানে দুইটা মোড আছে:
   - detailMode = true  → বড় ডিটেইল কার্ড (Add to Cart লেখা সহ, Order Now,
     Message Us — এই তিনটা বাটন)
   - detailMode = false → সাধারণ গ্রিড কার্ড (নিচে "কার্ট বাটন" কমেন্ট দ্রষ্টব্য)

   👉 কার্ট আইকন-বাটন ও "Send Message" বাটনের HTML নিচে খুঁজে নিন —
      কমেন্ট "কার্ট বাটন + Send Message এখানে" লেখা জায়গাটায়।
   ============================================================================ */
function buildProductCard(p, idx, waLink, detailMode, categoryKey, allProducts) {
  var defaultType = getDefaultProductType(p, categoryKey);
  var productPrice = resolveProductPrice(p, categoryKey, defaultType);
  var imgFallback = getCategoryFallbackImage(categoryKey || "");
  var priceText = formatCardPriceText(p, categoryKey);
  var fabricText = escapeHtml(displayFabricLabel(p.fabric, detailMode ? "Dubai Cherry" : "Premium Georgette"));
  var isAbaya = typeof isAbayaProduct === "function" && isAbayaProduct(p, categoryKey);
  var isTwoPiece = typeof isTwoPieceProduct === "function" && isTwoPieceProduct(p, categoryKey);
  var abayaCfg = isAbaya && typeof getAbayaSizeConfig === "function" ? getAbayaSizeConfig(p) : null;
  var twoPieceCfg = isTwoPiece && typeof getTwoPieceSizeConfig === "function" ? getTwoPieceSizeConfig(p) : null;
  var sizes =
    isAbaya && abayaCfg
      ? abayaCfg.lengthSizes.slice()
      : isTwoPiece && twoPieceCfg
        ? twoPieceCfg.lengthSizes.slice()
      : Array.isArray(p.sizes) && p.sizes.length
        ? p.sizes
        : detailMode
          ? ["Free Size"]
          : ["Free Size"];
  var sizeOptions = sizes
    .map(function (s, i) {
      var label =
        isAbaya && typeof formatSizeLabel === "function"
          ? formatSizeLabel(s)
          : isTwoPiece
            ? s
          : s;
      return "<option value='" + escapeHtml(s) + "'" + (i === 0 ? " selected" : "") + ">" + escapeHtml(label) + "</option>";
    })
    .join("");

  var colorAttr = p.color ? " data-color='" + escapeHtml(p.color) + "'" : "";
  var stock = productStockStatus(p);

  if (detailMode) {
    return (
      '<article class="premium-card premium-card-detail' +
      (stock.inStock ? "" : " is-oos") +
      '" data-product-idx="' +
      idx +
      '" data-price="' +
      productPrice +
      '"' +
      colorAttr +
      ">" +
      '<div class="detail-media">' +
      stockImageBadgeHtml(p) +
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
      buildDetailSpecsBlock(p, fabricText, sizeOptions, idx, categoryKey) +
      buildShopCardQtyStepper(idx, 1, getShopCartQtyForProduct(p) > 0) +
      '<div class="detail-actions">' +
      '<button type="button" class="msg-btn btn-add-cart" data-product-idx="' +
      idx +
      '" data-action="add"' +
      (stock.inStock ? "" : " disabled") +
      ">" +
      escapeHtml(stock.buttonLabel) +
      "</button>" +
'<button type="button" class="msg-btn btn-buy-now" data-product-idx="' +
idx +
'" data-action="buy-now"' +
(stock.inStock ? "" : " disabled") +
">" +
maShopBagIcon(16) +
'<span lang="en">Order Now</span></button>' +
"<a href='" +
waLink +
"?text=" +
encodeURIComponent("I want to order " + p.name) +
"' target='_blank' rel='noopener' class='msg-btn btn-msg'>Message Us</a>" +
"</div>" +
"</div>" +
"</article>"
);
}
  var cartQty = getShopCartQtyForProduct(p);
  var inCart = cartQty > 0;
  return (
    '<article class="card premium-card' +
    (inCart ? " in-cart" : "") +
    (stock.inStock ? "" : " is-oos") +
    '" data-product-idx="' +
    idx +
    '" data-price="' +
    productPrice +
    '"' +
    colorAttr +
    ">" +
    buildCardImageBlock(p, idx, categoryKey, allProducts) +
    '<div class="card-foot">' +
    '<div class="card-meta">' +
    '<button type="button" class="card-title-btn js-quickview-trigger" data-product-idx="' +
    idx +
    '"><span class="card-title-text" lang="en">' +
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
    // 👉 কার্ট বাটন + Send Message এখানে (গ্রিড কার্ড / non-detail মোড)
    // ⚠️ .muslim-abaya-btn-cart ও .muslim-abaya-btn-msg কে .card-actions-muslim-abaya এর
    // *সরাসরি সন্তান* (direct child) হতেই হবে — shop-page.css এই দুটো
    // ক্লাসকে সরাসরি CSS grid-area ("cart"/"msg") তে বসায়। মাঝে কোনো
    // wrapper <div> দিলে গ্রিড লেআউট ভেঙে যাবে (আগে একবার এই বাগ হয়েছিল)।
    // 📝 এখানে কোয়ান্টিটি স্টেপার (+/-) বসানো হয় না ইচ্ছাকৃতভাবে — গ্রিড
    // কার্ডে সেটা shop-page.css দিয়ে সবসময় display:none করা থাকে (শুধু
    // quick-view/ডিটেইল পেজে দেখানো হয়)। আগে এখানেও stepper-এর HTML
    // বসানো হতো, যার ফলে পেজ রিফ্রেশ করলে CSS লোড হওয়ার আগের এক ঝলকের
    // জন্য stepper দেখা যেত, তারপর CSS লোড হলে হঠাৎ অদৃশ্য হয়ে যেত (এটাই
    // "রিফ্রেশ দিলে পরিমাণ দেখা যায় আবার নাই হয়ে যায়" সমস্যার কারণ ছিল)।
    '<div class="card-actions-muslim-abaya">' +
    '<button type="button" class="muslim-abaya-btn muslim-abaya-btn-cart' +
    (inCart ? " is-active" : "") +
    (stock.inStock ? "" : " is-oos") +
    '" data-product-idx="' +
    idx +
    '" data-action="add"' +
    (stock.inStock ? ' aria-label="Add to Cart"' : ' disabled aria-label="Out of Stock"') +
    '><span class="muslim-abaya-btn-ico" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6h15l-1.5 9h-12z"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M6 6L5 3H2"/></svg></span></button>' +
    "<a href='" +
    waLink +
    "?text=" +
   encodeURIComponent("I want to order " + p.name) +
"' target='_blank' rel='noopener' class='muslim-abaya-btn muslim-abaya-btn-msg' onclick='event.stopPropagation()'><span lang='en'>Send Message</span></a>" +
"</div></div></article>"
);

}
/* ----------------------------------------------------------------------
   SECTION 13: URL / ক্যাটাগরি কী রাউটিং হেল্পার
   URL থেকে সার্চ কোয়েরি, ক্যাটাগরি কী বের করা, লিংক ঠিক করা ইত্যাদি।
   ---------------------------------------------------------------------- */
function getPageSearchQuery() {
  try {
    return (new URLSearchParams(window.location.search).get("q") || "").trim();
  } catch (e) {
    return "";
  }
}
function normalizeCategoryHrefPath(href) {
  if (!href) return "";
  try {
    if (href.indexOf("http") === 0 || href.indexOf("//") === 0) {
      var u = new URL(href, window.location.href);
      if (u.origin !== window.location.origin) return "";
      href = u.pathname;
    }
  } catch (urlErr) {}
  var path = String(href).split("?")[0].split("#")[0].replace(/\\/g, "/");
  if (/^[A-Za-z]:/.test(path)) path = path.replace(/^[A-Za-z]:[/\\]+/, "");
  path = path.replace(/^\.\//, "");
  if (path.charAt(0) !== "/") path = "/" + path;
  if (/\.html?$/i.test(path)) {
    path = path.replace(/\.html?$/i, "");
    if (!path) path = "/";
  }
  return path.toLowerCase();
}
function resolveCategoryKeyFromHref(href) {
  var path = normalizeCategoryHrefPath(href);
  if (!path || path === "/category" || path === "/") return null;
  var nav = getCategoryNavList();
  var i;
  for (i = 0; i < nav.length; i++) {
    var c = nav[i];
    var candidates = [
      c.href,
      "/" + c.key,
      c.key + ".html",
      "/" + c.key + ".html"
    ];
    for (var j = 0; j < candidates.length; j++) {
      if (normalizeCategoryHrefPath(candidates[j]) === path) return c.key;
    }
  }
  var slug = path.replace(/^\//, "");
  if (window.CATEGORY_PRODUCTS && Object.prototype.hasOwnProperty.call(window.CATEGORY_PRODUCTS, slug)) {
    return slug;
  }
  return null;
}
function isSpaShopCategoryKey(key) {
  if (!key || key === "video") return false;
  return !!(window.CATEGORY_PRODUCTS && Object.prototype.hasOwnProperty.call(window.CATEGORY_PRODUCTS, key));
}
function getCategoryPageUrl(key) {
  var nav = getCategoryNavList();
  var i;
  for (i = 0; i < nav.length; i++) {
    if (nav[i].key === key) return shopHref(nav[i].href || "/" + key);
  }
  return shopHref("/" + key);
}
function updateCategoryDocumentTitle(key) {
  var meta = (window.CATEGORY_META || {})[key];
  document.title = meta && meta.title ? meta.title + " Collection | Muslim Abaya" : "Muslim Abaya";
}
function collectCategoryViewData(categoryKey) {
  var allProducts = window.CATEGORY_PRODUCTS || {};
  var categoryMeta = window.CATEGORY_META || {};
  var searchQ = getPageSearchQuery();
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
  var title = searchQ
    ? 'Search: "' + searchQ + '"'
    : (categoryMeta[categoryKey] && categoryMeta[categoryKey].title) || categoryKey.toUpperCase();
  var waLink = (window.SITE_MEDIA && window.SITE_MEDIA.whatsappOrderLink) || "https://wa.me/8801970831783";
  var breadcrumb = searchQ
    ? "<nav class='shop-breadcrumb' aria-label='Breadcrumb'>" +
      "<a href='" + escapeHtml(shopHref("/")) + "'>Home</a><span>&rsaquo;</span><strong>Search</strong><span>&rsaquo;</span><strong>" +
      escapeHtml(searchQ) +
      "</strong></nav>"
    : "<nav class='shop-breadcrumb' aria-label='Breadcrumb'>" +
      "<a href='" + escapeHtml(shopHref("/")) + "'>Home</a><span>&rsaquo;</span><a href='" +
      escapeHtml(shopHref("/category")) + "'>Category</a><span>&rsaquo;</span><strong>" +
      escapeHtml(title) +
      "</strong></nav>";
  return {
    products: products,
    title: title,
    categoryKey: categoryKey,
    searchQ: searchQ,
    waLink: waLink,
    breadcrumb: breadcrumb,
    detailMode: false
  };
}
/* ----------------------------------------------------------------------
   SECTION 14: ক্যাটাগরি পেজ কন্ট্রোল বাইন্ডিং
   ফিল্টার প্যানেল খোলা/বন্ধ, সর্ট ড্রপডাউন, প্রাইস স্লাইডার, কালার
   চেকবক্স — এসবের ইভেন্ট এখানে বাইন্ড হয়।
   ---------------------------------------------------------------------- */
function bindShopCategoryControls(root, products) {
  if (!root || !products || !products.length) {
    syncShopCartBadge();
    return;
  }
  var filterState = { colors: [], priceMin: null, priceMax: null };
  function applyFilters() {
    var grid = root.querySelector("#productGrid");
    var countEl = root.querySelector("#shopCount");
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
        if (!productColorKey || filterState.colors.indexOf(productColorKey) === -1) show = false;
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
  el.textContent = "No products found for this filter.";
  grid.appendChild(el);
    }
  }
  function updatePriceTrack() {
    var minInput = root.querySelector("#priceMin");
    var maxInput = root.querySelector("#priceMax");
    var fill = root.querySelector("#priceTrackFill");
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
    var minLbl = root.querySelector("#priceMinLabel");
    var maxLbl = root.querySelector("#priceMaxLabel");
    if (minLbl) minLbl.textContent = String(lo);
    if (maxLbl) maxLbl.textContent = String(hi);
    var range = max - min || 1;
    fill.style.left = ((lo - min) / range) * 100 + "%";
    fill.style.width = ((hi - lo) / range) * 100 + "%";
    applyFilters();
  }
  var priceMin = root.querySelector("#priceMin");
  var priceMax = root.querySelector("#priceMax");
  if (priceMin) priceMin.addEventListener("input", updatePriceTrack);
  if (priceMax) priceMax.addEventListener("input", updatePriceTrack);
  updatePriceTrack();
  var colorFilterWrap = root.querySelector("#colorFilters");
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
  refreshShopCardsAfterCartChange();
  if (!root.dataset.shopDrawerWired) {
    root.dataset.shopDrawerWired = "1";
    var filterOpen = root.querySelector("#shopFilterOpen");
    var filterPanel = root.querySelector("#shopFilterPanel");
    var filterBackdrop = root.querySelector("#shopFilterBackdrop");
    function setFilterDrawer(open) {
      var panel = root.querySelector("#shopFilterPanel");
      var backdrop = root.querySelector("#shopFilterBackdrop");
      var openBtn = root.querySelector("#shopFilterOpen");
      if (!panel) return;
      document.body.classList.toggle("shop-filter-open", open);
      panel.classList.toggle("is-open", open);
      if (backdrop) {
        backdrop.hidden = !open;
        backdrop.classList.toggle("is-visible", open);
      }
      if (openBtn) openBtn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (filterOpen) {
      filterOpen.addEventListener("click", function () {
        setFilterDrawer(!document.body.classList.contains("shop-filter-open"));
      });
    }
    var filterClose = root.querySelector("#shopFilterClose");
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
        var productLink = ev.target.closest(".sidebar-product-link");
        if (productLink) {
          ev.preventDefault();
          var idx = parseInt(productLink.getAttribute("data-idx"), 10);
          if (!isNaN(idx) && typeof window.openProductQuickView === "function") {
            window.openProductQuickView(idx);
          }
          if (window.matchMedia("(max-width: 960px)").matches) {
            setFilterDrawer(false);
          }
          return;
        }
        if (ev.target.closest(".color-filter-option, .sidebar-cat-link")) {
          if (window.matchMedia("(max-width: 960px)").matches) {
            setFilterDrawer(false);
          }
        }
      });
    }
  }
  var sortSelect = root.querySelector("#shopSort");
  if (sortSelect && !sortSelect.dataset.sortWired) {
    sortSelect.dataset.sortWired = "1";
    sortSelect.addEventListener("change", function () {
      var grid = root.querySelector("#productGrid");
      if (!grid) return;
      var productList = shopCartCtx.products || [];
      var cards = Array.prototype.slice.call(grid.querySelectorAll(".premium-card:not(.premium-card-detail)"));
      var mode = sortSelect.value;
      cards.sort(function (a, b) {
        var ia = parseInt(a.getAttribute("data-product-idx"), 10);
        var ib = parseInt(b.getAttribute("data-product-idx"), 10);
        var pa = productList[ia];
        var pb = productList[ib];
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
}
/* ----------------------------------------------------------------------
   SECTION 15: SPA নেভিগেশন
   মেনুতে ক্যাটাগরিতে ক্লিক করলে পুরো পেজ রিলোড না করে শুধু কন্টেন্ট
   বদলে দেওয়ার লজিক (URL-ও আপডেট হয়, browser back/forward কাজ করে)।
   ---------------------------------------------------------------------- */
function softSwitchShopCategory(categoryKey) {
  ensureCategoryStyles();
  var root = document.getElementById("list");
  if (!root || !root.querySelector(".shop-layout")) {
    renderCategory(categoryKey);
    return;
  }
  var view = collectCategoryViewData(categoryKey);
  if (categoryKey && !view.searchQ && !view.products.length) {
    renderCategory(categoryKey);
    return;
  }
  root.classList.add("shop-cat-switching");
  var crumbs = shopBreadcrumbVariants(view.breadcrumb);
  var mob = root.querySelector(".shop-breadcrumb--mobile");
  var desk = root.querySelector(".shop-breadcrumb--desktop");
  if (mob) mob.outerHTML = crumbs.mobile;
  if (desk) desk.outerHTML = crumbs.desktop;
  var panel = root.querySelector("#shopFilterPanel");
  if (panel) {
    var sidebar = buildShopSidebar(view.searchQ ? "" : categoryKey, view.products);
    var sidebarHtml = sidebar.replace(
      "class='shop-sidebar'",
      "class='shop-sidebar' id='shopFilterPanel'"
    );
    panel.outerHTML = sidebarHtml;
    fixShopPageLinks(root);
  }
  var titleEl = root.querySelector(".shop-title");
  var countEl = root.querySelector("#shopCount");
  var grid = root.querySelector("#productGrid");
  if (titleEl) titleEl.textContent = view.title;
  if (countEl) countEl.textContent = view.products.length + " items";
  if (grid) {
    var cards = view.products
      .map(function (p, idx) {
        return buildProductCard(
          p,
          idx,
          view.waLink,
          view.detailMode,
          categoryKey,
          view.products
        );
      })
      .join("");
    grid.innerHTML =
  cards ||
  "<p class='filter-empty'>" +
    (view.searchQ
      ? 'No products found for "' + escapeHtml(view.searchQ) + '". Try another keyword or browse categories.'
      : "No products have been added to this category yet.") +
    "</p>";
    grid.className = "product-grid" + (view.detailMode ? " product-grid-detail" : "");
  }
  var sortSelect = root.querySelector("#shopSort");
  if (sortSelect) sortSelect.value = "default";
  setShopCategoryKey(categoryKey);
  updateCategoryDocumentTitle(categoryKey);
  shopCartCtx.root = root;
  shopCartCtx.products = view.products;
  try {
    bindShopCategoryControls(root, view.products);
  } catch (switchErr) {
    if (typeof console !== "undefined" && console.error) {
      console.error("softSwitchShopCategory failed:", switchErr);
    }
  }
  markCategoryReady();
  if (typeof window.syncSiteHeaderOffset === "function") window.syncSiteHeaderOffset();
  window.requestAnimationFrame(function () {
    root.classList.remove("shop-cat-switching");
  });
}
function navigateShopCategory(categoryKey, href, replaceState) {
  if (!categoryKey || !isSpaShopCategoryKey(categoryKey)) return false;
  var current = getShopCategoryKey();
  if (current === categoryKey && !replaceState) return true;
  var url = href || getCategoryPageUrl(categoryKey);
  var state = { maShopCategory: categoryKey };
  if (replaceState) {
    history.replaceState(state, "", url);
  } else {
    history.pushState(state, "", url);
  }
  softSwitchShopCategory(categoryKey);
  return true;
}
function initShopCategorySpaNav() {
  if (window.__shopCategorySpaInit) return;
  window.__shopCategorySpaInit = true;
  document.addEventListener("click", function (e) {
    if (!getShopCategoryKey()) return;
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var link = e.target.closest(".sidebar-cat-link, .desktop-menu a, #mobileMenuPanel a");
    if (!link) return;
    var key = resolveCategoryKeyFromHref(link.getAttribute("href"));
    if (!key || !isSpaShopCategoryKey(key)) return;
    e.preventDefault();
    if (key === getShopCategoryKey()) return;
    if (typeof window.toggleAbayaMenu === "function") {
      var menu = document.getElementById("mobileMenuPanel");
      if (menu && menu.classList.contains("active")) window.toggleAbayaMenu();
    }
    navigateShopCategory(key, link.getAttribute("href"));
  });
  window.addEventListener("popstate", function () {
    if (!getShopCategoryKey()) return;
    var key = resolveCategoryKeyFromHref(window.location.pathname);
    if (key && isSpaShopCategoryKey(key)) {
      setShopCategoryKey(key);
      updateCategoryDocumentTitle(key);
      softSwitchShopCategory(key);
    }
  });
  var bootKey = getShopCategoryKey();
  if (bootKey && history.replaceState) {
    history.replaceState({ maShopCategory: bootKey }, "", window.location.href);
  }
}
/* ============================================================================
   SECTION 16 ★: ক্যাটাগরি পেজ রেন্ডার
   পেজ লোড হলে এখান থেকেই সব শুরু হয়: সাইডবার + কার্ড গ্রিড বসানো,
   breadcrumb বসানো, ইভেন্ট বাইন্ড করা।
   ============================================================================ */
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
  var view = collectCategoryViewData(categoryKey);
  var products = view.products;
  var searchQ = view.searchQ;
  var title = view.title;
  var waLink = view.waLink;
  var breadcrumb = view.breadcrumb;
  var detailMode = view.detailMode;
  if (categoryKey && !searchQ && !products.length) {
    var soonTitle = title;
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
  "<p class='shop-empty-soon-text'>Products in this category have not been set up yet. They will be added soon.</p>" +
  "<div class='shop-empty-soon-actions'>" +
  "<a class='shop-empty-soon-btn' href='" +
  escapeHtml(shopHref("/abaya")) +
  "'>View ABAYA</a>" +
  "<a class='shop-empty-soon-btn shop-empty-soon-btn--dark' href='" +
  escapeHtml(shopHref("/premium-two-piece")) +
  "'>PREMIUM TWO-PIECE</a>" +
  "</div></div>";
fixShopPageLinks(root);
markCategoryReady();
return;
  }
  var sidebar = buildShopSidebar(searchQ ? "" : categoryKey, products);
  var cards = products.map(function (p, idx) {
  return buildProductCard(p, idx, waLink, detailMode, categoryKey, products);
  }).join("");
  var sidebarHtml = sidebar.replace(
    "class='shop-sidebar'",
    "class='shop-sidebar' id='shopFilterPanel'"
  );
  var crumbs = shopBreadcrumbVariants(breadcrumb);
  root.innerHTML =
  crumbs.mobile +
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
    "<div class='shop-sidebar-col'>" + crumbs.desktop + sidebarHtml + "</div>" +
    "<section class='shop-main'>" +
    "<div class='shop-top'><h2 class='shop-title'>" +
    escapeHtml(title) +
    "</h2><span class='shop-count' id='shopCount' hidden>" +
    products.length +
   " items</span></div>" +
"<div class='product-grid" + (detailMode ? " product-grid-detail" : "") + "' id='productGrid'>" +
(cards ||
  "<p class='filter-empty'>" +
  (searchQ
    ? 'No products found for "' + escapeHtml(searchQ) + '". Try another keyword or browse categories.'
    : "No products have been added to this category yet.") +
  "</p>") +
"</div></section></div>" +
"";
  fixShopPageLinks(root);
  shopCartCtx.root = root;
  shopCartCtx.products = products;
  if (!products.length) {
    markCategoryReady();
    syncShopCartBadge();
    initShopCategorySpaNav();
    return;
  }
  try {
    bindShopCategoryControls(root, products);
  } catch (renderErr) {
    if (typeof console !== "undefined" && console.error) {
      console.error("renderCategory failed:", renderErr);
    }
  } finally {
    markCategoryReady();
    initShopCategorySpaNav();
    if (typeof window.syncSiteHeaderOffset === "function") {
      window.syncSiteHeaderOffset();
    }
    try {
      openProductFromLocationHash();
    } catch (hashErr) {}
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
