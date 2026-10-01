window.maCatalog = window.maCatalog || {};
if (!window.maCatalog.normalizeAll) {
  window.maCatalog.normalizeAll = function (products, links) {
    return products || window.CATEGORY_PRODUCTS;
  };
}
window.PRODUCT_IMAGE_LISTS = window.PRODUCT_IMAGE_LISTS || window.PRODUCT_LINKS_DATA || {};
