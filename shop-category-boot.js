(function () {
  function boot(force) {
    if (typeof window.scheduleShopCategoryBoot === "function") {
      window.scheduleShopCategoryBoot(!!force);
      return;
    }
    var body = document.body;
    if (!body || !window.CATEGORY_PRODUCTS) return;
    var hub = body.getAttribute("data-shop-hub");
    var key = body.getAttribute("data-shop-category");
    if (hub === "1" && typeof window.bootAllCategories === "function") {
      window.bootAllCategories();
    } else if (key && typeof window.bootShopCategory === "function") {
      window.bootShopCategory(key);
    }
  }

  function onReady() {
    boot(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

  window.addEventListener("load", function () {
    if (typeof window.isShopCategoryRendered === "function" && window.isShopCategoryRendered()) {
      return;
    }
    boot(true);
  });
})();
