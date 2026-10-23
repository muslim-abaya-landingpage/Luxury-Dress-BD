// scripts/build-catalog-asset-versions.mjs: every local JS/CSS URL gets a content version at build time.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const script = path.resolve(__dirname, '../../scripts/build-catalog-asset-versions.mjs');
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);

function site(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-assets-'));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.copyFileSync(script, path.join(dir, 'scripts', 'build-catalog-asset-versions.mjs'));
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
  const run = () => execFileSync(process.execPath, [path.join(dir, 'scripts', 'build-catalog-asset-versions.mjs')], { encoding: 'utf8' });
  const read = (name) => fs.readFileSync(path.join(dir, name), 'utf8');
  return { dir, run, read };
}

test('stamps scripts, styles and preloads with content hashes; external and missing files are left alone', () => {
  const s = site({
    'chat.js': 'console.log("chat v2")',
    'style.css': 'body{color:red}',
    'footer.js': 'load("chat.js?v=20261022-old"); load("missing.js?v=1"); var text = "not a url.js";',
    'index.html': '<link rel="preload" as="script" href="footer.js?v=old"><link rel="stylesheet" href="style.css" media="print" onload="this.media=\'all\'">' +
      '<script defer src="footer.js?v=old"></script><script src="https://cdn.example.com/x.js"></script><script src="nope.js"></script>',
    'product/item.html': '<script src="/footer.js"></script><link rel="stylesheet" href="../style.css?v=1#x">',
  });
  s.run();
  const footer = s.read('footer.js');
  assert.match(footer, new RegExp('load\\("chat\\.js\\?v=' + hash('console.log("chat v2")') + '"\\)'));
  assert.match(footer, /load\("missing\.js\?v=1"\)/);
  assert.match(footer, /"not a url\.js"/);
  const fv = hash(footer);
  const html = s.read('index.html');
  assert.equal((html.match(new RegExp('footer\\.js\\?v=' + fv, 'g')) || []).length, 2, 'preload and script share the version');
  assert.match(html, new RegExp('href="style\\.css\\?v=' + hash('body{color:red}') + '"'));
  assert.match(html, /src="https:\/\/cdn\.example\.com\/x\.js"/);
  assert.match(html, /src="nope\.js"/);
  const sub = s.read('product/item.html');
  assert.match(sub, new RegExp('src="/footer\\.js\\?v=' + fv + '"'));
  assert.match(sub, new RegExp('href="\\.\\./style\\.css\\?v=' + hash('body{color:red}') + '#x"'));
});

test('a changed file gets a new URL everywhere; running twice changes nothing', () => {
  const s = site({ 'chat.js': 'one', 'footer.js': 'load("chat.js?v=a")', 'index.html': '<script src="footer.js"></script>' });
  s.run();
  const first = s.read('index.html');
  assert.match(s.run(), /0 scripts with pinned URLs .* 0 HTML pages/);
  assert.equal(s.read('index.html'), first);
  fs.writeFileSync(path.join(s.dir, 'chat.js'), 'two');
  s.run();
  assert.notEqual(s.read('index.html'), first, 'footer.js URL changes because the file it loads changed');
  assert.match(s.read('footer.js'), new RegExp('chat\\.js\\?v=' + hash('two')));
});
