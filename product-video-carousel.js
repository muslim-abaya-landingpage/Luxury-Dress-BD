/**
 * "Watch & Shop" — হোমপেজে একটা ভিডিও-ক্যারোসেল।
 *
 * ডেটা সোর্স: window.CATEGORY_PRODUCTS-এর যেকোনো প্রোডাক্টে videoUrl ফিল্ড থাকলে
 * (Product Manager-এর "ভিডিও লিংক" ফিল্ড দিয়ে YouTube বা Facebook — দুটোই বসানো
 * যায়), সেটাই এখানে দেখানো হয় — নাম, দাম, ছবি সব আসল ক্যাটালগ থেকে আসে, এখানে
 * আলাদা করে কিছু হার্ডকোড করা নেই। কোনো প্রোডাক্টে ভিডিও না থাকলে পুরো সেকশনটাই
 * হাইড থাকে।
 *
 * YouTube ভিডিও প্লে করতে index-youtube-lazy.js-এর আগে থেকে থাকা click-delegation
 * (.lux-video-facade / data-video-id) পুনরায় ব্যবহার করা হচ্ছে, যাতে একই লজিক
 * দু'জায়গায় লিখতে না হয়।
 *
 * Facebook ভিডিওর জন্য আলাদা কোনো অ্যাপ/SDK/অ্যাক্সেস-টোকেন লাগে না — Facebook-এর
 * পাবলিক "Video Plugin" iframe (facebook.com/plugins/video.php?href=...) ব্যবহার
 * করা হয়েছে, যা কোনো লগইন বা অ্যাপ আইডি ছাড়াই পাবলিক ভিডিও চালায়। শুধু সীমাবদ্ধতা:
 * Facebook ভিডিওর থাম্বনেইল পাবলিকভাবে (টোকেন ছাড়া) আনার কোনো সহজ উপায় নেই, তাই
 * ক্লিক করার আগে প্রোডাক্টের নিজের ছবিটাই প্রিভিউ হিসেবে দেখানো হয় (fake থাম্বনেইল
 * বানানো হয়নি)।
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

  function isFacebookVideoUrl(url) {
    var s = String(url || "").trim();
    if (!s) return false;
    return /(^|\/\/)(www\.|m\.|web\.)?(facebook\.com|fb\.watch)\//i.test(s);
  }

  // provider+ref: {provider:'youtube', videoId:'...'} বা {provider:'facebook', href:'<full fb url>'}
  function resolveVideo(url) {
    var vid = extractYouTubeId(url);
    if (vid) return { provider: "youtube", videoId: vid };
    if (isFacebookVideoUrl(url)) return { provider: "facebook", href: String(url).trim() };
    return null;
  }

  function collectVideoProducts() {
    var secs = window.CATALOG_SECTIONS || [];
    var out = [];
    secs.forEach(function (sec) {
      var list = (window.CATEGORY_PRODUCTS || {})[sec.key] || [];
      list.forEach(function (p) {
        var video = resolveVideo(p.videoUrl);
        if (!video) return;
        out.push({ sec: sec, p: p, video: video });
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

  function videoRatioHtml(item, name) {
    var v = item.video;
    if (v.provider === "youtube") {
      // index-youtube-lazy.js-এর গ্লোবাল click-delegation (.lux-video-facade + data-video-id)
      // এটাকে ধরবে এবং YouTube iframe বসিয়ে দেবে।
      return (
        '<div class="wns-video-ratio" data-video-id="' + escapeHtml(v.videoId) + '">' +
        '<button type="button" class="lux-video-facade wns-facade">' +
        '<img src="https://i.ytimg.com/vi/' + escapeHtml(v.videoId) + '/hqdefault.jpg" alt="' + name + ' video" loading="lazy">' +
        '<span class="lux-video-play wns-play" aria-hidden="true"></span>' +
        "</button>" +
        "</div>"
      );
    }
    // Facebook — এই ভিডিও র‍্যাপারে data-video-id নেই (data-fb-href আছে), তাই
    // index-youtube-lazy.js-এর গ্লোবাল লিসেনার .lux-video-facade ক্লাস দেখে ক্লিক
    // ধরলেও data-video-id না পেয়ে কিছু করবে না — আসল প্লে হবে নিজের
    // bindRailClicks()-এ (নিচে)। .lux-video-facade/.lux-video-play ক্লাস শুধু
    // একই পজিশনিং/সাইজিং CSS রিইউজ করার জন্য রাখা হয়েছে।
    var p = item.p;
    var fallbackImg = escapeHtml(p.image || "");
    return (
      '<div class="wns-video-ratio" data-fb-href="' + escapeHtml(v.href) + '">' +
      '<button type="button" class="lux-video-facade wns-facade wns-facade-fb">' +
      '<img src="' + fallbackImg + '" alt="' + name + ' video" loading="lazy">' +
      '<span class="lux-video-play wns-play" aria-hidden="true"></span>' +
      '<span class="wns-fb-badge" aria-hidden="true">Facebook</span>' +
      "</button>" +
      "</div>"
    );
  }

  function cardHtml(item) {
    var p = item.p;
    var id = escapeHtml(p.id || "");
    var name = escapeHtml(p.name || "");
    var img = escapeHtml(p.image || "");
    var href = productHref(p.id);
    return (
      '<div class="wns-card">' +
      videoRatioHtml(item, name) +
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

  function activateFacebookVideo(wrap) {
    if (!wrap || wrap.getAttribute("data-loaded") === "1") return;
    var href = wrap.getAttribute("data-fb-href");
    if (!href) return;
    wrap.setAttribute("data-loaded", "1");
    var iframe = document.createElement("iframe");
    // Facebook-এর পাবলিক Video Plugin — কোনো অ্যাপ আইডি/SDK/লগইন লাগে না,
    // পাবলিক ভিডিওর জন্য এই iframe-টাই যথেষ্ট।
    iframe.src =
      "https://www.facebook.com/plugins/video.php?href=" +
      encodeURIComponent(href) +
      "&show_text=false&autoplay=true";
    iframe.title = "Luxury Dress Video Preview";
    iframe.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share");
    iframe.allowFullscreen = true;
    wrap.innerHTML = "";
    wrap.appendChild(iframe);
  }

  function bindRailClicks(rail) {
    rail.addEventListener("click", function (e) {
      var cartBtn = e.target && e.target.closest && e.target.closest(".wns-cart-btn");
      if (cartBtn) {
        e.preventDefault();
        e.stopPropagation();
        addToCartById(cartBtn.getAttribute("data-pid"));
        return;
      }
      var fbFacade = e.target && e.target.closest && e.target.closest(".wns-facade-fb");
      if (fbFacade) {
        var wrap = fbFacade.closest("[data-fb-href]");
        if (wrap) activateFacebookVideo(wrap);
      }
      // YouTube facades (.lux-video-facade) are handled by index-youtube-lazy.js's
      // own document-level listener — nothing to do here for those.
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
    if (items.length) bindRailClicks(rail);
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
