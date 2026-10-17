/*
 * Google Sheet <-> Product Manager UI glue.
 * Include after the inline Product Manager code in product-manager.html.
 * Requires Apps Script ProductLibrarySync.example.gs routes to be deployed.
 */
(function (root) {
  'use strict';

  function parseJson(value, fallback, label) {
    if (value == null || value === '') return fallback;
    if (Array.isArray(value) || (value && typeof value === 'object')) return value;
    try { return JSON.parse(String(value)); }
    catch (err) { throw new Error(label + ' JSON সঠিক নয়।'); }
  }

  function toAsciiDigits(value) {
    return String(value == null ? '' : value).replace(/[০-৯]/g, function (digit) {
      return String('০১২৩৪৫৬৭৮৯'.indexOf(digit));
    });
  }

  function parseList(value, label) {
    if (value == null || value === '') return [];
    if (Array.isArray(value)) return value.map(String);
    try {
      var parsed = JSON.parse(String(value));
      if (!Array.isArray(parsed)) throw new Error();
      return parsed.map(String);
    } catch (err) {
      // Allow operator-friendly manual cells such as "S|M|L" as well as JSON arrays.
      return String(value).split(/[|;,]/).map(function (part) { return part.trim(); }).filter(Boolean);
    }
  }

  function mapSheetRows(items) {
    return (items || []).map(function (item, i) {
      item = item || {};
      var priceText = toAsciiDigits(item.price).replace(/[৳,\s]/g, '').trim();
      var stockText = toAsciiDigits(item.stock).replace(/[৳,\s]/g, '').trim();
      return {
        _row: i + 2,
        id: String(item.id || item.sku || '').trim(),
        name: String(item.name || '').trim(),
        category: String(item.category || '').trim(),
        price: priceText ? Number(priceText) : NaN,
        image: String(item.image || '').trim(),
        sizes: parseList(item.sizes, 'Sizes'),
        images: parseList(item.images, 'Images'),
        color: String(item.color || '').trim(),
        colorLabel: String(item.colorLabel || '').trim(),
        fabric: String(item.fabric || '').trim(),
        stock: stockText ? Number(stockText) : undefined,
        detailNote: String(item.detailNote || ''),
        variantMatrix: parseJson(item.variantMatrix, null, 'Variant Matrix'),
        priceByType: parseJson(item.priceByType, null, 'Price by Type'),
        colorVariants: parseJson(item.colorVariants, null, 'Color Variants')
      };
    });
  }

  function matrixErrors(matrix, rowNumber) {
    if (!Array.isArray(matrix)) return ['সারি ' + rowNumber + ': Variant Matrix JSON array হতে হবে।'];
    var errors = [], sku = Object.create(null), combo = Object.create(null);
    matrix.forEach(function (v, i) {
      var line = i + 1, c = String(v && (v.color || v.colorLabel) || '').trim().toLowerCase();
      var s = String(v && v.size || '').trim().toLowerCase();
      var id = String(v && v.sku || '').trim().toLowerCase();
      var price = Number(v && v.price);
      if (!c || !s || !id) errors.push('সারি ' + rowNumber + ', variant ' + line + ': SKU, color ও size লাগবে।');
      if (id && sku[id]) errors.push('সারি ' + rowNumber + ': duplicate variant SKU ' + id + '.');
      if (c && s && combo[c + '\u001f' + s]) errors.push('সারি ' + rowNumber + ': duplicate color × size combination.');
      if (id) sku[id] = true;
      if (c && s) combo[c + '\u001f' + s] = true;
      if (!Number.isFinite(price) || price < 0) errors.push('সারি ' + rowNumber + ', variant ' + line + ': price সঠিক নয়।');
      if (v && v.stock != null && v.stock !== '' && (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0)) {
        errors.push('সারি ' + rowNumber + ', variant ' + line + ': stock শূন্য বা ধনাত্মক পূর্ণসংখ্যা হতে হবে।');
      }
    });
    return errors;
  }

  function mount() {
    var toolbar = document.querySelector('.pm-quick-intro > div:last-child');
    if (!toolbar || !root.MaProductManagerBulk || !root.MaAdmin) return;
    var statusEl = document.getElementById('pmSaveStatus');
    function status(message, isError) {
      if (statusEl) {
        statusEl.textContent = message;
        statusEl.classList.toggle('pm-quick-error', !!isError);
      }
    }
    function addButton(id, label) {
      var existing = document.getElementById(id);
      if (existing) return existing;
      var button = document.createElement('button');
      button.type = 'button'; button.id = id; button.className = 'pl-btn pl-btn-secondary';
      button.textContent = label; toolbar.appendChild(button); return button;
    }
    var importBtn = addButton('pmSheetImport', 'Google Sheet থেকে আনুন');
    var exportBtn = addButton('pmSheetExport', 'Google Sheet-এ Export');

    var dialog = document.createElement('dialog');
    dialog.className = 'pm-bulk-dialog pm-sheet-sync-dialog';
    dialog.innerHTML = '<div class="pmb-head"><div><h2>Google Sheet import preview</h2><p>সব valid হলে পণ্য Product Manager-এ staging হবে; live করতে আলাদা করে প্রকাশ করুন।</p></div><button type="button" class="pmb-close" aria-label="বন্ধ করুন">×</button></div>' +
      '<div class="pmb-status" role="status" aria-live="polite"></div><label class="pm-sheet-stale" hidden><input type="checkbox"> ক্যাটালগ বদলানোর পরও এই পুরোনো Sheet snapshot import করতে চাই</label>' +
      '<div class="pmb-table-wrap"><table class="pmb-table"><thead><tr><th>সারি</th><th>SKU</th><th>নাম</th><th>ক্যাটাগরি</th><th>ফলাফল</th></tr></thead><tbody></tbody></table></div>' +
      '<div class="pmb-actions"><button type="button" class="pl-btn pl-btn-secondary pmb-cancel">বাতিল</button><button type="button" class="pl-btn pl-btn-primary pmb-apply" disabled>বৈধ সারি staging করুন</button></div>';
    document.body.appendChild(dialog);
    var dialogStatus = dialog.querySelector('.pmb-status'), tbody = dialog.querySelector('tbody');
    var applyBtn = dialog.querySelector('.pmb-apply'), staleLabel = dialog.querySelector('.pm-sheet-stale');
    var stagedRows = null, stagedPreview = null, staleSnapshot = false;
    function closeDialog() { dialog.close(); stagedRows = stagedPreview = null; }
    dialog.querySelector('.pmb-close').addEventListener('click', closeDialog);
    dialog.querySelector('.pmb-cancel').addEventListener('click', closeDialog);
    staleLabel.querySelector('input').addEventListener('change', function () { applyBtn.disabled = !!(stagedPreview && stagedPreview.some(function (r) { return r.errors.length; })) || (staleSnapshot && !this.checked); });

    importBtn.addEventListener('click', function () {
      if (dialog.open) return;
      if (!root.MaProductManagerBulk.isReady()) { status('বর্তমান catalog load শেষ হলে আবার চেষ্টা করুন।', true); return; }
      importBtn.disabled = true; status('ProductLibrary tab পড়া হচ্ছে…');
      root.MaAdmin.call('AdminProductSheetRead', {}, { maxAgeMs: 0 }).then(function (res) {
        var rows = mapSheetRows(res.items || []);
        if (!rows.length) throw new Error('ProductLibrary tab-এ কোনো SKU row নেই। আগে catalog export করুন।');
        if (rows.length > 250) throw new Error('একবারে সর্বোচ্চ 250টি পণ্য staging করা যাবে। ProductLibrary tab-কে ছোট batch-এ ভাগ করুন।');
        var preview = root.MaProductManagerBulk.preview(rows);
        var allVariantSkus = Object.create(null);
        rows.forEach(function (row, index) {
          if (typeof row.stock === 'number' && (!Number.isFinite(row.stock) || !Number.isInteger(row.stock) || row.stock < 0)) {
            preview[index].errors.push('সারি ' + (index + 2) + ': Stock শূন্য বা তার বেশি পূর্ণসংখ্যা হতে হবে।');
          }
          if (row.priceByType != null && (!row.priceByType || typeof row.priceByType !== 'object' || Array.isArray(row.priceByType))) {
            preview[index].errors.push('সারি ' + (index + 2) + ': Price By Type JSON object হতে হবে।');
          }
          if (row.priceByType && typeof row.priceByType === 'object') Object.keys(row.priceByType).forEach(function (key) {
            var typePrice = Number(row.priceByType[key]);
            if (!Number.isFinite(typePrice) || typePrice < 0) preview[index].errors.push('সারি ' + (index + 2) + ': Price By Type-এর দাম সঠিক নয় (' + key + ').');
          });
          if (row.colorVariants != null && !Array.isArray(row.colorVariants)) preview[index].errors.push('সারি ' + (index + 2) + ': Color Variants JSON array হতে হবে.');
          if (Array.isArray(row.variantMatrix)) row.variantMatrix.forEach(function (variant) {
            var sku = String(variant && variant.sku || '').trim().toLowerCase();
            if (sku && allVariantSkus[sku]) preview[index].errors.push('সারি ' + (index + 2) + ': catalog-এ duplicate variant SKU ' + sku + '.');
            if (sku) allVariantSkus[sku] = true;
          });
          if (row.variantMatrix != null) matrixErrors(row.variantMatrix, index + 2).forEach(function (err) { preview[index].errors.push(err); });
        });
        var errors = preview.flatMap(function (r) { return r.errors; });
        var creates = preview.filter(function (r) { return r.status === 'new'; }).length;
        var updates = preview.filter(function (r) { return r.status === 'update'; }).length;
        staleSnapshot = !!res.stale;
        staleLabel.hidden = !staleSnapshot;
        staleLabel.querySelector('input').checked = false;
        stagedRows = rows; stagedPreview = preview;
        dialogStatus.classList.toggle('is-error', !!errors.length || staleSnapshot);
        dialogStatus.textContent = (staleSnapshot ? '⚠ Sheet export-এর পর live catalog বদলেছে. ' : '') +
          preview.length + 'টি row · ' + creates + ' নতুন · ' + updates + ' update · ' + errors.length + ' validation error.' +
          (errors.length ? ' ' + errors.slice(0, 8).join(' | ') : '');
        tbody.innerHTML = '';
        preview.slice(0, 100).forEach(function (row, i) {
          var tr = document.createElement('tr');
          [i + 2, row.id, row.name, row.category, row.errors.length ? row.errors.join('; ') : row.status].forEach(function (value) {
            var td = document.createElement('td'); td.textContent = String(value); tr.appendChild(td);
          });
          if (row.errors.length) tr.className = 'is-invalid';
          tbody.appendChild(tr);
        });
        applyBtn.disabled = !!errors.length || staleSnapshot;
        if (staleSnapshot) dialogStatus.textContent += ' import চালু করতে উপরের checkbox টিক দিয়ে নিশ্চিত করুন যে stale snapshot-টি review করেছেন.';
        dialog.showModal();
      }).catch(function (err) { status('Sheet import ব্যর্থ: ' + (err.message || err), true); })
        .finally(function () { importBtn.disabled = false; });
    });

    applyBtn.addEventListener('click', function () {
      if (!stagedRows || applyBtn.disabled) return;
      try {
        var result = root.MaProductManagerBulk.apply(stagedRows);
        closeDialog();
        status(result.added + 'টি নতুন, ' + result.updated + 'টি বিদ্যমান SKU staging হয়েছে। পরিবর্তন প্রকাশ করতে “পরিবর্তন প্রকাশ করুন” চাপুন।');
      } catch (err) { dialogStatus.textContent = err.message || String(err); dialogStatus.classList.add('is-error'); }
    });

    exportBtn.addEventListener('click', function () {
      if (!root.MaProductManagerBulk.isReady()) { status('বর্তমান catalog load শেষ হলে আবার চেষ্টা করুন।', true); return; }
      exportBtn.disabled = true;
      root.MaAdmin.call('AdminCatalogState', {}, { maxAgeMs: 0 }).then(function (state) {
        if (!state.head) throw new Error('বর্তমান catalog version পাওয়া যায়নি।');
        var rows = root.MaProductManagerBulk.exportRows();
        var message = 'Google Sheet-এর ProductLibrary tab-এর সব contents replace হবে। ' + rows.length + 'টি product export হবে। Catalog head: ' + state.head.slice(0, 12) + '… চালাবেন?';
        if (!window.confirm(message)) return null;
        status('ProductLibrary tab-এ export হচ্ছে…');
        return root.MaAdmin.call('AdminProductSheetWrite', {
          ExpectedHead: state.head,
          Payload: JSON.stringify({ items: rows })
        }).then(function (res) {
          status(res.count + 'টি product ProductLibrary tab-এ export হয়েছে। Sync time: ' + res.syncedAt);
        });
      }).catch(function (err) { status('Sheet export ব্যর্থ: ' + (err.message || err), true); })
        .finally(function () { exportBtn.disabled = false; });
    });
  }

  if (typeof document !== 'undefined' && document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else if (typeof document !== 'undefined') mount();
  if (typeof module !== 'undefined' && module.exports) module.exports = { mapSheetRows: mapSheetRows, matrixErrors: matrixErrors, parseList: parseList };
})(typeof window !== 'undefined' ? window : globalThis);
