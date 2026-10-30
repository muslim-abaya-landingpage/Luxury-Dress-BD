/* Size Manager admin page (owner only). Edits the draft size configuration in Cloudflare D1 through
   POST /api/size-admin (functions/api/size-admin.js) and previews it with the same size-core.js the website
   and the Apps Script order check use. Nothing reaches customers until "প্রকাশ করুন" (publish). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return MaPanel.esc(s == null ? '' : String(s)); };
  var core = window.maSizeCore;

  var CATEGORY_NAMES = {
    abaya: 'আবায়া', 'cover-up': 'কভার আপ', 'premium-two-piece': 'প্রিমিয়াম টু-পিস', 'tops-kurti': 'টপস / কুর্তি',
    embroidery: 'এমব্রয়ডারি', hijab: 'হিজাব', panjabi: 'পাঞ্জাবি', 'three-piece-dress': 'থ্রি পিস ড্রেস'
  };
  var LEGACY_NAMES = { body: 'বডি', length: 'লেন্থ', dressLength: 'জামার লেন্থ', sleeve: 'হাতা', palazzo: 'প্লাজু / পায়জামা', sizes: 'সাধারণ সাইজ' };
  var ERRORS = {
    NOT_LOGGED_IN: 'লগইনের মেয়াদ শেষ। আবার লগইন করুন।', OWNER_ONLY: 'এই কাজ শুধু মূল অ্যাডমিন করতে পারেন।',
    AUTH_UNAVAILABLE: 'লগইন যাচাই করা যায়নি। একটু পরে আবার চেষ্টা করুন।', NOT_CONFIGURED: 'সার্ভারে সাইজ ডাটাবেস যুক্ত নেই।',
    NOT_MIGRATED: 'সাইজ ডাটাবেস এখনো তৈরি হয়নি।', SAVE_FAILED: 'সংরক্ষণ হয়নি। আবার চেষ্টা করুন।',
    CONFLICT: 'অন্য কেউ (বা অন্য ট্যাব) এর মধ্যে এই টেমপ্লেট বদলেছে। রিফ্রেশ করে আবার করুন।',
    BAD_TEMPLATE_ID: 'টেমপ্লেট ID শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও - দিয়ে লিখুন।', TEMPLATE_EXISTS: 'এই ID-র টেমপ্লেট আগেই আছে।',
    BAD_NAME: 'টেমপ্লেটের একটা নাম দিন (< > { } চিহ্ন ছাড়া)।', NO_FIELDS: 'অন্তত একটি ঘর রাখুন।',
    BAD_FIELD_KEY: 'প্রতিটি ঘরের key আলাদা ও শুধু ইংরেজি ছোট হাতের অক্ষর, সংখ্যা ও _ দিয়ে হতে হবে।',
    BAD_LABEL: 'প্রতিটি ঘরের একটা নাম দিন (< > { } চিহ্ন ছাড়া)।', BAD_OPTION: 'মানের তালিকায় খালি, একই রকম বা অচল মান আছে।',
    BAD_DEFAULT: 'ডিফল্ট মান তালিকার একটি মান হতে হবে (অথবা নিজে লেখা চালু করুন)।', BAD_LEGACY: 'পুরনো সাইজের ধরন সঠিক নয়।',
    FIELD_HAS_NO_CHOICES: 'কোনো ঘরে মান নেই। মান দিন অথবা “কাস্টমার নিজে লিখতে পারবে” চালু করুন।',
    TOO_MANY_FIELDS: 'সর্বোচ্চ ২০টি ঘর রাখা যায়।', TOO_MANY_OPTIONS: 'একটি ঘরে সর্বোচ্চ ৬০টি মান রাখা যায়।',
    FIELD_KEY_REMOVED: 'অর্ডারে ব্যবহার হওয়া ঘর মোছা বা key বদলানো যায় না। দরকার হলে ঘরটি বন্ধ করুন।',
    TEMPLATE_IN_USE: 'এই টেমপ্লেট কোনো ক্যাটাগরি বা প্রোডাক্টে ব্যবহার হচ্ছে, তাই মোছা যাবে না।',
    UNKNOWN_TEMPLATE: 'টেমপ্লেট পাওয়া যায়নি।', BAD_CATEGORY: 'এই ক্যাটাগরি সাইজ ম্যানেজারে নেই।',
    BAD_PRODUCT_ID: 'প্রোডাক্ট ID সঠিক নয়।', CATEGORY_TEMPLATE_MISSING: 'কোনো ক্যাটাগরির টেমপ্লেট পাওয়া যাচ্ছে না।',
    PRODUCT_TEMPLATE_MISSING: 'কোনো প্রোডাক্ট ওভাররাইডের টেমপ্লেট পাওয়া যাচ্ছে না।', UNKNOWN_VERSION: 'এই সংস্করণ পাওয়া যায়নি।',
    BAD_NOTE: 'নোটে < > { } চিহ্ন দেবেন না।'
  };

  var state = { draft: null, updatedAt: {}, active: null, activeConfig: null, versions: [], products: [], byId: {} };
  var editor = null;      // template being edited: {isNew, id, name_bn, name_en, fields:[{...field, savedKey}]}
  var ovProduct = null;   // product whose override is open

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function message(el, text, error) { el.textContent = text || ''; el.className = 'sz-msg' + (error ? ' is-error' : text ? ' is-ok' : ''); }
  function status(text, error) { message($('szStatus'), text, error); $('szStatus').classList.add('sz-status'); }
  function errorText(err) { var code = String(err && (err.code || err.message) || ''); return ERRORS[code] || ('সমস্যা হয়েছে (' + code + ')'); }
  function fmtTime(ms) { try { return new Date(Number(ms)).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return String(ms); } }

  function api(action, data) {
    var s = MaAdmin.getSession();
    if (!s) return Promise.reject(Object.assign(new Error('NOT_LOGGED_IN'), { code: 'NOT_LOGGED_IN' }));
    return fetch('/api/size-admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
      body: JSON.stringify(Object.assign({ Token: s.token, action: action }, data || {}))
    }).then(function (res) {
      return res.json().catch(function () { return { ok: false, error: 'SAVE_FAILED' }; });
    }).then(function (body) {
      if (!body || body.ok !== true) throw Object.assign(new Error(body && body.error || 'SAVE_FAILED'), { code: body && body.error });
      return body;
    });
  }

  function loadProducts() {
    return fetch('/catalog-validation.json?catalog_check=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (v) {
        state.products = (v && v.products || []).filter(function (p) { return CATEGORY_NAMES[p.category]; })
          .map(function (p) { return { id: p.id, name: p.name || p.id, category: p.category, sizeLegacy: p.sizeLegacy || {} }; });
        state.byId = {};
        state.products.forEach(function (p) { state.byId[p.id] = p; });
      }).catch(function () { state.products = []; state.byId = {}; });
  }

  function loadActive() {
    return fetch('/api/size-config?admin=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); })
      .then(function (body) { state.activeConfig = body && body.config || null; })
      .catch(function () { state.activeConfig = null; });
  }

  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function renderPending() {
    var box = $('szPending');
    if (!state.draft) { box.hidden = true; return; }
    var pub = state.activeConfig ? { categories: state.activeConfig.categories, templates: state.activeConfig.templates, products: state.activeConfig.products } : null;
    var changed = !pub || stable(pub) !== stable(state.draft);
    box.hidden = false;
    box.className = 'sz-banner' + (changed ? ' is-pending' : '');
    box.textContent = changed
      ? 'খসড়ায় এমন পরিবর্তন আছে যা এখনো প্রকাশ হয়নি। কাস্টমার এখনো সংস্করণ ' + (state.active ? state.active.version : 0) + ' দেখছেন। “প্রকাশ ও ইতিহাস” থেকে প্রকাশ করুন।'
      : 'খসড়া আর প্রকাশিত সংস্করণ ' + (state.active ? state.active.version : 0) + ' একই।';
  }

  function load() {
    status('লোড হচ্ছে…');
    return Promise.all([api('draft'), api('versions'), loadProducts(), loadActive()]).then(function (res) {
      state.draft = res[0].config; state.updatedAt = res[0].updatedAt || {}; state.active = res[0].active;
      state.versions = res[1].versions || [];
      status('খসড়া লোড হয়েছে।' + (state.active ? ' প্রকাশিত সংস্করণ: ' + state.active.version + '।' : ''));
      renderAll();
    }).catch(function (err) { status(errorText(err), true); });
  }

  function templateIds() { return Object.keys(state.draft.templates).sort(); }
  function templateName(id) { var t = state.draft.templates[id]; return t ? (t.name_bn || t.name_en || id) + ' (' + id + ')' : id; }
  function templateOptions(selected, withBlank) {
    return (withBlank ? '<option value="">' + esc(withBlank) + '</option>' : '') + templateIds().map(function (id) {
      return '<option value="' + esc(id) + '"' + (id === selected ? ' selected' : '') + '>' + esc(templateName(id)) + '</option>';
    }).join('');
  }

  function renderAll() {
    renderPending();
    renderCategories();
    renderTemplatePicker();
    renderOverrides();
    renderVersions();
    if (ovProduct) openOverride(ovProduct.id);
  }

  /* ---------- categories ---------- */
  function renderCategories() {
    var counts = {};
    state.products.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
    $('szCategoryRows').innerHTML = Object.keys(CATEGORY_NAMES).map(function (key) {
      var c = state.draft.categories[key] || { template: key, enabled: false };
      return '<tr data-cat="' + esc(key) + '"><td><strong>' + esc(CATEGORY_NAMES[key]) + '</strong><div class="sub">' + esc(key) + '</div></td>' +
        '<td>' + (counts[key] || 0) + '</td>' +
        '<td><select data-cat-template aria-label="' + esc(CATEGORY_NAMES[key]) + ' টেমপ্লেট">' + templateOptions(c.template) + '</select></td>' +
        '<td><label class="sz-switch"><input type="checkbox" data-cat-enabled' + (c.enabled ? ' checked' : '') + '><span>' + (c.enabled ? 'চালু' : 'বন্ধ') + '</span></label></td></tr>';
    }).join('');
  }
  $('szCategoryRows').addEventListener('change', function (e) {
    var row = e.target.closest('tr[data-cat]');
    if (!row) return;
    var key = row.getAttribute('data-cat');
    var enabled = row.querySelector('[data-cat-enabled]').checked;
    var template = row.querySelector('[data-cat-template]').value;
    if (enabled && !confirm(CATEGORY_NAMES[key] + ' ক্যাটাগরিতে নতুন সাইজ সিস্টেম চালু করবেন? প্রকাশ না করা পর্যন্ত কাস্টমার কিছু দেখবেন না।')) { renderCategories(); return; }
    row.querySelectorAll('input,select').forEach(function (el) { el.disabled = true; });
    status('সংরক্ষণ হচ্ছে…');
    api('saveCategory', { category: { category_key: key, template_id: template, enabled: enabled } })
      .then(function () { return load(); }).then(function () { status(CATEGORY_NAMES[key] + ' সংরক্ষিত (খসড়া)।'); })
      .catch(function (err) { status(errorText(err), true); renderCategories(); });
  });

  /* ---------- templates ---------- */
  function renderTemplatePicker() {
    var current = editor && !editor.isNew ? editor.id : $('szTemplatePick').value || templateIds()[0];
    $('szTemplatePick').innerHTML = templateOptions(current);
    if (!editor || (!editor.isNew && !state.draft.templates[editor.id]) || (!editor.isNew && !editor.dirty)) openTemplate(current);
    else renderPreviewProducts();
  }
  function openTemplate(id) {
    var t = state.draft.templates[id];
    if (!t) { editor = null; $('szTemplateForm').hidden = true; return; }
    editor = clone(t);
    editor.isNew = false;
    editor.dirty = false;
    editor.fields.forEach(function (f) { f.savedKey = f.key; });
    $('szTemplateForm').hidden = false;
    renderEditor();
  }
  function newField() {
    return { key: '', label_bn: '', label_en: '', required: true, enabled: true, allowCustom: false, default: '', legacy: [], options: [], savedKey: '' };
  }
  function optionsToText(list) {
    return (list || []).map(function (o) {
      var parts = [o.value];
      if (o.label_en || o.label_bn) parts.push(o.label_en || '');
      if (o.label_bn) parts.push(o.label_bn);
      return parts.join(' | ');
    }).join('\n');
  }
  function textToOptions(text) {
    return String(text || '').split('\n').map(function (line) { return line.trim(); }).filter(Boolean).map(function (line) {
      var p = line.split('|').map(function (s) { return s.trim(); });
      return { value: p[0], label_en: p[1] || '', label_bn: p[2] || '' };
    });
  }

  function fieldHtml(f, i, n) {
    var lockedKey = !!f.savedKey;
    var legacy = Object.keys(LEGACY_NAMES).map(function (slot) {
      return '<label class="sz-check"><input type="checkbox" data-f="legacy" value="' + slot + '"' + (f.legacy.indexOf(slot) >= 0 ? ' checked' : '') + '> ' + esc(LEGACY_NAMES[slot]) + '</label>';
    }).join('');
    return '<li class="sz-field' + (f.enabled ? '' : ' is-off') + '" draggable="true" data-i="' + i + '">' +
      '<div class="sz-field-head"><span class="sz-grip" aria-hidden="true">⋮⋮</span><strong>' + esc(f.label_bn || f.label_en || f.key || 'নতুন ঘর') + '</strong>' +
      '<span class="sz-field-tools"><button type="button" class="pn-btn pn-btn-sm" data-move="-1"' + (i === 0 ? ' disabled' : '') + ' aria-label="উপরে নিন">↑</button>' +
      '<button type="button" class="pn-btn pn-btn-sm" data-move="1"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="নিচে নিন">↓</button>' +
      (lockedKey ? '' : '<button type="button" class="pn-btn pn-btn-sm sz-danger" data-remove aria-label="ঘর মুছুন">মুছুন</button>') + '</span></div>' +
      '<div class="sz-grid">' +
      '<label>নাম (বাংলা)<input data-f="label_bn" maxlength="60" value="' + esc(f.label_bn) + '"></label>' +
      '<label>নাম (English)<input data-f="label_en" maxlength="60" value="' + esc(f.label_en) + '"></label>' +
      '<label>Key (অর্ডারে থাকে, পরে বদলানো যায় না)<input data-f="key" maxlength="40" value="' + esc(f.key) + '"' + (lockedKey ? ' readonly' : '') + ' placeholder="যেমন body"></label>' +
      '<label>ডিফল্ট মান<input data-f="default" maxlength="40" value="' + esc(f.default) + '" placeholder="ফাঁকা = কিছু বাছাই করা থাকবে না"></label>' +
      '</div><div class="sz-flags">' +
      '<label class="sz-check"><input type="checkbox" data-f="enabled"' + (f.enabled ? ' checked' : '') + '> চালু</label>' +
      '<label class="sz-check"><input type="checkbox" data-f="required"' + (f.required ? ' checked' : '') + '> বাধ্যতামূলক</label>' +
      '<label class="sz-check"><input type="checkbox" data-f="allowCustom"' + (f.allowCustom ? ' checked' : '') + '> কাস্টমার নিজে লিখতে পারবে</label></div>' +
      '<label class="sz-block">মানের তালিকা (প্রতি লাইনে একটি। চাইলে: মান | English লেবেল | বাংলা লেবেল)<textarea data-f="options" rows="3">' + esc(optionsToText(f.options)) + '</textarea></label>' +
      '<div class="sz-range"><span>দ্রুত যোগ:</span><input type="number" data-r="from" placeholder="থেকে" aria-label="শুরু"><input type="number" data-r="to" placeholder="পর্যন্ত" aria-label="শেষ"><input type="number" data-r="step" placeholder="ধাপ" value="2" aria-label="ধাপ"><button type="button" class="pn-btn pn-btn-sm" data-range>যোগ করুন</button></div>' +
      '<details class="sz-advanced"><summary>পুরনো প্রোডাক্টের কোন সাইজ এই ঘরে দেখাবে</summary><p class="sz-note">পুরনো প্রোডাক্টে নিচের তালিকার প্রথম যেটা আছে সেটাই দেখাবে। কিছু না বাছলে পুরনো প্রোডাক্টে এই ঘর দেখাবে না।</p><div class="sz-flags">' + legacy + '</div></details>' +
      '</li>';
  }
  function renderEditor() {
    if (!editor) return;
    $('szTplId').value = editor.id || '';
    $('szTplId').readOnly = !editor.isNew;
    $('szTplNameBn').value = editor.name_bn || '';
    $('szTplNameEn').value = editor.name_en || '';
    $('szTemplateDelete').disabled = editor.isNew;
    $('szTemplateDuplicate').disabled = editor.isNew;
    $('szFields').innerHTML = editor.fields.map(function (f, i) { return fieldHtml(f, i, editor.fields.length); }).join('');
    message($('szTemplateMsg'), '');
    renderPreviewProducts();
  }
  function readField(li) {
    var f = editor.fields[Number(li.getAttribute('data-i'))];
    li.querySelectorAll('[data-f]').forEach(function (el) {
      var k = el.getAttribute('data-f');
      if (k === 'legacy') return;
      if (el.type === 'checkbox') f[k] = el.checked;
      else if (k === 'options') f.options = textToOptions(el.value);
      else if (k === 'key') { if (!f.savedKey) f.key = el.value.trim(); }
      else f[k] = el.value.trim();
    });
    f.legacy = Array.prototype.map.call(li.querySelectorAll('[data-f="legacy"]:checked'), function (el) { return el.value; });
  }
  function readEditor() {
    if (!editor) return null;
    if (editor.isNew) editor.id = $('szTplId').value.trim();
    editor.name_bn = $('szTplNameBn').value.trim();
    editor.name_en = $('szTplNameEn').value.trim();
    $('szFields').querySelectorAll('li.sz-field').forEach(readField);
    return editor;
  }
  function editorTemplate() {
    var t = readEditor();
    return { id: t.id, name_bn: t.name_bn, name_en: t.name_en, fields: t.fields.map(function (f) {
      return { key: f.key, label_bn: f.label_bn, label_en: f.label_en, required: f.required, enabled: f.enabled, allowCustom: f.allowCustom,
        default: f.default, legacy: f.legacy.slice(), options: f.options.map(function (o) { return { value: o.value, label_bn: o.label_bn || '', label_en: o.label_en || '' }; }) };
    }) };
  }

  $('szTemplatePick').addEventListener('change', function () {
    if (editor && editor.dirty && !confirm('সংরক্ষণ না করা পরিবর্তন বাদ যাবে। অন্য টেমপ্লেট খুলবেন?')) { $('szTemplatePick').value = editor.id; return; }
    openTemplate($('szTemplatePick').value);
  });
  $('szTemplateNew').addEventListener('click', function () {
    editor = { isNew: true, dirty: true, id: '', name_bn: '', name_en: '', fields: [newField()] };
    $('szTemplateForm').hidden = false;
    renderEditor();
    $('szTplId').focus();
  });
  $('szTemplateDuplicate').addEventListener('click', function () {
    if (!editor || editor.isNew) return;
    var id = prompt('নতুন টেমপ্লেটের ID দিন (ইংরেজি ছোট হাতের, যেমন ' + editor.id + '-kids):', editor.id + '-copy');
    if (!id) return;
    api('duplicateTemplate', { from: editor.id, id: id.trim(), name_bn: (editor.name_bn || '') + ' (কপি)', name_en: editor.name_en ? editor.name_en + ' (copy)' : '' })
      .then(function () { editor = null; $('szTemplatePick').value = id.trim(); return load(); })
      .then(function () { openTemplate(id.trim()); $('szTemplatePick').value = id.trim(); status('কপি তৈরি হয়েছে।'); })
      .catch(function (err) { status(errorText(err), true); });
  });
  $('szTemplateDelete').addEventListener('click', function () {
    if (!editor || editor.isNew) return;
    if (!confirm('“' + templateName(editor.id) + '” টেমপ্লেট মুছবেন? এটি ফেরানো যাবে না (প্রকাশিত পুরনো সংস্করণে থেকে যাবে)।')) return;
    api('deleteTemplate', { id: editor.id }).then(function () { editor = null; return load(); })
      .then(function () { status('টেমপ্লেট মোছা হয়েছে।'); }).catch(function (err) { status(errorText(err), true); });
  });
  $('szFieldAdd').addEventListener('click', function () {
    readEditor();
    if (editor.fields.length >= 20) { message($('szTemplateMsg'), ERRORS.TOO_MANY_FIELDS, true); return; }
    editor.fields.push(newField());
    editor.dirty = true;
    renderEditor();
    var items = $('szFields').querySelectorAll('li.sz-field');
    items[items.length - 1].querySelector('[data-f="label_bn"]').focus();
  });
  function move(from, to) {
    if (to < 0 || to >= editor.fields.length || from === to) return;
    var f = editor.fields.splice(from, 1)[0];
    editor.fields.splice(to, 0, f);
    editor.dirty = true;
    renderEditor();
  }
  $('szFields').addEventListener('click', function (e) {
    var li = e.target.closest('li.sz-field');
    if (!li) return;
    var i = Number(li.getAttribute('data-i'));
    var btn = e.target.closest('button');
    if (!btn) return;
    readEditor();
    if (btn.hasAttribute('data-move')) move(i, i + Number(btn.getAttribute('data-move')));
    else if (btn.hasAttribute('data-remove')) { editor.fields.splice(i, 1); editor.dirty = true; renderEditor(); }
    else if (btn.hasAttribute('data-range')) {
      var from = Number(li.querySelector('[data-r="from"]').value), to = Number(li.querySelector('[data-r="to"]').value), step = Number(li.querySelector('[data-r="step"]').value) || 1;
      if (!isFinite(from) || !isFinite(to) || step <= 0 || to < from || (to - from) / step > 60) { message($('szTemplateMsg'), 'থেকে/পর্যন্ত/ধাপ ঠিকমতো দিন।', true); return; }
      var f = editor.fields[i], have = {};
      f.options.forEach(function (o) { have[core.norm(o.value)] = true; });
      for (var n = from; n <= to + 1e-9; n += step) { var v = String(Math.round(n * 100) / 100); if (!have[v]) f.options.push({ value: v, label_bn: '', label_en: '' }); }
      editor.dirty = true;
      renderEditor();
    }
  });
  $('szFields').addEventListener('input', function () { if (editor) { editor.dirty = true; renderPreview(); } });
  $('szFields').addEventListener('change', function (e) {
    if (!editor) return;
    editor.dirty = true;
    if (e.target.getAttribute('data-f') === 'enabled') e.target.closest('li').classList.toggle('is-off', !e.target.checked);
    renderPreview();
  });
  ['szTplNameBn', 'szTplNameEn', 'szTplId'].forEach(function (id) { $(id).addEventListener('input', function () { if (editor) editor.dirty = true; }); });

  // Drag to reorder (mouse); the ↑↓ buttons do the same on phones and for keyboard users.
  var dragFrom = null;
  $('szFields').addEventListener('dragstart', function (e) {
    var li = e.target.closest && e.target.closest('li.sz-field');
    if (!li || /INPUT|TEXTAREA|SELECT/.test(document.activeElement && document.activeElement.tagName)) { e.preventDefault(); return; }
    dragFrom = Number(li.getAttribute('data-i'));
    li.classList.add('is-dragging');
    try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragFrom)); } catch (err) {}
  });
  $('szFields').addEventListener('dragover', function (e) { if (dragFrom !== null) e.preventDefault(); });
  $('szFields').addEventListener('drop', function (e) {
    var li = e.target.closest('li.sz-field');
    if (dragFrom === null || !li) return;
    e.preventDefault();
    readEditor();
    move(dragFrom, Number(li.getAttribute('data-i')));
    dragFrom = null;
  });
  $('szFields').addEventListener('dragend', function () { dragFrom = null; renderEditor(); });

  $('szTemplateForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = editorTemplate();
    var btn = $('szTemplateSave');
    btn.disabled = true;
    message($('szTemplateMsg'), 'সংরক্ষণ হচ্ছে…');
    var data = { template: t };
    if (!editor.isNew && state.updatedAt[t.id] != null) data.expectedUpdatedAt = state.updatedAt[t.id];
    if (editor.isNew && state.draft.templates[t.id]) { btn.disabled = false; message($('szTemplateMsg'), ERRORS.TEMPLATE_EXISTS, true); return; }
    api('saveTemplate', data).then(function () {
      editor = null;
      return load();
    }).then(function () {
      openTemplate(t.id);
      $('szTemplatePick').value = t.id;
      message($('szTemplateMsg'), 'সংরক্ষিত (খসড়া)। প্রকাশ করলে কাস্টমার দেখবেন।');
    }).catch(function (err) { message($('szTemplateMsg'), errorText(err), true); })
      .then(function () { btn.disabled = false; });
  });

  /* ---------- preview ---------- */
  function previewHtml(resolved, product, note) {
    if (!resolved) return '<p class="sz-note">' + esc(note || 'এই প্রোডাক্টে আগের মতো পুরনো সাইজ দেখাবে।') + '</p>';
    var pick = resolved.fields.map(function (f) { return { key: f.key, value: f.default || (f.options[0] && f.options[0].value) || (f.allowCustom ? '…' : '') }; })
      .filter(function (m) { return m.value && m.value !== '…'; });
    var check = core.validate(resolved, pick);
    return (note ? '<p class="sz-note">' + esc(note) + '</p>' : '') + resolved.fields.map(function (f) {
      return '<div class="sz-pv-field"><div class="sz-pv-label">' + esc(f.label) + (f.required ? ' <span class="sz-req">*</span>' : ' <small>(ঐচ্ছিক)</small>') + '</div><div class="sz-pv-options">' +
        f.options.map(function (o) { return '<span class="sz-chip' + (o.value === f.default ? ' is-on' : '') + '">' + esc(o.label) + '</span>'; }).join('') +
        (f.allowCustom ? '<span class="sz-chip is-custom">নিজে লিখুন…</span>' : '') + '</div></div>';
    }).join('') + (check.size ? '<p class="sz-pv-size">কার্ট/অর্ডারে দেখাবে: <strong>' + esc(check.size) + '</strong></p>' : '');
  }
  function renderPreviewProducts() {
    if (!editor) return;
    var id = editor.id;
    var cats = Object.keys(state.draft.categories).filter(function (k) { return state.draft.categories[k].template === id; });
    var list = state.products.filter(function (p) { return cats.indexOf(p.category) >= 0; });
    var sel = $('szTplPreviewProduct'), prev = sel.value;
    sel.innerHTML = '<option value="">নতুন প্রোডাক্ট (টেমপ্লেটের মান)</option>' + list.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.id + ' · ' + p.name) + '</option>';
    }).join('');
    if (prev && list.some(function (p) { return p.id === prev; })) sel.value = prev;
    renderPreview();
  }
  function renderPreview() {
    if (!editor || !core) return;
    var t;
    try { t = editorTemplate(); } catch (e) { return; }
    var cfg = clone(state.draft);
    cfg.templates[t.id || '__preview__'] = Object.assign({}, t, { id: t.id || '__preview__' });
    cfg.categories.__preview__ = { template: t.id || '__preview__', enabled: true };
    var p = state.byId[$('szTplPreviewProduct').value];
    var product = p ? { id: '__preview__', category: '__preview__', sizeLegacy: p.sizeLegacy } : { id: '__preview__', category: '__preview__', sizeLegacy: {} };
    $('szTplPreview').innerHTML = previewHtml(core.resolve(cfg, product), product,
      p ? 'পুরনো প্রোডাক্ট: তার নিজের আগের সাইজগুলোই দেখাবে।' : 'নতুন প্রোডাক্ট: টেমপ্লেটের মান দেখাবে।');
  }
  $('szTplPreviewProduct').addEventListener('change', renderPreview);

  /* ---------- product overrides ---------- */
  function renderOverrides() {
    $('szProductList').innerHTML = state.products.map(function (p) {
      return '<option value="' + esc(p.id) + '">' + esc(p.name + ' · ' + (CATEGORY_NAMES[p.category] || p.category)) + '</option>';
    }).join('');
    var ids = Object.keys(state.draft.products || {});
    $('szOverrideRows').innerHTML = ids.length ? ids.map(function (id) {
      var o = state.draft.products[id], p = state.byId[id];
      var rule = o.enabled === true ? 'চালু' : o.enabled === false ? 'বন্ধ (পুরনো সাইজ)' : 'ক্যাটাগরির মতো';
      if (o.template) rule += ' · টেমপ্লেট ' + o.template;
      if (o.useTemplate) rule += ' · টেমপ্লেটের মান';
      if (o.fields && Object.keys(o.fields).length) rule += ' · ' + Object.keys(o.fields).length + 'টি ঘর বদল';
      return '<tr><td><strong>' + esc(id) + '</strong><div class="sub">' + esc(p ? p.name : 'ক্যাটালগে পাওয়া যায়নি') + '</div></td><td>' + esc(rule) + '</td><td><button type="button" class="pn-btn pn-btn-sm" data-open="' + esc(id) + '">খুলুন</button></td></tr>';
    }).join('') : '<tr><td colspan="3">কোনো ওভাররাইড নেই।</td></tr>';
  }
  function effectiveTemplateId(product, override) {
    return (override && override.template) || (state.draft.categories[product.category] || {}).template || product.category;
  }
  function triSelect(name, value, labels) {
    var v = value === true ? 'yes' : value === false ? 'no' : '';
    return '<select data-o="' + name + '"><option value="">টেমপ্লেটের মতো</option><option value="yes"' + (v === 'yes' ? ' selected' : '') + '>' + labels[0] + '</option><option value="no"' + (v === 'no' ? ' selected' : '') + '>' + labels[1] + '</option></select>';
  }
  function renderOverrideFields() {
    var o = state.draft.products[ovProduct.id] || {};
    var fields = (ovProduct.pending && ovProduct.pending.fields) || o.fields || {};
    var tpl = state.draft.templates[$('szOvTemplate').value || effectiveTemplateId(ovProduct, o)];
    $('szOvFields').innerHTML = tpl ? tpl.fields.map(function (f) {
      var x = fields[f.key] || {};
      return '<fieldset class="sz-ov-field" data-key="' + esc(f.key) + '"><legend>' + esc(f.label_bn || f.label_en || f.key) + ' <small>(' + esc(f.key) + ')</small></legend><div class="sz-grid">' +
        '<label>দেখাবে?' + triSelect('enabled', x.enabled, ['হ্যাঁ', 'না']) + '</label>' +
        '<label>বাধ্যতামূলক?' + triSelect('required', x.required, ['হ্যাঁ', 'না']) + '</label>' +
        '<label>নিজে লেখা?' + triSelect('allowCustom', x.allowCustom, ['হ্যাঁ', 'না']) + '</label>' +
        '<label>নাম (বাংলা)<input data-o="label_bn" maxlength="60" value="' + esc(x.label_bn != null ? x.label_bn : '') + '" placeholder="' + esc(f.label_bn) + '"></label>' +
        '<label>নাম (English)<input data-o="label_en" maxlength="60" value="' + esc(x.label_en != null ? x.label_en : '') + '" placeholder="' + esc(f.label_en) + '"></label>' +
        '<label>ডিফল্ট<input data-o="default" maxlength="40" value="' + esc(x.default != null ? x.default : '') + '"></label></div>' +
        '<label class="sz-block">নিজস্ব মানের তালিকা (ফাঁকা = টেমপ্লেট বা পুরনো সাইজ)<textarea data-o="options" rows="2">' + esc(x.options ? optionsToText(x.options) : '') + '</textarea></label></fieldset>';
    }).join('') : '<p class="sz-note">টেমপ্লেট পাওয়া যায়নি।</p>';
    renderOverridePreview();
  }
  function readOverride() {
    var mode = $('szOvMode').value;
    var out = { product_id: ovProduct.id, template_id: $('szOvTemplate').value || null, enabled: mode === 'on' ? true : mode === 'off' ? false : null,
      use_template: $('szOvUseTemplate').checked, fields: {} };
    $('szOvFields').querySelectorAll('fieldset[data-key]').forEach(function (fs) {
      var x = {};
      fs.querySelectorAll('[data-o]').forEach(function (el) {
        var k = el.getAttribute('data-o'), v = el.value.trim();
        if (el.tagName === 'SELECT') { if (v) x[k] = v === 'yes'; }
        else if (k === 'options') { if (v) x.options = textToOptions(v); }
        else if (v) x[k] = v;
      });
      if (Object.keys(x).length) out.fields[fs.getAttribute('data-key')] = x;
    });
    return out;
  }
  function renderOverridePreview() {
    if (!ovProduct || !core) return;
    var o = readOverride();
    var cfg = clone(state.draft);
    cfg.products[ovProduct.id] = { template: o.template_id, enabled: o.enabled, useTemplate: o.use_template, fields: o.fields };
    var cat = cfg.categories[ovProduct.category];
    var catOn = !!(cat && cat.enabled);
    var live = core.resolve(cfg, ovProduct);
    var note = '';
    if (!live && o.enabled !== false && !catOn) {
      cfg.products[ovProduct.id].enabled = true;
      note = 'ক্যাটাগরি এখন বন্ধ, তাই কাস্টমার পুরনো সাইজ দেখবেন। চালু হলে এভাবে দেখাবে:';
      live = core.resolve(cfg, ovProduct);
    }
    $('szOvPreview').innerHTML = previewHtml(live, ovProduct, note || (o.enabled === false ? 'এই প্রোডাক্টে পুরনো সাইজ দেখাবে।' : ''));
  }
  function openOverride(id) {
    var p = state.byId[id];
    if (!p) { $('szOverrideForm').hidden = true; ovProduct = null; return; }
    ovProduct = p;
    var o = state.draft.products[id] || {};
    $('szOverrideForm').hidden = false;
    $('szOverrideTitle').textContent = p.id + ' · ' + p.name + ' · ' + (CATEGORY_NAMES[p.category] || p.category);
    $('szOvMode').value = o.enabled === true ? 'on' : o.enabled === false ? 'off' : '';
    $('szOvTemplate').innerHTML = templateOptions(o.template || '', 'ক্যাটাগরির টেমপ্লেট');
    $('szOvUseTemplate').checked = !!o.useTemplate;
    $('szOvDelete').disabled = !state.draft.products[id];
    message($('szOverrideMsg'), '');
    renderOverrideFields();
  }
  $('szProductSearch').addEventListener('change', function () {
    var v = $('szProductSearch').value.trim();
    var p = state.byId[v] || state.products.filter(function (x) { return x.name.toLowerCase() === v.toLowerCase(); })[0];
    if (p && ovProduct && ovProduct.id === p.id) return; // same product: keep unsaved edits
    if (p) openOverride(p.id); else status('এই নামে/ID-তে প্রোডাক্ট পাওয়া যায়নি (Kaftan ও Karchupi তালিকায় নেই)।', true);
  });
  $('szOverrideRows').addEventListener('click', function (e) {
    var b = e.target.closest('[data-open]');
    if (b) { $('szProductSearch').value = b.getAttribute('data-open'); openOverride(b.getAttribute('data-open')); }
  });
  $('szOvTemplate').addEventListener('change', function () { ovProduct.pending = null; renderOverrideFields(); });
  $('szOverrideForm').addEventListener('input', renderOverridePreview);
  $('szOverrideForm').addEventListener('change', renderOverridePreview);
  $('szOverrideForm').addEventListener('submit', function (e) {
    e.preventDefault();
    message($('szOverrideMsg'), 'সংরক্ষণ হচ্ছে…');
    var id = ovProduct.id;
    api('saveOverride', { override: readOverride() }).then(load).then(function () {
      openOverride(id);
      message($('szOverrideMsg'), 'সংরক্ষিত (খসড়া)।');
    }).catch(function (err) { message($('szOverrideMsg'), errorText(err), true); });
  });
  $('szOvDelete').addEventListener('click', function () {
    var id = ovProduct.id;
    if (!confirm(id + ' এর ওভাররাইড মুছবেন? প্রোডাক্টটি ক্যাটাগরির নিয়মে ফিরবে।')) return;
    api('deleteOverride', { product_id: id }).then(load).then(function () { openOverride(id); message($('szOverrideMsg'), 'মোছা হয়েছে (খসড়া)।'); })
      .catch(function (err) { message($('szOverrideMsg'), errorText(err), true); });
  });

  /* ---------- publish & history ---------- */
  function renderVersions() {
    $('szVersionRows').innerHTML = state.versions.length ? state.versions.map(function (v) {
      return '<tr><td><strong>' + v.version + '</strong>' + (v.active ? ' <span class="sz-badge">চলছে</span>' : '') + '</td><td>' + esc(fmtTime(v.published_at)) + '</td><td>' + esc(v.published_by) + '</td><td>' + esc(v.note) + '</td>' +
        '<td>' + (v.active ? '' : '<button type="button" class="pn-btn pn-btn-sm" data-rollback="' + v.version + '">এই সংস্করণে ফিরুন</button>') + '</td></tr>';
    }).join('') : '<tr><td colspan="5">এখনো কিছু প্রকাশ হয়নি।</td></tr>';
  }
  $('szPublishBtn').addEventListener('click', function () {
    var on = Object.keys(state.draft.categories).filter(function (k) { return state.draft.categories[k].enabled; }).map(function (k) { return CATEGORY_NAMES[k] || k; });
    if (!confirm('খসড়াটি প্রকাশ করবেন?\nচালু ক্যাটাগরি: ' + (on.length ? on.join(', ') : 'কোনোটি নয়'))) return;
    var btn = $('szPublishBtn');
    btn.disabled = true;
    message($('szPublishMsg'), 'প্রকাশ হচ্ছে…');
    api('publish', { note: $('szPublishNote').value.trim() }).then(function (r) {
      $('szPublishNote').value = '';
      return load().then(function () { message($('szPublishMsg'), 'সংস্করণ ' + r.version + ' প্রকাশিত হয়েছে।'); });
    }).catch(function (err) { message($('szPublishMsg'), errorText(err), true); }).then(function () { btn.disabled = false; });
  });
  $('szVersionRows').addEventListener('click', function (e) {
    var b = e.target.closest('[data-rollback]');
    if (!b) return;
    var v = b.getAttribute('data-rollback');
    if (!confirm('সংস্করণ ' + v + ' আবার চালু করবেন? খসড়াও ওই সংস্করণের মতো হয়ে যাবে।')) return;
    api('rollback', { version: Number(v) }).then(function (r) {
      editor = null;
      return load().then(function () { message($('szPublishMsg'), 'সংস্করণ ' + v + ' নতুন সংস্করণ ' + r.version + ' হিসেবে চালু হয়েছে।'); });
    }).catch(function (err) { message($('szPublishMsg'), errorText(err), true); });
  });

  /* ---------- tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.sz-tabs [role="tab"]'));
  function showTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    });
    try { sessionStorage.setItem('ma_size_tab', tab.id); } catch (e) {}
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { showTab(t); });
    t.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { var n = tabs[(i + d + tabs.length) % tabs.length]; showTab(n); n.focus(); }
    });
  });
  try { var saved = $(sessionStorage.getItem('ma_size_tab') || ''); if (saved && tabs.indexOf(saved) >= 0) showTab(saved); } catch (e) {}

  window.addEventListener('beforeunload', function (e) { if (editor && editor.dirty) { e.preventDefault(); e.returnValue = ''; } });
  $('szRefresh').addEventListener('click', function () {
    if (editor && editor.dirty && !confirm('সংরক্ষণ না করা পরিবর্তন বাদ যাবে। রিফ্রেশ করবেন?')) return;
    editor = null;
    load();
  });

  MaPanel.init('sizes').then(function (s) {
    if (!s) return;
    if (s.role !== 'admin') { status('এই পেজ শুধু মূল অ্যাডমিনের জন্য।', true); document.querySelectorAll('.sz-panel,.sz-tabs').forEach(function (el) { el.hidden = true; }); return; }
    if (!core) { status('size-core.js লোড হয়নি।', true); return; }
    load();
  });
})();
