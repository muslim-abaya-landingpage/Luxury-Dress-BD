/**
 * Muslim Abaya — non-blocking live stock sync
 *
 * Public stock data is loaded asynchronously so a slow Apps Script response
 * cannot block the first paint or stop other page scripts from running.
 * A very short local snapshot may be applied before catalog normalization;
 * the live response then refreshes the visible stock UI.
 */
(function () {
  "use strict";

  if (window.MA_STOCK_SYNC && window.MA_STOCK_SYNC.ready) return;

  var CACHE_KEY = "ma_public_stock_status_v1";
  var CACHE_TTL_MS = 15000;
  var REQUEST_TIMEOUT_MS = 12000;
  var inFlight = null;

  function getApiUrl() {
    return (window.MA_SITE_API && window.MA_SITE_API.url) ||
      (typeof window.getSiteApiUrl === "function" ? window.getSiteApiUrl() : "");
  }

  function getCategories() {
    return window.CATEGORY_PRODUCTS && typeof window.CATEGORY_PRODUCTS === "object"
      ? window.CATEGORY_PRODUCTS
      : null;
  }

  function readCache() {
    try {
      var cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
      if (!cached || !cached.items || typeof cached.items !== "object") return null;
      if (!cached.savedAt || Date.now() - cached.savedAt > CACHE_TTL_MS) return null;
      return cached;
    } catch (err) {
      return null;
    }
  }

  function writeCache(items) {
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), items: items }));
    } catch (err) {
      // Storage may be disabled or full; live sync continues without it.
    }
  }

  function applyStockMap(items) {
    var categories = getCategories();
    if (!categories || !items || typeof items !== "object") return [];

    var changedIds = [];
    Object.keys(categories).forEach(function (categoryKey) {
      var products = categories[categoryKey];
      if (!Array.isArray(products)) return;

      products.forEach(function (product) {
        if (!product || !product.id) return;
        var entry = items[product.id];
        if (!entry || typeof entry !== "object") return;

        // Capture the catalog switch once, separately from live zero-quantity results.
        if (typeof product._catalogStockDisabled !== "boolean") {
          product._catalogStockDisabled = product.inStock === false || (typeof product.stock === "number" && product.stock <= 0);
        }
        var oldStock = product.stock;
        var oldInStock = product.inStock;
        var oldVariants = product.stockVariants;
        product.stockVariants = entry.variants && typeof entry.variants === "object"
          ? entry.variants
          : null;

        var variants = product.stockVariants || {};
        var hasTrackedVariants = Object.keys(variants).some(function (variantKey) {
          return variants[variantKey] && variants[variantKey].tracked === true;
        });

        if (hasTrackedVariants) {
          // Product Manager-এর explicit Out-of-Stock override-কে অগ্রাধিকার দিই।
          if (!product._catalogStockDisabled) {
            product.stock = entry.qty;
            product.inStock = entry.inStock;
          }
        } else if (entry.legacyTracked === true && !product._catalogStockDisabled) {
          product.stock = entry.qty;
          product.inStock = entry.inStock;
        }

        var variantsChanged = false;
        try {
          variantsChanged = JSON.stringify(oldVariants || null) !== JSON.stringify(product.stockVariants || null);
        } catch (compareErr) {
          variantsChanged = oldVariants !== product.stockVariants;
        }
        if (oldStock !== product.stock || oldInStock !== product.inStock || variantsChanged) {
          changedIds.push(String(product.id));
        }
      });
    });
    return changedIds;
  }

  function notifyStockUpdated(changedIds) {
    if (!changedIds || !changedIds.length) return;
    try {
      window.dispatchEvent(new window.CustomEvent("ma:stock-updated", {
        detail: { productIds: changedIds }
      }));
    } catch (err) {
      // Stock data remains applied even if a page has no event support.
    }

    // The homepage renderer exposes this lightweight refresh hook.
    try {
      if (typeof window.__homeRefreshCatalog === "function") {
        window.__homeRefreshCatalog({ initial: false });
      }
    } catch (err) {}
  }

  function requestStock(force) {
    if (inFlight) return inFlight;
    var apiUrl = getApiUrl();
    if (!apiUrl || !getCategories() || typeof XMLHttpRequest === "undefined") {
      return Promise.resolve({ ok: false, skipped: true });
    }

    inFlight = new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      var separator = apiUrl.indexOf("?") === -1 ? "?" : "&";
      var url = apiUrl + separator + "RecordType=StockStatus&_ma=" + Date.now();
      var done = false;

      function finish(result) {
        if (done) return;
        done = true;
        inFlight = null;
        resolve(result);
      }

      xhr.onload = function () {
        if (xhr.status !== 200) {
          finish({ ok: false, status: xhr.status });
          return;
        }
        try {
          var response = JSON.parse(xhr.responseText || "{}");
          if (!response || response.ok !== true || !response.items || typeof response.items !== "object") {
            finish({ ok: false, error: "INVALID_STOCK_RESPONSE" });
            return;
          }
          writeCache(response.items);
          var changedIds = applyStockMap(response.items);
          notifyStockUpdated(changedIds);
          finish({ ok: true, count: Object.keys(response.items).length });
        } catch (err) {
          finish({ ok: false, error: "INVALID_STOCK_JSON" });
        }
      };
      xhr.onerror = function () { finish({ ok: false, error: "STOCK_REQUEST_FAILED" }); };
      xhr.ontimeout = function () { finish({ ok: false, error: "STOCK_REQUEST_TIMEOUT" }); };
      xhr.onabort = function () { finish({ ok: false, error: "STOCK_REQUEST_ABORTED" }); };

      try {
        xhr.open("GET", url, true);
        xhr.timeout = REQUEST_TIMEOUT_MS;
      xhr.send(null);
    } catch (err) {
      finish({ ok: false, error: "STOCK_REQUEST_FAILED" });
    }
  });
  return inFlight;
}

function startStockPolling() {
  var pollIntervalMs = 60000;
  var busy = false;

  function refreshIfVisible() {
    var doc = window.document;
    if (doc && doc.visibilityState === "hidden") return;
    if (busy || !window.MA_STOCK_SYNC) return;

    busy = true;
    Promise.resolve()
      .then(function () { return window.MA_STOCK_SYNC.refresh(); })
      .catch(function () {
        // A temporary API failure must not interrupt storefront actions.
      })
      .then(function () { busy = false; });
  }

  if (typeof window.setInterval === "function") {
    window.setInterval(refreshIfVisible, pollIntervalMs);
  }

  var doc = window.document;
  if (doc && typeof doc.addEventListener === "function") {
    doc.addEventListener("visibilitychange", function () {
      if (doc.visibilityState === "visible") refreshIfVisible();
    });
  }
  if (typeof window.addEventListener === "function") {
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);
  }
}

// A fresh local snapshot updates product objects before the catalog normalizes.
var cached = readCache();
if (cached) applyStockMap(cached.items);

window.MA_STOCK_SYNC = {
  ready: requestStock(false).then(function (result) {
    try { startStockPolling(); } catch (err) {}
    return result;
  }),
  refresh: function () { return requestStock(true); }
};
})();
