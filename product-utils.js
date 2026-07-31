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

  function resolveImageUrl(raw) {
    var url = String(raw || "").trim();
    if (!url) return "";
    url = applyReplaceRules(url);

    if (/^https?:\/\//i.test(url) || url.indexOf("data:") === 0) {
      return url;
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
      if (raw.category == null) raw.category = categoryKey || "";
      if (!raw.categoryLabel) raw.categoryLabel = categoryLabelForKey(categoryKey);
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
      link: entry.link || entry.productUrl || entry.page || "",
      category: entry.category || categoryKey || "",
      categoryLabel: entry.categoryLabel || categoryLabelForKey(categoryKey),
      _catalogNormalized: true
    };

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

    normalized.productUrl = resolveProductPageLink(normalized);
    return normalized;
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

  function normalizeAll(categories, linkLists, options) {
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

  function getTwoPieceSizeConfig(product) {
    var tp =
      g.SITE_LINKS &&
      g.SITE_LINKS.defaults &&
      g.SITE_LINKS.defaults.byCategory &&
      g.SITE_LINKS.defaults.byCategory["premium-two-piece"];
    var p = product || {};
    return {
      bodySizeLabel: p.bodySizeLabel || (tp && tp.bodySizeLabel) || "42 (Free size)",
      bodySizes:
        (Array.isArray(p.bodySizes) && p.bodySizes.length && p.bodySizes.slice()) ||
        (tp && tp.bodySizes && tp.bodySizes.slice()) ||
        null,
      lengthSizeLabel: p.lengthSizeLabel || (tp && tp.lengthSizeLabel) || "37-38 inch",
      lengthSizes:
        (Array.isArray(p.lengthSizes) && p.lengthSizes.length && p.lengthSizes.slice()) ||
        (tp && tp.lengthSizes && tp.lengthSizes.slice()) ||
        ["37-38 inch"]
    };
  }

  function isTwoPieceProduct(p, categoryKey) {
    var ck = String(categoryKey || (p && (p.category || "")) || "").trim();
    if (ck === "premium-two-piece") return true;

    var id = String((p && p.id) || "").trim();
    if (/^DR-\d+/i.test(id)) return true;

  // সঠিক কোড:
  var name = String((p && p.name) || "").toLowerCase();

    if (
      name.includes("two piece") ||
      name.includes("two-piece") ||
      name.includes("co-ord") ||
      name.includes("coord")
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
      .replace(/\s*\(Body\s+[^)]+\)\s*$/i, "")
      .replace(/\s*\(Size\s+[^)]+\)\s*$/i, "")
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
  g.formatFabricLabelEn = formatFabricLabelEn;
  g.maCatalog = {
    resolveImageUrl: resolveImageUrl,
    resolveProductPageLink: resolveProductPageLink,
    hasExplicitProductLink: hasExplicitProductLink,
    normalizeProductEntry: normalizeProductEntry,
    normalizeAll: normalizeAll,
    categoryHasProducts: categoryHasProducts,
    titleFromFileName: titleFromFileName
  };
})(window);
