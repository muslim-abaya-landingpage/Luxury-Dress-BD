(() => {
  const CONFIG = {
    homeHref: "/",
    callNumber: "+8801971642683",
    loginHref: "signin.html"
  };

  const siteHrefSafe = (route) =>
    typeof window.siteHref === "function" ? window.siteHref(route) : route;

  const ICONS = {
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>',
    category: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.2"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 12.2A2 2 0 0 0 9.35 18H18a2 2 0 0 0 1.96-1.6L21.5 8H6"/><circle cx="9.5" cy="21" r="1.3"/><circle cx="18" cy="21" r="1.3"/></svg>',
    call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5c0 8.5 6.9 15.3 15.4 15.4l.6-3.6-4.3-1.4-1.6 1.9a11.4 11.4 0 0 1-6.9-6.9l1.9-1.6L7.6 4 4 4.5Z"/><path d="M14.5 4.5a5.5 5.5 0 0 1 5 5"/><path d="M14.5 8a2 2 0 0 1 1.9 1.9"/></svg>',
    login: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c0-3.6 3.1-6.3 7-6.3s7 2.7 7 6.3"/></svg>'
  };

  const ensureBar = () => {
    if (document.getElementById("mobile-bottom-nav")) return;

    const bar = document.createElement("nav");
    bar.id = "mobile-bottom-nav";
    bar.className = "mbn-bar";
    bar.setAttribute("aria-label", "Quick navigation");
    bar.innerHTML = `
      <a class="mbn-item" data-mbn-route="home" href="${siteHrefSafe(CONFIG.homeHref)}">
        ${ICONS.home}
        <span class="mbn-label">Home</span>
      </a>

      <button type="button" class="mbn-item" id="mbn-category" aria-label="Category" aria-controls="mobileMenuPanel" aria-expanded="false">
        ${ICONS.category}
        <span class="mbn-label">Category</span>
      </button>

      <button type="button" class="mbn-item" id="mbn-cart" aria-label="Cart" aria-controls="cart-drawer" aria-expanded="false">
        <span class="mbn-cart-wrap">
          ${ICONS.cart}
          <span class="mbn-badge" id="mbn-cart-count" aria-hidden="true">0</span>
        </span>
        <span class="mbn-label">Cart</span>
      </button>

      <a class="mbn-item" href="tel:${CONFIG.callNumber}">
        ${ICONS.call}
        <span class="mbn-label">Call</span>
      </a>

      <a class="mbn-item" data-mbn-route="login" href="${siteHrefSafe(CONFIG.loginHref)}">
        ${ICONS.login}
        <span class="mbn-label">Login</span>
      </a>
    `;

    document.body.appendChild(bar);

    document.getElementById("mbn-category").addEventListener("click", () => {
      if (typeof window.toggleAbayaMenu === "function") {
        window.toggleAbayaMenu();
      } else {
        window.location.href = siteHrefSafe(CONFIG.homeHref);
      }
      syncCategoryState();
    });

    document.getElementById("mbn-cart").addEventListener("click", () => {
      if (typeof window.openCartDrawer === "function") {
        window.openCartDrawer();
      } else {
        window.location.href = siteHrefSafe("/checkout");
      }
      syncCartState();
    });
  };

  const normalizedPath = () => {
    let path = window.location.pathname || "/";
    try {
      path = decodeURIComponent(path);
    } catch (e) {}
    path = path.replace(/\/+$/, "") || "/";
    return path.toLowerCase();
  };

  const isHomePage = (path) => path === "/" || path === "/index.html";
  const isCategoryPage = (path) => {
    const html = document.documentElement;
    const body = document.body;
    return Boolean(
      (html && html.dataset.shopCategory) ||
      (body && body.dataset.shopCategory) ||
      (html && html.dataset.seoPage === "/category") ||
      path === "/category" ||
      path === "/category.html"
    );
  };
  const isCartPage = (path) => /^\/(?:checkout|cart)(?:\.html)?$/.test(path);
  const isLoginPage = (path) => /^\/(?:signin|signup|login|account)(?:\.html)?(?:\/.*)?$/.test(path);

  const setActive = (element, active) => {
    if (!element) return;
    element.classList.toggle("is-active", active);
    if (element.tagName === "A") {
      if (active) element.setAttribute("aria-current", "page");
      else element.removeAttribute("aria-current");
    }
  };

  const syncRouteState = () => {
    const path = normalizedPath();
    const bar = document.getElementById("mobile-bottom-nav");
    if (!bar) return;
    setActive(bar.querySelector('[data-mbn-route="home"]'), isHomePage(path));
    setActive(bar.querySelector('[data-mbn-route="login"]'), isLoginPage(path));
    syncCategoryState();
    syncCartState();
  };

  const syncCategoryState = () => {
    const bar = document.getElementById("mobile-bottom-nav");
    if (!bar) return;
    const button = bar.querySelector("#mbn-category");
    if (!button) return;
    const menu = document.getElementById("mobileMenuPanel");
    const menuOpen = Boolean(menu && menu.classList.contains("active"));
    const routeActive = isCategoryPage(normalizedPath());
    setActive(button, routeActive || menuOpen);
    const expanded = String(menuOpen);
    if (button.getAttribute("aria-expanded") !== expanded) button.setAttribute("aria-expanded", expanded);
  };

  const syncCartState = () => {
    const bar = document.getElementById("mobile-bottom-nav");
    if (!bar) return;
    const button = bar.querySelector("#mbn-cart");
    if (!button) return;
    const drawer = document.getElementById("cart-drawer");
    const drawerOpen = Boolean(
      (drawer && drawer.classList.contains("is-open")) ||
      document.body.classList.contains("cart-drawer-open")
    );
    const routeActive = isCartPage(normalizedPath());
    setActive(button, drawerOpen || routeActive);
    const expanded = String(drawerOpen);
    if (button.getAttribute("aria-expanded") !== expanded) button.setAttribute("aria-expanded", expanded);
  };

  const setBadge = (total) => {
    const el = document.getElementById("mbn-cart-count");
    const button = document.getElementById("mbn-cart");
    if (!el) return;

    total = Number.parseInt(total, 10) || 0;
    el.textContent = total > 99 ? "99+" : String(total);
    el.style.display = total > 0 ? "flex" : "none";
    if (button) {
      const itemText = total === 1 ? "1 item" : `${total} items`;
      button.setAttribute("aria-label", total > 0 ? `Cart, ${itemText}` : "Cart, empty");
    }
  };

  const refreshBadge = () => {
    const lines = typeof window.loadStoreCart === "function"
      ? window.loadStoreCart({ readOnly: true })
      : [];
    const total = (lines || []).reduce(
      (sum, item) => sum + (Number.parseInt(item.quantity, 10) || 0),
      0
    );
    setBadge(total);
  };

  const observeOverlayStates = () => {
    if (!window.MutationObserver) return;
    const observer = new MutationObserver(() => {
      syncCategoryState();
      syncCartState();
    });
    const menu = document.getElementById("mobileMenuPanel");
    const drawer = document.getElementById("cart-drawer");
    if (menu) observer.observe(menu, { attributes: true, attributeFilter: ["class"] });
    if (drawer) observer.observe(drawer, { attributes: true, attributeFilter: ["class"] });
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
  };

  const init = () => {
    ensureBar();
    syncRouteState();
    refreshBadge();
    observeOverlayStates();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  window.addEventListener("storeCartUpdated", refreshBadge);

  // Preserve cart-drawer.js's existing badge/drawer refresh behaviour.
  const previousUpdateCartBadge = window.updateCartBadge;
  window.updateCartBadge = (cartLines) => {
    if (typeof previousUpdateCartBadge === "function") {
      previousUpdateCartBadge(cartLines);
    }
    const total = (cartLines || []).reduce(
      (sum, item) => sum + (parseInt(item.quantity, 10) || 0),
      0
    );
    setBadge(total);
  };
})();
