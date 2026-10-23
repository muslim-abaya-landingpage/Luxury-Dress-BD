// cart-reprice.js must charge exactly what the order server (Operations.gs opsLinePrice_) charges,
// for every product, option and custom size in the real catalog.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');

function serverPricer() {
  const src = fs.readFileSync(path.join(root, 'apps-script/Operations.gs'), 'utf8');
  const grab = (name) => {
    const i = src.indexOf('function ' + name + '(');
    let depth = 0, j = src.indexOf('{', i);
    for (let k = j; k < src.length; k++) {
      if (src[k] === '{') depth++;
      else if (src[k] === '}' && --depth === 0) return src.slice(i, k + 1);
    }
    throw new Error('missing ' + name);
  };
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(grab('opsNorm_') + '\n' + grab('opsLinePrice_'), ctx);
  return (line, p) => { try { return ctx.opsLinePrice_(Object.assign({ qty: 1 }, line), p); } catch (e) { return null; } };
}

function clientPricer() {
  const ctx = { window: {}, setTimeout, clearTimeout };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'cart-reprice.js'), 'utf8'), ctx);
  return ctx.window.maServerUnitPrice;
}

function catalog() {
  const out = path.join(root, 'catalog-validation.json');
  const before = fs.readFileSync(out);
  try {
    execFileSync(process.execPath, [path.join(root, 'scripts/build-catalog-validation.mjs')], { cwd: root, stdio: 'ignore' });
    return JSON.parse(fs.readFileSync(out, 'utf8')).products;
  } finally {
    fs.writeFileSync(out, before);
  }
}

test('cart price equals the order server price for every product, option and custom size', () => {
  const server = serverPricer();
  const client = clientPricer();
  const products = catalog();
  let compared = 0;
  products.forEach((p) => {
    const types = p.prices ? Object.keys(p.prices).concat('', 'No Such Option') : [''];
    const sizes = [];
    if (p.kind === 'abaya') {
      const bodies = p.bodySizes.length ? p.bodySizes : [(p.bodyLabel.match(/\d+/) || [])[0]];
      p.lengths.slice(0, 2).forEach((len) => sizes.push('Body ' + bodies[0] + ' / Length ' + len));
    } else {
      (p.sizes || []).slice(0, 2).forEach((s) => sizes.push(typeof s === 'object' ? s.value : s));
    }
    sizes.push('Custom (L:58 / W:48)', 'Custom (L:62.5 / W:53)', 'Custom (L:99 / W:99)');
    types.forEach((type) => sizes.forEach((size) => {
      const line = { id: p.id, productType: type, size };
      const want = server(line, p);
      const got = client(line, p);
      // Where the server accepts the line, the cart must hold the same unit price.
      if (want != null) { assert.equal(got, want, `${p.id} ${type} ${size}`); compared++; }
      else assert.ok(got == null || typeof got === 'number');
    }));
  });
  assert.ok(compared > products.length, 'compared ' + compared + ' priced lines');
});
