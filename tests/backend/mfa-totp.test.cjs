const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'apps-script/MfaCore.gs'), 'utf8');
const sandbox = {
  Utilities: {
    MacAlgorithm: { HMAC_SHA_1: 'HMAC_SHA_1' },
    computeHmacSignature(algorithm, message, key) {
      assert.equal(algorithm, 'HMAC_SHA_1');
      const bytes = values => Buffer.from(values.map(value => Number(value) & 0xff));
      return Array.from(crypto.createHmac('sha1', bytes(key)).update(bytes(message)).digest(), value => value > 127 ? value - 256 : value);
    }
  }
};
vm.createContext(sandbox);
vm.runInContext(`${source}\nthis.__verifyTotpCode = verifyTotpCode_; this.__decodeBase32 = mfaDecodeBase32Secret_; this.__counterBytes = mfaCounterBytes_;`, sandbox, { timeout: 1000 });
const verify = sandbox.__verifyTotpCode;
const decodeBase32 = sandbox.__decodeBase32;
const counterBytes = sandbox.__counterBytes;
const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // Base32 for ASCII "12345678901234567890".

function codeForCounter(counter) {
  const key = Buffer.from('12345678901234567890', 'ascii');
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(message).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = ((digest[offset] & 127) * 0x1000000) +
    ((digest[offset + 1] & 255) * 0x10000) +
    ((digest[offset + 2] & 255) * 0x100) +
    (digest[offset + 3] & 255);
  return String(binary % 1_000_000).padStart(6, '0');
}

test('TOTP verifier matches RFC 6238 SHA-1 vectors and preserves leading zeroes', () => {
  const vectors = [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130']
  ];
  for (const [seconds, code] of vectors) {
    assert.equal(verify(rfcSecret, code, seconds * 1000), Math.floor(seconds / 30), `vector at ${seconds}`);
  }
});

test('accepts only the documented adjacent-step clock-skew window', () => {
  assert.equal(verify(rfcSecret, codeForCounter(2), 59_000), 2, 'one step ahead is accepted');
  assert.equal(verify(rfcSecret, codeForCounter(3), 59_000), null, 'two steps ahead is rejected');
});

test('matched counter can be supplied to reject a replayed OTP', () => {
  const code = '287082';
  assert.equal(verify(rfcSecret, code, 59_000, 0), 1);
  assert.equal(verify(rfcSecret, code, 59_000, 1), null);
  assert.equal(verify(rfcSecret, code, 59_000, 2), null);
  assert.equal(verify(rfcSecret, code, 59_000, Number.MAX_SAFE_INTEGER + 1), null);
});

test('Base32 accepts canonical padded and unpadded secrets of 128 bits or more', () => {
  const forms = [
    [26, 6, 16],
    [28, 4, 17],
    [29, 3, 18],
    [31, 1, 19],
    [32, 0, 20]
  ];
  for (const [characters, padding, bytes] of forms) {
    const text = 'A'.repeat(characters);
    assert.equal(decodeBase32(text).length, bytes, `unpadded length ${characters}`);
    if (padding) assert.equal(decodeBase32(text + '='.repeat(padding)).length, bytes, `padded length ${characters}`);
  }
  assert.equal(decodeBase32(rfcSecret.toLowerCase().replace(/.{8}/g, '$& ')).length, 20, 'case and whitespace are normalized');
  assert.equal(decodeBase32('A'.repeat(24)), null, 'a canonical 120-bit key is too short');
  assert.equal(decodeBase32('A'.repeat(26) + '====='), null, 'incorrect padding count is rejected');
  assert.equal(decodeBase32('A'.repeat(26) + '======='), null, 'excess padding is rejected');
  assert.equal(decodeBase32(`${'A'.repeat(17)}B`), null, 'non-canonical trailing bits are rejected');
});

test('counter encoder is big-endian across 2^32 and rejects unsafe integers', () => {
  assert.deepEqual(Array.from(counterBytes(2 ** 32)), [0, 0, 0, 1, 0, 0, 0, 0]);
  assert.deepEqual(Array.from(counterBytes(Number.MAX_SAFE_INTEGER)), [0, 31, 255, 255, 255, 255, 255, 255]);
  assert.equal(counterBytes(Number.MAX_SAFE_INTEGER + 1), null);
});

test('rejects malformed codes, invalid secrets, and invalid time or replay state', () => {
  assert.equal(verify(rfcSecret, '28708', 59_000), null);
  assert.equal(verify(rfcSecret, '28x082', 59_000), null);
  assert.equal(verify('NOT-A-BASE32-SECRET', '287082', 59_000), null);
  assert.equal(verify('A'.repeat(24), '287082', 59_000), null, 'valid but undersized key is rejected');
  assert.equal(verify(rfcSecret, '287082', -1), null);
  assert.equal(verify(rfcSecret, '287082', NaN), null);
  assert.equal(verify(rfcSecret, '287082', 59_000, 'not-a-counter'), null);
});

test('TOTP core contains no insecure pseudo-random generation and documents atomic replay persistence', () => {
  assert.doesNotMatch(source, /Math\.random\s*\(/);
  assert.match(source, /persist that counter atomically/);
});
