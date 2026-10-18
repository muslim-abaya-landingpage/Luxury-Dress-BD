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


test('admin login treats blocked status case-insensitively', () => {
  let passwordChecks = 0;
  const sandbox = {
    getAuthSecret_: () => 'configured',
    getAdminsSheet_: () => ({ getLastRow: () => 2 }),
    param_: (_event, key) => ({ Email: 'OWNER@example.com', Password: 'correct horse' })[key] || '',
    normalizeEmail_: value => String(value || '').trim().toLowerCase(),
    normalizePhone_: value => String(value || '').replace(/\D/g, ''),
    rateLimit_: () => {},
    findAdminByEmail_: () => ({ status: 'Blocked', salt: 's', hash: 'h' }),
    findAdminByPhone_: () => null,
    verifyPassword_: () => { passwordChecks += 1; return true; }
  };
  const loginAdmin = runFunction('loginAdmin_', sandbox);
  const result = loginAdmin({});
  assert.equal(result.error, 'BLOCKED');
  assert.equal(passwordChecks, 0);
});

test('admin session verification rejects blocked accounts and stale roles', () => {
  function verify(currentAdmin, sessionRole) {
    const sandbox = {
      verifySession_: () => ({ ok: true, token: 't', email: 'staff@example.com', phone: '01900000000', name: 'Staff', role: sessionRole }),
      findAdminByEmail_: () => currentAdmin,
      findAdminByPhone_: () => currentAdmin
    };
    return runFunction('verifyAdminSession_', sandbox)('t');
  }
  assert.equal(verify({ email: 'staff@example.com', phone: '01900000000', role: 'staff', status: 'BLOCKED' }, 'staff').error, 'BLOCKED');
  assert.equal(verify({ email: 'staff@example.com', phone: '01900000000', role: 'admin', status: 'active' }, 'staff').error, 'NOT_ADMIN');
});

test('staff save cannot overwrite admin rows or bind identifiers from different accounts', () => {
  function callSave(initialRows, fields) {
    const rows = initialRows.map(row => row.slice());
    const sheet = {
      getDataRange: () => ({ getValues: () => rows }),
      getRange: (row, column) => ({ setValue: value => { rows[row - 1][column - 1] = value; } })
    };
    const sandbox = {
      LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
      verifyAdminSession_: () => ({ ok: true, isOwner: true }),
      requireOwnerAdmin_: () => null,
      getAdminsSheet_: () => sheet,
      normalizeEmail_: value => String(value || '').trim().toLowerCase(),
      normalizePhone_: value => String(value || '').replace(/\D/g, ''),
      hashPassword_: () => ({ hash: 'new-hash', salt: 'new-salt' }),
      appendRow_: (_target, row) => rows.push(row),
      param_: (_event, key) => fields[key] || ''
    };
    const save = runFunction('saveAdminStaff_', sandbox);
    return { result: save({}), rows };
  }

  const admin = ['owner@example.com', '01900000000', 'Owner', 'old-hash', 'old-salt', 'active', new Date(), 'admin', new Date()];
  const ownerAttempt = callSave([['Email', 'Phone'], admin], {
    Email: 'owner@example.com', Phone: '01800000000', Name: 'Injected', Password: 'secret1'
  });
  assert.equal(ownerAttempt.result.error, 'ACCOUNT_CONFLICT');
  assert.equal(ownerAttempt.rows[1][7], 'admin');
  assert.equal(ownerAttempt.rows[1][3], 'old-hash');

  const staffA = ['a@example.com', '01911111111', 'A', 'h', 's', 'active', new Date(), 'staff', new Date()];
  const staffB = ['b@example.com', '01922222222', 'B', 'h', 's', 'active', new Date(), 'staff', new Date()];
  const splitIdentity = callSave([['Email', 'Phone'], staffA, staffB], {
    Email: 'a@example.com', Phone: '01922222222', Name: 'A', Password: 'secret1'
  });
  assert.equal(splitIdentity.result.error, 'IDENTIFIER_CONFLICT');
  assert.equal(splitIdentity.rows[1][1], '01911111111');
  assert.equal(splitIdentity.rows[2][1], '01922222222');
});

test('media path validation allows only image types and image bytes must match MIME', () => {
  const start = source.indexOf("var GITHUB_IMAGES_PREFIX_ =");
  const end = source.indexOf('function publishImageToGitHub_', start);
  assert.ok(start >= 0 && end > start, 'Missing image validation helpers');
  const sandbox = {
    Utilities: { base64Decode: value => Array.from(Buffer.from(value, 'base64')) },
    String, Number, Math, isFinite
  };
  vm.runInNewContext(source.slice(start, end) + '\nthis.pathAllowed = isAllowedGithubImagePath_; this.validateImage = validateGithubImagePayload_;', sandbox);
  assert.equal(sandbox.pathAllowed('images/main/new-photo.webp'), true);
  assert.equal(sandbox.pathAllowed('images/checkout.html'), false);
  assert.equal(sandbox.pathAllowed('images/../admin.png'), false);
  const pngBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  assert.equal(sandbox.validateImage(pngBytes.toString('base64'), 'image/png', 'images/main/photo.png').ok, true);
  assert.equal(sandbox.validateImage(Buffer.from('abc').toString('base64'), 'image/png', 'images/main/photo.png').error, 'INVALID_IMAGE_DATA');
  assert.equal(sandbox.validateImage(pngBytes.toString('base64'), 'image/jpeg', 'images/main/photo.jpg').error, 'INVALID_IMAGE_DATA');
});

test('legacy Apps Script backend fails closed for unknown RecordType instead of treating it as an order', () => {
  const legacy = fs.readFileSync(path.join(root, 'google-apps-script-backend.gs'), 'utf8');
  assert.match(legacy, /if \(isOrder\) return ContentService\.createTextOutput\(handleOrder_\(e\)\)/);
  assert.match(legacy, /UNKNOWN_RECORD_TYPE/);
  assert.doesNotMatch(legacy, /return ContentService\.createTextOutput\(handleOrder_\(e\)\)\.setMimeType\(ContentService\.MimeType\.TEXT\);\s*\n\s*\} catch/);
});


test('manual Apps Script copy page contains every canonical server-side and HTML source file', () => {
  const appDir = path.join(root, 'apps-script');
  const names = fs.readdirSync(appDir).filter(name => /\.(gs|html)$/.test(name));
  const copyPage = fs.readFileSync(path.join(root, 'apps-script-copy.html'), 'utf8');
  for (const name of names) {
    const canonical = fs.readFileSync(path.join(appDir, name), 'utf8');
    const escaped = canonical.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    assert.ok(copyPage.includes(escaped), `Copy page is missing or stale: ${name}`);
  }
  assert.match(copyPage, /সম্পূর্ণ project/);
  assert.match(copyPage, /Operations\.gs/);
  assert.match(copyPage, /CatalogPublish\.gs/);
});


test('admin login normalizes stored role casing before creating a session', () => {
  const user = { email: 'staff@example.com', phone: '01900000000', name: 'Staff', status: 'active', role: 'STAFF', salt: 's', hash: 'h' };
  const sandbox = {
    getAuthSecret_: () => 'configured',
    getAdminsSheet_: () => ({ getLastRow: () => 2 }),
    param_: (_event, key) => ({ Email: user.email, Password: 'secret1' })[key] || '',
    normalizeEmail_: value => String(value || '').trim().toLowerCase(),
    normalizePhone_: value => String(value || '').replace(/\D/g, ''),
    rateLimit_: () => {},
    findAdminByEmail_: () => user,
    verifyPassword_: () => true,
    createSession_: (_identity, role) => ({ ok: true, role })
  };
  const result = runFunction('loginAdmin_', sandbox)({});
  assert.equal(result.role, 'staff');
});


test('admin permission matrix is explicit and staff cannot inherit protected Ops access', () => {
  const sandbox = {
    ADMIN_PERMISSION_MATRIX_: {
      admin: ['admin.owner_actions', 'ops.protected.manage'],
      staff: []
    }
  };
  const hasPermission = runFunction('adminHasPermission_', sandbox);
  sandbox.adminHasPermission_ = hasPermission;
  const requirePermission = runFunction('requireAdminPermission_', sandbox);
  sandbox.requireAdminPermission_ = requirePermission;
  const canManageProtectedOps = runFunction('canManageProtectedOps_', sandbox);
  const ownerGate = runFunction('requireOwnerAdmin_', sandbox);

  assert.equal(hasPermission({ role: 'admin' }, 'admin.owner_actions'), true);
  assert.equal(hasPermission({ role: 'admin' }, 'ops.protected.manage'), true);
  assert.equal(hasPermission({ role: 'admin' }, 'unknown.permission'), false);
  assert.equal(hasPermission({ role: 'staff' }, 'ops.protected.manage'), false);
  assert.equal(hasPermission({ role: 'staff', isOwner: true }, 'admin.owner_actions'), false);
  assert.equal(hasPermission({ role: 'unknown' }, 'ops.protected.manage'), false);
  assert.equal(hasPermission(null, 'admin.owner_actions'), false);
  assert.equal(canManageProtectedOps({ role: 'admin' }), true);
  assert.equal(canManageProtectedOps({ role: 'staff' }), false);
  assert.equal(ownerGate({ role: 'admin' }), null);
  assert.equal(ownerGate({ role: 'staff', isOwner: true }).error, 'OWNER_ONLY');
  assert.equal(requirePermission({ role: 'staff' }, 'ops.protected.manage').error, 'FORBIDDEN');
  assert.doesNotMatch(source, /getProperty\(['"]SINGLE_OWNER_MODE['"]\)/);
});

test('Reality protected-ops guard admits the explicit admin permission and rejects staff', () => {
  function invoke(role) {
    const sandbox = {
      requireRealityAdminSession_: () => ({ role: role }),
      requireAdminPermission_: session => session.role === 'admin' ? null : { ok: false, error: 'FORBIDDEN' }
    };
    return runFunction('requireRealityManager_', sandbox)();
  }
  assert.equal(invoke('admin').role, 'admin');
  assert.throws(() => invoke('staff'), /ADMIN_ONLY/);
});


test('canonical Apps Script matrix grants only declared owner permissions', () => {
  const context = {};
  vm.runInNewContext(source, context, { timeout: 5000 });
  assert.equal(JSON.stringify(context.ADMIN_PERMISSION_MATRIX_), JSON.stringify({
    admin: ['admin.owner_actions', 'ops.protected.manage'],
    staff: []
  }));
  assert.equal(context.adminHasPermission_({ role: 'admin' }, 'ops.protected.manage'), true);
  assert.equal(context.adminHasPermission_({ role: 'staff' }, 'ops.protected.manage'), false);
  assert.equal(context.adminHasPermission_({ role: 'admin' }, 'unknown.permission'), false);
  assert.equal(context.requireOwnerAdmin_({ role: 'admin' }), null);
  assert.equal(context.requireOwnerAdmin_({ role: 'staff', isOwner: true }).error, 'OWNER_ONLY');
});
