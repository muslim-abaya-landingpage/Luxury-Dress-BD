import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../stock-sync.js', import.meta.url), 'utf8');
const productUtilsSource = await readFile(new URL('../product-utils.js', import.meta.url), 'utf8');

function makeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key)
  };
}

function fixture({ products, cache, polling = false } = {}) {
  const requests = [];
  const events = [];
  const intervals = [];
  const documentListeners = {};
  const windowListeners = {};
  let homeRefreshes = 0;
  class FakeXHR {
    open(method, url, async) { this.method = method; this.url = url; this.async = async; }
    send() { this.sent = true; requests.push(this); }
  }
  class FakeCustomEvent {
    constructor(type, options) { this.type = type; this.detail = options?.detail; }
  }
  const window = {
    MA_SITE_API: { url: 'https://apps.example.test/exec' },
    CATEGORY_PRODUCTS: products || { abaya: [{ id: 'SKU-1', stock: 4 }] },
    localStorage: makeStorage(cache ? { ma_public_stock_status_v1: JSON.stringify(cache) } : {}),
    CustomEvent: FakeCustomEvent,
    dispatchEvent: event => events.push(event),
    __homeRefreshCatalog: () => { homeRefreshes += 1; }
  };
  if (polling) {
    window.setInterval = (callback, delay) => {
      intervals.push({ callback, delay });
      return intervals.length;
    };
    window.addEventListener = (type, callback) => { windowListeners[type] = callback; };
    window.document = {
      visibilityState: 'visible',
      addEventListener: (type, callback) => { documentListeners[type] = callback; }
    };
  }
  const context = vm.createContext({ window, XMLHttpRequest: FakeXHR, JSON, Date, Promise, Object, String });
  vm.runInContext(source, context);
  return { window, requests, events, intervals, documentListeners, windowListeners, get homeRefreshes() { return homeRefreshes; } };
}

function outOfStockResponse() {
  return {
    ok: true,
    items: {
      'SKU-1': {
        qty: 0,
        inStock: false,
        variants: { 'Size 52': { tracked: true, available: 0, reserved: 0 } }
      }
    }
  };
}

test('stock request is asynchronous and does not mutate catalog before response without a cache', () => {
  const f = fixture();
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].async, true);
  assert.equal(f.requests[0].sent, true);
  assert.equal(f.window.CATEGORY_PRODUCTS.abaya[0].inStock, undefined);
  assert.match(f.requests[0].url, /RecordType=StockStatus/);
});

test('polling refreshes visible tabs every 60 seconds and skips hidden tabs', async () => {
  const f = fixture({ polling: true });
  f.requests[0].status = 200;
  f.requests[0].responseText = JSON.stringify({ ok: true, items: {} });
  f.requests[0].onload();
  await f.window.MA_STOCK_SYNC.ready;

  assert.equal(f.intervals.length, 1);
  assert.equal(f.intervals[0].delay, 60000);

  f.window.document.visibilityState = 'hidden';
  f.intervals[0].callback();
  assert.equal(f.requests.length, 1);

  f.window.document.visibilityState = 'visible';
  f.documentListeners.visibilitychange();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests.length, 2);
  f.requests[1].onerror();
});

test('live zero stock updates product data and notifies rendered page hooks', async () => {
  const f = fixture();
  const xhr = f.requests[0];
  xhr.status = 200;
  xhr.responseText = JSON.stringify(outOfStockResponse());
  xhr.onload();
  await f.window.MA_STOCK_SYNC.ready;

  const product = f.window.CATEGORY_PRODUCTS.abaya[0];
  assert.equal(product.stock, 0);
  assert.equal(product.inStock, false);
  assert.equal(product.stockVariants['Size 52'].tracked, true);
  assert.equal(f.events.length, 1);
  assert.equal(f.events[0].type, 'ma:stock-updated');
  assert.deepEqual(Array.from(f.events[0].detail.productIds), ['SKU-1']);
  assert.equal(f.homeRefreshes, 1);
  assert.ok(f.window.localStorage.getItem('ma_public_stock_status_v1'));
});

test('a fresh cached snapshot is applied immediately while a live async refresh still starts', () => {
  const cached = {
    savedAt: Date.now(),
    items: { 'SKU-1': { qty: 0, inStock: false, variants: { 'S': { tracked: true, available: 0 } } } }
  };
  const f = fixture({ cache: cached });
  assert.equal(f.window.CATEGORY_PRODUCTS.abaya[0].inStock, false);
  assert.equal(f.requests[0].async, true);
  assert.equal(f.events.length, 0);
});

test('API failure leaves catalog fallback intact and does not claim a stock status', async () => {
  const f = fixture();
  f.requests[0].onerror();
  const result = await f.window.MA_STOCK_SYNC.ready;
  assert.equal(result.ok, false);
  assert.equal(f.window.CATEGORY_PRODUCTS.abaya[0].inStock, undefined);
  assert.equal(f.window.CATEGORY_PRODUCTS.abaya[0].stock, 4);
  assert.equal(f.events.length, 0);
});

test('Product Manager explicit out-of-stock override wins over variant inventory', () => {
  const f = fixture({ products: { abaya: [{ id: 'SKU-1', stock: 0, inStock: false }] } });
  const xhr = f.requests[0];
  xhr.status = 200;
  xhr.responseText = JSON.stringify({ ok: true, items: {
    'SKU-1': { qty: 6, inStock: true, variants: { 'S': { tracked: true, available: 6 } } }
  } });
  xhr.onload();
  assert.equal(f.window.CATEGORY_PRODUCTS.abaya[0].inStock, false);
  assert.equal(f.window.CATEGORY_PRODUCTS.abaya[0].stock, 0);
});

test('catalog normalization retains stock variants received before the async response', () => {
  const window = { CATEGORY_PRODUCTS: {}, CATALOG_SECTIONS: [] };
  const context = vm.createContext({ window, JSON, Date, Object, Array, String, parseInt });
  vm.runInContext(productUtilsSource, context);
  const variants = { 'Size 52': { tracked: true, available: 0, reserved: 0 } };
  const normalized = window.maCatalog.normalizeProductEntry({
    id: 'SKU-1',
    name: 'Example Abaya',
    stock: 0,
    inStock: false,
    stockVariants: variants
  }, 'abaya', 0);
  assert.equal(normalized.stockVariants['Size 52'].available, 0);
  assert.equal(normalized.stockVariants['Size 52'].tracked, true);
});
