/*
 * Example helper for a future color × size variant matrix.
 * This module is intentionally NOT loaded by the live storefront yet.
 * Before enabling it, carry variantKey through cart -> order -> stock reservation
 * and keep legacy size-only stock keys unchanged for existing products.
 */
(function (root) {
  "use strict";

  function norm(value) {
    return String(value == null ? "" : value).trim().toLowerCase().replace(/\s+/g, " ");
  }

  function makeVariantKey(variant) {
    var color = norm(variant && (variant.color || variant.colorLabel));
    var size = norm(variant && variant.size);
    if (!color || !size) throw new Error("প্রতিটি matrix variant-এ color এবং size আবশ্যক।");
    return "color=" + encodeURIComponent(color) + "|size=" + encodeURIComponent(size);
  }

  function validateVariantMatrix(rows) {
    var errors = [], seenSku = Object.create(null), seenCombination = Object.create(null);
    if (!Array.isArray(rows) || !rows.length) return ["অন্তত একটি variant row যোগ করুন।"];
    rows.forEach(function (variant, index) {
      var n = index + 1;
      var sku = String(variant && variant.sku || "").trim();
      var color = String(variant && (variant.color || variant.colorLabel) || "").trim();
      var size = String(variant && variant.size || "").trim();
      var price = Number(variant && variant.price);
      if (!sku) errors.push("সারি " + n + ": Variant SKU খালি।");
      else if (seenSku[sku.toLowerCase()]) errors.push("সারি " + n + ": Variant SKU duplicate — " + sku);
      if (sku) seenSku[sku.toLowerCase()] = true;
      if (!color) errors.push("সারি " + n + ": Color খালি।");
      if (!size) errors.push("সারি " + n + ": Size খালি।");
      if (!Number.isFinite(price) || price < 0) errors.push("সারি " + n + ": Price সঠিক নয়।");
      if (color && size) {
        var combo = norm(color) + "\u001f" + norm(size);
        if (seenCombination[combo]) errors.push("সারি " + n + ": একই Color × Size combination দুইবার আছে।");
        seenCombination[combo] = true;
      }
      if (variant && variant.stock != null && variant.stock !== "" && (!Number.isInteger(Number(variant.stock)) || Number(variant.stock) < 0)) {
        errors.push("সারি " + n + ": Stock শূন্য বা ধনাত্মক পূর্ণসংখ্যা হতে হবে।");
      }
    });
    return errors;
  }

  function findVariant(rows, color, size) {
    var targetColor = norm(color), targetSize = norm(size);
    return (rows || []).find(function (variant) {
      return norm(variant.color || variant.colorLabel) === targetColor && norm(variant.size) === targetSize;
    }) || null;
  }

  function listColors(rows) {
    var seen = Object.create(null), out = [];
    (rows || []).forEach(function (variant) {
      var key = norm(variant.color || variant.colorLabel);
      if (key && !seen[key]) { seen[key] = true; out.push({ id: variant.color || key, label: variant.colorLabel || variant.color || key }); }
    });
    return out;
  }

  function listSizesForColor(rows, color) {
    var seen = Object.create(null), out = [], targetColor = norm(color);
    (rows || []).forEach(function (variant) {
      var size = String(variant.size || "").trim();
      if (norm(variant.color || variant.colorLabel) === targetColor && size && !seen[norm(size)]) {
        seen[norm(size)] = true; out.push(size);
      }
    });
    return out;
  }

  var api = {
    makeVariantKey: makeVariantKey,
    validateVariantMatrix: validateVariantMatrix,
    findVariant: findVariant,
    listColors: listColors,
    listSizesForColor: listSizesForColor
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MaVariantMatrixExample = api;
})(typeof window !== "undefined" ? window : globalThis);
