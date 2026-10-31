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
  assert.ok(parts.btnCss.includes('.ah-card .ah-actions'));
});

test('prerenderIndex inlines the card CSS and fills the empty containers once', async () => {
  const { renderHomeParts, prerenderIndex } = await load();
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const out = prerenderIndex(html, renderHomeParts());
  for (const css of ['index-home-muslim-abaya.min.css', 'home-glass.css', 'liquid-glass-ui.min.css']) {
    assert.ok(out.includes(`<style data-inline-from="${css}">`), css + ' inlined');
    assert.ok(!new RegExp(`<link rel="stylesheet" href="${css.replace(/\./g, '\\.')}`).test(out), css + ' link removed');
  }
  assert.equal((out.match(/data-prerendered="1"/g) || []).length, 1);
  assert.equal((out.match(/id="ma-home-btn-row"/g) || []).length, 1);
  assert.ok(!out.includes('<main id="homeSections" class="home-sections"></main>'));
  assert.ok(!out.includes('<nav id="homeCatnav" class="home-catnav" aria-label="Shop categories"></nav>'));
  assert.ok(out.includes('home-render.min.js'), 'renderer script still loads');
});

test('Cloudflare build runs the prerender before content versioning', () => {
  const build = fs.readFileSync(path.join(root, 'scripts/build-cloudflare.mjs'), 'utf8');
  const a = build.indexOf('scripts/build-home-prerender.mjs');
  const b = build.indexOf('scripts/build-catalog-asset-versions.mjs');
  assert.ok(a > -1 && a < b);
});
