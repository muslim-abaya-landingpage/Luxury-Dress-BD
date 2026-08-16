(function (global) {

  var BDT = "\u09F3";

  global.MA_BDT = BDT;
  global.formatBdt = function formatBdt(amount) {
    var n = Number(amount);
    if (!isFinite(n)) n = 0;
    return BDT + n.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  var CATALOG = [
    { id: "DR-01", name: "Baby Pink Floral", price: 550, image: "images/Baby-Pink-Floral-Print.jpeg", category: "premium-two-piece" },
    { id: "DR-08", name: "Black Base Rose", price: 550, image: "images/Black-Base-Rose-Floral.jpeg", category: "premium-two-piece" },
    { id: "DR-16", name: "Black White Polka", price: 550, image: "images/Black-White-Polka-Dots.jpeg", category: "premium-two-piece" },
    { id: "DR-23", name: "Royal Blue Golden", price: 550, image: "images/Royal-Blue-Golden-Floral-Print.jpeg", category: "premium-two-piece" },
    { id: "DR-28", name: "Pink Floral Printed Co-ord Set", price: 550, image: "images/pink-floral-printed-co-ord-set.jpeg", category: "premium-two-piece" },
    {
      id: "DR-29",
      name: "Baby Pink / Light Pink",
      price: 550,
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Baby%20PinkLight%20Pink.jpeg?raw=1",
      category: "premium-two-piece"
    },
    {
      id: "DR-30",
      name: "Sage Green / Mint Green",
      price: 550,
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Sage%20GreenMint%20Green.jpeg?raw=1",
      category: "premium-two-piece"
    }
  ];

  var PLACEHOLDER_IMG = "Baby-Pink-Floral-Print.jpeg";

  function findCatalogProductFull(id, name) {
    var nid = String(id || "").trim();
    var nname = String(name || "").trim().toLowerCase();
    var i;

    for (i = 0; i < CATALOG.length; i++) {
      if (nid && CATALOG[i].id === nid) return CATALOG[i];
      if (nname && String(CATALOG[i].name || "").trim().toLowerCase() === nname) return CATALOG[i];
    }

    var cats = (typeof window !== "undefined" && window.CATEGORY_PRODUCTS) || {};
    var keys = Object.keys(cats);
    var k;

    for (k = 0; k < keys.length; k++) {
      var list = cats[keys[k]];
      if (!Array.isArray(list)) continue;

      for (i = 0; i < list.length; i++) {
        var p = list[i];
        if (!p) continue;
        if (nid && String(p.id || "").trim() === nid) {
          return Object.assign({ category: p.category || keys[k] }, p);
        }
        if (nname && String(p.name || "").trim().toLowerCase() === nname) {
          return Object.assign({ category: p.category || keys[k] }, p);
        }
      }
    }

    return null;
  }

  function resolveItemImage(item) {
    if (!item) return "";
    var stored = String(item.image || item.img || "").trim();
    if (stored) return stored;
    var cat = item.id ? CATALOG.find(function (p) { return p.id === item.id; }) : findByName(item.name);
    if (!cat) cat = findCatalogProductFull(item.id, item.name);
    if (cat && cat.image) return cat.image;
    return "";
  }

  /** Full https URL for Google Sheet IMAGE() and external tools. */
  function resolveAbsoluteStoreImageUrl(item) {
    var raw = resolveItemImage(item);
    if (!raw) return "";

    raw = String(raw).trim();

    if (/^https?:\/\//i.test(raw)) {
      if (raw.indexOf("github.com") !== -1 && raw.indexOf("/blob/") !== -1) {
        raw = raw.replace("https://github.com/", "https://raw.githubusercontent.com/").replace("/blob/", "/");
        raw = raw.replace(/\?raw=1$/i, "");
      }
      return raw;
    }

    var origin = "https://muslimabaya.com";
    if (typeof window !== "undefined" && window.location && window.location.protocol !== "file:") {
      origin = String(window.location.origin || origin).replace(/\/$/, "");
    }

    if (raw.charAt(0) === "/") raw = raw.slice(1);
    return origin + "/" + raw.replace(/^\.?\//, "");
  }

  function findByName(name) {
    var n = String(name || "").trim().toLowerCase();
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].name.trim().toLowerCase() === n) return CATALOG[i];
    }
    return null;
  }

  /** Resolve a product's category key from the full catalog (when loaded). */
  function categoryFromCatalog(id, name) {
    var cats = (typeof window !== "undefined" && window.CATEGORY_PRODUCTS) || null;
    if (!cats) return "";

    var nid = String(id || "").trim();
    var nname = String(name || "").trim().toLowerCase();
    var keys = Object.keys(cats);

    for (var i = 0; i < keys.length; i++) {
      var list = cats[keys[i]];
      if (!Array.isArray(list)) continue;

      for (var j = 0; j < list.length; j++) {
        var p = list[j];
        if (!p) continue;
        if (nid && String(p.id) === nid) return p.category || keys[i];
        if (nname && String(p.name || "").trim().toLowerCase() === nname) return p.category || keys[i];
      }
    }

    return "";
  }

  function normalizeLine(item) {
    if (!item || !item.name) return null;
    var qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty < 1) return null;

    var lineId = String(item.id || "").trim();
    var cat = lineId
      ? CATALOG.find(function (p) {
          return p.id === lineId;
        })
      : findByName(item.name);

    if (!cat && item.name) cat = findByName(item.name);

    var line = {
      id: lineId || (cat && cat.id) || "",
      name: item.name,
      price: parseInt(item.price, 10) || (cat && cat.price) || 550,
      quantity: qty,
      image: item.image || (cat && cat.image) || "",
      color: item.color || (cat && cat.color) || "",
      colorLabel: item.colorLabel || (cat && cat.colorLabel) || "",
      fabric: item.fabric || item.material || (cat && cat.fabric) || "",
      description: item.description || (cat && cat.description) || "",
      size: item.size || item.selectedSize || "",
      category: item.category || item.categoryKey || (cat && cat.category) || categoryFromCatalog(lineId, item.name) || "",
      categoryLabel: item.categoryLabel || (cat && cat.categoryLabel) || ""
    };

    if (item.lengthSize) line.lengthSize = String(item.lengthSize);
    if (item.bodySize) line.bodySize = String(item.bodySize);
    if (item.selectedSize) line.selectedSize = String(item.selectedSize);
    if (item.productType) line.productType = String(item.productType);

    if (!line.size && line.lengthSize && typeof global.getCartLineSizeLabel === "function") {
      var rebuilt = global.getCartLineSizeLabel(line);
      if (rebuilt) line.size = rebuilt;
    }

    line.image = resolveItemImage(line);
    return line;
  }

  /**
   * FIX #1: Merge key uses ONLY product ID + size (not category)
   * Different categories should not create separate cart entries
   */
  function cartLineMergeKey(line) {
    if (!line) return "";
    if (line.id) return String(line.id) + "|" + String(line.size || "");
    return String(line.name || "");
  }

  function normalizeArray(arr) {
    var map = {};
    if (!Array.isArray(arr)) return [];

    arr.forEach(function (raw) {
      var line = normalizeLine(raw);
      if (!line) return;

      var key = cartLineMergeKey(line);
      if (!map[key]) {
        map[key] = line;
      } else {
        map[key].quantity += line.quantity;
      }
    });

    return Object.keys(map).map(function (k) {
      return map[k];
    });
  }

  function lookupProductById(id) {
    var nid = String(id || "").trim();
    if (!nid) return null;

    var cat = CATALOG.find(function (p) {
      return p.id === nid;
    });

    if (cat) return cat;

    var cats = (typeof window !== "undefined" && window.CATEGORY_PRODUCTS) || null;
    if (!cats) return null;

    var keys = Object.keys(cats);

    for (var i = 0; i < keys.length; i++) {
      var list = cats[keys[i]];
      if (!Array.isArray(list)) continue;

      for (var j = 0; j < list.length; j++) {
        var p = list[j];
        if (p && String(p.id) === nid) {
          return {
            id: p.id,
            name: p.name,
            price: parseInt(p.price, 10) || 550,
            image: p.image || p.img || "",
            category: p.category || keys[i]
          };
        }
      }
    }

    return null;
  }

  function objectToArray(obj) {
    var arr = [];
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return arr;

    var usedKeys = {};

    CATALOG.forEach(function (p) {
      var qty = parseInt(obj[p.id], 10) || 0;
      if (qty > 0) {
        usedKeys[p.id] = true;
        arr.push({
          id: p.id,
          name: p.name,
          price: p.price,
          quantity: qty,
          image: p.image
        });
      }
    });

    Object.keys(obj).forEach(function (key) {
      if (usedKeys[key]) return;
      var qty = parseInt(obj[key], 10) || 0;
      if (qty <= 0) return;

      var found = lookupProductById(key);
      if (found) {
        arr.push({
          id: found.id,
          name: found.name,
          price: found.price,
          quantity: qty,
          image: found.image,
          category: found.category || ""
        });
      }
    });

    return arr;
  }

  function parseStoredRaw(raw) {
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === "object") return objectToArray(parsed);
    } catch (e) {}
    return [];
  }

  function parseStored(raw) {
    return normalizeArray(parseStoredRaw(raw));
  }

  function loadStoreCart(options) {
    var readOnly = options && options.readOnly === true;

    var keys = ["secured_checkout_cart", "category_cart_v2", "user_cart", "cart"];
    var best = [];
    var i;

    for (i = 0; i < keys.length; i++) {
      var rawItems = parseStoredRaw(localStorage.getItem(keys[i]));
      if (rawItems.length) {
        best = normalizeArray(rawItems);
        break;
      }
    }

    if (!best.length) {
      try {
        best = normalizeArray(parseStoredRaw(sessionStorage.getItem("cart")));
      } catch (e2) {}
    }

    if (best.length > 0 && !readOnly) persistStoreCart(best);

    return best;
  }

  function flushStoreCartForCheckout(lines) {
    var normalized = normalizeArray(lines || []);
    persistStoreCart(normalized);
    markStoreCartSession();

    try {
      sessionStorage.setItem("ma_checkout_cart_ts", String(Date.now()));
    } catch (e) {}

    return normalized;
  }

  function syncCartBadgeFromStore() {
    var lines = loadStoreCart({ readOnly: true });
    refreshCartBadgeUI(lines);
    return lines;
  }

  function persistStoreCart(arr) {
    var normalized = normalizeArray(arr || []);
    var s = JSON.stringify(normalized);

    localStorage.setItem("secured_checkout_cart", s);
    localStorage.setItem("category_cart_v2", s);
    localStorage.setItem("user_cart", s);
    localStorage.setItem("cart", s);

    try {
      sessionStorage.setItem("cart", s);
    } catch (e) {}

    return normalized;
  }

  function clearStoreCart() {
    ["secured_checkout_cart", "category_cart_v2", "user_cart", "cart"].forEach(function (k) {
      localStorage.removeItem(k);
    });

    try {
      sessionStorage.removeItem("cart");
    } catch (e) {}
  }

  function cartTotalQty(arr) {
    var q = 0;
    (arr || []).forEach(function (item) {
      q += parseInt(item.quantity, 10) || 0;
    });
    return q;
  }

  function lineFromCatalogId(productId, addQty) {
    var p = CATALOG.find(function (x) { return x.id === productId; });
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      quantity: parseInt(addQty, 10) || 1,
      image: p.image
    };
  }

  /**
   * FIX #2: Load existing cart from storage before adding new item
   * This prevents losing previous items when adding a new product
   */
  function addOrMergeItem(arr, item) {
    // Load from storage first if arr is empty/undefined
    var list = (arr && arr.length > 0) ? normalizeArray(arr) : loadStoreCart({ readOnly: true });
    
    var line = normalizeLine(item);
    if (!line) return list;

    var key = cartLineMergeKey(line);
    var found = list.find(function (x) {
      return cartLineMergeKey(x) === key;
    });

    if (found) {
      found.quantity = (parseInt(found.quantity, 10) || 0) + line.quantity;
    } else {
      list.push(line);
    }

    return persistStoreCart(list);
  }

  /** Homepage / simple lines → full checkout line (size + image) */
  function enrichHomeCartLine(homeProduct, line) {
    if (!line) return line;
    var out = Object.assign({}, line);
    var catKey = (homeProduct && homeProduct.category) || out.category || "";
    var full = findCatalogProductFull(out.id, out.name);

    if (full && full.image) out.image = full.image;
    if (!out.category && full && full.category) out.category = full.category;

    if (typeof global.isAbayaProduct === "function" && global.isAbayaProduct(out, catKey)) {
      var abCfg = typeof global.getAbayaSizeConfig === "function" ? global.getAbayaSizeConfig() : null;
      if (abCfg) {
        var abLen = out.lengthSize || abCfg.lengthSizes[0];
        out.lengthSize = String(abLen);
        out.bodySize = out.bodySize || abCfg.bodySizeLabel;
        if (typeof global.formatAbayaCartSize === "function") {
          out.size = global.formatAbayaCartSize(abLen);
        }
      }
    } else if (typeof global.isTwoPieceProduct === "function" && global.isTwoPieceProduct(out, catKey)) {
      var tpCfg = typeof global.getTwoPieceSizeConfig === "function" ? global.getTwoPieceSizeConfig() : null;
      if (tpCfg) {
        out.bodySize = out.bodySize || tpCfg.bodySizeLabel;
        out.lengthSize = out.lengthSize || tpCfg.lengthSizeLabel;
        if (typeof global.formatTwoPieceCartSize === "function") {
          out.size = global.formatTwoPieceCartSize(out.lengthSize);
        }
      }
    }

    out.image = resolveItemImage(out);
    return out;
  }

  /** Homepage cart object → checkout lines (all selected products + qty). */
  function buildLinesFromHomeCart(cartObj, productList) {
    var lines = [];
    if (!cartObj || typeof cartObj !== "object" || !Array.isArray(productList)) {
      return normalizeArray(lines);
    }

    Object.keys(cartObj).forEach(function (id) {
      var qty = parseInt(cartObj[id], 10) || 0;
      if (qty <= 0) return;

      var p = productList.find(function (x) {
        return x && (x.id === id || x.catalogId === id);
      });

      if (!p) return;

      var line = enrichHomeCartLine(p, {
        id: p.catalogId || p.id,
        name: p.name,
        price: parseInt(p.price, 10) || 550,
        quantity: qty,
        image: p.img || p.image || "",
        category: p.category || "",
        categoryLabel: p.categoryLabel || ""
      });

      lines.push(line);
    });

    return normalizeArray(lines);
  }

  global.STORE_CATALOG = CATALOG;
  global.loadStoreCart = loadStoreCart;
  global.syncCartBadgeFromStore = syncCartBadgeFromStore;
  global.resetShopCartContext = global.resetShopCartContext || function () {};
  global.persistStoreCart = persistStoreCart;
  global.clearStoreCart = clearStoreCart;
  global.normalizeStoreCart = normalizeArray;
  global.homeCartObjectToArray = objectToArray;
  global.cartTotalQty = cartTotalQty;
  global.addOrMergeStoreCartItem = addOrMergeItem;
  global.buildLinesFromHomeCart = buildLinesFromHomeCart;
  global.enrichHomeCartLine = enrichHomeCartLine;
  global.flushStoreCartForCheckout = flushStoreCartForCheckout;
  global.findCatalogByName = findByName;
  global.resolveStoreItemImage = resolveItemImage;
  global.resolveAbsoluteStoreImageUrl = resolveAbsoluteStoreImageUrl;

  function refreshCartBadgeUI(cartLines) {
    if (typeof global.updateCartBadge === "function") {
      global.updateCartBadge(cartLines);
    }
  }

  var SESSION_KEY = "muslim_abaya_home_cart_active";

  function markStoreCartSession() {
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch (e) {}
  }

  function clearStoreCartSession() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function afterCartMutation(cartLines) {
    markStoreCartSession();
    var lines = cartLines;
    if (!lines && typeof loadStoreCart === "function") lines = loadStoreCart({ readOnly: true });
    refreshCartBadgeUI(lines);
  }

  var ORDER_TRACKING_KEY = "muslim_abaya_order_tracking";
  var PURCHASE_FIRED_KEY = "ma_purchase_event_fired";

  /** E.164 for Meta / GTM (Bangladesh). */
  function normalizePhoneE164(phone) {
    var digits = String(phone || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.indexOf("880") === 0 && digits.length >= 12) return digits.slice(0, 13);
    if (digits.indexOf("01") === 0 && digits.length === 11) return "880" + digits.slice(1);
    if (digits.length === 10 && digits.charAt(0) === "1") return "880" + digits;
    return digits;
  }

  function splitFullName(name) {
    var parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return { user_first_name: "", user_last_name: "" };
    if (parts.length === 1) return { user_first_name: parts[0], user_last_name: "" };
    return { user_first_name: parts[0], user_last_name: parts.slice(1).join(" ") };
  }

  // Note: The full file continues with Meta, TikTok, and tracking functions.
  // Only the two functions above were modified. The rest of the file remains unchanged.
  // This is a partial excerpt showing the bugfix only.

  global.refreshCartBadgeUI = refreshCartBadgeUI;
  global.markStoreCartSession = markStoreCartSession;

})(typeof window !== "undefined" ? window : global);