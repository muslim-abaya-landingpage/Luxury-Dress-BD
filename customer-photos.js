/* customer-photos.js — "ক্রেতাদের তোলা ছবি" strip on the home page (Shop the Look).
   Shows only approved photo reviews from verified buyers (/api/photo-reviews). If there are none yet,
   nothing is shown — no sample or invented reviews. Each card links to the product it was bought from. */
(function () {
  "use strict";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function stars(n) { n = Math.max(0, Math.min(5, Math.round(Number(n) || 0))); return "★★★★★".slice(0, n) + '<span class="mcp-off">' + "★★★★★".slice(0, 5 - n) + "</span>"; }
  function productHref(id) { var href = "/product/" + encodeURIComponent(id); return typeof window.siteHref === "function" ? window.siteHref(href) : href; }
  function css() {
    if (document.getElementById("mcp-style")) return;
    var st = document.createElement("style");
    st.id = "mcp-style";
    st.textContent =
      ".mcp-section{max-width:1200px;margin:28px auto 8px;padding:0 12px}" +
      ".mcp-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 0 12px}" +
      ".mcp-head h2{margin:0;font-size:18px;letter-spacing:.06em;text-transform:uppercase}" +
      ".mcp-head p{margin:0;font-size:12px;color:#6b7280}" +
      ".mcp-row{display:grid;grid-auto-flow:column;grid-auto-columns:min(78%,280px);gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:6px}" +
      ".mcp-card{scroll-snap-align:start;border:1px solid #e7e5e4;background:#fff;display:flex;flex-direction:column;border-radius:0}" +
      ".mcp-photo{display:block;padding:0;border:0;background:#f5f5f4;cursor:zoom-in;aspect-ratio:4/5;width:100%}" +
      ".mcp-photo img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".mcp-body{padding:10px 12px 12px;display:flex;flex-direction:column;gap:6px;flex:1}" +
      ".mcp-meta{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700}" +
      ".mcp-stars{color:#111;letter-spacing:1px;font-size:12px}.mcp-off{color:#d6d3d1}" +
      ".mcp-ver{font-size:11px;font-weight:600;color:#18794e}" +
      ".mcp-text{margin:0;font-size:13px;line-height:1.55;color:#3f3f46;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}" +
      ".mcp-shop{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid #f0efee;padding-top:8px;font-size:12px;color:#57534e;text-decoration:none}" +
      ".mcp-shop b{color:#111;white-space:nowrap}" +
      ".mcp-shop span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}";
    document.head.appendChild(st);
  }
  function render(list) {
    if (!list.length || document.getElementById("maCustomerPhotos")) return;
    css();
    var sec = document.createElement("section");
    sec.id = "maCustomerPhotos";
    sec.className = "mcp-section";
    sec.setAttribute("aria-label", "ক্রেতাদের তোলা ছবি");
    sec.innerHTML = '<div class="mcp-head"><h2>ক্রেতাদের তোলা ছবি</h2><p>যাচাইকৃত ক্রেতাদের রিভিউ</p></div><div class="mcp-row">' +
      list.map(function (r) {
        var first = r.photos[0];
        return '<article class="mcp-card">' +
          '<button type="button" class="mcp-photo" data-ma-photo="' + esc(first) + '" aria-label="ছবি বড় করে দেখুন"><img src="' + esc(first) + '" alt="' + esc(r.productName) + ' — ক্রেতার ছবি" loading="lazy" width="280" height="350"></button>' +
          '<div class="mcp-body"><div class="mcp-meta"><span class="mcp-stars" aria-label="' + (Math.round(r.rating) || 0) + ' / 5">' + stars(r.rating) + '</span>' + esc(r.name) +
          (r.verifiedPurchase ? ' <span class="mcp-ver">✓ যাচাইকৃত</span>' : "") + '</div>' +
          (r.comment ? '<p class="mcp-text">' + esc(r.comment) + '</p>' : "") +
          '<a class="mcp-shop" href="' + esc(productHref(r.productId)) + '"><span>' + esc(r.productName) + '</span><b>ডিজাইনটি দেখুন →</b></a></div></article>';
      }).join("") + "</div>";
    var anchor = document.getElementById("premium-collection") || document.getElementById("site-footer-mount");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(sec, anchor); else document.body.appendChild(sec);
    sec.addEventListener("click", function (ev) {
      var t = ev.target.closest ? ev.target.closest("[data-ma-photo]") : null;
      if (!t) return;
      var src = t.getAttribute("data-ma-photo");
      if (window.MAReviewPhoto) window.MAReviewPhoto.open(src); else window.open(src, "_blank", "noopener");
    });
  }
  function load() {
    if (!window.fetch) return;
    fetch("/api/photo-reviews").then(function (r) { return r.json(); }).then(function (j) {
      var list = (j && j.ok && Array.isArray(j.reviews) ? j.reviews : []).filter(function (r) { return r && r.productId && r.photos && r.photos.length; });
      render(list);
    }).catch(function () {});
  }
  // Load when the visitor gets near the end of the page (or right away on short pages / old browsers).
  var targets = ["premium-collection", "site-footer-mount"].map(function (id) { return document.getElementById(id); }).filter(Boolean);
  if ("IntersectionObserver" in window && targets.length) {
    var io = new IntersectionObserver(function (ents) { if (ents.some(function (e) { return e.isIntersecting || e.boundingClientRect.top < 0; })) { io.disconnect(); load(); } }, { rootMargin: "1200px 0px" });
    targets.forEach(function (t) { io.observe(t); });
  } else if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", load); else load();
})();
