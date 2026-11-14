// Product link (slug) from a Bangla name: common shop words get their usual English spelling, other words are
// written by sound; English names work as before. Only used for new products (the slug of a published product
// never changes by itself — see the title input in product-manager.html).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const w = {}; w.window = w; vm.createContext(w);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../../product-publish-utils.js'), 'utf8'), w);
const slug = (n) => w.MaProductPublishUtils.slug(n);

test('Bangla names become readable English-letter links', () => {
  assert.equal(slug('লেপার্ড প্রিন্ট লিলেন কামিজ ও পায়জামা সেট'), 'leopard-print-linen-kameez-and-pajama-set');
  assert.equal(slug('কালো বোরকা সেট'), 'black-borka-set');
  assert.equal(slug('বাটিক থ্রিপিস'), 'batik-three-piece');
  assert.equal(slug('সুন্দর জামদানি শাড়ি'), 'sundor-jamdani-saree');
  assert.equal(slug('নতুন ডিজাইন ২০২৬'), 'new-design-2026');
});

test('English and mixed names, and the length/shape rules, stay as before', () => {
  assert.equal(slug('Navy Chiffon Abaya'), 'navy-chiffon-abaya');
  assert.equal(slug('Premium কামিজ Set'), 'premium-kameez-set');
  assert.equal(slug('!!'), '');
  const long = slug('লেপার্ড প্রিন্ট লিলেন কামিজ ও পায়জামা সেট প্রিমিয়াম কটন ফ্লোরাল এমব্রয়ডারি ডিজাইন');
  assert.ok(long.length <= 50 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(long), long);
});
