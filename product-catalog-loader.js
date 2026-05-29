(function () {
  function applyProductLinks() {
    if (!window.maCatalog || !window.CATEGORY_PRODUCTS) return;
    var lists = window.PRODUCT_LINKS_DATA || window.PRODUCT_IMAGE_LISTS || {};
    window.CATEGORY_PRODUCTS = window.maCatalog.normalizeAll(
      window.CATEGORY_PRODUCTS,
      lists
    );
  }

  window.applyProductLinks = applyProductLinks;
  applyProductLinks();
  if (typeof window.syncCatalogFromSections === "function") {
    window.syncCatalogFromSections();
  }
})();
