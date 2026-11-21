// The owner uses another shop's site as a design reference but does not want that shop's name anywhere
// in this site's code, comments, tests or pages. Fails if it shows up in any tracked text file.
// (The name is built from character codes so this file does not contain it either.)
const test = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const NAME = String.fromCharCode(97, 110, 122, 97, 97, 114); // lower-case shop name
const root = path.join(__dirname, '../..');

test('no reference-shop name in any tracked file', () => {
  const files = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  const hits = [];
  for (const f of files) {
    if (/\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|otf|mp4|webm|pdf|zip)$/i.test(f)) continue;
    let text;
    try { text = fs.readFileSync(path.join(root, f), 'utf8'); } catch (e) { continue; }
    if (text.toLowerCase().includes(NAME)) hits.push(f);
  }
  assert.deepEqual(hits, [], 'remove the reference shop name from: ' + hits.join(', '));
});
