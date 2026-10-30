/* Size Manager core: turns the published size configuration (from D1, served by /api/size-config) into the
   measurement fields one product shows, and checks a customer's choices against them.
   The same file runs in the browser (window.maSizeCore) and in Apps Script (apps-script/SizeCore.gs is
   generated from it by scripts/build-size-core.mjs), so the website and the order check never disagree.
   ES5 only, no DOM / network / storage.

   config = { version, categories: {key: {template, enabled}}, templates: {id: {id, name_bn, name_en, fields: [
     {key, label_bn, label_en, required, enabled, allowCustom, default, legacy: [slot], options: [{value, label_bn, label_en}]}]}},
     products: {id: {template, enabled, useTemplate, fields: {key: {label_bn, label_en, required, enabled, allowCustom, default, options}}}} }
   product = { id, category, sizeLegacy: {slot: [values]} }  (sizeLegacy: the size lists the old pickers show) */
(function (root) {
  var KEY_RE = /^(?!__proto__$)[a-z0-9_]{1,40}$/; // never "__proto__": keys become object property names
  var BAD_TEXT_RE = /[<>{}`\\\u0000-\u001f]/;
  var MAX_CUSTOM = 40;
  var LEGACY_SLOTS = ["body", "length", "dressLength", "sleeve", "palazzo", "sizes"];

  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function str(v) { return v == null ? "" : String(v); }
  function norm(s) {
    return str(s).trim().toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
  }
  function label(bn, en, fallback) { return str(bn).trim() || str(en).trim() || str(fallback); }
  function safeText(v, max) {
    var s = str(v).trim();
    return s.length <= max && !BAD_TEXT_RE.test(s);
  }

  function toOptions(list) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (o) {
      var isObj = o && typeof o === "object";
      var value = str(isObj ? o.value : o).trim();
      if (!value || has(seen, norm(value))) return;
      seen[norm(value)] = true;
      out.push({ value: value, label: label(isObj ? o.label_bn : "", isObj ? o.label_en : "", value) });
    });
    return out;
  }

  function hasLegacy(product) {
    var l = product && product.sizeLegacy;
    if (!l || typeof l !== "object") return false;
    return LEGACY_SLOTS.some(function (s) { return Array.isArray(l[s]) && l[s].length; });
  }

  /** The fields one product shows, or null when it keeps the old size pickers (category off, no template). */
  function resolve(config, product) {
    if (!config || typeof config !== "object" || !config.templates || !product) return null;
    var cat = (config.categories && has(config.categories, product.category) && config.categories[product.category]) || null;
    // Only the Size Manager categories take part (Kaftan / Karchupi never do, even with a product override).
    if (!cat) return null;
    var own = (config.products && has(config.products, product.id) && config.products[product.id]) || null;
    var enabled = own && typeof own.enabled === "boolean" ? own.enabled : !!(cat && cat.enabled === true);
    if (!enabled) return null;
    var templateId = (own && own.template) || (cat && cat.template) || "";
    var template = has(config.templates, templateId) ? config.templates[templateId] : null;
    if (!template || !Array.isArray(template.fields)) return null;
    // Existing products keep offering exactly their old sizes; new products get the template's values.
    var legacyMode = !(own && own.useTemplate === true) && hasLegacy(product);
    var overrides = (own && own.fields && typeof own.fields === "object") ? own.fields : {};
    var fields = [];
    template.fields.forEach(function (f) {
      if (!f || !KEY_RE.test(str(f.key))) return;
      var o = has(overrides, f.key) && overrides[f.key] && typeof overrides[f.key] === "object" ? overrides[f.key] : {};
      var on = typeof o.enabled === "boolean" ? o.enabled : f.enabled !== false;
      if (!on) return;
      var ownOptions = Array.isArray(o.options);
      var options;
      if (ownOptions) options = toOptions(o.options);
      else if (legacyMode) {
        options = [];
        (Array.isArray(f.legacy) ? f.legacy : []).some(function (slot) {
          var v = product.sizeLegacy[slot];
          if (Array.isArray(v) && v.length) { options = toOptions(v); return true; }
          return false;
        });
      } else options = toOptions(f.options);
      var allowCustom = typeof o.allowCustom === "boolean" ? o.allowCustom : f.allowCustom === true;
      // An old product that never had this measurement keeps not asking for it.
      if (!options.length && (!allowCustom || (legacyMode && !ownOptions))) return;
      var dflt = str(has(o, "default") ? o["default"] : f["default"]).trim();
      // Never preselect a value the customer could not submit.
      if (dflt && !allowCustom && !options.some(function (x) { return norm(x.value) === norm(dflt); })) dflt = "";
      fields.push({
        key: f.key,
        label: label(has(o, "label_bn") ? o.label_bn : f.label_bn, has(o, "label_en") ? o.label_en : f.label_en, f.key),
        required: typeof o.required === "boolean" ? o.required : f.required !== false,
        allowCustom: allowCustom,
        options: options,
        "default": dflt
      });
    });
    if (!fields.length) return null;
    return { templateId: template.id || templateId, version: config.version || 0, fields: fields };
  }

  function toMap(measurements) {
    var map = {}, dup = false, bad = false;
    if (Array.isArray(measurements)) {
      measurements.forEach(function (m) {
        var k = str(m && m.key);
        if (!KEY_RE.test(k)) { bad = true; return; }
        if (has(map, k)) dup = true;
        map[k] = str(m && m.value).trim();
      });
    } else if (measurements && typeof measurements === "object") {
      Object.keys(measurements).forEach(function (k) {
        if (!KEY_RE.test(k)) { bad = true; return; }
        map[k] = str(measurements[k]).trim();
      });
    }
    return { map: map, dup: dup, bad: bad };
  }

  /** Checks a customer's choices. Returns {ok, errors: [{key, code}], measurements: [{key, label, value, custom}], size}. */
  function validate(resolved, measurements) {
    var fields = (resolved && resolved.fields) || [];
    var given = toMap(measurements), errors = [], clean = [], parts = [], known = {};
    if (given.dup || given.bad) errors.push({ key: "", code: "MALFORMED" });
    fields.forEach(function (f) {
      known[f.key] = true;
      var v = has(given.map, f.key) ? given.map[f.key] : "";
      if (!v) { if (f.required) errors.push({ key: f.key, code: "REQUIRED" }); return; }
      var opt = null;
      f.options.forEach(function (o) { if (!opt && norm(o.value) === norm(v)) opt = o; });
      if (!opt && (!f.allowCustom || !safeText(v, MAX_CUSTOM))) { errors.push({ key: f.key, code: "INVALID" }); return; }
      clean.push({ key: f.key, label: f.label, value: opt ? opt.value : v, custom: !opt });
      parts.push(f.label + " " + (opt ? opt.label : v));
    });
    Object.keys(given.map).forEach(function (k) { if (!known[k] && KEY_RE.test(k)) errors.push({ key: k, code: "UNKNOWN" }); });
    return { ok: !errors.length, errors: errors, measurements: clean, size: parts.join(" · ").slice(0, 160) };
  }

  /** Label-independent stock key, e.g. "body=46|length=54". */
  function variantKey(measurements) {
    return (Array.isArray(measurements) ? measurements : []).map(function (m) {
      return m.key + "=" + norm(m.value);
    }).join("|");
  }

  root.maSizeCore = {
    LEGACY_SLOTS: LEGACY_SLOTS,
    KEY_RE: KEY_RE,
    BAD_TEXT_RE: BAD_TEXT_RE,
    norm: norm,
    safeText: safeText,
    resolve: resolve,
    validate: validate,
    variantKey: variantKey
  };
})(typeof window !== "undefined" ? window : this);
