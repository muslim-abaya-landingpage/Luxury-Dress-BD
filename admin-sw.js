/* Admin app service worker. Network-first: admin data is never served from cache.
   Only purpose: let the admin be installed as an app, show an offline note, and open the
   right page when a new-order notification is tapped. Scope: /admin… pages. */
var OFFLINE_HTML = '<!doctype html><html lang="bn"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>অফলাইন</title>' +
  '<body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui,sans-serif;background:#f4f6f9;color:#1b2738;text-align:center;padding:24px">' +
  '<div><h1 style="font-size:20px">ইন্টারনেট সংযোগ নেই</h1><p>সংযোগ ফিরে এলে আবার চেষ্টা করুন।</p><button onclick="location.reload()" style="padding:10px 18px;border:0;border-radius:10px;background:#1b2a41;color:#fff;font:inherit">আবার চেষ্টা</button></div></body></html>';
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (event) {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(function () {
    return new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }));
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var target = (event.notification.data && event.notification.data.url) || '/admin-orders';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].url.indexOf('/admin') !== -1 && 'focus' in list[i]) { list[i].navigate(target).catch(function () {}); return list[i].focus(); }
    }
    return self.clients.openWindow(target);
  }));
});
