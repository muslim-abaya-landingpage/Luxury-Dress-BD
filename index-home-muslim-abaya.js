/* ==========================================================================
   Muslim Abaya homepage renderer
   - Full-width hero slider (uploaded images from images/hero-banner/ only)
   - Category sections (heading + View All + auto-sliding product row)
   - Product cards wired to the existing store cart (cart-utils.js)
   Data source: window.CATEGORY_PRODUCTS + window.CATALOG_SECTIONS
   ========================================================================== */
(function () {
  "use strict";

  if (!document.getElementById("ma-home-btn-row")) {
    var homeBtnCss = document.createElement("style");
    homeBtnCss.id = "ma-home-btn-row";
    homeBtnCss.textContent =
      ".ah-card .ah-actions{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:stretch;gap:8px;width:100%}" +
      ".ah-card .ah-btn{flex:1 1 0!important;width:0!important;min-width:0!important;border:none!important}" +
      ".ah-card .ah-btn-msg{background:#4a4a4a!important;color:#fff!important}";
    document.head.appendChild(homeBtnCss);
  }

  var TK = "\u09F3"; // ৳
  var HERO_INTERVAL = 5000;
  var ROW_INTERVAL = 4500;
  var rowTimers = [];

  var heroTimer = null;
  var heroIdx = 0;
  var heroTotalRef = 0;

  function $(id) {
    return document.getElementById(id);
  }

  function waLink() {
    return (
      (window.SITE_MEDIA && window.SITE_MEDIA.whatsappOrderLink) ||
      "https://wa.me/8801970831783"
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
    var base = href(sec.path || "/" + sec.key);
    return base + "#p=" + encodeURIComponent(p.id || "");
  }

  var cartIconSvg =
    "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'><path d='M3 4h1.6l1.1 11.2A2 2 0 0 0 7.7 17h9.7a2 2 0 0 0 2-1.7L21 8H7'/><circle cx='9' cy='20' r='1.35'/><circle cx='18' cy='20' r='1.35'/></svg>";

  /* ---------------- Cart ---------------- */
  function addToCart(sec, p) {
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
  function cardHtml(sec, p) {
    var img = resolveImg(p);
    var dHref = detailHref(sec, p);
    var outOfStock = isOutOfStock(p);
    var st = stockStatus(p);
    var msg =
      waLink() +
      "?text=" +
      encodeURIComponent("I want to order " + p.name);
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
      "<img src='" +
      escapeHtml(img) +
      "' alt='" +
      escapeHtml(p.name) +
      "' width='480' height='600' loading='lazy' decoding='async' onerror=\"this.onerror=null;this.src='images/Baby-Pink-Floral-Print.jpeg'\">" +
      "</a>" +
      "<div class='ah-card-body'>" +
      "<div class='ah-card-row'>" +
      "<a class='ah-card-name' href='" +
      escapeHtml(dHref) +
      "'>" +
      escapeHtml(p.name) +
      "</a>" +
      "<span class='ah-card-price'>" +
      priceHtml(p) +
      "</span>" +
      "</div>" +
      "<span class='ah-card-stock" +
      (outOfStock ? " is-oos" : "") +
      "'>" +
      escapeHtml(st.label) +
      "</span>" +
      "<div class='ah-actions'>" +
      (outOfStock
        ? "<button type='button' class='ah-btn ah-btn-cart' data-action='add' disabled>" +
          "<span>Out of Stock</span></button>"
        : "<button type='button' class='ah-btn ah-btn-cart' data-action='add'>" +
          cartIconSvg +
          "<span class='ah-btn-spin' aria-hidden='true'></span>" +
          "<span data-cart-label>Add to Cart</span></button>") +
      (outOfStock
        ? ""
        : "<a class='ah-btn ah-btn-msg' href='" +
          escapeHtml(msg) +
          "' target='_blank' rel='noopener'><span>Send Message</span></a>") +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  /* ---------------- Sections ---------------- */
  function renderSections() {
    var root = $("homeSections");
    if (!root) return;
    stopAllRowSliders();
    var secs = activeSections();
    if (!secs.length) return;

    var html = "";
    secs.forEach(function (sec) {
      var products = sectionProducts(sec.key);
      if (!products.length) return;
      var title = sec.menu || sec.key;
      var viewAll = href(sec.path || "/" + sec.key);
      var cards = products
        .map(function (p) {
          return cardHtml(sec, p);
        })
        .join("");
      html +=
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
        cards +
        "</div>" +
        "<button type='button' class='home-row-arrow next' aria-label='Next'>&#8250;</button>" +
        "</div>" +
        "</section>";
    });
    root.innerHTML = html;
    bindSections(root, secs);
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
    if (prefersReducedMotion() || !rowCanSlide(rowEl)) return;
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
    nav.innerHTML =
      "<div class='home-catnav-inner'>" +
      "<span class='home-catnav-label'>Women" +
      "<svg viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg' aria-hidden='true'>" +
      "<path d='M1 1l4 4 4-4' stroke='currentColor' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/>" +
      "</svg></span>" +
      links +
      "</div>";
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

  function heroImgTag(it, i, heroEyebrow) {
    var img = it.image;
    var alt = it.alt || heroEyebrow;
    var isFirst = i === 0;
    var attrs =
      " src='" +
      escapeHtml(isFirst && isLcpHeroSrc(img) ? "images/hero-banner/hero-lcp-960.webp" : img) +
      "' alt='" +
      escapeHtml(alt) +
      "' width='1920' height='840' decoding='" +
      (isFirst ? "sync" : "async") +
      "'";
    if (isFirst) attrs += " fetchpriority='high'";
    else attrs += " loading='lazy'";
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
  }

  function goToSlide(hero, idx, total) {
    var slides = hero.querySelectorAll(".home-hero-slide");
    var dots = hero.querySelectorAll(".home-hero-dots button");
    if (!slides.length) return;
    heroIdx = (idx + total) % total;
    slides.forEach(function (s, i) {
      s.classList.toggle("is-active", i === heroIdx);
    });
    dots.forEach(function (d, i) {
      d.classList.toggle("is-active", i === heroIdx);
    });
  }

  function startHero(hero, total) {
    stopHero();
    if (total <= 1) return;
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
      hero.addEventListener("mouseenter", function () { stopHero(); });
      hero.addEventListener("mouseleave", function () {
        startHero(hero, heroTotalRef);
      });
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
    var sk = $("homeSkeleton");
    if (sk) sk.style.display = "none";
    rendered = true;
    return true;
  }

  // Called by index-catalog-defer.js once catalog scripts finish loading.
  window.__homeRefreshCatalog = function () {
    renderAll();
  };

  function boot() {
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
  });
})();