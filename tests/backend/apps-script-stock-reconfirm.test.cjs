const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const code = fs.readFileSync('apps-script/Code.gs', 'utf8');
const adminOrders = fs.readFileSync('apps-script/AdminOrders.gs', 'utf8');

test('SOLD to Confirmed never writes a false RESERVED stock stage', () => {
  const start = code.indexOf("if (target === 'RESERVED') {", code.indexOf('function applyStockLifecycleForStatusChangeLocked_'));
  const end = code.indexOf("} else if (target === 'RELEASED') {", start);
  assert.ok(start >= 0 && end > start, 'Could not locate SOLD-to-RESERVED lifecycle branch');
  const branch = code.slice(start, end);
  assert.match(branch, /currentStage === 'SOLD'/);
  assert.match(branch, /throw new Error\('STOCK_RECONFIRM_REQUIRES_REVIEW'\)/);
  const soldStart = branch.indexOf("if (currentStage === 'SOLD') {");
  const reserveCall = branch.indexOf("reserveStockForOrderItems_(items, orderId", soldStart);
  assert.ok(soldStart >= 0 && reserveCall > soldStart, 'Could not locate the non-SOLD reservation path');
  assert.doesNotMatch(branch.slice(soldStart, reserveCall), /reserveStockForOrderItems_\(items, orderId/);
  assert.match(branch.slice(reserveCall), /^reserveStockForOrderItems_/);
});

test('admin order update surfaces a manual-review error and does not save the new status', () => {
  assert.match(adminOrders, /stockMessage === 'STOCK_RECONFIRM_REQUIRES_REVIEW'/);
  assert.match(adminOrders, /error: 'STOCK_RECONFIRM_REQUIRES_REVIEW'/);
  const start = adminOrders.indexOf("if (stockMessage === 'STOCK_RECONFIRM_REQUIRES_REVIEW')");
  const end = adminOrders.indexOf("if (stockMessage.indexOf('STOCK_LEDGER_MISMATCH:')", start);
  assert.ok(start >= 0 && end > start);
  assert.match(adminOrders.slice(start, end), /স্ট্যাটাস পরিবর্তন করা হয়নি/);
});
