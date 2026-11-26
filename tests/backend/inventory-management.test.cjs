const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../../apps-script/InventoryManagement.gs'), 'utf8');

function makeSheet(rows) {
  return {
    rows: rows || [],
    getLastRow() { return this.rows.length; },
    appendRow(row) { this.rows.push(row.slice()); },
    getDataRange() { return { getValues: () => this.rows.map(r => r.slice()) }; },
    getRange(row, col, count, width) {
      const self = this;
      return {
        setValues(values) {
          values.forEach((line, i) => {
            const at = row - 1 + i;
            while (self.rows.length <= at) self.rows.push([]);
            for (let j = 0; j < line.length; j++) self.rows[at][col - 1 + j] = line[j];
          });
        },
        getValues() {
          return Array.from({ length: count || 1 }, (_, i) =>
            (self.rows[row - 1 + i] || []).slice(col - 1, col - 1 + (width || 1)));
        }
      };
    }
  };
}
function harness() {
  const suppliers = makeSheet([['Supplier ID','Name','Phone','Address','Notes','Status','Created At','Updated At','Updated By']]);
  const purchases = makeSheet([['Purchase ID','Supplier ID','Supplier Name','Invoice No','Purchase Date','Subtotal','Other Cost','Total','Paid','Due','Status','Notes','Created At','Created By','Received At','Received By']]);
  const items = makeSheet([['Purchase ID','Product ID','Product Name','Category','Variant','Qty','Unit Cost','Line Total']]);
  const payments = makeSheet([['Payment ID','Supplier ID','Purchase ID','Amount','Method','Reference','Payment Date','Notes','Created At','Created By']]);
  const calls = [];
  suppliers.appendRow(['SUP1','Test Supplier','01700000000','','','active',new Date(),new Date(),'owner']);
  const sheetMap = {
    'Inventory Suppliers': suppliers,
    'Inventory Purchases': purchases,
    'Inventory Purchase Items': items,
    'Inventory Supplier Payments': payments
  };
  const ctx = {
    Object, Number, String, Math, JSON, Date, isFinite, parseInt, RegExp,
    ensureSheet_: (name, headers) => sheetMap[name] || (sheetMap[name] = makeSheet([headers])),
    param_: (e, k) => e[k] == null ? '' : e[k],
    verifyAdminSession_: () => ({ ok: true, email: 'owner@example.com' }),
    invSupplierMap_: () => ({ SUP1: { id:'SUP1', name:'Test Supplier', status:'active' } }),
    invSuppliersSheet_: () => suppliers,
    invPurchasesSheet_: () => purchases,
    invPurchaseItemsSheet_: () => items,
    invPaymentsSheet_: () => payments,
    invSupplierBalances_: () => ({ SUP1: { id:'SUP1', name:'Test Supplier', due:500 } }),
    invRows_: (sheet) => sheet.rows.slice(1).map(r => r.slice()),
    invText_: (v, max) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max || 200),
    invMoney_: (v, field) => { const n=Number(v); if(!isFinite(n)||n<0||n>100000000) throw new Error('INVALID_'+field); return Math.round(n*100)/100; },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { getUuid: () => '12345678-1234-1234-1234-123456789012' },
    formatCell_: v => String(v || ''),
    mutateStockVariant_: opts => calls.push(opts),
    STOCK_LOW_DEFAULT_THRESHOLD_: 5,
    ensureStockVariantsSheet_: () => makeSheet([['Product ID','Product Name','Category','Variant','Tracked','Available','Reserved','Threshold','Updated At','Updated By']])
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { ctx, suppliers, purchases, items, payments, calls };
}

test('purchase creation saves a draft and does not change live stock before receiving', () => {
  const h = harness();
  const result = h.ctx.invCreatePurchase_({
    SupplierId:'SUP1', InvoiceNo:'INV-01', PurchaseDate:'2026-11-26',
    OtherCost:'100', Paid:'500',
    ItemsJSON: JSON.stringify([{productId:'ABY-01',productName:'Navy Abaya',category:'abaya',variant:'Navy · 52',qty:4,unitCost:600}])
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'DRAFT');
  assert.equal(result.total, 2500);
  assert.equal(result.due, 2000);
  assert.equal(h.purchases.rows[1][10], 'DRAFT');
  assert.equal(h.items.rows.length, 2);
  assert.equal(h.payments.rows.length, 2);
  assert.equal(h.calls.length, 0);
});

test('purchase rejects payment greater than bill and invalid item quantities', () => {
  const h = harness();
  const base = { SupplierId:'SUP1', ItemsJSON: JSON.stringify([{productId:'ABY-01',productName:'Abaya',qty:2,unitCost:100}]) };
  assert.equal(h.ctx.invCreatePurchase_(Object.assign({},base,{Paid:'300'})).error, 'OVERPAYMENT');
  assert.equal(h.ctx.invCreatePurchase_(Object.assign({},base,{ItemsJSON:JSON.stringify([{productId:'ABY-01',productName:'Abaya',qty:0,unitCost:100}])})).error, 'INVALID_ITEM');
  assert.equal(h.purchases.rows.length, 1);
});

test('receiving a purchase adds each variant to the existing stock service once', () => {
  const h = harness();
  h.purchases.appendRow(['PUR-1','SUP1','Test Supplier','INV-1','2026-11-26',1200,0,1200,0,1200,'DRAFT','',new Date(),'owner','','']);
  h.items.appendRow(['PUR-1','ABY-01','Navy Abaya','abaya','Navy · 52',2,600,1200]);
  const first = h.ctx.invReceivePurchase_({PurchaseId:'PUR-1'});
  assert.equal(first.ok, true);
  assert.equal(first.status, 'RECEIVED');
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].deltaAvailable, 2);
  assert.equal(h.calls[0].changeType, 'PURCHASE');
  const second = h.ctx.invReceivePurchase_({PurchaseId:'PUR-1'});
  assert.equal(second.ok, true);
  assert.equal(second.alreadyReceived, true);
  assert.equal(h.calls.length, 1);
});


test('inventory dashboard is wired to authenticated APIs and exposes the core Bengali workflows', () => {
  const root = require('node:path').join(__dirname, '../..');
  const html = fs.readFileSync(require('node:path').join(root, 'admin-inventory.html'), 'utf8');
  const ui = fs.readFileSync(require('node:path').join(root, 'admin-inventory.js'), 'utf8');
  const api = fs.readFileSync(require('node:path').join(root, 'admin-api.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(ui));
  ['invSupplierForm','invPurchaseForm','invPaymentForm','invPurchaseBody','invSupplierBody'].forEach(id => assert.ok(html.includes('id="' + id + '"'), 'Missing dashboard control: ' + id));
  ['getInventorySummary','listInventorySuppliers','saveInventorySupplier','listInventoryPurchases','createInventoryPurchase','receiveInventoryPurchase','createInventorySupplierPayment','listInventoryPayments'].forEach(name => assert.ok(api.includes(name), 'Missing Admin API method: ' + name));
  assert.match(ui, /MaAdminShell\.start/);
  assert.match(ui, /MaAdmin\.receiveInventoryPurchase/);
});
