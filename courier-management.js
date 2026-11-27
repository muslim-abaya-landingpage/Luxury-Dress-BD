(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { orders: [], cursor: 0, filter: 'all', search: '', provider: 'all', trackingOrder: null, settlementOrders: [], settlementOrder: null, loading: false, scanMode: 'ship', scanLog: [], scanBusy: false, bulkSelected: {}, bulkBusy: false };
  var RATE_KEYS = ['steadfastInside','steadfastOutside','pathaoInside','pathaoOutside','redxInside','redxOutside'];
  var RATE_IDS = ['cmSteadfastInside','cmSteadfastOutside','cmPathaoInside','cmPathaoOutside','cmRedxInside','cmRedxOutside'];
  var BD_DISTRICTS = ["কক্সবাজার","কিশোরগঞ্জ","কুড়িগ্রাম","কুমিল্লা","কুষ্টিয়া","খাগড়াছড়ি","খুলনা","গাইবান্ধা","গাজীপুর","গোপালগঞ্জ","চট্টগ্রাম","চাঁদপুর","চাঁপাইনবাবগঞ্জ","চুয়াডাঙ্গা","জয়পুরহাট","জামালপুর","ঝালকাঠি","ঝিনাইদহ","টাঙ্গাইল","ঠাকুরগাঁও","ঢাকা","দিনাজপুর","নওগাঁ","নড়াইল","নরসিংদী","নাটোর","নারায়ণগঞ্জ","নীলফামারী","নেত্রকোণা","নোয়াখালী","পঞ্চগড়","পটুয়াখালী","পাবনা","পিরোজপুর","ফরিদপুর","ফেনী","বগুড়া","বরগুনা","বরিশাল","বাগেরহাট","বান্দরবান","ব্রাহ্মণবাড়িয়া","ভোলা","ময়মনসিংহ","মাগুরা","মাদারীপুর","মানিকগঞ্জ","মুন্সিগঞ্জ","মেহেরপুর","মৌলভীবাজার","যশোর","রংপুর","রাঙ্গামাটি","রাজবাড়ী","রাজশাহী","লক্ষ্মীপুর","লালমনিরহাট","শরীয়তপুর","শেরপুর","সাতক্ষীরা","সিরাজগঞ্জ","সিলেট","সুনামগঞ্জ","হবিগঞ্জ"];
  state.zones = [];
  state.zoneDialogIndex = -1;
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function money(value) { var n = Number(value); return isFinite(n) ? '৳' + n.toLocaleString('en-US') : '—'; }
  function statusOf(o) { return String(o.courierStatus || o.status || 'Pending').trim(); }
  function isDelivered(o) { return /deliver/i.test(statusOf(o)) || String(o.status).toLowerCase() === 'delivered'; }
  function isReturned(o) { return /return|cancel|fake/i.test(statusOf(o)) || /return|cancel|fake/i.test(String(o.status || '')); }
  function isShipped(o) { return !!(o.tracking || o.consignmentId) || /shipped|transit|delivered|return/i.test(statusOf(o)); }
  function isReady(o) { return !o.blocked && !isShipped(o) && !o.tracking && !o.consignmentId && /^(confirmed|processing)$/i.test(String(o.status || '')); }
  function providerOf(o) { return String(o.courier || (o.tracking || o.consignmentId ? 'Steadfast' : '')).trim(); }
  function visibleOrders() {
    return state.orders.filter(function (o) {
      var f = state.filter;
      if (f === 'ready' && !isReady(o)) return false;
      if (f === 'shipped' && (!isShipped(o) || isDelivered(o) || isReturned(o))) return false;
      if (f === 'delivered' && !isDelivered(o)) return false;
      if (f === 'returned' && !isReturned(o)) return false;
      var provider = providerOf(o);
      if (state.provider === 'none' && provider) return false;
      if (state.provider !== 'all' && state.provider !== 'none' && provider.toLowerCase() !== state.provider.toLowerCase()) return false;
      if (state.search) {
        var hay = [o.orderId,o.name,o.phone,o.address,o.tracking,o.consignmentId].join(' ').toLowerCase();
        if (hay.indexOf(state.search) === -1) return false;
      }
      return true;
    });
  }
  function renderStats() {
    var a = state.orders;
    $('cmTotal').textContent = a.length;
    $('cmReady').textContent = a.filter(isReady).length;
    $('cmShipped').textContent = a.filter(function (o) { return isShipped(o) && !isDelivered(o) && !isReturned(o); }).length;
    $('cmDelivered').textContent = a.filter(isDelivered).length;
    $('cmReturns').textContent = a.filter(isReturned).length;
  }
  function updateBulkMessage() {
    var n = Object.keys(state.bulkSelected).filter(function (k) { return state.bulkSelected[k]; }).length;
    if (!state.bulkBusy) $('cmBulkMessage').textContent = n ? (n + 'টি অর্ডার নির্বাচিত') : '';
  }
  function renderRows() {
    var rows = visibleOrders();
    $('cmCount').textContent = rows.length + 'টি অর্ডার দেখানো হচ্ছে · ' + state.orders.length + 'টি লোড';
    var stillReady = {};
    rows.forEach(function (o) { if (isReady(o)) stillReady[o.orderId] = true; });
    Object.keys(state.bulkSelected).forEach(function (id) { if (!stillReady[id]) delete state.bulkSelected[id]; });
    if (!rows.length) { $('cmRows').innerHTML = '<tr><td colspan="8" class="cm-empty">এই ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।</td></tr>'; updateBulkMessage(); return; }
    $('cmRows').innerHTML = rows.map(function (o) {
      var ready = isReady(o), tracking = String(o.tracking || o.consignmentId || '');
      var provider = providerOf(o) || '—';
      var badge = isDelivered(o) ? 'delivered' : isReturned(o) ? 'returned' : isShipped(o) ? 'shipped' : ready ? 'ready' : 'pending';
      var label = isDelivered(o) ? 'Delivered' : isReturned(o) ? statusOf(o) : isShipped(o) ? statusOf(o) : ready ? 'পাঠানোর অপেক্ষায়' : String(o.status || 'Pending');
      var action = ready
        ? '<button class="cm-action cm-send" type="button" data-send="' + esc(o.orderId) + '">Steadfast-এ পাঠান</button>'
        : tracking ? '<button class="cm-action cm-track" type="button" data-track="' + esc(o.orderId) + '">ট্র্যাক করুন</button>' : '<span class="cm-muted">—</span>';
      var check = ready
        ? '<input type="checkbox" class="cm-bulk-check" data-bulk-id="' + esc(o.orderId) + '"' + (state.bulkSelected[o.orderId] ? ' checked' : '') + '>'
        : '';
      return '<tr><td>' + check + '</td><td><strong>' + esc(o.orderId || ('Row ' + o.row)) + '</strong><small>' + esc(o.time || '') + '</small></td>' +
        '<td><strong>' + esc(o.name) + '</strong><small>' + esc(o.phone) + '</small></td>' +
        '<td class="cm-address">' + esc(o.address || '—') + '</td><td>' + money(o.due) + '<small>' + esc(o.payment || 'COD') + '</small></td>' +
        '<td>' + esc(provider) + (tracking ? '<small>' + esc(tracking) + '</small>' : '') + '</td>' +
        '<td><span class="cm-badge ' + badge + '">' + esc(label) + '</span></td><td>' + action + '</td></tr>';
    }).join('');
    updateBulkMessage();
  }
  function render() { renderStats(); renderRows(); $('cmLoadMore').hidden = !state.cursor; }
  function csvCell(value) {
    var s = String(value == null ? '' : value).replace(/"/g, '""');
    return '"' + s + '"';
  }
  function exportCsv() {
    var rows = visibleOrders();
    if (!rows.length) { window.alert('এই ফিল্টারে কোনো অর্ডার নেই — এক্সপোর্ট করার কিছু নেই।'); return; }
    var header = ['Order ID', 'Customer', 'Phone', 'Address', 'Due/COD', 'Payment', 'Courier', 'Tracking/Consignment', 'Status'];
    var lines = [header.map(csvCell).join(',')];
    rows.forEach(function (o) {
      lines.push([
        o.orderId || '', o.name || '', o.phone || '', o.address || '',
        o.due != null ? o.due : '', o.payment || '', providerOf(o) || '',
        o.tracking || o.consignmentId || '', statusOf(o)
      ].map(csvCell).join(','));
    });
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'courier-orders-' + localDate() + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function load(append) {
    if (state.loading) return Promise.resolve();
    state.loading = true;
    $('cmRefresh').disabled = true;
    $('cmLoadState').textContent = append ? 'আরও অর্ডার আনা হচ্ছে…' : 'অর্ডার আপডেট হচ্ছে…';
    var params = { Limit: 200 };
    if (append && state.cursor) params.Cursor = state.cursor;
    return MaAdmin.call('AdminOrderList', params, { maxAgeMs: 0 }).then(function (res) {
      var incoming = Array.isArray(res.orders) ? res.orders : [];
      state.orders = append ? state.orders.concat(incoming) : incoming;
      state.cursor = Number(res.nextCursor) || 0;
      $('cmLoadState').textContent = 'সর্বশেষ সার্ভার ডেটা · ' + state.orders.length + 'টি অর্ডার';
      render();
    }).catch(function (err) {
      $('cmLoadState').textContent = 'ডেটা আনা যায়নি: ' + err.message;
      if (!state.orders.length) $('cmRows').innerHTML = '<tr><td colspan="7" class="cm-empty">অর্ডার লোড করা যায়নি। লগইন ও API সংযোগ যাচাই করুন।</td></tr>';
    }).finally(function () { state.loading = false; $('cmRefresh').disabled = false; });
  }
  function loadRates() {
    return MaAdmin.getCourierRates().then(function (rates) {
      RATE_KEYS.forEach(function (key, i) { $(RATE_IDS[i]).value = rates[key] == null ? '' : rates[key]; });
      $('cmRatesMessage').textContent = 'সেটিংস লোড হয়েছে';
    }).catch(function (err) { $('cmRatesMessage').textContent = err.message; });
  }
  function saveRates(event) {
    event.preventDefault();
    var rates = {};
    RATE_KEYS.forEach(function (key, i) { rates[key] = $(RATE_IDS[i]).value.trim(); });
    $('cmSaveRates').disabled = true;
    $('cmRatesMessage').textContent = 'সংরক্ষণ হচ্ছে…';
    MaAdmin.saveCourierRates(rates).then(function () { $('cmRatesMessage').textContent = 'চার্জ সংরক্ষিত হয়েছে।'; })
      .catch(function (err) { $('cmRatesMessage').textContent = 'সংরক্ষণ হয়নি: ' + err.message; })
      .finally(function () { $('cmSaveRates').disabled = false; });
  }
  function zoneDistrictLabel(zone) {
    var n = (zone.districts || []).length;
    if (!n) return 'কোনো জেলা বাছাই করা হয়নি';
    return n + 'টি জেলা';
  }
  function renderZones() {
    var list = $('cmZonesList');
    if (!state.zones.length) { list.innerHTML = '<p class="cm-empty">এখনো কোনো জোন যোগ করা হয়নি। "নতুন জোন যোগ করুন" চাপুন।</p>'; return; }
    list.innerHTML = state.zones.map(function (z, i) {
      return '<div class="cm-zone-row" data-zone-row="' + i + '">' +
        '<input type="text" class="cm-zone-name" placeholder="জোনের নাম (যেমন: ঢাকার ভিতরে)" maxlength="60" value="' + esc(z.name || '') + '" data-zone-name="' + i + '">' +
        '<input type="number" class="cm-zone-fee" min="0" max="2000" step="1" placeholder="চার্জ (৳)" value="' + esc(z.fee == null ? '' : z.fee) + '" data-zone-fee="' + i + '">' +
        '<button type="button" class="adm-btn adm-btn-secondary cm-zone-pick" data-zone-pick="' + i + '">জেলা বাছাই (' + zoneDistrictLabel(z) + ')</button>' +
        '<button type="button" class="cm-zone-remove" data-zone-remove="' + i + '" aria-label="জোন মুছুন">×</button>' +
        '</div>';
    }).join('');
  }
  function loadZones() {
    return MaAdmin.call('AdminCourierZonesGet', {}).then(function (res) {
      state.zones = Array.isArray(res.zones) ? res.zones : [];
      renderZones();
      $('cmZonesMessage').textContent = 'লোড হয়েছে';
    }).catch(function (err) {
      $('cmZonesList').innerHTML = '<p class="cm-empty">জোন লোড করা যায়নি।</p>';
      $('cmZonesMessage').textContent = err.message;
    });
  }
  function readZonesFromForm() {
    var rows = $('cmZonesList').querySelectorAll('[data-zone-row]');
    return Array.prototype.map.call(rows, function (row) {
      var i = Number(row.getAttribute('data-zone-row'));
      return {
        name: (row.querySelector('[data-zone-name="' + i + '"]').value || '').trim(),
        fee: (row.querySelector('[data-zone-fee="' + i + '"]').value || '').trim(),
        districts: (state.zones[i] && state.zones[i].districts) || []
      };
    });
  }
  function saveZones() {
    state.zones = readZonesFromForm();
    $('cmZonesSave').disabled = true;
    $('cmZonesMessage').textContent = 'সংরক্ষণ হচ্ছে…';
    MaAdmin.call('AdminCourierZonesSave', { ZonesJson: JSON.stringify(state.zones) }).then(function (res) {
      state.zones = Array.isArray(res.zones) ? res.zones : [];
      renderZones();
      $('cmZonesMessage').textContent = 'জোন সংরক্ষিত হয়েছে।';
    }).catch(function (err) {
      $('cmZonesMessage').textContent = 'সংরক্ষণ হয়নি: ' + err.message;
    }).finally(function () { $('cmZonesSave').disabled = false; });
  }
  function addZone() {
    state.zones = readZonesFromForm();
    state.zones.push({ name: '', fee: '', districts: [] });
    renderZones();
  }
  function removeZone(i) {
    state.zones = readZonesFromForm();
    state.zones.splice(i, 1);
    renderZones();
  }
  function openZoneDialog(i) {
    state.zones = readZonesFromForm();
    state.zoneDialogIndex = i;
    var zone = state.zones[i] || { districts: [] };
    $('cmZoneDialogName').textContent = zone.name ? zone.name : '(নামহীন জোন)';
    renderZoneDialogList('');
    $('cmZoneDialogSearch').value = '';
    $('cmZoneDialog').showModal();
  }
  function renderZoneDialogList(filter) {
    var zone = state.zones[state.zoneDialogIndex] || { districts: [] };
    var picked = zone.districts || [];
    var f = (filter || '').trim();
    var items = BD_DISTRICTS.filter(function (d) { return !f || d.indexOf(f) !== -1; });
    $('cmZoneDialogList').innerHTML = items.length ? items.map(function (d) {
      var checked = picked.indexOf(d) !== -1 ? ' checked' : '';
      return '<label class="cm-zone-district"><input type="checkbox" value="' + esc(d) + '"' + checked + '> ' + esc(d) + '</label>';
    }).join('') : '<p class="cm-empty">কোনো জেলা মিলেনি।</p>';
  }
  function zoneDialogSetAll(value) {
    Array.prototype.forEach.call($('cmZoneDialogList').querySelectorAll('input[type="checkbox"]'), function (cb) { cb.checked = value; });
  }
  function closeZoneDialog(commit) {
    if (commit && state.zoneDialogIndex !== -1) {
      var zone = state.zones[state.zoneDialogIndex];
      if (zone) {
        var existing = (zone.districts || []).slice();
        var checkedNow = Array.prototype.map.call($('cmZoneDialogList').querySelectorAll('input[type="checkbox"]'), function (cb) { return { v: cb.value, c: cb.checked }; });
        checkedNow.forEach(function (item) {
          var idx = existing.indexOf(item.v);
          if (item.c && idx === -1) existing.push(item.v);
          if (!item.c && idx !== -1) existing.splice(idx, 1);
        });
        zone.districts = existing;
      }
    }
    state.zoneDialogIndex = -1;
    $('cmZoneDialog').close();
    renderZones();
  }
  function invoiceCandidate(o, courier) {
    if (isDelivered(o) || isReturned(o)) return false;
    if (!isShipped(o)) return false;
    if (courier === 'all') return true;
    return providerOf(o).toLowerCase() === courier.toLowerCase();
  }
  function renderInvoiceRows() {
    var courier = $('cmInvoiceCourier').value;
    var rows = state.orders.filter(function (o) { return invoiceCandidate(o, courier); });
    state.invoiceRows = rows;
    if (!rows.length) { $('cmInvoiceRows').innerHTML = '<tr><td colspan="6" class="cm-empty">এই কুরিয়ারে এখনো পাঠানো/পথে থাকা কোনো পার্সেল নেই।</td></tr>'; $('cmInvoiceCount').textContent = '—'; return; }
    $('cmInvoiceRows').innerHTML = rows.map(function (o) {
      return '<tr><td><input type="checkbox" class="cm-invoice-check" data-invoice-id="' + esc(o.orderId) + '" checked></td>' +
        '<td><strong>' + esc(o.orderId || '') + '</strong></td>' +
        '<td>' + esc(o.name) + '<small>' + esc(o.phone) + '</small></td>' +
        '<td class="cm-address">' + esc(o.address || '—') + '</td>' +
        '<td>' + esc(o.tracking || o.consignmentId || '—') + '</td>' +
        '<td>' + money(o.due != null ? o.due : o.total) + '</td></tr>';
    }).join('');
    updateInvoiceCount();
  }
  function updateInvoiceCount() {
    var checks = $('cmInvoiceRows').querySelectorAll('.cm-invoice-check:checked');
    $('cmInvoiceCount').textContent = checks.length + 'টি পার্সেল নির্বাচিত (মোট ' + (state.invoiceRows || []).length + 'টি)';
  }
  function invoiceToggleAll() {
    var checks = $('cmInvoiceRows').querySelectorAll('.cm-invoice-check');
    var allChecked = Array.prototype.every.call(checks, function (c) { return c.checked; });
    Array.prototype.forEach.call(checks, function (c) { c.checked = !allChecked; });
    updateInvoiceCount();
  }
  function printInvoice() {
    var checks = $('cmInvoiceRows').querySelectorAll('.cm-invoice-check:checked');
    var ids = Array.prototype.map.call(checks, function (c) { return c.getAttribute('data-invoice-id'); });
    var rows = (state.invoiceRows || []).filter(function (o) { return ids.indexOf(String(o.orderId)) !== -1; });
    if (!rows.length) { $('cmInvoiceCount').textContent = 'অন্তত একটি পার্সেল বাছুন।'; return; }
    var courierSel = $('cmInvoiceCourier');
    var label = courierSel.options[courierSel.selectedIndex].textContent;
    window.MaCourierInvoice.print(rows, { courier: label });
  }
  function loadPerformance() {
    $('cmPerformance').innerHTML = '<tr><td colspan="5" class="cm-empty">লোড হচ্ছে…</td></tr>';
    MaAdmin.call('AdminCourierPerformance', {}).then(function (res) {
      var items = res.couriers || [];
      $('cmPerformance').innerHTML = items.length ? items.map(function (x) {
        return '<tr><td>' + esc(x.courier) + '</td><td>' + Number(x.total || 0) + '</td><td>' + Number(x.delivered || 0) + '</td><td>' + Number(x.returned || 0) + '</td><td>' + (x.successRate == null ? '—' : Number(x.successRate) + '%') + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="cm-empty">এখনো কুরিয়ার পারফরম্যান্সের রেকর্ড নেই।</td></tr>';
    }).catch(function (err) { $('cmPerformance').innerHTML = '<tr><td colspan="5" class="cm-empty">' + esc(err.message) + '</td></tr>'; });
  }
  function sendToCourier(order) {
    var due = money(order.due);
    if (!window.confirm('অর্ডার ' + order.orderId + ' Steadfast-এ পাঠাবেন?\nগ্রাহক: ' + order.name + '\nCOD / Due: ' + due + '\n\nSteadfast-এ পার্সেল তৈরি হলে অর্ডারের courier status আপডেট হবে।')) return;
    var button = document.querySelector('[data-send="' + CSS.escape(String(order.orderId)) + '"]');
    if (button) { button.disabled = true; button.textContent = 'পাঠানো হচ্ছে…'; }
    MaAdmin.call('AdminSendCourier', { OrderId: order.orderId }).then(function (res) {
      window.alert('Steadfast-এ পার্সেল তৈরি হয়েছে।\nTracking: ' + (res.tracking || '—') + '\nConsignment: ' + (res.consignmentId || '—'));
      return load(false);
    }).catch(function (err) {
      window.alert('কুরিয়ারে পাঠানো যায়নি: ' + err.message);
      if (button) { button.disabled = false; button.textContent = 'Steadfast-এ পাঠান'; }
    });
  }
  function sleep(ms) { return new Promise(function (resolve) { window.setTimeout(resolve, ms); }); }
  function bulkSendSelected() {
    if (state.bulkBusy) return;
    var ids = Object.keys(state.bulkSelected).filter(function (k) { return state.bulkSelected[k]; });
    if (!ids.length) { $('cmBulkMessage').textContent = 'অন্তত একটি অর্ডার বাছুন।'; return; }
    if (!window.confirm(ids.length + 'টি অর্ডার একে একে Steadfast-এ পাঠানো হবে। এগিয়ে যাবেন?')) return;
    state.bulkBusy = true;
    $('cmBulkSend').disabled = true;
    $('cmBulkToggleAll').disabled = true;
    var done = 0, failed = [];
    function next() {
      if (done >= ids.length) {
        state.bulkBusy = false;
        $('cmBulkSend').disabled = false;
        $('cmBulkToggleAll').disabled = false;
        state.bulkSelected = {};
        $('cmBulkMessage').textContent = (ids.length - failed.length) + '/' + ids.length + 'টি পাঠানো সম্পন্ন' +
          (failed.length ? (' · ব্যর্থ: ' + failed.join(', ')) : '');
        return load(false);
      }
      var id = ids[done];
      $('cmBulkMessage').textContent = 'পাঠানো হচ্ছে ' + (done + 1) + '/' + ids.length + ' (' + id + ')…';
      return MaAdmin.call('AdminSendCourier', { OrderId: id }).catch(function (err) {
        failed.push(id + ': ' + (err && err.message || 'ব্যর্থ'));
      }).then(function () {
        done++;
        return sleep(250).then(next);
      });
    }
    return next();
  }
  function showTracking(order, refresh) {
    state.trackingOrder = order;
    $('cmTrackingOrder').textContent = (order.orderId || '') + ' · ' + (order.tracking || order.consignmentId || '');
    $('cmTrackingBody').textContent = refresh ? 'Steadfast থেকে সর্বশেষ স্ট্যাটাস আনা হচ্ছে…' : 'ট্র্যাকিং তথ্য আনা হচ্ছে…';
    var dialog = $('cmTrackingDialog');
    if (!dialog.open) dialog.showModal();
    $('cmTrackingRefresh').disabled = true;
    MaAdmin.call('AdminCourierTracking', { OrderId: order.orderId, Refresh: refresh ? '1' : '0' }, { maxAgeMs: 0 }).then(function (res) {
      var events = Array.isArray(res.events) ? res.events : [];
      var html = '<div class="cm-current-status"><span>বর্তমান কুরিয়ার স্ট্যাটাস</span><strong>' + esc(res.courierStatus || order.courierStatus || 'তথ্য পাওয়া যায়নি') + '</strong></div>';
      if (res.warning) html += '<p class="cm-muted">' + esc(res.warning) + '</p>';
      html += events.length ? '<ol class="cm-events">' + events.map(function (event) {
        return '<li><strong>' + esc(event.message || event.status || 'Courier update') + '</strong><small>' + esc(event.providerTime || event.receivedAt || '') + '</small></li>';
      }).join('') + '</ol>' : '<p class="cm-muted">এই সংযোগ চালুর পর কোনো tracking event পাওয়া যায়নি। সম্পূর্ণ ইতিহাস কুরিয়ারের পোর্টালে দেখুন।</p>';
      $('cmTrackingBody').innerHTML = html;
      if (refresh) load(false);
    }).catch(function (err) { $('cmTrackingBody').textContent = 'ট্র্যাকিং আনা যায়নি: ' + err.message; })
      .finally(function () { $('cmTrackingRefresh').disabled = false; });
  }
  function localDate() {
    var d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  function loadSettlements() {
    $('cmSettlementRows').innerHTML = '<tr><td colspan="8" class="cm-empty">COD settlement লোড হচ্ছে…</td></tr>';
    return MaAdmin.call('AdminCourierSettlementList', {}, { maxAgeMs: 0 }).then(function (res) {
      var summary = res.summary || {};
      $('cmSetDue').textContent = money(summary.totalDue);
      $('cmSetReceived').textContent = money(summary.totalReceived);
      $('cmSetOutstanding').textContent = money(summary.outstanding);
      state.settlementOrders = Array.isArray(res.orders) ? res.orders : [];
      $('cmSettlementRows').innerHTML = state.settlementOrders.length ? state.settlementOrders.map(function (o) {
        var action = Number(o.remaining) > 0
          ? '<button class="cm-action cm-settle" type="button" data-settle="' + esc(o.orderId) + '">জমা লিখুন</button>'
          : '<span class="cm-muted">সম্পূর্ণ জমা</span>';
        var badge = o.status === 'Settled' ? 'delivered' : o.status === 'Partial' ? 'shipped' : 'pending';
        return '<tr><td><strong>' + esc(o.orderId) + '</strong><small>' + esc(o.date || '') + '</small></td>' +
          '<td><strong>' + esc(o.customer || '') + '</strong><small>' + esc(o.phone || '') + '</small></td>' +
          '<td>' + esc(o.courier || '—') + '<small>' + esc(o.consignmentId || o.tracking || '') + '</small></td>' +
          '<td>' + money(o.codDue) + '</td><td>' + money(o.received) + '</td><td><strong>' + money(o.remaining) + '</strong></td>' +
          '<td><span class="cm-badge ' + badge + '">' + esc(o.status) + '</span></td><td>' + action + '</td></tr>';
      }).join('') : '<tr><td colspan="8" class="cm-empty">এখনো কোনো Delivered COD অর্ডার পাওয়া যায়নি।</td></tr>';
      var recent = Array.isArray(res.recent) ? res.recent : [];
      $('cmSettlementRecent').innerHTML = recent.length ? recent.map(function (x) {
        return '<tr><td>' + esc(x.date || x.recordedAt || '') + '</td><td><strong>' + esc(x.orderId) + '</strong></td>' +
          '<td>' + esc(x.courier || '—') + '</td><td>' + money(x.amount) + '</td><td>' + esc(x.reference || '—') + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="cm-empty">এখনো কোনো COD জমার রেকর্ড নেই।</td></tr>';
    }).catch(function (err) {
      $('cmSettlementRows').innerHTML = '<tr><td colspan="8" class="cm-empty">Settlement লোড হয়নি: ' + esc(err.message) + '</td></tr>';
    });
  }
  function openSettlement(order) {
    state.settlementOrder = order;
    $('cmSettlementOrder').textContent = order.orderId + ' · ' + (order.customer || '') + ' · বাকি ' + money(order.remaining);
    $('cmSettlementAmount').value = Number(order.remaining).toFixed(2);
    $('cmSettlementReference').value = '';
    $('cmSettlementDate').value = localDate();
    $('cmSettlementNote').value = '';
    $('cmSettlementMessage').textContent = '';
    $('cmSettlementSave').disabled = false;
    $('cmSettlementDialog').showModal();
  }
  function saveSettlement(event) {
    event.preventDefault();
    var order = state.settlementOrder;
    if (!order) return;
    var payload = {
      OrderId: order.orderId,
      Amount: $('cmSettlementAmount').value,
      Reference: $('cmSettlementReference').value.trim(),
      SettlementDate: $('cmSettlementDate').value,
      Note: $('cmSettlementNote').value.trim()
    };
    $('cmSettlementSave').disabled = true;
    $('cmSettlementMessage').textContent = 'জমা যাচাই ও সংরক্ষণ হচ্ছে…';
    MaAdmin.call('AdminCourierSettlementSave', payload, { maxAgeMs: 0 }).then(function (res) {
      $('cmSettlementMessage').textContent = 'জমা সংরক্ষিত হয়েছে · বাকি ' + money(res.remaining);
      return loadSettlements().then(function () {
        window.setTimeout(function () { $('cmSettlementDialog').close(); }, 650);
      });
    }).catch(function (err) {
      $('cmSettlementMessage').textContent = 'সংরক্ষণ হয়নি: ' + err.message;
      $('cmSettlementSave').disabled = false;
    });
  }
  // ── Scan to Shipping / Scan to Return ──
  function nowClock() {
    var d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(function (n) { return String(n).padStart(2, '0'); }).join(':');
  }
  function renderScanLog() {
    var rows = state.scanLog;
    if (!rows.length) { $('cmScanLog').innerHTML = '<tr><td colspan="5" class="cm-empty">এখনো কিছু স্ক্যান করা হয়নি।</td></tr>'; return; }
    $('cmScanLog').innerHTML = rows.map(function (r) {
      return '<tr><td>' + esc(r.time) + '</td><td><strong>' + esc(r.orderId) + '</strong></td><td>' + esc(r.customer || '—') + '</td>' +
        '<td>' + (r.mode === 'ship' ? 'Scan to Shipping' : 'Scan to Return') + '</td>' +
        '<td><span class="cm-badge ' + (r.ok ? 'scan-ok' : 'scan-err') + '">' + esc(r.message) + '</span></td></tr>';
    }).join('');
  }
  function logScan(mode, orderId, customer, ok, message) {
    state.scanLog.unshift({ time: nowClock(), mode: mode, orderId: orderId, customer: customer, ok: ok, message: message });
    if (state.scanLog.length > 50) state.scanLog.length = 50;
    renderScanLog();
  }
  function scanMessage(text, ok) {
    var el = $('cmScanMessage');
    el.textContent = text;
    el.className = ok == null ? '' : (ok ? 'ok' : 'err');
  }
  function runScan(event) {
    event.preventDefault();
    if (state.scanBusy) return;
    var input = $('cmScanInput');
    var raw = input.value.trim().replace(/^#/, '');
    if (!raw) return;
    var mode = state.scanMode, courier = $('cmScanCourier').value;
    state.scanBusy = true;
    $('cmScanGo').disabled = true;
    scanMessage('যাচাই হচ্ছে…', null);
    MaAdmin.call('AdminOrderGet', { OrderId: raw }).then(function (res) {
      var o = res.order;
      if (mode === 'ship') {
        if (/^(shipped|delivered)$/i.test(o.status) || o.tracking || o.consignmentId) {
          throw Object.assign(new Error('ইতিমধ্যে পাঠানো হয়েছে (' + o.status + ')'), { soft: true });
        }
        if (/^(cancelled|fake)$/i.test(o.status)) {
          throw new Error('এই অর্ডার ' + o.status + ' — পাঠানো যাবে না');
        }
        return MaAdmin.call('AdminOrderUpdate', { OrderId: o.orderId, Status: 'Shipped', Courier: courier }).then(function () {
          return { o: o, message: 'Shipped · ' + courier + ' হিসেবে সেট হয়েছে' };
        });
      }
      // Scan to Return
      if (/^(cancelled|fake)$/i.test(o.status)) {
        throw Object.assign(new Error('ইতিমধ্যে ফেরত/বাতিল হিসেবে রেকর্ড করা আছে — আবার স্ক্যান করার দরকার নেই'), { soft: true });
      }
      var wasDelivered = /^delivered$/i.test(o.status);
      var reason = $('cmReturnReason') ? $('cmReturnReason').value : '';
      var note = (o.adminNote ? o.adminNote + ' | ' : '') + 'ফেরত' + (reason ? ' (' + reason + ')' : '') + ': কুরিয়ার থেকে প্যাকেজ ফেরত এসেছে (স্ক্যান)';
      var soft = !(o.tracking || o.consignmentId || /shipped/i.test(o.status)) ? 'এই অর্ডার আগে কুরিয়ারে পাঠানো হয়েছে বলে রেকর্ড নেই — তবুও ' : '';
      return MaAdmin.call('AdminOrderUpdate', { OrderId: o.orderId, Status: 'Cancelled', AdminNote: note }).then(function () {
        var msg = soft + 'ফেরত হিসেবে রেকর্ড হয়েছে (Status: Cancelled)';
        if (wasDelivered) msg += ' · ⚠️ এই অর্ডার আগে Delivered ছিল — স্টক স্বয়ংক্রিয়ভাবে ফেরত আসেনি, দরকার হলে ম্যানুয়ালি Stock Ledger-এ সমন্বয় করুন।';
        return { o: o, message: msg };
      });
    }).then(function (result) {
      logScan(mode, result.o.orderId, result.o.name, true, result.message);
      scanMessage('✓ ' + result.o.orderId + ' — ' + result.message, true);
      input.value = '';
    }).catch(function (err) {
      logScan(mode, raw, '', false, (err && err.message) || 'ব্যর্থ');
      scanMessage('✗ ' + ((err && err.message) || 'ব্যর্থ'), false);
      if (!(err && err.soft)) input.select();
      else input.value = '';
    }).finally(function () {
      state.scanBusy = false;
      $('cmScanGo').disabled = false;
      input.focus();
    });
  }
  function bind() {
    $('cmRefresh').addEventListener('click', function () { load(false); loadPerformance(); loadSettlements(); });
    $('cmSettlementRefresh').addEventListener('click', loadSettlements);
    $('cmSettlementRows').addEventListener('click', function (e) { var b = e.target.closest('[data-settle]'); if (!b) return; var o = state.settlementOrders.find(function (x) { return String(x.orderId) === b.getAttribute('data-settle'); }); if (o && Number(o.remaining) > 0) openSettlement(o); });
    $('cmSettlementForm').addEventListener('submit', saveSettlement);
    $('cmSettlementClose').addEventListener('click', function () { $('cmSettlementDialog').close(); });
    $('cmSettlementCancel').addEventListener('click', function () { $('cmSettlementDialog').close(); });
    $('cmLoadMore').addEventListener('click', function () { load(true); });
    $('cmExportCsv').addEventListener('click', exportCsv);
    $('cmSearch').addEventListener('input', function (e) { state.search = e.target.value.trim().toLowerCase(); renderRows(); });
    $('cmProvider').addEventListener('change', function (e) { state.provider = e.target.value; renderRows(); });
    $('cmTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-filter]'); if (!b) return;
      state.filter = b.getAttribute('data-filter');
      Array.prototype.forEach.call($('cmTabs').querySelectorAll('button'), function (x) { x.classList.toggle('is-active', x === b); });
      renderRows();
    });
    $('cmRows').addEventListener('click', function (e) {
      var send = e.target.closest('[data-send]'), track = e.target.closest('[data-track]');
      if (send) { var o = state.orders.find(function (x) { return String(x.orderId) === send.getAttribute('data-send'); }); if (o && isReady(o)) sendToCourier(o); }
      if (track) { var t = state.orders.find(function (x) { return String(x.orderId) === track.getAttribute('data-track'); }); if (t) showTracking(t, false); }
    });
    $('cmRows').addEventListener('change', function (e) {
      if (!e.target.classList.contains('cm-bulk-check')) return;
      var id = e.target.getAttribute('data-bulk-id');
      if (e.target.checked) state.bulkSelected[id] = true; else delete state.bulkSelected[id];
      updateBulkMessage();
    });
    $('cmBulkToggleAll').addEventListener('click', function () {
      var ready = visibleOrders().filter(isReady);
      var allSelected = ready.length > 0 && ready.every(function (o) { return state.bulkSelected[o.orderId]; });
      ready.forEach(function (o) { if (allSelected) delete state.bulkSelected[o.orderId]; else state.bulkSelected[o.orderId] = true; });
      renderRows();
    });
    $('cmBulkSend').addEventListener('click', bulkSendSelected);
    $('cmRatesForm').addEventListener('submit', saveRates);
    $('cmPerformanceRefresh').addEventListener('click', loadPerformance);
    $('cmTrackingClose').addEventListener('click', function () { $('cmTrackingDialog').close(); });
    $('cmTrackingDone').addEventListener('click', function () { $('cmTrackingDialog').close(); });
    $('cmTrackingRefresh').addEventListener('click', function () { if (state.trackingOrder) showTracking(state.trackingOrder, true); });
    $('cmScanTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-mode]'); if (!b) return;
      state.scanMode = b.getAttribute('data-mode');
      Array.prototype.forEach.call($('cmScanTabs').querySelectorAll('button'), function (x) { x.classList.toggle('is-active', x === b); });
      $('cmReturnReasonLabel').hidden = state.scanMode !== 'return';
      scanMessage('', null);
      $('cmScanInput').focus();
    });
    $('cmScanForm').addEventListener('submit', runScan);
    $('cmZonesAdd').addEventListener('click', addZone);
    $('cmZonesSave').addEventListener('click', saveZones);
    $('cmZonesList').addEventListener('click', function (e) {
      var pick = e.target.closest('[data-zone-pick]'), remove = e.target.closest('[data-zone-remove]');
      if (pick) openZoneDialog(Number(pick.getAttribute('data-zone-pick')));
      if (remove) removeZone(Number(remove.getAttribute('data-zone-remove')));
    });
    $('cmZoneDialogClose').addEventListener('click', function () { closeZoneDialog(false); });
    $('cmZoneDialogDone').addEventListener('click', function () { closeZoneDialog(true); });
    $('cmZoneDialogAll').addEventListener('click', function () { zoneDialogSetAll(true); });
    $('cmZoneDialogNone').addEventListener('click', function () { zoneDialogSetAll(false); });
    $('cmZoneDialogSearch').addEventListener('input', function (e) { renderZoneDialogList(e.target.value); });
    $('cmInvoiceLoad').addEventListener('click', renderInvoiceRows);
    $('cmInvoiceAll').addEventListener('click', invoiceToggleAll);
    $('cmInvoiceRows').addEventListener('change', function (e) { if (e.target.classList.contains('cm-invoice-check')) updateInvoiceCount(); });
    $('cmInvoicePrint').addEventListener('click', printInvoice);
  }
  document.addEventListener('DOMContentLoaded', function () {
    bind();
    MaAdminGuard.require().then(function (session) {
      if (!session) return;
      load(false); loadRates(); loadZones(); loadPerformance(); loadSettlements();
    }).catch(function () { $('cmLoadState').textContent = 'Admin login প্রয়োজন।'; });
  });
})();
