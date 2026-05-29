(function (global) {
  if (global.__cartDrawerInit) return;
  global.__cartDrawerInit = true;

  var drawerLines = [];
  var SUPPRESS_KEY = "__suppressCartDrawerUntil";

  function formatBdt(amount) {
    var n = parseInt(amount, 10) || 0;
    return "\u09F3" + n.toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function subtotal(arr) {
    var t = 0;
    (arr || []).forEach(function (item) {
      t += (parseInt(item.price, 10) || 0) * (parseInt(item.quantity, 10) || 1);
    });
    return t;
  }

  function loadLines() {
    var lines = [];
    if (typeof global.loadStoreCart === "function") {
      lines = global.loadStoreCart({ readOnly: true }).slice();
    }
    if (typeof global.normalizeStoreCart === "function") {
      lines = global.normalizeStoreCart(lines);
    }
    return lines.filter(function (item) {
      return item && item.name && (parseInt(item.quantity, 10) || 0) > 0;
    });
  }

  function emitStoreCartUpdated(lines) {
    try {
      global.dispatchEvent(
        new CustomEvent("storeCartUpdated", { detail: { lines: lines } })
      );
    } catch (e) {
      try {
        var ev = document.createEvent("CustomEvent");
        ev.initCustomEvent("storeCartUpdated", true, true, { lines: lines });
        global.dispatchEvent(ev);
      } catch (e2) {}
    }
  }

  function saveLines(lines) {
    var normalized = lines;
    if (typeof global.persistStoreCart === "function") {
      normalized = global.persistStoreCart(lines);
    }
    if ((normalized || []).length > 0) {
      if (typeof global.afterCartMutation === "function") {
        global.afterCartMutation(normalized);
      } else if (typeof global.refreshCartBadgeUI === "function") {
        global.refreshCartBadgeUI(normalized);
      }
    } else {
      try {
        sessionStorage.removeItem("muslim_abaya_home_cart_active");
      } catch (err) {}
      if (typeof global.clearStoreCart === "function") global.clearStoreCart();
      if (typeof global.refreshCartBadgeUI === "function") global.refreshCartBadgeUI([]);
      else if (typeof global.updateCartBadge === "function") global.updateCartBadge([]);
    }
    emitStoreCartUpdated(normalized);
    return normalized;
  }

  function ensureDom() {
    if (document.getElementById("cartDrawer")) return;

    var overlay = document.createElement("div");
    overlay.id = "cartDrawerOverlay";
    overlay.className = "cart-drawer-overlay";
    overlay.setAttribute("aria-hidden", "true");

    var panel = document.createElement("aside");
    panel.id = "cartDrawer";
    panel.className = "cart-drawer";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Shopping cart");
    panel.innerHTML =
      '<div class="cart-drawer-head">' +
      '<h2>SHOPPING CART</h2>' +
      '<button type="button" class="cart-drawer-close" id="cartDrawerCloseBtn">Close \u2192</button>' +
      "</div>" +
      '<div class="cart-drawer-body" id="cartDrawerBody"></div>' +
      '<div class="cart-drawer-foot">' +
      '<div class="cart-drawer-total-row"><span>Total</span><strong id="cartDrawerTotal">' +
      formatBdt(0) +
      "</strong></div>" +
      '<a href="checkout.html" class="cart-drawer-checkout" id="cartDrawerCheckout">CHECKOUT</a>' +
      "</div>";

    document.body.appendChild(overlay);
    document.body.appendChild(panel);

    overlay.addEventListener("click", closeCartDrawer);
    document.getElementById("cartDrawerCloseBtn").addEventListener("click", closeCartDrawer);

    document.getElementById("cartDrawerBody").addEventListener("click", onBodyClick);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeCartDrawer();
    });
  }

  function renderDrawer() {
    ensureDom();
    var body = document.getElementById("cartDrawerBody");
    var totalEl = document.getElementById("cartDrawerTotal");
    if (!body) return;

    drawerLines = loadLines();

    if (!drawerLines.length) {
      if (typeof global.clearStoreCart === "function") global.clearStoreCart();
      try {
        sessionStorage.removeItem("muslim_abaya_home_cart_active");
      } catch (err) {}
      if (typeof global.refreshCartBadgeUI === "function") global.refreshCartBadgeUI([]);
      else if (typeof global.updateCartBadge === "function") global.updateCartBadge([]);
      body.innerHTML =
        '<p class="cart-drawer-empty">\u0995\u09BE\u09B0\u09CD\u099F\u09C7 \u0995\u09CB\u09A8\u09CB \u09AA\u09A3\u09CD\u09AF \u09A8\u09C7\u0987\u0964<br><a href="/" style="color:#f97316;font-weight:600;">\u09B6\u09AA\u09BF\u0982 \u0995\u09B0\u09C1\u09A8</a></p>';
      if (totalEl) totalEl.textContent = formatBdt(0);
      return;
    }

    var html = "";
    drawerLines.forEach(function (item, idx) {
      var qty = parseInt(item.quantity, 10) || 1;
      var unit = parseInt(item.price, 10) || 0;
      var lineTotal = unit * qty;
      var imgUrl =
        typeof global.resolveStoreItemImage === "function"
          ? global.resolveStoreItemImage(item)
          : item.image || "";
      var thumb = imgUrl
        ? '<img src="' +
          imgUrl +
          '" alt="" loading="lazy" onerror="this.parentElement.innerHTML=\'<span class=cart-drawer-thumb-placeholder>\uD83D\uDC5C</span>\'">'
        : '<span class="cart-drawer-thumb-placeholder">\uD83D\uDC5C</span>';

      html +=
        '<div class="cart-drawer-item" data-drawer-idx="' +
        idx +
        '">' +
        '<div class="cart-drawer-thumb">' +
        thumb +
        "</div>" +
        '<div class="cart-drawer-item-main">' +
        '<div class="cart-drawer-item-top">' +
        '<p class="cart-drawer-name">' +
        (item.name || "") +
        "</p>" +
        '<button type="button" class="cart-drawer-remove" data-drawer-action="remove" data-drawer-idx="' +
        idx +
        '" aria-label="\u09B8\u09B0\u09BE\u09A8">\u00D7</button>' +
        "</div>" +
        '<div class="cart-drawer-controls">' +
        '<div class="cart-drawer-qty">' +
        '<button type="button" data-drawer-action="dec" data-drawer-idx="' +
        idx +
        '" aria-label="\u0995\u09AE\u09BE\u09A8">\u2212</button>' +
        "<span>" +
        qty +
        "</span>" +
        '<button type="button" data-drawer-action="inc" data-drawer-idx="' +
        idx +
        '" aria-label="\u09AC\u09BE\u09A1\u09BC\u09BE\u09A8">+</button>' +
        "</div>" +
        '<span class="cart-drawer-line-price">' +
        qty +
        " x " +
        formatBdt(unit) +
        " = " +
        formatBdt(lineTotal) +
        "</span>" +
        "</div>" +
        "</div>" +
        "</div>";
    });

    body.innerHTML = html;
    body.scrollTop = 0;
    if (totalEl) totalEl.textContent = formatBdt(subtotal(drawerLines));
  }

  function onBodyClick(e) {
    var btn = e.target.closest("[data-drawer-action]");
    if (!btn) return;
    var idx = parseInt(btn.getAttribute("data-drawer-idx"), 10);
    if (isNaN(idx) || !drawerLines[idx]) return;
    var action = btn.getAttribute("data-drawer-action");

    if (action === "inc") {
      drawerLines[idx].quantity = (parseInt(drawerLines[idx].quantity, 10) || 1) + 1;
    }
    if (action === "dec") {
      var cur = parseInt(drawerLines[idx].quantity, 10) || 1;
      if (cur <= 1) drawerLines.splice(idx, 1);
      else drawerLines[idx].quantity = cur - 1;
    }
    if (action === "remove") {
      drawerLines.splice(idx, 1);
    }

    saveLines(drawerLines);

    renderDrawer();
  }

  function closeMobileNavIfOpen() {
    var menu = document.getElementById("mobileMenuPanel");
    var overlay = document.getElementById("menuOverlay");
    if (menu && menu.classList.contains("active")) {
      menu.classList.remove("active");
      if (overlay) overlay.classList.remove("active");
    }
  }

  function openCartDrawer() {
    var suppressUntil = parseInt(global[SUPPRESS_KEY], 10) || 0;
    if (Date.now() < suppressUntil) return;
    ensureDom();
    closeMobileNavIfOpen();
    renderDrawer();
    var overlay = document.getElementById("cartDrawerOverlay");
    var panel = document.getElementById("cartDrawer");
    if (overlay) {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
    }
    if (panel) panel.classList.add("is-open");
    document.body.classList.add("cart-drawer-open");
    var body = document.getElementById("cartDrawerBody");
    if (body) body.scrollTop = 0;
  }

  function closeCartDrawer() {
    var overlay = document.getElementById("cartDrawerOverlay");
    var panel = document.getElementById("cartDrawer");
    if (overlay) {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
    }
    if (panel) panel.classList.remove("is-open");
    document.body.classList.remove("cart-drawer-open");
  }

  function bindTriggers() {
    var triggers = document.querySelectorAll("button.cart-drawer-trigger[data-cart-trigger='1']");
    triggers.forEach(function (trigger) {
      if (trigger.getAttribute("data-cart-bound") === "1") return;
      trigger.setAttribute("data-cart-bound", "1");
      trigger.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        openCartDrawer();
      });
    });
  }

  function bindNavSuppression() {
    document.addEventListener(
      "click",
      function (e) {
        var navLink = e.target.closest(
          ".desktop-menu a, .top-bar-content a, .mobile-nav-panel a, .brand-text-logo a"
        );
        if (!navLink) return;
        global[SUPPRESS_KEY] = Date.now() + 1200;
        closeCartDrawer();
      },
      true
    );
  }

  function ensureDrawerClosedOnLoad() {
    closeCartDrawer();
  }

  function loadAssets(cb) {
    if (!document.querySelector('link[href*="cart-drawer.css"]')) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "cart-drawer.css";
      document.head.appendChild(link);
    }
    if (typeof cb === "function") cb();
  }

  global.openCartDrawer = openCartDrawer;
  global.closeCartDrawer = closeCartDrawer;
  global.renderCartDrawer = renderDrawer;

  function init() {
    loadAssets(function () {
      ensureDrawerClosedOnLoad();
      bindTriggers();
      bindNavSuppression();
    });
  }

  window.addEventListener("pagehide", function () {
    ensureDrawerClosedOnLoad();
  });
  window.addEventListener("beforeunload", function () {
    ensureDrawerClosedOnLoad();
  });
  window.addEventListener("pageshow", function () {
    closeMobileNavIfOpen();
    ensureDrawerClosedOnLoad();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : this);
