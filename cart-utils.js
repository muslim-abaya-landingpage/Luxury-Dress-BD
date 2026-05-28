/**
 * Single cart format for homepage + category + checkout.
 * Array: [{ id, name, price, quantity, image? }]
 */
(function (global) {
  var CATALOG = [
    { id: "DR-01", name: "Baby Pink Floral", price: 550, image: "images/Baby-Pink-Floral-Print.jpeg" },
    { id: "DR-08", name: "Black Base Rose", price: 550, image: "images/Black-Base-Rose-Floral.jpeg" },
    { id: "DR-16", name: "Black White Polka", price: 550, image: "images/Black-White-Polka-Dots.jpeg" },
    { id: "DR-23", name: "Royal Blue Golden", price: 550, image: "images/Royal-Blue-Golden-Floral-Print.jpeg" },
    { id: "DR-28", name: "Pink Floral Printed Co-ord Set", price: 550, image: "images/pink-floral-printed-co-ord-set.jpeg" },
    {
      id: "DR-29",
      name: "Baby PinkLight Pink",
      price: 550,
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Baby%20PinkLight%20Pink.jpeg?raw=1"
    },
    {
      id: "DR-30",
      name: "Sage GreenMint Green",
      price: 550,
      image: "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/blob/main/images/Sage%20GreenMint%20Green.jpeg?raw=1"
    }
  ];

  var PLACEHOLDER_IMG = "Baby-Pink-Floral-Print.jpeg";

  function resolveItemImage(item) {
    if (!item) return "";
    var cat = item.id ? CATALOG.find(function (p) { return p.id === item.id; }) : findByName(item.name);
    var stored = String(item.image || "");
    if (stored && stored.indexOf(PLACEHOLDER_IMG) === -1) return stored;
    if (cat && cat.image) return cat.image;
    return stored;
  }

  function findByName(name) {
    var n = String(name || "").trim().toLowerCase();
    for (var i = 0; i < CATALOG.length; i++) {
      if (CATALOG[i].name.trim().toLowerCase() === n) return CATALOG[i];
    }
    return null;
  }

  function normalizeLine(item) {
    if (!item || !item.name) return null;
    var qty = parseInt(item.quantity, 10);
    if (isNaN(qty) || qty < 1) return null;
    var cat = item.id ? CATALOG.find(function (p) { return p.id === item.id; }) : findByName(item.name);
    var line = {
      id: item.id || (cat && cat.id) || "",
      name: item.name,
      price: parseInt(item.price, 10) || (cat && cat.price) || 550,
      quantity: qty,
      image: item.image || (cat && cat.image) || ""
    };
    line.image = resolveItemImage(line);
    return line;
  }

  function normalizeArray(arr) {
    var map = {};
    if (!Array.isArray(arr)) return [];
    arr.forEach(function (raw) {
      var line = normalizeLine(raw);
      if (!line) return;
      var key = line.id || line.name;
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

  function loadStoreCart() {
    var keys = ["secured_checkout_cart", "category_cart_v2", "user_cart", "cart"];
    for (var i = 0; i < keys.length; i++) {
      var arr = parseStored(localStorage.getItem(keys[i]));
      if (arr.length > 0) {
        persistStoreCart(arr);
        return arr;
      }
    }
    try {
      var sess = parseStored(sessionStorage.getItem("cart"));
      if (sess.length > 0) {
        persistStoreCart(sess);
        return sess;
      }
    } catch (e2) {}
    return [];
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
    var key = line.id || line.name;
    var found = list.find(function (x) {
      return (x.id && x.id === key) || x.name === line.name;
    });
    if (found) {
      found.quantity = (parseInt(found.quantity, 10) || 0) + line.quantity;
    } else {
      list.push(line);
    }
    return persistStoreCart(list);
  }

  global.STORE_CATALOG = CATALOG;
  global.loadStoreCart = loadStoreCart;
  global.persistStoreCart = persistStoreCart;
  global.clearStoreCart = clearStoreCart;
  global.normalizeStoreCart = normalizeArray;
  global.homeCartObjectToArray = objectToArray;
  global.cartTotalQty = cartTotalQty;
  global.addOrMergeStoreCartItem = addOrMergeItem;
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
    return payload;
  }

  global.refreshCartBadgeUI = refreshCartBadgeUI;
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
