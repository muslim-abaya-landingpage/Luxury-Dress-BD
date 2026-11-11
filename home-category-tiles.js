(function () {
  "use strict";
  var CATS = [
    ["abaya", "ABAYA", "/abaya"],
    ["cover-up", "COVER UP", "/cover-up"],
    ["premium-two-piece", "PREMIUM TWO-PIECE", "/premium-two-piece"],
    ["tops-kurti", "TOPS / KURTI", "/tops-kurti"],
    ["embroidery", "EMBROIDERY", "/embroidery"],
    ["hijab", "HIJAB", "/hijab"],
    ["panjabi", "PANJABI", "/panjabi"],
    ["three-piece-dress", "THREE PIECE DRESS", "/three-piece-dress"]
  ];
  function esc(s) { return String(s || "").replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }
  function imgFor(key) {
    var list = (window.CATEGORY_PRODUCTS || {})[key] || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i], raw = p && (p.image || p.img);
      if (!p || !raw || /- back|- side/i.test(p.name || "")) continue;
      return window.maCatalog && window.maCatalog.resolveImageUrl ? window.maCatalog.resolveImageUrl(raw) : raw;
    }
    return "";
  }
  function render() {
    if (!window.CATEGORY_PRODUCTS) return false;
    var main = document.getElementById("homeSections");
    if (!main || document.getElementById("ma-image-category-grid")) return true;
    var section = document.createElement("section");
    section.id = "ma-image-category-grid";
    section.className = "ma-image-category-section";
    section.setAttribute("aria-label", "Shop by category");
    var cards = CATS.map(function (cat) {
      var image = imgFor(cat[0]);
      return '<a class="ma-image-category-card' + (image ? '' : ' is-placeholder') + '" href="' + esc(typeof window.siteHref === "function" ? window.siteHref(cat[2]) : cat[2]) + '"' + (image ? ' style="--ma-cat-image:url(&quot;' + esc(image) + '&quot;)"' : '') + '>' +
        (image ? '<img src="' + esc(image) + '" alt="" loading="lazy" decoding="async">' : '<span class="ma-cat-placeholder-mark">M</span>') +
        '<span class="ma-image-category-shade"></span><span class="ma-image-category-name">' + esc(cat[1]) + '</span><span class="ma-image-category-arrow" aria-hidden="true">↗</span></a>';
    }).join("");
    section.innerHTML = '<div class="ma-image-category-heading"><span>DISCOVER OUR COLLECTION</span><h2>SHOP BY CATEGORY</h2></div><div class="ma-image-category-grid">' + cards + '</div>';
    main.parentNode.insertBefore(section, main);
    return true;
  }
  function boot() {
    if (render()) return;
    var tries = 0, timer = setInterval(function () {
      tries++;
      if (render() || tries > 50) clearInterval(timer);
    }, 200);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  window.addEventListener("maCatalogReady", render);
})();
