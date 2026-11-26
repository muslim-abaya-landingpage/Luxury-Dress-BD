const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8');

function extract(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const open = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (quote) { if (escaped) escaped = false; else if (c === '\\\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed function: ' + name);
}

function memorySheet(rows) {
  const data = rows.map(r => r.slice());
  return {
    getDataRange() { return { getValues: () => data.map(r => r.slice()) }; },
    getLastRow() { return data.length; },
    getRange(row, col, rowCount = 1, colCount = 1) {
      return {
        getValues() { return Array.from({length: rowCount}, (_, ri) => Array.from({length: colCount}, (_, ci) => (data[row + ri - 1] || [])[col + ci - 1] ?? '')); },
        setValues(values) { values.forEach((vals, ri) => { const target = data[row + ri - 1] || (data[row + ri - 1] = []); vals.forEach((v, ci) => { target[col + ci - 1] = v; }); }); },
        getValue() { return (data[row - 1] || [])[col - 1] ?? ''; },
        setValue(value) { const target = data[row - 1] || (data[row - 1] = []); target[col - 1] = value; }
      };
    },
    rows: data
  };
}

function runtime() {
  const variants = memorySheet([
    ['Product ID','Product Name','Category','Variant','Tracked','Available','Reserved','LowStockThreshold','UpdatedAt','UpdatedBy','OperationId'],
    ['AB-1','Abaya','Abaya','Body 44',true,10,0,'',new Date(),'admin','']
  ]);
  const journal = memorySheet([['OperationId','Status','Target','Row','PayloadJSON','CreatedAt','UpdatedAt','Error']]);
  const ledger = memorySheet([['Timestamp','Product ID','Variant','ChangeType','QtyBefore','QtyAfter','ReservedBefore','ReservedAfter','Reason','OrderId','Admin','OperationId']]);
  const ctx = {
    Object, Number, String, Math, JSON, Date,
    Utilities: { getUuid: () => 'manual-uuid' },
    ensureStockVariantsSheet_: () => variants,
    ensureStockOperationJournalSheet_: () => journal,
    ensureStockLedgerSheet_: () => ledger,
    getOrCreateStockVariantRow_: () => 2,
    queueLowStockAlert_: () => {},
    verifyAdminSession_: () => ({ ok: true }),
    param_: (e, key) => e && e[key],
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) }
  };
  vm.createContext(ctx);
  ['stockVariantCompareKey_','readStockVariantRow_','writeStockVariantRow_','stockOperationJournalRow_',
   'stockOperationSetState_','appendStockLedgerOnce_','stockOperationId_','mutateStockVariant_',
   'recoverAdminStockOperations_'].forEach(name => vm.runInContext(extract(name), ctx));
  return { ctx, variants, journal, ledger };
}

test('failed ledger append is recoverable without applying stock twice', () => {
  const r = runtime();
  const append = r.ctx.appendStockLedgerOnce_;
  r.ctx.appendStockLedgerOnce_ = () => { throw new Error('injected ledger outage'); };
  assert.throws(() => r.ctx.mutateStockVariant_({
    productId: 'AB-1', variant: 'Body 44', deltaAvailable: -2, deltaReserved: 2,
    changeType: 'RESERVE', orderId: 'MA-ORDER-1', admin: 'system', setTracked: true
  }), /injected ledger outage/);
  assert.equal(r.variants.rows[1][5], 8);
  assert.equal(r.variants.rows[1][6], 2);
  assert.ok(r.variants.rows[1][10], 'operation marker persisted with stock quantities');
  assert.equal(r.journal.rows[1][1], 'PREPARED');
  r.ctx.appendStockLedgerOnce_ = append;
  const recovered = r.ctx.recoverAdminStockOperations_({ Token: 'admin' });
  assert.equal(recovered.recovered, 1);
  assert.equal(r.variants.rows[1][5], 8);
  assert.equal(r.variants.rows[1][6], 2);
  assert.equal(r.journal.rows[1][1], 'COMMITTED');
  assert.equal(r.ledger.rows.length, 2);
  const again = r.ctx.recoverAdminStockOperations_({ Token: 'admin' });
  assert.equal(again.recovered, 0);
  assert.equal(r.ledger.rows.length, 2);
});

test('replaying a committed operation id does not mutate or duplicate its ledger row', () => {
  const r = runtime();
  const opts = { productId: 'AB-1', variant: 'Body 44', deltaAvailable: -1, deltaReserved: 1,
    changeType: 'RESERVE', orderId: 'MA-ORDER-2', admin: 'system' };
  r.ctx.mutateStockVariant_(opts);
  r.ctx.mutateStockVariant_(opts);
  assert.equal(r.variants.rows[1][5], 9);
  assert.equal(r.variants.rows[1][6], 1);
  assert.equal(r.ledger.rows.length, 2);
});

test('order reserve/release and legacy product-total paths remain present', () => {
  const reserve = extract('reserveStockForOrderItems_');
  const release = extract('releaseStockForOrderItems_');
  const sold = extract('finalizeSoldDirectStockForOrderItems_');
  assert.match(reserve, /mutateStockVariant_\(/);
  assert.match(reserve, /legacyRequirements\.forEach/);
  assert.match(release, /mutateStockVariant_\(/);
  assert.match(release, /RELEASE_PRODUCT_TOTAL/);
  assert.match(sold, /mutateStockVariant_\(/);
  assert.match(sold, /SELL_DIRECT_PRODUCT_TOTAL/);
  assert.match(extract('ensureStockSheet_'), /'Stock', \['Product ID', 'Product Name', 'Qty', 'Updated At'\]/);
});

test('stock variant row and ledger include operation id columns and recovery is admin-gated', () => {
  assert.match(extract('ensureStockVariantsSheet_'), /'OperationId'/);
  assert.match(extract('ensureStockLedgerSheet_'), /'OperationId'/);
  assert.match(extract('recoverAdminStockOperations_'), /verifyAdminSession_/);
  assert.match(source, /AdminStockJournalRecover/);
});
