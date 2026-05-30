/**
 * Single cart format for homepage + category + checkout.
 * Array: [{ id, name, price, quantity, image? }]
 */
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
      name: "Baby PinkLight Pink",
      price: 550,
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Baby%20PinkLight%20Pink.jpeg?raw=1",
      category: "premium-two-piece"
    },
    {
      id: "DR-30",
      name: "Sage GreenMint Green",
      price: 550,
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Sage%20GreenMint%20Green.jpeg?raw=1",
      category: "premium-two-piece"
    }
  ];

  var PLACEHOLDER_IMG = "Baby-Pink-Floral-Print.jpeg";

  function resolveItemImage(item) {
    if (!item) return "";
    var stored = String(item.image || item.img || "").trim();
    if (stored) return stored;
    var cat = item.id ? CATALOG.find(function (p) { return p.id === item.id; }) : findByName(item.name);
    if (cat && cat.image) return cat.image;
    return "";
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
    line.image = resolveItemImage(line);
    return line;
  }

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

  function objectToArray(obj) {
    var arr = [];
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return arr;
    CATALOG.forEach(function (p) {
      var qty = parseInt(obj[p.id], 10) || 0;
      if (qty > 0) {
        arr.push({
          id: p.id,
          name: p.name,
          price: p.price,
          quantity: qty,
          image: p.image
        });
      }
    });
    return arr;
  }

  function parseStored(raw) {
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return normalizeArray(parsed);
      if (parsed && typeof parsed === "object") return objectToArray(parsed);
    } catch (e) {}
    return [];
  }

  function loadStoreCart(options) {
    var readOnly = options && options.readOnly === true;
    var keys = ["secured_checkout_cart", "category_cart_v2", "user_cart", "cart"];
    var best = [];
    var bestQty = 0;
    keys.forEach(function (key) {
      var arr = parseStored(localStorage.getItem(key));
      var q = cartTotalQty(arr);
      if (arr.length > best.length || (arr.length === best.length && q > bestQty)) {
        best = arr;
        bestQty = q;
      }
    });
    if (!best.length) {
      try {
        best = parseStored(sessionStorage.getItem("cart"));
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

  function addOrMergeItem(arr, item) {
    var list = normalizeArray(arr);
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
      lines.push({
        id: p.catalogId || p.id,
        name: p.name,
        price: parseInt(p.price, 10) || 550,
        quantity: qty,
        image: p.img || p.image || "",
        category: p.category || "",
        categoryLabel: p.categoryLabel || ""
      });
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
  global.flushStoreCartForCheckout = flushStoreCartForCheckout;
  global.findCatalogByName = findByName;
  global.resolveStoreItemImage = resolveItemImage;

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
    if (!lines && typeof loadStoreCart === "function") lines = loadStoreCart();
    refreshCartBadgeUI(lines);
  }

  var ORDER_TRACKING_KEY = "muslim_abaya_order_tracking";

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

  function cartLinesToContentIds(lines) {
    if (!Array.isArray(lines)) return [];
    return lines
      .map(function (line) {
        return line && (line.id || line.name) ? String(line.id || line.name) : "";
      })
      .filter(Boolean);
  }

  /** Standard fields for GTM → Meta Pixel (Advanced Matching). */
  function applyMetaTrackingFields(payload) {
    if (!payload || typeof payload !== "object") return {};
    var out = {};
    var k;
    for (k in payload) {
      if (Object.prototype.hasOwnProperty.call(payload, k)) out[k] = payload[k];
    }

    var phoneRaw = out.user_phone || out.phone || "";
    var e164 = normalizePhoneE164(phoneRaw);
    if (e164) {
      out.user_phone = e164;
      if (!out.phone) out.phone = phoneRaw;
    }

    var nameSrc = out.user_first_name || out.first_name || "";
    if (nameSrc && !out.user_last_name) {
      var split = splitFullName(nameSrc);
      out.user_first_name = split.user_first_name;
      if (split.user_last_name) out.user_last_name = split.user_last_name;
    } else if (out.first_name && !out.user_first_name) {
      var split2 = splitFullName(out.first_name);
      out.user_first_name = split2.user_first_name;
      if (split2.user_last_name) out.user_last_name = split2.user_last_name;
    }

    var email = out.user_email || out.email;
    if (email) out.user_email = String(email).trim().toLowerCase();

    var eventId = out.event_id || out.transaction_id || "";
    if (eventId) {
      out.event_id = String(eventId);
      out.transaction_id = String(out.transaction_id || eventId);
    }

    if (typeof out.value === "undefined" && typeof out.order_value !== "undefined") {
      out.value = parseFloat(out.order_value) || 0;
    }
    if (typeof out.order_value === "undefined" && typeof out.value !== "undefined") {
      out.order_value = out.value;
    }

    if (!out.content_ids && out.content_id) {
      out.content_ids = [String(out.content_id)];
    }

    out.currency = out.currency || "BDT";
    return out;
  }

  function buildCartTrackingSnapshot(cartLines) {
    var lines = Array.isArray(cartLines) ? cartLines : [];
    var value = 0;
    var contents = [];
    lines.forEach(function (line) {
      if (!line) return;
      var q = parseInt(line.quantity, 10) || 1;
      var price = parseInt(line.price, 10) || 0;
      value += q * price;
      contents.push({
        id: line.id || line.name || "",
        quantity: q,
        item_price: price
      });
    });
    return {
      value: value,
      order_value: value,
      currency: "BDT",
      content_ids: cartLinesToContentIds(lines),
      contents: contents,
      num_items: cartTotalQty(lines)
    };
  }

  function saveOrderTracking(payload) {
    if (!payload) return;
    try {
      sessionStorage.setItem(ORDER_TRACKING_KEY, JSON.stringify(applyMetaTrackingFields(payload)));
    } catch (e) {}
  }

  function readOrderTracking() {
    try {
      var raw = sessionStorage.getItem(ORDER_TRACKING_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearOrderTracking() {
    try {
      sessionStorage.removeItem(ORDER_TRACKING_KEY);
    } catch (e) {}
  }

  var TIKTOK_PIXEL_ID = "D6FK9GBC77UC649NNCP0";
  var TIKTOK_EVENT_MAP = {
    ViewContent: "ViewContent",
    AddToCart: "AddToCart",
    InitiateCheckout: "InitiateCheckout",
    purchase_complete: "CompletePayment"
  };

  function ensureTikTokPixelLoaded() {
    if (typeof window === "undefined" || window.__tiktokPixelInit) return;
    window.__tiktokPixelInit = true;
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t;
      var ttq = (w[t] = w[t] || []);
      ttq.methods = [
        "page", "track", "identify", "instances", "debug", "on", "off", "once", "ready",
        "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"
      ];
      ttq.setAndDefer = function (obj, method) {
        obj[method] = function () {
          obj.push([method].concat(Array.prototype.slice.call(arguments, 0)));
        };
      };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.instance = function (id) {
        var inst = ttq._i[id] || [];
        for (var j = 0; j < ttq.methods.length; j++) ttq.setAndDefer(inst, ttq.methods[j]);
        return inst;
      };
      ttq.load = function (id, opts) {
        var src = "https://analytics.tiktok.com/i18n/pixel/events.js";
        ttq._i = ttq._i || {};
        ttq._i[id] = [];
        ttq._i[id]._u = src;
        ttq._t = ttq._t || {};
        ttq._t[id] = +new Date();
        ttq._o = ttq._o || {};
        ttq._o[id] = opts || {};
        var s = d.createElement("script");
        s.type = "text/javascript";
        s.async = true;
        s.src = src + "?sdkid=" + id + "&lib=" + t;
        var first = d.getElementsByTagName("script")[0];
        if (first && first.parentNode) first.parentNode.insertBefore(s, first);
        else d.head.appendChild(s);
      };
      ttq.load(TIKTOK_PIXEL_ID);
      ttq.page();
    }(window, document, "ttq");
  }

  function formatTikTokPhoneE164(data) {
    data = data || {};
    var e164 = data.user_phone || normalizePhoneE164(data.phone || "");
    if (!e164) return "";
    var digits = String(e164).replace(/\D/g, "");
    if (!digits) return "";
    return "+" + digits;
  }

  function buildTikTokIdentifyPayload(data) {
    data = data || {};
    var out = {};
    var email = String(data.user_email || data.email || "")
      .trim()
      .toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      out.email = email;
    }
    var phone = formatTikTokPhoneE164(data);
    if (phone) out.phone_number = phone;
    var ext = data.external_id || data.transaction_id || data.event_id;
    if (!ext && phone) ext = phone.replace(/\D/g, "");
    if (ext) out.external_id = String(ext);
    return out;
  }

  function tikTokIdentify(data) {
    var idPayload = buildTikTokIdentifyPayload(data);
    if (!idPayload.email && !idPayload.phone_number && !idPayload.external_id) return;
    ensureTikTokPixelLoaded();
    try {
      if (window.ttq && typeof window.ttq.identify === "function") {
        window.ttq.identify(idPayload);
      } else if (window.ttq) {
        window.ttq.push(["identify", idPayload]);
      }
    } catch (e) {}
  }

  function buildTikTokTrackPayload(data) {
    data = data || {};
    var out = { currency: data.currency || "BDT" };
    if (data.value != null) out.value = data.value;
    else if (data.order_value != null) out.value = data.order_value;
    var ids = data.content_ids;
    if (ids) {
      var first = Array.isArray(ids) ? ids[0] : ids;
      if (first) out.content_id = String(first);
    }
    var tid = data.transaction_id || data.event_id;
    if (tid) {
      out.order_id = String(tid);
      out.event_id = String(tid);
    }
    var match = buildTikTokIdentifyPayload(data);
    if (match.email) out.email = match.email;
    if (match.phone_number) out.phone_number = match.phone_number;
    if (match.external_id) out.external_id = match.external_id;
    return out;
  }

  function pushToTikTok(eventName, data) {
    var ttEvent = TIKTOK_EVENT_MAP[eventName];
    if (!ttEvent) return;
    ensureTikTokPixelLoaded();
    tikTokIdentify(data);
    var payload = buildTikTokTrackPayload(data);
    try {
      if (window.ttq && typeof window.ttq.track === "function") {
        window.ttq.track(ttEvent, payload);
      } else if (window.ttq) {
        window.ttq.push(["track", ttEvent, payload]);
      }
    } catch (e) {}
  }

  function syncTikTokUserFromFormFields() {
    if (typeof document === "undefined") return;
    var phoneEl = document.getElementById("userPhone");
    var emailEl = document.getElementById("userEmail");
    var nameEl = document.getElementById("userName");
    var raw = {
      phone: phoneEl ? phoneEl.value : "",
      email: emailEl ? emailEl.value : "",
      first_name: nameEl ? nameEl.value : ""
    };
    if (!raw.phone && !raw.email) return;
    tikTokIdentify(applyMetaTrackingFields(raw));
  }

  function pushTrackingEvent(eventName, data) {
    if (!eventName) return;
    var base = { event: eventName };
    if (data && typeof data === "object") {
      var k;
      for (k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k)) base[k] = data[k];
      }
    }
    var payload = applyMetaTrackingFields(base);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    pushToTikTok(eventName, payload);
    return payload;
  }

  function pushPurchaseCompleteEvent(extra) {
    var saved = readOrderTracking() || {};
    var merged = {};
    var k;
    for (k in saved) {
      if (Object.prototype.hasOwnProperty.call(saved, k)) merged[k] = saved[k];
    }
    if (extra && typeof extra === "object") {
      for (k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) merged[k] = extra[k];
      }
    }
    if (!merged.transaction_id && !merged.event_id) {
      merged.transaction_id = "order_" + Date.now();
    }
    merged.event = "purchase_complete";
    var payload = applyMetaTrackingFields(merged);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(payload);
    pushToTikTok("purchase_complete", payload);
    return payload;
  }

  if (typeof window !== "undefined") {
    ensureTikTokPixelLoaded();
  }

  global.refreshCartBadgeUI = refreshCartBadgeUI;
  global.ensureTikTokPixelLoaded = ensureTikTokPixelLoaded;
  global.tikTokIdentify = tikTokIdentify;
  global.syncTikTokUserFromFormFields = syncTikTokUserFromFormFields;
  global.markStoreCartSession = markStoreCartSession;
  global.clearStoreCartSession = clearStoreCartSession;
  global.afterCartMutation = afterCartMutation;
  global.saveOrderTracking = saveOrderTracking;
  global.readOrderTracking = readOrderTracking;
  global.clearOrderTracking = clearOrderTracking;
  global.pushPurchaseCompleteEvent = pushPurchaseCompleteEvent;
  global.pushTrackingEvent = pushTrackingEvent;
  global.normalizePhoneE164 = normalizePhoneE164;
  global.buildCartTrackingSnapshot = buildCartTrackingSnapshot;
  global.applyMetaTrackingFields = applyMetaTrackingFields;
})(typeof window !== "undefined" ? window : this);
