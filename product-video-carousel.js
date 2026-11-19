/**
 * "Watch & Shop" — হোমপেজে একটা ভিডিও-ক্যারোসেল, Anzaar-এর মতো।
 *
 * ডেটা সোর্স: window.CATEGORY_PRODUCTS-এর যেকোনো প্রোডাক্টে videoUrl ফিল্ড থাকলে
 * (Product Manager-এর "YouTube ভিডিও লিংক" ফিল্ড দিয়ে বসানো যায়), সেটাই এখানে
 * দেখানো হয় — নাম, দাম, ছবি সব আসল ক্যাটালগ থেকে আসে, এখানে আলাদা করে কিছু
 * হার্ডকোড করা নেই। কোনো প্রোডাক্টে ভিডিও না থাকলে পুরো সেকশনটাই হাইড থাকে।
 *
 * ভিডিও প্লে করতে index-youtube-lazy.js-এর আগে থেকে থাকা click-delegation
 * (.lux-video-facade / data-video-id) পুনরায় ব্যবহার করা হচ্ছে, যাতে একই
 * লজিক দু'জায়গায় লিখতে না হয়।
 */
(function () {
  "use strict";

  var TK = "৳"; // ৳

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function extractYouTubeId(url) {
    var s = String(url || "").trim();
    if (!s) return "";
    // ইতিমধ্যে শুধু আইডি বসানো থাকলে (এডিটর ভুলবশত পুরো লিংক না দিলে)
    if (/^[A-Za-z0-9_-]{10,15}$/.test(s)) return s;
    var m =
      s.match(/[?&]v=([A-Za-z0-9_-]{10,15})/) ||
      s.match(/youtu\.be\/([A-Za-z0-9_-]{10,15})/) ||
      s.match(/\/shorts\/([A-Za-z0-9_-]{10,15})/) ||
      s.match(/\/embed\/([A-Za-z0-9_-]{10,15})/);
    return m ? m[1] : "";
  }

  function collectVideoProducts() {
    var secs = window.CATALOG_SECTIONS || [];
    var out = [];
    secs.forEach(function (sec) {
      var list = (window.CATEGORY_PRODUCTS || {})[sec.key] || [];
      list.forEach(function (p) {
        var vid = extractYouTubeId(p.videoUrl);
        if (!vid) return;
        out.push({ sec: sec, p: p, videoId: vid });
      });
    });
    return out;
  }

  function priceHtml(p) {
    var price = parseInt(p.price, 10) || 0;
    if (typeof window.formatBdt === "function") return window.formatBdt(price);
    return TK + price;
  }

  function productHref(id) {
    return "/product/" + encodeURIComponent(id);
  }

  function cardHtml(item) {
    var p = item.p;
    var id = escapeHtml(p.id || "");
    var name = escapeHtml(p.name || "");
    var img = escapeHtml(p.image || "");
    var href = productHref(p.id);
    return (
      '<div class="wns-card">' +
      '<div class="wns-video-ratio" data-video-id="' + escapeHtml(item.videoId) + '">' +
      '<button type="button" class="lux-video-facade wns-facade">' +
      '<img src="https://i.ytimg.com/vi/' + escapeHtml(item.videoId) + '/hqdefault.jpg" alt="' + name + ' video" loading="lazy">' +
      '<span class="lux-video-play wns-play" aria-hidden="true"></span>' +
      "</button>" +
      "</div>" +
      '<div class="wns-product-strip">' +
      '<a class="wns-product-link" href="' + escapeHtml(href) + '">' +
      '<img class="wns-thumb" src="' + img + '" alt="' + name + '" loading="lazy">' +
      '<span class="wns-info">' +
      '<span class="wns-name">' + name + "</span>" +
      '<span class="wns-price">' + priceHtml(p) + "</span>" +
      "</span>" +
      "</a>" +
      '<button type="button" class="wns-cart-btn" data-pid="' + id + '" aria-label="কার্টে যোগ করুন" title="কার্টে যোগ করুন">' +
      "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' aria-hidden='true'><path d='M6 6h15l-1.5 9h-12z'/><circle cx='9' cy='20' r='1'/><circle cx='18' cy='20' r='1'/><path d='M6 6L5 3H2'/></svg>" +
      "</button>" +
      '<a class="wns-arrow-link" href="' + escapeHtml(href) + '" aria-label="প্রোডাক্ট দেখুন">&rarr;</a>' +
      "</div>" +
      "</div>"
    );
  }

  function addToCartById(productId) {
    var secs = window.CATALOG_SECTIONS || [];
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i];
      var list = (window.CATEGORY_PRODUCTS || {})[sec.key] || [];
      for (var j = 0; j < list.length; j++) {
        var p = list[j];
        if (String(p.id) !== String(productId)) continue;
        var price = parseInt(p.price, 10) || 0;
        var line = {
          id: p.id,
          name: p.name,
          price: price,
          quantity: 1,
          image: p.image || "",
          category: sec.key,
          categoryLabel: sec.menu
        };
        if (typeof window.enrichHomeCartLine === "function") {
          line = window.enrichHomeCartLine(p, line);
        }
        var existing =
          typeof window.loadStoreCart === "function" ? window.loadStoreCart({ readOnly: true }) : [];
        var merged =
          typeof window.addOrMergeStoreCartItem === "function"
            ? window.addOrMergeStoreCartItem(existing, line)
            : existing.concat([line]);
        if (typeof window.markStoreCartSession === "function") window.markStoreCartSession();
        if (typeof window.afterCartMutation === "function") window.afterCartMutation(merged);
        if (typeof window.pushTrackingEvent === "function") {
          window.pushTrackingEvent("AddToCart", {
            content_ids: [p.id],
            content_name: p.name,
            value: price,
            currency: "BDT"
          });
        }
        if (typeof window.showCartAddedToast === "function") {
          window.showCartAddedToast({ name: p.name, image: p.image || "", price: price });
        }
        return true;
      }
    }
    return false;
  }

  function bindCartButtons(rail) {
    rail.addEventListener("click", function (e) {
      var btn = e.target && e.target.closest && e.target.closest(".wns-cart-btn");
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      addToCartById(btn.getAttribute("data-pid"));
    });
  }

  function catalogLooksReady() {
    var secs = window.CATALOG_SECTIONS;
    var prods = window.CATEGORY_PRODUCTS;
    if (!secs || !prods) return false;
    // product-catalog-sync.js seeds CATEGORY_PRODUCTS with empty arrays before
    // category-products.js loads the real data. Without this check we'd decide
    // "no videos" from that empty stub and never look again.
    return secs.some(function (sec) {
      return ((prods[sec.key] || []).length) > 0;
    });
  }

  function render() {
    var section = document.getElementById("watchShopSection");
    var rail = document.getElementById("watchShopRail");
    if (!section || !rail) return false;
    if (!catalogLooksReady()) return false;

    var items = collectVideoProducts();
    rail.innerHTML = items.length ? items.map(cardHtml).join("") : "";
    if (items.length) bindCartButtons(rail);
    section.hidden = !items.length;
    return true;
  }

  function boot() {
    if (render()) return;
    window.addEventListener("ma:catalog-ready", function () { render(); }, { once: true });
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (render() || tries > 40) clearInterval(iv);
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
