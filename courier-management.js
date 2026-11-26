(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { orders: [], cursor: 0, filter: 'all', search: '', provider: 'all', trackingOrder: null, loading: false };
  var RATE_KEYS = ['steadfastInside','steadfastOutside','pathaoInside','pathaoOutside','redxInside','redxOutside'];
  var RATE_IDS = ['cmSteadfastInside','cmSteadfastOutside','cmPathaoInside','cmPathaoOutside','cmRedxInside','cmRedxOutside'];
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function money(value) { var n = Number(value); return isFinite(n) ? '৳' + n.toLocaleString('en-US') : '—'; }
  function statusOf(o) { return String(o.courierStatus || o.status || 'Pending').trim(); }
  function isDelivered(o) { return /deliver/i.test(statusOf(o)) || String(o.status).toLowerCase() === 'delivered'; }
  function isReturned(o) { return /return|cancel|fake/i.test(statusOf(o)) || /return|cancel|fake/i.test(String(o.status || '')); }
  function isShipped(o) { return !!(o.tracking || o.consignmentId) || /shipped|transit|delivered|return/i.test(statusOf(o)); }
  function isReady(o) { return !isShipped(o) && !o.tracking && !o.consignmentId && /^(confirmed|processing)$/i.test(String(o.status || '')); }
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
  function renderRows() {
    var rows = visibleOrders();
    $('cmCount').textContent = rows.length + 'টি অর্ডার দেখানো হচ্ছে · ' + state.orders.length + 'টি লোড';
    if (!rows.length) { $('cmRows').innerHTML = '<tr><td colspan="7" class="cm-empty">এই ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।</td></tr>'; return; }
    $('cmRows').innerHTML = rows.map(function (o) {
      var ready = isReady(o), tracking = String(o.tracking || o.consignmentId || '');
      var provider = providerOf(o) || '—';
      var badge = isDelivered(o) ? 'delivered' : isReturned(o) ? 'returned' : isShipped(o) ? 'shipped' : ready ? 'ready' : 'pending';
      var label = isDelivered(o) ? 'Delivered' : isReturned(o) ? statusOf(o) : isShipped(o) ? statusOf(o) : ready ? 'পাঠানোর অপেক্ষায়' : String(o.status || 'Pending');
      var action = ready
        ? '<button class="cm-action cm-send" type="button" data-send="' + esc(o.orderId) + '">Steadfast-এ পাঠান</button>'
        : tracking ? '<button class="cm-action cm-track" type="button" data-track="' + esc(o.orderId) + '">ট্র্যাক করুন</button>' : '<span class="cm-muted">—</span>';
      return '<tr><td><strong>' + esc(o.orderId || ('Row ' + o.row)) + '</strong><small>' + esc(o.time || '') + '</small></td>' +
        '<td><strong>' + esc(o.name) + '</strong><small>' + esc(o.phone) + '</small></td>' +
        '<td class="cm-address">' + esc(o.address || '—') + '</td><td>' + money(o.due) + '<small>' + esc(o.payment || 'COD') + '</small></td>' +
        '<td>' + esc(provider) + (tracking ? '<small>' + esc(tracking) + '</small>' : '') + '</td>' +
        '<td><span class="cm-badge ' + badge + '">' + esc(label) + '</span></td><td>' + action + '</td></tr>';
    }).join('');
  }
  function render() { renderStats(); renderRows(); $('cmLoadMore').hidden = !state.cursor; }
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
  function bind() {
    $('cmRefresh').addEventListener('click', function () { load(false); loadPerformance(); });
    $('cmLoadMore').addEventListener('click', function () { load(true); });
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
    $('cmRatesForm').addEventListener('submit', saveRates);
    $('cmPerformanceRefresh').addEventListener('click', loadPerformance);
    $('cmTrackingClose').addEventListener('click', function () { $('cmTrackingDialog').close(); });
    $('cmTrackingDone').addEventListener('click', function () { $('cmTrackingDialog').close(); });
    $('cmTrackingRefresh').addEventListener('click', function () { if (state.trackingOrder) showTracking(state.trackingOrder, true); });
  }
  document.addEventListener('DOMContentLoaded', function () {
    bind();
    MaAdminGuard.require().then(function (session) {
      if (!session) return;
      load(false); loadRates(); loadPerformance();
    }).catch(function () { $('cmLoadState').textContent = 'Admin login প্রয়োজন।'; });
  });
})();
