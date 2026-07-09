/* ==========================================================================
   Anzaar-style homepage renderer
   - Full-width hero slider (product images from the catalog)
   - Category sections (heading + View All + horizontal card row)
   - Product cards wired to the existing store cart (cart-utils.js)
   Data source: window.CATEGORY_PRODUCTS + window.CATALOG_SECTIONS
   ========================================================================== */
(function () {
  "use strict";

  var TK = "\u09F3"; // ৳
  var MAX_CARDS_PER_SECTION = 10;
  var HERO_SLIDES = 5;
  var HERO_INTERVAL = 5000;

  var heroTimer = null;
  var heroIdx = 0;

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
      if (s.enabled === false && !categoryHasProducts(s.key)) return false;
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
      if (out.length >= MAX_CARDS_PER_SECTION) break;
    }
    return out;
  }

  function typePriceFrom(p) {
    var map = p && p.priceByType;
    if (!map) return 0;
    var vals = Object.keys(map)
      .map(function (kk) {
        return parseInt(map[kk], 10) || 0;
      })
      .filter(function (v) {
        return v > 0;
      });
    return vals.length ? Math.min.apply(null, vals) : 0;
  }

  function basePrice(p) {
    var from = typePriceFrom(p);
    if (from) return from;
    return parseInt(p && p.price, 10) || 550;
  }

  function priceHtml(p) {
    var from = typePriceFrom(p);
    if (from) {
      return TK + from + "<span class='from'>থেকে</span>";
    }
    return TK + (parseInt(p && p.price, 10) || 550);
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
    var id = p.id || "";
    return base + "#p=" + encodeURIComponent(id);
  }

  var cartIconSvg =
    "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true'><path d='M6 6h15l-1.5 9h-12z'/><circle cx='9' cy='20' r='1'/><circle cx='18' cy='20' r='1'/><path d='M6 6L5 3H2'/></svg>";

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
    if (typeof window.pushTrackingEvent === "function") {
      window.pushTrackingEvent("AddToCart", {
        content_ids: [p.id],
        content_name: p.name,
        value: price,
        currency: "BDT"
      });
    }
    if (typeof window.showCartAddedToast === "function") {
      window.showCartAddedToast({
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
    var msg =
      waLink() +
      "?text=" +
      encodeURIComponent("I want to order " + p.name);
    return (
      "<article class='ah-card' data-pid='" +
      escapeHtml(p.id) +
      "'>" +
      "<a class='ah-card-media' href='" +
      escapeHtml(dHref) +
      "'>" +
      "<span class='ah-card-badge'>Sale</span>" +
      "<img src='" +
      escapeHtml(img) +
      "' alt='" +
      escapeHtml(p.name) +
      "' loading='lazy' decoding='async' onerror=\"this.onerror=null;this.src='images/Baby-Pink-Floral-Print.jpeg'\">" +
      "</a>" +
      "<div class='ah-card-body'>" +
      "<a class='ah-card-name' href='" +
      escapeHtml(dHref) +
      "'>" +
      escapeHtml(p.name) +
      "</a>" +
      "<div class='ah-card-price'>" +
      priceHtml(p) +
      "</div>" +
      "<div class='ah-actions'>" +
      "<button type='button' class='ah-btn ah-btn-cart' data-action='add'>" +
      cartIconSvg +
      "<span>Add to Cart</span></button>" +
      "<a class='ah-btn ah-btn-msg' href='" +
      escapeHtml(msg) +
      "' target='_blank' rel='noopener'>Send Message</a>" +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  /* ---------------- Sections ---------------- */
  function renderSections() {
    var root = $("homeSections");
    if (!root) return;
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

    root.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-action='add']");
      if (!btn) return;
      e.preventDefault();
      var card = btn.closest(".ah-card");
      var section = btn.closest(".home-section");
      if (!card || !section) return;
      var pid = card.getAttribute("data-pid");
      var key = section.getAttribute("data-cat");
      var sec = secByKey[key];
      if (!sec) return;
      var list = (window.CATEGORY_PRODUCTS || {})[key] || [];
      var p = list.find(function (x) {
        return x && String(x.id) === String(pid);
      });
      if (!p) return;
      addToCart(sec, p);
      btn.classList.add("is-active");
    });

    var arrows = root.querySelectorAll(".home-row-arrow");
    arrows.forEach(function (arrow) {
      arrow.addEventListener("click", function () {
        var body = arrow.closest(".home-section-body");
        if (!body) return;
        var rowEl = body.querySelector(".home-row");
        if (!rowEl) return;
        var step = rowEl.clientWidth * 0.8;
        rowEl.scrollBy({
          left: arrow.classList.contains("next") ? step : -step,
          behavior: "smooth"
        });
      });
    });
  }

  /* ---------------- Category chip nav ---------------- */
  function renderCatnav() {
    var nav = $("homeCatnav");
    if (!nav) return;
    var secs = activeSections();
    if (!secs.length) return;
    nav.innerHTML = secs
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
  }

  /* ---------------- Hero slider ---------------- */
  function heroProducts() {
    var secs = activeSections();
    var out = [];
    var seen = {};
    // round-robin one product per section for variety
    var maxLen = 0;
    var lists = secs.map(function (s) {
      var l = sectionProducts(s.key);
      if (l.length > maxLen) maxLen = l.length;
      return { sec: s, list: l };
    });
    for (var i = 0; i < maxLen && out.length < HERO_SLIDES; i++) {
      for (var j = 0; j < lists.length && out.length < HERO_SLIDES; j++) {
        var p = lists[j].list[i];
        if (!p) continue;
        var img = resolveImg(p);
        if (!img || seen[img]) continue;
        seen[img] = true;
        out.push({ sec: lists[j].sec, p: p });
      }
    }
    return out;
  }

  function renderHero() {
    var hero = $("homeHero");
    if (!hero) return;
    var items = heroProducts();
    if (!items.length) return;

    var slides = items
      .map(function (it, i) {
        var img = resolveImg(it.p);
        var link = detailHref(it.sec, it.p);
        return (
          "<div class='home-hero-slide" +
          (i === 0 ? " is-active" : "") +
          "'>" +
          "<img src='" +
          escapeHtml(img) +
          "' alt='" +
          escapeHtml(it.p.name) +
          "'" +
          (i === 0 ? " fetchpriority='high'" : " loading='lazy'") +
          " onerror=\"this.onerror=null;this.src='images/Baby-Pink-Floral-Print.jpeg'\">" +
          "<div class='home-hero-cap'>" +
          "<p class='eyebrow'>Eid Collection 2026</p>" +
          "<h2 class='head'>Experience<br>the Elegance</h2>" +
          "<p class='sub'>Premium modest wear crafted with comfort &amp; purity.</p>" +
          "<a class='hero-btn' href='" +
          escapeHtml(link) +
          "'>Shop Now</a>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");

    var dots = items
      .map(function (it, i) {
        return (
          "<button type='button' aria-label='Slide " +
          (i + 1) +
          "' class='" +
          (i === 0 ? "is-active" : "") +
          "' data-slide='" +
          i +
          "'></button>"
        );
      })
      .join("");

    hero.innerHTML =
      "<div class='home-hero-track'>" +
      slides +
      "<button type='button' class='home-hero-arrow prev' aria-label='Previous'>&#8249;</button>" +
      "<button type='button' class='home-hero-arrow next' aria-label='Next'>&#8250;</button>" +
      "<div class='home-hero-dots'>" +
      dots +
      "</div>" +
      "</div>";

    heroIdx = 0;
    bindHero(hero, items.length);
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
    hero.addEventListener("mouseenter", stopHero);
    hero.addEventListener("mouseleave", function () {
      startHero(hero, total);
    });
    startHero(hero, total);
  }

  /* ---------------- Boot ---------------- */
  var rendered = false;
  function renderAll() {
    if (!window.CATEGORY_PRODUCTS || !activeSections().length) return false;
    renderHero();
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
})();
