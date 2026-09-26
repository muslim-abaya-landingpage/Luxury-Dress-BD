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
  var searchTerm = "";
  var IMG_MAX_W = 1600;
  var IMG_CARD_MAX_W = 800;
  var IMG_QUALITY = 0.82;
  var IMG_GALLERY_MAX_W = 1600;
  var MAX_GALLERY_IMAGES = 4;

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
    window.CATEGORY_PRODUCTS = products;
    if (typeof window.applyProductLinks === "function") {
      window.applyProductLinks();
      products = cloneJson(window.CATEGORY_PRODUCTS || {});
    }
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
      link: sec.path || "/" + sec.key,
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
    // NOTE: a hyphen is NOT a valid character in a bare JS object key/identifier
    // (e.g. "cover-up", "premium-two-piece", "tops-kurti" MUST be quoted, or the
    // generated file throws "Unexpected token '-'" and the whole category list
    // silently renders empty on the live site). Do not add "-" back into this
    // character class.
    return /^[a-zA-Z_$][\w$]*$/.test(k) ? k : '"' + k + '"';
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
      '</code></p>' +
      '<div class="pm-how-it-works">' +
      "<strong>কীভাবে কাজ করে:</strong> বামে যে ক্যাটাগরি বেছে নিয়েছেন (<em>" +
      escapeHtml(sec.menuBn || sec.menu) +
      "</em>) — প্রোডাক্ট যোগ করলে <strong>সিরিয়াল অনুযায়ী</strong> সেই পেজে + (চালু থাকলে) হোমে দেখাবে। " +
      "খালি ক্যাটাগরিতে কিছু যাবে না। শুধু ছবি, দাম, সাইজ, রঙ লিখুন।" +
      "</div>" +
      '<div class="pm-links-row">' +
      '<a href="' +
      sec.page +
      '" target="_blank" rel="noopener">পেজ দেখুন →</a>' +
      "</div></div>" +
      '<div><button type="button" class="pl-btn pl-btn-secondary" id="pmAddProduct">+ প্রোডাক্ট যোগ</button> ' +
      '<button type="button" class="pl-btn pl-btn-secondary" id="pmEditCat">ক্যাটাগরি এডিট</button></div></div>' +
      buildCategoryTypePricePanel(sec.key) +
      '<div class="pm-search-row"><input type="search" id="pmSearch" placeholder="নাম দিয়ে প্রোডাক্ট খুঁজুন..." value="' +
      escapeAttr(searchTerm) +
      '"><span class="pm-search-count" id="pmSearchCount"></span></div>' +
      '<div class="pm-product-list" id="pmProductList"></div>';

    bindCategoryTypePricePanel(sec.key);

    function applyFilter() {
      var t = searchTerm.trim().toLowerCase();
      if (!t) return list;
      return list.filter(function (p) {
        return String(p.name || "").toLowerCase().indexOf(t) !== -1 ||
          String(p.id || "").toLowerCase().indexOf(t) !== -1;
      });
    }

    function renderList() {
      var filtered = applyFilter();
      var listEl = document.getElementById("pmProductList");
      var countEl = document.getElementById("pmSearchCount");
      var t = searchTerm.trim();
      listEl.innerHTML = "";
      if (!list.length) {
        listEl.innerHTML = '<p class="pm-empty">এখনো প্রোডাক্ট নেই — 「+ প্রোডাক্ট যোগ」 চাপুন</p>';
      } else if (!filtered.length) {
        listEl.innerHTML = '<p class="pm-empty">এই নামে কোনো প্রোডাক্ট পাওয়া যায়নি</p>';
      } else {
        filtered.forEach(function (p) {
          listEl.appendChild(buildProductCard(sec.key, p, list.indexOf(p)));
        });
      }
      if (countEl) countEl.textContent = t ? filtered.length + " / " + list.length + " প্রোডাক্ট" : "";
    }

    renderList();

    document.getElementById("pmSearch").addEventListener("input", function (e) {
      searchTerm = e.target.value;
      renderList();
    });

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
    var outOfStock = p.inStock === false || (typeof p.stock === "number" && p.stock <= 0);
    if (typeof window.isInStock === "function") {
      outOfStock = !window.isInStock(p);
    }
    card.className = "pm-product-card" + (outOfStock ? " pm-product-oos" : "");
    if (outOfStock) {
      card.style.opacity = "0.75";
      card.style.borderLeft = "4px solid #c0392b";
    }
    var meta = getCategoryTypeMeta(catKey);
    var priceLabel = meta ? "বেস দাম (৳) — সাধারণত Full Set" : "দাম (৳)";
    var stockBtnStyle = outOfStock
      ? "padding:4px 10px;font-size:12px;background:#c0392b;color:#fff;border-color:#c0392b"
      : "padding:4px 10px;font-size:12px;background:#2e8b57;color:#fff;border-color:#2e8b57";
    card.innerHTML =
      '<div class="pm-product-head"><strong>#' +
      (idx + 1) +
      " — " +
      escapeHtml(p.name || "Product") +
      '</strong><span style="display:flex;gap:6px">' +
      '<button type="button" class="pl-btn pm-stock-toggle" style="' +
      stockBtnStyle +
      '">' +
      (outOfStock ? "🔴 স্টক নেই — চালু করতে চাপুন" : "🟢 স্টকে আছে — বন্ধ করতে চাপুন") +
      "</button>" +
      '<button type="button" class="pl-btn pl-btn-secondary pm-dup" style="padding:4px 10px;font-size:12px">কপি করুন</button>' +
      '<button type="button" class="pl-btn pl-btn-secondary pm-del" style="padding:4px 10px;font-size:12px">মুছুন</button>' +
      "</span></div>" +
      '<div class="pm-product-body">' +
      buildImageUploader(p) +
      buildGalleryUploader(p) +
      field("name", "নাম", p.name) +
      buildTypePriceFields(catKey, p) +
      field("price", priceLabel, p.price, "number") +
      field("fabric", "ফ্যাব্রিক", p.fabric) +
      field("colorLabel", "রঙ (দেখানো)", p.colorLabel) +
      field("color", "রঙ কোড (black/maroon)", p.color) +
      field("sizes", "সাইজ (কমা দিয়ে)", sizesToInput(p.sizes)) +
      field("id", "SKU / ID", p.id) +
      field("stock", "স্টক (খালি = আনলিমিটেড, 0 = Out of Stock)", p.stock == null ? "" : p.stock, "number") +
      fieldWide("image", "ছবির URL (অটো-পূরণ হয় আপলোড করলে, বা নিজে বসান)", p.image) +
      "</div>";

    card.querySelectorAll("[data-f]").forEach(function (inp) {
      inp.addEventListener("input", function () {
        var f = inp.getAttribute("data-f");
        if (f === "price") p.price = parseInt(inp.value, 10) || 0;
        else if (f === "stock") {
          if (inp.value === "") {
            delete p.stock;
            delete p.inStock;
          } else {
            p.stock = Math.max(0, parseInt(inp.value, 10) || 0);
            if (p.stock === 0) p.inStock = false;
            else delete p.inStock;
          }
        }
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

    card.querySelector(".pm-stock-toggle").addEventListener("click", function () {
      if (p.inStock === false || (typeof p.stock === "number" && p.stock <= 0)) {
        delete p.inStock;
        if (typeof p.stock === "number" && p.stock <= 0) delete p.stock;
      } else {
        p.stock = 0;
        p.inStock = false;
      }
      renderMain();
      toast(
        p.inStock === false || p.stock === 0
          ? (p.name || "প্রোডাক্ট") + " — স্টক নেই করা হয়েছে (Save চাপুন)"
          : (p.name || "প্রোডাক্ট") + " — স্টকে ফেরত আনা হয়েছে (Save চাপুন)"
      );
    });

    card.querySelector(".pm-del").addEventListener("click", function () {
      if (!confirm("এই প্রোডাক্ট মুছবেন?")) return;
      products[catKey].splice(idx, 1);
      renderCatList();
      renderMain();
    });

    card.querySelector(".pm-dup").addEventListener("click", function () {
      var copy = cloneJson(p);
      copy.name = (p.name || "Product") + " (কপি)";
      copy.id = (p.id || "SKU") + "-COPY-" + Date.now().toString().slice(-5);
      products[catKey].splice(idx + 1, 0, copy);
      renderCatList();
      renderMain();
      toast("প্রোডাক্ট কপি হয়েছে — উপরে এডিট করে Save করুন");
    });

    wireImageUploader(card, p);
    wireGalleryUploader(card, p);

    return card;
  }

  // ── ছবি আপলোড: ড্র্যাগ-ড্রপ + লাইভ প্রিভিউ + অটো-অপ্টিমাইজ (WebP, max 1600px) ──
  function buildImageUploader(p) {
    var hasImg = !!(p.image && String(p.image).trim());
    return (
      '<div class="pm-field pm-field-wide pm-uploader">' +
      '<label>প্রধান ছবি <span class="pm-field-hint">Main image</span></label>' +
      '<div class="pm-dropzone">' +
      '<div class="pm-dropzone-preview"' +
      (hasImg ? ' style="background-image:url(\'' + escapeAttr(resolveImgForPreview(p.image)) + '\')"' : "") +
      '>' +
      (hasImg ? "" : '<span class="pm-dropzone-empty">ছবি নেই</span>') +
      "</div>" +
      '<div class="pm-dropzone-drop">' +
      '<div class="pm-dropzone-txt">ছবি টেনে আনুন বা ক্লিক করে বাছাই করুন</div>' +
      '<div class="pm-dropzone-sub">JPG/PNG/WebP • অটো WebP • আলাদা main/images folder</div>' +
      '<div class="pm-dropzone-status" hidden></div>' +
      '<input type="file" accept="image/*" class="pm-file-input" hidden>' +
      "</div>" +
      "</div>" +
      '<button type="button" class="pl-btn pl-btn-secondary pm-media-lib-btn" style="margin-top:6px;padding:4px 10px;font-size:12px">🖼 মিডিয়া লাইব্রেরি থেকে বাছাই করুন</button>' +
      "</div>"
    );
  }

  function resolveImgForPreview(src) {
    var s = String(src || "").trim();
    if (!s) return "";
    if (/^https?:\/\//i.test(s) || /^data:/i.test(s)) return s;
    // GitHub রিপোতে থাকা রিলেটিভ পাথ — সাইট রুট থেকে রেজলভ করার চেষ্টা
    return s.indexOf("/") === 0 ? s : "/" + s;
  }

  function slugifyFileBase(p) {
    var base = String(p.id || p.name || "product")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    return (base || "product") + "-" + Date.now();
  }

  function resizeToWebp(file, maxW, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var scale = w > maxW ? maxW / w : 1;
        var cw = Math.round(w * scale);
        var ch = Math.round(h * scale);
        var canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, cw, ch);
        canvas.toBlob(
          function (blob) {
            if (!blob) return reject(new Error("ENCODE_FAILED"));
            resolve(blob);
          },
          "image/webp",
          quality
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("IMAGE_LOAD_FAILED"));
      };
      img.src = url;
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        resolve(result.slice(result.indexOf(",") + 1));
      };
      reader.onerror = function () {
        reject(new Error("READ_FAILED"));
      };
      reader.readAsDataURL(blob);
    });
  }

  function wireImageUploader(card, p) {
    var dz = card.querySelector(".pm-dropzone-drop");
    var preview = card.querySelector(".pm-dropzone-preview");
    var input = card.querySelector(".pm-file-input");
    var statusEl = card.querySelector(".pm-dropzone-status");
    var urlInput = card.querySelector('[data-f="image"]');
    if (!dz || !input) return;

    function setStatus(msg, isErr) {
      if (!statusEl) return;
      if (!msg) {
        statusEl.hidden = true;
        return;
      }
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.style.color = isErr ? "#b32d2e" : "#646970";
    }

    function setPreview(url) {
      preview.style.backgroundImage = "url('" + url + "')";
      preview.innerHTML = "";
    }

    function handleFile(file) {
      if (!file || file.type.indexOf("image/") !== 0) {
        setStatus("শুধু ছবি ফাইল দিন (JPG/PNG/WebP)", true);
        return;
      }
      if (!window.MaAdmin || !window.MaAdmin.isLoggedIn || !window.MaAdmin.isLoggedIn()) {
        setStatus("আপলোডের জন্য Admin লগইন প্রয়োজন", true);
        return;
      }
      setStatus("অপটিমাইজ করা হচ্ছে...");
      var base = slugifyFileBase(p);
      Promise.all([
        resizeToWebp(file, IMG_MAX_W, IMG_QUALITY),
        resizeToWebp(file, IMG_CARD_MAX_W, IMG_QUALITY)
      ])
        .then(function (blobs) {
          setPreview(URL.createObjectURL(blobs[0]));
          setStatus("আপলোড হচ্ছে...");
          return Promise.all([blobToBase64(blobs[0]), blobToBase64(blobs[1])]);
        })
        .then(function (base64s) {
          var mainName = "images/main/" + base + ".webp";
          var cardName = "images/main/cards/" + base + "-card.webp";
          return Promise.all([
            window.MaAdmin.uploadImage(mainName, base64s[0], "image/webp"),
            window.MaAdmin.uploadImage(cardName, base64s[1], "image/webp").catch(function () {
              return { ok: false };
            })
          ]);
        })
        .then(function (results) {
          var mainRes = results[0];
          var cardRes = results[1];
          if (!mainRes || !mainRes.ok) {
            setStatus((mainRes && (mainRes.message || mainRes.error)) || "আপলোড ব্যর্থ হয়েছে", true);
            return;
          }
          p.image = mainRes.path || mainRes.url || p.image;
          if (cardRes && cardRes.ok) {
            p.imageCard = cardRes.path || cardRes.url || "";
          }
          if (urlInput) {
            urlInput.value = p.image;
            urlInput.dispatchEvent(new Event("input", { bubbles: true }));
          }
          setStatus("✅ আপলোড সম্পন্ন — Save চাপতে ভুলবেন না");
        })
        .catch(function (err) {
          setStatus("সমস্যা: " + (err && err.message ? err.message : err), true);
        });
    }

    dz.addEventListener("click", function () {
      input.click();
    });
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) handleFile(input.files[0]);
    });
    dz.addEventListener("dragover", function (e) {
      e.preventDefault();
      dz.classList.add("is-drag");
    });
    dz.addEventListener("dragleave", function () {
      dz.classList.remove("is-drag");
    });
    dz.addEventListener("drop", function (e) {
      e.preventDefault();
      dz.classList.remove("is-drag");
      var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) handleFile(f);
    });

    var libBtn = card.querySelector(".pm-media-lib-btn");
    if (libBtn) {
      libBtn.addEventListener("click", function () {
        window.openMediaLibrary(function (path) {
          p.image = path;
          setPreview(resolveImgForPreview(path));
          if (urlInput) {
            urlInput.value = p.image;
            urlInput.dispatchEvent(new Event("input", { bubbles: true }));
          }
          setStatus("✅ মিডিয়া লাইব্রেরি থেকে বাছাই করা হয়েছে — Save চাপতে ভুলবেন না");
        });
      });
    }
  }

  // ── গ্যালারি: একই প্রোডাক্টের অতিরিক্ত ডিজাইন/অ্যাঙ্গল ছবি (কার্ড হোভার + কুইক-ভিউ গ্যালারিতে দেখায়) ──
  function buildGalleryUploader(p) {
    var imgs = Array.isArray(p.images) ? p.images : [];
    var thumbs = imgs
      .map(function (url, i) {
        return (
          '<div class="pm-gallery-thumb" data-gi="' +
          i +
          '"><img src="' +
          escapeAttr(resolveImgForPreview(url)) +
          '" alt="">' +
          '<div class="pm-gallery-thumb-actions">' +
          '<button type="button" class="pm-gallery-move" data-dir="-1" data-gi="' +
          i +
          '"' +
          (i === 0 ? " disabled" : "") +
          ' aria-label="বামে সরান">←</button>' +
          '<button type="button" class="pm-gallery-remove" data-gi="' +
          i +
          '" aria-label="মুছুন">×</button>' +
          '<button type="button" class="pm-gallery-move" data-dir="1" data-gi="' +
          i +
          '"' +
          (i === imgs.length - 1 ? " disabled" : "") +
          ' aria-label="ডানে সরান">→</button>' +
          "</div></div>"
        );
      })
      .join("");
    var canAdd = imgs.length < MAX_GALLERY_IMAGES;
    var addTile = canAdd
      ? '<div class="pm-gallery-add">' +
        '<div class="pm-gallery-add-txt">+ ছবি যোগ</div><small class="pm-gallery-add-hint"></small>' +
        '<input type="file" accept="image/*" class="pm-gallery-file-input" hidden>' +
        "</div>"
      : "";
    var libAddTile = canAdd
      ? '<div class="pm-gallery-add pm-gallery-lib-add">' +
        '<div class="pm-gallery-add-txt">🖼 লাইব্রেরি থেকে</div>' +
        "</div>"
      : "";
    return (
      '<div class="pm-field pm-field-wide pm-uploader pm-gallery-uploader">' +
      '<label>অতিরিক্ত ডিজাইন/অ্যাঙ্গল ছবি <span class="pm-field-hint">সর্বোচ্চ ৪টি</span></label><div class="pm-gallery-caption">কার্ডে হোভার ও কুইক-ভিউতে দেখাবে</div>' +
      '<div class="pm-gallery-grid">' +
      thumbs +
      addTile +
      libAddTile +
      "</div>" +
      '<div class="pm-gallery-status" hidden></div>' +
      "</div>"
    );
  }

  function wireGalleryUploader(card, p) {
    var wrap = card.querySelector(".pm-gallery-uploader");
    if (!wrap) return;
    var statusEl = wrap.querySelector(".pm-gallery-status");

    function setStatus(msg, isErr) {
      if (!statusEl) return;
      if (!msg) {
        statusEl.hidden = true;
        return;
      }
      statusEl.hidden = false;
      statusEl.textContent = msg;
      statusEl.style.color = isErr ? "#b32d2e" : "#646970";
    }

    function rerender() {
      var holder = document.createElement("div");
      holder.innerHTML = buildGalleryUploader(p);
      var newWrap = holder.firstChild;
      wrap.replaceWith(newWrap);
      wireGalleryUploader(card, p);
    }

    wrap.querySelectorAll(".pm-gallery-remove").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = parseInt(btn.getAttribute("data-gi"), 10);
        if (!confirm("এই গ্যালারি ছবিটা সরাবেন?")) return;
        p.images.splice(i, 1);
        if (!p.images.length) delete p.images;
        rerender();
        toast("গ্যালারি ছবি সরানো হয়েছে (Save চাপুন)");
      });
    });

    wrap.querySelectorAll(".pm-gallery-move").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var i = parseInt(btn.getAttribute("data-gi"), 10);
        var dir = parseInt(btn.getAttribute("data-dir"), 10);
        var j = i + dir;
        if (j < 0 || j >= p.images.length) return;
        var tmp = p.images[i];
        p.images[i] = p.images[j];
        p.images[j] = tmp;
        rerender();
      });
    });

    var addTile = wrap.querySelector(".pm-gallery-add:not(.pm-gallery-lib-add)");
    if (addTile) {
      var input = addTile.querySelector(".pm-gallery-file-input");

      function handleGalleryFile(file) {
        if (!file || file.type.indexOf("image/") !== 0) {
          setStatus("শুধু ছবি ফাইল দিন (JPG/PNG/WebP)", true);
          return;
        }
        if (!window.MaAdmin || !window.MaAdmin.isLoggedIn || !window.MaAdmin.isLoggedIn()) {
          setStatus("আপলোডের জন্য Admin লগইন প্রযোজন", true);
          return;
        }
        var n = (Array.isArray(p.images) ? p.images.length : 0) + 1;
        var base = slugifyFileBase(p) + "-g" + n;
        setStatus("অপটিমাইজ করা হচ্ছে...");
        resizeToWebp(file, IMG_GALLERY_MAX_W, IMG_QUALITY)
          .then(function (blob) {
            setStatus("আপলোড হচ্ছে...");
            return blobToBase64(blob);
          })
          .then(function (base64) {
            var name = "images/gallery/" + base + ".webp";
            return window.MaAdmin.uploadImage(name, base64, "image/webp");
          })
          .then(function (res) {
            if (!res || !res.ok) {
              setStatus((res && (res.message || res.error)) || "আপলোড ব্যর্থ হয়েছে", true);
              return;
            }
            if (!Array.isArray(p.images)) p.images = [];
            p.images.push(res.path || res.url);
            setStatus("");
            rerender();
            toast("গ্যালারি ছবি যোগ হয়েছে (Save চাপুন)");
          })
          .catch(function (err) {
            setStatus("সমস্যা: " + (err && err.message ? err.message : err), true);
          });
      }

      addTile.addEventListener("click", function () {
        input.click();
      });
      input.addEventListener("change", function () {
        if (input.files && input.files[0]) handleGalleryFile(input.files[0]);
      });
      addTile.addEventListener("dragover", function (e) {
        e.preventDefault();
        addTile.classList.add("is-drag");
      });
      addTile.addEventListener("dragleave", function () {
        addTile.classList.remove("is-drag");
      });
      addTile.addEventListener("drop", function (e) {
        e.preventDefault();
        addTile.classList.remove("is-drag");
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleGalleryFile(f);
      });
    }

    var libAddTile = wrap.querySelector(".pm-gallery-lib-add");
    if (libAddTile) {
      libAddTile.addEventListener("click", function () {
        window.openMediaLibrary(function (path) {
          if (!Array.isArray(p.images)) p.images = [];
          if (p.images.length >= MAX_GALLERY_IMAGES) {
            toast("সর্বোচ্চ " + MAX_GALLERY_IMAGES + "টি গ্যালারি ছবি রাখা যাবে");
            return;
          }
          p.images.push(path);
          setStatus("");
          rerender();
          toast("গ্যালারি ছবি যোগ হয়েছে (Save চাপুন)");
        });
      });
    }
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
    var order = ["id", "name", "image", "imageCard", "images", "price", "stock", "color", "colorLabel", "fabric", "sizes", "detailNote", "types"];
    order.forEach(function (k) {
      if (k === "images") {
        if (Array.isArray(p.images) && p.images.length) {
          lines.push(ind + "  images: [" + p.images.map(function (s) {
            return jsStr(s);
          }).join(", ") + "],");
        }
        return;
      }
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
      } else if (k === "stock") {
        lines.push(ind + "  stock: " + (parseInt(p.stock, 10) || 0) + ",");
      } else {
        lines.push(ind + "  " + k + ": " + jsStr(p[k]) + ",");
      }
    });
    if (p.inStock === false) {
      lines.push(ind + "  inStock: false,");
    }
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

  function collectProductLinkUrls() {
    var data = {};
    sections.forEach(function (sec) {
      var urls = (products[sec.key] || [])
        .map(function (p) {
          return String(p.image || "").trim();
        })
        .filter(Boolean);
      if (urls.length) data[sec.key] = urls;
    });
    return data;
  }

  function generateProductLinksFile() {
    var data = collectProductLinkUrls();
    var lines = [
      "/**",
      " * ═══ সব ক্যাটাগরির প্রোডাক্ট ছবির লিংক — এক জায়গা ═══",
      " * এডিট: product-manager.html (প্রতি প্রোডাক্টে ছবির URL) → সেভ",
      " * আপডেট: " + new Date().toISOString().slice(0, 10),
      " */",
      "window.PRODUCT_LINKS_DATA = {"
    ];
    sections.forEach(function (sec, idx) {
      var key = sec.key;
      var urls = data[key] || [];
      var keyStr = /^[a-z_$][\w$]*$/i.test(key) ? key : '"' + key + '"';
      lines.push("  " + keyStr + ": [");
      urls.forEach(function (url) {
        lines.push(
          '    "' +
            String(url).replace(/\\/g, "\\\\").replace(/"/g, '\\"') +
            '",'
        );
      });
      lines.push("  ]" + (idx < sections.length - 1 ? "," : ""));
    });
    lines.push("};");
    lines.push("");
    return lines.join("\n");
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

  function stripHomeLinksFromProducts() {
    sections.forEach(function (sec) {
      (products[sec.key] || []).forEach(function (p) {
        var lk = String(p.link || "").trim();
        if (!lk || lk === "/" || lk === "index.html" || lk === sec.path) delete p.link;
      });
    });
  }

  // নতুন: GitHub-এ অটো-পাবলিশ (লগইন করা থাকলে) — ব্যর্থ হলেও নিচের local download
  // ব্যাকআপ হিসেবে সবসময় থেকে যাবে, তাই ডেটা হারানোর ঝুঁকি নেই।
  function publishFilesToGitHub(files) {
    if (!window.MaAdmin || !window.MaAdmin.isLoggedIn || !window.MaAdmin.isLoggedIn()) {
      return Promise.resolve({ attempted: false });
    }
    var results = [];
    return files
      .reduce(function (chain, f) {
        return chain.then(function () {
          return window.MaAdmin.publishFile(f.path, f.content, f.message).then(function (res) {
            results.push({ path: f.path, res: res });
          });
        });
      }, Promise.resolve())
      .then(function () {
        return { attempted: true, results: results };
      });
  }

  // ── মিডিয়া লাইব্রেরি: GitHub রিপোর সব ছবি (images/ ফোল্ডার) এক জায়গায়
  // ব্রাউজ/সার্চ/ডিলিট/বাছাই — WordPress-স্টাইল কেন্দ্রীয় Media Library ──
  var mediaLibState = { images: null, loading: false, filter: "", onSelect: null };

  function ensureMediaLibraryDom() {
    if (document.getElementById("pmMediaLibModal")) return;
    var style = document.createElement("style");
    style.textContent =
      "#pmMediaLibModal{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px}" +
      "#pmMediaLibModal[hidden]{display:none}" +
      ".pm-ml-box{background:#fff;border-radius:10px;max-width:960px;width:100%;max-height:86vh;display:flex;flex-direction:column;overflow:hidden}" +
      ".pm-ml-head{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e2e2e2}" +
      ".pm-ml-head h3{margin:0;font-size:16px}" +
      ".pm-ml-close{border:none;background:none;font-size:20px;cursor:pointer;color:#555;line-height:1}" +
      ".pm-ml-search{padding:10px 18px;border-bottom:1px solid #eee}" +
      ".pm-ml-search input{width:100%;padding:8px 10px;border:1px solid #ccc;border-radius:6px;font-size:14px;box-sizing:border-box}" +
      ".pm-ml-body{flex:1;overflow:auto;padding:14px 18px}" +
      ".pm-ml-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}" +
      ".pm-ml-item{position:relative;border:1px solid #e2e2e2;border-radius:8px;overflow:hidden;cursor:pointer;background:#fafafa}" +
      ".pm-ml-item img{display:block;width:100%;height:100px;object-fit:cover;background:#eee}" +
      ".pm-ml-item .pm-ml-path{font-size:10px;color:#666;padding:4px 6px;word-break:break-all;line-height:1.3;max-height:34px;overflow:hidden}" +
      ".pm-ml-item:hover{border-color:#8a6d3b}" +
      ".pm-ml-del{position:absolute;top:4px;right:4px;background:rgba(211,47,47,.9);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:13px;cursor:pointer;line-height:1}" +
      ".pm-ml-empty{color:#777;padding:30px;text-align:center;font-size:14px}" +
      ".pm-ml-foot{padding:10px 18px;border-top:1px solid #eee;font-size:12px;color:#777}";
    document.head.appendChild(style);

    var modal = document.createElement("div");
    modal.id = "pmMediaLibModal";
    modal.hidden = true;
    modal.innerHTML =
      '<div class="pm-ml-box">' +
      '<div class="pm-ml-head"><h3>মিডিয়া লাইব্রেরি</h3><button type="button" class="pm-ml-close" aria-label="বন্ধ করুন">×</button></div>' +
      '<div class="pm-ml-search"><input type="search" id="pmMlSearch" placeholder="ফাইলের নাম দিয়ে খুঁজুন..."></div>' +
      '<div class="pm-ml-body"><div class="pm-ml-grid" id="pmMlGrid"><p class="pm-ml-empty">লোড হচ্ছে...</p></div></div>' +
      '<div class="pm-ml-foot" id="pmMlFoot"></div>' +
      "</div>";
    document.body.appendChild(modal);

    modal.querySelector(".pm-ml-close").addEventListener("click", closeMediaLibrary);
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeMediaLibrary();
    });
    document.getElementById("pmMlSearch").addEventListener("input", function (e) {
      mediaLibState.filter = e.target.value || "";
      renderMediaLibGrid();
    });
  }

  function closeMediaLibrary() {
    var modal = document.getElementById("pmMediaLibModal");
    if (modal) modal.hidden = true;
  }

  function renderMediaLibGrid() {
    var grid = document.getElementById("pmMlGrid");
    var foot = document.getElementById("pmMlFoot");
    if (!grid) return;
    if (mediaLibState.loading) {
      grid.innerHTML = '<p class="pm-ml-empty">লোড হচ্ছে...</p>';
      if (foot) foot.textContent = "";
      return;
    }
    var images = mediaLibState.images || [];
    var t = mediaLibState.filter.trim().toLowerCase();
    var filtered = t
      ? images.filter(function (im) {
          return String(im.path || "").toLowerCase().indexOf(t) !== -1;
        })
      : images;
    if (!filtered.length) {
      grid.innerHTML =
        '<p class="pm-ml-empty">' +
        (images.length ? "এই নামে কোনো ছবি পাওয়া যায়নি" : "কোনো ছবি নেই — আগে প্রোডাক্টে ছবি আপলোড করুন") +
        "</p>";
      if (foot) foot.textContent = "";
      return;
    }
    grid.innerHTML = "";
    filtered.forEach(function (im) {
      var item = document.createElement("div");
      item.className = "pm-ml-item";
      item.innerHTML =
        '<img src="' +
        escapeAttr(im.url || resolveImgForPreview(im.path)) +
        '" alt="" loading="lazy">' +
        '<div class="pm-ml-path">' +
        escapeHtml(im.path) +
        "</div>" +
        '<button type="button" class="pm-ml-del" title="মুছুন">×</button>';
      item.addEventListener("click", function (e) {
        if (e.target.classList.contains("pm-ml-del")) return;
        if (typeof mediaLibState.onSelect === "function") {
          mediaLibState.onSelect(im.path);
        }
        closeMediaLibrary();
      });
      item.querySelector(".pm-ml-del").addEventListener("click", function (e) {
        e.stopPropagation();
        if (!confirm("এই ছবিটা স্থায়ীভাবে মুছবেন?\n" + im.path)) return;
        if (!window.MaAdmin || !window.MaAdmin.deleteImage) return;
        window.MaAdmin.deleteImage(im.path).then(function (res) {
          if (!res || !res.ok) {
            toast((res && (res.message || res.error)) || "ছবি মুছতে ব্যর্থ হয়েছে");
            return;
          }
          mediaLibState.images = (mediaLibState.images || []).filter(function (x) {
            return x.path !== im.path;
          });
          renderMediaLibGrid();
          toast("ছবি মুছে ফেলা হয়েছে");
        });
      });
      grid.appendChild(item);
    });
    if (foot) foot.textContent = filtered.length + " / " + images.length + " ছবি";
  }

  function loadMediaLibImages(force) {
    if (mediaLibState.images && !force) {
      renderMediaLibGrid();
      return;
    }
    if (!window.MaAdmin || !window.MaAdmin.listImages) {
      var grid = document.getElementById("pmMlGrid");
      if (grid) grid.innerHTML = '<p class="pm-ml-empty">MaAdmin.listImages পাওয়া যায়নি</p>';
      return;
    }
    mediaLibState.loading = true;
    renderMediaLibGrid();
    window.MaAdmin.listImages()
      .then(function (res) {
        mediaLibState.loading = false;
        if (!res || !res.ok) {
          mediaLibState.images = [];
          renderMediaLibGrid();
          var grid = document.getElementById("pmMlGrid");
          if (grid) {
            grid.innerHTML =
              '<p class="pm-ml-empty">' +
              escapeHtml((res && (res.message || res.error)) || "ছবির তালিকা আনা যায়নি") +
              "</p>";
          }
          return;
        }
        mediaLibState.images = res.images || [];
        renderMediaLibGrid();
      })
      .catch(function (err) {
        mediaLibState.loading = false;
        mediaLibState.images = [];
        renderMediaLibGrid();
        var grid = document.getElementById("pmMlGrid");
        if (grid) {
          grid.innerHTML =
            '<p class="pm-ml-empty">সমস্যা: ' + escapeHtml(err && err.message ? err.message : String(err)) + "</p>";
        }
      });
  }

  function openMediaLibrary(onSelect) {
    if (!window.MaAdmin || !window.MaAdmin.isLoggedIn || !window.MaAdmin.isLoggedIn()) {
      toast("মিডিয়া লাইব্রেরি ব্যবহার করতে Admin লগইন প্রয়োজন");
      return;
    }
    ensureMediaLibraryDom();
    mediaLibState.onSelect = onSelect;
    mediaLibState.filter = "";
    var searchInput = document.getElementById("pmMlSearch");
    if (searchInput) searchInput.value = "";
    document.getElementById("pmMediaLibModal").hidden = false;
    loadMediaLibImages(false);
  }
  window.openMediaLibrary = openMediaLibrary;

  function saveAll() {
    stripHomeLinksFromProducts();

    var sectionsContent = generateSectionsFile();
    var productsContent = generateProductsFile();
    var linksContent = generateProductLinksFile();
    var configContent = Object.keys(categoryTypePrices).length ? generateProductConfigFile() : null;

    // ১) সবসময় লোকাল ডাউনলোড (ব্যাকআপ / GitHub লগইন ছাড়া চালানোর জন্য)
    download(sectionsContent, "product-catalog-sections.js");
    setTimeout(function () {
      download(productsContent, "category-products.js");
    }, 400);
    setTimeout(function () {
      download(linksContent, "product-links-data.js");
    }, 800);
    if (configContent) {
      setTimeout(function () {
        download(configContent, "product-config.js");
      }, 1200);
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

    // ২) GitHub-এ অটো-পাবলিশ চেষ্টা (Admin লগইন থাকলেই কাজ করবে; নতুন ক্যাটাগরি HTML
    //    অটো-পাবলিশ হয় না — সেগুলো এখনও ম্যানুয়াল আপলোড লাগবে)
    if (newSections.length) {
      toast("৩টি+ ফাইল ডাউনলোড হয়েছে (+ নতুন ক্যাটাগরি HTML — এগুলো ম্যানুয়ালি আপলোড করুন)");
      return;
    }

    toast("ফাইল ডাউনলোড হয়েছে — GitHub-এ পাবলিশ হচ্ছে...");

    var files = [
      { path: "category-products.js", content: productsContent, message: "Update products — Admin Panel থেকে" },
      { path: "product-links-data.js", content: linksContent, message: "Update product links — Admin Panel থেকে" },
      { path: "product-catalog-sections.js", content: sectionsContent, message: "Update catalog sections — Admin Panel থেকে" }
    ];
    if (configContent) {
      files.push({ path: "product-config.js", content: configContent, message: "Update product config — Admin Panel থেকে" });
    }

    publishFilesToGitHub(files).then(function (out) {
      if (!out.attempted) {
        toast("লোকাল ফাইল রেডি — GitHub অটো-পাবলিশের জন্য Admin লগইন করুন (admin-login.html)");
        return;
      }
      var failed = out.results.filter(function (r) {
        return !r.res || !r.res.ok;
      });
      if (!failed.length) {
        toast("✅ পাবলিশ সফল! Netlify ১-২ মিনিটে সাইট আপডেট করবে।");
      } else {
        var firstErr = failed[0].res ? failed[0].res.message || failed[0].res.error : "অজানা সমস্যা";
        toast(
          "⚠️ " + failed.length + "টি ফাইল পাবলিশ ব্যর্থ (" + firstErr + ") — ডাউনলোড হওয়া ফাইল ম্যানুয়ালি আপলোড করুন"
        );
      }
    });
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
