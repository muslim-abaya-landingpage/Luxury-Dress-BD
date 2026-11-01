/* Product Manager → Edit product: WooCommerce-style "Attributes" and "Variations" panels.

   Attributes (renderAttributes): Add new / Add global, one box per attribute with Name, Value(s) separated
   by "|", "Visible on the product page" and "Used for variations", then "Save attributes". Attribute values
   live in the product's existing fields, so the storefront pickers keep working:
     Option = types (General tab), Color = colour variations, Body = bodySizes,
     Long = sizes (abaya) / dressLengths (two-piece), Sleeve = sleeveSizes, Palazzo = palazzoLengths,
     Size = sizes (other products). "Used for variations" is saved as product.variationAttributes.

   Variations (render): Generate variations / Add manually / Bulk actions and one card per variation
   (attribute selects, Remove, Edit → photo, SKU, Enabled, Manage stock?, Regular / Sale price, Stock
   quantity or Stock status). Saved in product.variations:
     { type, color, size, price, regularPrice, sku, image, enabled, stockStatus }
   size joins the chosen size parts in cart order ("Body 42 · Length 50", "Length 50", "M").
   price = what the customer pays (the sale price when there is one); regularPrice = the "before sale" price.
   The order server (Operations.gs opsVariation_), checkout (cart-reprice.js) and product page charge the
   most specific matching variation and refuse one that is disabled or out of stock.
   Stock quantities are not in the catalog: they go to the StockVariants sheet (key "colour · size")
   when the product is saved (flushStock). */
(function (g) {
  "use strict";

  var MAX_ROWS = 300;
  var SIZE_ATTRS = ["body", "length", "sleeve", "palazzo", "size"];

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(v) { return String(v || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function int(v) { var n = parseInt(v, 10); return n > 0 ? n : 0; }
  function list(a) {
    return (Array.isArray(a) ? a : []).map(function (s) { return String(s && typeof s === "object" ? s.value : s == null ? "" : s).trim(); }).filter(Boolean);
  }
  function kindOf(p, category) {
    if (typeof g.isAbayaProduct === "function" && g.isAbayaProduct(p, category)) return "abaya";
    if (typeof g.isTwoPieceProduct === "function" && g.isTwoPieceProduct(p, category)) return "two-piece";
    return "simple";
  }

  /** The attributes this product can have, with their current values (keys are what the cart sends). */
  function attributeDefs(p, category, ctx) {
    var kind = kindOf(p, category);
    var vals = function (arr, prefix) { return list(arr).map(function (v) { return { key: prefix + v, label: v }; }); };
    var defs = [
      { id: "type", name: "Option", values: (ctx.types || []).filter(Boolean).map(function (t) { return { key: t, label: t }; }), editIn: "the General tab (each option has its own price there)" },
      { id: "color", name: "Color", values: (ctx.colors || []).filter(function (c) { return c && c.key; }).map(function (c) { return { key: c.key, label: c.label || c.key, image: c.image || "" }; }), editIn: "Color variations below (each colour has its photo there)" }
    ];
    if (kind === "abaya") {
      var cfg = typeof g.getAbayaSizeConfig === "function" ? g.getAbayaSizeConfig(p) : {};
      var bodies = list(p.bodySizes).length ? list(p.bodySizes) : list(cfg.bodySizes && cfg.bodySizes.length ? cfg.bodySizes : [cfg.bodySizeLabel || "46 [Free size]"]);
      defs.push({ id: "body", name: "Body", field: "bodySizes", prefix: "Body ", values: vals(bodies, "Body ") });
      defs.push({ id: "length", name: "Long", field: "sizes", prefix: "Length ", values: vals(list(p.lengthSizes).length ? p.lengthSizes : p.sizes, "Length ") });
    } else if (kind === "two-piece") {
      var tp = typeof g.getTwoPieceSizeConfig === "function" ? g.getTwoPieceSizeConfig(p) : {};
      defs.push({ id: "body", name: "Body", field: "bodySizes", prefix: "Body ", values: vals(list(p.bodySizes).length ? p.bodySizes : tp.bodySizes, "Body ") });
      defs.push({ id: "length", name: "Long", field: "dressLengths", prefix: "Length ", values: vals(p.dressLengths, "Length ") });
      defs.push({ id: "sleeve", name: "Sleeve", field: "sleeveSizes", prefix: "Sleeve ", values: vals(p.sleeveSizes, "Sleeve ") });
      defs.push({ id: "palazzo", name: "Palazzo", field: "palazzoLengths", prefix: "Palazzo ", values: vals(p.palazzoLengths, "Palazzo ") });
    } else {
      var panjabi = typeof g.isPanjabiProduct === "function" && g.isPanjabiProduct(p, category);
      var seen = {};
      defs.push({ id: "size", name: "Size", field: "sizes", prefix: "", values: list(p.sizes).map(function (s) {
        return { key: panjabi ? s.split(" ")[0].toUpperCase() : s, label: s };
      }).filter(function (x) { if (seen[x.key]) return false; seen[x.key] = true; return true; }) });
    }
    return defs;
  }
  function defById(defs, id) { return defs.filter(function (d) { return d.id === id; })[0]; }

  /** Splits a saved variation into one value per attribute ({type, color, body, length, …}). */
  function parseRow(v, defs) {
    var out = { type: v.type || "", color: v.color || "" };
    var parts = String(v.size || "").split(/\s*·\s*/).filter(Boolean);
    var sizeDef = defById(defs, "size");
    if (sizeDef) { out.size = v.size || ""; return out; }
    parts.forEach(function (part) {
      var hit = defs.filter(function (d) { return d.prefix && norm(part).indexOf(norm(d.prefix)) === 0; })[0];
      if (hit) out[hit.id] = part;
    });
    return out;
  }
  function composeSize(row) {
    return SIZE_ATTRS.map(function (id) { return row[id] || ""; }).filter(Boolean).join(" · ");
  }
  function stockKey(v) {
    var c = String(v.color || "").trim(), s = String(v.size || "").trim();
    return c && s ? c + " · " + s : (s || c);
  }
  function rowKey(v) { return [norm(v.type), norm(v.color), norm(v.size)].join("\u001f"); }
  function skuFor(id, v) {
    var tail = [v.type, v.color, String(v.size || "").replace(/body |length |sleeve |palazzo /gi, "")].filter(Boolean).join("-");
    return (String(id || "SKU") + (tail ? "-" + tail : "")).replace(/[^A-Za-z0-9]+/g, "-").replace(/-+$/, "").toUpperCase().slice(0, 60);
  }
  /** Writes the two price boxes into a row: price = what the customer pays, regularPrice = before sale. */
  function setPrices(v, regular, sale) {
    regular = int(regular); sale = int(sale);
    delete v.price; delete v.regularPrice;
    if (sale && regular > sale) { v.price = sale; v.regularPrice = regular; }
    else if (regular) v.price = regular;
    else if (sale) v.price = sale;
  }
  function regularOf(v) { return v.regularPrice || v.price || ""; }
  function saleOf(v) { return v.regularPrice ? v.price : ""; }

  var CSS =
    ".pmw{font-size:13px;color:#1d2327}.pmw-notice{position:relative;margin:0 0 12px;padding:10px 32px 10px 12px;border-left:4px solid #72aee6;background:#fff;box-shadow:0 1px 1px rgba(0,0,0,.04)}" +
    ".pmw-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid #eee}.pmw-bar .pmw-right{margin-left:auto;color:#646970;font-style:italic}" +
    ".pmw-bar .pmw-right a,.pmw a.pmw-link{color:#2271b1;cursor:pointer;text-decoration:none}.pmw-bar .pmw-right a:hover,.pmw a.pmw-link:hover{text-decoration:underline}" +
    ".pmw-btn{min-height:34px;padding:0 14px;border:1px solid #2271b1;border-radius:3px;background:#f6f7f7;color:#2271b1;cursor:pointer}.pmw-btn:hover{background:#f0f0f1}" +
    ".pmw-btn-primary{background:#2271b1;color:#fff}.pmw-btn-primary:hover{background:#135e96}.pmw select{min-height:34px}" +
    ".pmw-box{border-bottom:1px solid #eee}.pmw-box-head{display:flex;align-items:center;gap:10px;padding:10px 0;cursor:pointer}.pmw-box-head b{flex:1}" +
    ".pmw-remove{color:#b32d2e;cursor:pointer;background:none;border:0;padding:0;font:inherit}.pmw-remove:hover{text-decoration:underline}" +
    ".pmw-box-body{display:grid;grid-template-columns:minmax(160px,1fr) 2fr;gap:10px 16px;padding:0 0 14px}.pmw-box-body label{display:block}" +
    ".pmw-box-body input[type=text],.pmw-box-body textarea{width:100%;box-sizing:border-box}.pmw-box-body textarea{min-height:90px}" +
    ".pmw-checks label{display:flex;gap:6px;align-items:center;margin:6px 0}.pmw-hint{color:#646970;font-size:12px;margin:4px 0 0}" +
    ".pmw-var{border-bottom:1px solid #eee}.pmw-var-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 0}.pmw-var-head .pmw-id{font-weight:600}" +
    ".pmw-var-head .pmw-actions{margin-left:auto;display:flex;gap:12px}.pmw-var-head select{max-width:180px}.pmw-var.is-off .pmw-var-head{opacity:.6}" +
    ".pmw-var.is-bad .pmw-var-head{background:#fcf0f1}.pmw-var-body{padding:4px 0 16px;display:grid;gap:12px}" +
    ".pmw-row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pmw-row2 label,.pmw-field label{display:block;margin-bottom:4px}.pmw-row2 input,.pmw-row2 select,.pmw-field input,.pmw-field select{width:100%;box-sizing:border-box;min-height:36px}" +
    ".pmw-img{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:150px;border:2px dashed #c3c4c7;border-radius:4px;color:#50575e;cursor:pointer;background:#fff}" +
    ".pmw-img img{max-width:100%;max-height:150px;object-fit:contain}.pmw-img .pmw-plus{font-size:30px;line-height:1}" +
    ".pmw-tiles{display:flex;flex-wrap:wrap;gap:6px}.pmw-tiles button{padding:0;border:2px solid transparent;background:none;cursor:pointer}.pmw-tiles button.is-on{border-color:#2271b1}" +
    ".pmw-tiles img{width:56px;height:56px;object-fit:cover;display:block}.pmw-cb{display:flex;flex-wrap:wrap;gap:18px;padding:8px 0;border-top:1px solid #f0f0f1;border-bottom:1px solid #f0f0f1}" +
    ".pmw-cb label{display:flex;gap:6px;align-items:center}.pmw-msg{font-size:12px;color:#646970;margin:8px 0 0}.pmw-msg.is-err{color:#b32d2e}.pmw-msg.is-ok{color:#008a20}" +
    ".pmw-empty{padding:18px 0;color:#646970}@media(max-width:700px){.pmw-box-body,.pmw-row2{grid-template-columns:1fr}}";
  function injectCss() {
    if (document.getElementById("pmw-css")) return;
    var s = document.createElement("style");
    s.id = "pmw-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /** Which attributes are "Used for variations" (saved choice, or worked out from the current variations). */
  function usedAttrs(p, defs, category) {
    if (Array.isArray(p.variationAttributes)) return p.variationAttributes.filter(function (id) { return !!defById(defs, id); });
    var rows = Array.isArray(p.variations) ? p.variations : [];
    var out = [];
    if (rows.length) {
      rows.forEach(function (v) {
        var r = parseRow(v, defs);
        defs.forEach(function (d) { if (r[d.id] && out.indexOf(d.id) === -1) out.push(d.id); });
      });
      return out;
    }
    defs.forEach(function (d) {
      if (d.id === "body" && kindOf(p, category) === "abaya") return; // usually one free size: vary by Long only
      if (d.values.length > 1 || (d.values.length && (d.id === "length" || d.id === "size"))) out.push(d.id);
    });
    return out;
  }

  var shared = { stock: {}, stockLoaded: false, stockEdits: {}, managed: {}, productId: "", admin: null, product: null, category: "" };
  function resetShared(p, ctx) {
    if (shared.productId === String(p.id) && shared.product === p) return;
    shared.stock = {}; shared.stockLoaded = false; shared.stockEdits = {}; shared.managed = {};
    shared.productId = String(p.id); shared.product = p; shared.category = ctx.category || ""; shared.admin = ctx.admin || null;
  }

  // ===================== Attributes panel =====================
  function renderAttributes(box, ctx) {
    if (!box) return;
    injectCss();
    var p = ctx.product;
    resetShared(p, ctx);
    var defs = attributeDefs(p, ctx.category, ctx);
    var st = box.__pmwAttr || (box.__pmwAttr = { added: [], open: {}, notice: true, productId: "" });
    if (st.productId !== String(p.id)) { st.added = []; st.open = {}; st.productId = String(p.id); }
    var used = usedAttrs(p, defs, ctx.category);
    var present = defs.filter(function (d) { return d.values.length || st.added.indexOf(d.id) !== -1; });
    var missing = defs.filter(function (d) { return present.indexOf(d) === -1; });

    function draw() {
      box.innerHTML = '<div class="pmw">' +
        (st.notice ? '<div class="pmw-notice">Add descriptive pieces of information that customers can use to search for this product on your store, such as “Long” or “Size”. <button type="button" class="pmw-remove" data-pa="notice" aria-label="Dismiss" style="position:absolute;right:10px;top:8px;color:#1d2327">✕</button></div>' : "") +
        '<div class="pmw-bar"><button type="button" class="pmw-btn" data-pa="new">Add new</button>' +
        '<select data-pa="global" aria-label="Add global attribute"><option value="">Add global</option>' + missing.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + "</option>"; }).join("") + "</select>" +
        '<span class="pmw-right"><a data-pa="expand">Expand</a> / <a data-pa="close">Close</a></span></div>' +
        present.map(function (d) {
          var open = st.open[d.id] !== false;
          var readonly = !d.field;
          return '<div class="pmw-box" data-attr="' + d.id + '"><div class="pmw-box-head" data-pa="toggle" data-id="' + d.id + '"><b>' + esc(d.name) + "</b>" +
            (readonly ? "" : '<button type="button" class="pmw-remove" data-pa="remove" data-id="' + d.id + '">Remove</button>') + "<span>≡</span><span>" + (open ? "▴" : "▾") + "</span></div>" +
            (open ? '<div class="pmw-box-body"><div><label>Name:</label><input type="text" value="' + esc(d.name) + '" readonly aria-label="Attribute name">' +
              '<div class="pmw-checks"><label><input type="checkbox" checked disabled> Visible on the product page</label>' +
              '<label><input type="checkbox" data-pa="used" data-id="' + d.id + '"' + (used.indexOf(d.id) !== -1 ? " checked" : "") + (d.values.length ? "" : " disabled") + "> Used for variations</label></div></div>" +
              '<div><label>Value(s):</label><textarea data-pa="values" data-id="' + d.id + '"' + (readonly ? " readonly" : "") + ' placeholder="Enter some descriptive text. Use “|” to separate different values.">' +
              esc(d.values.map(function (v) { return v.label; }).join(" | ")) + "</textarea>" +
              (readonly ? '<p class="pmw-hint">Edit these in ' + esc(d.editIn) + ".</p>" : '<p class="pmw-hint">Use “|” to separate values, e.g. 50 | 52 | 54 | 56.</p>') + "</div></div>" : "") +
            "</div>";
        }).join("") +
        (present.length ? "" : '<div class="pmw-empty">No attributes yet. Use Add new or Add global.</div>') +
        '<div class="pmw-bar" style="border:0"><button type="button" class="pmw-btn pmw-btn-primary" data-pa="save">Save attributes</button><span class="pmw-right"><a data-pa="expand">Expand</a> / <a data-pa="close">Close</a></span></div>' +
        '<p class="pmw-msg" data-pa-msg></p></div>';
    }
    function msg(t, k) { var el = box.querySelector("[data-pa-msg]"); if (el) { el.textContent = t; el.className = "pmw-msg" + (k ? " is-" + k : ""); } }
    function addAttr(id) {
      var d = defById(defs, id);
      if (!d) return;
      if (present.indexOf(d) === -1) { present.push(d); st.added.push(id); missing = missing.filter(function (x) { return x !== d; }); }
      st.open[id] = true;
      draw();
      if (!d.field) msg(d.name + " values are edited in " + d.editIn + ".", "");
      var ta = box.querySelector('[data-pa="values"][data-id="' + id + '"]');
      if (ta && !ta.readOnly) ta.focus();
    }
    // Writes the boxes into the product. Returns false when a value is too long.
    function apply() {
      var bad = "";
      present.forEach(function (d) {
        if (!d.field) return;
        var ta = box.querySelector('[data-pa="values"][data-id="' + d.id + '"]');
        if (!ta) return;
        var values = String(ta.value || "").split(/[|,，]/).map(function (s) { return s.replace(/\s+/g, " ").trim(); }).filter(Boolean);
        var uniq = values.filter(function (v, i) { return values.map(norm).indexOf(norm(v)) === i; });
        if (uniq.some(function (v) { return v.length > 40; })) { bad = d.name; return; }
        if (uniq.length) p[d.field] = uniq; else delete p[d.field];
        if (d.id === "length" && d.field === "sizes" && Array.isArray(p.lengthSizes)) { if (uniq.length) p.lengthSizes = uniq.slice(); else delete p.lengthSizes; }
      });
      if (bad) { msg("A " + bad + " value is too long (40 characters at most).", "err"); return; }
      var next = [];
      Array.prototype.forEach.call(box.querySelectorAll('[data-pa="used"]'), function (cb) { if (cb.checked) next.push(cb.getAttribute("data-id")); });
      // Boxes that are closed keep their earlier choice.
      used.forEach(function (id) { if (!box.querySelector('[data-pa="used"][data-id="' + id + '"]') && next.indexOf(id) === -1) next.push(id); });
      p.variationAttributes = next;
      return true;
    }
    // tab: the tab to open afterwards (set when the attributes are saved automatically on leaving the tab).
    function save(tab) {
      if (!apply()) return false;
      if (box.__pmwAttrLive) box.__pmwAttrLive.dirty = false;
      if (ctx.changed) ctx.changed(tab ? "Attributes saved automatically — click Save changes to publish." : "Attributes saved — open Variations, then click Save changes.");
      if (ctx.rerender) ctx.rerender(tab || "attributes", tab ? "Attributes saved automatically — click Save changes to publish." : "Attributes saved — open Variations, then click Save changes.");
      else { defs = attributeDefs(p, ctx.category, ctx); used = p.variationAttributes; draw(); msg("Attributes saved.", "ok"); }
      return true;
    }

    box.__pmwAttrLive = {
      // Unsaved edits in the boxes (values or "Used for variations"); saved for the user on leaving the tab or on Save changes.
      dirty: false,
      saveTo: function (tab) { return save(tab); },
      flush: function () { if (!this.dirty) return true; var ok = apply(); if (ok) this.dirty = false; return ok; },
      click: function (t) {
        var a = t.closest("[data-pa]");
        if (!a) return;
        var k = a.getAttribute("data-pa"), id = a.getAttribute("data-id");
        if (k === "notice") { st.notice = false; draw(); }
        else if (k === "new") {
          var name = g.prompt("Attribute name (for example Long, Body, Size, Sleeve, Palazzo, Color or Option):");
          if (name == null) return;
          var n = norm(name);
          var map = { long: "length", length: "length", "dress length": "length", body: "body", size: "size", sizes: "size", sleeve: "sleeve", palazzo: "palazzo", pajama: "palazzo", color: "color", colour: "color", option: "type", type: "type" };
          var want = map[n];
          if (!want || !defById(defs, want)) { msg("The product page can show these attributes for this product: " + defs.map(function (d) { return d.name; }).join(", ") + ".", "err"); return; }
          addAttr(want);
        } else if (k === "remove") {
          var d = defById(defs, id);
          if (!d || !d.field) return;
          if (!g.confirm("Remove this attribute? Its values are removed from the product.")) return;
          delete p[d.field];
          if (d.id === "length" && d.field === "sizes") delete p.lengthSizes;
          if (Array.isArray(p.variationAttributes)) p.variationAttributes = p.variationAttributes.filter(function (x) { return x !== id; });
          if (ctx.changed) ctx.changed("Attribute removed — click Save changes.");
          if (ctx.rerender) ctx.rerender("attributes", d.name + " removed.");
        } else if (k === "toggle" && !t.closest(".pmw-remove")) { st.open[id] = st.open[id] === false; draw(); }
        else if (k === "expand" || k === "close") { present.forEach(function (d) { st.open[d.id] = k === "expand"; }); draw(); }
        else if (k === "save") save();
      },
      change: function (t) {
        if (t.matches('[data-pa="used"], [data-pa="values"]')) this.dirty = true;
        if (t.matches('[data-pa="global"]') && t.value) addAttr(t.value);
      }
    };
    if (!box.__pmwAttrBound) {
      box.__pmwAttrBound = true;
      box.addEventListener("click", function (e) { if (box.__pmwAttrLive) box.__pmwAttrLive.click(e.target); });
      box.addEventListener("change", function (e) { if (box.__pmwAttrLive) box.__pmwAttrLive.change(e.target); });
      box.addEventListener("input", function (e) { if (box.__pmwAttrLive && e.target.matches('[data-pa="values"]')) box.__pmwAttrLive.dirty = true; });
    }
    draw();
  }

  // ===================== Variations panel =====================
  function render(box, ctx) {
    if (!box) return;
    injectCss();
    var p = ctx.product;
    resetShared(p, ctx);
    var defs = attributeDefs(p, ctx.category, ctx);
    var used = usedAttrs(p, defs, ctx.category).map(function (id) { return defById(defs, id); }).filter(function (d) { return d && d.values.length; });
    var photos = (ctx.photos || []).filter(Boolean);
    if (!Array.isArray(p.variations)) p.variations = [];
    var rows = p.variations;
    var st = box.__pmwVar || (box.__pmwVar = { open: {}, picker: {}, productId: "" });
    if (st.productId !== String(p.id)) { st.open = {}; st.picker = {}; st.productId = String(p.id); }
    var stockOk = !!(shared.admin && typeof shared.admin.getStockVariants === "function" && typeof shared.admin.commitStockCsv === "function");

    function fallback(v) { return ctx.basePrice ? ctx.basePrice(v.type) : p.price; }
    function duplicates() {
      var seen = {}, dup = {};
      rows.forEach(function (v, i) { var k = rowKey(v); if (seen[k] != null) { dup[i] = true; dup[seen[k]] = true; } else seen[k] = i; });
      return dup;
    }
    function stockValue(sk) {
      if (Object.prototype.hasOwnProperty.call(shared.stockEdits, sk)) return shared.stockEdits[sk];
      var cur = shared.stock[norm(sk)];
      return cur == null ? "" : cur;
    }
    function isManaged(sk) { return !!shared.managed[sk] || shared.stock[norm(sk)] != null || Object.prototype.hasOwnProperty.call(shared.stockEdits, sk); }

    function card(v, i, dup, firstForStock) {
      var r = parseRow(v, defs);
      var open = !!st.open[i];
      var sk = stockKey(v);
      var heads = used.map(function (d) {
        var cur = r[d.id] || "";
        var known = d.values.some(function (x) { return norm(x.key) === norm(cur); });
        return '<select data-pv="attr" data-attr="' + d.id + '" data-i="' + i + '" aria-label="' + esc(d.name) + '"><option value="">Any ' + esc(d.name) + "…</option>" +
          d.values.map(function (x) { return '<option value="' + esc(x.key) + '"' + (norm(x.key) === norm(cur) ? " selected" : "") + ">" + esc(x.label) + "</option>"; }).join("") +
          (cur && !known ? '<option value="' + esc(cur) + '" selected>' + esc(cur) + " (old)</option>" : "") + "</select>";
      }).join("");
      var bad = dup[i] || (v.regularPrice && v.price && v.price >= v.regularPrice);
      var body = "";
      if (open) {
        var managed = stockOk && sk && isManaged(sk);
        var stockHtml;
        if (!stockOk || !sk) stockHtml = '<div class="pmw-field"><label>Stock status</label><select data-pv="status" data-i="' + i + '"><option value="instock"' + (v.stockStatus === "outofstock" ? "" : " selected") + '>In stock</option><option value="outofstock"' + (v.stockStatus === "outofstock" ? " selected" : "") + ">Out of stock</option></select></div>";
        else if (managed && !firstForStock) stockHtml = '<p class="pmw-hint">Stock is shared with an earlier variation of the same colour and size.</p>';
        else if (managed) stockHtml = '<div class="pmw-row2"><div><label>Stock quantity</label><input type="number" min="0" step="1" data-pv="stock" data-sk="' + esc(sk) + '" value="' + esc(stockValue(sk)) + '" placeholder="' + (shared.stockLoaded ? "0" : "…") + '"></div><div></div></div>';
        else stockHtml = '<div class="pmw-field"><label>Stock status</label><select data-pv="status" data-i="' + i + '"><option value="instock"' + (v.stockStatus === "outofstock" ? "" : " selected") + '>In stock</option><option value="outofstock"' + (v.stockStatus === "outofstock" ? " selected" : "") + ">Out of stock</option></select></div>";
        var tiles = st.picker[i] ? '<div class="pmw-tiles" role="radiogroup" aria-label="Variation image">' + (photos.length ? photos.map(function (u, k) {
          return '<button type="button" class="' + (u === v.image ? "is-on" : "") + '" data-pv="pick" data-i="' + i + '" data-src="' + esc(u) + '" title="' + (k ? "Photo " + (k + 1) : "Main photo") + '"><img src="' + esc(u) + '" alt=""></button>';
        }).join("") : "<small>Add product photos first (Product gallery).</small>") + "</div>" : "";
        body = '<div class="pmw-var-body">' +
          '<div class="pmw-row2"><div><label>Variation image</label>' +
            (v.image ? '<div class="pmw-img" data-pv="picker" data-i="' + i + '"><img src="' + esc(v.image) + '" alt=""></div><a class="pmw-link" data-pv="noimg" data-i="' + i + '">Remove image</a>'
              : '<div class="pmw-img" data-pv="picker" data-i="' + i + '"><span class="pmw-plus">+</span><span>Add variation image</span></div>') + tiles + "</div>" +
            '<div><label>SKU</label><input type="text" maxlength="60" data-pv="sku" data-i="' + i + '" value="' + esc(v.sku || "") + '" placeholder="' + esc(p.id || "") + '" style="width:100%;min-height:36px;box-sizing:border-box"></div></div>' +
          '<div class="pmw-cb"><label><input type="checkbox" data-pv="enabled" data-i="' + i + '"' + (v.enabled === false ? "" : " checked") + "> Enabled</label>" +
            (stockOk && sk ? '<label><input type="checkbox" data-pv="manage" data-sk="' + esc(sk) + '"' + (managed ? " checked" : "") + (firstForStock ? "" : " disabled") + "> Manage stock?</label>" : "") + "</div>" +
          '<div class="pmw-row2"><div><label>Regular price (৳)</label><input type="number" min="0" data-pv="regular" data-i="' + i + '" value="' + esc(regularOf(v)) + '" placeholder="' + esc(fallback(v) || "") + '"></div>' +
            '<div><label>Sale price (৳)</label><input type="number" min="0" data-pv="sale" data-i="' + i + '" value="' + esc(saleOf(v)) + '"></div></div>' +
          stockHtml + "</div>";
      }
      return '<div class="pmw-var' + (v.enabled === false ? " is-off" : "") + (bad ? " is-bad" : "") + '" data-row="' + i + '"' + (dup[i] ? ' title="This combination appears twice"' : "") + ">" +
        '<div class="pmw-var-head"><span class="pmw-id">#' + (i + 1) + "</span>" + heads +
        (v.enabled === false ? " <em>Disabled</em>" : v.stockStatus === "outofstock" ? " <em>Out of stock</em>" : "") +
        '<span class="pmw-actions"><button type="button" class="pmw-remove" data-pv="del" data-i="' + i + '">Remove</button><a class="pmw-link" data-pv="edit" data-i="' + i + '">' + (open ? "Close" : "Edit") + "</a></span></div>" + body + "</div>";
    }

    function draw() {
      var dup = duplicates(), seenStock = {};
      var cards = rows.map(function (v, i) {
        var sk = norm(stockKey(v)), first = !seenStock[sk];
        seenStock[sk] = true;
        return card(v, i, dup, first);
      }).join("");
      box.innerHTML = '<div class="pmw">' +
        (used.length ? "" : '<div class="pmw-notice">Before you can add a variation you need to add some variation attributes on the <b>Attributes</b> tab (tick “Used for variations”).</div>') +
        '<div class="pmw-bar"><button type="button" class="pmw-btn" data-pv="generate"' + (used.length ? "" : " disabled") + ">Generate variations</button>" +
        '<button type="button" class="pmw-btn" data-pv="add"' + (used.length ? "" : " disabled") + ">Add manually</button>" +
        '<select data-pv="bulk" aria-label="Bulk actions"><option value="">Bulk actions</option><option value="delete">Delete all variations</option>' +
        '<optgroup label="Status"><option value="toggle-enabled">Toggle "Enabled"</option></optgroup>' +
        '<optgroup label="Pricing"><option value="regular">Set regular prices</option><option value="regular-up">Increase regular prices (fixed amount or %)</option><option value="regular-down">Decrease regular prices (fixed amount or %)</option>' +
        '<option value="sale">Set sale prices</option><option value="sale-up">Increase sale prices (fixed amount or %)</option><option value="sale-down">Decrease sale prices (fixed amount or %)</option><option value="nosale">Remove sale prices</option></optgroup>' +
        '<optgroup label="Inventory">' + (stockOk ? '<option value="toggle-manage">Toggle "Manage stock"</option><option value="stock">Stock</option>' : "") +
        '<option value="instock">Set Status - In stock</option><option value="outofstock">Set Status - Out of stock</option><option value="sku">Fill empty SKUs</option></optgroup></select>' +
        '<span class="pmw-right">' + rows.length + " variation" + (rows.length === 1 ? "" : "s") + ' (<a data-pv="expand">Expand</a> / <a data-pv="close">Close</a>)</span></div>' +
        (rows.length ? cards : '<div class="pmw-empty">' + (used.length ? "No variations yet. Press <b>Generate variations</b> to make one for each combination of " + used.map(function (d) { return esc(d.name); }).join(" × ") + ", or <b>Add manually</b>. Without variations the product works exactly as before." : "") + "</div>") +
        '<p class="pmw-msg" data-pv-msg>' + (rows.length ? "Blank regular price = the product/option price. Prices and stock are saved with <b>Save changes</b>." : "") + "</p></div>";
    }
    function msg(t, k) { var el = box.querySelector("[data-pv-msg]"); if (el) { el.textContent = t; el.className = "pmw-msg" + (k ? " is-" + k : ""); } }
    function save(note) {
      if (rows.length) p.variations = rows; else delete p.variations;
      if (ctx.changed) ctx.changed(note);
    }
    function rowFrom(parts) {
      var v = {};
      if (parts.type) v.type = parts.type;
      if (parts.color) v.color = parts.color;
      var size = defById(defs, "size") ? (parts.size || "") : composeSize(parts);
      if (size) v.size = size;
      return v;
    }
    function generate() {
      if (!used.length) return;
      var combos = [{}];
      used.forEach(function (d) {
        var next = [];
        combos.forEach(function (c) { d.values.forEach(function (x) { var o = Object.assign({}, c); o[d.id] = x.key; next.push(o); }); });
        combos = next;
      });
      if (combos.length > MAX_ROWS) { msg("That makes " + combos.length + " variations; the limit is " + MAX_ROWS + ". Untick an attribute on the Attributes tab.", "err"); return; }
      if (!g.confirm("Do you want to generate all variations? This will create a new variation for each and every possible combination of variation attributes (" + combos.length + ").")) return;
      var have = {};
      rows.forEach(function (v) { have[rowKey(v)] = true; });
      var added = 0;
      combos.forEach(function (c) {
        var v = rowFrom(c);
        if (have[rowKey(v)] || rows.length >= MAX_ROWS) return;
        v.sku = skuFor(p.id, v);
        var col = c.color && defById(defs, "color").values.filter(function (x) { return x.key === c.color; })[0];
        if (col && col.image) v.image = col.image;
        rows.push(v);
        have[rowKey(v)] = true;
        added++;
      });
      draw();
      save(added ? added + " variation(s) added — click Save changes." : "");
      msg(added ? added + " variations added." : "No variations added: every combination already exists.", added ? "ok" : "");
    }
    function bulk(action) {
      if (!action) return;
      if (!rows.length && action !== "delete") { msg("No variations yet.", "err"); return; }
      var ask = function (q) { var a = g.prompt(q); return a == null ? null : String(a).trim(); };
      var amount = function (q) {
        var a = ask(q);
        if (a == null) return null;
        var m = /^(\d+(?:\.\d+)?)\s*(%?)$/.exec(a);
        if (!m) { msg("Enter a number like 100 or 10%.", "err"); return null; }
        return { n: Number(m[1]), pct: !!m[2] };
      };
      var change = function (val, a, up) { var d = a.pct ? val * a.n / 100 : a.n; return Math.max(1, Math.round(up ? val + d : val - d)); };
      if (action === "delete") {
        if (!rows.length || !g.confirm("Are you sure you want to delete all variations? This cannot be undone.")) return;
        rows.length = 0;
      } else if (action === "toggle-enabled") rows.forEach(function (v) { if (v.enabled === false) delete v.enabled; else v.enabled = false; });
      else if (action === "regular" || action === "sale") {
        var a = ask(action === "regular" ? "Enter a value (regular price):" : "Enter a value (sale price):");
        if (a == null) return;
        var n = int(a);
        if (!n) { msg("Enter a whole number above 0.", "err"); return; }
        rows.forEach(function (v) {
          var reg = int(regularOf(v)) || int(fallback(v));
          if (action === "regular") setPrices(v, n, int(saleOf(v)) < n ? saleOf(v) : "");
          else setPrices(v, reg, n);
        });
      } else if (action === "regular-up" || action === "regular-down") {
        var ar = amount("Enter a fixed amount or percentage to " + (action === "regular-up" ? "increase" : "decrease") + " regular prices by:");
        if (!ar) return;
        rows.forEach(function (v) { var reg = int(regularOf(v)) || int(fallback(v)); if (reg) setPrices(v, change(reg, ar, action === "regular-up"), saleOf(v)); });
      } else if (action === "sale-up" || action === "sale-down") {
        var as = amount("Enter a fixed amount or percentage to " + (action === "sale-up" ? "increase" : "decrease") + " sale prices by:");
        if (!as) return;
        rows.forEach(function (v) { var s = int(saleOf(v)); if (s) setPrices(v, regularOf(v), change(s, as, action === "sale-up")); });
      } else if (action === "nosale") rows.forEach(function (v) { if (v.regularPrice) setPrices(v, v.regularPrice, ""); });
      else if (action === "instock") rows.forEach(function (v) { delete v.stockStatus; });
      else if (action === "outofstock") rows.forEach(function (v) { v.stockStatus = "outofstock"; });
      else if (action === "sku") rows.forEach(function (v) { if (!v.sku) v.sku = skuFor(p.id, v); });
      else if (action === "toggle-manage") {
        rows.forEach(function (v) { var sk = stockKey(v); if (!sk) return; if (isManaged(sk) && shared.stock[norm(sk)] == null) { delete shared.managed[sk]; delete shared.stockEdits[sk]; } else shared.managed[sk] = true; });
        draw(); msg("Manage stock changed. Open a variation (Edit) to enter its quantity.", ""); return;
      } else if (action === "stock") {
        var s = ask("Stock quantity:");
        if (s == null) return;
        if (!/^\d{1,6}$/.test(s)) { msg("Enter a whole number (0 or more).", "err"); return; }
        rows.forEach(function (v) { var sk = stockKey(v); if (sk) { shared.managed[sk] = true; shared.stockEdits[sk] = s; } });
        draw();
        save("Stock changed — click Save changes.");
        return;
      }
      draw();
      save("Variations changed — click Save changes.");
      msg("Done.", "ok");
    }
    function loadStock() {
      if (!stockOk || shared.stockLoaded || !p.id || shared.loading) return;
      shared.loading = true;
      shared.admin.getStockVariants({ search: String(p.id), maxAgeMs: 0 }).then(function (res) {
        shared.stock = {};
        (res.items || []).forEach(function (it) {
          if (String(it.productId) === String(p.id) && it.tracked && it.variant) shared.stock[norm(it.variant)] = Math.max(0, parseInt(it.available, 10) || 0);
        });
      }).catch(function () { /* the boxes stay empty; saving still works */ }).then(function () {
        shared.stockLoaded = true; shared.loading = false;
        if (box.isConnected && box.__pmwVarLive === live) draw();
      });
    }

    var live = {
      click: function (t) {
        var a = t.closest("[data-pv]");
        if (!a) return;
        var k = a.getAttribute("data-pv"), i = parseInt(a.getAttribute("data-i"), 10), v = rows[i];
        if (k === "generate") generate();
        else if (k === "add") {
          if (rows.length >= MAX_ROWS) { msg("The limit is " + MAX_ROWS + " variations.", "err"); return; }
          rows.push({});
          st.open[rows.length - 1] = true;
          draw();
          msg("Variation added: choose its attributes. A variation with every attribute on “Any” is not saved.", "");
        } else if (k === "del") {
          if (!g.confirm("Are you sure you want to remove this variation?")) return;
          rows.splice(i, 1);
          st.open = {}; st.picker = {};
          draw(); save("Variation removed — click Save changes.");
        } else if (k === "edit") { st.open[i] = !st.open[i]; draw(); }
        else if (k === "expand" || k === "close") { rows.forEach(function (_, j) { st.open[j] = k === "expand"; }); draw(); }
        else if (k === "picker") { st.picker[i] = !st.picker[i]; draw(); }
        else if (k === "pick" && v) { v.image = a.getAttribute("data-src"); st.picker[i] = false; draw(); save(); }
        else if (k === "noimg" && v) { delete v.image; draw(); save(); }
      },
      input: function (t) {
        if (t.matches('[data-pv="stock"]')) { shared.stockEdits[t.getAttribute("data-sk")] = String(t.value).trim(); if (ctx.changed) ctx.changed(); }
      },
      change: function (t) {
        var k = t.getAttribute("data-pv"), i = parseInt(t.getAttribute("data-i"), 10), v = rows[i];
        if (k === "bulk") { var val = t.value; t.value = ""; bulk(val); return; }
        if (k === "manage") {
          var sk = t.getAttribute("data-sk");
          if (t.checked) shared.managed[sk] = true;
          else if (shared.stock[norm(sk)] != null) { t.checked = true; msg("This stock is already counted. To stop selling it, set its quantity to 0 or untick Enabled.", "err"); return; }
          else { delete shared.managed[sk]; delete shared.stockEdits[sk]; }
          draw(); return;
        }
        if (k === "stock") return;
        if (!v) return;
        if (k === "attr") {
          var r = parseRow(v, defs);
          r[t.getAttribute("data-attr")] = t.value;
          var nv = rowFrom(r);
          ["type", "color", "size"].forEach(function (f) { if (nv[f]) v[f] = nv[f]; else delete v[f]; });
        } else if (k === "enabled") { if (t.checked) delete v.enabled; else v.enabled = false; }
        else if (k === "regular" || k === "sale") {
          var cardEl = t.closest(".pmw-var");
          setPrices(v, cardEl.querySelector('[data-pv="regular"]').value, cardEl.querySelector('[data-pv="sale"]').value);
        } else if (k === "sku") { var sku = String(t.value).trim().toUpperCase(); if (sku) v.sku = sku; else delete v.sku; }
        else if (k === "status") { if (t.value === "outofstock") v.stockStatus = "outofstock"; else delete v.stockStatus; }
        else return;
        draw();
        save();
      }
    };
    box.__pmwVarLive = live;
    if (!box.__pmwVarBound) {
      box.__pmwVarBound = true;
      box.addEventListener("click", function (e) { if (box.__pmwVarLive) box.__pmwVarLive.click(e.target); });
      box.addEventListener("input", function (e) { if (box.__pmwVarLive) box.__pmwVarLive.input(e.target); });
      box.addEventListener("change", function (e) { if (box.__pmwVarLive) box.__pmwVarLive.change(e.target); });
    }
    draw();
    loadStock();
  }

  /** Saves stock typed in the Variations panel to the stock panel. Called after the product is saved. */
  function flushStock() {
    var keys = Object.keys(shared.stockEdits);
    if (!keys.length) return Promise.resolve("");
    var bad = keys.filter(function (k) { return shared.stockEdits[k] !== "" && !/^\d{1,6}$/.test(String(shared.stockEdits[k])); });
    if (bad.length) return Promise.resolve(" Stock not saved: quantities must be whole numbers.");
    var send = keys.filter(function (k) { return shared.stockEdits[k] !== ""; });
    if (!send.length) { shared.stockEdits = {}; return Promise.resolve(""); }
    if (!shared.admin || typeof shared.admin.commitStockCsv !== "function") return Promise.resolve(" Stock not saved: the stock service is not available.");
    var p = shared.product || {};
    return shared.admin.commitStockCsv(send.map(function (k) {
      return { productId: String(p.id), productName: p.name || "", category: shared.category || "", variant: k, qty: parseInt(shared.stockEdits[k], 10), reason: "Product Manager variations" };
    }), false).then(function (res) {
      send.forEach(function (k) { shared.stock[norm(k)] = parseInt(shared.stockEdits[k], 10); delete shared.stockEdits[k]; });
      return " Stock saved for " + (res && res.applied != null ? res.applied : send.length) + " variation(s)." + (res && res.skipped ? " " + res.skipped + " skipped: check the stock panel." : "");
    }).catch(function (err) { return " Stock was NOT saved (" + ((err && err.message) || "error") + "): press Save changes again."; });
  }
  function hasPendingStock() { return Object.keys(shared.stockEdits).length > 0; }

  g.MaVariationsAdmin = {
    render: render,
    renderAttributes: renderAttributes,
    flushStock: flushStock,
    hasPendingStock: hasPendingStock,
    attributeDefs: attributeDefs,
    parseRow: parseRow,
    stockKey: stockKey,
    setPrices: setPrices,
    skuFor: skuFor
  };
})(window);
