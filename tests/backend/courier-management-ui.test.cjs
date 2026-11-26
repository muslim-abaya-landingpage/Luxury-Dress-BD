'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('courier management page is admin-guarded and links into existing admin workspace', () => {
  const html = read('courier-management.html');
  assert.match(html, /data-admin-guard="1"/);
  assert.match(html, /admin-guard\.js/);
  assert.match(html, /MaAdmin/);
  assert.match(html, /admin-orders\.html/);
  assert.match(html, /courier-management\.js/);
});

test('courier workspace uses only existing authenticated courier/order APIs', () => {
  const js = read('courier-management.js');
  for (const type of ['AdminOrderList', 'AdminSendCourier', 'AdminCourierTracking', 'AdminCourierPerformance']) {
    assert.ok(js.includes("'" + type + "'"), 'missing API contract: ' + type);
  }
  assert.match(js, /MaAdmin\.getCourierRates/);
  assert.match(js, /MaAdmin\.saveCourierRates/);
  assert.match(js, /MaAdminGuard\.require/);
  assert.match(js, /isReady\(o\)/);
  assert.match(js, /window\.confirm/);
  assert.match(js, /escape|esc\(/);
});

test('unsupported Pathao and RedX parcel creation is not presented as enabled', () => {
  const html = read('courier-management.html');
  assert.match(html, /তুলনার জন্য/);
  assert.match(html, /API-তে পার্সেল পাঠানো এখনো সংযুক্ত নয়/);
});
