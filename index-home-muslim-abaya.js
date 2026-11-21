/* ==========================================================================
   Muslim Abaya homepage renderer
   - Full-width hero slider (uploaded images from images/hero-banner/ only)
   - Category sections (heading + View All + auto-sliding product row)
   - Product cards wired to the existing store cart (cart-utils.js)
   Data source: window.CATEGORY_PRODUCTS + window.CATALOG_SECTIONS
   ========================================================================== */
(function () {
  "use strict";

  var homeBtnCssText =
    // Even cards (do not remove; tests/e2e/card-alignment.spec.cjs checks it): every card in a row is the same
    // height and the price/order row sits at the bottom. The name keeps its own natural height (1 or 2 lines,
    // whatever it needs) instead of always reserving 2 lines, so a short name does not leave a big empty gap
    // above the price.
    ".ah-card{display:flex!important;flex-direction:column!important;height:100%}" +
    ".ah-card-body{display:flex!important;flex-direction:column!important;flex:1 1 auto!important}" +
    ".ah-card .ah-card-bottom{margin-top:auto!important;padding-top:12px}";
  if (!document.getElementById("ma-home-btn-row")) {
    var homeBtnCss = document.createElement("style");
    homeBtnCss.id = "ma-home-btn-row";
    homeBtnCss.textContent = homeBtnCssText;
    document.head.appendChild(homeBtnCss);
  }

  var TK = "\u09F3"; // ৳
  var HERO_INTERVAL = 5000;
  var ROW_INTERVAL = 4500;
  var rowTimers = [];
  var rowVisibilityObserver = null;

  var heroTimer = null;
  var heroIdx = 0;
  var heroTotalRef = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function waLink() {
    return (
      (window.SITE_MEDIA && window.SITE_MEDIA.whatsappOrderLink) ||
      "https://wa.me/8801971642683"
    );
  }

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

  function isPrimaryName(name) {
    var s = String(name || "").toLowerCase();
    return (
      s.indexOf(" - back") === -1 &&
      s.indexOf("- back") === -1 &&
      s.indexOf(" - side") === -1 &&
      s.indexOf("- side") === -1
    );
  }

  function resolveImg(p) {
    var raw = (p && (p.image || p.img)) || "";
    if (window.maCatalog && typeof window.maCatalog.resolveImageUrl === "function") {
      return window.maCatalog.resolveImageUrl(raw);
    }
    return raw;
  }

  function homeAbsoluteUrl(src) {
    if (!src) return "";
    try {
      return new URL(src, window.location.origin).href;
    } catch (e) {
      return String(src);
    }
  }

  /* Uploaded products carry their own small card image (p.imageCard, e.g. images/uploads/<id>-card.webp).
     Use it when present: no images/card/... copy is generated for uploads, so deriving one gave a 404. */
  function resolveCardImg(p) {
    var raw = (p && p.imageCard) || "";
    if (!raw) return "";
    if (window.maCatalog && typeof window.maCatalog.resolveImageUrl === "function") {
      return window.maCatalog.resolveImageUrl(raw);
    }
    return raw;
  }

  /* Small (480px) card variant: images/card/<original path>.webp — falls back to the original on 404. */
  function cardThumbSrc(src) {
    if (!src || /^(https?:)?\/\//i.test(src) || /[?#]/.test(src)) return src;
    var m = String(src).replace(/^\.?\//, "");
    if (
      m.indexOf("images/") !== 0 ||
      m.indexOf("images/card/") === 0 ||
      m.indexOf("images/hero-banner/") === 0 ||
      m.indexOf("images/uploads/") === 0
    ) {
      return src;
    }
    return "images/card/" + m + ".webp";
  }

  function homeCardAvifSrc(src) {
    var value = String(src || "");
    if (/^(https?:)?\/\//i.test(value) || /[?#]/.test(value)) return "";
    var card = value.match(/^(\/*)images\/card\/(.+)\.webp$/i);
    if (card) return card[1] + "images/card-avif/" + card[2] + ".avif";
    var uploaded = value.match(/^\/*images\/uploads\/[^/?#]+-card\.webp$/i);
    return uploaded ? value.replace(/\.webp$/i, ".avif") : "";
  }

  function encodeCardSrcsetUrl(src) {
    return String(src || "").split("/").map(function (part) {
      return encodeURIComponent(part);
    }).join("/");
  }

  /* Stock — reuse product-utils helpers when catalog is loaded. */
  function stockStatus(p) {
    if (window.maCatalog && typeof window.maCatalog.getStockStatus === "function") {
      return window.maCatalog.getStockStatus(p);
    }
    if (p && p.inStock === false) {
      return { inStock: false, label: "Out of Stock", badge: "Sold Out", buttonLabel: "Out of Stock" };
    }
    if (p && typeof p.stock === "number" && p.stock <= 0) {
      return { inStock: false, label: "Out of Stock", badge: "Sold Out", buttonLabel: "Out of Stock" };
    }
    return { inStock: true, label: "In Stock", badge: "In Stock", buttonLabel: "Add to Cart" };
  }
  function isOutOfStock(p) {
    return !stockStatus(p).inStock;
  }

  function categoryHasProducts(key) {
    if (window.maCatalog && typeof window.maCatalog.categoryHasProducts === "function") {
      return window.maCatalog.categoryHasProducts(key);
    }
    var list = (window.CATEGORY_PRODUCTS || {})[key];
    return Array.isArray(list) && list.length > 0;
  }

  /* Enabled catalog sections that actually have products */
  function activeSections() {
    var secs = window.CATALOG_SECTIONS || [];
    return secs.filter(function (s) {
      return categoryHasProducts(s.key);
    });
  }

  /* Primary, image-bearing, de-duplicated products for a category */
  function sectionProducts(key) {
    var list = (window.CATEGORY_PRODUCTS || {})[key] || [];
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || !p.name || !isPrimaryName(p.name)) continue;
      if (window.maCatalog && typeof window.maCatalog.listable === "function" && !window.maCatalog.listable(p, "shop")) continue;
      var img = resolveImg(p);
      if (!img) continue;
      var k = img.split("?")[0];
      if (seen[k]) continue;
      seen[k] = true;
      out.push(p);
    }
    return out;
  }

  function listingPrice(p) {
    return parseInt(p && p.price, 10) || 550;
  }

  function basePrice(p) {
    return listingPrice(p);
  }

  function priceHtml(p) {
    if (typeof window.maFormatPriceHtml === "function") return window.maFormatPriceHtml(p, null, listingPrice(p));
    return TK + listingPrice(p);
  }

  function sectionMeta(key) {
    var secs = window.CATALOG_SECTIONS || [];
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].key === key) return secs[i];
    }
    return { key: key, menu: key, path: "/" + key };
  }

  function detailHref(sec, p) {
    return href('/product/' + encodeURIComponent(p.id || ''));
  }

  var cartIconSvg =
    "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M3 4h1.6l1.1 11.2A2 2 0 0 0 7.7 17h9.7a2 2 0 0 0 2-1.7L21 8H7'/><circle cx='9' cy='20' r='1.35'/><circle cx='18' cy='20' r='1.35'/></svg>";

  /* ---------------- Cart ---------------- */
  function addToCart(sec, p) {
    // Products with Size Manager fields need the customer's measurements: open their page instead.
    if (p && p.id && window.maSizeStore && window.maSizeStore.resolveFor(p, sec.key)) {
      window.location.href = "/product/" + encodeURIComponent(p.id);
      return;
    }
    var price = basePrice(p);
    var line = {
      id: p.id,
      name: p.name,
      price: price,
      quantity: 1,
      image: resolveImg(p),
      category: sec.key,
      categoryLabel: sec.menu
    };
    if (typeof window.enrichHomeCartLine === "function") {
      line = window.enrichHomeCartLine(p, line);
    }
    var existing =
      typeof window.loadStoreCart === "function"
        ? window.loadStoreCart({ readOnly: true })
        : [];
    var merged =
      typeof window.addOrMergeStoreCartItem === "function"
        ? window.addOrMergeStoreCartItem(existing, line)
        : existing.concat([line]);
    if (typeof window.markStoreCartSession === "function") {
      window.markStoreCartSession();
    }
    if (typeof window.afterCartMutation === "function") {
      window.afterCartMutation(merged);
    }
    // Successful add (line was built and merged into the cart) -> open the
    // drawer instantly, same as the rest of the site. Toasts are already
    // no-ops (see cart-toast.js), so this is now the only "added" feedback
    // on the homepage. Guarded by typeof so this file still runs fine on
    // any page where cart-drawer.js hasn't loaded.
    if (typeof window.ensureCartDrawerHtml === "function") {
      window.ensureCartDrawerHtml();
    }
    if (typeof window.openCartDrawer === "function") {
      window.openCartDrawer();
    }
    if (typeof window.pushTrackingEvent === "function") {
      window.pushTrackingEvent("AddToCart", {
        content_ids: [p.id],
        content_name: p.name,
        content_type: "product",
        value: price,
        currency: "BDT"
      });
    }
    if (typeof window.showCartAddedToast === "function") {
      window.showCartAddedToast({
        label: "Product added to cart",
        name: p.name,
        image: resolveImg(p),
        price: price
      });
    }
  }

  /* ---------------- Card ---------------- */
  function cardHtml(sec, p, eagerLevel) {
    var img = resolveImg(p);
    var thumb = resolveCardImg(p) || cardThumbSrc(img);
    var mobileAvif = homeCardAvifSrc(thumb);
    var dHref = detailHref(sec, p);
    var outOfStock = isOutOfStock(p);
    var st = stockStatus(p);
    return (
      "<article class='ah-card" +
      (outOfStock ? " ah-card-oos" : "") +
      "' data-pid='" +
      escapeHtml(p.id) +
      "'>" +
      "<a class='ah-card-media' href='" +
      escapeHtml(dHref) +
      "'>" +
      (outOfStock
        ? "<span class='ah-card-badge ah-card-badge-oos'>Sold Out</span>"
        : "<span class='ah-card-badge'>Sale</span>") +
      "<picture class='ah-card-picture'>" +
      (mobileAvif
        ? "<source media='(max-width: 767px)' type='image/avif' srcset='" + escapeHtml(encodeCardSrcsetUrl(mobileAvif)) + "'>"
        : "") +
      "<img src='" +
      escapeHtml(thumb) +
      "' data-card-src='" +
      escapeHtml(thumb) +
      "' data-full='" +
      escapeHtml(img) +
      "' alt='" +
      escapeHtml(p.name) +
      "' width='480' height='600' " +
      (eagerLevel === 2
        ? "fetchpriority='high' decoding='async'"
        : eagerLevel === 1
          ? "decoding='async'"
          : "loading='lazy' decoding='async'") +
      " onerror=\"var pic=this.parentNode;var av=pic&&pic.tagName==='PICTURE'&&pic.firstElementChild;if(av&&av.tagName==='SOURCE'&&av.type==='image/avif'&&!this.hasAttribute('data-tried-avif')){this.setAttribute('data-tried-avif','1');av.remove();var c=this.getAttribute('data-card-src');if(c){this.src=c;return}}var f=this.getAttribute('data-full');if(f&&!this.hasAttribute('data-tried-full')){this.setAttribute('data-tried-full','1');if(this.getAttribute('src')!==f){this.src=f;return}}this.onerror=null;this.src='images/Baby-Pink-Floral-Print.jpeg'\">" +
      "</picture>" +
      "</a>" +
      "<div class='ah-card-body'>" +
      (sec.menu ? "<span class='ah-card-cat'>" + escapeHtml(sec.menu) + "</span>" : "") +
      "<a class='ah-card-name' href='" +
      escapeHtml(dHref) +
      "'>" +
      escapeHtml(p.name) +
      "</a>" +
      // No "In Stock" line on cards; only an out-of-stock product gets a stock line.
      (outOfStock ? "<span class='ah-card-stock is-oos'>" + escapeHtml(st.label) + "</span>" : "") +
      "<div class='ah-card-row ah-card-bottom'>" +
      "<span class='ah-card-price'>" +
      priceHtml(p) +
      "</span>" +
      (outOfStock
        ? ""
        : // One clean button: straight to the product page, where size/colour
          // are chosen and the popup checkout opens (cart stays available there too).
          "<a class='ah-card-cta' href='" +
          escapeHtml(dHref) +
          "'>অর্ডার করুন</a>") +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  /* ---------------- Sections ---------------- */
  var PRERENDER_CARDS = 6;

  function renderSections() {
    var root = $("homeSections");
    if (!root) return;
    stopAllRowSliders();
    if (rowVisibilityObserver) {
      rowVisibilityObserver.disconnect();
      rowVisibilityObserver = null;
    }
    var secs = activeSections();
    if (!secs.length) return;
    if (!extendPrerendered(root, secs)) root.innerHTML = sectionsHtml(secs, 0, 0);
    bindSections(root, secs);
  }

  /* index.html can arrive with the start of the first section already in it (scripts/build-home-prerender.mjs).
     Keep those card elements (they are the LCP element; replacing them would restart LCP and can shift the
     page) and only add the rest. If the catalog no longer matches what was prerendered, re-render everything. */
  function extendPrerendered(root, secs) {
    if (root.getAttribute("data-prerendered") !== "1") return false;
    root.removeAttribute("data-prerendered");
    var plan = sectionPlan(secs);
    if (!plan.length) return false;
    var first = plan[0];
    var sectionEl = root.querySelector("section.home-section");
    var row = sectionEl && sectionEl.querySelector(".home-row");
    if (!row || root.querySelectorAll("section.home-section").length !== 1 || sectionEl.getAttribute("data-cat") !== first.sec.key) {
      return false;
    }
    var arts = row.querySelectorAll("article.ah-card");
    var n = Math.min(PRERENDER_CARDS, first.products.length);
    if (arts.length !== n) return false;
    for (var i = 0; i < n; i++) {
      if (arts[i].getAttribute("data-pid") !== String(first.products[i].id)) return false;
    }
    // Stock / price may have changed since the build: refresh those cards' contents in place only when they differ.
    var fresh = document.createElement("div");
    fresh.innerHTML = cardsHtml(first, 0, n);
    var freshArts = fresh.querySelectorAll("article.ah-card");
    for (var k = 0; k < n; k++) {
      var body = arts[k].querySelector(".ah-card-body");
      var freshBody = freshArts[k] && freshArts[k].querySelector(".ah-card-body");
      if (body && freshBody && body.innerHTML !== freshBody.innerHTML) body.innerHTML = freshBody.innerHTML;
      var badge = arts[k].querySelector(".ah-card-badge");
      var freshBadge = freshArts[k] && freshArts[k].querySelector(".ah-card-badge");
      if (badge && freshBadge && badge.outerHTML !== freshBadge.outerHTML) badge.outerHTML = freshBadge.outerHTML;
      if (freshArts[k]) arts[k].className = freshArts[k].className;
    }
    row.insertAdjacentHTML("beforeend", cardsHtml(first, n, first.products.length));
    var rest = "";
    for (var s = 1; s < plan.length; s++) rest += sectionHtml(plan[s], 0);
    root.insertAdjacentHTML("beforeend", rest);
    return true;
  }

  /* Sections that have products, in order, with the first one flagged (its first cards load eagerly). */
  function sectionPlan(secs) {
    var plan = [];
    secs.forEach(function (sec) {
      var products = sectionProducts(sec.key);
      if (!products.length) return;
      plan.push({ sec: sec, products: products, isFirst: plan.length === 0 });
    });
    return plan;
  }

  function cardsHtml(entry, from, to) {
    var html = "";
    for (var i = from; i < to && i < entry.products.length; i++) {
      /* first-viewport cards: eager (LCP candidate), first one high priority */
      html += cardHtml(entry.sec, entry.products[i], entry.isFirst && i < 2 ? (i === 0 ? 2 : 1) : 0);
    }
    return html;
  }

  function sectionHtml(entry, cardLimit) {
    var sec = entry.sec;
    var title = sec.menu || sec.key;
    var viewAll = href(sec.path || "/" + sec.key);
    return (
      "<section class='home-section' data-cat='" +
      escapeHtml(sec.key) +
      "'>" +
      "<div class='home-section-head'>" +
      "<h2 class='home-section-title'>" +
      escapeHtml(title) +
      "</h2>" +
      "<a class='home-section-viewall' href='" +
      escapeHtml(viewAll) +
      "'>View All</a>" +
      "</div>" +
      "<div class='home-section-body'>" +
      "<button type='button' class='home-row-arrow prev' aria-label='Previous'>&#8249;</button>" +
      "<div class='home-row'>" +
      cardsHtml(entry, 0, cardLimit > 0 ? cardLimit : entry.products.length) +
      "</div>" +
      "<button type='button' class='home-row-arrow next' aria-label='Next'>&#8250;</button>" +
      "</div>" +
      "</section>"
    );
  }

  /* HTML for the category sections (limit > 0: only the first `limit` sections; cardLimit > 0: only the first
     `cardLimit` cards of each). Also used at build time by scripts/build-home-prerender.mjs. */
  function sectionsHtml(secs, limit, cardLimit) {
    var plan = sectionPlan(secs);
    var html = "";
    for (var i = 0; i < plan.length && (!(limit > 0) || i < limit); i++) html += sectionHtml(plan[i], cardLimit);
    return html;
  }

  function bindSections(root, secs) {
    var secByKey = {};
    secs.forEach(function (s) {
      secByKey[s.key] = s;
    });
    // Always refresh the lookup table the delegated listener reads from,
    // even though the listener itself is only ever attached once (see guard below).
    root.__ahSecByKey = secByKey;

    // renderAll() can run more than once (catalog-ready retry loop in boot(),
    // and index-catalog-defer.js's external window.__homeRefreshCatalog trigger
    // can both fire). root's innerHTML gets replaced each time, but root itself
    // is the SAME persistent element — without this guard, every extra render
    // added another "click" listener on top of the old one, so a single tap on
    // "Add to Cart" fired addToCart() twice (or more).
    if (!root.__ahClickBound) {
      root.__ahClickBound = true;
      root.addEventListener("click", function (e) {
        var btn = e.target.closest("button[data-action='add']");
        if (!btn) return;
        e.preventDefault();
        var card = btn.closest(".ah-card");
        var section = btn.closest(".home-section");
        if (!card || !section) return;
        var pid = card.getAttribute("data-pid");
        var key = section.getAttribute("data-cat");
        var sec = (root.__ahSecByKey || {})[key];
        if (!sec) return;
        var list = (window.CATEGORY_PRODUCTS || {})[key] || [];
        var p = list.find(function (x) {
          return x && String(x.id) === String(pid);
        });
        if (!p) return;
        if (isOutOfStock(p)) return;
        addToCart(sec, p);
        if (typeof window.playCartButtonAddedUi === "function") {
          window.playCartButtonAddedUi(btn);
        }
      });
    }

    stopAllRowSliders();
    var bodies = root.querySelectorAll(".home-section-body");
    bodies.forEach(function (body) {
      bindRowSlider(body);
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function rowAutoplayAllowed() {
    // Touch visitors use the native swipe/arrow controls. Running a smooth
    // horizontal scroll in every category competes with vertical momentum.
    return !prefersReducedMotion() &&
      !(window.matchMedia && window.matchMedia("(max-width: 900px), (pointer: coarse)").matches);
  }

  function rowCanSlide(rowEl) {
    return rowEl && rowEl.scrollWidth > rowEl.clientWidth + 8;
  }

  function scrollRowBy(rowEl, dir) {
    if (!rowCanSlide(rowEl)) return;
    var page = Math.max(rowEl.clientWidth * 0.8, 1);
    var max = rowEl.scrollWidth - rowEl.clientWidth;
    if (dir > 0) {
      if (rowEl.scrollLeft >= max - 8) {
        rowEl.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        rowEl.scrollBy({ left: page, behavior: "smooth" });
      }
      return;
    }
    if (rowEl.scrollLeft <= 8) {
      rowEl.scrollTo({ left: max, behavior: "smooth" });
    } else {
      rowEl.scrollBy({ left: -page, behavior: "smooth" });
    }
  }

  function stopAllRowSliders() {
    rowTimers.forEach(function (id) {
      clearInterval(id);
    });
    rowTimers = [];
  }

  function startRowAuto(body, rowEl) {
    if (body.__ahRowTimer) {
      clearInterval(body.__ahRowTimer);
      var idx = rowTimers.indexOf(body.__ahRowTimer);
      if (idx >= 0) rowTimers.splice(idx, 1);
      body.__ahRowTimer = 0;
    }
    if (!rowAutoplayAllowed() || document.hidden || body.isConnected === false ||
        body.__ahRowVisible === false || !rowCanSlide(rowEl)) return;
    body.__ahRowTimer = setInterval(function () {
      if (body.__ahRowPaused || document.hidden) return;
      scrollRowBy(rowEl, 1);
    }, ROW_INTERVAL);
    rowTimers.push(body.__ahRowTimer);
  }

  function bindRowSlider(body) {
    var rowEl = body.querySelector(".home-row");
    var prevArrow = body.querySelector(".home-row-arrow.prev");
    var nextArrow = body.querySelector(".home-row-arrow.next");
    if (!rowEl) return;

    body.__ahRowVisible = typeof window.IntersectionObserver !== "function";
    if (!body.__ahRowVisible) {
      if (!rowVisibilityObserver) {
        rowVisibilityObserver = new window.IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            var target = entry.target;
            target.__ahRowVisible = entry.isIntersecting;
            startRowAuto(target, target.querySelector(".home-row"));
          });
        }, { threshold: 0.05 });
      }
      rowVisibilityObserver.observe(body);
    }

    if (prevArrow) {
      prevArrow.addEventListener("click", function () {
        scrollRowBy(rowEl, -1);
        startRowAuto(body, rowEl);
      });
    }
    if (nextArrow) {
      nextArrow.addEventListener("click", function () {
        scrollRowBy(rowEl, 1);
        startRowAuto(body, rowEl);
      });
    }

    body.addEventListener("mouseenter", function () {
      body.__ahRowPaused = true;
    });
    body.addEventListener("mouseleave", function () {
      body.__ahRowPaused = false;
    });
    body.addEventListener("touchstart", function () {
      body.__ahRowPaused = true;
    }, { passive: true });
    body.addEventListener("touchend", function () {
      body.__ahRowPaused = false;
    }, { passive: true });
    body.addEventListener("touchcancel", function () {
      body.__ahRowPaused = false;
    }, { passive: true });

    window.requestAnimationFrame(function () {
      startRowAuto(body, rowEl);
    });
  }

  /* ---------------- Category chip nav ---------------- */
  function renderCatnav() {
    var nav = $("homeCatnav");
    if (!nav) return;
    var secs = activeSections();
    if (!secs.length) return;
    nav.innerHTML = catnavHtml(secs);
  }

  function catnavHtml(secs) {
    var links = secs
      .map(function (s) {
        return (
          "<a href='" +
          escapeHtml(href(s.path || "/" + s.key)) +
          "'>" +
          escapeHtml(s.menu || s.key) +
          "</a>"
        );
      })
      .join("");
    return (
      "<div class='home-catnav-inner'>" +
      "<span class='home-catnav-label'>Women" +
      "<svg viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>" +
      "<path d='M1 1l4 4 4-4' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/>" +
      "</svg></span>" +
      links +
      "</div>"
    );
  }

  /* Build-time prerender hook (scripts/build-home-prerender.mjs). Not used in the browser. */
  // Small photo for a product shown as a tile (Shop by category): the same card thumbnail the product cards use,
  // never the full-size photo (8 full photos were ~1 MB and slowed the hero image on mobile).
  window.maHomeCardImage = function (p) {
    if (!p || !(p.image || p.img)) return null;
    var full = resolveImg(p);
    var thumb = resolveCardImg(p) || cardThumbSrc(full);
    return { src: thumb || full, avif: homeCardAvifSrc(thumb), full: full };
  };

  window.__maHomePrerender = function () {
    var secs = activeSections();
    if (!secs.length) return null;
    return { catnav: catnavHtml(secs), sections: sectionsHtml(secs, 1, PRERENDER_CARDS), btnCss: homeBtnCssText };
  };


  /* ---------------- Storyboard (top of the homepage) ----------------
     The 12 newest products as a deck of cards (the current one in front, neighbours tilted behind),
     a numbered list beside it, arrows and a 01 / 12 counter. Newest = dateAdded. Flat corners. */
  var STORY_COUNT = 12;
  var STORY_INTERVAL = 5000;
  var STORY_ARABIC = {
    abaya: "عباية", "cover-up": "غطاء", "premium-two-piece": "طقم", "tops-kurti": "قميص", embroidery: "تطريز",
    karchupi: "تطريز", kaftan: "قفطان", hijab: "حجاب", panjabi: "ثوب", "three-piece-dress": "طقم"
  };
  var storyTimer = null;

  function storyProducts() {
    var seen = {};
    var rows = [];
    activeSections().forEach(function (sec) {
      sectionProducts(sec.key).forEach(function (p) {
        if (!p || seen[p.id] || isOutOfStock(p)) return;
        seen[p.id] = true;
        rows.push({ p: p, sec: sec, t: Date.parse(p.dateAdded || "") || 0 });
      });
    });
    rows.sort(function (a, b) { return b.t - a.t; });
    return rows.slice(0, STORY_COUNT);
  }

  function storyPad(n) { return n < 10 ? "0" + n : String(n); }

  function storyCardHtml(row, i) {
    var p = row.p;
    var pic = window.maHomeCardImage(p) || { src: resolveImg(p) };
    var ar = STORY_ARABIC[row.sec.key] || "";
    return (
      "<a class='ms-card' href='" + escapeHtml(detailHref(row.sec, p)) + "' data-i='" + i + "' tabindex='" + (i === 0 ? "0" : "-1") + "'>" +
      "<img src='" + escapeHtml(pic.src) + "' alt='" + escapeHtml(p.name) + "' width='480' height='600' decoding='async'" +
      // card-size photo missing: fall back to the product's full photo once
      (pic.full && pic.full !== pic.src ? " data-full='" + escapeHtml(pic.full) + "' onerror=\"if(this.dataset.full&&this.src.indexOf(this.dataset.full)<0){this.src=this.dataset.full}\"" : "") +
      (i < 2 ? " fetchpriority='" + (i === 0 ? "high" : "auto") + "'" : " loading='lazy'") + ">" +
      "<span class='ms-card-shade' aria-hidden='true'></span>" +
      "<span class='ms-card-text'>" +
      "<span class='ms-card-cat'>" + escapeHtml(row.sec.menu || row.sec.key) + "</span>" +
      "<span class='ms-card-name'>" + escapeHtml(p.name) + (ar ? " <i lang='ar' dir='rtl'>" + ar + "</i>" : "") + "</span>" +
      "<span class='ms-card-price'>" + priceHtml(p) + "</span>" +
      "<span class='ms-card-cta'>Explore <span aria-hidden='true'>&rarr;</span></span>" +
      "</span></a>"
    );
  }

  function storyListHtml(rows) {
    return rows.map(function (row, i) {
      var ar = STORY_ARABIC[row.sec.key] || "";
      var pic = window.maHomeCardImage(row.p) || { src: resolveImg(row.p) };
      return (
        "<li><button type='button' class='ms-li" + (i === 0 ? " is-active" : "") + "' data-i='" + i + "'>" +
        "<span class='ms-li-text'>" +
        "<span class='ms-li-meta'>" + storyPad(i + 1) + " · " + escapeHtml(row.sec.menu || row.sec.key) + "</span>" +
        "<span class='ms-li-name'>" + (ar ? "<i lang='ar' dir='rtl'>" + ar + "</i>" : "") + escapeHtml(row.p.name) + "</span>" +
        "<span class='ms-li-price'>" + priceHtml(row.p) + "</span>" +
        "</span>" +
        "<img class='ms-li-thumb' src='" + escapeHtml(pic.src) + "' alt='' width='44' height='56' loading='lazy' decoding='async'" +
        (pic.full && pic.full !== pic.src ? " data-full='" + escapeHtml(pic.full) + "' onerror=\"if(this.dataset.full&&this.src.indexOf(this.dataset.full)<0){this.src=this.dataset.full}\"" : "") + ">" +
        "</button></li>"
      );
    }).join("");
  }

  function storyGo(board, idx) {
    var cards = board.querySelectorAll(".ms-card");
    var n = cards.length;
    if (!n) return;
    idx = ((idx % n) + n) % n;
    board.__msIndex = idx;
    cards.forEach(function (c, i) {
      var d = i - idx;
      if (d > n / 2) d -= n;
      if (d < -n / 2) d += n;
      c.className = "ms-card" + (d === 0 ? " is-active" : d === -1 ? " is-prev" : d === 1 ? " is-next" : d < 0 ? " is-far-prev" : " is-far-next");
      c.setAttribute("tabindex", d === 0 ? "0" : "-1");
      c.setAttribute("aria-hidden", d === 0 ? "false" : "true");
      if (Math.abs(d) <= 1) {
        var im = c.querySelector("img[loading='lazy']");
        if (im) im.removeAttribute("loading");
      }
    });
    var count = board.querySelector(".ms-count");
    if (count) count.textContent = storyPad(idx + 1) + " / " + storyPad(n);
    var big = board.querySelector(".ms-index-bg");
    if (big) big.textContent = storyPad(idx + 1);
    // thin line under the counter fills up until the next card comes
    var bar = board.querySelector(".ms-progress");
    if (bar) { bar.classList.remove("is-running"); void bar.offsetWidth; if (!prefersReducedMotion()) bar.classList.add("is-running"); }
    var items = board.querySelectorAll(".ms-li");
    items.forEach(function (b, i) { b.classList.toggle("is-active", i === idx); b.setAttribute("aria-current", i === idx ? "true" : "false"); });
    var list = board.querySelector(".ms-list-items");
    var on = items[idx];
    if (list && on) {
      var top = on.parentNode.offsetTop - list.clientHeight / 2 + on.parentNode.offsetHeight / 2;
      list.scrollTo({ top: Math.max(0, top), behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  }

  function storyStop() { if (storyTimer) { clearInterval(storyTimer); storyTimer = null; } }
  function storyStart(board) {
    storyStop();
    if (prefersReducedMotion()) return;
    storyTimer = setInterval(function () {
      if (board.__msPaused || document.hidden) return;
      storyGo(board, (board.__msIndex || 0) + 1);
    }, STORY_INTERVAL);
  }

  function renderStoryboard() {
    var board = $("msBoard");
    if (!board) return;
    var rows = storyProducts();
    if (!rows.length) return;
    var key = rows.map(function (r) { return r.p.id; }).join("|");
    if (board.__msKey === key) return;
    board.__msKey = key;
    board.querySelector(".ms-deck").innerHTML = rows.map(storyCardHtml).join("");
    board.querySelector(".ms-list-items").innerHTML = storyListHtml(rows);
    board.classList.add("is-ready");
    storyGo(board, 0);
    if (!board.__msBound) {
      board.__msBound = true;
      board.addEventListener("click", function (e) {
        var b = e.target.closest("[data-ms-go], .ms-li");
        if (!b) {
          // a tilted card behind: bring it to the front instead of opening it
          var c = e.target.closest(".ms-card");
          if (c && !c.classList.contains("is-active")) { e.preventDefault(); storyGo(board, +c.getAttribute("data-i")); storyStart(board); }
          return;
        }
        e.preventDefault();
        var cur = board.__msIndex || 0;
        storyGo(board, b.classList.contains("ms-li") ? +b.getAttribute("data-i") : cur + (+b.getAttribute("data-ms-go")));
        storyStart(board);
      });
      var pause = function (on) { board.__msPaused = on; board.classList.toggle("is-paused", on); };
      board.addEventListener("mouseenter", function () { pause(true); });
      board.addEventListener("mouseleave", function () { pause(false); });
      board.addEventListener("focusin", function () { pause(true); });
      board.addEventListener("focusout", function () { pause(false); });
      board.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          storyGo(board, (board.__msIndex || 0) + (e.key === "ArrowRight" ? 1 : -1));
          storyStart(board);
        }
      });
      // swipe on phones
      var deck = board.querySelector(".ms-deck"), x0 = null, y0 = null;
      deck.addEventListener("touchstart", function (e) { var t = e.touches[0]; x0 = t.clientX; y0 = t.clientY; }, { passive: true });
      deck.addEventListener("touchend", function (e) {
        if (x0 == null) return;
        var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
        x0 = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { storyGo(board, (board.__msIndex || 0) + (dx < 0 ? 1 : -1)); storyStart(board); }
      }, { passive: true });
      // intro lines: two short slides
      var intro = $("msIntro");
      if (intro && !prefersReducedMotion()) {
        var slides = intro.querySelectorAll(".ms-intro-slide"), dots = intro.querySelectorAll(".ms-intro-dots button"), k = 0;
        var show = function (j) {
          k = j;
          slides.forEach(function (s, i) { s.classList.toggle("is-active", i === j); });
          dots.forEach(function (d, i) { d.classList.toggle("is-active", i === j); d.setAttribute("aria-current", i === j ? "true" : "false"); });
        };
        dots.forEach(function (d, i) { d.addEventListener("click", function () { show(i); }); });
        setInterval(function () { if (!document.hidden) show((k + 1) % slides.length); }, 6000);
      }
    }
    storyStart(board);
  }

  /* ---------------- Hero slider ---------------- */
  var HERO_LCP_FULL =
    "images/hero-banner/premium-black-floral-embroidery-abaya-bangladesh-model-original-dubai-cherry-fabric-(2).webp";
  var HERO_LCP_SRCSET =
    "images/hero-banner/hero-lcp-640.webp 640w, " +
    "images/hero-banner/hero-lcp-960.webp 960w, " +
    "images/hero-banner/hero-lcp-1280.webp 1280w, " +
    HERO_LCP_FULL +
    " 1920w";

  function isUploadedHeroImage(src) {
    var s = String(src || "")
      .trim()
      .split("#")[0]
      .split("?")[0]
      .replace(/^\.\//, "");
    if (!s) return false;
    return /(^|\/)images\/hero-banner\//i.test(s);
  }

  function isLcpHeroSrc(src) {
    var s = String(src || "");
    return /premium-black-floral-embroidery-abaya-bangladesh-model-original-dubai-cherry-fabric|\bhero-lcp-\d+\.webp/i.test(
      s
    );
  }

  /* Slides 2+ stay as a 1px placeholder until the page has loaded, so ~500 KB of
     banner images never compete with the first-viewport LCP image. */
  var HERO_PLACEHOLDER = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  /* Slides with generated 640/960px variants (images/hero-banner/<base>-640.webp / -960.webp). */
  var HERO_VARIANT_BASES = {
    "muslim-abaya-homepage-hero-banner": 1,
    "premium-black-3-part-abaya-set-hero-banner-1920x840": 1,
    "muslim-abaya-premium-black-floral-embroidery-niqab-abaya-hero-banner-1920x840": 1,
    "emium-short-khimar-hijab-hero-banner-1920x840": 1,
    "premium-white-cotton-panjabi-hero-banner-1920x840": 1
  };
  function heroSrcsetFor(src) {
    var m = /^images\/hero-banner\/(.+)\.webp$/.exec(String(src || ""));
    if (!m || !HERO_VARIANT_BASES[m[1]]) return "";
    var base = "images/hero-banner/" + m[1];
    return base + "-640.webp 640w, " + base + "-960.webp 960w, " + src + " 1920w";
  }
  var heroSlidesArmed = false;
  function activateHeroSlideImages(index) {
    var hero = $("homeHero");
    if (!hero) return;
    var slide = hero.querySelectorAll(".home-hero-slide")[index];
    if (!slide) return;
    slide.querySelectorAll("img[data-src]").forEach(function (im) {
      var real = im.getAttribute("data-src");
      var set = im.getAttribute("data-srcset");
      im.removeAttribute("data-src");
      im.removeAttribute("data-srcset");
      if (set) im.srcset = set;
      if (real) im.src = real;
    });
  }
  function warmNextHeroImage() {
    function warm() {
      var hero = $("homeHero");
      if (!hero || document.hidden || hero.__ahHeroVisible === false || !heroTotalRef) return;
      activateHeroSlideImages((heroIdx + 1) % heroTotalRef);
    }
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(warm, { timeout: 2000 });
    } else {
      window.setTimeout(warm, 100);
    }
  }
  function scheduleHeroSlideImages() {
    if (heroSlidesArmed) return;
    heroSlidesArmed = true;
    var done = false;
    function run() {
      if (done) return;
      done = true;
      warmNextHeroImage();
    }
    function afterLoad() {
      setTimeout(run, 1500);
    }
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
  }

  function heroImgTag(it, i, heroEyebrow) {
    var img = it.image;
    var alt = it.alt || heroEyebrow;
    var isFirst = i === 0;
    var attrs =
      " src='" +
      (isFirst
        ? escapeHtml(isLcpHeroSrc(img) ? "images/hero-banner/hero-lcp-960.webp" : img)
        : HERO_PLACEHOLDER +
          "' data-src='" +
          escapeHtml(img) +
          (heroSrcsetFor(img)
            ? "' data-srcset='" + escapeHtml(heroSrcsetFor(img)) + "' sizes='100vw"
            : "")) +
      "' alt='" +
      escapeHtml(alt) +
      "' width='1920' height='840' decoding='" +
      (isFirst ? "sync" : "async") +
      "'";
    if (isFirst) attrs += " fetchpriority='high'";
    if (isFirst && isLcpHeroSrc(img)) {
      attrs += " srcset='" + HERO_LCP_SRCSET + "' sizes='100vw'";
    }
    return "<img" + attrs + ">";
  }

  function slideHtml(it, i, copy) {
    return (
      "<div class='home-hero-slide" +
      (i === 0 ? " is-active" : "") +
      "'>" +
      heroImgTag(it, i, copy.eyebrow) +
      "<div class='home-hero-cap'>" +
      "<p class='eyebrow'>" +
      (it.eyebrow || copy.eyebrow) +
      "</p>" +
      "<h2 class='head'>" +
      (it.heading || copy.heading) +
      "</h2>" +
      "<p class='sub'>" +
      (it.subtitle || copy.subtitle) +
      "</p>" +
      "<a class='hero-btn' href='" +
      escapeHtml(it.link || "/") +
      "'>" +
      (it.buttonText || copy.buttonText) +
      "</a>" +
      "</div>" +
      "</div>"
    );
  }

  function heroDotsHtml(count) {
    var html = "";
    var i;
    for (i = 0; i < count; i++) {
      html +=
        "<button type='button' aria-label='Slide " +
        (i + 1) +
        "' class='" +
        (i === 0 ? "is-active" : "") +
        "' data-slide='" +
        i +
        "'></button>";
    }
    return html;
  }

  function bindHeroErrors(hero) {
    hero.querySelectorAll(".home-hero-slide img").forEach(function (img) {
      if (img.getAttribute("data-ma-hero-err")) return;
      img.setAttribute("data-ma-hero-err", "1");
      img.addEventListener("error", function () {
        var slide = img.closest(".home-hero-slide");
        if (slide) slide.remove();
        var live = hero.querySelectorAll(".home-hero-slide");
        var dotsWrap = hero.querySelector(".home-hero-dots");
        if (dotsWrap) {
          dotsWrap.innerHTML = heroDotsHtml(live.length);
          dotsWrap.querySelectorAll("button").forEach(function (dot) {
            dot.addEventListener("click", function () {
              var n = hero.querySelectorAll(".home-hero-slide").length;
              goToSlide(hero, parseInt(dot.getAttribute("data-slide"), 10) || 0, n);
              startHero(hero, n);
            });
          });
        }
        var n = live.length;
        heroTotalRef = n;
        if (n) goToSlide(hero, 0, n);
        startHero(hero, n);
      });
    });
  }

  function manualHeroSlides() {
    var cfg = window.SITE_HERO_CONFIG || {};
    var list = Array.isArray(cfg.slides) ? cfg.slides : [];
    return list.filter(function (s) {
      return s && isUploadedHeroImage(s.image);
    });
  }

  function renderHero() {
    var hero = $("homeHero");
    if (!hero) return;

    var heroCfg = window.SITE_HERO_CONFIG || {};
    var copy = {
      eyebrow: heroCfg.eyebrow || "Eid Collection 2026",
      heading: heroCfg.heading || "Experience<br>the Elegance",
      subtitle: heroCfg.subtitle || "Premium modest wear crafted with comfort &amp; purity.",
      buttonText: heroCfg.buttonText || "Shop Now"
    };

    var items = manualHeroSlides();
    if (!items.length) return;

    var track = hero.querySelector(".home-hero-track");
    var firstImg = hero.querySelector(".home-hero-slide img");
    var firstMatches =
      track &&
      firstImg &&
      items[0] &&
      isLcpHeroSrc(firstImg.getAttribute("src") || "") &&
      isLcpHeroSrc(items[0].image || "");

    if (hero.querySelector(".home-hero-arrow") && firstMatches) {
      return;
    }

    if (firstMatches && !hero.querySelector(".home-hero-arrow")) {
      var extra = "";
      var i;
      for (i = 1; i < items.length; i++) {
        extra += slideHtml(items[i], i, copy);
      }
      var firstSlide = hero.querySelector(".home-hero-slide");
      if (extra && firstSlide) firstSlide.insertAdjacentHTML("afterend", extra);
      if (!firstImg.getAttribute("srcset")) {
        firstImg.setAttribute("srcset", HERO_LCP_SRCSET);
        firstImg.setAttribute("sizes", "100vw");
      }
      track.insertAdjacentHTML(
        "beforeend",
        "<button type='button' class='home-hero-arrow prev' aria-label='Previous'>&#8249;</button>" +
          "<button type='button' class='home-hero-arrow next' aria-label='Next'>&#8250;</button>" +
          "<div class='home-hero-dots'>" +
          heroDotsHtml(items.length) +
          "</div>"
      );
      heroIdx = 0;
      bindHero(hero, items.length);
      bindHeroErrors(hero);
      scheduleHeroSlideImages();
      return;
    }

    var slides = items
      .map(function (it, idx) {
        return slideHtml(it, idx, copy);
      })
      .join("");

    hero.innerHTML =
      "<div class='home-hero-track'>" +
      slides +
      "<button type='button' class='home-hero-arrow prev' aria-label='Previous'>&#8249;</button>" +
      "<button type='button' class='home-hero-arrow next' aria-label='Next'>&#8250;</button>" +
      "<div class='home-hero-dots'>" +
      heroDotsHtml(items.length) +
      "</div>" +
      "</div>";

    heroIdx = 0;
    bindHero(hero, items.length);
    bindHeroErrors(hero);
    scheduleHeroSlideImages();
  }

  function goToSlide(hero, idx, total) {
    var slides = hero.querySelectorAll(".home-hero-slide");
    var dots = hero.querySelectorAll(".home-hero-dots button");
    if (!slides.length) return;
    heroIdx = (idx + total) % total;
    activateHeroSlideImages(heroIdx);
    slides.forEach(function (s, i) {
      s.classList.toggle("is-active", i === heroIdx);
    });
    dots.forEach(function (d, i) {
      d.classList.toggle("is-active", i === heroIdx);
    });
    warmNextHeroImage();
  }

  function startHero(hero, total) {
    stopHero();
    if (!hero || total <= 1 || !heroAutoplayAllowed() || document.hidden ||
        hero.__ahHeroVisible === false || hero.__ahHeroPaused) return;
    heroTimer = setInterval(function () {
      goToSlide(hero, heroIdx + 1, total);
    }, HERO_INTERVAL);
  }

  function stopHero() {
    if (heroTimer) {
      clearInterval(heroTimer);
      heroTimer = null;
    }
  }

  function heroAutoplayAllowed() {
    // Keep touch visitors in control: carousel transitions during a vertical
    // fling compete with page scrolling on lower-powered mobile devices.
    return !prefersReducedMotion() &&
      !(window.matchMedia && window.matchMedia("(max-width: 900px), (pointer: coarse)").matches);
  }

  function bindHero(hero, total) {
    hero.querySelector(".home-hero-arrow.prev").addEventListener("click", function () {
      goToSlide(hero, heroIdx - 1, total);
      startHero(hero, total);
    });
    hero.querySelector(".home-hero-arrow.next").addEventListener("click", function () {
      goToSlide(hero, heroIdx + 1, total);
      startHero(hero, total);
    });
    hero.querySelectorAll(".home-hero-dots button").forEach(function (dot) {
      dot.addEventListener("click", function () {
        goToSlide(hero, parseInt(dot.getAttribute("data-slide"), 10) || 0, total);
        startHero(hero, total);
      });
    });
    if (!hero.__ahHoverBound) {
      hero.__ahHoverBound = true;
      hero.addEventListener("mouseenter", function () {
        if (window.matchMedia && !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        hero.__ahHeroPaused = true;
        stopHero();
      });
      hero.addEventListener("mouseleave", function () {
        hero.__ahHeroPaused = false;
        startHero(hero, heroTotalRef);
      });
      hero.__ahHeroVisible = typeof window.IntersectionObserver !== "function";
      if (!hero.__ahHeroVisible) {
        hero.__ahVisibilityObserver = new window.IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            hero.__ahHeroVisible = entry.isIntersecting;
          });
          if (hero.__ahHeroVisible) warmNextHeroImage();
          startHero(hero, heroTotalRef);
        }, { threshold: 0.05 });
        hero.__ahVisibilityObserver.observe(hero);
      }
    }
    heroTotalRef = total;
    startHero(hero, total);
  }

  /* ---------------- Boot ---------------- */
  var rendered = false;
  function renderAll() {
    renderHero();
    if (!window.CATEGORY_PRODUCTS || !activeSections().length) return false;
    renderCatnav();
    renderSections();
    renderStoryboard();
    var sk = $("homeSkeleton");
    if (sk) sk.style.display = "none";
    rendered = true;
    return true;
  }

  /* Render only after the (deferred) homepage stylesheet is applied, so unstyled cards never flash
     and shift the page (CLS). Falls back after 1.5 s. */
  function afterHomeCss(cb) {
    var link = document.querySelector('link[rel="stylesheet"][href*="index-home-muslim-abaya"]');
    if (!link || (link.sheet && link.media !== "print")) {
      cb();
      return;
    }
    var done = false;
    function go() {
      if (done) return;
      done = true;
      if (link.media === "print") link.media = "all";
      cb();
    }
    link.addEventListener("load", go, { once: true });
    link.addEventListener("error", go, { once: true });
    window.setTimeout(go, 1500);
  }

  // Called by index-catalog-defer.js once catalog scripts finish loading.
  window.__homeRefreshCatalog = function (options) {
    if (options && options.initial && rendered) return;
    afterHomeCss(function () {
      if (!options || !options.initial || !rendered) renderAll();
    });
  };

  function boot() {
    afterHomeCss(bootRender);
  }

  function bootRender() {
    if (renderAll()) return;
    // Catalog may still be loading; retry a few times as a fallback.
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (renderAll() || tries > 40) clearInterval(iv);
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // Keep cart button states / badges in sync if the store cart changes elsewhere.
  window.addEventListener("storeCartUpdated", function () {
    if (!rendered) return;
  });

  function restartRowSliders() {
    var root = $("homeSections");
    if (!root) return;
    stopAllRowSliders();
    root.querySelectorAll(".home-section-body").forEach(function (body) {
      var rowEl = body.querySelector(".home-row");
      if (!rowEl) return;
      window.requestAnimationFrame(function () {
        startRowAuto(body, rowEl);
      });
    });
  }

  window.addEventListener("pageshow", function () {
    if (!rendered) return;
    restartRowSliders();
    startHero($("homeHero"), heroTotalRef);
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      stopAllRowSliders();
      stopHero();
    } else if (rendered) {
      restartRowSliders();
      startHero($("homeHero"), heroTotalRef);
    }
  });
  window.addEventListener("pagehide", function () {
    stopAllRowSliders();
    stopHero();
  });

  // React to a real device/width or motion preference change without doing
  // layout work for every height-only viewport resize during a mobile swipe.
  if (window.matchMedia) {
    ["(max-width: 900px), (pointer: coarse)", "(prefers-reduced-motion: reduce)"].forEach(function (query) {
      var media = window.matchMedia(query);
      function syncAutoplayMode() {
        if (rendered) restartRowSliders();
        startHero($("homeHero"), heroTotalRef);
      }
      if (typeof media.addEventListener === "function") media.addEventListener("change", syncAutoplayMode);
      else if (typeof media.addListener === "function") media.addListener(syncAutoplayMode);
    });
  }
})();
