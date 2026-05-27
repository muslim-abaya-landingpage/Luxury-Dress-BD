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

  function saveOrderTracking(payload) {
    if (!payload) return;
    try {
      sessionStorage.setItem(ORDER_TRACKING_KEY, JSON.stringify(payload));
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
    var payload = { event: eventName };
    if (data && typeof data === "object") {
      var k;
      for (k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k)) payload[k] = data[k];
      }
    }
    if (!payload.currency) payload.currency = "BDT";
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
    if (!merged.transaction_id) {
      merged.transaction_id = "order_" + Date.now();
    }
    merged.event = "purchase_complete";
    merged.currency = merged.currency || "BDT";
    if (typeof merged.order_value === "undefined" && typeof merged.value !== "undefined") {
      merged.order_value = merged.value;
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(merged);
    return merged;
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
})(typeof window !== "undefined" ? window : this);
