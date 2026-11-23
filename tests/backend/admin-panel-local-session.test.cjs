const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadPanel(session) {
  const side = { dataset: { sharedDesign: '1' }, querySelector: () => null };
  const document = { getElementById: (id) => id === 'pnSide' ? side : null };
  let guardCalls = 0;
  const window = {
    MaAdmin: { getSession: () => session },
    MaAdminGuard: { require: () => { guardCalls++; return Promise.resolve(session); } },
    location: { pathname: '/admin-order-new', search: '' }
  };
  vm.runInNewContext(fs.readFileSync('admin-panel.js', 'utf8'), { window, document, Promise });
  return { panel: window.MaPanel, window, get guardCalls() { return guardCalls; } };
}

test('new-order local session mode avoids legacy remote AdminVerify', async () => {
  const session = { token: 'test-token', role: 'admin', name: 'Admin' };
  const harness = loadPanel(session);
  const result = await harness.panel.init('orders', { localSessionOnly: true });
  assert.equal(result, session);
  assert.equal(harness.guardCalls, 0);
});

test('new-order local session mode redirects when no local session exists', async () => {
  const harness = loadPanel(null);
  const result = await harness.panel.init('orders', { localSessionOnly: true });
  assert.equal(result, null);
  assert.equal(harness.window.location.href, 'admin-login.html?next=admin-order-new');
  assert.equal(harness.guardCalls, 0);
});

test('other admin pages retain the existing remote guard by default', async () => {
  const session = { token: 'test-token', role: 'admin' };
  const harness = loadPanel(session);
  const result = await harness.panel.init('orders');
  assert.equal(result, session);
  assert.equal(harness.guardCalls, 1);
});
