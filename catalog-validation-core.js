/* Builds the product list in catalog-validation.json (the server-side price/size check for orders).
   Shared by scripts/build-catalog-validation.mjs (website build) and product-publisher.js (instant
   live update), so both produce exactly the same data. Runs with only `window` set up by
   product-config.js, product-utils.js, category-products.js, product-links-data.js and
   product-catalog-sync.js (in that order); it must not touch the DOM, the network or storage. */
window.__maBuildValidationProducts = function (w) {
  var catalog = w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS, w.PRODUCT_LINKS_DATA || {});
  var products = [];
  Object.keys(catalog).forEach(function (category) {
    catalog[category].forEach(function (p) {
      var ab = w.isAbayaProduct(p, category), tp = w.isTwoPieceProduct(p, category);
      var cfg = ab ? w.getAbayaSizeConfig(p) : tp ? w.getTwoPieceSizeConfig(p) : null;
      var sc = w.SITE_LINKS && w.SITE_LINKS.sizeChart;
      var custom = (sc && sc.byCategory && sc.byCategory[category] && sc.byCategory[category].customSize) ||
        (sc && sc.default && sc.default.customSize) || [];
      // Scheduled sale (saleFrom / saleTo): send the sale prices plus the regular prices and the dates, so the
      // order server picks the right one at order time (not at build time). See Operations.gs opsSaleOff_.
      var sale = p._saleRaw || null;
      products.push({
        id: p.id, name: p.name, category: category, price: sale ? sale.price : p.price,
        prices: (sale ? sale.priceByType : p.priceByType) || null, sizes: p.sizes || [],
        bodySizes: (cfg && cfg.bodySizes) || [], bodyLabel: (cfg && cfg.bodySizeLabel) || '',
        lengths: ab ? (p.lengthSizes || p.sizes || cfg.lengthSizes) : [],
        dressLengths: (cfg && cfg.dressLengths) || [], palazzoLengths: (cfg && cfg.palazzoLengths) || [],
        lengthLabel: (cfg && cfg.lengthSizeLabel) || '',
        custom: custom, kind: ab ? 'abaya' : tp ? 'two-piece' : 'simple',
        // Size Manager: the old size lists, so the order check keeps existing products' sizes (size-core.js).
        sizeLegacy: w.getSizeLegacySlots(p, category)
      });
      var row0 = products[products.length - 1];
      if (sale) {
        if (sale.from != null) row0.saleFrom = sale.from;
        if (sale.to != null) row0.saleTo = sale.to;
        if (sale.regularPrice > 0) row0.regularPrice = sale.regularPrice;
        if (sale.regularPriceByType) row0.regularPrices = sale.regularPriceByType;
      }
      // Product Manager variations: only what the order price check needs (no SKU/photo; the before-sale
      // price only when the sale has dates).
      var vlist = sale ? sale.variations : p.variations;
      if (Array.isArray(vlist) && vlist.length) {
        row0.variations = vlist.map(function (v) {
          var row = {};
          ['type', 'color', 'size'].forEach(function (k) { if (v[k]) row[k] = v[k]; });
          if (v.price > 0) row.price = v.price;
          if (sale && v.regularPrice > 0) row.regularPrice = v.regularPrice;
          // Disabled or out of stock (Stock status without counted stock): the order server refuses it.
          if (v.enabled === false || v.stockStatus === 'outofstock') row.enabled = false;
          return row;
        });
      }
    });
  });
  var ids = {};
  products.forEach(function (p) { if (ids[p.id]) throw Error('Duplicate product IDs'); ids[p.id] = true; });
  return products;
};
window.__maValidationSources = ['product-config.js', 'product-utils.js', 'category-products.js', 'product-links-data.js', 'product-catalog-sync.js'];
