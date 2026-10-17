const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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

test('the copy/paste HTML embeds the canonical Apps Script Code.gs source', () => {
  const html = fs.readFileSync(path.join(root, 'apps-script-copy.html'), 'utf8');
  const match = html.match(/<textarea id="codeBox" readonly>([\s\S]*?)<\/textarea>/);
  assert.ok(match, 'Missing Code.gs textarea in apps-script-copy.html');
  const embedded = match[1].replace(/&(amp|lt|gt);/g, (_, key) => ({ amp: '&', lt: '<', gt: '>' })[key]);
  assert.equal(embedded.replace(/\r\n/g, '\n').trimEnd(), source.replace(/\r\n/g, '\n').trimEnd());
});
