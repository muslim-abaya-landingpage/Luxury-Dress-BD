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
      products.push({
        id: p.id, name: p.name, category: category, price: p.price, prices: p.priceByType || null, sizes: p.sizes || [],
        bodySizes: (cfg && cfg.bodySizes) || [], bodyLabel: (cfg && cfg.bodySizeLabel) || '',
        lengths: ab ? (p.lengthSizes || p.sizes || cfg.lengthSizes) : [],
        dressLengths: (cfg && cfg.dressLengths) || [], palazzoLengths: (cfg && cfg.palazzoLengths) || [],
        lengthLabel: (cfg && cfg.lengthSizeLabel) || '',
        custom: custom, kind: ab ? 'abaya' : tp ? 'two-piece' : 'simple'
      });
      // Size Manager: only for products whose size template is switched on, so other products are unchanged.
      var sized = w.maSizeTemplates && w.maSizeTemplates.resolve(p, category);
      if (sized) {
        products[products.length - 1].sizeTemplate = sized.templateId;
        products[products.length - 1].sizeFields = sized.fields;
      }
    });
  });
  var ids = {};
  products.forEach(function (p) { if (ids[p.id]) throw Error('Duplicate product IDs'); ids[p.id] = true; });
  return products;
};
window.__maValidationSources = ['product-config.js', 'product-utils.js', 'category-products.js', 'product-links-data.js', 'product-catalog-sync.js'];
