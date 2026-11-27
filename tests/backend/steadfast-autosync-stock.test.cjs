// The 15-minute Steadfast auto status-sync (steadfastStatusSyncTriggerHandler →
// syncSteadfastStatusForRow_ → applySteadfastStatusToRow_) used to write the sheet's
// Status/tracking columns directly, bypassing the stock-ledger lifecycle that
// adminOrderUpdate_ runs for the exact same kind of status change. That let the
// StockStage ledger (RESERVED/SOLD/RELEASED) silently drift from what the sheet
// showed whenever a Delivered/Cancelled outcome was learned automatically from the
// courier instead of through the admin panel. These tests cover the fix.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8');

function fixture(row9Status) {
  // Row layout mirrors the Online Order sheet's first 17 logical columns
  // (0-indexed): 8=orderId, 9=Status, 10=tracking, 11=consignmentId, 12=courierStatus.
  var rows = [Array(17).fill(''), Array(17).fill('')];
  Object.assign(rows[1], { 1: 'Test Buyer', 2: '01700000000', 8: 'ORDER-1', 9: row9Status || 'Shipped', 10: 'TRACK-1', 11: 'CID-1', 12: 'pending' });
  var lifecycleCalls = [];
  var ledgerEntries = [];
  var lockCalls = { tryLock: 0, released: 0 };
  var ctx = { console, String, Number, Object, Array, Boolean, JSON, isFinite };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  Object.assign(ctx, {
    LockService: { getScriptLock: function () { return { tryLock: function () { lockCalls.tryLock++; return true; }, releaseLock: function () { lockCalls.released++; } }; } },
    readOnlineOrderRows_: function () { return [rows[1].slice()]; },
    onlineOrderColumn_: function (_, c) { return c; },
    createReorderOffer_: function () {},
    appendStockLedger_: function (entry) { ledgerEntries.push(entry); },
    applyStockLifecycleForStatusChangeLocked_: function (sheet, row, newStatus) {
      lifecycleCalls.push(newStatus);
      if (ctx.__throwOnStatus && ctx.__throwOnStatus === newStatus) throw new Error('STOCK_LEDGER_MISMATCH: test');
    }
  });
  var sheet = {
    getRange: function (r, c, n, w) {
      n = n || 1; w = w || 1;
      return {
        setValues: function (vals) {
          for (var i = 0; i < n; i++) for (var j = 0; j < w; j++) rows[r + i - 1][c + j - 1] = vals[i][j];
        },
        getValues: function () {
          var out = [];
          for (var i = 0; i < n; i++) { var line = []; for (var j = 0; j < w; j++) line.push(rows[r + i - 1][c + j - 1]); out.push(line); }
          return out;
        }
      };
    }
  };
  return { ctx: ctx, sheet: sheet, rows: rows, lifecycleCalls: lifecycleCalls, ledgerEntries: ledgerEntries, lockCalls: lockCalls };
}

test('auto-sync delivered: writes Status=Delivered AND finalizes the stock stage (not just the sheet cell)', () => {
  var f = fixture('Shipped');
  var ok = f.ctx.applySteadfastStatusToRow_(f.sheet, 2, { delivery_status: 'delivered' });
  assert.equal(ok, true);
  assert.equal(f.rows[1][9], 'Delivered');
  assert.deepEqual(f.lifecycleCalls, ['Delivered'], 'stock lifecycle must run for the new status');
});

test('auto-sync return/cancel: writes Status=Cancelled AND releases the stock stage', () => {
  var f = fixture('Shipped');
  var ok = f.ctx.applySteadfastStatusToRow_(f.sheet, 2, { delivery_status: 'cancelled' });
  assert.equal(ok, true);
  assert.equal(f.rows[1][9], 'Cancelled');
  assert.deepEqual(f.lifecycleCalls, ['Cancelled']);
});

test('no-op transition: does not re-run the stock lifecycle when the status is unchanged', () => {
  var f = fixture('Delivered');
  f.ctx.applySteadfastStatusToRow_(f.sheet, 2, { delivery_status: 'delivered' });
  assert.deepEqual(f.lifecycleCalls, [], 'already Delivered → Delivered is a no-op, must not re-finalize stock');
});

test('a stock-lifecycle failure is logged to the ledger for manual review but never blocks the courier-status write', () => {
  var f = fixture('Shipped');
  f.ctx.__throwOnStatus = 'Delivered';
  var ok = f.ctx.applySteadfastStatusToRow_(f.sheet, 2, { delivery_status: 'delivered' });
  assert.equal(ok, true, 'the sheet write itself must still succeed');
  assert.equal(f.rows[1][9], 'Delivered');
  assert.equal(f.ledgerEntries.length, 1);
  assert.equal(f.ledgerEntries[0].changeType, 'AUTO_SYNC_STOCK_FAILED');
  assert.equal(f.ledgerEntries[0].orderId, 'ORDER-1');
});

test('acquires and always releases a script lock around the write', () => {
  var f = fixture('Shipped');
  f.ctx.applySteadfastStatusToRow_(f.sheet, 2, { delivery_status: 'delivered' });
  assert.equal(f.lockCalls.tryLock, 1);
  assert.equal(f.lockCalls.released, 1);
});

test('busy lock: skips the write entirely rather than racing a concurrent admin change', () => {
  var f = fixture('Shipped');
  f.ctx.LockService.getScriptLock = function () { return { tryLock: function () { return false; }, releaseLock: function () {} }; };
  var ok = f.ctx.applySteadfastStatusToRow_(f.sheet, 2, { delivery_status: 'delivered' });
  assert.equal(ok, false);
  assert.equal(f.rows[1][9], 'Shipped', 'row must be untouched when the lock could not be acquired');
  assert.deepEqual(f.lifecycleCalls, []);
});
