(function (g) {
  'use strict';
  var MAX_ROWS = 50;
  var MAX_PHOTOS = 7;
  var MAX_FILE_BYTES = 20 * 1024 * 1024;
  var HEADERS = ['category', 'name', 'sku', 'price', 'abaya_only_price', 'color', 'fabric', 'sizes', 'body', 'sleeve', 'dress', 'palazzo', 'description', 'photos'];
  var dialog, options, parsed = [], validated = [], pendingPublish = false, busy = false, photoAliases = Object.create(null), parseRevision = 0, aliasesDirty = false;
  function el(id) { return document.getElementById(id); }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function categoryFor(value) {
    var key = String(value || '').trim().toLowerCase();
    return (options.sections() || []).find(function (s) { return [s.key, s.menu, s.menuBn].some(function (x) { return String(x || '').trim().toLowerCase() === key; }); });
  }
  function filesByName() {
    var map = Object.create(null);
    Array.prototype.forEach.call(el('pbuImages').files || [], function (f) {
      map[String(f.name).toLowerCase()] = f;
      var alias = String(photoAliases[String(f.name).toLowerCase()] || '').trim();
      if (alias) map[alias.toLowerCase()] = f;
    });
    return map;
  }
  function renderPhotoNames() {
    var files = Array.prototype.slice.call(el('pbuImages').files || []), box = el('pbuImageNames');
    box.hidden = !files.length;
    box.innerHTML = files.length ? '<b>Preview filename mapping</b><small>নাম বদলালে Auto-match photos চাপুন। এটি শুধু মিল খোঁজার alias; আপনার ডিভাইসের মূল ফাইলের নাম বদলায় না।</small>' + files.map(function (file, index) { var alias = photoAliases[file.name.toLowerCase()] || file.name; return '<label class="pbu-name-row">' + (index + 1) + '. <span>' + esc(file.name) + '</span><input class="pbu-name-input" data-photo-index="' + index + '" aria-label="Preview filename for ' + esc(file.name) + '" value="' + esc(alias) + '"></label>'; }).join('') : '';
  }
  function handleImagesChanged() {
    photoAliases = Object.create(null);
    Array.prototype.forEach.call(el('pbuImages').files || [], function (file) { photoAliases[file.name.toLowerCase()] = file.name; });
    aliasesDirty = false; renderPhotoNames(); parseAndPreview();
  }
  function normalizeFileKey(value) { return String(value || '').toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9\u0980-\u09ff]/g, ''); }
  function matchPhotoFiles(rows, files) {
    var automaticRows = rows.filter(function (row) { return !row.manualPhotoNames.length && row.product; });
    files.forEach(function (file) {
      var stem = normalizeFileKey(photoAliases[String(file.name).toLowerCase()] || file.name), ranked = [];
      automaticRows.forEach(function (row) {
        var sku = normalizeFileKey(row.source.sku), name = normalizeFileKey(row.source.name), score = 0, method = '';
        if (sku.length >= 3 && stem.indexOf(sku) >= 0) { score = 10000 + sku.length; method = 'SKU'; }
        else if (name.length >= 4 && stem.indexOf(name) >= 0) { score = 5000 + name.length; method = 'product name'; }
        else {
          var words = String(row.source.name || '').toLowerCase().split(/[^a-z0-9\u0980-\u09ff]+/).filter(function (word) { return word.length >= 3; });
          var unique = words.filter(function (word, i) { return words.indexOf(word) === i; });
          if (unique.length >= 2 && unique.every(function (word) { return stem.indexOf(normalizeFileKey(word)) >= 0; })) { score = 1000 + unique.join('').length; method = 'product name'; }
        }
        if (score) ranked.push({ row: row, score: score, method: method });
      });
      if (!ranked.length) return;
      var top = Math.max.apply(Math, ranked.map(function (hit) { return hit.score; }));
      var winners = ranked.filter(function (hit) { return hit.score === top; });
      if (winners.length !== 1) { winners.forEach(function (hit) { hit.row.ambiguousPhotos = true; }); return; }
      var winner = winners[0]; winner.row.photos.push(file); winner.row.photoMatch = winner.row.photoMatch || winner.method;
    });
  }
  function parseAndPreview() {
    var revision = ++parseRevision;
    parsed = []; validated = []; aliasesDirty = false; el('pbuPublish').disabled = true;
    var csv = el('pbuCsv').files[0];
    if (!csv) { el('pbuPreview').innerHTML = '<p>CSV ফাইল নির্বাচন করুন।</p>'; el('pbuPublish').disabled = true; return; }
    if (csv.size > 2 * 1024 * 1024) { el('pbuPreview').innerHTML = '<p class="pbu-error">CSV ফাইল সর্বোচ্চ ২ MB হতে পারবে।</p>'; el('pbuPublish').disabled = true; return; }
    csv.text().then(function (text) {
      if (revision !== parseRevision) return;
      if (!g.MaProductCsv || !g.MaProductPublishUtils) throw Error('CSV tools are still loading. Try again.');
      var table = g.MaProductCsv.parseCsv(text);
      if (!table.length) throw Error('CSV ফাইলটি খালি।');
      var header = table[0].map(function (v) { return String(v || '').trim().toLowerCase(); });
      var missing = ['category', 'name', 'price', 'sizes'].filter(function (name) { return header.indexOf(name) < 0; });
      if (missing.length) throw Error('প্রয়োজনীয় CSV column নেই: ' + missing.join(', '));
      if (table.length - 1 > MAX_ROWS) throw Error('একবারে সর্বোচ্চ ' + MAX_ROWS + 'টি পণ্য যোগ করা যাবে।');
      var indexes = Object.create(null); HEADERS.forEach(function (name) { indexes[name] = header.indexOf(name); });
      var imageMap = filesByName(), imageFiles = Array.prototype.slice.call(el('pbuImages').files || []), existing = Object.create(null), seen = Object.create(null);
      Object.keys(options.products() || {}).forEach(function (cat) { (options.products()[cat] || []).forEach(function (p) { existing[String(p.id || '').toLowerCase()] = true; }); });
      parsed = table.slice(1).map(function (values, index) {
        var row = { line: index + 2, errors: [], photos: [], manualPhotoNames: [] };
        function get(name) { var i = indexes[name]; return i < 0 ? '' : String(values[i] || '').trim(); }
        row.source = { category: get('category'), name: get('name'), sku: get('sku'), price: get('price'), onlyPrice: get('abaya_only_price'), color: get('color'), fabric: get('fabric'), sizes: get('sizes'), body: get('body'), sleeve: get('sleeve'), dress: get('dress'), palazzo: get('palazzo'), note: get('description') };
        var section = categoryFor(row.source.category);
        if (!section) row.errors.push('Category মেলেনি');
        else row.category = section.key;
        row.manualPhotoNames = get('photos').split('|').map(function (v) { return v.trim(); }).filter(Boolean);
        if (row.manualPhotoNames.length > MAX_PHOTOS) row.errors.push('প্রতি পণ্যে সর্বোচ্চ ৭টি ছবি দিন');
        row.manualPhotoNames.forEach(function (name) {
          var file = imageMap[name.toLowerCase()];
          if (!file) row.errors.push('ছবি পাওয়া যায়নি: ' + name);
          else row.photos.push(file);
        });
        try {
          var util = g.MaProductPublishUtils;
          var id = row.source.sku || util.slug(row.source.name) || ('P-' + Date.now().toString(36).toUpperCase() + '-' + (index + 1));
          if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,100}$/.test(id)) throw Error('SKU-তে অক্ষর/সংখ্যা, _ বা - ব্যবহার করুন');
          var folded = id.toLowerCase();
          if (existing[folded] || seen[folded]) throw Error('SKU আগে থেকেই আছে বা batch-এ পুনরাবৃত্তি হয়েছে');
          seen[folded] = true;
          row.product = util.makeProduct({ category: row.category || row.source.category, name: row.source.name, price: row.source.price, onlyPrice: row.source.onlyPrice, color: row.source.color, fabric: row.source.fabric, sizes: row.source.sizes, body: row.source.body, sleeve: row.source.sleeve, dress: row.source.dress, palazzo: row.source.palazzo, note: row.source.note }, id);
        } catch (error) { row.errors.push(error.message); }
        return row;
      });
      matchPhotoFiles(parsed, imageFiles);
      parsed.forEach(function (row) {
        if (!row.photos.length) row.errors.push(row.ambiguousPhotos ? 'ছবিটি একাধিক পণ্যের সঙ্গে মেলে; Photos ঘরে filename লিখে নির্দিষ্ট করুন' : 'SKU/name দিয়ে ছবি মেলেনি; Photos ঘরে filename লিখুন');
        row.photos.forEach(function (file) { if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > MAX_FILE_BYTES) row.errors.push('ছবির format/size ঠিক নয়: ' + file.name); });
        if (row.photos.length > MAX_PHOTOS) row.errors.push('প্রতি পণ্যে সর্বোচ্চ ৭টি ছবি দিন');
        if (row.photos.length > 1 && row.product && row.product.colorLabel) {
          var colors = row.product.colorLabel.split(/[,，;；|]/).map(function (v) { return v.trim(); }).filter(Boolean);
          if (colors.length > 1 && colors.length !== row.photos.length) row.errors.push('প্রতিটি color-এর জন্য একই ক্রমে একটি করে ছবি দিন');
        }
      });
      validated = parsed.filter(function (r) { return !r.errors.length && r.product; });
      renderPreview();
    }).catch(function (error) { if (revision !== parseRevision) return; el('pbuPreview').innerHTML = '<p class="pbu-error">' + esc(error.message || 'CSV পড়া যায়নি।') + '</p>'; el('pbuPublish').disabled = true; });
  }
  function renderPreview() {
    if (!parsed.length) { el('pbuPreview').innerHTML = '<p>CSV ফাইলে কোনো পণ্যের সারি নেই।</p>'; el('pbuPublish').disabled = true; return; }
    var bad = parsed.filter(function (r) { return r.errors.length; });
    var html = '<p><b>' + validated.length + '/' + parsed.length + '</b>টি পণ্য প্রস্তুত' + (bad.length ? ' · ' + bad.length + 'টি সারিতে সমস্যা' : '') + '</p><ol class="pbu-rows">' + parsed.map(function (r) { var photos = r.photos.map(function (f) { var alias = String(photoAliases[f.name.toLowerCase()] || f.name); return alias === f.name ? f.name : alias + ' (' + f.name + ')'; }).join(', '); var mode = r.photoMatch ? ' · Auto-match: ' + r.photoMatch : r.manualPhotoNames.length ? ' · CSV filename' : ''; return '<li class="' + (r.errors.length ? 'is-error' : 'is-ok') + '"><b>সারি ' + r.line + ':</b> ' + esc(r.source.name || '(নাম নেই)') + (r.errors.length ? '<span>' + esc(r.errors.join(' · ')) + '</span>' : '<span>' + esc(r.category) + ' · ৳' + esc(r.product.price) + ' · ' + r.photos.length + ' ছবি' + esc(mode) + (photos ? ': ' + esc(photos) : '') + '</span>'); }).join('') + '</ol>';
    el('pbuPreview').innerHTML = html;
    el('pbuPublish').disabled = !!busy || !validated.length || !!bad.length || pendingPublish;
    if (bad.length) el('pbuNote').textContent = 'সব সারি ঠিক করে আবার preview করুন; ভুল সারি থাকলে publish হবে না।';
    else el('pbuNote').textContent = 'সব পণ্য যাচাই হয়েছে। Confirm করলে পণ্যগুলো একসঙ্গে publish হবে। Stock পরে Stock panel থেকে যোগ করা যাবে।';
  }
  function setBusy(value) { busy = value; ['pbuCsv','pbuImages','pbuClose','pbuAutoMatch'].forEach(function (id) { el(id).disabled = value; }); el('pbuPublish').disabled = value; }
  function todayDhaka() { return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10); }
  function photoPath(id, index, card) { return 'images/uploads/bulk-' + id.toLowerCase() + '-' + Date.now().toString(36) + '-' + (index + 1) + (card ? '-card' : '') + '.webp'; }
  async function resize(file, width) {
    if (!g.MaImageTools || typeof g.MaImageTools.resizeToWebp !== 'function') throw Error('Image tools লোড হয়নি। পেজ refresh করে আবার চেষ্টা করুন।');
    var blob = await g.MaImageTools.resizeToWebp(file, width, 0.82);
    if (blob.size > 2621440) throw Error(file.name + ': ছবিটি ২.৫ MB-এর বেশি হয়েছে। ছোট ছবি দিন।');
    return blob;
  }
  function toBase64(blob) { return new Promise(function (resolve, reject) { var r = new FileReader(); r.onload = function () { resolve(String(r.result).split(',')[1]); }; r.onerror = reject; r.readAsDataURL(blob); }); }
  async function publishBatch() {
    if (busy) return;
    if (pendingPublish) {
      setBusy(true); el('pbuNote').textContent = 'আগের batch-এর publish আবার চেষ্টা হচ্ছে…';
      try { await options.publish(); pendingPublish = false; el('pbuNote').textContent = 'সফল! ' + validated.length + 'টি পণ্যের batch publish হয়েছে।'; el('pbuPublish').hidden = true; }
      catch (error) { el('pbuNote').textContent = 'Publish হয়নি: ' + (error.message || 'ত্রুটি') + '। আবার Retry করুন; পণ্য/ছবি draft-এ রাখা আছে।'; }
      finally { setBusy(false); el('pbuPublish').disabled = !pendingPublish; }
      return;
    }
    if (!validated.length || parsed.some(function (r) { return r.errors.length; })) return;
    setBusy(true); el('pbuNote').textContent = 'ছবি প্রস্তুত হচ্ছে…';
    var assets = [], stagedRows = [], cursor = 0;
    async function worker() {
      while (true) {
        var index = cursor++;
        if (index >= validated.length) return;
        var row = validated[index], product = row.product, paths = [];
        for (var i = 0; i < row.photos.length; i++) {
          var path = photoPath(product.id, i, false), blob = await resize(row.photos[i], 1600);
          assets.push({ path: path, content: await toBase64(blob) }); paths.push(path);
          if (!i) { var card = photoPath(product.id, i, true); assets.push({ path: card, content: await toBase64(await resize(row.photos[i], 800)) }); product.imageCard = card; }
        }
        product.image = paths[0]; product.images = paths.slice(1); product.dateAdded = product.dateAdded || todayDhaka();
        var seo = g.MaProductPublishUtils.seo(product); product.seoTitle = seo.title; product.seoDescription = seo.description;
        var labels = String(product.colorLabel || '').split(/[,，;；|]/).map(function (v) { return v.trim(); }).filter(Boolean);
        if (labels.length > 1) product.colorVariants = labels.map(function (label, j) { return { color: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'color-' + (j + 1), colorLabel: label, image: paths[j] }; });
        stagedRows.push({ category: row.category, product: product, line: row.line });
        el('pbuNote').textContent = 'ছবি প্রস্তুত হচ্ছে… ' + stagedRows.length + '/' + validated.length + ' পণ্য';
      }
    }
    try {
      if (!g.MaCatalogPublisher || !g.MaCatalogPublisher.isReady()) throw Error('Publisher প্রস্তুত নয়; পেজ refresh করে আবার চেষ্টা করুন।');
      await Promise.all(Array.from({ length: Math.min(2, validated.length) }, worker));
      stagedRows.sort(function (a, b) { return a.line - b.line; });
      options.stageMany(stagedRows);
      g.MaCatalogPublisher.enqueue(assets);
      el('pbuNote').textContent = 'সব পণ্য ও ছবি প্রস্তুত; একবারে publish হচ্ছে…';
      try { await options.publish(); }
      catch (error) { pendingPublish = true; throw error; }
      el('pbuNote').textContent = 'সফল! ' + stagedRows.length + 'টি পণ্য একসঙ্গে publish হয়েছে। Live হতে কয়েক মুহূর্ত লাগতে পারে। Stock পরে Stock panel থেকে যোগ করুন।';
      el('pbuPublish').hidden = true;
    } catch (error) {
      el('pbuNote').textContent = (pendingPublish ? 'Publish হয়নি: ' : 'Bulk upload হয়নি: ') + (error.message || 'ত্রুটি') + (pendingPublish ? '। Retry চাপুন; draft-এ থাকা batch অক্ষত আছে।' : '। কোনো batch publish করা হয়নি।');
    } finally { setBusy(false); if (pendingPublish) { el('pbuPublish').textContent = 'Retry publish'; el('pbuPublish').disabled = false; } else if (!el('pbuPublish').hidden) el('pbuPublish').disabled = !validated.length || parsed.some(function (r) { return r.errors.length; }); }
  }
  function downloadTemplate() {
    var sample = [['category','name','sku','price','abaya_only_price','color','fabric','sizes','body','sleeve','dress','palazzo','description','photos'],['abaya','Black Linen Abaya','AB-BLACK-LINEN','1450','','Black','Linen','52, 54','42, 44','','','','Black linen abaya','']];
    var csv = '\ufeff' + sample.map(function (row) { return row.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'bulk-product-template.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function build() {
    if (dialog) return;
    dialog = document.createElement('dialog'); dialog.className = 'pbu-dialog'; dialog.setAttribute('aria-labelledby', 'pbuTitle');
    dialog.innerHTML = '<div class="pbu-head"><div><p class="pbu-kicker">PRODUCT CATALOG</p><h2 id="pbuTitle">Bulk product upload</h2><p>CSV-তে প্রতি পণ্যের একটি row, আর ছবির filename দিন। একসঙ্গে সব পণ্য যাচাই করে একবারে publish করুন।</p></div><button type="button" id="pbuClose" aria-label="Close">×</button></div><div class="pbu-content"><div class="pbu-actions"><button type="button" class="pl-btn pl-btn-secondary" id="pbuTemplate">Download CSV template</button><button type="button" class="pl-btn pl-btn-secondary" id="pbuAutoMatch">Auto-match photos</button></div><label>১. CSV ফাইল<input id="pbuCsv" type="file" accept=".csv,text/csv"></label><small>Required columns: category, name, price, sizes. Photos column optional—খালি রাখলে selected ছবির নাম SKU বা product name-এর সঙ্গে মিলিয়ে auto-match হবে; manual mapping-এ | দিয়ে একাধিক filename লিখুন।</small><label>২. পণ্যের ছবিগুলো একসঙ্গে নির্বাচন করুন<input id="pbuImages" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div id="pbuImageNames" class="pbu-name-list" hidden></div><small>Auto-match-এর জন্য filename-এ SKU বা product name/slug রাখুন (যেমন AB-123-front.jpg)। Preview-তে প্রতিটি match দেখে নিন; না মিললে Photos column-এ filename লিখুন। প্রতি পণ্যে সর্বোচ্চ ৭টি JPG, PNG বা WebP; প্রতিটি ২০ MB পর্যন্ত। সর্বোচ্চ ৫০ পণ্য/বার।</small><div id="pbuPreview" class="pbu-preview" aria-live="polite"><p>CSV ফাইল নির্বাচন করুন।</p></div><p id="pbuNote" class="pbu-note" role="status">কোনো পরিবর্তন হয় না—Confirm না করা পর্যন্ত কিছু upload বা publish করা হবে না।</p></div><div class="pbu-footer"><button type="button" class="pl-btn pl-btn-secondary" id="pbuCancel">Cancel</button><button type="button" class="pl-btn pl-btn-primary" id="pbuPublish" disabled>Confirm & publish batch</button></div>';
    document.body.appendChild(dialog);
    el('pbuCsv').addEventListener('change', parseAndPreview); el('pbuImages').addEventListener('change', handleImagesChanged); el('pbuImageNames').addEventListener('input', function (event) { var input = event.target; if (!input.classList.contains('pbu-name-input')) return; var file = el('pbuImages').files[Number(input.getAttribute('data-photo-index'))]; if (!file) return; photoAliases[file.name.toLowerCase()] = input.value.trim() || file.name; aliasesDirty = true; el('pbuPublish').disabled = true; el('pbuNote').textContent = 'Filename alias বদলেছে। নতুন মিল দেখতে Auto-match photos চাপুন।'; });
    el('pbuTemplate').addEventListener('click', downloadTemplate); el('pbuAutoMatch').addEventListener('click', parseAndPreview); el('pbuPublish').addEventListener('click', publishBatch);
    el('pbuClose').addEventListener('click', function () { if (!busy) dialog.close(); }); el('pbuCancel').addEventListener('click', function () { if (!busy) dialog.close(); });
    dialog.addEventListener('cancel', function (event) { if (busy) event.preventDefault(); });
  }
  function mount(config) { options = config; build(); }
  g.MaProductBulkUpload = { mount: mount, open: function () { if (!dialog) throw Error('Bulk uploader is not ready'); parsed = []; validated = []; pendingPublish = false; el('pbuCsv').value = ''; el('pbuImages').value = ''; photoAliases = Object.create(null); aliasesDirty = false; el('pbuImageNames').hidden = true; el('pbuImageNames').innerHTML = ''; el('pbuPublish').hidden = false; el('pbuPublish').textContent = 'Confirm & publish batch'; el('pbuNote').textContent = 'কোনো পরিবর্তন হয় না—Confirm না করা পর্যন্ত কিছু upload বা publish করা হবে না।'; el('pbuPreview').innerHTML = '<p>CSV ফাইল নির্বাচন করুন।</p>'; dialog.showModal(); } };
})(window);
