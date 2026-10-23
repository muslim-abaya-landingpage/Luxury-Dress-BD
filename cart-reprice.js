/* Keeps cart prices in step with the current catalog.

   A cart line stores the price from the moment it was added. If the owner changes a price later, the
   order server (Apps Script opsLinePrice_) prices the order from the current catalog and rejects the
   order when the totals differ. This file prices each line with the same rules the server uses
   (port of apps-script/Operations.gs opsLinePrice_, read from catalog-validation.json — the exact data
   the server reads), so checkout can update the cart and show the new total before the order is sent.

   Lines that cannot be priced here (unknown product, unclear option or size) are left unchanged; the
   server still checks them. */
(function (g) {
  "use strict";

  /** Unit price the order server will charge for this cart line, or null if it cannot be worked out. */
  function serverUnitPrice(line, p) {
    if (!line || !p) return null;
    var price = Number(p.price);
    var type = String(line.productType || "");
    if (p.prices) {
      var key = Object.keys(p.prices).filter(function (k) {
        return k.replace(/\s/g, "").toLowerCase() === type.replace(/\s/g, "").toLowerCase();
      })[0];
      if (!key) return null;
      price = Number(p.prices[key]);
    }
    var size = String(line.size || line.selectedSize || "").trim();
    if (!size) return null;
    if (/^Custom/i.test(size)) {
      var custom = /^Custom\s*\(L:?([\d.]+)[\s/]+W:?([\d.]+)/i.exec(size);
      if (!custom) return null;
      var l = Number(custom[1]), w = Number(custom[2]);
      if (!isFinite(l) || !isFinite(w) || l <= 0 || w <= 0) return null;
      [["length", "lengthExtra", l], ["width", "widthExtra", w]].forEach(function (dim) {
        var rows = (p.custom || []).slice().sort(function (a, b) { return a[dim[0]] - b[dim[0]]; });
        var row = rows.filter(function (r) { return Number(r[dim[0]]) >= dim[2]; })[0] || rows[rows.length - 1];
        price += row ? (Number(row[dim[1]]) || 0) : 0;
      });
    }
    if (!isFinite(price) || price <= 0) return null;
    return price;
  }

  var lastSource = { live: false, at: 0 };

  function fetchCatalog(timeoutMs) {
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeoutMs || 5000) : 0;
    return fetch("/catalog-validation.json?cart=" + Date.now(), { cache: "no-store", signal: ctrl ? ctrl.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw new Error("CATALOG_UNAVAILABLE");
        lastSource = { live: res.headers.get("X-MA-Live") === "1", at: Date.now() };
        return res.json();
      })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  /**
   * Re-prices cart lines. Resolves {lines, changes:[{name, from, to}]}; lines is a new array (same
   * objects copied) with updated prices. Never rejects: on any problem the cart is returned unchanged.
   */
  function reprice(lines, options) {
    var list = Array.isArray(lines) ? lines : [];
    if (!list.length) return Promise.resolve({ lines: list, changes: [] });
    return fetchCatalog(options && options.timeoutMs)
      .then(function (data) {
        var byId = {};
        (data && data.products || []).forEach(function (p) { byId[String(p.id)] = p; });
        var changes = [];
        var out = list.map(function (line) {
          var p = line && line.id != null ? byId[String(line.id).trim()] : null;
          var unit = serverUnitPrice(line, p);
          var old = parseInt(line && line.price, 10) || 0;
          if (unit == null || Math.round(unit) === old) return line;
          changes.push({ name: (p && p.name) || line.name || "", from: old, to: Math.round(unit) });
          return Object.assign({}, line, { price: Math.round(unit) });
        });
        return { lines: out, changes: changes };
      })
      .catch(function () { return { lines: list, changes: [] }; });
  }

  g.maCartReprice = reprice;
  g.maCartRepriceLastSource = function () { return lastSource; };
  g.maServerUnitPrice = serverUnitPrice;
})(window);
