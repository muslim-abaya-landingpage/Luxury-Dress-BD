import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../cart-drawer.js', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('window.updateDrawerQty ='), source.indexOf('window.updateCartDrawerUI ='));
function fixture(initial, withBadgeCallback = true) {
  let cart = structuredClone(initial);
  const renders = [];
  const badges = [];
  let writes = 0;
  const window = {
    loadStoreCart: () => structuredClone(cart),
    persistStoreCart: lines => { writes++; cart = structuredClone(lines); return cart; },
    updateCartDrawerUI: lines => renders.push(structuredClone(lines))
  };
  // Match the real load order: the header's later badge callback does not
  // render the drawer, so afterCartMutation alone is insufficient.
  if (withBadgeCallback) window.afterCartMutation = lines => badges.push(structuredClone(lines));
  vm.runInNewContext(handlers, { window });
  return { window, renders, badges, cart: () => cart, writes: () => writes };
}

test('removing the final cart line immediately renders the empty drawer', () => {
  const state = fixture([{ id: 'DR-01', quantity: 1, price: 650 }]);
  state.window.removeDrawerItem(0);
  assert.deepEqual(state.cart(), []);
  assert.deepEqual(state.renders, [[]]);
  assert.deepEqual(state.badges, [[]]);
});

test('quantity changes render the current lines and remove a line at zero', () => {
  const state = fixture([{ id: 'DR-01', quantity: 1, price: 650 }]);
  state.window.updateDrawerQty(0, 1);
  assert.equal(state.renders.at(-1)[0].quantity, 2);
  state.window.updateDrawerQty(0, -1);
  assert.equal(state.renders.at(-1)[0].quantity, 1);
  state.window.updateDrawerQty(0, -1);
  assert.deepEqual(state.renders.at(-1), []);
});

test('pages without a badge callback still render; missing indices leave the cart alone', () => {
  const state = fixture([{ id: 'DR-01', quantity: 1, price: 650 }], false);
  state.window.removeDrawerItem(4);
  state.window.updateDrawerQty(4, 1);
  assert.equal(state.writes(), 0);
  assert.equal(state.renders.length, 0);
  state.window.removeDrawerItem(0);
  assert.deepEqual(state.renders, [[]]);
});
