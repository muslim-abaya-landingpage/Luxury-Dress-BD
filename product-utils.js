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
      sizes: defs.sizes ? defs.sizes.slice() : ["বডি ৪২ (ফ্রি সাইজ)"]
    };
    var cat = defs.byCategory && defs.byCategory[categoryKey];
    if (!cat) return base;
    var out = {
      price: cat.price != null ? cat.price : base.price,
      fabric: cat.fabric || base.fabric,
      sizes: cat.sizes ? cat.sizes.slice() : base.sizes
    };
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

  function normalizeProductEntry(raw, categoryKey, index) {
    if (raw && raw._catalogNormalized) {
      return raw;
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
    var normalized = {
      id: entry.id || categoryKey + "-" + (index + 1),
      name: entry.name || titleFromFileName(fileNameFromUrl(imageSrc)),
      image: resolveImageUrl(imageSrc),
      price: parseInt(entry.price, 10) || defs.price || 550,
      fabric: entry.fabric || defs.fabric || "",
      sizes: Array.isArray(entry.sizes) && entry.sizes.length ? entry.sizes.slice() : defs.sizes,
      color: entry.color || "",
      colorLabel: entry.colorLabel || "",
      detailNote: entry.detailNote || "",
      link: entry.link || entry.productUrl || entry.page || "",
      _catalogNormalized: true
    };

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
        } else {
          result[key].push(normalizeProductEntry(url, key, i));
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
      var start = result[key].length;
      linkExtras[key].forEach(function (url, i) {
        if (!url) return;
        result[key].push(normalizeProductEntry(url, key, start + i));
      });
    });

    return result;
  }

  g.maCatalog = {
    resolveImageUrl: resolveImageUrl,
    resolveProductPageLink: resolveProductPageLink,
    hasExplicitProductLink: hasExplicitProductLink,
    normalizeProductEntry: normalizeProductEntry,
    normalizeAll: normalizeAll,
    titleFromFileName: titleFromFileName
  };
})(window);
