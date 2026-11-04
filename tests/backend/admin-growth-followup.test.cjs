const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'admin-growth.html'), 'utf8');

function inlineFunction(name, nextName) {
  const start = html.indexOf('function ' + name + '(');
  const end = html.indexOf('function ' + nextName + '(', start);
  assert.ok(start >= 0 && end > start, `could not find ${name} in admin-growth.html`);
  return vm.runInNewContext('(' + html.slice(start, end).trim() + ')');
}

const waLink = inlineFunction('waLink', 'abandonedCartMessage');
const abandonedCartMessage = inlineFunction('abandonedCartMessage', 'fmtTime');

test('WhatsApp link accepts valid Bangladesh mobile numbers in local or international format only', () => {
  const expected = 'https://wa.me/8801712345678?text=';
  assert.ok(waLink('01712-345678', 'hello').startsWith(expected));
  assert.ok(waLink('+880 1712 345 678', 'hello').startsWith(expected));
  assert.ok(waLink('00880 1712 345 678', 'hello').startsWith(expected));
  assert.equal(waLink('email@example.com', 'hello'), '');
  assert.equal(waLink('012345', 'hello'), '');
});

test('follow-up message identifies the unfinished checkout without falsely claiming the cart is reserved', () => {
  const message = abandonedCartMessage({ name: 'রহিমা', summary: 'Black Abaya × 1', value: 1450 });
  assert.match(message, /রহিমা/);
  assert.match(message, /Black Abaya × 1/);
  assert.match(message, /৳1450/);
  assert.match(message, /আর follow-up না চাইলে জানাবেন/);
  assert.doesNotMatch(message, /রিজার্ভ আছে/);
});

test('dashboard labels the action as a follow-up and requires the admin to review/send it manually', () => {
  assert.match(html, /WhatsApp ফলো-আপ ↗/);
  assert.match(html, /পাঠানোর আগে দেখে নিন; নিজে থেকে পাঠানো হবে না/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /ফোন নম্বর যাচাই দরকার/);
});
