(function () {
  var ROW_CIRCLES = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];

  var mountLayout = document.getElementById("pmLayout");
  var catListEl = document.getElementById("pmCatList");
  var mainEl = document.getElementById("pmMain");
  if (!mountLayout || !catListEl || !mainEl) return;

  var sections = [];
  var products = {};
  var activeKey = "";
  var categoryTypePrices = {};

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function cloneJson(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadState() {
    sections = cloneJson(window.CATALOG_SECTIONS || []);
    products = cloneJson(window.CATEGORY_PRODUCTS || {});
    sections.forEach(function (sec) {
      if (!Array.isArray(products[sec.key])) products[sec.key] = [];
    });
    if (!activeKey && sections[0]) activeKey = sections[0].key;
    loadCategoryTypePrices();
  }

  function getCategoryTypeMeta(catKey) {
    var cat =
      window.SITE_LINKS &&
      window.SITE_LINKS.defaults &&
      window.SITE_LINKS.defaults.byCategory &&
      window.SITE_LINKS.defaults.byCategory[catKey];
    if (!cat || !Array.isArray(cat.types) || cat.types.length < 2) return null;
    return {
      types: cat.types.slice(),
      priceByType: cat.priceByType ? cloneJson(cat.priceByType) : {},
      typePriceGap: cat.typePriceGap || 200
    };
  }

  function loadCategoryTypePrices() {
    categoryTypePrices = {};
    sections.forEach(function (sec) {
      var meta = getCategoryTypeMeta(sec.key);
      if (meta) categoryTypePrices[sec.key] = cloneJson(meta.priceByType);
    });
  }

  function ensureProductPriceByType(p, catKey) {
    var meta = getCategoryTypeMeta(catKey);
    if (!meta) return;
    if (!p.priceByType || typeof p.priceByType !== "object") {
      p.priceByType = cloneJson(categoryTypePrices[catKey] || meta.priceByType);
    }
  }

  function applyTypePricesToAllProducts(catKey) {
    var map = categoryTypePrices[catKey];
    if (!map) return;
    (products[catKey] || []).forEach(function (p) {
      p.priceByType = cloneJson(map);
      var full = map["Full Set"];
      if (full != null) p.price = parseInt(full, 10) || p.price;
    });
    toast("এই ক্যাটাগরির সব প্রোডাক্টে Type দাম লাগানো হয়েছে");
    renderMain();
  }

  function defaultProduct(sec) {
    var defs =
      window.SITE_LINKS &&
      window.SITE_LINKS.defaults &&
      window.SITE_LINKS.defaults.byCategory &&
      window.SITE_LINKS.defaults.byCategory[sec.key];
    var global = (window.SITE_LINKS && window.SITE_LINKS.defaults) || {};
    var n = (products[sec.key] || []).length + 1;
    var priceByType = categoryTypePrices[sec.key]
      ? cloneJson(categoryTypePrices[sec.key])
      : defs && defs.priceByType
        ? cloneJson(defs.priceByType)
        : null;
    var basePrice = (defs && defs.price) || global.price || 550;
    if (priceByType && priceByType["Full Set"] != null) {
      basePrice = parseInt(priceByType["Full Set"], 10) || basePrice;
    }
    return {
      id: (sec.key.toUpperCase().replace(/-/g, "") || "CAT") + "-NEW-" + n,
      name: "New Product " + n,
      image: "images/Baby-Pink-Floral-Print.jpeg",
      link: "index.html",
      price: basePrice,
      color: "",
      colorLabel: "",
      fabric: (defs && defs.fabric) || global.fabric || "",
      sizes: (defs && defs.sizes && defs.sizes.slice()) || ["Free Size"],
      priceByType: priceByType
    };
  }

  function toast(msg) {
    var el = document.getElementById("pmToast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(function () {
      el.classList.remove("show");
    }, 4000);
  }

  function jsStr(s) {
    return (
      '"' +
      String(s == null ? "" : s)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\r/g, "")
        .replace(/\n/g, "\\n") +
      '"'
    );
  }

  function jsKey(k) {
    return /^[a-zA-Z_$][\w$-]*$/.test(k) ? k : '"' + k + '"';
  }

  function sizesToInput(sizes) {
    if (Array.isArray(sizes)) return sizes.join(", ");
    return String(sizes || "");
  }

  function inputToSizes(text) {
    return String(text || "")
      .split(/[,，]/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function renderCatList() {
    catListEl.innerHTML = "";
    sections.forEach(function (sec, idx) {
      var li = document.createElement("li");
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pm-cat-btn" + (sec.key === activeKey ? " is-active" : "");
      var count = (products[sec.key] || []).length;
      btn.innerHTML =
        (sec.row || ROW_CIRCLES[idx] || idx + 1) +
        " " +
        (sec.menuBn || sec.menu) +
        "<small>" +
        count +
        " প্রোডাক্ট · " +
        sec.page +
        "</small>";
      btn.addEventListener("click", function () {
        activeKey = sec.key;
        renderCatList();
        renderMain();
      });
      li.appendChild(btn);
      catListEl.appendChild(li);
    });
  }

  function getActiveSection() {
    return sections.find(function (s) {
      return s.key === activeKey;
    });
  }

  function renderMain() {
    var sec = getActiveSection();
    if (!sec) {
      mainEl.innerHTML = '<p class="pm-empty">বাম থেকে ক্যাটাগরি বেছে নিন</p>';
      return;
    }

    var list = products[sec.key] || [];
    mainEl.innerHTML =
      '<div class="pm-cat-head">' +
      "<div><h2>" +
      (sec.row || "") +
      " " +
      (sec.menuBn || "") +
      " · " +
      sec.menu +
      "</h2>" +
      '<p class="pl-section-meta">পেজ: <code>' +
      sec.page +
      "</code> · URL: <code>" +
      (sec.path || "/" + sec.key) +
      '</code></p><div class="pm-links-row">' +
      '<a href="' +
      sec.page +
      '" target="_blank" rel="noopener">পেজ দেখুন →</a>' +
      '<a href="product-links.html">ছবির লিংক এডিটর →</a>' +
      "</div></div>" +
      '<div><button type="button" class="pl-btn pl-btn-secondary" id="pmAddProduct">+ প্রোডাক্ট যোগ</button> ' +
      '<button type="button" class="pl-btn pl-btn-secondary" id="pmEditCat">ক্যাটাগরি এডিট</button></div></div>' +
      buildCategoryTypePricePanel(sec.key) +
      '<div class="pm-product-list" id="pmProductList"></div>';

    bindCategoryTypePricePanel(sec.key);

    var listEl = document.getElementById("pmProductList");
    if (!list.length) {
      listEl.innerHTML =
        '<p class="pm-empty">এখনো প্রোডাক্ট নেই — 「+ প্রোডাক্ট যোগ」 চাপুন</p>';
    } else {
      list.forEach(function (p, idx) {
        listEl.appendChild(buildProductCard(sec.key, p, idx));
      });
    }

    document.getElementById("pmAddProduct").addEventListener("click", function () {
      list.push(defaultProduct(sec));
      products[sec.key] = list;
      renderCatList();
      renderMain();
    });

    document.getElementById("pmEditCat").addEventListener("click", function () {
      openCategoryModal(sec);
    });
  }

  function buildCategoryTypePricePanel(catKey) {
    var meta = getCategoryTypeMeta(catKey);
    if (!meta) return "";
    var map = categoryTypePrices[catKey] || meta.priceByType || {};
    var fields = meta.types
      .map(function (typeName) {
        var safeKey = typeName.replace(/"/g, "&quot;");
        return (
          '<div class="pm-field"><label>' +
          escapeHtml(typeName) +
          ' (৳)</label><input type="number" data-cat-type-price="' +
          safeKey +
          '" value="' +
          (map[typeName] != null ? map[typeName] : "") +
          '"></div>'
        );
      })
      .join("");
    return (
      '<section class="pm-type-price-banner" id="pmTypePriceBanner">' +
      "<h3>এই ক্যাটাগরির Type দাম (সব প্রোডাক্টে লাগে)</h3>" +
      '<p class="pm-type-hint">যেমন আবায়া: Full Set ৯৯৯, Abaya Only ৭৯৯ — এখানে বদলালে এক ক্লিকে সব প্রোডাক্টে দেওয়া যায়।</p>' +
      '<div class="pm-product-body pm-type-price-grid">' +
      fields +
      "</div>" +
      '<button type="button" class="pl-btn pl-btn-secondary" id="pmApplyTypePrices">সব প্রোডাক্টে এই দাম লাগান</button>' +
      "</section>"
    );
  }

  function bindCategoryTypePricePanel(catKey) {
    var banner = document.getElementById("pmTypePriceBanner");
    if (!banner) return;
    var meta = getCategoryTypeMeta(catKey);
    if (!meta) return;
    if (!categoryTypePrices[catKey]) categoryTypePrices[catKey] = {};

    banner.querySelectorAll("[data-cat-type-price]").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var typeName = inp.getAttribute("data-cat-type-price");
        categoryTypePrices[catKey][typeName] = parseInt(inp.value, 10) || 0;
      });
    });

    var applyBtn = document.getElementById("pmApplyTypePrices");
    if (applyBtn) {
      applyBtn.addEventListener("click", function () {
        applyTypePricesToAllProducts(catKey);
      });
    }
  }

  function buildTypePriceFields(catKey, p) {
    var meta = getCategoryTypeMeta(catKey);
    if (!meta) return "";
    ensureProductPriceByType(p, catKey);
    return meta.types
      .map(function (typeName) {
        var val = (p.priceByType && p.priceByType[typeName]) || "";
        return field("typePrice:" + typeName, typeName + " (৳)", val, "number");
      })
      .join("");
  }

  function buildProductCard(catKey, p, idx) {
    ensureProductPriceByType(p, catKey);
    var card = document.createElement("article");
    card.className = "pm-product-card";
    var meta = getCategoryTypeMeta(catKey);
    var priceLabel = meta ? "বেস দাম (৳) — সাধারণত Full Set" : "দাম (৳)";
    card.innerHTML =
      '<div class="pm-product-head"><strong>#' +
      (idx + 1) +
      " — " +
      escapeHtml(p.name || "Product") +
      '</strong><button type="button" class="pl-btn pl-btn-secondary pm-del" style="padding:4px 10px;font-size:12px">মুছুন</button></div>' +
      '<div class="pm-product-body">' +
      field("name", "নাম", p.name) +
      buildTypePriceFields(catKey, p) +
      field("price", priceLabel, p.price, "number") +
      field("fabric", "ফ্যাব্রিক", p.fabric) +
      field("colorLabel", "রঙ (দেখানো)", p.colorLabel) +
      field("color", "রঙ কোড (black/maroon)", p.color) +
      field("sizes", "সাইজ (কমা দিয়ে)", sizesToInput(p.sizes)) +
      field("id", "SKU / ID", p.id) +
      fieldWide("image", "ছবির URL", p.image) +
      "</div>";

    card.querySelectorAll("[data-f]").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var f = inp.getAttribute("data-f");
        if (f === "price") p.price = parseInt(inp.value, 10) || 0;
        else if (f && f.indexOf("typePrice:") === 0) {
          var typeName = f.slice("typePrice:".length);
          if (!p.priceByType) p.priceByType = {};
          p.priceByType[typeName] = parseInt(inp.value, 10) || 0;
        } else if (f === "sizes") p.sizes = inputToSizes(inp.value);
        else p[f] = inp.value;
        var strong = card.querySelector(".pm-product-head strong");
        if (strong) strong.textContent = "#" + (idx + 1) + " — " + (p.name || "Product");
        renderCatList();
      });
    });

    card.querySelector(".pm-del").addEventListener("click", function () {
      if (!confirm("এই প্রোডাক্ট মুছবেন?")) return;
      products[catKey].splice(idx, 1);
      renderCatList();
      renderMain();
    });

    return card;
  }

  function field(name, label, value, type) {
    return (
      '<div class="pm-field"><label>' +
      label +
      '</label><input type="' +
      (type || "text") +
      '" data-f="' +
      name +
      '" value="' +
      escapeAttr(value) +
      '"></div>'
    );
  }

  function fieldWide(name, label, value) {
    return (
      '<div class="pm-field pm-field-wide"><label>' +
      label +
      '</label><input type="text" data-f="' +
      name +
      '" value="' +
      escapeAttr(value) +
      '"></div>'
    );
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function openCategoryModal(secOrNull) {
    var modal = document.getElementById("pmCatModal");
    var isNew = !secOrNull;
    var sec = secOrNull || {
      key: "",
      menu: "",
      menuBn: "",
      page: "",
      path: ""
    };
    modal.hidden = false;
    document.getElementById("pmCatModalTitle").textContent = isNew
      ? "নতুন ক্যাটাগরি"
      : "ক্যাটাগরি এডিট";
    document.getElementById("pmCatKey").value = sec.key;
    document.getElementById("pmCatKey").disabled = !isNew;
    document.getElementById("pmCatMenu").value = sec.menu || "";
    document.getElementById("pmCatMenuBn").value = sec.menuBn || "";
    document.getElementById("pmCatPage").value = sec.page || "";
    document.getElementById("pmCatPath").value = sec.path || "";

    document.getElementById("pmCatMenu").oninput = document.getElementById(
      "pmCatMenuBn"
    ).oninput = function () {
      if (isNew) {
        var slug = slugify(document.getElementById("pmCatMenu").value);
        if (slug) {
          document.getElementById("pmCatKey").value = slug;
          document.getElementById("pmCatPage").value = slug + ".html";
          document.getElementById("pmCatPath").value = "/" + slug;
        }
      }
    };

    document.getElementById("pmCatSave").onclick = function () {
      var key = document.getElementById("pmCatKey").value.trim();
      var menu = document.getElementById("pmCatMenu").value.trim();
      var menuBn = document.getElementById("pmCatMenuBn").value.trim();
      var page = document.getElementById("pmCatPage").value.trim();
      var path = document.getElementById("pmCatPath").value.trim();
      if (!key || !menu) {
        toast("Key ও মেনু নাম দিন");
        return;
      }
      if (!page) page = key + ".html";
      if (!path) path = "/" + key;
      if (!menuBn) menuBn = menu;

      var row = ROW_CIRCLES[sections.length] || String(sections.length + 1);
      var entry = { key: key, row: row, menu: menu, menuBn: menuBn, page: page, path: path };

      if (isNew) {
        if (sections.some(function (s) {
          return s.key === key;
        })) {
          toast("এই key আগে থেকেই আছে");
          return;
        }
        sections.push(entry);
        products[key] = [];
        activeKey = key;
      } else {
        var i = sections.findIndex(function (s) {
          return s.key === sec.key;
        });
        if (i >= 0) {
          var oldKey = sections[i].key;
          sections[i] = entry;
          if (oldKey !== key && products[oldKey]) {
            products[key] = products[oldKey];
            delete products[oldKey];
          }
          activeKey = key;
        }
      }
      modal.hidden = true;
      renderCatList();
      renderMain();
      toast(isNew ? "ক্যাটাগরি যোগ হয়েছে — সেভ করুন" : "আপডেট হয়েছে — সেভ করুন");
    };
  }

  function productToJsLines(p, indent) {
    var ind = indent || "    ";
    var lines = [ind + "{"];
    var order = ["id", "name", "image", "link", "price", "color", "colorLabel", "fabric", "sizes", "detailNote", "types"];
    order.forEach(function (k) {
      if (p[k] == null || p[k] === "") return;
      if (k === "sizes" && Array.isArray(p.sizes)) {
        lines.push(ind + "  sizes: [" + p.sizes.map(function (s) {
          return jsStr(s);
        }).join(", ") + "],");
      } else if (k === "types" && Array.isArray(p.types)) {
        lines.push(ind + "  types: [" + p.types.map(function (s) {
          return jsStr(s);
        }).join(", ") + "],");
      } else if (k === "price") {
        lines.push(ind + "  price: " + (parseInt(p.price, 10) || 0) + ",");
      } else {
        lines.push(ind + "  " + k + ": " + jsStr(p[k]) + ",");
      }
    });
    if (p.priceByType && typeof p.priceByType === "object") {
      var keys = Object.keys(p.priceByType);
      if (keys.length) {
        lines.push(ind + "  priceByType: {");
        keys.forEach(function (tk, ti) {
          lines.push(
            ind +
              '    "' +
              tk.replace(/"/g, '\\"') +
              '": ' +
              (parseInt(p.priceByType[tk], 10) || 0) +
              (ti < keys.length - 1 ? "," : "")
          );
        });
        lines.push(ind + "  },");
      }
    }
    if (lines[lines.length - 1].slice(-1) === ",") {
      lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1);
    }
    lines.push(ind + "}");
    return lines;
  }

  function generateSectionsFile() {
    var lines = [
      "/**",
      " * ক্যাটাগরি সারি — মেনু ও HTML পেজ (product-manager.html থেকে আপডেট)",
      " * আপডেট: " + new Date().toISOString().slice(0, 10),
      " */",
      "window.CATALOG_SECTIONS = ["
    ];
    sections.forEach(function (sec, idx) {
      lines.push("  {");
      lines.push("    key: " + jsStr(sec.key) + ",");
      lines.push("    row: " + jsStr(sec.row || ROW_CIRCLES[idx] || "") + ",");
      lines.push("    menu: " + jsStr(sec.menu) + ",");
      lines.push("    menuBn: " + jsStr(sec.menuBn) + ",");
      lines.push("    page: " + jsStr(sec.page) + ",");
      lines.push("    path: " + jsStr(sec.path) + "");
      lines.push("  }" + (idx < sections.length - 1 ? "," : ""));
    });
    lines.push("];");
    lines.push("");
    return lines.join("\n");
  }

  function generateProductsFile() {
    var lines = [
      "/**",
      " * প্রোডাক্ট ডেটা — product-manager.html থেকে এডিট করুন",
      " * আপডেট: " + new Date().toISOString().slice(0, 10),
      " */",
      "window.CATEGORY_PRODUCTS = {"
    ];
    sections.forEach(function (sec, sIdx) {
      var list = products[sec.key] || [];
      lines.push("  " + jsKey(sec.key) + ": [");
      list.forEach(function (p, pIdx) {
        var plines = productToJsLines(p, "    ");
        if (pIdx < list.length - 1) plines[plines.length - 1] += ",";
        lines = lines.concat(plines);
      });
      lines.push("  ]" + (sIdx < sections.length - 1 ? "," : ""));
    });
    lines.push("};");
    lines.push("");
    lines.push("/** @deprecated — product-catalog-sync.js স্বয়ংক্রিয় বানায় */");
    lines.push("window.CATEGORY_META = {};");
    lines.push("window.CATEGORY_NAV = [];");
    lines.push("");
    return lines.join("\n");
  }

  function generateCategoryHtml(sec) {
    var title = (sec.menuBn || sec.menu) + " Collection | Muslim Abaya";
    return (
      '<!DOCTYPE html>\n<html lang="bn">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>' +
      title +
      '</title>\n  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">\n  <link rel="stylesheet" href="site-header.css">\n  <link rel="stylesheet" href="site-footer.css">\n  <link rel="stylesheet" href="shop-page.css?v=1">\n  <link rel="stylesheet" href="category-sidebar.css?v=1" id="category-sidebar-css">\n</head>\n<body data-shop-category="' +
      sec.key +
      '">\n  <div id="site-header-mount"></div>\n  <main class="wrap"><div id="list"></div></main>\n  <div id="site-footer-mount"></div>\n  <script defer src="cart-utils.js"></script>\n  <script defer src="site-header.js"></script>\n  <script defer src="product-catalog-sections.js"></script>\n  <script defer src="product-catalog-sync.js"></script>\n  <script defer src="product-config.js"></script>\n  <script defer src="product-utils.js"></script>\n  <script defer src="category-products.js"></script>\n  <script defer src="product-links-data.js"></script>\n  <script defer src="product-catalog-loader.js"></script>\n  <script defer src="category-renderer.js"></script>\n  <script defer src="site-footer.js"></script>\n  <script defer src="shop-category-boot.js"></script>\n</body>\n</html>\n'
    );
  }

  function generateRedirectsSnippet() {
    var lines = ["# নতুন ক্যাটাগরি — _redirects ফাইলের শপ বিভাগে যোগ করুন:", ""];
    sections.forEach(function (sec) {
      var slug = sec.path.replace(/^\//, "") || sec.key;
      lines.push("/" + slug + "              /" + sec.page + "              200");
    });
    lines.push("");
    lines.push("# .html → clean URL (301):");
    sections.forEach(function (sec) {
      lines.push("/" + sec.page + "              " + sec.path + "              301");
    });
    return lines.join("\n");
  }

  function download(content, filename) {
    var blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function generateProductConfigFile() {
    var cfg = cloneJson(window.SITE_LINKS || {});
    if (!cfg.defaults) cfg.defaults = {};
    if (!cfg.defaults.byCategory) cfg.defaults.byCategory = {};
    Object.keys(categoryTypePrices).forEach(function (catKey) {
      if (!cfg.defaults.byCategory[catKey]) cfg.defaults.byCategory[catKey] = {};
      cfg.defaults.byCategory[catKey].priceByType = cloneJson(categoryTypePrices[catKey]);
      var full = categoryTypePrices[catKey]["Full Set"];
      if (full != null) cfg.defaults.byCategory[catKey].price = parseInt(full, 10);
    });
    var lines = [
      "/**",
      " * সাইট কনফিগ — product-manager.html থেকে আপডেট",
      " * আপডেট: " + new Date().toISOString().slice(0, 10),
      " */",
      "window.SITE_LINKS = " + JSON.stringify(cfg, null, 2) + ";",
      ""
    ];
    return lines.join("\n");
  }

  function saveAll() {
    download(generateSectionsFile(), "product-catalog-sections.js");
    setTimeout(function () {
      download(generateProductsFile(), "category-products.js");
    }, 400);
    if (Object.keys(categoryTypePrices).length) {
      setTimeout(function () {
        download(generateProductConfigFile(), "product-config.js");
      }, 800);
    }

    var newSections = sections.filter(function (sec) {
      var orig = (window.CATALOG_SECTIONS || []).find(function (s) {
        return s.key === sec.key;
      });
      return !orig;
    });
    if (newSections.length) {
      setTimeout(function () {
        newSections.forEach(function (sec, i) {
          setTimeout(function () {
            download(generateCategoryHtml(sec), sec.page);
          }, i * 350);
        });
      }, 800);
      setTimeout(function () {
        download(generateRedirectsSnippet(), "_redirects-new-categories.txt");
      }, 800 + newSections.length * 400);
    }

    toast(
      "ফাইল ডাউনলোড হয়েছে — category-products.js + product-config.js প্রজেক্টে রিপ্লেস করুন" +
        (newSections.length ? " (+ নতুন HTML)" : "")
    );
  }

  document.getElementById("pmSave").addEventListener("click", saveAll);

  document.getElementById("pmReload").addEventListener("click", function () {
    loadState();
    renderCatList();
    renderMain();
    toast("সাইট থেকে আবার লোড হয়েছে");
  });

  document.getElementById("pmAddCategory").addEventListener("click", function () {
    openCategoryModal(null);
  });

  document.getElementById("pmCatModalClose").addEventListener("click", function () {
    document.getElementById("pmCatModal").hidden = true;
  });

  loadState();
  renderCatList();
  renderMain();
})();
