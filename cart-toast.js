/**
 * Unified “Added to bag” toast — homepage + shop pages.
 * showCartAddedToast({ name, image?, price? })
 * showCartRemovedToast({ name? })
 */
(function (global) {
  var CSS_VER = "20260603cartqty";
  var HIDE_MS = 3200;
  var hideTimer = null;

  var CHECK_SVG =
    '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">' +
    '<path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>' +
    "</svg>";

  function ensureStyles() {
    if (typeof document === "undefined") return;
    if (document.querySelector('link[href*="cart-toast.css"]')) return;
    var link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "cart-toast.css?v=" + CSS_VER;
    document.head.appendChild(link);
  }

  function cartItemCount() {
    if (typeof global.loadStoreCart !== "function") return 0;
    var lines = global.loadStoreCart({ readOnly: true }) || [];
    var n = 0;
    for (var i = 0; i < lines.length; i++) {
      n += parseInt(lines[i].quantity, 10) || 0;
    }
    return n;
  }

  function formatPrice(price) {
    if (price == null || price === "") return "";
    if (typeof global.formatBdt === "function") return global.formatBdt(price);
    var n = Number(price);
    if (!isFinite(n)) return "";
    return "\u09F3" + n.toLocaleString("en-BD");
  }

  function checkoutHref() {
    return typeof global.siteHref === "function" ? global.siteHref("/checkout") : "checkout.html";
  }

  function hideToast() {
    var el = document.getElementById("cartAddedToast");
    if (!el) return;
    el.classList.remove("is-visible");
  }

  function ensureMount() {
    ensureStyles();
    var el = document.getElementById("cartAddedToast");
    if (el) return el;

    el = document.createElement("div");
    el.id = "cartAddedToast";
    el.className = "cart-added-toast";
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML =
      '<div class="cart-added-toast__check">' +
      CHECK_SVG +
      "</div>" +
      '<img class="cart-added-toast__thumb is-hidden" alt="" width="44" height="44" decoding="async">' +
      '<div class="cart-added-toast__body">' +
      '<p class="cart-added-toast__head">' +
      '<span class="cart-added-toast__label"></span>' +
      '<span class="cart-added-toast__sep"> — </span>' +
      '<span class="cart-added-toast__name"></span>' +
      "</p>" +
      '<p class="cart-added-toast__meta"></p>' +
      "</div>" +
      '<button type="button" class="cart-added-toast__view">View bag</button>';

    var viewBtn = el.querySelector(".cart-added-toast__view");
    if (viewBtn) {
      viewBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        hideToast();
        if (typeof global.openCartDrawer === "function") {
          global.openCartDrawer();
          return;
        }
        global.location.href = checkoutHref();
      });
    }

    document.body.appendChild(el);
    return el;
  }

  function showToast(opts) {
    opts = opts || {};
    var el = ensureMount();
    var label = String(opts.label || "Added to bag").trim();
    var name = String(opts.name || opts.productName || "Item").trim();
    var image = String(opts.image || "").trim();
    var priceText = formatPrice(opts.price);
    var count = cartItemCount();
    var variant = opts.variant || "added";

    el.classList.toggle("is-removed", variant === "removed");

    var labelEl = el.querySelector(".cart-added-toast__label");
    var nameEl = el.querySelector(".cart-added-toast__name");
    var sepEl = el.querySelector(".cart-added-toast__sep");
    var metaEl = el.querySelector(".cart-added-toast__meta");
    var thumbEl = el.querySelector(".cart-added-toast__thumb");
    var viewBtn = el.querySelector(".cart-added-toast__view");

    if (labelEl) labelEl.textContent = label;
    if (nameEl) nameEl.textContent = name;
    if (sepEl) sepEl.style.display = name ? "" : "none";
    if (nameEl) nameEl.style.display = name ? "" : "none";

    if (metaEl) {
      metaEl.textContent = priceText || "";
    }

    if (thumbEl) {
      if (image && variant !== "removed") {
        thumbEl.src = image;
        thumbEl.alt = name;
        thumbEl.classList.remove("is-hidden");
      } else {
        thumbEl.removeAttribute("src");
        thumbEl.alt = "";
        thumbEl.classList.add("is-hidden");
      }
    }

    if (viewBtn) {
      if (opts.hideViewBag || variant === "removed") {
        viewBtn.style.display = "none";
      } else {
        viewBtn.style.display = "";
        viewBtn.textContent = count > 0 ? "View bag (" + count + ")" : "View bag";
      }
    }

    el.classList.add("is-visible");
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(hideToast, opts.duration || HIDE_MS);
  }

  function showCartAddedToast(opts) {
    showToast({
      label: "Added to bag",
      name: opts && (opts.name || opts.productName),
      image: opts && opts.image,
      price: opts && opts.price,
      duration: opts && opts.duration
    });
  }

  function showCartRemovedToast(opts) {
    showToast({
      label: "Removed from bag",
      name: opts && (opts.name || opts.productName),
      variant: "removed",
      hideViewBag: true,
      duration: (opts && opts.duration) || 2400
    });
  }

  global.showCartAddedToast = showCartAddedToast;
  global.showCartRemovedToast = showCartRemovedToast;
})(typeof window !== "undefined" ? window : this);
