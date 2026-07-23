/* ==========================================================================
   Muslim Abaya — Product detail page (product.html)
   Reads the product id from ?id=... , finds it inside window.CATEGORY_PRODUCTS
   (same data source as the homepage / category pages), and renders an
   Anzaar-style product page: gallery, color/type + size pickers, quantity,
   Add to Cart / Buy Now / Send Message, Description/Specification tabs,
   and a Related Products row.
   ========================================================================== */
(function () {
  "use strict";

  var TK = "\u09F3";
  var state = {
    product: null,
    category: "",
    galleryImages: [],
    activeImage: 0,
    selectedType: "",
    selectedSize: "",
    qty: 1
  };

  function $(id) { return document.getElementById(id); }

  function href(path) {
    if (typeof window.siteHref === "function") return window.siteHref(path);
    return path;
  }

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function resolveImg(raw) {
    if (window.maCatalog && typeof window.maCatalog.resolveImageUrl === "function") {
      return window.maCatalog.resolveImageUrl(raw);
    }
    return raw || "";
  }

  function waLink() {
    return (
      (window.SITE_LINKS && window.SITE_LINKS.order && window.SITE_LINKS.order.whatsapp) ||
      "https://wa.me/8801970831783"
    );
  }

  function siteDefaults(catKey) {
    var links = window.SITE_LINKS || {};
    var defs = links.defaults || {};
    var byCat = (defs.byCategory || {})[catKey] || {};
    return { base: defs, cat: byCat };
  }

  function getIdFromUrl() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("id")) return params.get("id");
    var hash = window.location.hash || "";
    var m = hash.match(/[#&]p=([^&]+)/);
    if (m) return decodeURIComponent(m[1]);
    return "";
  }

  /* Strip " - Back" / " - Side" suffixes to find a product's base/group name */
  function baseName(name) {
    return String(name || "").replace(/\s*-\s*(back|side)\s*$/i, "").trim();
  }

  function isVariantSuffix(name) {
    return /\s*-\s*(back|side)\s*$/i.test(String(name || ""));
  }

  function findProductEverywhere(id) {
    var cats = window.CATEGORY_PRODUCTS || {};
    var keys = Object.keys(cats);
    for (var i = 0; i < keys.length; i++) {
      var list = cats[keys[i]] || [];
      for (var j = 0; j < list.length; j++) {
        if (list[j] && String(list[j].id) === String(id)) {
          return { product: list[j], category: keys[i], list: list };
        }
      }
    }
    return null;
  }

  /* Gather this product + its "- Back" / "- Side" siblings as gallery images */
  function buildGallery(product, list) {
    var base = baseName(product.name).toLowerCase();
    var seen = {};
    var out = [];
    function pushImg(p) {
      var img = resolveImg(p.image || p.img);
      if (!img || seen[img]) return;
      seen[img] = true;
      out.push(img);
    }
    pushImg(product);
    list.forEach(function (p) {
      if (!p || p === product) return;
      if (baseName(p.name).toLowerCase() === base && isVariantSuffix(p.name)) pushImg(p);
    });
    if (!out.length) out.push("images/Baby-Pink-Floral-Print.jpeg");
    return out;
  }

  function typePriceFrom(p) {
    var map = p && p.priceByType;
    if (!map) return null;
    return map;
  }

  function currentPrice() {
    var p = state.product;
    var map = typePriceFrom(p);
    if (map) {
      var key = state.selectedType || Object.keys(map)[0];
      var v = parseInt(map[key], 10);
      if (v) return v;
    }
    return parseInt(p && p.price, 10) || siteDefaults(state.category).base.price || 550;
  }

  function renderPrice() {
    var map = typePriceFrom(state.product);
    var price = currentPrice();
    var html = TK + price;
    if (map) {
      var vals = Object.keys(map).map(function (k) { return parseInt(map[k], 10) || 0; }).filter(Boolean);
      if (vals.length > 1) html = TK + Math.min.apply(null, vals) + "<span class='from'>starting from</span>";
      else html = TK + price;
    }
    $("pdPrice").innerHTML = html;
  }

  function renderGallery() {
    var thumbsEl = $("pdThumbs");
    var mainImg = $("pdMainImg");
    thumbsEl.innerHTML = state.galleryImages
      .map(function (img, i) {
        return (
          "<button type='button' class='pd-thumb" + (i === state.activeImage ? " is-active" : "") +
          "' data-idx='" + i + "'><img src='" + escapeHtml(img) + "' alt='" + escapeHtml(state.product.name) + " " + (i + 1) + "'></button>"
        );
      })
      .join("");
    mainImg.src = state.galleryImages[state.activeImage];
    mainImg.alt = escapeHtml(state.product.name);
    mainImg.onerror = function () {
      mainImg.onerror = null;
      mainImg.src = "images/Baby-Pink-Floral-Print.jpeg";
    };
    thumbsEl.querySelectorAll(".pd-thumb").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.activeImage = parseInt(btn.getAttribute("data-idx"), 10) || 0;
        renderGallery();
      });
    });
  }

  function shiftGallery(dir) {
    var n = state.galleryImages.length;
    if (!n) return;
    state.activeImage = (state.activeImage + dir + n) % n;
    renderGallery();
  }

  function renderOptionGroup(containerId, label, options, selectedKey, onPick) {
    var el = $(containerId);
    if (!options || !options.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML =
      "<div class='pd-option-label'>" + escapeHtml(label) + "</div>" +
      "<div class='pd-option-row'>" +
      options
        .map(function (opt) {
          return (
            "<button type='button' class='pd-option-btn" +
            (opt === selectedKey ? " is-active" : "") +
            "' data-val='" + escapeHtml(opt) + "'>" + escapeHtml(opt) + "</button>"
          );
        })
        .join("") +
      "</div>";
    el.querySelectorAll(".pd-option-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        onPick(btn.getAttribute("data-val"));
      });
    });
  }

  function renderTypeOptions() {
    var map = typePriceFrom(state.product);
    var types = map ? Object.keys(map) : (state.product.types || []);
    if (!types.length) { $("pdColorGroup").innerHTML = ""; return; }
    if (!state.selectedType) state.selectedType = types[0];
    renderOptionGroup("pdColorGroup", "Type", types, state.selectedType, function (val) {
      state.selectedType = val;
      renderTypeOptions();
      renderPrice();
    });
  }

  function renderSizeOptions() {
    var sizes = state.product.sizes || siteDefaults(state.category).cat.sizes || siteDefaults(state.category).base.sizes || [];
    if (!sizes.length) { $("pdSizeGroup").innerHTML = ""; return; }
    if (!state.selectedSize) state.selectedSize = sizes[0];
    var el = $("pdSizeGroup");
    renderOptionGroup("pdSizeGroup", "Size", sizes, state.selectedSize, function (val) {
      state.selectedSize = val;
      renderSizeOptions();
    });
    var chartUrl =
      (window.SITE_LINKS &&
        window.SITE_LINKS.sizeChart &&
        (window.SITE_LINKS.sizeChart.byCategory || {})[state.category]) ||
      (window.SITE_LINKS && window.SITE_LINKS.sizeChart && window.SITE_LINKS.sizeChart.default);
    if (chartUrl) {
      el.querySelector(".pd-option-label").insertAdjacentHTML(
        "beforeend",
        " <a class='pd-size-chart-link' href='" + escapeHtml(chartUrl) + "' target='_blank' rel='noopener'>Size Chart</a>"
      );
    }
  }

  function renderQty() {
    $("pdQtyVal").textContent = state.qty;
  }

  function renderBreadcrumb() {
    var secs = window.CATALOG_SECTIONS || [];
    var meta = null;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].key === state.category) { meta = secs[i]; break; }
    }
    var catLabel = (meta && meta.menu) || state.category;
    var catHref = href((meta && meta.path) || "/" + state.category);
    $("pdBreadcrumb").innerHTML =
      "<a href='" + escapeHtml(href("/")) + "'>Home</a>" +
      "<span class='sep'>/</span>" +
      "<a href='" + escapeHtml(catHref) + "'>" + escapeHtml(catLabel) + "</a>" +
      "<span class='sep'>/</span>" +
      "<span class='current'>" + escapeHtml(state.product.name) + "</span>";
  }

  function renderDescription() {
    var links = window.SITE_LINKS || {};
    var notes = links.productNotes || {};
    var html = notes[state.category] || notes.default || "";
    $("pdDescPanel").innerHTML = state.product.detailNote
      ? "<p>" + escapeHtml(state.product.detailNote) + "</p>" + html
      : html;

    var rows = [];
    if (state.product.fabric) rows.push(["Fabric", state.product.fabric]);
    var sizes = state.product.sizes || [];
    if (sizes.length) rows.push(["Available Sizes", sizes.join(", ")]);
    if (state.product.colorLabel) rows.push(["Color", state.product.colorLabel]);
    rows.push(["SKU", state.product.id]);
    $("pdSpecPanel").innerHTML =
      "<table class='pd-spec-table'>" +
      rows.map(function (r) {
        return "<tr><td>" + escapeHtml(r[0]) + "</td><td>" + escapeHtml(r[1]) + "</td></tr>";
      }).join("") +
      "</table>";
  }

  function initTabs() {
    document.querySelectorAll(".pd-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".pd-tab").forEach(function (t) { t.classList.remove("active"); });
        document.querySelectorAll(".pd-tab-panel").forEach(function (p) { p.classList.remove("active"); });
        tab.classList.add("active");
        var target = tab.getAttribute("data-tab") === "spec" ? "pdSpecPanel" : "pdDescPanel";
        $(target).classList.add("active");
      });
    });
  }

  function pickReviews(max) {
    var all = window.SITE_REVIEWS || [];
    return all.slice(0, max);
  }

  function initialsFor(name) {
    var n = String(name || "").trim();
    if (!n) return "?";
    var parts = n.split(/\s+/);
    var first = parts[0].charAt(0);
    return first.toUpperCase();
  }

  function reviewCardHtml(r) {
    var avatar = r.photo
      ? "<img class='pd-review-photo' src='" + escapeHtml(r.photo) + "' alt='" + escapeHtml(r.name) + "' loading='lazy' onerror=\"this.onerror=null;this.style.display='none'\">"
      : "<div class='pd-review-avatar'>" + escapeHtml(initialsFor(r.name)) + "</div>";
    return (
      "<div class='pd-review-card'>" +
      avatar +
      "<div class='pd-review-body'>" +
      "<p class='pd-review-quote'>" + escapeHtml(r.quote) + "</p>" +
      "<div class='pd-review-name'>" + escapeHtml(r.name) + "</div>" +
      "</div>" +
      "</div>"
    );
  }

  var reviewsShown = 4;
  var REVIEWS_INTERVAL = 4500;
  var reviewsTimer = null;

  function renderReviews(direction) {
    var all = window.SITE_REVIEWS || [];
    var section = document.getElementById("pdReviewsSection");
    if (!all.length) { if (section) section.style.display = "none"; return; }
    var row = $("pdReviewsRow");
    row.classList.remove("pd-slide-in-right", "pd-slide-in-left");
    row.innerHTML = pickReviews(reviewsShown).map(reviewCardHtml).join("");
    // Force reflow so the animation class re-triggers every rotation.
    void row.offsetWidth;
    row.classList.add(direction === "prev" ? "pd-slide-in-left" : "pd-slide-in-right");
  }

  function shiftReviews(dir) {
    var all = window.SITE_REVIEWS || [];
    if (all.length <= reviewsShown) return;
    // rotate the array so different reviews surface on next/prev clicks
    if (dir > 0) all.push(all.shift());
    else all.unshift(all.pop());
    renderReviews(dir > 0 ? "next" : "prev");
  }

  function startReviewsAutoplay() {
    stopReviewsAutoplay();
    var all = window.SITE_REVIEWS || [];
    if (all.length <= reviewsShown) return;
    reviewsTimer = setInterval(function () { shiftReviews(1); }, REVIEWS_INTERVAL);
  }

  function stopReviewsAutoplay() {
    if (reviewsTimer) { clearInterval(reviewsTimer); reviewsTimer = null; }
  }

  function renderRelated(list) {
    var current = state.product;
    var seenBase = {};
    var items = list.filter(function (p) {
      if (!p || p.id === current.id) return false;
      if (isVariantSuffix(p.name)) return false;
      var b = baseName(p.name).toLowerCase();
      if (b === baseName(current.name).toLowerCase()) return false;
      if (seenBase[b]) return false;
      seenBase[b] = true;
      return true;
    }).slice(0, 8);

    var secs = window.CATALOG_SECTIONS || [];
    var meta = null;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].key === state.category) { meta = secs[i]; break; }
    }
    $("pdSeeAll").href = href((meta && meta.path) || "/" + state.category);

    $("pdRelatedRow").innerHTML = items
      .map(function (p) {
        var img = resolveImg(p.image || p.img);
        var price = (p.priceByType && Math.min.apply(null, Object.values(p.priceByType).map(function (v) { return parseInt(v, 10) || 0; }).filter(Boolean))) || parseInt(p.price, 10) || 550;
        return (
          "<a class='pd-rel-card' href='product.html?id=" + encodeURIComponent(p.id) + "'>" +
          "<img src='" + escapeHtml(img) + "' alt='" + escapeHtml(p.name) + "' loading='lazy' onerror=\"this.onerror=null;this.src='images/Baby-Pink-Floral-Print.jpeg'\">" +
          "<div class='name'>" + escapeHtml(p.name) + "</div>" +
          "<div class='price'>" + TK + price + "</div>" +
          "</a>"
        );
      })
      .join("");
  }

  function buildCartLine() {
    var price = currentPrice();
    var img = resolveImg(state.product.image || state.product.img);
    var line = {
      id: state.product.id,
      name: state.product.name,
      price: price,
      quantity: state.qty,
      image: img,
      category: state.category,
      color: state.product.color || "",
      colorLabel: state.product.colorLabel || "",
      fabric: state.product.fabric || "",
      size: state.selectedSize || "",
      productType: state.selectedType || ""
    };
    return line;
  }

  function addToCart(silent) {
    var line = buildCartLine();
    var existing = typeof window.loadStoreCart === "function" ? window.loadStoreCart({ readOnly: true }) : [];
    var merged = typeof window.addOrMergeStoreCartItem === "function"
      ? window.addOrMergeStoreCartItem(existing, line)
      : existing.concat([line]);
    if (typeof window.markStoreCartSession === "function") window.markStoreCartSession();
    if (typeof window.afterCartMutation === "function") window.afterCartMutation(merged);
    if (typeof window.pushTrackingEvent === "function") {
      window.pushTrackingEvent("AddToCart", {
        content_ids: [state.product.id],
        content_name: state.product.name,
        value: line.price * line.quantity,
        currency: "BDT"
      });
    }
    if (!silent && typeof window.showCartAddedToast === "function") {
      window.showCartAddedToast({ name: state.product.name, image: line.image, price: line.price });
    }
  }

  function wireActions() {
    $("pdQtyMinus").addEventListener("click", function () {
      state.qty = Math.max(1, state.qty - 1);
      renderQty();
    });
    $("pdQtyPlus").addEventListener("click", function () {
      state.qty = state.qty + 1;
      renderQty();
    });
    $("pdAddCart").addEventListener("click", function (e) {
      addToCart(false);
      var btn = e.currentTarget;
      var original = btn.textContent;
      btn.classList.add("is-added");
      btn.textContent = "Added ✓";
      setTimeout(function () {
        btn.classList.remove("is-added");
        btn.textContent = original;
      }, 1500);
    });
    $("pdBuyNow").addEventListener("click", function () {
      addToCart(true);
      window.location.href = href("/checkout");
    });
    var msgLink = $("pdSendMsg");
    var msgText =
      "I want to order " + state.product.name +
      (state.selectedSize ? " (Size: " + state.selectedSize + ")" : "") +
      (state.selectedType ? " (" + state.selectedType + ")" : "");
    msgLink.href = waLink() + "?text=" + encodeURIComponent(msgText);
    document.querySelector(".pd-gallery-arrow.prev, .pd-gallery-arrow.next");
  }

  function renderShell() {
    var main = $("pdMain");
    main.innerHTML =
      "<nav class='pd-breadcrumb' id='pdBreadcrumb'></nav>" +
      "<div class='pd-layout'>" +
      "<div class='pd-gallery'>" +
      "<div class='pd-thumbs' id='pdThumbs'></div>" +
      "<div class='pd-main-image'>" +
      "<button type='button' class='pd-gallery-arrow prev' id='pdGalPrev' aria-label='Previous image'>&#8249;</button>" +
      "<img id='pdMainImg' src='' alt=''>" +
      "<button type='button' class='pd-gallery-arrow next' id='pdGalNext' aria-label='Next image'>&#8250;</button>" +
      "</div>" +
      "</div>" +
      "<div class='pd-info'>" +
      "<h1 class='pd-name' id='pdName'></h1>" +
      "<div class='pd-price' id='pdPrice'></div>" +
      "<p class='pd-shortnote' id='pdShortNote'></p>" +
      "<div class='pd-option-group' id='pdColorGroup'></div>" +
      "<div class='pd-option-group' id='pdSizeGroup'></div>" +
      "<div class='pd-qty-row'>" +
      "<span>Quantity:</span>" +
      "<div class='pd-qty-stepper'><button type='button' id='pdQtyMinus'>−</button><span id='pdQtyVal'>1</span><button type='button' id='pdQtyPlus'>+</button></div>" +
      "</div>" +
      "<div class='pd-actions'>" +
      "<button type='button' class='pd-btn pd-btn-outline' id='pdAddCart'>Add to Cart</button>" +
      "<button type='button' class='pd-btn pd-btn-dark' id='pdBuyNow'>Buy Now</button>" +
      "<a class='pd-btn pd-btn-light' id='pdSendMsg' target='_blank' rel='noopener'>Send Message</a>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "<div class='pd-tabs-section'>" +
      "<div class='pd-tabs'>" +
      "<button type='button' class='pd-tab active' data-tab='desc'>Description</button>" +
      "<button type='button' class='pd-tab' data-tab='spec'>Specification</button>" +
      "</div>" +
      "<div class='pd-tab-panel active' id='pdDescPanel'></div>" +
      "<div class='pd-tab-panel' id='pdSpecPanel'></div>" +
      "</div>" +
      "<section class='pd-related'>" +
      "<div class='pd-related-head'><h2>Related Products</h2><a id='pdSeeAll' href='#'>See All</a></div>" +
      "<div class='pd-related-row' id='pdRelatedRow'></div>" +
      "</section>" +
      "<section class='pd-reviews' id='pdReviewsSection'>" +
      "<div class='pd-reviews-head'><h2>What Our Customers Say</h2>" +
      "<div class='pd-reviews-nav'>" +
      "<button type='button' id='pdRevPrev' aria-label='Previous reviews'>&#8249;</button>" +
      "<button type='button' id='pdRevNext' aria-label='Next reviews'>&#8250;</button>" +
      "</div></div>" +
      "<div class='pd-reviews-row' id='pdReviewsRow'></div>" +
      "</section>";

    $("pdRevPrev").addEventListener("click", function () {
      shiftReviews(-1);
      startReviewsAutoplay();
    });
    $("pdRevNext").addEventListener("click", function () {
      shiftReviews(1);
      startReviewsAutoplay();
    });
    $("pdReviewsSection").addEventListener("mouseenter", stopReviewsAutoplay);
    $("pdReviewsSection").addEventListener("mouseleave", startReviewsAutoplay);
    $("pdGalPrev").addEventListener("click", function () { shiftGallery(-1); });
    $("pdGalNext").addEventListener("click", function () { shiftGallery(1); });
    initTabs();
  }

  function renderNotFound() {
    $("pdMain").innerHTML =
      "<div class='pd-notfound'><h2>Product not found</h2>" +
      "<p>The item you're looking for may have been removed or the link is incorrect.</p>" +
      "<p><a href='" + escapeHtml(href("/")) + "'>Go back to Home</a></p></div>";
  }

  function render() {
    renderShell();
    renderBreadcrumb();
    $("pdName").textContent = state.product.name;
    $("pdPageTitle").textContent = state.product.name + " | Muslim Abaya";
    var descLink = document.getElementById("pdCanonical");
    if (descLink) descLink.href = window.location.href;

    var shortNotes = (window.SITE_LINKS && window.SITE_LINKS.productShortNotes) || {};
    $("pdShortNote").textContent = shortNotes[state.category] || shortNotes.default || "";

    renderTypeOptions();
    renderSizeOptions();
    renderPrice();
    renderQty();
    renderGallery();
    renderDescription();
    wireActions();

    var listForRelated = (window.CATEGORY_PRODUCTS || {})[state.category] || [];
    renderRelated(listForRelated);
    renderReviews();
    startReviewsAutoplay();
  }

  function boot() {
    var id = getIdFromUrl();
    if (!id || !window.CATEGORY_PRODUCTS) {
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (window.CATEGORY_PRODUCTS || tries > 40) {
          clearInterval(iv);
          proceed(id || getIdFromUrl());
        }
      }, 150);
      return;
    }
    proceed(id);
  }

  function proceed(id) {
    if (!id) { renderNotFound(); return; }
    var found = findProductEverywhere(id);
    if (!found) { renderNotFound(); return; }
    state.product = found.product;
    state.category = found.category;
    state.galleryImages = buildGallery(found.product, found.list);
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
