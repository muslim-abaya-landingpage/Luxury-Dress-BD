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
    selectedColor: "",
    selectedColorLabel: "",
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

  /* Build this product's gallery images.
     Priority: product.images[] -> product.image + "- Back"/"- Side" siblings -> fallback image.
     Duplicate URLs are only kept once (whichever occurrence comes first). */
  function buildGallery(product, list) {
    var seen = {};
    var out = [];
    function pushRaw(raw) {
      var img = resolveImg(raw);
      if (!img || seen[img]) return;
      seen[img] = true;
      out.push(img);
    }

    if (Array.isArray(product.images) && product.images.length) {
      // New multi-image gallery: take every image straight from images[].
      product.images.forEach(function (raw) { pushRaw(raw); });
    } else {
      // Legacy behavior: single main image + any "- Back" / "- Side" variant siblings.
      pushRaw(product.image || product.img);
      var base = baseName(product.name).toLowerCase();
      list.forEach(function (p) {
        if (!p || p === product) return;
        if (baseName(p.name).toLowerCase() === base && isVariantSuffix(p.name)) {
          pushRaw(p.image || p.img);
        }
      });
    }

    if (!out.length) out.push("images/Baby-Pink-Floral-Print.jpeg");
    return out;
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
      .replace(/premium-/gi, "")
      .replace(/-bangladesh.*$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!base) return "Color";
    return base.replace(/\b\w/g, function (ch) {
      return ch.toUpperCase();
    });
  }

  function colorKeyFromLabel(label) {
    return String(label || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getProductColorVariants(p) {
    if (!p) return [];
    if (Array.isArray(p.colorVariants) && p.colorVariants.length) {
      return p.colorVariants
        .map(function (row) {
          if (!row) return null;
          var image = resolveImg(row.image || row.src || "");
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
    var looksLikeColors = String(p.colorLabel || p.color || "").toLowerCase().indexOf("multiple") !== -1;
    if (!looksLikeColors && gallery.length > 1) {
      looksLikeColors = true;
      gallery.forEach(function (raw) {
        if (/(^|[-_\s])(back|side)(\.|[-_\s]|$)/i.test(String(raw || ""))) looksLikeColors = false;
      });
    }
    if (looksLikeColors && gallery.length > 1) {
      var seen = {};
      var out = [];
      gallery.forEach(function (raw) {
        var image = resolveImg(raw);
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
          image: resolveImg(p.image || p.img)
        }
      ];
    }
    return [];
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
        syncColorFromGallery();
        renderGallery();
        renderColorOptions();
        renderDescription();
      });
    });
  }

  function syncColorFromGallery() {
    var variants = getProductColorVariants(state.product);
    if (variants.length < 2) return;
    var img = state.galleryImages[state.activeImage] || "";
    for (var i = 0; i < variants.length; i++) {
      if (variants[i].image === img) {
        state.selectedColor = variants[i].color;
        state.selectedColorLabel = variants[i].colorLabel;
        return;
      }
    }
  }

  function renderColorOptions() {
    var el = $("pdColorPickGroup");
    if (!el) return;
    var variants = getProductColorVariants(state.product);
    if (variants.length < 2) {
      if (state.product.colorLabel || state.product.color) {
        var one = state.product.colorLabel || state.product.color;
        el.innerHTML =
          "<div class='pd-option-label'>Color</div>" +
          "<div class='pd-option-row'><button type='button' class='pd-option-btn is-active'>" +
          escapeHtml(one) +
          "</button></div>";
        state.selectedColor = state.product.color || colorKeyFromLabel(one);
        state.selectedColorLabel = one;
        return;
      }
      el.innerHTML = "";
      return;
    }
    if (!state.selectedColor) {
      state.selectedColor = variants[0].color;
      state.selectedColorLabel = variants[0].colorLabel;
    }
    el.innerHTML =
      "<div class='pd-option-label'>Color</div>" +
      "<div class='pd-option-row'>" +
      variants
        .map(function (row) {
          return (
            "<button type='button' class='pd-option-btn" +
            (row.color === state.selectedColor ? " is-active" : "") +
            "' data-color='" +
            escapeHtml(row.color) +
            "' data-label='" +
            escapeHtml(row.colorLabel) +
            "' data-image='" +
            escapeHtml(row.image || "") +
            "'>" +
            escapeHtml(row.colorLabel) +
            "</button>"
          );
        })
        .join("") +
      "</div>";
    el.querySelectorAll(".pd-option-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.selectedColor = btn.getAttribute("data-color") || "";
        state.selectedColorLabel = btn.getAttribute("data-label") || "";
        var img = btn.getAttribute("data-image") || "";
        var gi = state.galleryImages.indexOf(img);
        if (gi >= 0) state.activeImage = gi;
        renderGallery();
        renderColorOptions();
        renderDescription();
      });
    });
  }

  function shiftGallery(dir) {
    var n = state.galleryImages.length;
    if (!n) return;
    state.activeImage = (state.activeImage + dir + n) % n;
    syncColorFromGallery();
    renderGallery();
    renderColorOptions();
    renderDescription();
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
      updateSendMessageLink();
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
      updateSendMessageLink();
    });
    var chartData =
      (window.SITE_LINKS &&
        window.SITE_LINKS.sizeChart &&
        (window.SITE_LINKS.sizeChart.byCategory || {})[state.category]) ||
      (window.SITE_LINKS && window.SITE_LINKS.sizeChart && window.SITE_LINKS.sizeChart.default);
    if (chartData && Array.isArray(chartData.customSize) && chartData.customSize.length) {
      var row = el.querySelector(".pd-option-row");
      if (row && typeof window.openCustomSizeModal === "function") {
        row.insertAdjacentHTML(
          "beforeend",
          "<button type='button' class='pd-option-btn pd-custom-size-btn' id='pdCustomSizeBtn'>Custom Size</button>"
        );
        var customBtn = document.getElementById("pdCustomSizeBtn");
        if (customBtn) {
          customBtn.addEventListener("click", function () {
            window.openCustomSizeModal({
              id: state.product.id,
              name: state.product.name,
              price: currentPrice(),
              image: (state.galleryImages && state.galleryImages[0]) || state.product.image,
              category: state.category
            });
          });
        }
      }
    }
    if (chartData) {
      el.querySelector(".pd-option-label").insertAdjacentHTML(
        "beforeend",
        " <button type='button' class='pd-size-chart-link' id='pdSizeChartBtn'>Size Chart</button>"
      );
      var chartBtn = document.getElementById("pdSizeChartBtn");
      if (chartBtn) {
        chartBtn.addEventListener("click", function () {
          openPdSizeChartModal(chartData);
        });
      }
    }
  }

  function buildPdSizeChartTableHtml(data) {
    if (!data) return "";
    var html = "";
    if (Array.isArray(data.regularFit) && data.regularFit.length) {
      html +=
        '<div class="pd-sc-card"><div class="pd-sc-card-title">Regular Fit (Inch)</div>' +
        "<table><thead><tr><th>Size</th><th>Length</th><th>Width</th><th>Sleeve</th></tr></thead><tbody>" +
        data.regularFit
          .map(function (row) {
            return (
              "<tr><td>" + escapeHtml(row.size) + "</td><td>" + escapeHtml(row.length) +
              "</td><td>" + escapeHtml(row.width) + "</td><td>" + escapeHtml(row.sleeve) + "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";
    }
    if (Array.isArray(data.customSize) && data.customSize.length) {
      html +=
        '<div class="pd-sc-card"><div class="pd-sc-card-title">Custom Size Charge</div>' +
        "<table><thead><tr><th>Length</th><th>Extra</th><th>Width</th><th>Extra</th></tr></thead><tbody>" +
        data.customSize
          .map(function (row) {
            return (
              "<tr><td>" + escapeHtml(row.length) + "</td><td>" +
              (row.lengthExtra ? "৳" + escapeHtml(row.lengthExtra) : "—") +
              "</td><td>" + escapeHtml(row.width) + "</td><td>" +
              (row.widthExtra ? "৳" + escapeHtml(row.widthExtra) : "—") + "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>";
    }
    return html;
  }

  function ensurePdSizeChartModal() {
    if (document.getElementById("pdSizeChartModal")) return;
    var el = document.createElement("div");
    el.id = "pdSizeChartModal";
    el.className = "pd-sc-overlay";
    el.innerHTML =
      '<div class="pd-sc-dialog" role="dialog" aria-modal="true" aria-label="Size chart">' +
      '<button type="button" class="pd-sc-close" data-pd-sc-close="1" aria-label="Close">&times;</button>' +
      '<div class="pd-sc-title">Size Chart</div>' +
      '<div id="pdSizeChartBody"></div>' +
      "</div>";
    document.body.appendChild(el);
    el.addEventListener("click", function (ev) {
      if (ev.target === el || ev.target.closest("[data-pd-sc-close]")) {
        el.classList.remove("is-open");
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") el.classList.remove("is-open");
    });
  }

  function openPdSizeChartModal(data) {
    ensurePdSizeChartModal();
    var modal = document.getElementById("pdSizeChartModal");
    var body = document.getElementById("pdSizeChartBody");
    if (!modal || !body) return;
    body.innerHTML = buildPdSizeChartTableHtml(data);
    modal.classList.add("is-open");
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
    if (state.selectedColorLabel || state.product.colorLabel) {
      rows.push(["Color", state.selectedColorLabel || state.product.colorLabel]);
    }
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
          "<div class='pd-rel-info'>" +
          "<div class='name'>" + escapeHtml(p.name) + "</div>" +
          "<div class='price'>" + TK + price + "</div>" +
          "</div>" +
          "</a>"
        );
      })
      .join("");
  }

  function buildCartLine() {
    var price = currentPrice();
    /** কাস্টমার গ্যালারিতে যেই ছবিটা (thumbnail) সিলেক্ট করে দেখছিল, ঠিক
     *  সেই ছবিটাই cart/checkout-এ preview হিসেবে যাবে — আগে সবসময় শুধু
     *  ডিফল্ট প্রথম ছবি (state.product.image) যেত, ব্যবহারকারী গ্যালারিতে
     *  যা-ই দেখুক না কেন। এতে id/name/price/quantity লজিকের কোনো
     *  পরিবর্তন হয় না, শুধু cart-এর preview ছবিটা এখন সঠিকভাবে মেলে। */
    var activeGalleryImg =
      state.galleryImages && state.galleryImages.length
        ? state.galleryImages[state.activeImage]
        : "";
    var img = activeGalleryImg || resolveImg(state.product.image || state.product.img);
    var line = {
      id: state.product.id,
      name: state.product.name,
      price: price,
      quantity: state.qty,
      image: img,
      category: state.category,
      color: state.selectedColor || state.product.color || "",
      colorLabel: state.selectedColorLabel || state.product.colorLabel || "",
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
        content_type: "product",
        value: line.price * line.quantity,
        currency: "BDT"
      });
    }
    if (!silent && typeof window.showCartAddedToast === "function") {
      window.showCartAddedToast({ name: state.product.name, image: line.image, price: line.price });
    }
  }

  function updateSendMessageLink() {
    var msgLink = $("pdSendMsg");
    if (!msgLink || !state.product) return;
    var msgText =
      "I want to order " + state.product.name +
      (state.selectedSize ? " (Size: " + state.selectedSize + ")" : "") +
      (state.selectedType ? " (" + state.selectedType + ")" : "");
    msgLink.href = waLink() + "?text=" + encodeURIComponent(msgText);
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
    updateSendMessageLink();
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
      "<div class='pd-option-group' id='pdColorPickGroup'></div>" +
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
      "<div class='pd-bottom-grid'>" +
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
      "</div>" +
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
      "@media (max-width:768px){body.pd-sticky-open{padding-bottom:138px;}}";
    document.head.appendChild(style);
  }

  var stickyOrderObserver = null;

  function initStickyOrderBar() {
    teardownStickyOrderBar();
    var actionsRow = document.querySelector(".pd-actions");
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
      '<button type="button" class="sob-btn sob-buy">Buy Now</button>';

    bar.querySelector(".sob-cart").addEventListener("click", function () {
      var realBtn = $("pdAddCart");
      if (realBtn) realBtn.click();
    });
    bar.querySelector(".sob-buy").addEventListener("click", function () {
      var realBtn = $("pdBuyNow");
      if (realBtn) realBtn.click();
    });

    stickyOrderObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          var scrolledPast = entry.boundingClientRect.bottom < 0;
          bar.classList.toggle("is-visible", scrolledPast);
          document.body.classList.toggle("pd-sticky-open", scrolledPast);
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
    document.body.classList.remove("pd-sticky-open");
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

    renderColorOptions();
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
    initStickyOrderBar();
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
