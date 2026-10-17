const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../admin-dashboard-logic.js'), 'utf8');
const sandbox = { module: { exports: {} }, Date, Number, String, Math, Array, Object, RegExp, globalThis: null };
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'admin-dashboard-logic.js' });
const logic = sandbox.module.exports;

function dhakaText(epochMs) {
  const date = new Date(epochMs + 6 * 60 * 60 * 1000);
  const pad = value => String(value).padStart(2, '0');
  return `${pad(date.getUTCDate())}-${pad(date.getUTCMonth() + 1)}-${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

test('parses the dashboard order timestamp as Bangladesh local time', () => {
  const expected = Date.UTC(2026, 9, 18, 18, 39, 59) - 6 * 60 * 60 * 1000;
  assert.equal(logic.parseOrderTime('18-10-2026 18:39:59'), expected);
  assert.equal(logic.parseOrderTime('31-02-2026 10:00:00'), null);
});

test('builds pending and overdue tasks using status-specific thresholds', () => {
  const now = Date.UTC(2026, 9, 18, 12, 0, 0);
  const order = (orderId, status, ageMs) => ({ orderId, status, time: dhakaText(now - ageMs), total: '1200' });
  const tasks = logic.buildPriorityTasks([
    order('P-OLD', 'Pending', 2 * 60 * 60 * 1000),
    order('P-NEW', 'Pending', 20 * 60 * 1000),
    { orderId: 'P-NODATE', status: 'Pending', time: '' },
    order('C-OLD', 'Confirmed', 25 * 60 * 60 * 1000),
    order('S-OLD', 'Shipped', 49 * 60 * 60 * 1000),
    order('C-NEW', 'Confirmed', 10 * 60 * 60 * 1000),
    order('D-1', 'Delivered', 100 * 60 * 60 * 1000),
    order('X-1', 'Cancelled', 100 * 60 * 60 * 1000)
  ], now);
  assert.deepEqual(Array.from(tasks, task => task.orderId), ['P-OLD', 'C-OLD', 'S-OLD', 'P-NEW', 'P-NODATE']);
  assert.equal(tasks.filter(task => task.overdue).length, 3);
  assert.equal(tasks.find(task => task.orderId === 'P-NODATE').dateUnknown, true);
});

test('uses inclusive one-hour pending overdue threshold', () => {
  const now = Date.UTC(2026, 9, 18, 12, 0, 0);
  const task = logic.buildPriorityTasks([{ orderId: 'P-EDGE', status: 'Pending', time: dhakaText(now - 60 * 60 * 1000) }], now)[0];
  assert.equal(task.overdue, true);
  assert.equal(task.overdueMs, 0);
});
