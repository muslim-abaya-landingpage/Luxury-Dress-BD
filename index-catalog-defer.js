(function () {
  // Font Awesome is no longer loaded on the homepage: its four icons are inline SVG in index.html.

  var chain = [
    "product-config.js?v=9f0fe21a5d0fbb0f",
    "product-utils.js?v=72b921b6721f1fcf",
    "product-catalog-sync.js?v=ab0c6a1d0c536477",
    "category-products.js?v=e12061816c7e9d6f",
    "product-links-data.js?v=202cec5a853e9f49",
    "product-catalog-loader.js?v=52b440e993917f01",
  ];

  function afterCatalog() {
    if (typeof window.__homeRefreshCatalog === "function") {
      window.__homeRefreshCatalog({ initial: true });
    }
    // index.html listens for this to start index-home-muslim-abaya.js /
    // related-cart.js as soon as the catalog is actually ready, instead of
    // always waiting out its 3000ms fallback timer. This was previously
    // never dispatched, so every homepage load paid the full fallback delay
    // regardless of how quickly the catalog chain above actually finished.
    window.dispatchEvent(new CustomEvent("ma:catalog-ready"));
  }

  function loadAt(i) {
    if (i >= chain.length) {
      afterCatalog();
      return;
    }
    var base = chain[i].split("?")[0];
    // site-header.js loads several of these same files itself (for the nav menu).
    // If it already added this script (or is in the middle of loading it), don't
    // fetch and execute it a second time — just move on to the next one.
    var existing = document.querySelector('script[src*="' + base + '"]');
    if (existing) {
      // Static <script defer> tags in index.html run (in order) before this file,
      // so they are already executed here; only wait for scripts injected by other loaders.
      var isStatic = !existing.hasAttribute("data-ma-loaded") && existing.getAttribute("data-loaded") !== "1" && !existing.async;
      if (isStatic || existing.getAttribute("data-loaded") === "1" || existing.hasAttribute("data-ma-loaded")) {
        loadAt(i + 1);
      } else {
        existing.addEventListener("load", function () { loadAt(i + 1); }, { once: true });
        existing.addEventListener("error", function () { loadAt(i + 1); }, { once: true });
      }
      return;
    }
    var s = document.createElement("script");
    s.src = chain[i];
    s.defer = true;
    s.setAttribute("data-ma-loaded", "");
    s.onload = function () {
      loadAt(i + 1);
    };
    s.onerror = function () {
      loadAt(i + 1);
    };
    document.body.appendChild(s);
  }

  function start() {
    if (window.maCatalog && window.CATEGORY_PRODUCTS && window.CATALOG_SECTIONS) {
      afterCatalog();
      return;
    }
    loadAt(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
