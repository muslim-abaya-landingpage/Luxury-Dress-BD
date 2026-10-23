/**
 * Product Manager CSV export / import (WooCommerce-style). Pure functions, no DOM: used by
 * product-manager.html and tested in tests/backend/product-csv.test.cjs.
 *
 * Export: one row per product (Draft and Trash included), UTF-8 with BOM so Excel shows Bangla.
 * Import: rows are matched by SKU. An existing product only changes in the columns that have a value
 * (an empty cell leaves the field as it is). A new SKU creates a product; it needs Name, Category,
 * Price and Image. Nothing is applied until the caller accepts the returned plan.
 */
(function (g) {
  'use strict';

  var COLUMNS = ['SKU', 'Name', 'Category', 'Status', 'Price', 'Before-sale price', 'Option prices', 'Option before-sale prices',
    'Stock', 'Featured', 'Tags', 'Brand', 'Color', 'Color code', 'Fabric', 'Sizes', 'Description', 'SEO title', 'SEO description',
    'Image', 'Gallery images', 'Date added'];
  var SKU_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{1,100}$/;
  var STATUS = { publish: 'Published', draft: 'Draft', trash: 'Trash' };
  var FIELD_LABEL = { name: 'Name', status: 'Status', price: 'Price', regularPrice: 'Before-sale price', priceByType: 'Option prices',
    types: 'Option prices', regularPriceByType: 'Option before-sale prices', stock: 'Stock', inStock: 'Stock', featured: 'Featured',
    tags: 'Tags', brand: 'Brand', colorLabel: 'Color', color: 'Color code', fabric: 'Fabric', sizes: 'Sizes', detailNote: 'Description',
    seoTitle: 'SEO title', seoDescription: 'SEO description', image: 'Image', images: 'Gallery images', dateAdded: 'Date added' };

  function bnDigits(s) { return String(s == null ? '' : s).replace(/[০-৯]/g, function (c) { return String('০১২৩৪৫৬৭৮৯'.indexOf(c)); }); }
  function money(v) { var n = Number(bnDigits(v).replace(/[৳,\s]/g, '')); return Number.isSafeInteger(n) && n >= 1 && n <= 1000000 ? n : NaN; }
  function list(v, sep) { return String(v || '').split(sep || /\s*[,|]\s*/).map(function (x) { return x.trim(); }).filter(Boolean); }

  // Spreadsheet apps run cells that start with = + - @ as formulas; text cells get a leading apostrophe.
  function safeText(v) { var s = String(v == null ? '' : v); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }
  function unsafeText(v) { var s = String(v == null ? '' : v); return /^'[=+\-@\t\r]/.test(s) ? s.slice(1) : s; }

  /** JSON with object keys sorted, so the same prices stored in another order do not count as a change. */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canon(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }

  function cell(v) {
    var s = String(v == null ? '' : v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  /** Only the options customers can pick are exported; old entries left over from renamed options are not. */
  function pricesToText(map, types) {
    if (!map || typeof map !== 'object') return '';
    var order = types && types.length ? types.slice() : Object.keys(map);
    var keys = order.filter(function (k) { return map[k] != null && map[k] !== ''; });
    return keys.map(function (k) { return k + '=' + map[k]; }).join(' | ');
  }
  function textToPrices(text) {
    var out = {}, order = [], bad = '';
    list(text, /\s*\|\s*/).forEach(function (part) {
      var m = /^(.+?)\s*=\s*(.+)$/.exec(part);
      var n = m ? money(m[2]) : NaN;
      if (!m || !(n > 0)) { bad = part; return; }
      var key = m[1].trim();
      if (!(key in out)) order.push(key);
      out[key] = n;
    });
    return { map: out, order: order, bad: bad };
  }

  function categoryLabel(sec) { return sec ? (sec.menu || sec.key) : ''; }
  function findCategory(sections, value) {
    var v = String(value || '').trim().toLowerCase();
    if (!v) return null;
    return (sections || []).find(function (s) {
      return [s.key, s.menu, s.menuBn].some(function (x) { return String(x || '').trim().toLowerCase() === v; });
    }) || null;
  }

  /** Options in the order customers see them: the product's own order, else its category's. */
  function optionOrder(p, meta) {
    return Array.isArray(p.types) && p.types.length ? p.types : (meta && meta.types) || [];
  }

  function productRow(p, sec, meta) {
    var status = p.status === 'draft' || p.status === 'trash' ? p.status : 'publish';
    var stock = p.stock != null && p.stock !== '' ? String(p.stock) : (p.inStock === false ? '0' : '');
    return [
      p.id, safeText(p.name), categoryLabel(sec), STATUS[status], p.price, p.regularPrice || '',
      pricesToText(p.priceByType, optionOrder(p, meta)), pricesToText(p.regularPriceByType, optionOrder(p, meta)),
      stock, p.featured ? 'yes' : '', safeText((p.tags || []).join(', ')), safeText(p.brand || ''),
      safeText(p.colorLabel || ''), safeText(p.color || ''), safeText(p.fabric || ''), safeText((p.sizes || []).join(', ')),
      safeText(p.detailNote || ''), safeText(p.seoTitle || ''), safeText(p.seoDescription || ''),
      p.image || '', (p.images || []).join(' | '), p.dateAdded || ''
    ];
  }

  /** opts.metaFor(catKey) → {types:[…]} gives the category's option order (Product Manager's getCategoryTypeMeta). */
  function exportCsv(products, sections, opts) {
    var metaFor = opts && opts.metaFor;
    var lines = [COLUMNS.map(cell).join(',')];
    (sections || []).forEach(function (sec) {
      var meta = metaFor ? metaFor(sec.key) : null;
      ((products || {})[sec.key] || []).forEach(function (p) { lines.push(productRow(p, sec, meta).map(cell).join(',')); });
    });
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  /** RFC 4180 CSV → array of rows (arrays of strings). Handles quotes, "" escapes and CRLF. */
  function parseCsv(text) {
    var s = String(text || '').replace(/^﻿/, '');
    var rows = [], row = [], field = '', i = 0, quoted = false;
    while (i < s.length) {
      var c = s[i];
      if (quoted) {
        if (c === '"') {
          if (s[i + 1] === '"') { field += '"'; i += 2; continue; }
          quoted = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"' && field === '') { quoted = true; i++; continue; }
      if (c === ',') { row.push(field); field = ''; i++; continue; }
      if (c === '\r' || c === '\n') {
        row.push(field); field = '';
        if (row.some(function (x) { return x.trim() !== ''; })) rows.push(row);
        row = [];
        i += (c === '\r' && s[i + 1] === '\n') ? 2 : 1;
        continue;
      }
      field += c; i++;
    }
    row.push(field);
    if (row.some(function (x) { return x.trim() !== ''; })) rows.push(row);
    return rows;
  }

  /**
   * Plans an import without touching `products`.
   * opts: { metaFor(catKey) → {types:[…]}|null, newProduct(sec) → base product, today: 'YYYY-MM-DD', maxRows }
   * Returns { staged (a changed deep copy of products), updates:[{sku,name,fields}], created:[{sku,name,category}], errors:[{line,message}] }.
   */
  function planImport(text, products, sections, opts) {
    opts = opts || {};
    var staged = JSON.parse(JSON.stringify(products || {}));
    var rows = parseCsv(text);
    var out = { staged: staged, updates: [], created: [], errors: [] };
    if (!rows.length) { out.errors.push({ line: 1, message: 'The file is empty.' }); return out; }
    var head = rows[0].map(function (h) { return String(h || '').replace(/^﻿/, '').trim().toLowerCase(); });
    var col = {};
    COLUMNS.forEach(function (name) { var i = head.indexOf(name.toLowerCase()); if (i !== -1) col[name] = i; });
    if (col.SKU == null) { out.errors.push({ line: 1, message: 'No "SKU" column. Use the file from "Export CSV" as the template.' }); return out; }
    var maxRows = opts.maxRows || 2000;
    if (rows.length - 1 > maxRows) { out.errors.push({ line: 1, message: 'Too many rows (max ' + maxRows + ').' }); return out; }

    function where(sku) {
      var hit = null;
      Object.keys(staged).forEach(function (cat) {
        (staged[cat] || []).forEach(function (p, index) { if (!hit && p && String(p.id) === sku) hit = { cat: cat, index: index, p: p }; });
      });
      return hit;
    }
    var seenSku = {};
    rows.slice(1).forEach(function (r, n) {
      var line = n + 2;
      function v(name) { return col[name] == null ? '' : unsafeText(String(r[col[name]] == null ? '' : r[col[name]]).trim()); }
      var sku = v('SKU');
      try {
        if (!SKU_RE.test(sku)) throw Error('SKU "' + sku + '" is not valid (letters, numbers, - and _ only).');
        if (seenSku[sku]) throw Error('SKU ' + sku + ' appears more than once in the file.');
        seenSku[sku] = true;
        var hit = where(sku);
        var isNew = !hit;
        var p, catKey;
        var catValue = v('Category');
        var sec = catValue ? findCategory(sections, catValue) : null;
        if (catValue && !sec) throw Error('Unknown category "' + catValue + '".');
        if (isNew) {
          if (!sec) throw Error('New product ' + sku + ' needs a Category.');
          if (!v('Name')) throw Error('New product ' + sku + ' needs a Name.');
          if (!v('Image')) throw Error('New product ' + sku + ' needs an Image URL.');
          if (!(money(v('Price')) > 0) && !v('Option prices')) throw Error('New product ' + sku + ' needs a Price.');
          p = opts.newProduct ? opts.newProduct(sec) : {};
          p.id = sku;
          p.dateAdded = opts.today || p.dateAdded;
          catKey = sec.key;
        } else {
          p = hit.p; catKey = hit.cat;
        }
        var before = JSON.stringify(p);
        var fields = [];
        function setText(name, key, max) {
          var x = v(name);
          if (!x) return;
          if (x.length > max) throw Error(name + ' is longer than ' + max + ' characters.');
          p[key] = x;
        }
        setText('Name', 'name', 150);
        setText('Brand', 'brand', 80);
        setText('Color', 'colorLabel', 80);
        setText('Color code', 'color', 40);
        setText('Fabric', 'fabric', 150);
        setText('Description', 'detailNote', 3000);
        setText('SEO title', 'seoTitle', 120);
        setText('SEO description', 'seoDescription', 320);
        setText('Image', 'image', 500);
        if (v('Status')) {
          var st = v('Status').toLowerCase();
          var status = /^(publish|published)$/.test(st) ? 'publish' : st === 'draft' ? 'draft' : st === 'trash' ? 'trash' : '';
          if (!status) throw Error('Status must be Published, Draft or Trash.');
          var now = p.status === 'draft' || p.status === 'trash' ? p.status : 'publish';
          if (status !== now) {
            if (status === 'publish') delete p.status; else p.status = status;
            if (status === 'trash') p.trashedAt = opts.today || p.trashedAt; else delete p.trashedAt;
          }
        }
        if (v('Price')) {
          var price = money(v('Price'));
          if (!(price > 0)) throw Error('Price must be a whole number of taka.');
          p.price = price;
        }
        if (v('Option prices')) {
          var op = textToPrices(v('Option prices'));
          if (op.bad) throw Error('Option prices: "' + op.bad + '" — write e.g. Full Set=1650 | Abaya Only=1350.');
          // Merge: prices not in the file stay as they are.
          var prevKeys = p.priceByType && typeof p.priceByType === 'object' ? Object.keys(p.priceByType) : [];
          p.priceByType = Object.assign({}, p.priceByType && typeof p.priceByType === 'object' ? p.priceByType : {}, op.map);
          var meta = opts.metaFor ? opts.metaFor(sec ? sec.key : catKey) : null;
          var metaTypes = meta && Array.isArray(meta.types) ? meta.types : null;
          var hadOwn = Array.isArray(p.types) && p.types.length;
          if (metaTypes && metaTypes.join('|') === op.order.join('|')) delete p.types;
          else if (!hadOwn && metaTypes && op.order.every(function (k) { return metaTypes.indexOf(k) !== -1; })) { /* keep the category's options */ }
          else if (!hadOwn && op.order.join('|') === prevKeys.join('|')) { /* same options as before, no own order */ }
          else if (!hadOwn || p.types.join('|') !== op.order.join('|')) p.types = op.order;
          var effective = (Array.isArray(p.types) && p.types.length ? p.types : metaTypes || op.order)
            .filter(function (k) { return p.priceByType[k] > 0; });
          if (effective.length) p.price = p.priceByType[effective[0]];
        }
        if (v('Before-sale price')) {
          var reg = money(v('Before-sale price'));
          if (!(reg > 0)) throw Error('Before-sale price must be a whole number of taka.');
          p.regularPrice = reg;
        }
        if (v('Option before-sale prices')) {
          var orp = textToPrices(v('Option before-sale prices'));
          if (orp.bad) throw Error('Option before-sale prices: "' + orp.bad + '".');
          p.regularPriceByType = Object.assign({}, p.regularPriceByType && typeof p.regularPriceByType === 'object' ? p.regularPriceByType : {}, orp.map);
          var firstType = (p.types && p.types[0]) || (opts.metaFor && opts.metaFor(catKey) && opts.metaFor(catKey).types[0]);
          if (firstType && orp.map[firstType]) p.regularPrice = orp.map[firstType];
        }
        if (p.regularPrice != null && !(p.regularPrice > p.price)) delete p.regularPrice;
        if (v('Stock')) {
          var sv = v('Stock').toLowerCase();
          if (sv === 'out' || sv === 'out of stock') { delete p.stock; p.inStock = false; }
          else if (sv === 'in' || sv === 'in stock' || sv === 'unlimited') { delete p.stock; delete p.inStock; }
          else {
            var q = Number(bnDigits(sv));
            if (!Number.isSafeInteger(q) || q < 0) throw Error('Stock must be a number, "in" or "out".');
            p.stock = q;
            if (q === 0) p.inStock = false; else delete p.inStock;
          }
        }
        if (v('Featured')) {
          var f = /^(yes|y|true|1|★)$/i.test(v('Featured'));
          if (!!p.featured !== f) { if (f) p.featured = true; else delete p.featured; }
        }
        if (v('Tags')) p.tags = list(v('Tags'), /\s*,\s*/).filter(function (t, i, a) { return a.map(function (x) { return x.toLowerCase(); }).indexOf(t.toLowerCase()) === i; });
        if (v('Sizes')) p.sizes = list(v('Sizes'), /\s*,\s*/);
        if (v('Gallery images')) p.images = list(v('Gallery images'), /\s*\|\s*/).slice(0, 12);
        if (v('Date added')) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v('Date added'))) throw Error('Date added must look like 2026-10-24.');
          p.dateAdded = v('Date added');
        }
        var prev = JSON.parse(before);
        Object.keys(Object.assign({}, prev, p)).forEach(function (k) {
          if (canon(prev[k]) !== canon(p[k]) && FIELD_LABEL[k] && fields.indexOf(FIELD_LABEL[k]) === -1) fields.push(FIELD_LABEL[k]);
        });

        if (isNew) {
          (staged[catKey] = staged[catKey] || []).push(p);
          out.created.push({ sku: sku, name: p.name, category: catKey });
          return;
        }
        var moved = sec && sec.key !== catKey;
        if (moved) {
          staged[catKey].splice(hit.index, 1);
          (staged[sec.key] = staged[sec.key] || []).push(p);
          fields.push('Category');
        }
        if (fields.length) out.updates.push({ sku: sku, name: p.name, fields: fields });
      } catch (err) {
        out.errors.push({ line: line, message: (err && err.message) || 'Invalid row' });
      }
    });
    return out;
  }

  g.MaProductCsv = { COLUMNS: COLUMNS, exportCsv: exportCsv, parseCsv: parseCsv, planImport: planImport };
})(typeof window !== 'undefined' ? window : globalThis);
