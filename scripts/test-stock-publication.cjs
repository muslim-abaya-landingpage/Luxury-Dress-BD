const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const html = fs.readFileSync('product-manager.html', 'utf8');
function between(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Missing source block ${start} .. ${end}`);
  return html.slice(from, to);
}

const calls = [];
let failNextCall = false;
const liveStockOverrides = Object.create(null);
const ui = {
  stockPublishing: false,
  queuedStockToggle: null,
  liveStockOverrides,
  managerOutOfStock(p) {
    const id = String(p && p.id || '');
    if (Object.prototype.hasOwnProperty.call(liveStockOverrides, id)) return liveStockOverrides[id] === false;
    return !!p && (p.inStock === false || (typeof p.stock === 'number' && p.stock <= 0));
  },
  window: { MaAdmin: { call(type, fields) {
    calls.push({ type, fields });
    if (failNextCall) { failNextCall = false; return Promise.reject(new Error('network')); }
    return Promise.resolve({ ok: true });
  } } },
  document: { getElementById: () => ({ disabled: false }) },
  mainEl: { addEventListener() {}, contains() { return true; } },
  setSaveStatus() {},
  renderCatList() {},
  renderMain() {}
};
vm.createContext(ui);
vm.runInContext(between('  function setProductAvailability(', '  function setSaveStatus('), ui);

const helpers = { window: {} };
vm.createContext(helpers);
vm.runInContext(fs.readFileSync('product-utils.js', 'utf8'), helpers);
const U = helpers.window.maCatalog;

(async () => {
  for (const category of ['abaya', 'cover-up', 'premium-two-piece', 'tops-kurti', 'embroidery', 'karchupi', 'kaftan', 'hijab', 'panjabi']) {
    const p = { id: category, name: category, inStock: true };
    assert.equal(await ui.publishStockToggle(p, () => {}), true);
    assert.equal(ui.liveStockOverrides[category], false);
    assert.equal(ui.managerOutOfStock(p), true);
    assert.equal(calls.at(-1).type, 'AdminLiveStockSet');
    assert.equal(calls.at(-1).fields.InStock, 'false');
    assert.equal(await ui.publishStockToggle(p, () => {}), true);
    assert.equal(ui.liveStockOverrides[category], true);
    assert.equal(ui.managerOutOfStock(p), false);
    assert.equal(calls.at(-1).fields.InStock, 'true');
  }

  const rows = [{ id: 'a' }, { id: 'b' }];
  const beforeBulk = calls.length;
  assert.equal(await ui.publishStockChanges(rows, false, () => {}), true);
  assert.equal(calls.length, beforeBulk + 1);
  assert.equal(calls.at(-1).fields.ProductIds, JSON.stringify(['a', 'b']));
  assert.equal(ui.liveStockOverrides.a, false);
  assert.equal(ui.liveStockOverrides.b, false);

  failNextCall = true;
  assert.equal(await ui.publishStockChanges(rows, true, () => {}), false);
  assert.equal(ui.liveStockOverrides.a, false);
  assert.equal(ui.liveStockOverrides.b, false);
  assert.equal(ui.stockPublishing, false);

  const tracked = { inStock: true, stockVariants: { M: { tracked: true, available: 0 }, L: { tracked: true, available: 3 } } };
  assert.equal(U.getStockQty(tracked, 'M'), 0);
  assert.equal(U.getStockQty(tracked, 'L'), 3);
  tracked.inStock = false;
  assert.equal(U.getStockQty(tracked, 'L'), 0);

  const syncSource = fs.readFileSync('stock-sync.js', 'utf8');
  let catalog = { test: [{ id: 'LIVE' }] };
  const sync = { getCategories: () => catalog };
  vm.createContext(sync);
  const syncStart = syncSource.indexOf('  function applyStockMap(');
  const syncEnd = syncSource.indexOf('  function notifyStockUpdated(', syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart, 'Missing live stock sync helpers');
  vm.runInContext(syncSource.slice(syncStart, syncEnd), sync);
  sync.applyStockMap({ LIVE: { qty: 0, inStock: false, legacyTracked: true } });
  assert.equal(catalog.test[0].inStock, false);
  catalog.test[0] = U.normalizeProductEntry(catalog.test[0], 'test', 0);
  sync.applyStockMap({ LIVE: { qty: 7, inStock: true, legacyTracked: true } });
  assert.equal(catalog.test[0].stock, 7);
  assert.equal(catalog.test[0].inStock, true);
  catalog = { test: [{ id: 'MANUAL', inStock: false, stock: 0 }] };
  sync.applyStockMap({ MANUAL: { qty: 7, inStock: true, legacyTracked: true } });
  assert.equal(catalog.test[0].inStock, false);
  assert.equal(U.getStockQty(catalog.test[0]), 0);

  console.log('PASS: stock toggles and bulk changes use the live-stock API, failures roll back overrides, all categories toggle, and stock refresh keeps manual overrides authoritative.');
})().catch(error => { console.error(error); process.exitCode = 1; });
