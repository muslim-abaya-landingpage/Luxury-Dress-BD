const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'api-setup.html'), 'utf8');

test('API setup page keeps Bengali text as valid UTF-8', () => {
  assert.match(html, /<html lang="bn">/);
  assert.match(html, /API সেটআপ ও যাচাই/);
  assert.doesNotMatch(html, /\?{3,}/, 'question-mark replacement text must not be reintroduced');
  assert.doesNotMatch(html, /\uFFFD/, 'replacement characters must not appear in the page');
});

test('API setup page performs only a read-only OrderSchema GET probe', () => {
  assert.match(html, /searchParams\.set\("RecordType",\s*"OrderSchema"\)/);
  assert.match(html, /fetch\(url\.toString\(\),\s*\{\s*method:\s*"GET"/);
  assert.doesNotMatch(html, /searchParams\.set\("RecordType",\s*"Subscribe"\)/);
});
