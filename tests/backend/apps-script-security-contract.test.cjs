const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Missing ${name} in apps-script/Code.gs`);
  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, `Missing body for ${name}`);

  let depth = 0;
  let state = 'code';
  let escaped = false;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (state === 'line-comment') {
      if (ch === '\n') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      if (ch === '*' && next === '/') {
        state = 'code';
        i += 1;
      }
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if ((state === 'single' && ch === "'") ||
                 (state === 'double' && ch === '"') ||
                 (state === 'template' && ch === '`')) {
        state = 'code';
      }
      continue;
    }

    if (ch === '/' && next === '/') {
      state = 'line-comment';
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      state = 'block-comment';
      i += 1;
      continue;
    }
    if (ch === "'") {
      state = 'single';
      continue;
    }
    if (ch === '"') {
      state = 'double';
      continue;
    }
    if (ch === '`') {
      state = 'template';
      continue;
    }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  assert.fail(`Unclosed function body: ${name}`);
}

function runFunction(name, sandbox) {
  vm.runInNewContext(`${extractFunction(name)}\nthis.__entry = ${name};`, sandbox, { timeout: 1000 });
  return sandbox.__entry;
}

function makeRateLimiter(properties) {
  const counters = new Map();
  const sandbox = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : null
      })
    },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => counters.has(key) ? counters.get(key) : null,
        put: (key, value) => counters.set(key, value)
      })
    },
    normalizePhone_: (value) => String(value || '').replace(/[^\d]/g, '')
  };
  return runFunction('rateLimitOrder_', sandbox);
}

test('GET Subscribe is explicitly rejected and does not call the sheet-writing helper', () => {
  let writeAttempts = 0;
  const sandbox = {
    param_: (event, key) => String((event && event.parameter && event.parameter[key]) || ''),
    jsonOut_: (value) => value,
    saveSubscribeContact_: () => {
      writeAttempts += 1;
      return { ok: true };
    },
    ContentService: {
      MimeType: { TEXT: 'text/plain' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } })
    }
  };
  const doGet = runFunction('doGet', sandbox);
  const result = doGet({ parameter: { RecordType: 'Subscribe', contact: 'security-probe@example.invalid' } });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'METHOD_NOT_ALLOWED');
  assert.match(result.message, /POST/);
  assert.equal(writeAttempts, 0);
});

test('POST Subscribe still reaches the existing subscription handler', () => {
  let savedContact = '';
  const sandbox = {
    param_: (event, key) => String((event && event.parameter && event.parameter[key]) || ''),
    jsonOut_: (value) => value,
    saveSubscribeContact_: (contact) => {
      savedContact = contact;
      return { ok: true, duplicate: true };
    },
    ContentService: {
      MimeType: { TEXT: 'text/plain' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } })
    }
  };
  const doPost = runFunction('doPost', sandbox);
  const result = doPost({ parameter: { RecordType: 'Subscribe', contact: 'security-probe@example.invalid' } });

  assert.equal(savedContact, 'security-probe@example.invalid');
  assert.equal(result.ok, true);
  assert.equal(result.sheet, 'Subscribe');
});

test('the rate-limit bypass defaults to an empty allowlist and the normal limit applies', () => {
  assert.match(source, /getProperty\(['"]ORDER_RATE_LIMIT_BYPASS['"]\)\s*\|\|\s*['"]['"]/);
  assert.doesNotMatch(source, /getProperty\(['"]ORDER_RATE_LIMIT_BYPASS['"]\)\s*\|\|\s*['"]\d{8,}/);

  const rateLimitOrder = makeRateLimiter({ ORDER_RATE_LIMIT_MAX: '1' });
  assert.doesNotThrow(() => rateLimitOrder('01900000000'));
  assert.throws(() => rateLimitOrder('01900000000'), { message: 'ORDER_RATE_LIMIT' });
});

test('an explicitly configured Script Property allowlist remains opt-in and functional', () => {
  const rateLimitOrder = makeRateLimiter({
    ORDER_RATE_LIMIT_MAX: '1',
    ORDER_RATE_LIMIT_BYPASS: '01900000000'
  });
  assert.doesNotThrow(() => rateLimitOrder('01900000000'));
  assert.doesNotThrow(() => rateLimitOrder('01900000000'));
});

test('empty normalized phone numbers cannot match empty allowlist entries', () => {
  const rateLimitOrder = makeRateLimiter({
    ORDER_RATE_LIMIT_MAX: '1',
    ORDER_RATE_LIMIT_BYPASS: ';'
  });
  assert.doesNotThrow(() => rateLimitOrder(''));
  assert.throws(() => rateLimitOrder(''), { message: 'ORDER_RATE_LIMIT' });
});

test('GET OrderTrack is rejected and never calls the order lookup', () => {
  let lookupAttempts = 0;
  const sandbox = {
    param_: (event, key) => String((event && event.parameter && event.parameter[key]) || ''),
    jsonOut_: (value) => value,
    getOrderTrackStatus_: () => {
      lookupAttempts += 1;
      return { ok: true, orders: [] };
    },
    ContentService: {
      MimeType: { TEXT: 'text/plain' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } })
    }
  };
  const doGet = runFunction('doGet', sandbox);
  const result = doGet({ parameter: { RecordType: 'OrderTrack', Phone: '01712345678' } });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'METHOD_NOT_ALLOWED');
  assert.equal(lookupAttempts, 0);
});

test('POST OrderTrack dispatches to the protected lookup before generic routing', () => {
  let receivedEvent = null;
  const sandbox = {
    param_: (event, key) => String((event && event.parameter && event.parameter[key]) || ''),
    jsonOut_: (value) => value,
    getOrderTrackStatus_: (event) => {
      receivedEvent = event;
      return { ok: true, orders: [{ orderId: 'MA-TEST-1' }] };
    },
    ContentService: {
      MimeType: { TEXT: 'text/plain' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } })
    }
  };
  const doPost = runFunction('doPost', sandbox);
  const event = { parameter: { RecordType: 'OrderTrack', OrderId: 'MA-TEST-1' } };
  const result = doPost(event);

  assert.equal(receivedEvent, event);
  assert.equal(result.ok, true);
  assert.equal(result.orders.length, 1);
});

test('tracking PIN is eight digits and stored through salted SHA-256, not as plaintext', () => {
  const utilities = {
    DigestAlgorithm: { SHA_256: 'SHA_256' },
    Charset: { UTF_8: 'UTF-8' },
    getUuid: () => '123e4567-e89b-12d3-a456-426614174000',
    computeDigest: (_algorithm, value) => Array.from(
      crypto.createHash('sha256').update(String(value), 'utf8').digest(),
      (byte) => byte > 127 ? byte - 256 : byte
    ),
    base64Encode: (bytes) => Buffer.from(bytes.map((byte) => byte < 0 ? byte + 256 : byte)).toString('base64')
  };
  const sandbox = { Utilities: utilities };
  const generatePin = runFunction('generateOrderTrackingPin_', sandbox);
  const hashPin = runFunction('hashOrderTrackingPin_', sandbox);
  const pin = generatePin();

  assert.match(pin, /^\d{8}$/);
  assert.notEqual(hashPin(pin, 'salt-A'), pin);
  assert.notEqual(hashPin(pin, 'salt-A'), hashPin(pin, 'salt-B'));
  assert.match(source, /setValue\(trackingPinHash\)/);
  assert.match(source, /setValue\(trackingPinSalt\)/);
  assert.doesNotMatch(source, /setValue\(trackingPin\)/);
});

test('tracking lookup requires matching phone, order ID and PIN and returns at most one order', () => {
  const pin = '12345678';
  const salt = 'e2e-salt';
  const storedHash = crypto.createHash('sha256').update(`${salt}:${pin}`, 'utf8').digest('base64');
  const row = new Array(40).fill('');
  row[0] = '2026-10-17T12:00:00.000Z';
  row[2] = '01712345678';
  row[3] = 1;
  row[6] = 'Premium Abaya';
  row[7] = 630;
  row[8] = 'MA-TEST-123';
  row[9] = 'Confirmed';
  row[10] = 'TRK-TEST-1';
  row[12] = 'In transit';
  row[13] = 'Dhaka';
  row[38] = storedHash;
  row[39] = salt;
  const rateLimitKeys = [];
  const normalizePhone = (value) => {
    let digits = String(value || '').replace(/[^\d]/g, '');
    if (digits.startsWith('880') && digits.length >= 12) digits = `0${digits.slice(3)}`;
    if (digits.length === 10 && digits.startsWith('1')) digits = `0${digits}`;
    return digits;
  };
  const sandbox = {
    param_: (event, key) => String((event && event.parameter && event.parameter[key]) || ''),
    normalizePhone_: normalizePhone,
    rateLimit_: (key) => rateLimitKeys.push(key),
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => ({}) }) },
    findOnlineOrderTrackingPinColumns_: () => ({ hashIndex: 38, saltIndex: 39 }),
    readOnlineOrderRows_: () => [new Array(40).fill(''), row],
    hashOrderTrackingPin_: (candidate, candidateSalt) => crypto.createHash('sha256').update(`${candidateSalt}:${candidate}`, 'utf8').digest('base64'),
    constantTimeTextEqual_: (left, right) => {
      if (String(left).length !== String(right).length) return false;
      let diff = 0;
      for (let i = 0; i < String(left).length; i += 1) diff |= String(left).charCodeAt(i) ^ String(right).charCodeAt(i);
      return diff === 0;
    },
    console: { error() {} }
  };
  const lookup = runFunction('getOrderTrackStatus_', sandbox);
  const valid = lookup({ parameter: { Phone: '01712345678', OrderId: 'MA-TEST-123', TrackingPin: pin } });
  const wrongPin = lookup({ parameter: { Phone: '01712345678', OrderId: 'MA-TEST-123', TrackingPin: '00000000' } });
  const wrongPhone = lookup({ parameter: { Phone: '01712345679', OrderId: 'MA-TEST-123', TrackingPin: pin } });
  const wrongOrder = lookup({ parameter: { Phone: '01712345678', OrderId: 'MA-OTHER-1', TrackingPin: pin } });

  assert.equal(valid.ok, true);
  assert.equal(valid.orders.length, 1);
  assert.equal(valid.orders[0].orderId, 'MA-TEST-123');
  assert.equal(valid.orders[0].tracking, 'TRK-TEST-1');
  assert.equal(JSON.stringify(valid).includes(storedHash), false);
  assert.equal(JSON.stringify(valid).includes(salt), false);
  assert.equal(wrongPin.orders.length, 0);
  assert.equal(wrongPhone.orders.length, 0);
  assert.equal(wrongOrder.orders.length, 0);
  assert.ok(rateLimitKeys.includes('track_phone_01712345678'));
  assert.ok(rateLimitKeys.includes('track_order_MA-TEST-123'));
});

test('the copy/paste HTML embeds the canonical Apps Script Code.gs source', () => {
  const html = fs.readFileSync(path.join(root, 'apps-script-copy.html'), 'utf8');
  const match = html.match(/<textarea id="codeBox" readonly>([\s\S]*?)<\/textarea>/);
  assert.ok(match, 'Missing Code.gs textarea in apps-script-copy.html');
  const embedded = match[1].replace(/&(amp|lt|gt);/g, (_, key) => ({ amp: '&', lt: '<', gt: '>' })[key]);
  assert.equal(embedded.replace(/\r\n/g, '\n').trimEnd(), source.replace(/\r\n/g, '\n').trimEnd());
});
