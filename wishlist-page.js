/* /wishlist — the products saved with ♥ (wishlist.js). Built from the site catalog; a saved product that is
   no longer sold is skipped (and dropped from the list). Flat cards, no rounded corners (site design rule). */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function byId(id) { return document.getElementById(id); }
  function findProduct(id) {
    var all = window.CATEGORY_PRODUCTS || {};
    for (var k in all) {
      if (!Object.prototype.hasOwnProperty.call(all, k) || !Array.isArray(all[k])) continue;
      for (var i = 0; i < all[k].length; i++) if (all[k][i] && String(all[k][i].id) === id) return all[k][i];
    }
    return null;
  }
  function img(p) {
    var raw = p.imageCard || p.image || p.img || "";
    return window.maCatalog && window.maCatalog.resolveImageUrl ? window.maCatalog.resolveImageUrl(raw) : raw;
  }
  function price(p) { return typeof window.maFormatPriceHtml === "function" ? window.maFormatPriceHtml(p, null, parseInt(p.price, 10) || 0) : "৳" + esc(p.price); }
  function stock(p) { return window.maCatalog && window.maCatalog.getStockStatus ? window.maCatalog.getStockStatus(p) : { inStock: true, label: "In Stock" }; }
  function render() {
    if (!window.maWishlist || !window.CATEGORY_PRODUCTS || !window.maCatalog) return false;
    var ids = window.maWishlist.list(), items = [];
    ids.forEach(function (id) { var p = findProduct(id); if (p) items.push(p); else window.maWishlist.remove(id); });
    byId("wlEmpty").hidden = items.length > 0;
    byId("wlGrid").innerHTML = items.map(function (p) {
      var st = stock(p), href = "/product/" + encodeURIComponent(p.id);
      return '<li class="wl-card" data-pid="' + esc(p.id) + '">' +
        '<a class="wl-media" href="' + esc(href) + '"><img src="' + esc(img(p)) + '" alt="' + esc(p.name) + '" loading="lazy" width="480" height="600"></a>' +
        '<div class="wl-body"><a class="wl-name" href="' + esc(href) + '">' + esc(p.name) + '</a>' +
        '<div class="wl-price">' + price(p) + '</div>' +
        '<div class="wl-stock' + (st.inStock ? "" : " is-oos") + '">' + esc(st.label) + '</div>' +
        '<div class="wl-actions"><a class="wl-btn" href="' + esc(href) + '">' + (st.inStock ? "অর্ডার করুন" : "দেখুন") + '</a>' +
        '<button type="button" class="wl-remove" data-remove="' + esc(p.id) + '">সরান</button></div></div></li>';
    }).join("");
    return true;
  }
  function start() {
    var tries = 0;
    (function wait() { if (render() || ++tries > 60) return; setTimeout(wait, 150); })();
    window.addEventListener("ma-wishlist-change", render);
    window.addEventListener("ma:catalog-ready", render);
    byId("wlGrid").addEventListener("click", function (ev) {
      var b = ev.target.closest ? ev.target.closest("[data-remove]") : null;
      if (b && window.maWishlist) window.maWishlist.remove(b.getAttribute("data-remove"));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
