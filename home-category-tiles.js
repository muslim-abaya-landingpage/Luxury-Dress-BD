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
  // The small card thumbnail (same as the product cards), not the full photo: the tiles are below the hero
  // and 8 full-size photos (~1 MB) slowed the hero image on mobile.
  function imgFor(key) {
    var list = (window.CATEGORY_PRODUCTS || {})[key] || [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i], raw = p && (p.image || p.img);
      if (!p || !raw || /- back|- side/i.test(p.name || "")) continue;
      if (typeof window.maHomeCardImage === "function") return window.maHomeCardImage(p) || {};
      var full = window.maCatalog && window.maCatalog.resolveImageUrl ? window.maCatalog.resolveImageUrl(raw) : raw;
      return { src: full, full: full };
    }
    return {};
  }
  function tileImg(im) {
    return (im.avif ? '<picture><source type="image/avif" data-tile-srcset="' + esc(im.avif.split("/").map(encodeURIComponent).join("/")) + '">' : "") +
      '<img data-tile-src="' + esc(im.src) + '" data-full="' + esc(im.full || im.src) + '" alt="" loading="lazy" decoding="async" width="480" height="600"' +
      ' onerror="var f=this.getAttribute(\'data-full\');var s=this.parentNode&amp;&amp;this.parentNode.tagName===\'PICTURE\'&amp;&amp;this.parentNode.querySelector(\'source\');if(s)s.remove();if(f&amp;&amp;this.getAttribute(\'src\')!==f){this.src=f}else{this.onerror=null}">' +
      (im.avif ? "</picture>" : "");
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
      var im = imgFor(cat[0]), image = im.src;
      return '<a class="ma-image-category-card' + (image ? '' : ' is-placeholder') + '" href="' + esc(typeof window.siteHref === "function" ? window.siteHref(cat[2]) : cat[2]) + '">' +
        (image ? tileImg(im) : '<span class="ma-cat-placeholder-mark">M</span>') +
        '<span class="ma-image-category-shade"></span><span class="ma-image-category-name">' + esc(cat[1]) + '</span><span class="ma-image-category-arrow" aria-hidden="true">↗</span></a>';
    }).join("");
    section.innerHTML = '<div class="ma-image-category-heading"><span>DISCOVER OUR COLLECTION</span><h2>SHOP BY CATEGORY</h2></div><div class="ma-image-category-grid">' + cards + '</div>';
    main.parentNode.insertBefore(section, main);
    if (document.readyState === "complete") loadTilePhotos();
    return true;
  }
  // Tile photos start only after the page (and so the hero banner, the largest image) has loaded, so they do not
  // take mobile bandwidth from the banner. Until then each tile shows its gold gradient background.
  function loadTilePhotos() {
    var grid = document.getElementById("ma-image-category-grid");
    if (!grid) return;
    grid.querySelectorAll("source[data-tile-srcset]").forEach(function (s) { s.srcset = s.getAttribute("data-tile-srcset"); s.removeAttribute("data-tile-srcset"); });
    grid.querySelectorAll("img[data-tile-src]").forEach(function (img) { img.src = img.getAttribute("data-tile-src"); img.removeAttribute("data-tile-src"); });
  }
  function whenLoaded() {
    if (document.readyState === "complete") setTimeout(loadTilePhotos, 0);
    else window.addEventListener("load", function () { setTimeout(loadTilePhotos, 0); }, { once: true });
  }
  function boot() {
    whenLoaded();
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
