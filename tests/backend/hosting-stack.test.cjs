// Hosting is GitHub + Cloudflare (+ Supabase). The old hosting setup was removed on 2026-11-06;
// this keeps any of its files, settings or links from coming back.
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '../..');
const word = ['net', 'lify'].join('');

test('no leftover files, settings or links of the old hosting provider', () => {
  const files = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.deepEqual(files.filter((f) => f.toLowerCase().includes(word)), []);
  const hits = [];
  for (const f of files) {
    if (/^images\//.test(f) || /\.(png|jpe?g|webp|avif|gif|ico|woff2?|ttf|mp4|pdf|zip)$/i.test(f)) continue;
    const full = path.join(root, f);
    if (!fs.existsSync(full)) continue;
    if (fs.readFileSync(full, 'utf8').toLowerCase().includes(word)) hits.push(f);
  }
  assert.deepEqual(hits, []);
});
