(function (g) {
/** Owner-defined measurements: [{name, values}] with safe, short texts; anything else is dropped. */
function cleanProductMeasures(list) {
  var out = [], seen = {};
  (Array.isArray(list) ? list : []).forEach(function (m) {
    if (!m || typeof m !== "object" || out.length >= 12) return;
    var name = String(m.name || "").replace(/\s+/g, " ").trim();
    if (!name || name.length > 40 || /[<>{}`\\:·|]/.test(name) || seen[name.toLowerCase()]) return;
    var vals = [], vseen = {};
    (Array.isArray(m.values) ? m.values : []).forEach(function (v) {
      v = String(v == null ? "" : v).replace(/\s+/g, " ").trim();
      if (!v || v.length > 20 || /[<>{}`\\:·|]/.test(v) || vseen[v.toLowerCase()] || vals.length >= 40) return;
      vseen[v.toLowerCase()] = true;
      vals.push(v);
    });
    if (!vals.length) return;
    seen[name.toLowerCase()] = true;
    out.push({ name: name, values: vals });
  });
  return out;
}
if (typeof window !== "undefined") window.cleanProductMeasures = cleanProductMeasures;
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

  /**
   * Cleans product.variations: [{type, color, size, price, regularPrice, sku, image, enabled}].
   * type/color/size empty = "any"; size uses the stock-row form ("52", "Body 46 · Length 54", "Length 54").
   * The order server (Operations.gs opsVariation_) and cart-reprice.js pick the most specific match.
   */
  function cleanVariations(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.slice(0, 500).forEach(function (v) {
      if (!v || typeof v !== "object") return;
      var row = {};
      ["type", "color", "size", "sku", "image"].forEach(function (k) {
        var t = String(v[k] == null ? "" : v[k]).replace(/\s+/g, " ").trim().slice(0, k === "image" ? 500 : 160);
        if (t) row[k] = t;
      });
      var price = parseInt(v.price, 10);
      if (price > 0) row.price = price;
      var regular = parseInt(v.regularPrice, 10);
      if (regular > 0 && (!row.price || regular > row.price)) row.regularPrice = regular;
      if (v.enabled === false) row.enabled = false;
      if (v.stockStatus === "outofstock") row.stockStatus = "outofstock";
      // Own sale dates (Variations → Schedule); empty = the product's sale dates.
      ["saleFrom", "saleTo"].forEach(function (k) { if (/^\d{4}-\d{2}-\d{2}$/.test(String(v[k] || "").trim())) row[k] = String(v[k]).trim(); });
      if (row.type || row.color || row.size) out.push(row);
    });
    return out;
  }

  /**
   * The product variation for a cart line {productType, color, size}, or null. Same rule as the order
   * server (Operations.gs opsVariation_) and cart-reprice.js: empty type/color/size = any; the most
   * specific match wins (size counts one per " · " part); ties go to the first row.
   */
  function variationFor(p, line) {
    var list = p && p.variations;
    if (!Array.isArray(list) || !list.length || !line) return null;
    var norm = function (s) { return String(s || "").trim().toLowerCase().replace(/[\u2013\u2014]/g, "-").replace(/\s+/g, " "); };
    var key = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); };
    var parts = function (s) { return norm(s).split(/\s*\u00b7\s*/).filter(Boolean); };
    var type = norm(line.productType).replace(/\s/g, ""), color = String(line.color || ""), size = parts(line.size);
    var best = null, top = -1;
    list.forEach(function (v) {
      if (!v || typeof v !== "object") return;
      var n = 0;
      if (v.type) { if (norm(v.type).replace(/\s/g, "") !== type) return; n++; }
      if (v.color) { if (!((key(v.color) && key(v.color) === key(color)) || norm(v.color) === norm(color))) return; n++; }
      if (v.size) {
        var want = parts(v.size);
        if (!want.every(function (x) { return size.indexOf(x) >= 0; })) return;
        n += want.length;
      }
      if (n > top) { best = v; top = n; }
    });
    return best;
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
    // Smaller card-size photo made by Smart Upload (images/uploads/<id>-card.webp). It used to be
    // dropped here, so listings always downloaded the full photo instead.
    if (entry.imageCard) {
      var cardResolved = resolveImageUrl(String(entry.imageCard).trim());
      if (cardResolved) normalized.imageCard = cardResolved;
    }

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
    /** Owner's own measurements (Product Manager → Size & measurements), e.g.
     *  measures: [{ name: "Pant Crotch Depth", values: ["10", "11", "12"] }]. The customer picks one value of
     *  each; it is added to the size text as "Pant Crotch Depth: 11" (checked by Operations.gs). */
    var ownMeasures = cleanProductMeasures(entry.measures);
    if (ownMeasures.length) normalized.measures = ownMeasures;
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
    // WooCommerce-style variations (Product Manager "Variations" tab): own price/sale/SKU/photo/on-off.
    var variations = cleanVariations(entry.variations);
    if (variations.length) normalized.variations = variations;
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
    if (entry.status === "draft" || entry.status === "trash" || entry.status === "pending") normalized.status = entry.status;
    copyWooFields(normalized, entry);
    if (entry.featured === true) normalized.featured = true;
    if (Array.isArray(entry.tags) && entry.tags.length) {
      normalized.tags = entry.tags.map(function (t) { return String(t || "").trim(); }).filter(Boolean);
    }
    if (entry.brand) normalized.brand = String(entry.brand);
    if (entry.dateAdded) normalized.dateAdded = String(entry.dateAdded);
    if (entry.seoTitle) normalized.seoTitle = String(entry.seoTitle);
    if (entry.seoDescription) normalized.seoDescription = String(entry.seoDescription);

    applySaleSchedule(normalized, entry, Date.now());

    normalized.productUrl = resolveProductPageLink(normalized);
    return normalized;
  }

  /**
   * WooCommerce-style "Schedule" for sale prices: saleFrom / saleTo are dates (YYYY-MM-DD, Bangladesh time).
   * The sale starts at 00:00 on saleFrom and ends after 23:59 on saleTo; either may be empty.
   * Returns {from, to} in milliseconds (null = open), or null when the product has no schedule.
   */
  function saleWindow(entry) {
    var day = function (s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim()) ? String(s).trim() : ""; };
    var from = day(entry && entry.saleFrom), to = day(entry && entry.saleTo);
    if (!from && !to) return null;
    return {
      from: from ? Date.parse(from + "T00:00:00+06:00") : null,
      to: to ? Date.parse(to + "T23:59:59.999+06:00") : null
    };
  }
  function saleWindowOpen(w, now) {
    return !w || ((w.from == null || now >= w.from) && (w.to == null || now <= w.to));
  }
  /**
   * Keeps the scheduled sale prices in normalized._saleRaw (catalog-validation.json sends them to the
   * order server, which decides at order time) and, outside the dates, shows the regular prices instead:
   * price ← regularPrice, priceByType ← regularPriceByType, variation price ← its regularPrice.
   */
  function applySaleSchedule(normalized, entry, now) {
    var w = saleWindow(entry);
    var vOwn = (normalized.variations || []).some(function (v) { return v.saleFrom || v.saleTo; });
    if (!w && !vOwn) return;
    if (w) {
      normalized.saleFrom = String(entry.saleFrom || "").trim();
      normalized.saleTo = String(entry.saleTo || "").trim();
    }
    if (normalized.priceByType) normalized.priceByType = Object.assign({}, normalized.priceByType);
    normalized._saleRaw = {
      from: w ? w.from : null, to: w ? w.to : null, price: normalized.price, regularPrice: normalized.regularPrice || null,
      priceByType: normalized.priceByType ? Object.assign({}, normalized.priceByType) : null,
      regularPriceByType: normalized.regularPriceByType ? Object.assign({}, normalized.regularPriceByType) : null,
      variations: normalized.variations ? normalized.variations.map(function (v) { return Object.assign({}, v); }) : null
    };
    if (w && !saleWindowOpen(w, now)) {
      if (normalized.regularPrice > normalized.price) normalized.price = normalized.regularPrice;
      delete normalized.regularPrice;
      var regs = normalized.regularPriceByType;
      if (normalized.priceByType && regs) {
        Object.keys(normalized.priceByType).forEach(function (t) {
          var r = parseInt(regs[t], 10);
          if (r > parseInt(normalized.priceByType[t], 10)) normalized.priceByType[t] = r;
        });
      }
      delete normalized.regularPriceByType;
    }
    if (normalized.variations) {
      normalized.variations = normalized.variations.map(function (v) {
        var vw = saleWindow(v) || w;
        if (!vw || saleWindowOpen(vw, now)) return v;
        var row = Object.assign({}, v);
        if (row.regularPrice > (row.price || 0)) row.price = row.regularPrice;
        delete row.regularPrice;
        return row;
      });
    }
  }


  /**
   * WooCommerce fields from Product Manager → Edit product (kept as given; HTML is cleaned again by safeHtml()
   * when shown). Text: sku, gtin, externalUrl, buttonText, purchaseNote, shippingClass, publishDate,
   * postPassword. Flags: virtual, downloadable, soldIndividually, reviewsAllowed=false. Lists of product IDs:
   * upsells, crossSells, groupedProducts; extraCategories = more categories that also list the product.
   */
  function copyWooFields(normalized, entry) {
    ["sku", "gtin", "externalUrl", "buttonText", "purchaseNote", "shippingClass", "publishDate", "postPassword", "shortDescription", "descriptionHtml"].forEach(function (k) {
      if (entry[k] != null && String(entry[k]).trim()) normalized[k] = String(entry[k]).trim();
    });
    ["virtual", "downloadable", "soldIndividually"].forEach(function (k) { if (entry[k] === true) normalized[k] = true; });
    if (entry.reviewsAllowed === false) normalized.reviewsAllowed = false;
    if (entry.visibility === "private" || entry.visibility === "password") normalized.visibility = entry.visibility;
    if (["catalog", "search", "hidden"].indexOf(entry.catalogVisibility) !== -1) normalized.catalogVisibility = entry.catalogVisibility;
    if (["grouped", "external", "variable"].indexOf(entry.productType) !== -1) normalized.productType = entry.productType;
    if (entry.stockStatus === "onbackorder") normalized.stockStatus = "onbackorder";
    if (entry.backorders === "notify" || entry.backorders === "yes") normalized.backorders = entry.backorders;
    ["menuOrder", "weight", "dimLength", "dimWidth", "dimHeight", "lowStockAmount", "downloadLimit", "downloadExpiry"].forEach(function (k) {
      var n = Number(entry[k]);
      if (entry[k] !== "" && entry[k] != null && isFinite(n)) normalized[k] = n;
    });
    ["upsells", "crossSells", "groupedProducts", "extraCategories"].forEach(function (k) {
      if (Array.isArray(entry[k])) {
        var ids = entry[k].map(function (x) { return String(x || "").trim(); }).filter(Boolean);
        if (ids.length) normalized[k] = ids;
      }
    });
    if (Array.isArray(entry.downloads)) {
      var files = entry.downloads.filter(function (d) { return d && /^https?:\/\//i.test(String(d.file || "")); })
        .map(function (d) { return { name: String(d.name || "").trim() || "Download", file: String(d.file).trim() }; });
      if (files.length) normalized.downloads = files;
    }
  }

  /** Product description HTML from the Visual editor, cleaned again before it is shown (allowlist). */
  function safeHtml(html) {
    if (!html) return "";
    var ALLOWED = { P: 1, BR: 1, STRONG: 1, B: 1, EM: 1, I: 1, U: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, H2: 1, H3: 1, H4: 1, H5: 1, H6: 1, PRE: 1, A: 1, HR: 1, IMG: 1, SPAN: 1, DIV: 1, DEL: 1, S: 1 };
    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    if (typeof DOMParser === "undefined") return esc(String(html).replace(/<[^>]*>/g, " "));
    var doc = new DOMParser().parseFromString("<div>" + String(html) + "</div>", "text/html");
    var okUrl = function (u, img) { u = String(u || "").trim(); return /^(https?:)?\/\//i.test(u) || /^\/(?!\/)/.test(u) || (!img && /^(mailto:|tel:|#)/i.test(u)) ? u : ""; };
    var out = doc.createElement("div");
    (function copy(from, to) {
      Array.prototype.forEach.call(from.childNodes, function (n) {
        if (n.nodeType === 3) { to.appendChild(doc.createTextNode(n.nodeValue)); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName.toUpperCase();
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|TEMPLATE|SVG|MATH)$/.test(tag)) return;
        if (!ALLOWED[tag]) { copy(n, to); return; }
        var el = doc.createElement(tag === "B" ? "strong" : tag === "I" ? "em" : tag.toLowerCase());
        var al = (n.getAttribute("style") || "").match(/text-align\s*:\s*(left|center|right|justify)/i);
        if (al) el.setAttribute("style", "text-align:" + al[1].toLowerCase());
        if (tag === "A") { var h = okUrl(n.getAttribute("href")); if (h) el.setAttribute("href", h); if (/^https?:/i.test(h)) { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); } }
        if (tag === "IMG") { var src = okUrl(n.getAttribute("src"), true); if (!src) return; el.setAttribute("src", src); el.setAttribute("alt", String(n.getAttribute("alt") || "").slice(0, 200)); el.setAttribute("loading", "lazy"); }
        to.appendChild(el);
        if (tag !== "IMG" && tag !== "BR" && tag !== "HR") copy(n, el);
      });
    })(doc.body.firstChild || doc.body, out);
    return out.innerHTML;
  }

  /** Publish date (Bangladesh time) still in the future = Scheduled: not on the website yet. */
  function isScheduledProduct(product, now) {
    var v = String(product && product.publishDate || "");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return false;
    return Date.parse(v + ":00+06:00") > (now == null ? Date.now() : now);
  }

  /** Draft, Pending, Trash, Private and Scheduled products are kept in the catalog file but never shown or sold. */
  function isPublishedProduct(product) {
    return !!product && product.status !== "draft" && product.status !== "trash" && product.status !== "pending" &&
      product.visibility !== "private" && !isScheduledProduct(product);
  }

  /**
   * WooCommerce "Catalog visibility": where a product is listed. where = "shop" (category pages, home, related)
   * or "search". Hidden products still open from a direct link and can still be ordered.
   */
  function listable(product, where) {
    if (!product || product.isImageView === true) return false;
    var v = product.catalogVisibility;
    if (v === "hidden") return false;
    if (where === "search") return v !== "catalog";
    return v !== "search";
  }

  /** Storefront view of one category: published products only, featured ones first (stable order). */
  function storefrontList(list) {
    var out = (list || []).filter(function (product) {
      return isPublishedProduct(product) && product.isImageView !== true;
    });
    // Featured first, then "Menu order" (Advanced tab; lower first), then the saved order.
    if (!out.some(function (p) { return p.featured === true || p.menuOrder; })) return out;
    return out.map(function (p, i) { return { p: p, i: i }; })
      .sort(function (a, b) { return ((b.p.featured === true) - (a.p.featured === true)) || ((a.p.menuOrder || 0) - (b.p.menuOrder || 0)) || (a.i - b.i); })
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
    // Product categories ticked besides the main one: list the product there too (marked _extraCategory;
    // the product page, order check and sitemap use the main entry).
    Object.keys(out).forEach(function (key) {
      out[key].forEach(function (p) {
        if (p._extraCategory || !Array.isArray(p.extraCategories)) return;
        p.extraCategories.forEach(function (extra) {
          if (extra === key || !out[extra] || out[extra].some(function (q) { return String(q.id) === String(p.id); })) return;
          var copy = Object.assign({}, p, { _extraCategory: true, _primaryCategory: key });
          out[extra].push(copy);
        });
      });
    });
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

  /** Shorter stock rows for a multi-part size ("Length 50" for "Body 46 · Length 50"), longest first.
   *  Same as Code.gs stockSizePartCandidates_: Product Manager variations can count stock per part. */
  function stockSizePartCandidates(color, size) {
    var parts = String(size || "").replace(/\s+/g, " ").trim().split(/\s*\u00b7\s*/).filter(Boolean);
    if (parts.length < 2 || parts.length > 5) return [];
    var subsets = [];
    for (var mask = (1 << parts.length) - 2; mask > 0; mask--) {
      subsets.push(parts.filter(function (_, i) { return mask & (1 << i); }));
    }
    subsets.sort(function (a, b) { return b.length - a.length; });
    var out = [];
    subsets.forEach(function (pick) {
      var joined = pick.join(" \u00b7 ");
      out.push(colorSizeStockVariant(color, joined), joined);
    });
    return out.filter(Boolean);
  }

  /**
   * Which stock row a choice uses, in the order the order check uses (Apps Script cartItemStockCandidates_):
   * "Colour · Size", then the size, then shorter parts of the size (stockSizePartCandidates), then the
   * colour, then the product's "all sizes" pool (_default).
   * variant is the size (or the colour when there is no size), as before. Returns the row's key, or "".
   */
  function stockRowKey(product, variant, color) {
    var variants = product && product.stockVariants && typeof product.stockVariants === "object"
      ? product.stockVariants
      : null;
    if (!variants || !String(variant || "").trim()) return "";
    var keys = Object.keys(variants);
    var wanted = [colorSizeStockVariant(color, variant), variant].concat(stockSizePartCandidates(color, variant), [color]).map(stockVariantKey).filter(Boolean);
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

  /** On backorder (Inventory tab): can be ordered while the catalog quantity is 0 (not for sheet-tracked stock). */
  function onBackorder(product) {
    if (!product || product.inStock === false || hasTrackedStockVariants(product)) return false;
    return product.stockStatus === "onbackorder" || ((product.backorders === "yes" || product.backorders === "notify") && product.stock != null && product.stock !== "" && !(parseInt(product.stock, 10) > 0));
  }

  function isInStock(product, variant, color) {
    if (onBackorder(product)) return true;
    var qty = getStockQty(product, variant, color);
    if (qty === null) return true;
    return qty > 0;
  }

  function getStockStatus(product, variant, color) {
    var inStock = isInStock(product, variant, color);
    var qty = getStockQty(product, variant, color);
    // No stock count entered (and not marked out of stock): shown as "In Stock" everywhere, the same
    // as the homepage always showed (owner's choice, 2026-10-23).
    if (onBackorder(product)) {
      return { inStock: true, qty: qty, backorder: true, label: "Available on backorder", badge: "Backorder", buttonLabel: "Add to Cart" };
    }
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

  /* ---------- Delivery charge (Product Manager → Store settings; SITE_LINKS.delivery in product-config.js) ----
   * One rule for the cart, both checkouts and the order server (which reads the same file through
   * catalog-validation.json): Dhaka district = dhaka, every other district = outside, free from freeQty pieces
   * (0 = never free). Defaults: 80 / 150 / 3. */
  var DELIVERY_DEFAULTS = { dhaka: 80, outside: 150, freeQty: 3 };
  function deliverySettings() {
    var d = (g.SITE_LINKS && g.SITE_LINKS.delivery) || {};
    var num = function (v, def, max) { var n = parseInt(v, 10); return isFinite(n) && n >= 0 && n <= max ? n : def; };
    return {
      dhaka: num(d.dhaka, DELIVERY_DEFAULTS.dhaka, 5000),
      outside: num(d.outside, DELIVERY_DEFAULTS.outside, 5000),
      freeQty: num(d.freeQty, DELIVERY_DEFAULTS.freeQty, 99)
    };
  }
  /** Delivery charge for a district (Bangla name, e.g. "ঢাকা") and number of pieces; null when no district. */
  function deliveryFee(districtBn, qty) {
    if (!districtBn) return null;
    var s = deliverySettings();
    if (s.freeQty > 0 && (parseInt(qty, 10) || 0) >= s.freeQty) return 0;
    return String(districtBn).trim() === "ঢাকা" ? s.dhaka : s.outside;
  }
  /** "ঢাকা ৳80 · ঢাকার বাইরে ৳150 · 3টি বা বেশি পণ্যে ফ্রি ডেলিভারি" */
  function deliveryHintBn() {
    var s = deliverySettings();
    return "ঢাকা \u09F3" + s.dhaka + " · ঢাকার বাইরে \u09F3" + s.outside + (s.freeQty > 0 ? " · " + s.freeQty + "টি বা বেশি পণ্যে ফ্রি ডেলিভারি" : "");
  }
  g.maDelivery = { settings: deliverySettings, fee: deliveryFee, hintBn: deliveryHintBn, defaults: DELIVERY_DEFAULTS };

  /* ---------- Site search (header search box, /category?q=…, /category?tag=…) ---------- */
  // Bangla and common spellings → one word, applied to the query and to the product text alike, so
  // "টু পিস", "2 piece" and "two-piece" find the same products, "পাঞ্জাবি" finds "পাঞ্জাবী", "burka" finds "borka".
  var SEARCH_SYNONYMS = [
    [/(?:^| )(?:two piece|2 piece|২ পিস|টু পিস|টুপিস|co ord|coord)(?= |$)/g, " twopiece "],
    [/(?:^| )(?:three piece|3 piece|৩ পিস|থ্রি পিস|থ্রিপিস)(?= |$)/g, " threepiece "],
    [/(?:^| )(?:বোরকা|বোরখা|বুরকা|বুরখা|borka|borkha|burka|burkha|burqa|burqah|burqa)(?= |$)/g, " borka "],
    [/(?:^| )(?:আবায়া|আবায়া|এবায়া|abaya|abayas)(?= |$)/g, " abaya "],
    [/(?:^| )(?:পাঞ্জাবি|পাঞ্জাবী|panjabi|punjabi)(?= |$)/g, " panjabi "],
    [/(?:^| )(?:হিজাব|hijab|hijabs)(?= |$)/g, " hijab "],
    [/(?:^| )(?:খিমার|khimar)(?= |$)/g, " khimar "],
    [/(?:^| )(?:নিকাব|নেকাব|niqab|nikab)(?= |$)/g, " niqab "],
    [/(?:^| )(?:কুর্তি|কুর্তী|kurti|kurtis)(?= |$)/g, " kurti "],
    [/(?:^| )(?:টপস|tops)(?= |$)/g, " tops "],
    [/(?:^| )(?:কাফতান|kaftan|caftan)(?= |$)/g, " kaftan "],
    [/(?:^| )(?:কারচুপি|karchupi)(?= |$)/g, " karchupi "],
    [/(?:^| )(?:এম্ব্রয়ডারি|এমব্রয়ডারি|এম্ব্রয়ডারি|embroidery|embroidered)(?= |$)/g, " embroidery "],
    [/(?:^| )(?:কভার আপ|cover up|coverup)(?= |$)/g, " coverup "]
  ];
  // Words people use for the same thing: searching one also finds products that use the other.
  var SEARCH_ALSO = { borka: ["abaya"], abaya: ["borka"], hijab: ["khimar"], khimar: ["hijab"], kurti: ["tops"], tops: ["kurti"] };
  function baseSearchText(v) {
    return String(v == null ? "" : v).normalize("NFC").toLowerCase().replace(/[\s\-_/.,()+·|]+/g, " ").trim();
  }
  function escapeRe(x) { return x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  // Owner's own word groups (Product Manager → Store settings → Search words), e.g. "বোরকা, borka, burqa":
  // every word in a group finds the same products. Built once per settings change.
  var customRulesKey = null, customRules = [];
  function customSearchRules() {
    var groups = (g.SITE_LINKS && Array.isArray(g.SITE_LINKS.searchWords)) ? g.SITE_LINKS.searchWords : [];
    var key = JSON.stringify(groups);
    if (key === customRulesKey) return customRules;
    customRulesKey = key; customRules = [];
    groups.forEach(function (group, i) {
      var words = (Array.isArray(group) ? group : String(group || "").split(/[,，;]/)).map(baseSearchText).filter(Boolean);
      if (words.length < 2) return;
      var token = "sw" + i + "x";
      customRules.push([new RegExp("(?:^| )(?:" + words.sort(function (a, b) { return b.length - a.length; }).map(escapeRe).join("|") + ")(?= |$)", "g"), " " + token + " "]);
    });
    return customRules;
  }
  function searchText(v) {
    var t = " " + baseSearchText(v) + " ";
    // Run each rule twice: neighbouring matches share the space between them.
    customSearchRules().concat(SEARCH_SYNONYMS).forEach(function (r) { t = t.replace(r[0], r[1]).replace(r[0], r[1]); });
    return t.replace(/\s+/g, " ").trim();
  }
  function searchTerms(q) {
    return searchText(q).split(" ").filter(function (t) { return t.length > 0; });
  }
  function termFound(hay, t) {
    return hay.indexOf(t) !== -1 || (SEARCH_ALSO[t] || []).some(function (a) { return hay.indexOf(" " + a + " ") !== -1; });
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
    if (!terms.length || !p || !listable(p, "search")) return false;
    var hay = " " + productSearchText(p, key, meta) + " ";
    return terms.every(function (t) { return termFound(hay, t); });
  }
  /** Ranking for search results: 3 = the whole category matches, 2 = the name matches, 1 = only tags/other text. */
  function searchRank(p, key, meta, q) {
    if (categoryMatches(key, meta, q)) return 3;
    var name = " " + searchText([p && p.name, p && p.id].join(" ")) + " ";
    return searchTerms(q).every(function (t) { return termFound(name, t); }) ? 2 : 1;
  }
  function categoryMatches(key, meta, q) {
    var t = searchText(q);
    if (!t || t.indexOf(" ") !== -1) return false;
    var words = categoryLabelText(key, meta).split(" ");
    return words.indexOf(t) !== -1 || (SEARCH_ALSO[t] || []).some(function (a) { return words.indexOf(a) !== -1; });
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
        out.push({ p: p, rank: searchRank(p, key, meta, q), i: out.length });
      });
    });
    // Best matches first (category, then name, then tags); same rank keeps the shop order.
    return out.sort(function (a, b) { return b.rank - a.rank || a.i - b.i; }).map(function (x) { return x.p; });
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
    searchRank: searchRank,
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
    saleCss.textContent = ".ma-price-was{color:#666b74;font-weight:400;text-decoration:line-through;margin-right:4px;font-size:.86em}" +
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
    cleanVariations: cleanVariations,
    saleWindow: saleWindow,
    listable: listable,
    isScheduledProduct: isScheduledProduct,
    onBackorder: onBackorder,
    safeHtml: safeHtml,
    saleWindowOpen: saleWindowOpen,
    applySaleSchedule: applySaleSchedule,
    variationFor: variationFor,
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
