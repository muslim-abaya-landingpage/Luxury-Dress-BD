(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var state = { tab: 'sales', range: '30d', analytics: null, orders: [], ordersScanned: 0, loading: false };
  var MAX_ORDER_PAGES = 10; // caps customer/employee aggregation to ~2000 recent orders per load
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]); }); }
  function money(value) { var n = Number(value); return isFinite(n) ? '৳' + n.toLocaleString('en-US') : '—'; }
  function isDelivered(o) { return String(o.status || '').toLowerCase() === 'delivered'; }
  function isReturned(o) { return /return|cancel|fake/i.test(String(o.status || '')); }

  function switchTab(tab) {
    state.tab = tab;
    Array.prototype.forEach.call($('rpTabs').querySelectorAll('button'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-tab') === tab); });
    $('rpSalesPanel').hidden = tab !== 'sales';
    $('rpProductPanel').hidden = tab !== 'product';
    $('rpCustomerPanel').hidden = tab !== 'customer';
    $('rpEmployeePanel').hidden = tab !== 'employee';
  }

  function renderSales() {
    var a = state.analytics;
    if (!a) return;
    var s = a.summary || {};
    $('rpTotalOrders').textContent = s.totalOrders || 0;
    $('rpTotalValue').textContent = money(s.totalOrderValue);
    $('rpDeliveredCount').textContent = s.deliveredCount || 0;
    $('rpDeliveredValue').textContent = money(s.deliveredSalesValue);
    $('rpReturnedCount').textContent = (s.returnedCount || 0) + (s.cancelledCount || 0);
    $('rpCustomerCount').textContent = s.customerCount || '—';
    $('rpRepeatCount').textContent = s.repeatCustomerCount ? s.repeatCustomerCount + 'টি পুনরায় ক্রয়' : '';
    var months = a.salesByMonth || [];
    $('rpMonthRows').innerHTML = months.length ? months.map(function (m) {
      return '<tr><td>' + esc(m.month) + '</td><td>' + (m.orders || 0) + '</td><td>' + money(m.revenue) + '</td><td>' + (m.deliveredOrders || 0) + '</td><td>' + money(m.deliveredSales) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="cm-empty">এই সময়সীমায় কোনো অর্ডার নেই।</td></tr>';
    var sources = a.sourceBreakdown || [];
    $('rpSourceRows').innerHTML = sources.length ? sources.map(function (x) {
      var rate = x.successRate == null ? '—' : x.successRate + '%';
      var low = x.successRate != null && x.successRate < 60 ? ' style="color:#b42318;font-weight:700"' : '';
      return '<tr><td>' + esc(x.source) + '</td><td>' + (x.orders || 0) + '</td><td>' + (x.delivered || 0) + '</td><td>' + (x.failed || 0) +
        '</td><td>' + (x.fake || 0) + '</td><td' + low + '>' + rate + '</td><td>' + money(x.deliveredValue || 0) + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="cm-empty">' + esc(a.sourceMessage || 'উৎসের তথ্য নেই।') + '</td></tr>';
  }

  function renderProduct() {
    var a = state.analytics;
    if (!a) return;
    var top = a.topProducts || [];
    $('rpProductRows').innerHTML = top.length ? top.map(function (p) {
      return '<tr><td>' + esc(p.name || p.id) + '</td><td>' + (p.qty || 0) + '</td></tr>';
    }).join('') : '<tr><td colspan="2" class="cm-empty">কোনো তথ্য নেই।</td></tr>';
    var cats = a.topCategories || [];
    $('rpCategoryRows').innerHTML = cats.length ? cats.map(function (c) {
      return '<tr><td>' + esc(c.category || c.name) + '</td><td>' + (c.qty || 0) + '</td></tr>';
    }).join('') : '<tr><td colspan="2" class="cm-empty">কোনো তথ্য নেই।</td></tr>';
    var sizes = a.topSizes || [];
    $('rpSizeRows').innerHTML = sizes.length ? sizes.map(function (s) {
      return '<tr><td>' + esc(s.size || s.name) + '</td><td>' + (s.qty || 0) + '</td></tr>';
    }).join('') : '<tr><td colspan="2" class="cm-empty">কোনো তথ্য নেই।</td></tr>';
  }

  function renderCustomers() {
    var groups = {};
    state.orders.forEach(function (o) {
      var phone = String(o.phone || '').trim();
      if (!phone) return;
      if (!groups[phone]) groups[phone] = { name: o.name || '', phone: phone, orders: 0, delivered: 0, value: 0 };
      groups[phone].orders++;
      if (o.name) groups[phone].name = o.name;
      if (isDelivered(o)) { groups[phone].delivered++; groups[phone].value += Number(o.total) || 0; }
    });
    var list = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.orders - a.orders; }).slice(0, 100);
    $('rpCustomerRows').innerHTML = list.length ? list.map(function (c) {
      return '<tr><td>' + esc(c.name || '—') + '</td><td>' + esc(c.phone) + '</td><td>' + c.orders + '</td><td>' + c.delivered + '</td><td>' + money(c.value) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="cm-empty">কোনো অর্ডার লোড হয়নি।</td></tr>';
    $('rpCustomerNote').textContent = state.ordersScanned + 'টি সাম্প্রতিক অর্ডার স্ক্যান করে সেরা ১০০ কাস্টমার (অর্ডার সংখ্যা অনুযায়ী) দেখানো হয়েছে।';
  }

  function renderEmployees() {
    var groups = {};
    state.orders.forEach(function (o) {
      var name = String(o.assignedTo || '').trim();
      if (!name) return;
      if (!groups[name]) groups[name] = { name: name, orders: 0, delivered: 0, returned: 0, value: 0 };
      groups[name].orders++;
      if (isDelivered(o)) { groups[name].delivered++; groups[name].value += Number(o.total) || 0; }
      if (isReturned(o)) groups[name].returned++;
    });
    var list = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return b.orders - a.orders; });
    $('rpEmployeeRows').innerHTML = list.length ? list.map(function (e) {
      return '<tr><td>' + esc(e.name) + '</td><td>' + e.orders + '</td><td>' + e.delivered + '</td><td>' + e.returned + '</td><td>' + money(e.value) + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="cm-empty">কোনো অর্ডারে কর্মী অ্যাসাইন করা নেই।</td></tr>';
    $('rpEmployeeNote').textContent = state.ordersScanned + 'টি সাম্প্রতিক অর্ডার স্ক্যান করে এই হিসাব করা হয়েছে।';
  }

  function loadAnalytics() {
    return MaAdmin.getAnalyticsV2 ? MaAdmin.getAnalyticsV2({ range: state.range }).then(function (res) {
      state.analytics = res;
      renderSales();
      renderProduct();
    }) : MaAdmin.call('AdminAnalyticsV2', { Range: state.range }).then(function (res) {
      state.analytics = res;
      renderSales();
      renderProduct();
    });
  }

  function loadOrdersForAggregates() {
    state.orders = [];
    state.ordersScanned = 0;
    var cursor = 0, pages = 0;
    function next() {
      pages++;
      var params = { Limit: 200 };
      if (cursor) params.Cursor = cursor;
      return MaAdmin.call('AdminOrderList', params, { maxAgeMs: 0 }).then(function (res) {
        var incoming = Array.isArray(res.orders) ? res.orders : [];
        state.orders = state.orders.concat(incoming);
        state.ordersScanned = state.orders.length;
        cursor = Number(res.nextCursor) || 0;
        if (cursor && pages < MAX_ORDER_PAGES) return next();
      });
    }
    return next().then(function () {
      renderCustomers();
      renderEmployees();
    });
  }

  function load() {
    if (state.loading) return;
    state.loading = true;
    $('rpLoadState').textContent = 'লোড হচ্ছে…';
    $('rpRefresh').disabled = true;
    Promise.all([loadAnalytics(), loadOrdersForAggregates()]).then(function () {
      $('rpLoadState').textContent = 'সর্বশেষ ডেটা লোড হয়েছে।';
    }).catch(function (err) {
      $('rpLoadState').textContent = 'লোড করা যায়নি: ' + err.message;
    }).finally(function () { state.loading = false; $('rpRefresh').disabled = false; });
  }

  function bind() {
    $('rpTabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]'); if (!b) return;
      switchTab(b.getAttribute('data-tab'));
    });
    $('rpRange').addEventListener('change', function (e) { state.range = e.target.value; loadAnalytics(); });
    $('rpRefresh').addEventListener('click', load);
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    MaAdminGuard.require().then(function (session) {
      if (!session) return;
      load();
    }).catch(function () { $('rpLoadState').textContent = 'Admin login প্রয়োজন।'; });
  });
})();
