(function () {
  function applyProductLinks() {
    if (!window.maCatalog || !window.CATEGORY_PRODUCTS) return;
    var lists = window.PRODUCT_LINKS_DATA || window.PRODUCT_IMAGE_LISTS || {};
    // Product Manager sets MA_CATALOG_INCLUDE_UNPUBLISHED so it can edit Draft/Trash products;
    // everywhere else only published products exist.
    window.CATEGORY_PRODUCTS = window.maCatalog.normalizeAll(
      window.CATEGORY_PRODUCTS,
      lists,
      { includeUnpublished: !!window.MA_CATALOG_INCLUDE_UNPUBLISHED }
    );
  }

  window.applyProductLinks = applyProductLinks;
  applyProductLinks();
  if (typeof window.syncCatalogFromSections === "function") {
    window.syncCatalogFromSections();
  }
})();
