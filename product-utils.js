(function (g) {
  function getLinks() {
    return g.SITE_LINKS || {};
  }

  function applyReplaceRules(url) {
    var rules = (getLinks().images && getLinks().images.replace) || [];
    var out = String(url || "");
    rules.forEach(function (rule) {
      if (rule && rule.from && out.indexOf(rule.from) !== -1) {
        out = out.split(rule.from).join(rule.to || "");
      }
    });
    return out;
  }

  function fileNameFromUrl(url) {
    var clean = String(url || "").split("?")[0].split("#")[0];
    var parts = clean.split("/");
    var file = parts[parts.length - 1] || "";
    try {
      file = decodeURIComponent(file);
    } catch (e) {}
    return file;
  }

  function titleFromFileName(file) {
    var base = String(file || "")
      .replace(/\.(jpe?g|png|webp|gif|avif)$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return base.replace(/\b\w/g, function (ch) {
      return ch.toUpperCase();
    });
  }

  // raw.githubusercontent.com is NOT a CDN — no resizing, no edge caching
  // tuned for Bangladesh, and GitHub actively rate-limits/throttles raw
  // content. Most product entries in category-products.js already store
  // a full "https://raw.githubusercontent.com/.../images/<file>" URL, and
  // the old code below just returned any "https://" URL unchanged — so
  // ~87% of product images were served straight from GitHub on every page.
  //
  // Fix (opt-in, non-breaking): when SITE_LINKS.images.useLocalImages is
  // true, any raw.githubusercontent.com product image URL is rewritten to
  // <localBase><filename> instead — e.g. it becomes "images/dress.webp".
  // Turn this on ONLY after you've actually copied the real image files
  // into your own images/ folder (or a proper CDN) — until then, leave it
  // false (the default) and nothing changes/breaks.
  var GITHUB_RAW_HOST_RE = /^https?:\/\/raw\.githubusercontent\.com\//i;
  var GITHUB_BLOB_HOST_RE = /^https?:\/\/(?:www\.)?github\.com\/.+\/blob\//i;

  function githubImagesRelativePath(url) {
    var clean = String(url || "").split("?")[0].split("#")[0];
    var lower = clean.toLowerCase();
    var marker = "/images/";
    var idx = lower.lastIndexOf(marker);
    if (idx !== -1) {
      try {
        return decodeURIComponent(clean.slice(idx + marker.length));
      } catch (e) {
        return clean.slice(idx + marker.length);
      }
    }
    return fileNameFromUrl(url);
  }

  function rewriteGithubRawToLocal(url) {
    var imgCfg = getLinks().images || {};
    if (!imgCfg.useLocalImages) return url;
    if (!GITHUB_RAW_HOST_RE.test(url) && !GITHUB_BLOB_HOST_RE.test(url)) return url;
    var rel = githubImagesRelativePath(url);
    if (!rel) return url;
    var base = imgCfg.localBase || "images/";
    if (base.charAt(base.length - 1) !== "/") base += "/";
    return base + rel;
  }

  function resolveImageUrl(raw) {
    var url = resolveImageUrlRaw(raw);
    if (g.location && /^https?:$/.test(g.location.protocol) && url && !/^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(url)) {
      return '/' + url.replace(/^\.\//, '');
    }
    return url;
  }

  function resolveImageUrlRaw(raw) {
    var url = String(raw || "").trim();
    if (!url) return "";
    if (/^blob:/i.test(url)) return "";
    url = applyReplaceRules(url);

    if (/^https?:\/\//i.test(url) || url.indexOf("data:") === 0) {
      return rewriteGithubRawToLocal(url);
    }

    var imgCfg = getLinks().images || {};
    if (url.indexOf("images/") === 0) {
      return applyReplaceRules(url);
    }
    if (url.indexOf("/") !== -1) {
      return applyReplaceRules(url);
    }

    if (imgCfg.githubTemplate && imgCfg.githubTemplate.indexOf("{file}") !== -1) {
      return applyReplaceRules(imgCfg.githubTemplate.replace("{file}", encodeURIComponent(url)));
    }

    var base = imgCfg.localBase || "images/";
    if (base.charAt(base.length - 1) !== "/") base += "/";
    return applyReplaceRules(base + url);
  }

  function categoryDefaults(categoryKey) {
    var defs = (getLinks().defaults || {});
    var base = {
      price: defs.price,
      fabric: defs.fabric,
      sizes: defs.sizes ? defs.sizes.slice() : ["Body 42 (Free size)"]
    };
    var cat = defs.byCategory && defs.byCategory[categoryKey];
    if (!cat) return base;
    var out = {
      price: cat.price != null ? cat.price : base.price,
      fabric: cat.fabric || base.fabric,
      sizes: cat.sizes ? cat.sizes.slice() : base.sizes
    };
    if (categoryKey === "abaya" && cat.lengthSizes) {
      out.lengthSizes = cat.lengthSizes.slice();
      out.sizes = cat.lengthSizes.slice();
      out.bodySize = cat.bodySize || "46";
      out.bodySizeLabel = cat.bodySizeLabel || "46 [Free size]";
    }
    return out;
  }

  function resolveProductPageLink(product) {
    var cfg = getLinks().productPage || {};
    var raw = product.link || product.productUrl || product.page || "";
    if (raw && raw !== "index.html" && raw !== "/") {
      if (/^https?:\/\//i.test(raw)) return raw;
      if (typeof g.siteHref === "function") return g.siteHref(raw);
      return raw;
    }
    if (cfg.enabled && cfg.pattern && product.id) {
      var path = cfg.pattern.replace(/\{id\}/g, encodeURIComponent(product.id));
      if (typeof g.siteHref === "function") return g.siteHref(path);
      return path;
    }
    var fallback = cfg.default || "/";
    if (typeof g.siteHref === "function") return g.siteHref(fallback);
    return fallback;
  }

  function hasExplicitProductLink(product) {
    var raw = product.link || product.productUrl || product.page || "";
    return !!(raw && raw !== "index.html" && raw !== "/");
  }

  function categoryLabelForKey(key) {
    var secs = g.CATALOG_SECTIONS || [];
    for (var i = 0; i < secs.length; i++) {
      if (secs[i] && secs[i].key === key) return secs[i].menuBn || secs[i].menu || key;
    }
    return "";
  }

  function normalizeProductEntry(raw, categoryKey, index) {
    if (raw && raw._catalogNormalized) {
      // The array key is the source of truth. A product can be moved between
      // categories in the manager, so never let stale embedded metadata make
      // it look like it belongs to its previous category.
      if (categoryKey) raw.category = categoryKey;
      if (categoryKey) raw.categoryLabel = categoryLabelForKey(categoryKey);
      return raw;
    }
    if (categoryKey === "panjabi" && (!raw.sizes || !raw.sizes.length)) {
      raw.sizes = [
        'M (Long 40" • Body 42")',
        'L (Long 42" • Body 44")',
        'XL (Long 44" • Body 46")',
        'XXL (Long 46" • Body 48")'
      ];
    }
    var defs = categoryDefaults(categoryKey);
    var entry = raw;

    if (typeof raw === "string") {
      var imageRaw = raw.trim();
      var file = fileNameFromUrl(imageRaw);
      entry = {
        image: imageRaw,
        name: titleFromFileName(file),
        id:
          String(categoryKey || "item")
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "") +
          "-" +
          String(index + 1).padStart(4, "0")
      };
    }

    if (!entry || typeof entry !== "object") {
      return null;
    }

    var imageSrc = entry.image || entry.img || entry.photo || entry.url || "";
    var abayaDefs =
      categoryKey === "abaya" && defs.byCategory && defs.byCategory.abaya
        ? defs.byCategory.abaya
        : null;
    var defaultSizes = abayaDefs && abayaDefs.lengthSizes
      ? abayaDefs.lengthSizes.slice()
      : defs.sizes;
    var normalized = {
      id: entry.id || categoryKey + "-" + (index + 1),
      name: entry.name || titleFromFileName(fileNameFromUrl(imageSrc)),
      image: resolveImageUrl(imageSrc),
      price: parseInt(entry.price, 10) || defs.price || 550,
      fabric: entry.fabric || defs.fabric || "",
      sizes: Array.isArray(entry.sizes) && entry.sizes.length ? entry.sizes.slice() : defaultSizes,
      color: entry.color || "",
      colorLabel: entry.colorLabel || "",
      detailNote: entry.detailNote || "",
      isImageView: entry.isImageView === true,
      imageViewOf: entry.imageViewOf || "",
      link: entry.link || entry.productUrl || entry.page || "",
      // Do not preserve a stale category copied from an older export. The
      // category-products object key is canonical for every catalog entry.
      category: categoryKey || entry.category || "",
      categoryLabel: categoryKey ? categoryLabelForKey(categoryKey) : (entry.categoryLabel || ""),
      _catalogNormalized: true
    };

    /** একাধিক গ্যালারি ছবি (category-products.js এর raw.images[]) — আগে এই
     *  ফিল্ডটা normalize করার সময় বাদ পড়ে যেত, তাই product.images সবসময়
     *  undefined হয়ে product-page.js এ পৌঁছাত এবং গ্যালারিতে শুধু একটাই
     *  ছবি (product.image) দেখাত। এখন প্রতিটা URL resolveImageUrl() দিয়ে
     *  resolve করে, duplicate বাদ দিয়ে normalized.images এ রাখা হচ্ছে। */
    if (Array.isArray(entry.images) && entry.images.length) {
      var seenGalleryUrl = {};
      var galleryImages = [];
      entry.images.forEach(function (rawUrl) {
        var resolved = resolveImageUrl(String(rawUrl || "").trim());
        if (!resolved || seenGalleryUrl[resolved]) return;
        seenGalleryUrl[resolved] = true;
        galleryImages.push(resolved);
      });
      if (galleryImages.length) normalized.images = galleryImages;
    }

    if (Array.isArray(entry.colorVariants) && entry.colorVariants.length) {
      normalized.colorVariants = entry.colorVariants.filter(Boolean).map(function (row) {
        var copy = {};
        Object.keys(row).forEach(function (key) { copy[key] = row[key]; });
        var resolvedImage = resolveImageUrl(row.image || "");
        if (!resolvedImage && row.src) resolvedImage = resolveImageUrl(row.src);
        copy.image = resolvedImage;
        if (Object.prototype.hasOwnProperty.call(copy, "src")) copy.src = resolvedImage;
        return copy;
      });
    }

    if (entry.priceByType && typeof entry.priceByType === "object") {
      normalized.priceByType = entry.priceByType;
    }
    if (Array.isArray(entry.types) && entry.types.length) {
      normalized.types = entry.types.slice();
    }
    if (entry.typePriceGap != null) {
      normalized.typePriceGap = entry.typePriceGap;
    }

    if (abayaDefs) {
      normalized.sizes = abayaDefs.lengthSizes ? abayaDefs.lengthSizes.slice() : normalized.sizes;
      normalized.bodySize = abayaDefs.bodySize || "46";
      normalized.bodySizeLabel = abayaDefs.bodySizeLabel || "46 [Free size]";
    }

    /** প্রোডাক্ট নিজে বডি সাইজ বললে (category-products.js এ raw.bodySize /
     *  raw.bodySizeLabel / raw.bodySizes থাকলে) সেটাই ক্যাটাগরি ডিফল্টের
     *  উপর প্রায়োরিটি পাবে — যেমন একই ক্যাটাগরির কোনো একটা প্রোডাক্টের বডি
     *  সাইজ শুধু ৪২ হলে, ওই প্রোডাক্টে শুধু `bodySizes: ["42"]` (বা
     *  `bodySize`/`bodySizeLabel`) দিলেই হবে, বাকি প্রোডাক্ট ক্যাটাগরি
     *  ডিফল্ট মেনে চলবে। */
    if (entry.bodySize != null) normalized.bodySize = entry.bodySize;
    if (entry.bodySizeLabel != null) normalized.bodySizeLabel = entry.bodySizeLabel;
    if (Array.isArray(entry.bodySizes) && entry.bodySizes.length) {
      normalized.bodySizes = entry.bodySizes.slice();
    }
    if (Array.isArray(entry.sleeveSizes) && entry.sleeveSizes.length) {
      normalized.sleeveSizes = entry.sleeveSizes.slice();
    }
    if (Array.isArray(entry.lengthSizes) && entry.lengthSizes.length) {
      normalized.lengthSizes = entry.lengthSizes.slice();
      normalized.sizes = entry.lengthSizes.slice();
    }

    /** কোনো প্রোডাক্টের মাপ যদি সাধারণ "Body Size + একটা Length Size"
     *  প্যাটার্নে না বসে (যেমন: Body Size একটা রেঞ্জ, আর আলাদা আলাদা করে
     *  Kurti Length ও Pant Length আছে) — তাহলে raw.sizeSpecs দিয়ে যত খুশি
     *  কাস্টম লেবেল/ভ্যালু জোড়া দেওয়া যাবে, প্রতিটা আলাদা লাইনে (প্রিমিয়াম
     *  স্টাইলে) দেখানো হবে:
     *  sizeSpecs: [
     *    { label: "Kurti Length", value: "40–42 Inches" },
     *    { label: "Pant Length", value: "38–40 Inches" }
     *  ]
     *  bodySizeLabel দিয়ে Body Size-এর মান (যেমন "34–46") আলাদাভাবে বলা
     *  যাবে; এটা থাকলে ক্যাটাগরির ডিফল্ট বডি সাইজ পিল না দেখিয়ে এই মানটাই
     *  fixed টেক্সট হিসেবে দেখাবে। */
    if (Array.isArray(entry.sizeSpecs) && entry.sizeSpecs.length) {
      normalized.sizeSpecs = entry.sizeSpecs
        .filter(function (row) {
          return row && (row.label || row.value);
        })
        .map(function (row) {
          return { label: String(row.label || ""), value: String(row.value || "") };
        });
    }
    if (Array.isArray(entry.dressLengths) && entry.dressLengths.length) {
      normalized.dressLengths = entry.dressLengths.slice();
    }
    if (Array.isArray(entry.palazzoLengths) && entry.palazzoLengths.length) {
      normalized.palazzoLengths = entry.palazzoLengths.slice();
    }
    if (entry.lengthSizeLabel != null) {
      normalized.lengthSizeLabel = entry.lengthSizeLabel;
    }

    if (typeof entry.inStock === "boolean") {
      normalized.inStock = entry.inStock;
    }
    if (typeof entry._catalogStockDisabled === "boolean") {
      normalized._catalogStockDisabled = entry._catalogStockDisabled;
    }
    if (entry.stockVariants && typeof entry.stockVariants === "object") {
      normalized.stockVariants = entry.stockVariants;
    }
    if (entry.stock != null && entry.stock !== "") {
      var stockN = parseInt(entry.stock, 10);
      if (!isNaN(stockN)) normalized.stock = Math.max(0, stockN);
    }

    // WooCommerce-style fields from Product Manager: sale price, status, featured, tags, brand, SEO.
    var regularPrice = parseInt(entry.regularPrice, 10);
    if (regularPrice > normalized.price) normalized.regularPrice = regularPrice;
    if (entry.regularPriceByType && typeof entry.regularPriceByType === "object") {
      normalized.regularPriceByType = entry.regularPriceByType;
    }
    if (entry.status === "draft" || entry.status === "trash") normalized.status = entry.status;
    if (entry.featured === true) normalized.featured = true;
    if (Array.isArray(entry.tags) && entry.tags.length) {
      normalized.tags = entry.tags.map(function (t) { return String(t || "").trim(); }).filter(Boolean);
    }
    if (entry.brand) normalized.brand = String(entry.brand);
    if (entry.dateAdded) normalized.dateAdded = String(entry.dateAdded);
    if (entry.seoTitle) normalized.seoTitle = String(entry.seoTitle);
    if (entry.seoDescription) normalized.seoDescription = String(entry.seoDescription);

    normalized.productUrl = resolveProductPageLink(normalized);
    return normalized;
  }

  /** Draft and Trash products are kept in the catalog file but never shown or sold. */
  function isPublishedProduct(product) {
    return !!product && product.status !== "draft" && product.status !== "trash";
  }

  /** Storefront view of one category: published products only, featured ones first (stable order). */
  function storefrontList(list) {
    var out = (list || []).filter(function (product) {
      return isPublishedProduct(product) && product.isImageView !== true;
    });
    if (!out.some(function (p) { return p.featured === true; })) return out;
    return out.map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { return ((b.p.featured === true) - (a.p.featured === true)) || (a.i - b.i); })
      .map(function (x) { return x.p; });
  }

  function normalizeCategoryList(list, categoryKey) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (item, index) {
      var row = normalizeProductEntry(item, categoryKey, index);
      if (row) out.push(row);
    });
    return out;
  }

  function applyLinkOverlay(categories, linkLists) {
    var result = {};
    var cats = categories || {};
    var links = linkLists || {};

    Object.keys(cats).forEach(function (key) {
      result[key] = normalizeCategoryList(cats[key], key);
    });

    Object.keys(links).forEach(function (key) {
      if (!Array.isArray(links[key])) return;
      if (!result[key]) result[key] = [];
      links[key].forEach(function (raw, i) {
        var url = String(raw || "").trim();
        if (!url) return;
        if (result[key][i]) {
          result[key][i].image = resolveImageUrl(url);
          result[key][i]._catalogNormalized = true;
        }
      });
    });

    return result;
  }

  /** Product Manager passes { includeUnpublished: true }; every storefront/build caller gets published products only. */
  function normalizeAll(categories, linkLists, options) {
    var all = normalizeAllEntries(categories, linkLists, options);
    if (options && options.includeUnpublished) return all;
    var out = {};
    Object.keys(all).forEach(function (key) { out[key] = storefrontList(all[key]); });
    return out;
  }

  function normalizeAllEntries(categories, linkLists, options) {
    var opts = options || {};
    var mode =
      opts.mode ||
      (getLinks().catalog && getLinks().catalog.mode) ||
      "merge";

    if (mode === "overlay") {
      return applyLinkOverlay(categories, linkLists);
    }

    if (mode === "replace") {
      var only = {};
      var extras = linkLists || {};
      Object.keys(extras).forEach(function (key) {
        if (Array.isArray(extras[key]) && extras[key].length) {
          only[key] = normalizeCategoryList(extras[key], key);
        }
      });
      Object.keys(categories || {}).forEach(function (key) {
        if (!only[key] || !only[key].length) {
          only[key] = normalizeCategoryList(categories[key], key);
        }
      });
      return only;
    }

    var merged = categories || {};
    var linkExtras = linkLists || {};
    var result = {};

    Object.keys(merged).forEach(function (key) {
      result[key] = normalizeCategoryList(merged[key], key);
    });

    Object.keys(linkExtras).forEach(function (key) {
      if (!Array.isArray(linkExtras[key])) return;
      if (!result[key]) result[key] = [];
      linkExtras[key].forEach(function (url, i) {
        if (!url || !result[key][i]) return;
        result[key][i].image = resolveImageUrl(url);
        result[key][i]._catalogNormalized = true;
      });
    });

    return result;
  }

  /**
   * Catalog stock: omit `stock` (or leave it empty) = sellable / untracked.
   * `stock: 0` or `inStock: false` = sold out. Numeric `stock` caps cart qty.
   * Permanent stock for all visitors is edited in category-products.js
   * (or Product Manager). Checkout cannot rewrite that JS file.
   */
  function stockVariantKey(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function hasTrackedStockVariants(product) {
    var variants = product && product.stockVariants && typeof product.stockVariants === "object"
      ? product.stockVariants
      : null;
    return !!variants && Object.keys(variants).some(function (key) {
      return variants[key] && variants[key].tracked === true;
    });
  }

  /** "Navy · 52": the stock row name for one colour of one size (same text as Apps Script colorSizeStockVariant_). */
  function colorSizeStockVariant(color, size) {
    color = String(color || "").replace(/\s+/g, " ").trim();
    size = String(size || "").replace(/\s+/g, " ").trim();
    return color && size ? color + " \u00b7 " + size : "";
  }

  /**
   * Which stock row a choice uses, in the order the order check uses (Apps Script cartItemStockCandidates_):
   * "Colour · Size", then the size, then the colour, then the product's "all sizes" pool (_default).
   * variant is the size (or the colour when there is no size), as before. Returns the row's key, or "".
   */
  function stockRowKey(product, variant, color) {
    var variants = product && product.stockVariants && typeof product.stockVariants === "object"
      ? product.stockVariants
      : null;
    if (!variants || !String(variant || "").trim()) return "";
    var keys = Object.keys(variants);
    var wanted = [colorSizeStockVariant(color, variant), variant, color].map(stockVariantKey).filter(Boolean);
    var found = "";
    wanted.some(function (w) {
      return keys.some(function (key) {
        if (key !== "_default" && stockVariantKey(key) === w) { found = key; return true; }
        return false;
      });
    });
    if (found) return found;
    return variants._default ? "_default" : "";
  }

  /**
   * Photo description (alt text) for search engines and screen readers: name, the colour that photo shows
   * (from the product's colour photos) or its single colour, and fabric. Later photos get "(photo 2)" etc.
   */
  function productImageAlt(product, src, index) {
    if (!product) return "";
    var file = function (u) { return String(u || "").split(/[?#]/)[0].split("/").pop().toLowerCase(); };
    var colour = "";
    var rows = Array.isArray(product.colorVariants) ? product.colorVariants : [];
    if (src && rows.length) {
      rows.some(function (r) {
        if (r && r.image && file(r.image) === file(src)) { colour = r.colorLabel || r.color || ""; return true; }
        return false;
      });
    } else if (!rows.length && !/[,/]|multiple/i.test(String(product.colorLabel || ""))) {
      colour = product.colorLabel || "";
    }
    var parts = [product.name, colour, product.fabric].map(function (v) { return String(v || "").trim(); })
      .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
    return parts.join(" – ") + (index > 0 ? " (photo " + (index + 1) + ")" : "");
  }

  /** Key for "do these cart lines share one stock row": lines with the same key draw from the same count. */
  function stockLineKey(product, line) {
    var variant = (line && (line.size || line.selectedSize || line.color)) || "";
    var row = product ? stockRowKey(product, variant, line && line.color) : "";
    return row ? stockVariantKey(row) : stockVariantKey(variant);
  }

  function getStockQty(product, variant, color) {
    if (!product) return null;
    if (product.inStock === false) return 0; // Product Manager-এর explicit stock-off override
    var variants = product.stockVariants && typeof product.stockVariants === "object"
      ? product.stockVariants
      : null;
    var variantKeys = variants ? Object.keys(variants) : [];
    var hasTrackedVariants = hasTrackedStockVariants(product);

    if (variants && String(variant || "").trim()) {
      // রং·মাপ → মাপ → রং → পণ্যের "সব সাইজ" পুল (খালি Variant) — Apps Script-এর একই নিয়ম।
      var rowKey = stockRowKey(product, variant, color);
      var row = rowKey ? variants[rowKey] : null;
      if (row && row.tracked === true) {
        return Math.max(0, parseInt(row.available, 10) || 0);
      }
      // শুধু রং বাছা হয়েছে, মাপ এখনো না: সেই রঙের সব "রং · মাপ" সারির যোগফল।
      var colorOnly = String(color || "").trim() && stockVariantKey(color) === stockVariantKey(variant);
      if (!row && colorOnly) {
        var prefix = stockVariantKey(color) + " \u00b7 ";
        var colorRows = variantKeys.filter(function (key) {
          return stockVariantKey(key).indexOf(prefix) === 0 && variants[key] && variants[key].tracked === true;
        });
        if (colorRows.length) {
          return colorRows.reduce(function (sum, key) {
            return sum + Math.max(0, parseInt(variants[key].available, 10) || 0);
          }, 0);
        }
      }
      if (hasTrackedVariants) return 0; // tracked product-এর অজানা/untracked size বিক্রিযোগ্য নয়
    }

    if (hasTrackedVariants) {
      return variantKeys.reduce(function (sum, key) {
        var row = variants[key];
        return sum + (row && row.tracked === true ? Math.max(0, parseInt(row.available, 10) || 0) : 0);
      }, 0);
    }
    if (product.stock == null || product.stock === "") return null;
    var n = parseInt(product.stock, 10);
    if (isNaN(n)) return null;
    return Math.max(0, n);
  }

  function isInStock(product, variant, color) {
    var qty = getStockQty(product, variant, color);
    if (qty === null) return true;
    return qty > 0;
  }

  function getStockStatus(product, variant, color) {
    var inStock = isInStock(product, variant, color);
    var qty = getStockQty(product, variant, color);
    // No stock count entered (and not marked out of stock): shown as "In Stock" everywhere, the same
    // as the homepage always showed (owner's choice, 2026-10-23).
    return {
      inStock: inStock,
      qty: qty,
      label: inStock ? "In Stock" : "Out of Stock",
      badge: inStock ? "In Stock" : "Sold Out",
      buttonLabel: inStock ? "Add to Cart" : "Out of Stock"
    };
  }

  function categoryHasProducts(key) {
    var list = (g.CATEGORY_PRODUCTS || {})[key];
    return (
      Array.isArray(list) &&
      list.some(function (p) {
        return p && (p.image || p.name);
      })
    );
  }

  function getAbayaSizeConfig(product) {
    var ab =
      g.SITE_LINKS &&
      g.SITE_LINKS.defaults &&
      g.SITE_LINKS.defaults.byCategory &&
      g.SITE_LINKS.defaults.byCategory.abaya;
    var p = product || {};
    return {
      bodySize: p.bodySize || (ab && ab.bodySize) || "46",
      bodySizeLabel: p.bodySizeLabel || (ab && ab.bodySizeLabel) || "46 [Free size]",
      bodySizes:
        (Array.isArray(p.bodySizes) && p.bodySizes.length && p.bodySizes.slice()) ||
        (ab && ab.bodySizes && ab.bodySizes.slice()) ||
        null,
      lengthSizes:
        (Array.isArray(p.lengthSizes) && p.lengthSizes.length && p.lengthSizes.slice()) ||
        (ab && ab.lengthSizes && ab.lengthSizes.slice()) ||
        ["50", "52", "54", "56"]
    };
  }

  function isAbayaProduct(p, categoryKey) {
    var ck = String(categoryKey || (p && (p.category || "")) || "").trim();
    if (ck === "abaya") return true;
    if (isTwoPieceProduct(p, ck)) return false;
    if (p && p.name && p.name.toLowerCase().indexOf("abaya") !== -1) return true;
    return false;
  }

  function formatAbayaCartSize(lengthSize, bodyLabelOverride) {
    var cfg = getAbayaSizeConfig();
    var len = String(lengthSize || cfg.lengthSizes[0] || "50").trim();
    var bodyLabel = String(bodyLabelOverride || "").trim() || cfg.bodySizeLabel;
    return "Body " + bodyLabel + " · Length " + len;
  }

  function parseAbayaLengthSize(sizeStr) {
    var raw = String(sizeStr || "").trim();
    var m = raw.match(/Length\s+(\d+)/i);
    if (m) return m[1];
    if (/^(50|52|54|56)$/.test(raw)) return raw;
    return getAbayaSizeConfig().lengthSizes[0];
  }

  function looksLikeNumericBodySizes(arr) {
    if (!Array.isArray(arr) || !arr.length) return false;
    var i;
    for (i = 0; i < arr.length; i++) {
      if (!/^\d{2}$/.test(String(arr[i] || "").trim())) return false;
    }
    return true;
  }

  function getTwoPieceSizeConfig(product) {
    var tp =
      g.SITE_LINKS &&
      g.SITE_LINKS.defaults &&
      g.SITE_LINKS.defaults.byCategory &&
      g.SITE_LINKS.defaults.byCategory["premium-two-piece"];
    var p = product || {};
    var bodySizes =
      (Array.isArray(p.bodySizes) && p.bodySizes.length && p.bodySizes.slice()) ||
      (looksLikeNumericBodySizes(p.sizes) && p.sizes.slice()) ||
      null;
    var bodySizeLabel = p.bodySizeLabel || "";
    if (!bodySizeLabel && bodySizes && bodySizes.length) {
      bodySizeLabel =
        bodySizes.length === 1
          ? String(bodySizes[0])
          : String(bodySizes[0]) + "–" + String(bodySizes[bodySizes.length - 1]);
    }
    if (!bodySizeLabel) {
      bodySizeLabel = (tp && tp.bodySizeLabel) || "42 (Free size)";
    }
    var dressLengths =
      Array.isArray(p.dressLengths) && p.dressLengths.length ? p.dressLengths.slice() : null;
    var sleeveSizes =
      Array.isArray(p.sleeveSizes) && p.sleeveSizes.length ? p.sleeveSizes.slice() : null;
    var palazzoLengths =
      Array.isArray(p.palazzoLengths) && p.palazzoLengths.length ? p.palazzoLengths.slice() : null;
    return {
      bodySizeLabel: bodySizeLabel,
      bodySizes: bodySizes,
      dressLengths: dressLengths,
      sleeveSizes: sleeveSizes,
      palazzoLengths: palazzoLengths,
      lengthSizeLabel:
        p.lengthSizeLabel ||
        (dressLengths ? "Dress Length" : (tp && tp.lengthSizeLabel) || "37-38 inch"),
      lengthSizes:
        dressLengths ||
        (Array.isArray(p.lengthSizes) && p.lengthSizes.length && p.lengthSizes.slice()) ||
        (tp && tp.lengthSizes && tp.lengthSizes.slice()) ||
        ["37-38 inch"]
    };
  }

  function isTwoPieceProduct(p, categoryKey) {
    var ck = String(categoryKey || (p && (p.category || "")) || "").trim();
    if (ck === "premium-two-piece") return true;

    var id = String((p && p.id) || "").trim();
    if (/^DR-\d+/i.test(id) || /^TP-\d+/i.test(id)) return true;

    var name = String((p && p.name) || "").toLowerCase();
    if (
      name.indexOf("two piece") !== -1 ||
      name.indexOf("two-piece") !== -1 ||
      name.indexOf("co-ord") !== -1 ||
      name.indexOf("coord") !== -1
    ) {
      return true;
    }

    return false;
  }

  function formatTwoPieceCartSize(lengthSizeOpt, bodyLabelOverride) {
    var cfg = getTwoPieceSizeConfig();
    var len = String(lengthSizeOpt || cfg.lengthSizeLabel || "37-38 inch").trim();
    var bodyLabel = String(bodyLabelOverride || "").trim() || cfg.bodySizeLabel;
    return "Body " + bodyLabel + " · Length " + len;
  }

  function parseTwoPieceLengthSize(sizeStr) {
    var raw = String(sizeStr || "").trim();
    var m = raw.match(/Length\s+([^)·]+)/i);
    if (m) return String(m[1]).trim();
    if (/37-38\s*inch/i.test(raw)) return "37-38 inch";
    return getTwoPieceSizeConfig().lengthSizeLabel;
  }
function getPanjabiSizeConfig() {
  var pj =
    g.SITE_LINKS &&
    g.SITE_LINKS.defaults &&
    g.SITE_LINKS.defaults.byCategory &&
    g.SITE_LINKS.defaults.byCategory.panjabi;

  return {
    sizes: (pj && pj.sizes && pj.sizes.slice()) || [
      { value: "M", label: 'M (Long 40" • Body 42")' },
      { value: "L", label: 'L (Long 42" • Body 44")' },
      { value: "XL", label: 'XL (Long 44" • Body 46")' },
      { value: "XXL", label: 'XXL (Long 46" • Body 48")' }
    ]
  };
}

function isPanjabiProduct(product, categoryKey) {
  var ck = String(categoryKey != null ? categoryKey : (product && product.category != null ? product.category : "")).trim().toLowerCase();
  if (ck === "panjabi") return true;
  var productName = String(product && product.name != null ? product.name : "").toLowerCase();
  if (productName.includes("panjabi")) return true;
  return false;
}

function formatPanjabiCartSize(size) {
  return String(size || "").trim().toUpperCase();
}

function parsePanjabiSize(sizeStr) {
  var s = String(sizeStr || "").trim().toUpperCase();

  if (s === "M") {
    return { size: "M", length: '40"', body: '42"' };
  }

  if (s === "L") {
    return { size: "L", length: '42"', body: '44"' };
  }

  if (s === "XL") {
    return { size: "XL", length: '44"', body: '46"' };
  }

  if (s === "XXL") {
    return { size: "XXL", length: '46"', body: '48"' };
  }

  return null;
}
  function stripSizeFromCartName(name) {
    return String(name || "")
      .replace(/\s*\(Body\s+.*\)\s*$/i, "")
      .replace(/\s*\(Size\s+.*\)\s*$/i, "")
      .trim();
  }

  function getCartLineSizeLabel(item) {
    if (!item) return "";
    var direct = String(item.size || item.selectedSize || "").trim();
    if (direct) return direct;
    var cat = item.category || item.categoryKey || "";
    if (item.lengthSize) {
      if (isAbayaProduct(item, cat)) return formatAbayaCartSize(item.lengthSize);
      if (isTwoPieceProduct(item, cat)) return formatTwoPieceCartSize(item.lengthSize);
      return String(item.lengthSize);
    }
    if (isAbayaProduct(item, cat)) {
      var fromName = parseAbayaLengthSize(item.name || "");
      if (fromName) return formatAbayaCartSize(fromName);
    }
    if (isTwoPieceProduct(item, cat)) {
      var tpLen = parseTwoPieceLengthSize(item.name || "");
      if (tpLen) return formatTwoPieceCartSize(tpLen);
    }
    return "";
  }

  /** Size Manager: the size lists the old pickers show for a product, by slot (see size-core.js).
   *  Existing products keep exactly these when their category is switched to a size template. */
  function getSizeLegacySlots(p, categoryKey) {
    var out = {};
    function put(slot, list) {
      if (!Array.isArray(list)) return;
      var values = list.map(function (v) { return String(v && typeof v === "object" ? v.value : v == null ? "" : v).trim(); })
        .filter(Boolean);
      if (values.length) out[slot] = values;
    }
    p = p || {};
    if (isAbayaProduct(p, categoryKey)) {
      var ab = getAbayaSizeConfig(p);
      put("body", ab.bodySizes && ab.bodySizes.length ? ab.bodySizes : [ab.bodySizeLabel]);
      put("length", p.lengthSizes && p.lengthSizes.length ? p.lengthSizes : p.sizes);
    } else if (isTwoPieceProduct(p, categoryKey)) {
      var tp = getTwoPieceSizeConfig(p);
      put("body", tp.bodySizes && tp.bodySizes.length ? tp.bodySizes : p.sizes);
      put("dressLength", tp.dressLengths || [tp.lengthSizeLabel]);
      put("sleeve", tp.sleeveSizes);
      put("palazzo", tp.palazzoLengths);
    } else {
      put("sizes", p.sizes);
    }
    return out;
  }

  function getCartLineBaseName(item) {
    return stripSizeFromCartName(item && item.name);
  }

g.getAbayaSizeConfig = getAbayaSizeConfig;
g.isAbayaProduct = isAbayaProduct;
g.formatAbayaCartSize = formatAbayaCartSize;
g.parseAbayaLengthSize = parseAbayaLengthSize;

g.getTwoPieceSizeConfig = getTwoPieceSizeConfig;
g.isTwoPieceProduct = isTwoPieceProduct;
g.formatTwoPieceCartSize = formatTwoPieceCartSize;
g.parseTwoPieceLengthSize = parseTwoPieceLengthSize;

g.getSizeLegacySlots = getSizeLegacySlots;

g.getPanjabiSizeConfig = getPanjabiSizeConfig;
g.isPanjabiProduct = isPanjabiProduct;
g.formatPanjabiCartSize = formatPanjabiCartSize;
g.parsePanjabiSize = parsePanjabiSize;

g.stripSizeFromCartName = stripSizeFromCartName;
g.getCartLineSizeLabel = getCartLineSizeLabel;
g.getCartLineBaseName = getCartLineBaseName;

  var FABRIC_LABEL_EN = {
  "Dubai Cherry": "Dubai Cherry",
  "Alex Soft Georgette": "Alex Soft Georgette",
  "Premium Georgette": "Premium Georgette",
  "Premium Cotton": "Premium Cotton"
};

 function formatFabricLabelEn(fabric) {
  var f = String(fabric != null ? fabric : "").trim();
  if (!f) return "";
  if (/dubai/i.test(f) && /cherry/i.test(f)) {
    return "Dubai Cherry";
  }
  if (/alex/i.test(f) && /georgette/i.test(f)) {
    return "Alex Soft Georgette";
  }
  if (/premium\s*georgette/i.test(f)) {
    return "Premium Georgette";
  }
  if (/premium\s*cotton/i.test(f)) {
    return "Premium Cotton";
  }
  return f;
}
  /**
   * Sale price: `price` / `priceByType` stay the price the customer pays (cart and order checks use them);
   * `regularPrice` / `regularPriceByType` are the optional "before sale" prices shown struck through.
   * Returns { regular, sale, percent } when the product (or option) is on sale, else null.
   */
  function getSaleInfo(product, typeLabel, sellingPrice) {
    if (!product) return null;
    var sale = parseInt(sellingPrice != null && sellingPrice !== "" ? sellingPrice : product.price, 10) || 0;
    var regular = NaN;
    if (typeLabel) {
      var map = product.regularPriceByType;
      if (map && typeof map === "object" && map[typeLabel] != null) regular = parseInt(map[typeLabel], 10);
    } else {
      regular = parseInt(product.regularPrice, 10);
    }
    if (!(sale > 0) || !(regular > sale)) return null;
    return { regular: regular, sale: sale, percent: Math.round((1 - sale / regular) * 100) };
  }

  /** "৳1650", or "<del>৳1900</del> <span>৳1650</span>" when on sale (safe HTML: numbers only). */
  function formatPriceHtml(product, typeLabel, sellingPrice) {
    var info = getSaleInfo(product, typeLabel, sellingPrice);
    var sale = parseInt(sellingPrice != null && sellingPrice !== "" ? sellingPrice : product && product.price, 10) || 0;
    if (!info) return "\u09F3" + sale;
    return '<del class="ma-price-was" aria-label="Regular price \u09F3' + info.regular + '">\u09F3' + info.regular + '</del> ' +
      '<span class="ma-price-now">\u09F3' + info.sale + '</span>';
  }

  /* ---------- Site search (header search box, /category?q=…, /category?tag=…) ---------- */
  function searchText(v) {
    return String(v == null ? "" : v).toLowerCase().replace(/[\s\-_/.,()+]+/g, " ").trim();
  }
  function searchTerms(q) {
    return searchText(q).split(" ").filter(function (t) { return t.length > 0; });
  }
  function categoryLabelText(key, meta) {
    var secs = g.CATALOG_SECTIONS || [];
    var parts = [key, meta && meta[key] && meta[key].title];
    secs.forEach(function (s) { if (s && s.key === key) parts.push(s.menu, s.menuBn); });
    return searchText(parts.join(" "));
  }
  function productSearchText(p, key, meta) {
    return searchText([p.name, p.id, p.color, p.colorLabel, p.fabric, p.brand, (p.tags || []).join(" "), categoryLabelText(key, meta)].join(" "));
  }
  function productMatches(p, key, meta, q) {
    var terms = searchTerms(q);
    if (!terms.length || !p) return false;
    var hay = " " + productSearchText(p, key, meta) + " ";
    return terms.every(function (t) { return hay.indexOf(t) !== -1; });
  }
  function categoryMatches(key, meta, q) {
    var t = searchText(q);
    return !!t && categoryLabelText(key, meta).split(" ").indexOf(t) !== -1;
  }
  function productHasTag(p, tag) {
    var want = searchText(tag);
    return !!want && Array.isArray(p && p.tags) && p.tags.some(function (t) { return searchText(t) === want; });
  }
  function collectProductsInCategory(all, key, q, meta) {
    var list = (all && all[key]) || [];
    if (categoryMatches(key, meta, q)) return list.slice();
    return list.filter(function (p) { return productMatches(p, key, meta, q); });
  }
  function collectProducts(all, q, meta) {
    var out = [], seen = {};
    Object.keys(all || {}).forEach(function (key) {
      collectProductsInCategory(all, key, q, meta).forEach(function (p) {
        var id = p.id || p.name;
        if (seen[id]) return;
        seen[id] = true;
        out.push(p);
      });
    });
    return out;
  }
  function collectProductsByTag(all, tag) {
    var out = [], seen = {};
    Object.keys(all || {}).forEach(function (key) {
      ((all && all[key]) || []).forEach(function (p) {
        var id = p.id || p.name;
        if (seen[id] || !productHasTag(p, tag)) return;
        seen[id] = true;
        out.push(p);
      });
    });
    return out;
  }
  /** Where the header search form goes: the only matching category, otherwise all categories. */
  function pickRedirectHref(q, nav, meta, all) {
    var keys = Object.keys(all || {}).filter(function (key) { return collectProductsInCategory(all, key, q, meta).length; });
    if (keys.length === 1) {
      var hit = (nav || []).find(function (n) { return n && n.key === keys[0]; });
      return (hit && hit.href) || "/" + keys[0];
    }
    return "/category";
  }

  g.maSearch = {
    getTerms: searchTerms,
    productMatches: productMatches,
    categoryMatches: categoryMatches,
    productHasTag: productHasTag,
    collectProducts: collectProducts,
    collectProductsInCategory: collectProductsInCategory,
    collectProductsByTag: collectProductsByTag,
    pickRedirectHref: pickRedirectHref
  };
  // One small shared style for sale prices, so every page (home, shop, product, related) shows them the same.
  if (typeof document !== "undefined" && document.head && !document.getElementById("ma-sale-price-css")) {
    var saleCss = document.createElement("style");
    saleCss.id = "ma-sale-price-css";
    saleCss.textContent = ".ma-price-was{color:#8a8f98;font-weight:400;text-decoration:line-through;margin-right:4px;font-size:.86em}" +
      ".ma-price-now{color:#b42318}.ma-price-off{display:inline-block;margin-left:6px;padding:1px 6px;font-size:.62em;font-weight:700;" +
      "line-height:1.5;vertical-align:middle;color:#fff;background:#b42318}.pqv-spec-tags a{color:inherit;text-decoration:underline}";
    document.head.appendChild(saleCss);
  }
  g.maGetSaleInfo = getSaleInfo;
  g.maFormatPriceHtml = formatPriceHtml;
  g.formatFabricLabelEn = formatFabricLabelEn;
  g.hasTrackedStockVariants = hasTrackedStockVariants;
  g.getStockQty = getStockQty;
  g.stockRowKey = stockRowKey;
  g.productImageAlt = productImageAlt;
  g.stockLineKey = stockLineKey;
  g.colorSizeStockVariant = colorSizeStockVariant;
  g.isInStock = isInStock;
  g.getStockStatus = getStockStatus;

  /**
   * Color options for the product page, matching the "Color (shown)" text saved in the admin panel.
   * Products can also carry an older per-photo list (colorVariants). When the owner changes the color
   * text, the old list must not keep showing the previous colors. Rules (photo order is kept, so the
   * first color still matches the main photo):
   *  - a color that is still in the saved text keeps its own photo;
   *  - the other photos take the remaining new colors, in the order they were typed;
   *  - a photo with no color left is dropped; extra new colors are added without a photo.
   * Returns null when the product has no per-photo list, or the saved text names one color or none.
   */
  function colorKey(label) {
    return String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  function reconcileColorVariants(p) {
    if (!p || !Array.isArray(p.colorVariants) || !p.colorVariants.length) return null;
    var labels = String(p.colorLabel || p.color || "").split(/[,，;；|]/).map(function (x) { return x.trim(); }).filter(Boolean);
    var rows = p.colorVariants.filter(Boolean);
    if (labels.length < 2) return rows;
    var used = {};
    var rowKeys = rows.map(function (r) { return colorKey(r.colorLabel || r.label || r.color) || String(r.color || ""); });
    var out = rows.map(function (r, i) {
      var hit = -1;
      labels.some(function (label, j) {
        if (!used[j] && colorKey(label) === rowKeys[i]) { hit = j; return true; }
        return false;
      });
      if (hit < 0) return null;
      used[hit] = true;
      return { color: colorKey(labels[hit]) || String(r.color || "color-" + (hit + 1)), colorLabel: labels[hit], image: r.image || r.src || "" };
    });
    var rest = labels.map(function (l, j) { return used[j] ? null : l; }).filter(Boolean);
    out = out.map(function (o, i) {
      if (o) return o;
      if (!rest.length) return null;
      var label = rest.shift();
      return { color: colorKey(label) || String(rows[i].color || "color-" + (i + 1)), colorLabel: label, image: rows[i].image || rows[i].src || "" };
    }).filter(Boolean);
    rest.forEach(function (label) { out.push({ color: colorKey(label) || "color-" + (out.length + 1), colorLabel: label, image: "" }); });
    return out;
  }

  g.maReconcileColorVariants = reconcileColorVariants;
  g.maCatalog = {
    resolveImageUrl: resolveImageUrl,
    resolveProductPageLink: resolveProductPageLink,
    hasExplicitProductLink: hasExplicitProductLink,
    normalizeProductEntry: normalizeProductEntry,
    normalizeAll: normalizeAll,
    isPublishedProduct: isPublishedProduct,
    getSaleInfo: getSaleInfo,
    categoryHasProducts: categoryHasProducts,
    titleFromFileName: titleFromFileName,
    hasTrackedStockVariants: hasTrackedStockVariants,
    getStockQty: getStockQty,
    stockRowKey: stockRowKey,
    imageAlt: productImageAlt,
    stockLineKey: stockLineKey,
    colorSizeStockVariant: colorSizeStockVariant,
    isInStock: isInStock,
    getStockStatus: getStockStatus
  };
})(window);
