// Order "Source": where the visitor came from survives the walk to /checkout (cart-utils.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(search, referrer, store) {
  const st = store || {};
  const win = { location: { search, hostname: 'muslimabaya.com' }, addEventListener() {}, removeEventListener() {}, dataLayer: [] };
  win.window = win;
  Object.assign(win, {
    document: { referrer: referrer || '', cookie: '', readyState: 'complete', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { return { setAttribute() {}, style: {} }; }, head: { appendChild() {} } },
    localStorage: { getItem: (k) => (k in st ? st[k] : null), setItem: (k, v) => { st[k] = String(v); }, removeItem: (k) => { delete st[k]; } },
    URLSearchParams, URL, console, setTimeout() {}, Date, JSON, Math
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../../cart-utils.js'), 'utf8'), vm.createContext(win));
  return { win, st };
}

test('UTM, click ids and social referrers become a readable source', () => {
  const d = load('', '').win.maDetectVisitSource;
  assert.equal(d('?utm_source=facebook&utm_medium=paid_social&utm_campaign=Winter%20Abaya', '', 'muslimabaya.com'), 'Facebook Ads · Winter Abaya');
  assert.equal(d('?utm_source=facebook&utm_medium=paid_social&utm_campaign=%7B%7Bcampaign.name%7D%7D', '', 'muslimabaya.com'), 'Facebook Ads');
  assert.equal(d('?utm_source=ig&utm_medium=paid', '', 'muslimabaya.com'), 'Instagram Ads');
  assert.equal(d('?fbclid=abc', '', 'muslimabaya.com'), 'Facebook');
  // what Meta adds by itself when an ad has no URL parameters: utm_source=fb|ig|msg|an, utm_medium=paid, utm_campaign=<campaign id>
  assert.equal(d('?utm_source=fb&utm_medium=paid&utm_campaign=120211234567890&utm_content=120211234567999', '', 'muslimabaya.com'), 'Facebook Ads · 120211234567890');
  assert.equal(d('?utm_source=ig&utm_medium=paid&utm_campaign=1202', '', 'muslimabaya.com'), 'Instagram Ads · 1202');
  assert.equal(d('?utm_source=msg&utm_medium=paid', '', 'muslimabaya.com'), 'Messenger Ads');
  assert.equal(d('?utm_source=an&utm_medium=paid', '', 'muslimabaya.com'), 'Audience Network Ads');
  assert.equal(d('', 'https://lm.facebook.com/l.php?u=x', 'muslimabaya.com'), 'Facebook');
  assert.equal(d('', 'https://www.tiktok.com/', 'muslimabaya.com'), 'TikTok');
  assert.equal(d('', 'https://muslimabaya.com/three-piece-dress', 'muslimabaya.com'), '');
  assert.equal(d('', '', 'muslimabaya.com'), '');
  assert.equal(d('?utm_source==HYPERLINK("x")', '', 'muslimabaya.com').charAt(0) === '=', false);
});

test('the landing page source is remembered for checkout, and forgotten after 30 days', () => {
  const st = {};
  load('?utm_source=facebook&utm_medium=paid_social&utm_campaign=Eid', '', st);
  assert.equal(st.ma_source, 'Facebook Ads · Eid');
  const later = load('', 'https://muslimabaya.com/product/x', st).win; // checkout: no utm, own referrer
  assert.equal(later.maOrderSource(), 'Facebook Ads · Eid');
  st.ma_source_at = String(Date.now() - 31 * 86400000);
  assert.equal(later.maOrderSource(), '');
  assert.equal(st.ma_source, undefined);
});

test('a later direct visit does not erase the ad source; a new ad click replaces it', () => {
  const st = {};
  load('?utm_source=facebook&utm_medium=paid_social&utm_campaign=A', '', st);
  load('', '', st);
  assert.equal(st.ma_source, 'Facebook Ads · A');
  load('?utm_source=tiktok&utm_medium=paid&utm_campaign=B', '', st);
  assert.equal(st.ma_source, 'TikTok Ads · B');
});

test('both checkouts send the remembered source', () => {
  const popup = fs.readFileSync(path.join(__dirname, '../../checkout-popup.js'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '../../checkout.html'), 'utf8');
  assert.match(popup, /window\.maOrderSource\(\)/);
  assert.match(page, /window\.maOrderSource\(\)/);
  const gs = fs.readFileSync(path.join(__dirname, '../../apps-script/Code.gs'), 'utf8');
  assert.match(gs, /var sourceVal = sanitizeCellText_\(param_\(e, 'Source'\)/);
});
