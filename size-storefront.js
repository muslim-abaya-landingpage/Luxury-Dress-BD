/* Size Manager on the shop pages: shows a product's measurement fields from the published size configuration
   (window.MA_SIZE_CONFIG, attached to product-config.js by functions/_lib/size-carrier.js) and reads the
   customer's choices. size-core.js decides which fields a product shows and checks the choices, the same way
   the order check (apps-script/SizeCore.gs) does.
   No configuration, a category that is switched off, Kaftan / Karchupi, or a product whose per-size stock rows
   do not match the fields' size texts: resolveFor() returns null and the page keeps its old size pickers. ES5. */
(function (g) {
  "use strict";

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function trackedSizeRows(p) {
    var v = p && p.stockVariants;
    if (!v || typeof v !== "object") return [];
    return Object.keys(v).filter(function (k) { return k !== "_default" && v[k] && v[k].tracked === true; });
  }
  function hasPerSizeStock(p) { return trackedSizeRows(p).length > 0; }

  function stockKey(s) { return String(s || "").replace(/\s+/g, " ").trim().toLowerCase(); }

  /** Every size text the required option fields can produce (size-core validate), or null if too many / free text. */
  function sizeTexts(resolved, limit) {
    var fields = resolved.fields.filter(function (f) { return f.required; });
    if (fields.some(function (f) { return !f.options.length; })) return null;
    var combos = [{}];
    for (var i = 0; i < fields.length; i++) {
      var next = [];
      for (var c = 0; c < combos.length; c++) {
        for (var o = 0; o < fields[i].options.length; o++) {
          var m = {};
          Object.keys(combos[c]).forEach(function (k) { m[k] = combos[c][k]; });
          m[fields[i].key] = fields[i].options[o].value;
          next.push(m);
        }
      }
      if (next.length > limit) return null;
      combos = next;
    }
    return combos.map(function (m) { return g.maSizeCore.validate(resolved, m).size; });
  }

  // Stock rows are keyed by the size text. A product with per-size stock uses the new fields only when every
  // tracked row is a size text the fields produce (e.g. abaya "Body 46 · Length 54"); otherwise it keeps the
  // old pickers, so stock keeps matching. The order check rebuilds the same text from the choices.
  function stockRowsMatch(resolved, p) {
    var rows = trackedSizeRows(p);
    if (!rows.length) return true;
    var texts = sizeTexts(resolved, 400);
    if (!texts) return false;
    var set = {};
    texts.forEach(function (t) { set[stockKey(t)] = true; });
    return rows.every(function (k) { return set[stockKey(k)] === true; });
  }

  /** The fields this product shows ({templateId, version, fields}), or null for the old size pickers. */
  function resolveFor(p, categoryKey) {
    var core = g.maSizeCore, cfg = g.MA_SIZE_CONFIG;
    if (!core || !cfg || !p || !p.id) return null;
    var category = String(p.category || categoryKey || "");
    var legacy = typeof g.getSizeLegacySlots === "function" ? g.getSizeLegacySlots(p, category) : {};
    var resolved = null;
    try {
      resolved = core.resolve(cfg, { id: String(p.id), category: category, sizeLegacy: legacy || {} });
    } catch (e) {
      return null;
    }
    return resolved && stockRowsMatch(resolved, p) ? resolved : null;
  }

  function hasOption(f, value) {
    var n = g.maSizeCore.norm(value);
    return f.options.some(function (o) { return g.maSizeCore.norm(o.value) === n; });
  }

  /** Starting choice per field: the default, else the first option of a required field (like the old pickers). */
  function initialValues(resolved) {
    var out = {};
    resolved.fields.forEach(function (f) {
      if (f["default"]) out[f.key] = f["default"];
      else if (f.required && f.options.length) out[f.key] = f.options[0].value;
    });
    return out;
  }

  /**
   * Markup for the fields. o: {fieldClass, headClass, labelClass, rowClass, btnClass, idx, values, headExtra
   * (the page's own markup, e.g. its size-chart link, placed beside the first label)}. Buttons carry
   * data-sz-key / data-sz-value; a field that accepts other values gets a text box (data-sz-custom).
   */
  var CSS =
    ".ma-sz-field{margin:0 0 12px}.ma-sz-req{color:#b42318}.ma-sz-opt{font-weight:400;opacity:.7;font-size:.9em}" +
    ".ma-sz-custom{display:block;width:100%;max-width:260px;box-sizing:border-box;margin-top:8px;padding:9px 11px;border:1px solid #c9c2d6;" +
    "border-radius:8px;font:inherit;font-size:15px;background:#fff;color:#1f1a2b}" +
    ".ma-sz-field.is-invalid .ma-sz-custom,.ma-sz-field.is-invalid [data-sz-value]{border-color:#b42318}" +
    ".ma-sz-error{margin:6px 0 0;color:#b42318;font-size:13px;font-weight:600}";

  function ensureCss() {
    var d = g.document;
    if (!d || d.getElementById("ma-sz-css")) return;
    var el = d.createElement("style");
    el.id = "ma-sz-css";
    el.textContent = CSS;
    (d.head || d.documentElement).appendChild(el);
  }

  function html(resolved, o) {
    o = o || {};
    ensureCss();
    var values = initialValues(resolved);
    // Keep earlier choices (o.values) when the fields are drawn again, if they are still allowed.
    resolved.fields.forEach(function (f) {
      var prev = o.values && o.values[f.key];
      if (prev && (f.allowCustom || hasOption(f, prev))) values[f.key] = prev;
    });
    return '<div class="ma-sz" data-sz-template="' + esc(resolved.templateId) + '">' +
      resolved.fields.map(function (f, i) {
        var v = values[f.key] || "";
        var custom = v && !hasOption(f, v) ? v : "";
        var id = "maSz" + (o.idx == null ? "" : o.idx) + "_" + f.key;
        return '<div class="ma-sz-field ' + (o.fieldClass || "") + '" data-sz-field="' + esc(f.key) + '"' + (f.required ? "" : ' data-sz-optional="1"') + '>' +
          '<div class="' + (o.headClass || "") + '"><span class="' + (o.labelClass || "") + '" id="' + id + '_l">' + esc(f.label) +
          (f.required ? ' <span class="ma-sz-req" aria-hidden="true">*</span>' : ' <span class="ma-sz-opt">(ঐচ্ছিক)</span>') +
          "</span>" + (i === 0 && o.headExtra ? o.headExtra : "") + "</div>" +
          (f.options.length
            ? '<div class="' + (o.rowClass || "") + '" role="group" aria-labelledby="' + id + '_l">' +
              f.options.map(function (opt) {
                var on = !custom && v && g.maSizeCore.norm(v) === g.maSizeCore.norm(opt.value);
                return '<button type="button" class="' + (o.btnClass || "") + (on ? " is-active" : "") + '" data-sz-key="' + esc(f.key) +
                  '" data-sz-value="' + esc(opt.value) + '" aria-pressed="' + (on ? "true" : "false") + '">' + esc(opt.label) + "</button>";
              }).join("") +
              "</div>"
            : "") +
          (f.allowCustom
            ? '<input type="text" class="ma-sz-custom" data-sz-custom="' + esc(f.key) + '" maxlength="40" autocomplete="off" inputmode="text"' +
              ' aria-labelledby="' + id + '_l" placeholder="' + (f.options.length ? "অন্য মাপ লিখুন" : "মাপ লিখুন") + '" value="' + esc(custom) + '">'
            : "") +
          '<p class="ma-sz-error" role="alert" hidden></p>' +
          "</div>";
      }).join("") +
      "</div>";
  }

  /** The customer's current choices inside `scope`, as size-core's {key: value}. */
  function read(scope) {
    var out = {};
    if (!scope) return out;
    Array.prototype.forEach.call(scope.querySelectorAll(".ma-sz-field"), function (field) {
      var key = field.getAttribute("data-sz-field");
      var input = field.querySelector("[data-sz-custom]");
      var typed = input ? String(input.value || "").trim() : "";
      var active = field.querySelector("[data-sz-value].is-active");
      var v = typed || (active ? active.getAttribute("data-sz-value") : "");
      if (v) out[key] = v;
    });
    return out;
  }

  var MESSAGES = { REQUIRED: "এই মাপটি বেছে নিন।", INVALID: "এই মাপটি গ্রহণযোগ্য নয়।" };

  /**
   * Checks the choices in `scope` (size-core validate). With showErrors, marks the wrong fields and moves to
   * the first one. Returns {ok, measurements, size, errors}.
   */
  function check(resolved, scope, showErrors) {
    var r = g.maSizeCore.validate(resolved, read(scope));
    if (showErrors && scope) {
      var bad = {};
      r.errors.forEach(function (e) { if (e.key && !bad[e.key]) bad[e.key] = MESSAGES[e.code] || MESSAGES.INVALID; });
      var first = null;
      Array.prototype.forEach.call(scope.querySelectorAll(".ma-sz-field"), function (field) {
        var msg = bad[field.getAttribute("data-sz-field")] || "";
        var el = field.querySelector(".ma-sz-error");
        field.classList.toggle("is-invalid", !!msg);
        if (el) { el.textContent = msg; el.hidden = !msg; }
        if (msg && !first) first = field;
      });
      if (first) {
        if (first.scrollIntoView) first.scrollIntoView({ block: "center", behavior: "smooth" });
        var focusEl = first.querySelector("[data-sz-value], [data-sz-custom]");
        if (focusEl && focusEl.focus) focusEl.focus({ preventScroll: true });
      }
    }
    return r;
  }

  function clearError(field) {
    field.classList.remove("is-invalid");
    var el = field.querySelector(".ma-sz-error");
    if (el) { el.textContent = ""; el.hidden = true; }
  }

  function changed(field) {
    clearError(field);
    try {
      field.dispatchEvent(new CustomEvent("ma:size-change", { bubbles: true }));
    } catch (e) {}
  }

  // One listener for every page: picking an option, or typing another value.
  if (g.document && !g.__maSizeStoreBound) {
    g.__maSizeStoreBound = true;
    g.document.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest("[data-sz-value]") : null;
      if (!btn) return;
      var field = btn.closest(".ma-sz-field");
      if (!field) return;
      // A second tap on the chosen value of an optional field clears it.
      var pick = !(btn.classList.contains("is-active") && field.hasAttribute("data-sz-optional"));
      Array.prototype.forEach.call(field.querySelectorAll("[data-sz-value]"), function (b) {
        var on = pick && b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      var input = field.querySelector("[data-sz-custom]");
      if (input) input.value = "";
      changed(field);
    });
    g.document.addEventListener("input", function (ev) {
      var input = ev.target;
      if (!input || !input.getAttribute || input.getAttribute("data-sz-custom") == null) return;
      var field = input.closest(".ma-sz-field");
      if (!field) return;
      if (String(input.value || "").trim()) {
        Array.prototype.forEach.call(field.querySelectorAll("[data-sz-value]"), function (b) {
          b.classList.remove("is-active");
          b.setAttribute("aria-pressed", "false");
        });
      }
      changed(field);
    });
  }

  g.maSizeStore = {
    resolveFor: resolveFor,
    hasPerSizeStock: hasPerSizeStock,
    sizeTexts: sizeTexts,
    initialValues: initialValues,
    html: html,
    read: read,
    check: check
  };
})(typeof window !== "undefined" ? window : this);
