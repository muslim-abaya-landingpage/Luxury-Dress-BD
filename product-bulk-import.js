(function (root) {
  "use strict";

  var MAX_ROWS = 250;
  var HEADER_ALIASES = {
    id: ["id", "sku", "product_id", "productid", "sku_id", "পণ্য আইডি", "আইডি", "এসকেইউ"],
    name: ["name", "title", "product_name", "পণ্যের নাম", "নাম"],
    price: ["price", "regular_price", "দাম", "মূল্য"],
    category: ["category", "category_key", "ক্যাটাগরি", "বিভাগ"],
    image: ["image", "image_url", "main_image", "ছবি", "ছবির url", "প্রধান ছবি"],
    images: ["images", "gallery", "gallery_images", "গ্যালারি ছবি"],
    sizes: ["sizes", "size", "available_sizes", "সাইজ", "সাইজসমূহ"],
    color: ["color", "colour", "color_code", "রং কোড", "রঙ কোড"],
    colorLabel: ["color_label", "color_name", "colour_name", "রঙ", "রঙের নাম", "রং"],
    fabric: ["fabric", "material", "কাপড়", "ফ্যাব্রিক"],
    stock: ["stock", "quantity", "qty", "মজুত", "স্টক"],
    detailNote: ["detail_note", "description", "details", "বিস্তারিত", "বর্ণনা"]
  };

  function normalizeHeader(value) {
    return String(value || "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  function chooseDelimiter(text) {
    var firstLine = String(text || "").split(/\r?\n/, 1)[0] || "";
    var counts = { ",": 0, "\t": 0, ";": 0 };
    var quoted = false;
    for (var i = 0; i < firstLine.length; i++) {
      var ch = firstLine[i];
      if (ch === '"') {
        if (quoted && firstLine[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted && Object.prototype.hasOwnProperty.call(counts, ch)) counts[ch]++;
    }
    return Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
  }

  function parseDelimited(text, delimiter) {
    var rows = [], row = [], field = "", quoted = false;
    text = String(text || "").replace(/^\uFEFF/, "");
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (ch === '"') {
        if (quoted && text[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && ch === delimiter) {
        row.push(field); field = "";
      } else if (!quoted && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some(function (cell) { return String(cell).trim() !== ""; })) rows.push(row);
        row = [];
      } else field += ch;
    }
    row.push(field);
    if (row.some(function (cell) { return String(cell).trim() !== ""; })) rows.push(row);
    if (quoted) throw new Error("CSV-তে একটি quoted cell বন্ধ হয়নি।");
    return rows;
  }

  function toAsciiDigits(value) {
    return String(value == null ? "" : value).replace(/[০-৯]/g, function (digit) {
      return String("০১২৩৪৫৬৭৮৯".indexOf(digit));
    });
  }

  function parseMoney(value) {
    var normalized = toAsciiDigits(value).replace(/[৳,\s]/g, "").trim();
    if (!normalized) return NaN;
    return Number(normalized);
  }

  function splitList(value) {
    return String(value || "").split(/[|;]/).map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function makeHeaderIndex(headers) {
    var index = {};
    headers.forEach(function (header, column) {
      var normalized = normalizeHeader(header);
      Object.keys(HEADER_ALIASES).some(function (key) {
        var aliases = HEADER_ALIASES[key].map(normalizeHeader);
        if (aliases.indexOf(normalized) !== -1) { index[key] = column; return true; }
        return false;
      });
    });
    return index;
  }

  function parseProductCsv(text) {
    var delimiter = chooseDelimiter(text);
    var grid = parseDelimited(text, delimiter);
    if (grid.length < 2) throw new Error("হেডারসহ অন্তত একটি পণ্যের সারি দিন।");
    var headerIndex = makeHeaderIndex(grid[0]);
    ["id", "name", "price", "category"].forEach(function (key) {
      if (typeof headerIndex[key] === "undefined") throw new Error("প্রয়োজনীয় কলাম নেই: " + key + " (SKU, Name, Price, Category দিন)।");
    });
    var errors = [];
    var rows = [];
    grid.slice(1).forEach(function (cells, rowIndex) {
      var rowNumber = rowIndex + 2;
      var row = { _row: rowNumber };
      Object.keys(headerIndex).forEach(function (key) {
        row[key] = String(cells[headerIndex[key]] == null ? "" : cells[headerIndex[key]]).trim();
      });
      row.id = row.id || "";
      row.name = row.name || "";
      row.category = row.category || "";
      row.price = parseMoney(row.price);
      if (row.image) row.image = row.image.trim();
      if (row.sizes) row.sizes = splitList(row.sizes);
      if (row.images) row.images = splitList(row.images);
      if (row.stock !== "" && typeof row.stock !== "undefined") {
        var digits = toAsciiDigits(row.stock).replace(/[,\s]/g, "");
        row.stock = /^\d+$/.test(digits) ? Number(digits) : NaN;
      } else delete row.stock;
      ["color", "colorLabel", "fabric", "detailNote"].forEach(function (key) { if (!row[key]) delete row[key]; });
      rows.push(row);
      if (Number.isNaN(row.price)) errors.push("সারি " + rowNumber + ": দাম সংখ্যা নয়।");
      if (typeof row.stock === "number" && (!Number.isFinite(row.stock) || row.stock < 0)) errors.push("সারি " + rowNumber + ": Stock শূন্য বা তার বেশি পূর্ণসংখ্যা হতে হবে।");
    });
    if (rows.length > MAX_ROWS) errors.push("এক ব্যাচে সর্বোচ্চ " + MAX_ROWS + "টি পণ্য নেওয়া যাবে; ফাইলটি ছোট ব্যাচে ভাগ করুন।");
    if (errors.length) return { rows: rows, errors: errors, delimiter: delimiter, maxRows: MAX_ROWS };
    return { rows: rows, errors: [], delimiter: delimiter, maxRows: MAX_ROWS };
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function downloadTemplate() {
    var lines = [
      ["SKU", "Name", "Price", "Category", "Image", "Sizes", "Color", "Color Label", "Fabric", "Stock", "Detail Note", "Images"],
      ["ABY-NEW-01", "Premium Black Abaya", "1450", "abaya", "https://example.com/abaya.jpg", "50|52|54|56", "black", "Classic Black", "Nida", "10", "Full set includes abaya and hijab", "https://example.com/abaya.jpg|https://example.com/abaya-back.jpg"]
    ].map(function (row) { return row.map(csvCell).join(","); });
    var blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url; link.download = "product-import-template.csv"; link.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function mount() {
    var trigger = document.getElementById("pmBulkImport");
    if (!trigger || !root.MaProductManagerBulk) return;
    var input = document.createElement("input");
    input.type = "file"; input.accept = ".csv,text/csv,.tsv,text/tab-separated-values"; input.hidden = true;
    input.setAttribute("aria-label", "পণ্য CSV ফাইল বাছুন");
    document.body.appendChild(input);

    var dialog = document.createElement("dialog");
    dialog.className = "pm-bulk-dialog";
    dialog.setAttribute("aria-labelledby", "pmb-title");
    dialog.innerHTML = '<div class="pmb-head"><div><h2 id="pmb-title">পণ্য CSV আমদানি</h2><p>CSV বা Google Sheets থেকে Download করা CSV বাছুন। SKU দিয়ে পণ্য মিলবে।</p></div><button type="button" class="pmb-close" aria-label="বন্ধ করুন">×</button></div><div class="pmb-tools"><button type="button" class="pl-btn pl-btn-secondary pmb-template">CSV template ডাউনলোড</button><span class="pmb-limit">এক ব্যাচে সর্বোচ্চ ' + MAX_ROWS + 'টি পণ্য</span></div><div class="pmb-status" role="status" aria-live="polite">প্রথমে CSV ফাইল বাছুন।</div><div class="pmb-table-wrap"><table class="pmb-table"><thead><tr><th>CSV সারি</th><th>SKU</th><th>নাম</th><th>ক্যাটাগরি</th><th>দাম</th><th>ফলাফল</th></tr></thead><tbody></tbody></table></div><div class="pmb-actions"><button type="button" class="pl-btn pl-btn-secondary pmb-cancel">বাতিল</button><button type="button" class="pl-btn pl-btn-primary pmb-apply" disabled>Preview-এর পণ্য staging করুন</button></div>';
    document.body.appendChild(dialog);
    var status = dialog.querySelector(".pmb-status"), tbody = dialog.querySelector("tbody"), apply = dialog.querySelector(".pmb-apply");
    var pendingRows = null;

    function close() { dialog.close(); input.value = ""; }
    function draw(preview, parserErrors) {
      tbody.innerHTML = "";
      var itemErrors = [];
      preview.forEach(function (item) { item.errors.forEach(function (e) { itemErrors.push("সারি " + item.row + ": " + e); }); });
      var allErrors = parserErrors.concat(itemErrors);
      var newCount = preview.filter(function (p) { return p.status === "new"; }).length;
      var updateCount = preview.filter(function (p) { return p.status === "update"; }).length;
      status.classList.toggle("is-error", allErrors.length > 0);
      status.textContent = allErrors.length
        ? "আমদানি আটকে আছে — " + allErrors.length + "টি সমস্যা। কোনো পণ্য staging হবে না। " + allErrors.slice(0, 12).join(" | ") + (allErrors.length > 12 ? " | আরও " + (allErrors.length - 12) + "টি সমস্যা" : "")
        : preview.length + "টি বৈধ সারি: " + newCount + "টি নতুন, " + updateCount + "টি SKU-র পণ্য আপডেট হবে। খালি optional ঘর বিদ্যমান মান অপরিবর্তিত রাখে।";
      preview.slice(0, 50).forEach(function (item) {
        var tr = document.createElement("tr");
        [item.row, item.id, item.name, item.category, Number.isFinite(item.price) ? "৳" + item.price.toLocaleString("en-US") : "—", item.errors.length ? item.errors.join("; ") : item.status === "new" ? "নতুন" : "আপডেট"].forEach(function (value) {
          var td = document.createElement("td"); td.textContent = String(value); tr.appendChild(td);
        });
        if (item.errors.length) tr.className = "is-invalid";
        tbody.appendChild(tr);
      });
      if (preview.length > 50) {
        var tr = document.createElement("tr"), td = document.createElement("td");
        td.colSpan = 6; td.textContent = "প্রথম ৫০টি সারি দেখানো হয়েছে; মোট " + preview.length + "টি।"; tr.appendChild(td); tbody.appendChild(tr);
      }
      apply.disabled = allErrors.length > 0 || !preview.length;
    }

    trigger.addEventListener("click", function () {
      if (!root.MaProductManagerBulk.isReady()) {
        window.alert("বর্তমান ক্যাটালগ এখনো লোড হচ্ছে। কয়েক সেকেন্ড পরে আবার CSV আমদানি করুন।");
        return;
      }
      input.click();
    });
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = parseProductCsv(reader.result);
          var preview = root.MaProductManagerBulk.preview(parsed.rows);
          pendingRows = parsed.rows;
          draw(preview, parsed.errors);
          dialog.showModal();
        } catch (err) {
          pendingRows = null;
          draw([], [err.message || String(err)]);
          dialog.showModal();
        }
      };
      reader.onerror = function () { pendingRows = null; draw([], ["ফাইলটি পড়া যায়নি। UTF-8 CSV হিসেবে আবার সেভ করুন।"]); dialog.showModal(); };
      reader.readAsText(file, "UTF-8");
    });
    dialog.querySelector(".pmb-template").addEventListener("click", downloadTemplate);
    dialog.querySelector(".pmb-close").addEventListener("click", close);
    dialog.querySelector(".pmb-cancel").addEventListener("click", close);
    apply.addEventListener("click", function () {
      if (!pendingRows || apply.disabled) return;
      try {
        var result = root.MaProductManagerBulk.apply(pendingRows);
        pendingRows = null;
        status.textContent = result.added + "টি নতুন, " + result.updated + "টি বিদ্যমান SKU আপডেট staging হয়েছে। প্রকাশ করতে Product Manager-এর ‘পরিবর্তন প্রকাশ করুন’ চাপুন।";
        apply.disabled = true;
        setTimeout(close, 1800);
      } catch (err) {
        status.classList.add("is-error"); status.textContent = err.message || String(err);
      }
    });
    dialog.addEventListener("cancel", function () { input.value = ""; });
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { parseProductCsv: parseProductCsv, parseDelimited: parseDelimited, parseMoney: parseMoney };
  } else if (typeof document !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else if (typeof document !== "undefined") mount();
})(typeof window !== "undefined" ? window : globalThis);
