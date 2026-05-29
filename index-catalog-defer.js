(function () {
  var chain = [
    "product-config.js?v=20260604",
    "product-utils.js?v=20260604",
    "product-catalog-sections.js?v=20260530d",
    "category-products.js?v=20260604",
    "product-links-data.js?v=20260604",
    "product-catalog-loader.js?v=20260604",
  ];

  function afterCatalog() {
    if (typeof window.__homeRefreshCatalog === "function") {
      window.__homeRefreshCatalog();
    }
  }

  function loadAt(i) {
    if (i >= chain.length) {
      afterCatalog();
      return;
    }
    var s = document.createElement("script");
    s.src = chain[i];
    s.defer = true;
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
      window.requestIdleCallback(start, { timeout: 2800 });
    } else {
      window.setTimeout(start, 1500);
    }
  }

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
})();
