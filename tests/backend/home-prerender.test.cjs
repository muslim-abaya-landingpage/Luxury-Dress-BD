// scripts/build-home-prerender.mjs: the deployed homepage arrives with the category rail and the start of the
// first section already rendered (mobile LCP), with the card stylesheets inlined so nothing shifts.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const load = () => import(path.join(root, 'scripts/build-home-prerender.mjs'));

test('prerender renders the first section with the browser renderer', async () => {
  const { renderHomeParts } = await load();
  const parts = renderHomeParts();
  const sections = parts.sections.match(/<section class='home-section'/g) || [];
  assert.equal(sections.length, 1);
  const cards = parts.sections.match(/<article /g) || [];
  assert.ok(cards.length >= 1 && cards.length <= 6, 'between 1 and 6 cards, got ' + cards.length);
  assert.match(parts.sections, /fetchpriority='high'/, 'first card keeps its high fetch priority');
  assert.match(parts.catnav, /class='home-catnav-inner'/);
  assert.ok(parts.btnCss.includes('.ah-card .ah-card-bottom'));
  // "Shop by category" tiles were removed from the homepage (the card deck at the top replaced them).
  assert.equal(parts.categoryTiles, undefined);
});

test('prerenderIndex inlines the card CSS and fills the empty containers once', async () => {
  const { renderHomeParts, prerenderIndex } = await load();
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const out = prerenderIndex(html, renderHomeParts());
  for (const css of ['index-home-muslim-abaya.min.css', 'home-glass.css', 'liquid-glass-ui.min.css']) {
    assert.ok(out.includes(`<style data-inline-from="${css}">`), css + ' inlined');
    assert.ok(!out.includes(`<link rel="stylesheet" href="${css}`), css + ' link removed');
  }
  assert.equal((out.match(/data-prerendered="1"/g) || []).length, 1);
  assert.equal((out.match(/id="ma-home-btn-row"/g) || []).length, 1);
  assert.ok(!out.includes('<main id="homeSections" class="home-sections"></main>'));
  assert.ok(!out.includes('id="ma-image-category-grid"'), 'no Shop by category tiles on the homepage');
  assert.ok(!out.includes('home-category-tiles.js'), 'tile script no longer loaded');
  assert.ok(!out.includes('<nav id="homeCatnav" class="home-catnav" aria-label="Shop categories"></nav>'));
  assert.ok(out.includes('home-render.min.js'), 'renderer script still loads');
});

test('homepage hides the redundant category rail and uses one customer-focused announcement', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const config = fs.readFileSync(path.join(root, 'site-header-config.js'), 'utf8');
  const header = fs.readFileSync(path.join(root, 'site-header.js'), 'utf8');
  assert.ok(html.includes('#homeCatnav{display:none!important}'));
  assert.match(config, /announcements:\s*\[\s*"💳 Cash on Delivery Available Across Bangladesh"/);
  assert.ok(header.includes('"💳 Cash on Delivery Available Across Bangladesh"'));
  assert.doesNotMatch(config, /PREMIUM MODEST WEAR|Premium Modest Fashion/);
});

test('Cloudflare build runs the prerender before content versioning', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build-cloudflare.mjs'), 'utf8');
  const a = build.indexOf('scripts/build-home-prerender.mjs');
  const b = build.indexOf('scripts/build-catalog-asset-versions.mjs');
  assert.ok(a > -1 && a < b);
});

test('storyboard deck is in the first HTML and its first photo is preloaded (mobile LCP)', async () => {
  const { renderHomeParts, prerenderIndex } = await load();
  const parts = renderHomeParts();
  assert.ok(parts.story && parts.story.deck, 'story parts rendered');
  const out = prerenderIndex(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), parts);
  const cards = out.match(/<a class='ms-card[^']*'/g) || [];
  assert.ok(cards.length >= 2 && cards.length <= 12, 'deck cards: ' + cards.length);
  assert.equal(cards[0], "<a class='ms-card is-active'");
  assert.match(out, /<div id="msBoard" class="ms-board is-ready" tabindex="-1" data-ms-key="[^"]+">/);
  const firstImg = out.match(/<a class='ms-card is-active'[^>]*><img src='([^']+)'[^>]*fetchpriority='high'/);
  assert.ok(firstImg, 'first deck photo has fetchpriority=high');
  const pre = out.match(/<link rel="preload" as="image" href="([^"]+)" fetchpriority="high">/g) || [];
  assert.equal(pre.length, 1, 'exactly one image preload');
  assert.ok(pre[0].includes(firstImg[1].replace(/&/g, '&amp;')), 'the preload is the first deck photo');
  assert.doesNotMatch(out, /<link rel="preload" as="image"[^>]*Maroon%20Abaya%20Set/, 'old banner photo is no longer preloaded');
});

test('the first storyboard photo is copied next to the site at deploy time (no second connection)', async () => {
  const { renderHomeParts, prerenderIndex, selfHostLcpPhoto } = await load();
  const os = require('node:os');
  const parts = renderHomeParts();
  const remote = 'https://images.muslimabaya.com/images/uploads/test-card.webp';
  parts.story.firstSrc = remote;
  parts.story.deck = parts.story.deck.replace(/(<a class='ms-card is-active'[^>]*><img src=')[^']+'/, `$1${remote}'`);
  const html = prerenderIndex(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), parts);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-'));
  const okFetch = async () => ({ ok: true, status: 200, headers: { get: () => 'image/webp' }, arrayBuffer: async () => new Uint8Array(4000).buffer });
  const out = await selfHostLcpPhoto(html, parts, { fetchImpl: okFetch, dir });
  assert.ok(fs.existsSync(path.join(dir, 'test-card.webp')));
  assert.match(out, /<link rel="preload" as="image" href="\/images\/lcp\/test-card\.webp" fetchpriority="high">/);
  assert.match(out, /<a class='ms-card is-active'[^>]*><img src='\/images\/lcp\/test-card\.webp'/);
  assert.doesNotMatch(out, /<link rel="preconnect"[^>]*>\s*<link rel="preload" as="image" href="\/images\/lcp/);
  // download fails: page is unchanged (remote photo kept)
  const badFetch = async () => ({ ok: false, status: 404, headers: { get: () => 'text/html' } });
  assert.equal(await selfHostLcpPhoto(html, parts, { fetchImpl: badFetch, dir }), html);
});
