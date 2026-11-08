// Messenger inbox: "seen"/"delivered" receipts are stored per conversation (never as blank messages), and a
// refused profile lookup keeps Facebook's reason.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8');
const start = source.indexOf('function messengerWebhook_(');
const end = source.indexOf('\n}\n', source.indexOf('function inboxProfile_(')) + 3;
const pick = (name) => { const m = source.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}', 'm')); assert.ok(m, name); return m[0]; };
const code = source.slice(start, source.indexOf('\n}\n', start) + 3) + '\n' +
  source.slice(source.indexOf('var MSGR_PAGE_ID ='), end) + '\n' + pick('formatCell_');

function fakeSheet(rows) {
  return {
    rows,
    getDataRange() { return { getValues: () => rows.map((r) => r.slice()) }; },
    getLastRow() { return rows.length; },
    getLastColumn() { return Math.max(...rows.map((r) => r.length)); },
    getRange(r, c, nr = 1, nc = 1) {
      return {
        getValues: () => rows.slice(r - 1, r - 1 + nr).map((row) => { const out = []; for (let i = 0; i < nc; i++) out.push(row[c - 1 + i] === undefined ? '' : row[c - 1 + i]); return out; }),
        getValue: () => (rows[r - 1] || [])[c - 1],
        setValue: (v) => { while (rows.length < r) rows.push([]); rows[r - 1][c - 1] = v; },
        setValues: (vals) => { vals.forEach((vr, i) => { while (rows.length < r + i) rows.push([]); vr.forEach((v, j) => { rows[r - 1 + i][c - 1 + j] = v; }); }); },
      };
    },
    appendRow(r) { rows.push(r.slice()); },
  };
}

function setup() {
  const contacts = fakeSheet([['PSID'], ['P1', '', new Date(0), new Date(1000), '', '381729145014885', 'নতুন']]);
  const messages = fakeSheet([['Time', 'PageId', 'PSID', 'Direction', 'Text', 'MID', 'By', 'Attachments']]);
  const ctx = {
    Date, JSON, Math, Number, String, Array, Object, isFinite, parseInt,
    SpreadsheetApp: { getActive: () => ({ getSheetByName: (n) => (n === 'MessengerContacts' ? contacts : messages), insertSheet: () => { throw Error('no'); } }) },
    ensureSheet_: () => messages,
    CacheService: { getScriptCache: () => ({ get: () => null, put() {}, remove() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k.indexOf('MSGR_PAGE_TOKEN') === 0 ? 'tok' : '') }) },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 400, getContentText: () => JSON.stringify({ error: { code: 100, error_subcode: 2018218, message: 'No profile available for this user.' } }) }) },
    ContentService: { createTextOutput: (t) => t },
    Utilities: { formatDate: (d) => d.toISOString() },
    buildMessengerAutoReply_: () => '', messengerGreetingText_: () => '', sendMessengerText_: () => ({ ok: true }),
    getAdminsSheet_: () => fakeSheet([[]]),
  };
  vm.runInNewContext(code + '\nthis.messengerWebhook_ = messengerWebhook_; this.msgrContactFromRow_ = msgrContactFromRow_; this.getMessengerProfile_ = getMessengerProfile_;', ctx);
  return { ctx, contacts, messages };
}
const hook = (ctx, ev) => ctx.messengerWebhook_({ postData: { contents: JSON.stringify({ entry: [{ id: '381729145014885', messaging: [Object.assign({ sender: { id: 'P1' } }, ev)] }] }) } });

test('read/delivery receipts set SeenUpTo/DeliveredUpTo, add no message row, and only move forward', () => {
  const { ctx, contacts, messages } = setup();
  hook(ctx, { delivery: { watermark: 5000 } });
  hook(ctx, { read: { watermark: 9000 } });
  hook(ctx, { read: { watermark: 7000 } }); // older: ignored
  assert.equal(messages.rows.length, 1, 'no blank message rows');
  const c = ctx.msgrContactFromRow_(contacts.rows[1]);
  assert.equal(c.seenAtMs, 9000);
  assert.equal(c.deliveredAtMs, 9000, 'a read also means delivered');
  assert.equal(c.unread, 0);
});

test('an event with nothing to show (e.g. a reaction) is not saved as an empty message', () => {
  const { ctx, messages } = setup();
  hook(ctx, { reaction: { reaction: 'love', mid: 'm1' } });
  assert.equal(messages.rows.length, 1);
});

test('a refused profile lookup keeps Facebook\'s reason', () => {
  const { ctx } = setup();
  const p = ctx.getMessengerProfile_('P1', '381729145014885');
  assert.equal(p.name, undefined);
  assert.match(p.error, /#100\/2018218 No profile available/);
});
