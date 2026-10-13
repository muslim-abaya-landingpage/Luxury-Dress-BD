import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
function source(name) { return fs.readFileSync(new URL(name, root), 'utf8'); }
function fixture(extra) {
  const element = { addEventListener() {} };
  const window = { location: { origin: 'https://example.invalid', pathname: '/product-manager' } };
  const ctx = vm.createContext({ window, document: { getElementById: () => element }, console, URL, Date, JSON });
  for (const file of ['product-catalog-sync.js', 'product-catalog-sections.js', 'product-config.js', 'product-utils.js', 'category-products.js', 'product-links-data.js']) vm.runInContext(source(file), ctx);
  if (extra) window.CATEGORY_PRODUCTS['unlisted-category'] = [extra];
  const original = JSON.parse(JSON.stringify(window.CATEGORY_PRODUCTS));
  vm.runInContext(source('product-manager.html').match(/<script id="pmRawCatalog">([\s\S]*?)<\/script>/)[1], ctx);
  vm.runInContext(source('product-catalog-loader.js'), ctx);
  const app = source('product-manager-admin.js').replace(
    '  loadState();\n  renderCatList();\n  renderMain();\n})();',
    '  window.testManager = { loadState, generateProductsFile, toggleStock, escapeAttr, state() { return { sections, products }; } };\n})();'
  );
  vm.runInContext(app, ctx);
  window.testManager.loadState();
  const result = vm.createContext({ window: {} });
  vm.runInContext(window.testManager.generateProductsFile(), result);
  return { manager: window.testManager, original, state: window.testManager.state(), exported: result.window.CATEGORY_PRODUCTS };
}
test('all registered categories and every catalog entry survive editor loading and export', () => {
  const f = fixture();
  assert.equal(f.state.sections.length, 9);
  assert.equal(Object.values(f.state.products).reduce((n, rows) => n + rows.length, 0), 79);
  for (const [key, rows] of Object.entries(f.original)) {
    assert.deepEqual(Array.from(f.exported[key], p => p.id), rows.map(p => p.id));
  }
});
test('an unlisted category remains visible and source variant/custom fields survive normalization and Save', () => {
  const f = fixture({ id: 'NEW-1', name: 'New Product', image: 'images/new.webp', price: 100,
    colorVariants: [{ color: 'Blue', image: 'images/blue.webp' }], customData: { preserve: true } });
  assert.ok(f.state.sections.some(s => s.key === 'unlisted-category'));
  const product = f.exported['unlisted-category'][0];
  assert.equal(product.customData.preserve, true);
  assert.equal(product.colorVariants[0].color, 'Blue');
});

test('stock toggle exports zero and numeric zero remains visible', () => {
  const f = fixture();
  const p = f.state.products.abaya[0];
  f.manager.toggleStock(p);
  assert.equal(p.stock, 0);
  assert.equal(p.inStock, false);
  assert.equal(f.manager.escapeAttr(0), '0');
  const out = vm.createContext({ window: {} });
  vm.runInContext(f.manager.generateProductsFile(), out);
  assert.equal(out.window.CATEGORY_PRODUCTS.abaya[0].stock, 0);
  assert.equal(out.window.CATEGORY_PRODUCTS.abaya[0].inStock, false);
  f.manager.toggleStock(p);
  assert.equal(p.stock, undefined);
  assert.equal(p.inStock, undefined);
});
