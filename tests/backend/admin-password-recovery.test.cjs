const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '../..');
const backend = fs.readFileSync(path.join(root, 'apps-script/AdminPasswordRecovery.gs'), 'utf8');
const router = fs.readFileSync(path.join(root, 'apps-script/Code.gs'), 'utf8');

function mockSheet(rows) {
  return {
    rows,
    getDataRange() { return { getValues: () => rows.map(row => row.slice()) }; },
    getRange(row, col, height = 1, width = 1) {
      return {
        setValues(values) {
          for (let i = 0; i < height; i++) for (let j = 0; j < width; j++) rows[row - 1 + i][col - 1 + j] = values[i][j];
        },
        setValue(value) { rows[row - 1][col - 1] = value; },
        clearContent() { rows[row - 1][col - 1] = ''; }
      };
    }
  };
}

function makeApp() {
  const props = new Map();
  const sent = [];
  const admins = mockSheet([
    ['Email', 'Phone', 'Name', 'PasswordHash', 'Salt', 'Status', 'CreatedAt', 'Role', 'UpdatedAt'],
    ['owner@example.com', '01700000000', 'Owner', 'hash:previous', 'old-salt', 'active', '', 'admin', '']
  ]);
  const sessions = mockSheet([
    ['Token', 'Email', 'Phone', 'Name', 'CreatedAt', 'ExpiresAt', 'Role'],
    ['owner-token', 'owner@example.com', '', 'Owner', '', '', 'admin'],
    ['customer-token', 'owner@example.com', '', 'Owner', '', '', 'customer'],
    ['other-token', 'other@example.com', '', 'Other', '', '', 'staff']
  ]);
  let serial = 0;
  let bumped = 0;
  const sandbox = {
    console: { error() {} },
    Date,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: key => props.get(key) || null,
      setProperty: (key, value) => props.set(key, String(value)),
      deleteProperty: key => props.delete(key)
    }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: message => sent.push(message) },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
      computeDigest: (_algorithm, text) => [...createHash('sha256').update(String(text)).digest()].map(n => n > 127 ? n - 256 : n),
      getUuid: () => {
        serial += 1;
        return serial.toString(16).padStart(32, 'a');
      }
    },
    SpreadsheetApp: { flush() {} },
    getAuthSecret_: () => 'testing-pepper-that-is-never-printed',
    normalizeEmail_: email => String(email || '').trim().toLowerCase(),
    findAdminByEmail_: email => {
      const row = admins.rows.findIndex((r, i) => i > 0 && r[0].toLowerCase() === email);
      return row < 0 ? null : {
        row: row + 1, email: admins.rows[row][0], hash: admins.rows[row][3],
        salt: admins.rows[row][4], status: admins.rows[row][5]
      };
    },
    hashPassword_: password => ({ hash: 'hash:' + password, salt: 'new-salt' }),
    verifyPassword_: (password, salt, expected) => expected === 'hash:' + password,
    getAdminsSheet_: () => admins,
    getSessionsSheet_: () => sessions,
    bumpAdminAuthGeneration_: () => { bumped += 1; },
    param_: (e, key) => e.parameter[key] || ''
  };
  vm.runInNewContext(backend, sandbox, { filename: 'AdminPasswordRecovery.gs', timeout: 1500 });
  return { app: sandbox, sent, props, admins, sessions, bumped: () => bumped };
}
function request(app, email) {
  return app.adminPasswordRecoveryHandle_('AdminPasswordResetRequest', { parameter: { Email: email } });
}
function confirm(app, email, token, password) {
  return app.adminPasswordRecoveryHandle_('AdminPasswordResetConfirm',
    { parameter: { Email: email, Token: token, NewPassword: password } });
}
function claim(message) {
  const link = message.body.match(/https:\/\/muslimabaya\.com\/admin-reset-password\.html#[^\s]+/);
  assert.ok(link, 'Email must contain an approved-site URL with a URL fragment');
  const fragment = new URLSearchParams(new URL(link[0]).hash.slice(1));
  return { email: fragment.get('email'), token: fragment.get('token') };
}

test('public admin recovery route exists before generic admin session handling', () => {
  const recovery = router.indexOf("type === 'AdminPasswordResetRequest'");
  const generic = router.indexOf("type.indexOf('Admin') === 0");
  assert.ok(recovery > 0 && recovery < generic);
});

test('unknown mailbox gets identical success message and no email', () => {
  const { app, sent } = makeApp();
  const unknown = request(app, 'unknown@example.com');
  const known = request(app, 'owner@example.com');
  assert.equal(unknown.ok, true);
  assert.equal(unknown.message, known.message);
  assert.equal(sent.length, 1);
});

test('blocked admin account never receives a recovery token', () => {
  const { app, admins, sent } = makeApp();
  admins.rows[1][5] = 'blocked';
  assert.equal(request(app, 'owner@example.com').ok, true);
  assert.equal(sent.length, 0);
});

test('one-time token is hashed, rate-limited and is not leaked in the URL request', () => {
  const { app, sent, props } = makeApp();
  request(app, 'owner@example.com');
  request(app, 'owner@example.com');
  assert.equal(sent.length, 1);
  const { email, token } = claim(sent[0]);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.equal(email, 'owner@example.com');
  assert.equal(sent[0].body.includes('?token='), false);
  const values = [...props.values()].join(' ');
  assert.equal(values.includes(token), false);
});

test('reject weak and wrong passwords without changing admin hash', () => {
  const { app, sent, admins } = makeApp();
  request(app, 'owner@example.com');
  const { email, token } = claim(sent[0]);
  assert.equal(confirm(app, email, token, 'short').error, 'WEAK_PASSWORD');
  assert.equal(confirm(app, email, 'f'.repeat(64), 'New password long enough!').error, 'INVALID_RECOVERY_LINK');
  assert.equal(admins.rows[1][3], 'hash:previous');
});

test('valid reset updates password, revokes only admin sessions and rejects replay', () => {
  const { app, sent, admins, sessions, props, bumped } = makeApp();
  request(app, 'owner@example.com');
  const { email, token } = claim(sent[0]);
  const changed = confirm(app, email, token, 'An entirely new strong password 2026!');
  assert.equal(changed.ok, true);
  assert.equal(admins.rows[1][3], 'hash:An entirely new strong password 2026!');
  assert.equal(sessions.rows[1][0], '');
  assert.equal(sessions.rows[2][0], 'customer-token');
  assert.equal(sessions.rows[3][0], 'other-token');
  assert.equal(bumped(), 1);
  assert.equal(confirm(app, email, token, 'Second password very strong!').ok, false);
  assert.equal([...props.values()].join('').includes(token), false);
});

test('expired token and password changes from elsewhere invalidate recovery', () => {
  const first = makeApp();
  request(first.app, 'owner@example.com');
  const link = claim(first.sent[0]);
  const key = first.app.adminRecoveryKey_(link.email);
  const record = JSON.parse(first.props.get(key));
  record.expiresAt = Date.now() - 1;
  first.props.set(key, JSON.stringify(record));
  assert.equal(confirm(first.app, link.email, link.token, 'Long and brand new password!').ok, false);

  const second = makeApp();
  request(second.app, 'owner@example.com');
  const secondLink = claim(second.sent[0]);
  second.admins.rows[1][3] = 'hash:manually-changed';
  assert.equal(confirm(second.app, secondLink.email, secondLink.token, 'Long and brand new password!').ok, false);
});
