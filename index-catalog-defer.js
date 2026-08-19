(function () {
  function loadFontAwesome() {
    if (document.querySelector("link[data-ma-fa]")) return;
    var l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css";
    l.setAttribute("data-ma-fa", "1");
    document.head.appendChild(l);
  }

  function scheduleFa() {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(loadFontAwesome, { timeout: 3500 });
    } else {
      window.addEventListener("load", loadFontAwesome, { once: true });
    }
  }

  var chain = [
    "product-config.js?v=20260819audit",
    "product-utils.js?v=20260819audit",
    "product-catalog-sync.js?v=20260604",
    "category-products.js?v=20260819audit",
    "product-links-data.js?v=20260604",
    "product-catalog-loader.js?v=20260604",
  ];

  function afterCatalog() {
    if (typeof window.__homeRefreshCatalog === "function") {
      window.__homeRefreshCatalog({ deferHero: true });
    }
    // index.html listens for this to start index-home-anzaar.js /
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
      if (existing.getAttribute("data-loaded") === "1" || existing.hasAttribute("data-ma-loaded")) {
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
    loadAt(0);
  }

  function schedule() {
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(start, { timeout: 2000 });
    } else {
      window.setTimeout(start, 600);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", schedule, { once: true });
    document.addEventListener("DOMContentLoaded", scheduleFa, { once: true });
  } else {
    schedule();
    scheduleFa();
  }
})();
