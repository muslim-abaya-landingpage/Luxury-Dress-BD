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
  assert.match(parts.sections, /fetchpriority='high'/, 'first section card keeps its high fetch priority');
  assert.match(parts.storyDeck, /class='ms-card is-active'/, 'first storyboard card is active in the initial HTML');
  assert.equal((parts.storyDeck.match(/fetchpriority='high'/g) || []).length, 2, 'active and previous visible storyboard images are eager and high priority');
  assert.match(parts.storyDeck, /class='ms-card is-prev'/, 'last card is pre-positioned as the visible previous card');
  assert.match(parts.storyList, /class='ms-li is-active'/, 'first storyboard list item is active');
  assert.ok(parts.storyKey && parts.storyLcp && parts.storyPrevLcp, 'storyboard identity and both visible image URLs are derived from the catalog');
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
  assert.equal((out.match(/data-prerendered="1"/g) || []).length, 2, 'storyboard and first category section are both prerendered');
  assert.equal((out.match(/id="ma-home-btn-row"/g) || []).length, 1);
  assert.ok(!out.includes('<main id="homeSections" class="home-sections"></main>'));
  assert.ok(out.includes('data-story-key="' + renderHomeParts().storyKey + '"'));
  const rendered = renderHomeParts();
  assert.ok(out.includes('href="' + rendered.storyLcp + '" fetchpriority="high"'), 'preload matches the active storyboard image');
  assert.ok(out.includes('href="' + rendered.storyPrevLcp + '" fetchpriority="high"'), 'preload matches the visible previous storyboard image');
  assert.ok(out.includes("<a class='ms-card is-active'"), 'first storyboard image is present in the initial HTML');
  assert.ok(!out.includes('<div class="ms-deck" aria-live="polite"></div>'));
  assert.ok(!out.includes('<ol class="ms-list-items"></ol>'));
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
  const a = build.indexOf('scripts/build-home-speed.mjs');
  const b = build.indexOf('scripts/build-home-prerender.mjs');
  const d = build.indexOf('scripts/build-catalog-asset-versions.mjs');
  assert.ok(a > -1 && a < b && b < d);
});
