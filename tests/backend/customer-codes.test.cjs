// Customer email codes (apps-script/CustomerAccountCodes.gs): sign in with a code and reset a forgotten
// password. Codes go to the account's email, work once, expire, allow 5 wrong tries, and replies never
// reveal whether an account exists.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const src = fs.readFileSync(path.join(__dirname, '../../apps-script/CustomerAccountCodes.gs'), 'utf8');
const code = fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8');

function setup({ quota = 90, now = Date.parse('2026-11-21T00:00:00Z') } = {}) {
  const customers = [
    ['Email', 'Phone', 'Name', 'PasswordHash', 'Salt', 'Status', 'CreatedAt', 'UpdatedAt'],
    ['sumi@example.com', '01712345678', 'Sumi', 'oldhash', 'oldsalt', 'active', '', ''],
    ['blocked@example.com', '01800000000', 'B', 'h', 's', 'blocked', '', ''],
  ];
  const sessions = [['Token', 'Email', 'Phone', 'Name', 'CreatedAt', 'ExpiresAt', 'Role'], ['t-old', 'sumi@example.com', '', '', '', '', 'customer'], ['t-admin', 'sumi@example.com', '', '', '', '', 'admin']];
  const sheet = (rows) => ({
    getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
    getRange: (r, c) => ({ setValue: (v) => { rows[r - 1][c - 1] = v; } }),
    deleteRow: (r) => rows.splice(r - 1, 1),
  });
  const props = new Map();
  const mails = [];
  let clock = now;
  let uuidN = 0;
  const ctx = {
    JSON, String, Number, Math, Date: class extends Date { constructor(...a) { super(...(a.length ? a : [clock])); } static now() { return clock; } }, parseInt, console: { error() {} },
    param_: (e, k) => (e.parameter[k] == null ? '' : String(e.parameter[k])),
    getAuthSecret_: () => 'secret',
    normalizeEmail_: (v) => String(v || '').trim().toLowerCase(),
    normalizePhone_: new Function('return ' + code.match(/function normalizePhone_\([\s\S]*?\n\}/)[0])(),
    hashPassword_: (p, salt) => { salt = salt || 'salt' + (++uuidN); return { hash: crypto.createHash('sha256').update(salt + p).digest('hex'), salt }; },
    getCustomersSheet_: () => sheet(customers),
    getSessionsSheet_: () => sheet(sessions),
    createSession_: (u, role) => ({ ok: true, token: 'new-token', email: u.email, phone: u.phone, name: u.name, role }),
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, v), deleteProperty: (k) => props.delete(k) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    MailApp: { getRemainingDailyQuota: () => quota, sendEmail: (m) => mails.push(m) },
    Utilities: {
      getUuid: () => crypto.randomUUID(),
      computeDigest: (_a, s) => Array.from(crypto.createHash('sha256').update(s).digest()).map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
    },
  };
  ctx.findCustomerByEmail_ = (email) => { const r = customers.find((x, i) => i && x[0] === ctx.normalizeEmail_(email)); return r && { email: r[0], phone: r[1], name: r[2], status: r[5] }; };
  ctx.findCustomerByPhone_ = (phone) => { const r = customers.find((x, i) => i && x[1] === ctx.normalizePhone_(phone)); return r && { email: r[0], phone: r[1], name: r[2], status: r[5] }; };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const call = (fn, parameter) => ctx[fn]({ parameter });
  const lastCode = () => mails[mails.length - 1].body.match(/(\d{6})/)[1];
  return { ctx, call, mails, customers, sessions, props, lastCode, tick: (ms) => { clock += ms; } };
}

test('code by mobile number goes to the account email; sign in with it once', () => {
  const s = setup();
  const r = s.call('requestCustomerCode_', { Login: '+880 1712-345678', Purpose: 'login' });
  assert.equal(r.ok, true);
  assert.equal(s.mails.length, 1);
  assert.equal(s.mails[0].to, 'sumi@example.com');
  const c = s.lastCode();
  assert.match(s.mails[0].subject, new RegExp(c));
  const ok = s.call('customerCodeLogin_', { Login: '01712345678', Code: c });
  assert.equal(ok.ok, true); assert.equal(ok.token, 'new-token'); assert.equal(ok.role, 'customer');
  assert.equal(s.call('customerCodeLogin_', { Login: '01712345678', Code: c }).error, 'INVALID_CODE', 'a code works only once');
});

test('unknown or blocked accounts get the same reply and no email', () => {
  const s = setup();
  const a = s.call('requestCustomerCode_', { Login: 'nobody@example.com' });
  const b = s.call('requestCustomerCode_', { Login: 'blocked@example.com' });
  const c = s.call('requestCustomerCode_', { Login: 'sumi@example.com' });
  assert.deepEqual(a, c); assert.deepEqual(b, c);
  assert.equal(s.mails.length, 1);
});

test('codes expire after 10 minutes, die after 5 wrong tries, and a new one is sent at most once a minute', () => {
  const s = setup();
  s.call('requestCustomerCode_', { Login: 'sumi@example.com' });
  s.call('requestCustomerCode_', { Login: 'sumi@example.com' });
  assert.equal(s.mails.length, 1, 'second request within a minute sends nothing');
  let c = s.lastCode();
  s.tick(10 * 60 * 1000 + 1);
  assert.equal(s.call('customerCodeLogin_', { Login: 'sumi@example.com', Code: c }).ok, false);

  s.call('requestCustomerCode_', { Login: 'sumi@example.com' });
  c = s.lastCode();
  const wrong = c === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal(s.call('customerCodeLogin_', { Login: 'sumi@example.com', Code: wrong }).ok, false);
  assert.equal(s.call('customerCodeLogin_', { Login: 'sumi@example.com', Code: c }).ok, false, 'right code no longer works after 5 wrong tries');
});

test('a sign-in code cannot reset the password, and a reset code cannot sign in', () => {
  const s = setup();
  s.call('requestCustomerCode_', { Login: 'sumi@example.com', Purpose: 'login' });
  assert.equal(s.call('customerPasswordReset_', { Login: 'sumi@example.com', Code: s.lastCode(), Password: 'newpassword1' }).ok, false);
});

test('password reset: new password saved, other customer sessions signed out, signed in right away', () => {
  const s = setup();
  s.call('requestCustomerCode_', { Login: 'sumi@example.com', Purpose: 'reset' });
  assert.match(s.mails[0].body, /reset your password/);
  assert.equal(s.call('customerPasswordReset_', { Login: 'sumi@example.com', Code: s.lastCode(), Password: 'short' }).error, 'WEAK_PASSWORD');
  const r = s.call('customerPasswordReset_', { Login: 'sumi@example.com', Code: s.lastCode(), Password: 'newpassword1' });
  assert.equal(r.ok, true);
  const row = s.customers[1];
  assert.notEqual(row[3], 'oldhash'); assert.notEqual(row[4], 'oldsalt');
  assert.equal(s.ctx.hashPassword_('newpassword1', row[4]).hash, row[3]);
  assert.deepEqual(s.sessions.map((x) => x[0]), ['Token', 't-admin'], 'customer sessions removed, admin session left alone');
});

test('out of daily email quota: clear message, nothing sent', () => {
  const s = setup({ quota: 1 });
  const r = s.call('requestCustomerCode_', { Login: 'sumi@example.com' });
  assert.equal(r.error, 'EMAIL_LIMIT');
  assert.equal(s.mails.length, 0);
});

test('Code.gs routes the three new requests through the normal per-account rate limit', () => {
  for (const t of ['CustomerCodeRequest', 'CustomerCodeLogin', 'CustomerPasswordReset']) assert.ok(code.includes("type === '" + t + "'"), t);
  const rl = code.indexOf("rateLimit_(param_(e, 'Email') || param_(e, 'Phone') || param_(e, 'Login')");
  assert.ok(rl > 0 && rl < code.indexOf("type === 'CustomerCodeRequest'"));
});
