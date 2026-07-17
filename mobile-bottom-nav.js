/**
 * mobile-bottom-nav.js
 * Fixed bottom nav bar (Home / Category / Cart / Call / Login) — mobile only.
 *
 * Defaults used (change the CONFIG block below if any of these aren't right):
 * - Home    -> site root
 * - Category-> opens the existing mobile category menu (site-header.js's toggleAbayaMenu)
 * - Cart    -> opens the existing cart drawer, badge count syncs with the real cart
 * - Call    -> tel: link to the number already used in your footer
 * - Login   -> signin.html
 *
 * Add this ONE script tag to every page (right before </body>, after cart-utils.js
 * and site-header.js so window.loadStoreCart / toggleAbayaMenu / openCartDrawer exist):
 *   <script defer src="mobile-bottom-nav.js"></script>
 */
(function () {
  var CONFIG = {
    color: "#b8952e",
    homeHref: "/",
    callNumber: "+8801970831783",
    loginHref: "signin.html"
  };

  function siteHrefSafe(route) {
    return typeof window.siteHref === "function" ? window.siteHref(route) : route;
  }

  style.textContent =
  ".mbn-bar{display:none;}" +
  "@media (max-width:768px){" +
  "  .mbn-bar{" +
  "    display:flex;position:fixed;left:0;right:0;bottom:0;z-index:2147483000;" +
  "    background:#fff;border-top:1px solid #eee;" +
  "    box-shadow:0 -2px 10px rgba(0,0,0,.06);" +
  "    padding-bottom:env(safe-area-inset-bottom,0);" +
  "  }" +
  "  body{padding-bottom:64px;}" +
  "  .cart-drawer-foot{padding-bottom:calc(20px + 64px + env(safe-area-inset-bottom));}" +
  "}" +
  ".mbn-item{" +
  "  flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;" +
  "  gap:2px;padding:8px 4px 10px;background:none;border:none;cursor:pointer;" +
  "  color:" + CONFIG.color + ";text-decoration:none;font-family:inherit;" +
  "}" +
  ".mbn-item svg{width:24px;height:24px;display:block;}" +
  ".mbn-label{font-size:11.5px;font-weight:600;color:#111;}" +
  ".mbn-cart-wrap{position:relative;}" +
  ".mbn-badge{" +
  "  position:absolute;top:-6px;right:-10px;min-width:17px;height:17px;padding:0 4px;" +
  "  border-radius:999px;background:" + CONFIG.color + ";color:#fff;font-size:10.5px;" +
  "  font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;" +
  "}";

  var ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>',
    category: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 12.2A2 2 0 0 0 9.35 18H18a2 2 0 0 0 1.96-1.6L21.5 8H6"/><circle cx="9.5" cy="21" r="1.3"/><circle cx="18" cy="21" r="1.3"/></svg>',
    call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4.5c0 8.5 6.9 15.3 15.4 15.4l.6-3.6-4.3-1.4-1.6 1.9a11.4 11.4 0 0 1-6.9-6.9l1.9-1.6L7.6 4 4 4.5Z"/><path d="M14.5 4.5a5.5 5.5 0 0 1 5 5"/><path d="M14.5 8a2 2 0 0 1 1.9 1.9"/></svg>',
    login: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6.3 7-6.3s7 2.7 7 6.3"/></svg>'
  };

  function ensureBar() {
    if (document.getElementById("mobile-bottom-nav")) return;
    ensureStyles();

    var bar = document.createElement("nav");
    bar.id = "mobile-bottom-nav";
    bar.className = "mbn-bar";
    bar.setAttribute("aria-label", "Quick navigation");
    bar.innerHTML =
      '<a class="mbn-item" href="' + siteHrefSafe(CONFIG.homeHref) + '">' + ICONS.home + '<span class="mbn-label">Home</span></a>' +
      '<button type="button" class="mbn-item" id="mbn-category">' + ICONS.category + '<span class="mbn-label">Category</span></button>' +
      '<button type="button" class="mbn-item" id="mbn-cart"><span class="mbn-cart-wrap">' + ICONS.cart + '<span class="mbn-badge" id="mbn-cart-count">0</span></span><span class="mbn-label">Cart</span></button>' +
      '<a class="mbn-item" href="tel:' + CONFIG.callNumber + '">' + ICONS.call + '<span class="mbn-label">Call</span></a>' +
      '<a class="mbn-item" href="' + siteHrefSafe(CONFIG.loginHref) + '">' + ICONS.login + '<span class="mbn-label">Login</span></a>';
    document.body.appendChild(bar);

    document.getElementById("mbn-category").addEventListener("click", function () {
      if (typeof window.toggleAbayaMenu === "function") {
        window.toggleAbayaMenu();
      } else {
        window.location.href = siteHrefSafe(CONFIG.homeHref);
      }
    });

    document.getElementById("mbn-cart").addEventListener("click", function () {
      if (typeof window.openCartDrawer === "function") {
        window.openCartDrawer();
      } else {
        window.location.href = siteHrefSafe("/checkout");
      }
    });
  }

  function refreshBadge() {
    var el = document.getElementById("mbn-cart-count");
    if (!el) return;
    var lines = typeof window.loadStoreCart === "function" ? window.loadStoreCart({ readOnly: true }) : [];
    var total = 0;
    (lines || []).forEach(function (item) {
      total += parseInt(item.quantity, 10) || 0;
    });
    el.textContent = String(total);
  }

  function init() {
    ensureBar();
    refreshBadge();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  window.addEventListener("storeCartUpdated", refreshBadge);
})();
