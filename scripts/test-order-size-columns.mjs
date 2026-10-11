import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';

const code = fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const admin = fs.readFileSync(new URL('../apps-script/AdminOrders.gs', import.meta.url), 'utf8');
const headersFix = fs.readFileSync(new URL('../apps-script/FixSheetHeaders.gs', import.meta.url), 'utf8');
const cart = [
  { id: 'KURTI-03', name: 'Purple Kurti', qty: 1, price: 250, size: '38', color: 'purple', category: 'tops-kurti' },
  { id: 'ABY-HAFEZA-1', name: 'Black Hafeza Set', qty: 1, price: 2385, size: 'Body 42 · Length 52', productType: 'Full Set' },
  { id: 'KURTI-02', name: 'Grey Kurti', qty: 1, price: 250, size: '38' }
];
const expectedSize = '1. 38\n2. Body 42 · Length 52\n3. 38';

// Cell storage is independent of the production column resolver: expected
// physical positions are asserted as explicit H/I/J/K/... coordinates below.
class Sheet {
  constructor(name, rows, parent = 'workbook-one', id = 0) {
    this.name = name; this.rows = rows.map(row => [...row]); this.parent = parent; this.id = id;
    this.writes = []; this.validations = []; this.notes = new Map(); this.widths = new Map();
    this.images = []; this.formulas = new Map();
  }
  getName() { return this.name; }
  getSheetId() { return this.id; }
  getParent() { return { getId: () => this.parent }; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(1, ...this.rows.map(row => row.length)); }
  getMaxRows() { return 965; }
  getMaxColumns() { return 48; }
  getFrozenRows() { return this.frozenRows || 0; }
  setFrozenRows(rows) { this.frozenRows = rows; }
  hideColumns() {}
  getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }
  setColumnWidth(col, width) { this.widths.set(col, width); }
  setRowHeight() {}
  insertImage(_blob, col, row) {
    this.images.push({ col, row });
    return { setWidth() { return this; }, setHeight() { return this; } };
  }
  getRange(row, col, height = 1, width = 1) {
    assert.ok([row, col, height, width].every(n => Number.isInteger(n) && n > 0), 'valid native range');
    const sheet = this;
    const range = {
      getValues() { return Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => sheet.rows[row - 1 + r]?.[col - 1 + c] ?? '')); },
      getValue() { return this.getValues()[0][0]; },
      getDisplayValue() { return String(this.getValue()); },
      getSheet() { return sheet; }, getColumn() { return col; }, getRow() { return row; },
      getNumRows() { return height; }, getNumColumns() { return width; },
      setValues(values) {
        assert.equal(values.length, height); values.forEach(v => assert.equal(v.length, width));
        values.forEach((valuesRow, r) => valuesRow.forEach((value, c) => {
          const atRow = row - 1 + r, atCol = col - 1 + c;
          while (sheet.rows.length <= atRow) sheet.rows.push([]);
          sheet.rows[atRow][atCol] = value;
          sheet.formulas.delete(`${atRow + 1}:${atCol + 1}`);
        }));
        sheet.writes.push({ row, col, height, width, values: values.map(r => [...r]) });
        return this;
      },
      setValue(value) { return this.setValues([[value]]); },
      clearContent() { return this.setValues(Array.from({ length: height }, () => Array(width).fill(''))); },
      setFormula(value) { this.setValue(value); sheet.formulas.set(`${row}:${col}`, value); return this; },
      getNote() { return sheet.notes.get(`${row}:${col}`) || ''; },
      setNote(value) { sheet.notes.set(`${row}:${col}`, value); return this; },
      setDataValidation(rule) { sheet.validations.push({ row, col, height, width, rule }); return this; }
    };
    for (const method of ['setBackground', 'setFontColor', 'setFontWeight', 'setHorizontalAlignment', 'setVerticalAlignment', 'setWrap', 'setWrapStrategy', 'setNumberFormat', 'clearDataValidations']) {
      range[method] = function () { return this; };
    }
    return range;
  }
}

function fixture(withSize = true) {
  const header = Array(46).fill('');
  header.splice(0, 17, 'Date', 'Name', 'Phone', 'Quantity', 'Charge', 'Address', 'Product', 'মোট টাকা', 'অর্ডার আইডি', 'স্ট্যাটাস', 'ট্র্যাকিং', 'কনসাইনমেন্ট ID', 'কুরিয়ার স্ট্যাটাস', 'জেলা', 'পেমেন্ট', 'Txn / Sender', 'নোট');
  for (let i = 0; i < 12; i++) header[17 + i] = `ছবি ${i + 1}`;
  header.splice(29, 10, 'Email', 'FBC', 'FBP', 'CartJSON', 'CouponCode', 'CouponDiscount', 'StockStage', 'Source', 'Tracking Event ID', '');
  header.splice(39, 7, 'Admin Note', 'Courier Note', 'Advance', 'Discount', 'Assigned To', 'Source', 'Courier');
  const row = Array(46).fill('');
  row.splice(0, 17, '2026-10-11T12:29:31+06:00', 'Customer Name', '01712345678', 3, 0, 'Full delivery address', '1. Purple Kurti\n2. Black Hafeza Set\n3. Grey Kurti', 2885, 'MA-20261011-4777', 'Pending', '', '', '', 'ঢাকা', 'Cash On Delivery', 'sender-reference', 'original order note');
  row[17] = 'photo-one'; row[28] = 'photo-twelve';
  row.splice(29, 10, 'customer@example.invalid', 'test-fbc', 'test-fbp', JSON.stringify(cart), 'KEEP-COUPON', 0, 'NEW', 'Website', 'order-event', '');
  row.splice(39, 7, 'admin memo', 'courier memo', 100, 0, 'staff', 'Website', 'Steadfast');
  if (withSize) { header.splice(7, 0, 'পণ্যের সাইজ'); row.splice(7, 0, expectedSize); }
  const sheet = new Sheet('Online Order', [header, row]);
  if (withSize) sheet.formulas.set('2:8', '=existing-size-formula');
  const stock = new Sheet('Stock', [['ProductID', 'ProductName', 'Qty', 'UpdatedAt'], ...cart.map(item => [item.id, item.name, 10, ''])], 'workbook-one', 2);
  const blocked = new Sheet('Blocked', [['Phone', 'Reason']], 'workbook-one', 3);
  const sheets = new Map([['Online Order', sheet], ['Stock', stock], ['Blocked', blocked]]);
  const sent = [], events = [], decremented = [], locks = [];
  const props = new Map([['AUTO_COURIER_MODE', 'confirmed'], ['AUTO_COURIER_ON', 'true']]);
  const context = vm.createContext({ console, Date, JSON, SpreadsheetApp: {
    WrapStrategy: { CLIP: 'CLIP' },
    getActiveSpreadsheet: () => ({ getId: () => 'workbook-one', getSheetByName: name => sheets.get(name), insertSheet: name => { const s = new Sheet(name, [[]]); sheets.set(name, s); return s; } }),
    getUi: () => ({ alert() {} }),
    newDataValidation: () => ({ requireValueInList() { return this; }, setAllowInvalid() { return this; }, build() { return {}; } })
  }, PropertiesService: { getScriptProperties: () => ({ getProperty: key => props.get(key) ?? null, setProperty: (key, value) => props.set(key, value) }) },
    LockService: { getScriptLock: () => ({ waitLock() { locks.push('acquire'); }, releaseLock() { locks.push('release'); } }) },
    Utilities: { formatDate: (_date, _zone, pattern) => pattern === 'yyyy-MM-dd' ? '2026-10-11' : '11-10-2026 12:29:31', sleep() {} },
    ContentService: { MimeType: { TEXT: 'text' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) }
  });
  vm.runInContext(code + '\n' + admin + '\n' + headersFix, context);
  Object.assign(context, {
    verifyAdminSession_: () => ({ ok: true, sheetUrl: 'verified-test-url' }),
    param_: (e, key) => (e?.parameter || e || {})[key] || '',
    isPhoneBlocked_: () => false, rateLimit_: () => {}, rateLimitOrder_: () => {}, checkDuplicateOrder_: () => {}, validateCartPricing_: () => {},
    getDistrictChargeMap_: () => ({ 'ঢাকা': 0 }), generateOrderId_: () => 'MA-NEW-0001',
    decrementStockForOrder_: items => decremented.push(items), getSteadfastKeys_: () => ({ apiKey: 'mock', secretKey: 'mock' }),
    steadfastPlaceOrder_: payload => { sent.push(payload); return { consignment: { tracking_code: 'SFR-MOCK', consignment_id: 'CID-MOCK', status: 'in_review' } }; },
    sendToFacebookCAPI: (payload, id) => { events.push({ type: 'facebook', payload, id }); return { ok: true }; },
    sendToTikTokCAPI: (payload, id) => { events.push({ type: 'tiktok', payload, id }); return { ok: true }; },
    fetchOrderImageBlob_: () => ({ mockBlob: true })
  });
  return { ctx: context, sheet, stock, sent, events, decremented, locks, sheets };
}

for (const withSize of [true, false]) {
  const layout = withSize ? 'H size' : 'legacy H total';
  const offset = withSize ? 1 : 0;
  test(`${layout}: full web order preserves sizes, prices, IDs, metadata and coupons`, () => {
    const f = fixture(withSize);
    const response = f.ctx.handleOnlineOrderPost_({ parameter: { Name: 'New Customer', Phone: '01812345678', Address: 'New complete delivery address', Quantity: '3', Total: '2885', SiteTs: String(Date.now() - 5000), District: 'ঢাকা', CartJSON: JSON.stringify(cart), Product_1: 'Purple Kurti (Size 38)', Product_2: 'Black Hafeza Set (Body 42 · Length 52)', Product_3: 'Grey Kurti (Size 38)', Email: 'new@example.invalid', FBC: 'new-fbc', FBP: 'new-fbp', SpecialNotes: 'customer note' } });
    assert.equal(response.text, 'Success|MA-NEW-0001');
    const row = f.sheet.rows[2];
    if (withSize) assert.equal(row[7], expectedSize);
    assert.equal(row[7 + offset], '2885'); assert.equal(row[8 + offset], 'MA-NEW-0001'); assert.equal(row[9 + offset], 'Pending');
    assert.match(row[16 + offset], /customer note/); assert.match(row[16 + offset], /META_PURCHASE_WAIT/);
    assert.deepEqual(row.slice(29 + offset, 32 + offset), ['new@example.invalid', 'new-fbc', 'new-fbp']);
    assert.equal(JSON.parse(row[32 + offset])[1].size, 'Body 42 · Length 52');
    assert.equal(JSON.parse(row[32 + offset])[1].productType, 'Full Set');
    assert.equal(f.sent.length, 0); assert.equal(f.events.length, 0); assert.equal(f.decremented.length, 0); assert.equal(row[35 + offset], "NEW");
    assert.deepEqual(f.locks, ['acquire', 'release']);
  });
  test(`${layout}: admin read/update uses correct total, ID and advances and preserves the size formula/images`, () => {
    const f = fixture(withSize), imageBefore = f.sheet.rows[1].slice(17 + offset, 29 + offset);
    const read = f.ctx.adminOrderGet_({ OrderId: 'MA-20261011-4777' });
    assert.equal(read.ok, true); assert.equal(read.order.total, 2885); assert.equal(read.order.due, 2785);
    if (withSize) assert.equal(read.order.size, expectedSize);
    const result = f.ctx.adminOrderUpdate_({ parameter: { OrderId: 'MA-20261011-4777', Charge: '150', Advance: '200', AdminNote: 'changed memo', Status: 'Pending' } });
    assert.equal(result.ok, true); assert.equal(result.order.total, 3035); assert.equal(result.order.due, 2835);
    assert.equal(f.sheet.rows[1][7 + offset], '3035'); assert.equal(f.sheet.rows[1][39 + offset], 'changed memo');
    assert.equal(f.sheet.rows[1][41 + offset], 200);
    assert.deepEqual(f.sheet.rows[1].slice(17 + offset, 29 + offset), imageBefore);
    if (withSize) { assert.equal(f.sheet.rows[1][7], expectedSize); assert.equal(f.sheet.formulas.get('2:8'), '=existing-size-formula'); }
  });
  test(`${layout}: courier sends the real invoice/COD and writes only the correct tracking/status fields`, () => {
    const f = fixture(withSize), before = [...f.sheet.rows[1]];
    const result = f.ctx.adminSendCourier_({ OrderId: 'MA-20261011-4777' });
    assert.equal(result.ok, true); assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].invoice, 'MA-20261011-4777'); assert.equal(f.sent[0].cod_amount, 2785);
    if (withSize) assert.match(f.sent[0].item_description, /Black Hafeza Set · Body 42 · Length 52/);
    assert.deepEqual(f.sheet.rows[1].slice(9 + offset, 13 + offset), ['Shipped', 'SFR-MOCK', 'CID-MOCK', 'in_review']);
    before.forEach((v, i) => { if (i < 9 + offset || i > 12 + offset) assert.equal(f.sheet.rows[1][i], v); });
    assert.equal(f.ctx.adminSendCourier_({ OrderId: 'MA-20261011-4777' }).error, 'ALREADY_SENT'); assert.equal(f.sent.length, 1);
    f.ctx.updateOrderFromSteadfastWebhook_({ invoice: 'MA-20261011-4777', status: 'delivered' });
    assert.equal(f.sheet.rows[1][9 + offset], 'Delivered'); assert.equal(f.sheet.rows[1][12 + offset], 'delivered');
  });
  test(`${layout}: confirmation event uses correct email/pixel IDs/price and sends purchase only once`, () => {
    const f = fixture(withSize);
    f.sheet.rows[1][9 + offset] = 'Confirmed';
    f.ctx.autoCourierOnEditTrigger({ range: f.sheet.getRange(2, 10 + offset) });
    assert.equal(f.events.length, 2); assert.equal(f.sent.length, 1);
    const event = f.events.find(e => e.type === 'facebook');
    assert.equal(event.payload.Total, '2885'); assert.equal(event.payload.Email, 'customer@example.invalid');
    assert.equal(event.payload.FBC, 'test-fbc'); assert.equal(event.payload.FBP, 'test-fbp');
    assert.equal(event.id, 'order-event');
    f.ctx.autoCourierOnEditTrigger({ range: f.sheet.getRange(2, 10 + offset) });
    assert.equal(f.sent.length, 1); assert.equal(f.events.length, 2);
  });
  test(`${layout}: cancelled order restores AH/AG stock once and never overwrites its coupon`, () => {
    const f = fixture(withSize);
    f.sheet.rows[1][35 + offset] = 'RESERVED';
    const released = [];
    f.ctx.releaseStockForOrderItems_ = (items, id) => { released.push(id); items.forEach(item => { f.stock.rows.find(row => row[0] === item.id)[2] += item.qty; }); };
    f.ctx.onEdit({ range: f.sheet.getRange(2, 10 + offset), value: 'Cancelled' });
    assert.deepEqual(f.stock.rows.slice(1).map(r => r[2]), [11, 11, 11]);
    assert.equal(f.sheet.rows[1][33 + offset], 'KEEP-COUPON');
    assert.equal(f.sheet.rows[1][35 + offset], 'RELEASED'); assert.deepEqual(released, ['MA-20261011-4777']);
    f.ctx.onEdit({ range: f.sheet.getRange(2, 10 + offset), value: 'Cancelled' });
    assert.deepEqual(f.stock.rows.slice(1).map(r => r[2]), [11, 11, 11]);
  });
  test(`${layout}: header repair and image anchors preserve notes and the order-ID column`, () => {
    const f = fixture(withSize);
    f.sheet.rows[0][16 + offset] = 'ছবি ১';
    f.ctx.ensureOnlineOrderHeaders_(f.sheet); f.ctx.ensureOnlineOrderImageHeaders_(f.sheet);
    f.ctx.setupOrderStatusDropdown_(f.sheet); f.ctx.setupOnlineOrderHeadersNow();
    assert.equal(f.sheet.rows[0][7 + offset], 'মোট টাকা'); assert.equal(f.sheet.rows[0][8 + offset], 'অর্ডার আইডি');
    assert.equal(f.sheet.rows[0][16 + offset], 'নোট'); assert.equal(f.sheet.rows[0][17 + offset], 'ছবি ১');
    assert.equal(f.sheet.validations.at(-1).col, 10 + offset);
    f.ctx.setOrderProductImages_(f.sheet, 2, ['https://example.invalid/image.webp']);
    assert.equal(f.sheet.images[0].col, 18 + offset); assert.equal(f.sheet.rows[1][16 + offset], 'original order note');
  });
  test(`${layout}: customer tracking, admin lists and analytics agree on the same saved order`, () => {
    const f = fixture(withSize);
    const tracking = f.ctx.getOrderTrackStatus_({ Phone: '01712345678', OrderId: 'MA-20261011-4777' });
    assert.equal(tracking.ok, true); assert.equal(tracking.orders.length, 1); assert.equal(tracking.orders[0].total, 2885);
    const list = f.ctx.listAdminOrders_({});
    assert.equal(list.orders[0].orderId, tracking.orders[0].orderId); assert.equal(list.orders[0].total, '2885');
    if (withSize) assert.equal(tracking.orders[0].size, expectedSize);
    const analytics = f.ctx.getAdminAnalytics_({ Days: 30 });
    assert.equal(analytics.totalOrders, 1); assert.equal(analytics.totalRevenue, 2885);
    assert.equal(analytics.topProducts.length, 3); assert.equal(analytics.topProducts.find(p => p.id === 'ABY-HAFEZA-1').revenue, 2385);
  });
  test(`${layout}: WhatsApp/manual order preserves its typed size and returns the exact appended row`, () => {
    const f = fixture(withSize);
    const response = f.ctx.submitWhatsappMiniOrder({ name: 'Manual Customer', phone: '01812345678', district: 'ঢাকা', address: 'Full delivery address', design: '1. Hafeza Set · Body 42 · Length 52', qty: 1, total: 2400 });
    assert.equal(response.ok, true); assert.equal(response.row, 3);
    if (withSize) assert.equal(f.sheet.rows[2][7], '1. Body 42 · Length 52');
    assert.equal(f.sheet.rows[2][7 + offset], '2400'); assert.equal(f.sheet.rows[2][8 + offset], 'MA-NEW-0001');
    assert.equal(f.sheet.rows[2][9 + offset], 'Pending'); assert.equal(f.sheet.rows[2][16 + offset], 'WhatsApp manual');
  });
}

test('an order-ID edit in J never triggers confirmation/cancellation hooks on a sheet with H sizes', () => {
  const f = fixture();
  f.sheet.rows[1][9] = 'Confirmed';
  f.ctx.autoCourierOnEditTrigger({ range: f.sheet.getRange(2, 10) });
  f.ctx.onEdit({ range: f.sheet.getRange(2, 10), value: 'Cancelled' });
  assert.equal(f.events.length, 0); assert.equal(f.sent.length, 0);
  assert.deepEqual(f.stock.rows.slice(1).map(r => r[2]), [10, 10, 10]);
});
test('same sheet ID in another workbook and unrelated tabs retain their own layouts', () => {
  const f = fixture(); assert.equal(f.ctx.onlineOrderColumn_(f.sheet, 8), 9);
  const legacy = fixture(false).sheet; legacy.parent = 'other-workbook';
  assert.equal(f.ctx.onlineOrderColumn_(legacy, 8), 8);
  const stock = new Sheet('Stock', [['', '', '', '', '', '', '', 'Size']]);
  assert.equal(f.ctx.onlineOrderColumn_(stock, 9), 9);
});
test('size sync recovers saved historical sizes and leaves unknown manual orders blank', () => {
  const f = fixture();
  const old = Array(47).fill(''); old[0] = 'date'; old[6] = '1. Floral · Body 42 (Free size) · Length 37-38 inch × 1 pcs';
  const unknown = Array(47).fill(''); unknown[0] = 'date'; unknown[6] = '1. Size unavailable';
  f.sheet.rows.push(old, unknown);
  const response = f.ctx.syncOnlineOrderSizesNow();
  assert.equal(response.ok, true); assert.equal(response.orders, 3); assert.equal(f.sheet.rows[1][7], expectedSize);
  assert.equal(f.sheet.rows[2][7], '1. Body 42 (Free size) · Length 37-38 inch'); assert.equal(f.sheet.rows[3][7], '');
});
test('invalid admin session cannot read/edit or create a courier parcel', () => {
  const f = fixture(); f.ctx.verifyAdminSession_ = () => ({ ok: false, error: 'INVALID_TOKEN' });
  for (const name of ['adminOrderGet_', 'adminOrderUpdate_', 'adminSendCourier_']) {
    assert.equal(f.ctx[name]({ OrderId: 'MA-20261011-4777' }).error, 'INVALID_TOKEN');
  }
  assert.equal(f.sheet.writes.length, 0); assert.equal(f.sent.length, 0);
});
test('deployment diagnostics expose only the installed schema, without any customer fields', () => {
  const f = fixture();
  const schema = JSON.parse(JSON.stringify(f.ctx.getOnlineOrderSchemaStatus_()));
  assert.deepEqual(schema, { ok: true, version: 'order-size-h-20261012', columns: { size: 8, total: 9, orderId: 10, status: 11, tracking: 12, notes: 18, images: 19, cartJSON: 34 } });
  assert.equal(f.sheet.writes.length, 0);
});
