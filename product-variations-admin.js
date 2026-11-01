/* Product Manager → Edit product → "Variations" tab (WooCommerce-style variable products).

   Attributes come from the product's other tabs: options (General tab, e.g. Full Set / Abaya Only),
   colours and sizes (Attributes tab). "Generate variations" makes one row per combination; each row has
   its own on/off, regular price, sale price, SKU, photo and stock. Rows are saved in product.variations:
     { type, color, size, price, regularPrice, sku, image, enabled }
   price = what the customer pays (the sale price when there is one), regularPrice = the "before sale"
   price. An empty type/color/size means "any". The order server (apps-script/Operations.gs opsVariation_)
   and checkout (cart-reprice.js) charge the most specific matching row and refuse a row that is off.
   Stock is not in the catalog: it is read from and written to the StockVariants sheet (stock panel), keyed
   "colour · size" like the Smart Upload stock rows. */
(function (g) {
  "use strict";

  var MAX_ROWS = 300;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function norm(v) { return String(v || "").replace(/\s+/g, " ").trim().toLowerCase(); }
  function int(v) { var n = parseInt(v, 10); return n > 0 ? n : 0; }
  function colorKey(label) { return String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  /** Size choices for this product, in the same text the cart sends (so stock rows and prices line up). */
  function sizeChoices(p, category) {
    var list = function (a) {
      return (Array.isArray(a) ? a : []).map(function (s) { return String(s && typeof s === "object" ? s.value : s == null ? "" : s).trim(); }).filter(Boolean);
    };
    if (typeof g.isAbayaProduct === "function" && g.isAbayaProduct(p, category)) {
      var cfg = typeof g.getAbayaSizeConfig === "function" ? g.getAbayaSizeConfig(p) : {};
      var bodies = list(cfg.bodySizes && cfg.bodySizes.length ? cfg.bodySizes : [cfg.bodySizeLabel || "46 [Free size]"]);
      var lengths = list(p.lengthSizes && p.lengthSizes.length ? p.lengthSizes : p.sizes);
      var out = [];
      bodies.forEach(function (b) {
        lengths.forEach(function (l) {
          out.push({ key: "Body " + b + " · Length " + l, label: (bodies.length > 1 ? "Body " + b + " / " : "") + "Long " + l, stock: true });
        });
      });
      return out;
    }
    if (typeof g.isTwoPieceProduct === "function" && g.isTwoPieceProduct(p, category)) {
      var tp = typeof g.getTwoPieceSizeConfig === "function" ? g.getTwoPieceSizeConfig(p) : {};
      // The cart sends "Body 42 · Length 40 · …"; a variation names only the body part, so stock is not per size here.
      return list(tp.bodySizes && tp.bodySizes.length ? tp.bodySizes : []).map(function (b) { return { key: "Body " + b, label: "Body " + b, stock: false }; });
    }
    var panjabi = typeof g.isPanjabiProduct === "function" && g.isPanjabiProduct(p, category);
    return list(p.sizes).map(function (s) {
      var key = panjabi ? s.split(" ")[0].toUpperCase() : s;
      return { key: key, label: s, stock: true };
    }).filter(function (s, i, all) { return all.map(function (x) { return x.key; }).indexOf(s.key) === i; });
  }

  function stockKey(v) {
    var c = String(v.color || "").trim(), s = String(v.size || "").trim();
    return c && s ? c + " · " + s : (s || c);
  }
  function rowKey(v) { return [norm(v.type), norm(v.color), norm(v.size)].join("\u001f"); }
  function skuFor(id, v) {
    var tail = [v.type, v.color, String(v.size || "").replace(/body |length /gi, "")].filter(Boolean).join("-");
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

  var CSS = ".pmv{display:grid;gap:10px}.pmv-attrs{display:flex;flex-wrap:wrap;gap:6px 16px;margin:0;font-size:13px}" +
    ".pmv-attrs label{display:inline-flex;gap:6px;align-items:center}.pmv-attrs small{color:#646970}" +
    ".pmv-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.pmv-bar .pmv-count{margin-left:auto;color:#646970;font-size:12px}" +
    ".pmv-wrap{overflow-x:auto;border:1px solid #dcdcde}.pmv table{border-collapse:collapse;width:100%;min-width:860px;font-size:13px}" +
    ".pmv th,.pmv td{padding:6px;border-bottom:1px solid #f0f0f1;text-align:left;vertical-align:middle}.pmv th{background:#f6f7f7;font-weight:600}" +
    ".pmv input[type=number]{width:92px}.pmv input.pmv-sku{width:150px}.pmv select{max-width:150px}.pmv-photo{display:flex;gap:4px;align-items:center}" +
    ".pmv-photo img{width:34px;height:34px;object-fit:cover;border:1px solid #dcdcde}.pmv tr.is-off td{opacity:.55}.pmv tr.is-bad td{background:#fcf0f1}" +
    ".pmv-msg{font-size:12px;color:#646970;margin:0}.pmv-msg.is-err{color:#b32d2e}.pmv-msg.is-ok{color:#008a20}.pmv-empty{padding:16px;color:#646970}";

  function injectCss() {
    if (document.getElementById("pmv-css")) return;
    var s = document.createElement("style");
    s.id = "pmv-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /**
   * Draws the Variations tab into `box`.
   * ctx: { product, category, types:[name], colors:[{key,label,image}], photos:[url], basePrice(type)->number,
   *        changed(message), admin (window.MaAdmin, optional) }
   */
  function render(box, ctx) {
    if (!box) return;
    injectCss();
    var p = ctx.product;
    var types = (ctx.types || []).filter(Boolean);
    var colors = (ctx.colors || []).filter(function (c) { return c && c.key; });
    var sizes = sizeChoices(p, ctx.category);
    var photos = (ctx.photos || []).filter(Boolean);
    if (!Array.isArray(p.variations)) p.variations = [];
    var rows = p.variations;
    var state = box.__pmv || (box.__pmv = { use: null, stock: {}, stockLoaded: false, stockEdits: {}, productId: "" });
    if (state.productId !== String(p.id)) { state.use = null; state.stock = {}; state.stockLoaded = false; state.stockEdits = {}; state.productId = String(p.id); }
    if (!state.use) {
      // Like WooCommerce "Used for variations": on for attributes the product already varies by.
      var has = function (k) { return rows.some(function (v) { return !!v[k]; }); };
      state.use = { type: types.length > 1 || has("type"), color: colors.length > 1 || has("color"), size: sizes.length > 1 || has("size") };
    }
    var stockOk = !!(ctx.admin && typeof ctx.admin.getStockVariants === "function" && typeof ctx.admin.commitStockCsv === "function");
    var sizeHasStock = sizes.length ? sizes[0].stock !== false : true;

    function label(list, key, field) {
      var hit = list.filter(function (x) { return norm(x[field || "key"]) === norm(key); })[0];
      return hit ? (hit.label || hit.key) : key;
    }
    function selectHtml(name, list, value, i) {
      var opts = '<option value="">Any ' + name + "</option>";
      var known = false;
      list.forEach(function (x) {
        var on = norm(x.key) === norm(value);
        if (on) known = true;
        opts += '<option value="' + esc(x.key) + '"' + (on ? " selected" : "") + ">" + esc(x.label || x.key) + "</option>";
      });
      if (value && !known) opts += '<option value="' + esc(value) + '" selected>' + esc(value) + " (old)</option>";
      return '<select data-pmv-attr="' + name + '" data-i="' + i + '" aria-label="' + esc(name) + '">' + opts + "</select>";
    }
    function duplicates() {
      var seen = {}, dup = {};
      rows.forEach(function (v, i) { var k = rowKey(v); if (seen[k] != null) { dup[i] = true; dup[seen[k]] = true; } else seen[k] = i; });
      return dup;
    }

    function draw() {
      var dup = duplicates();
      var seenStock = {};
      var cols = (state.use.type ? 1 : 0) + (state.use.color ? 1 : 0) + (state.use.size ? 1 : 0);
      var head = "<tr><th>On</th>" + (state.use.type ? "<th>Option</th>" : "") + (state.use.color ? "<th>Color</th>" : "") + (state.use.size ? "<th>Size</th>" : "") +
        "<th>Regular price ৳</th><th>Sale price ৳</th><th>SKU</th><th>Photo</th><th>Stock</th><th></th></tr>";
      var body = rows.map(function (v, i) {
        var fallback = ctx.basePrice ? ctx.basePrice(v.type) : p.price;
        var sk = stockKey(v);
        var stockCell;
        if (!stockOk) stockCell = "<small>—</small>";
        else if (!sk || (v.size && !sizeHasStock)) stockCell = '<small title="Stock is kept for the whole product or per colour here">—</small>';
        else if (seenStock[norm(sk)]) stockCell = "<small>same as above</small>";
        else {
          seenStock[norm(sk)] = true;
          var cur = Object.prototype.hasOwnProperty.call(state.stockEdits, sk) ? state.stockEdits[sk] : (state.stock[norm(sk)] != null ? state.stock[norm(sk)] : "");
          stockCell = '<input type="number" min="0" step="1" data-pmv-stock="' + esc(sk) + '" value="' + esc(cur) + '" placeholder="' + (state.stockLoaded ? "not tracked" : "…") + '" aria-label="Stock">';
        }
        var bad = dup[i] || (v.regularPrice && v.price && v.price >= v.regularPrice);
        var photoOpts = '<option value="">Product photo</option>' + photos.map(function (u, k) {
          return '<option value="' + esc(u) + '"' + (u === v.image ? " selected" : "") + ">" + (k === 0 ? "Main photo" : "Photo " + (k + 1)) + "</option>";
        }).join("") + (v.image && photos.indexOf(v.image) === -1 ? '<option value="' + esc(v.image) + '" selected>Other photo</option>' : "");
        return '<tr data-row="' + i + '" class="' + (v.enabled === false ? "is-off " : "") + (bad ? "is-bad" : "") + '"' + (dup[i] ? ' title="Same combination appears twice"' : "") + ">" +
          '<td><input type="checkbox" data-pmv="enabled" data-i="' + i + '"' + (v.enabled === false ? "" : " checked") + ' aria-label="Enabled"></td>' +
          (state.use.type ? "<td>" + selectHtml("option", types.map(function (t) { return { key: t, label: t }; }), v.type, i) + "</td>" : "") +
          (state.use.color ? "<td>" + selectHtml("color", colors, v.color, i) + "</td>" : "") +
          (state.use.size ? "<td>" + selectHtml("size", sizes, v.size, i) + "</td>" : "") +
          '<td><input type="number" min="0" data-pmv="regular" data-i="' + i + '" value="' + esc(regularOf(v)) + '" placeholder="' + esc(fallback || "") + '" aria-label="Regular price"></td>' +
          '<td><input type="number" min="0" data-pmv="sale" data-i="' + i + '" value="' + esc(saleOf(v)) + '" aria-label="Sale price"></td>' +
          '<td><input type="text" class="pmv-sku" maxlength="60" data-pmv="sku" data-i="' + i + '" value="' + esc(v.sku || "") + '" aria-label="SKU"></td>' +
          '<td><span class="pmv-photo">' + (v.image ? '<img src="' + esc(v.image) + '" alt="">' : "") + '<select data-pmv="image" data-i="' + i + '" aria-label="Variation photo">' + photoOpts + "</select></span></td>" +
          "<td>" + stockCell + "</td>" +
          '<td><button type="button" class="pm-wp-link-danger" data-pmv-del="' + i + '">Remove</button></td></tr>';
      }).join("");
      var attrs = [
        ["type", "Option", types], ["color", "Color", colors.map(function (c) { return c.label || c.key; })], ["size", "Size", sizes.map(function (s) { return s.label; })]
      ].map(function (a) {
        return '<label><input type="checkbox" data-pmv-use="' + a[0] + '"' + (state.use[a[0]] ? " checked" : "") + (a[2].length ? "" : " disabled") + "> " + a[1] +
          " <small>" + (a[2].length ? esc(a[2].slice(0, 8).join(", ") + (a[2].length > 8 ? "…" : "")) : "none — add in " + (a[0] === "type" ? "General" : "Attributes") + " tab") + "</small></label>";
      }).join("");
      box.innerHTML = '<div class="pmv">' +
        '<p class="pmv-attrs"><b>Used for variations:</b> ' + attrs + "</p>" +
        '<div class="pmv-bar"><button type="button" class="pm-wp-button" data-pmv-act="generate">Generate variations</button>' +
        '<button type="button" class="pm-wp-button" data-pmv-act="add">Add manually</button>' +
        '<select data-pmv-bulk aria-label="Bulk actions"><option value="">Bulk actions</option><option value="regular">Set regular prices</option><option value="sale">Set sale prices</option>' +
        '<option value="pct">Change regular prices by %</option><option value="nosale">Remove sale prices</option><option value="on">Enable all</option><option value="off">Disable all</option>' +
        (stockOk ? '<option value="stock">Set stock for all</option>' : "") + '<option value="sku">Fill empty SKUs</option><option value="delete">Delete all variations</option></select>' +
        '<button type="button" class="pm-wp-button" data-pmv-act="bulk">Apply</button>' +
        '<span class="pmv-count">' + rows.length + " variation" + (rows.length === 1 ? "" : "s") + "</span></div>" +
        (rows.length && cols
          ? '<div class="pmv-wrap"><table><thead>' + head + "</thead><tbody>" + body + "</tbody></table></div>"
          : '<div class="pmv-empty">' + (rows.length ? "Tick at least one attribute above." : "No variations yet. Tick the attributes, then press <b>Generate variations</b>. Without variations the product works exactly as before.") + "</div>") +
        (stockOk ? '<div class="pmv-bar"><button type="button" class="pm-wp-button" data-pmv-act="stock">Save stock</button><p class="pmv-msg" data-pmv-stockmsg>' + (state.stockLoaded ? "Stock is saved straight to the stock panel (separate from Save changes)." : "Loading stock…") + "</p></div>" : "") +
        '<p class="pmv-msg" data-pmv-msg>Blank regular price = the product/option price (shown faded). Switched-off variations cannot be ordered. Prices go live after <b>Save changes</b>.</p>' +
        "</div>";
    }

    function msg(text, kind) {
      var el = box.querySelector("[data-pmv-msg]");
      if (el) { el.textContent = text; el.className = "pmv-msg" + (kind ? " is-" + kind : ""); }
    }
    function stockMsg(text, kind) {
      var el = box.querySelector("[data-pmv-stockmsg]");
      if (el) { el.textContent = text; el.className = "pmv-msg" + (kind ? " is-" + kind : ""); }
    }
    function save(note) {
      if (!rows.length) delete p.variations; else p.variations = rows;
      if (ctx.changed) ctx.changed(note);
    }

    function generate() {
      var axes = [];
      if (state.use.type && types.length) axes.push(["type", types]);
      if (state.use.color && colors.length) axes.push(["color", colors.map(function (c) { return c.key; })]);
      if (state.use.size && sizes.length) axes.push(["size", sizes.map(function (s) { return s.key; })]);
      if (!axes.length) { msg("Tick an attribute that has values first.", "err"); return; }
      var combos = [{}];
      axes.forEach(function (ax) {
        var next = [];
        combos.forEach(function (c) { ax[1].forEach(function (val) { var o = Object.assign({}, c); o[ax[0]] = val; next.push(o); }); });
        combos = next;
      });
      if (combos.length > MAX_ROWS) { msg("That makes " + combos.length + " variations; the limit is " + MAX_ROWS + ". Untick an attribute.", "err"); return; }
      var have = {};
      rows.forEach(function (v) { have[rowKey(v)] = true; });
      var added = 0;
      combos.forEach(function (c) {
        if (have[rowKey(c)]) return;
        if (rows.length >= MAX_ROWS) return;
        c.sku = skuFor(p.id, c);
        var col = c.color && colors.filter(function (x) { return x.key === c.color; })[0];
        if (col && col.image) c.image = col.image;
        rows.push(c);
        added++;
      });
      draw();
      save(added ? added + " variation(s) added — click Save changes." : "");
      msg(added ? added + " variation(s) added. Existing ones were kept." : "All combinations already exist.", added ? "ok" : "");
    }

    function bulk(action) {
      if (!action) { msg("Choose a bulk action.", "err"); return; }
      if (!rows.length) { msg("No variations yet.", "err"); return; }
      var ask = function (q) { var a = g.prompt(q); return a == null ? null : String(a).trim(); };
      var n;
      if (action === "regular" || action === "sale") {
        var a = ask(action === "regular" ? "Regular price (৳) for all variations:" : "Sale price (৳) for all variations (must be less than the regular price):");
        if (a == null) return;
        n = int(a);
        if (!n) { msg("Enter a whole number above 0.", "err"); return; }
        rows.forEach(function (v) {
          var reg = int(regularOf(v)) || int(ctx.basePrice ? ctx.basePrice(v.type) : p.price);
          if (action === "regular") setPrices(v, n, saleOf(v) && int(saleOf(v)) < n ? saleOf(v) : "");
          else setPrices(v, reg, n);
        });
      } else if (action === "pct") {
        var pc = ask("Change regular prices by % (e.g. 10 or -10):");
        if (pc == null) return;
        var pct = Number(pc);
        if (!isFinite(pct) || pct <= -100 || pct === 0) { msg("Enter a percentage like 10 or -10.", "err"); return; }
        rows.forEach(function (v) {
          var reg = int(regularOf(v)) || int(ctx.basePrice ? ctx.basePrice(v.type) : p.price);
          if (reg) setPrices(v, Math.max(1, Math.round(reg * (1 + pct / 100))), saleOf(v));
        });
      } else if (action === "nosale") rows.forEach(function (v) { if (v.regularPrice) setPrices(v, v.regularPrice, ""); });
      else if (action === "on") rows.forEach(function (v) { delete v.enabled; });
      else if (action === "off") rows.forEach(function (v) { v.enabled = false; });
      else if (action === "sku") rows.forEach(function (v) { if (!v.sku) v.sku = skuFor(p.id, v); });
      else if (action === "stock") {
        var s = ask("Stock quantity for every variation:");
        if (s == null) return;
        if (!/^\d{1,6}$/.test(s)) { msg("Enter a whole number (0 or more).", "err"); return; }
        Array.prototype.forEach.call(box.querySelectorAll("[data-pmv-stock]"), function (inp) { state.stockEdits[inp.getAttribute("data-pmv-stock")] = s; });
        draw();
        stockMsg("Stock filled in — press Save stock.", "");
        return;
      } else if (action === "delete") {
        if (!g.confirm("Delete all " + rows.length + " variations? Prices go back to the product/option prices.")) return;
        rows.length = 0;
      }
      draw();
      save("Variations changed — click Save changes.");
      msg("Done.", "ok");
    }

    function loadStock() {
      if (!stockOk || state.stockLoaded || !p.id) return;
      ctx.admin.getStockVariants({ search: String(p.id), maxAgeMs: 0 }).then(function (res) {
        state.stock = {};
        (res.items || []).forEach(function (it) {
          if (String(it.productId) === String(p.id) && it.tracked && it.variant) state.stock[norm(it.variant)] = Math.max(0, parseInt(it.available, 10) || 0);
        });
        state.stockLoaded = true;
        if (box.isConnected) draw();
      }).catch(function (err) {
        state.stockLoaded = true;
        if (box.isConnected) { draw(); stockMsg("Could not load stock: " + (err && err.message || "error"), "err"); }
      });
    }

    function saveStock() {
      var edits = Object.keys(state.stockEdits).filter(function (k) { return /^\d{1,6}$/.test(String(state.stockEdits[k])); });
      var bad = Object.keys(state.stockEdits).filter(function (k) { return state.stockEdits[k] !== "" && !/^\d{1,6}$/.test(String(state.stockEdits[k])); });
      if (bad.length) { stockMsg("Stock must be a whole number (0 or more).", "err"); return; }
      if (!edits.length) { stockMsg("No stock changes to save.", ""); return; }
      if (!p.id) { stockMsg("Give the product a SKU first.", "err"); return; }
      stockMsg("Saving stock…", "");
      ctx.admin.commitStockCsv(edits.map(function (k) {
        return { productId: String(p.id), productName: p.name || "", category: ctx.category || "", variant: k, qty: parseInt(state.stockEdits[k], 10), reason: "Product Manager variations" };
      }), false).then(function (res) {
        edits.forEach(function (k) { state.stock[norm(k)] = parseInt(state.stockEdits[k], 10); delete state.stockEdits[k]; });
        draw();
        stockMsg("Stock saved for " + (res && res.applied != null ? res.applied : edits.length) + " variation(s)." + (res && res.skipped ? " " + res.skipped + " skipped: check the stock panel." : ""), res && res.skipped ? "err" : "ok");
      }).catch(function (err) { stockMsg("Stock was not saved: " + (err && err.message || "error") + ". Try again.", "err"); });
    }

    if (!box.__pmvBound) {
      box.__pmvBound = true;
      box.addEventListener("change", function (e) {
        var t = e.target, live = box.__pmvLive;
        if (!live) return;
        live.onChange(t);
      });
      box.addEventListener("input", function (e) {
        var live = box.__pmvLive;
        if (live && e.target.matches("[data-pmv-stock]")) live.onStockInput(e.target);
      });
      box.addEventListener("click", function (e) {
        var live = box.__pmvLive;
        if (live) live.onClick(e.target);
      });
    }
    // Handlers read the current product through box.__pmvLive, so re-rendering for another product is safe.
    box.__pmvLive = {
      onStockInput: function (t) { state.stockEdits[t.getAttribute("data-pmv-stock")] = String(t.value).trim(); },
      onChange: function (t) {
        var i = parseInt(t.getAttribute("data-i"), 10), v = rows[i];
        if (t.matches("[data-pmv-use]")) { state.use[t.getAttribute("data-pmv-use")] = t.checked; draw(); return; }
        if (!v) return;
        if (t.matches("[data-pmv-attr]")) {
          var k = { option: "type", color: "color", size: "size" }[t.getAttribute("data-pmv-attr")];
          if (t.value) v[k] = t.value; else delete v[k];
        } else {
          var f = t.getAttribute("data-pmv");
          var tr = t.closest("tr");
          if (f === "enabled") { if (t.checked) delete v.enabled; else v.enabled = false; }
          else if (f === "regular" || f === "sale") setPrices(v, tr.querySelector('[data-pmv="regular"]').value, tr.querySelector('[data-pmv="sale"]').value);
          else if (f === "sku") { var sku = String(t.value).trim().toUpperCase(); if (sku) v.sku = sku; else delete v.sku; }
          else if (f === "image") { if (t.value) v.image = t.value; else delete v.image; }
          else return;
        }
        draw();
        save();
      },
      onClick: function (t) {
        var del = t.closest("[data-pmv-del]");
        if (del) { rows.splice(parseInt(del.getAttribute("data-pmv-del"), 10), 1); draw(); save("Variation removed — click Save changes."); return; }
        var act = t.closest("[data-pmv-act]");
        if (!act) return;
        var a = act.getAttribute("data-pmv-act");
        if (a === "generate") generate();
        else if (a === "add") {
          if (rows.length >= MAX_ROWS) { msg("The limit is " + MAX_ROWS + " variations.", "err"); return; }
          rows.push({});
          draw();
          msg("New row added: choose its option/colour/size. A row with every attribute on Any is not saved.", "");
        } else if (a === "bulk") bulk((box.querySelector("[data-pmv-bulk]") || {}).value);
        else if (a === "stock") saveStock();
      }
    };
    draw();
    loadStock();
  }

  g.MaVariationsAdmin = { render: render, sizeChoices: sizeChoices, stockKey: stockKey, setPrices: setPrices, skuFor: skuFor };
})(window);
