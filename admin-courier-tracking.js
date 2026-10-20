(function () {
  'use strict';
  var current = null, generation = 0;
  function el(id) { return document.getElementById(id); }
  function text(id, value) { el(id).textContent = value || 'তথ্য পাওয়া যায়নি'; }
  function paint(result) {
    text('ctStatus', result.courierStatus);
    var badge = el('oStatusBadge');
    if (badge && result.courierStatus) {
      badge.textContent = result.courierStatus;
      badge.className = 'pn-badge ' + MaOrderStatus.describe({ courierStatus: result.courierStatus }).badgeKey;
    }
    text('ctChecked', result.fetchedAt ? 'API থেকে যাচাই: ' + new Date(result.fetchedAt).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' }) : 'সংরক্ষিত কুরিয়ার তথ্য');
    text('ctWarning', result.warning || 'কুরিয়ারের মূল স্ট্যাটাস ও পাঠানো বার্তা দেখানো হচ্ছে।');
    var list = el('ctEvents'); list.replaceChildren();
    var events = result.events || [];
    events.forEach(function (event) {
      var item = document.createElement('li');
      var title = document.createElement('strong'); title.textContent = event.message || event.status || 'কুরিয়ার আপডেট'; item.appendChild(title);
      var meta = document.createElement('small');
      meta.textContent = (event.providerTime ? 'কুরিয়ারের সময়: ' + event.providerTime : 'গ্রহণের সময়: ' + new Date(event.receivedAt).toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' })) + (event.status ? ' · ' + event.status : '');
      item.appendChild(meta); list.appendChild(item);
    });
    el('ctEmpty').hidden = events.length > 0;
    text('ctScope', result.historyScope || 'এই সংযোগ চালুর পর পাওয়া ঘটনাগুলো এখানে থাকবে। আগের সম্পূর্ণ ইতিহাস কুরিয়ারের পোর্টালে দেখুন।');
  }
  function load(refresh) {
    if (!current) return;
    var serial = ++generation, id = current.orderId;
    el('ctRefresh').disabled = true;
    text('ctWarning', refresh ? 'Steadfast থেকে স্ট্যাটাস আনা হচ্ছে…' : 'কুরিয়ারের ঘটনাগুলো আনা হচ্ছে…');
    MaAdmin.call('AdminCourierTracking', { OrderId: id, Refresh: refresh ? '1' : '0' }, { maxAgeMs: 0 }).then(function (result) {
      if (serial !== generation) return;
      if (result.version !== 1) throw new Error('TRACKING_NOT_READY');
      paint(result);
      if (refresh && window.MaPanel && MaPanel.toast) {
        MaPanel.toast('Steadfast courier status updated ✓');
      }
    }).catch(function () {
      if (serial === generation) {
        text('ctWarning', 'বিস্তারিত কুরিয়ার সংযোগ সক্রিয় নেই বা সাড়া পাওয়া যাচ্ছে না। মূল স্ট্যাটাস উপরে দেখুন; সম্পূর্ণ তথ্য Steadfast-এ খুলুন।');
        if (refresh && window.MaPanel && MaPanel.toast) MaPanel.toast('Steadfast status sync failed', true);
      }
    }).finally(function () { if (serial === generation) el('ctRefresh').disabled = false; });
  }
  document.addEventListener('ma-order-rendered', function (event) {
    current = event.detail;
    el('courierTrackingPanel').hidden = !Boolean(current.tracking || current.consignmentId || current.courierStatus);
    if (el('courierTrackingPanel').hidden) { generation++; return; }
    paint({ courierStatus: current.courierStatus, events: [] });
    var portal = el('ctPortal'), cid = String(current.consignmentId || '');
    portal.hidden = !/^\d+$/.test(cid);
    if (!portal.hidden) portal.href = 'https://steadfast.com.bd/user/consignment/' + encodeURIComponent(cid);
    load(false);
  });
  document.addEventListener('DOMContentLoaded', function () {
    el('ctRefresh').addEventListener('click', function () { load(true); });
  });
})();
