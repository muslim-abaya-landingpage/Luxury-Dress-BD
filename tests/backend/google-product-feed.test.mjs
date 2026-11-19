// Google Merchant Center feed: same catalog as the Meta feed, served as RSS 2.0 + g: namespace XML,
// which is a format Google's Scheduled Fetch accepts. Free organic Google Shopping listing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const feedPath = path.join(root, 'google-product-feed.xml');

test('google-product-feed.xml: generator produces well-formed XML with every required g: field', () => {
  if (fs.existsSync(feedPath)) fs.unlinkSync(feedPath);
  const out = execFileSync('node', [path.join(root, 'scripts/build-google-product-feed.mjs')], { cwd: root, encoding: 'utf8' });
  assert.match(out, /Google product feed generated: \d+ products/);
  assert.ok(fs.existsSync(feedPath), 'wrote google-product-feed.xml');
  const xml = fs.readFileSync(feedPath, 'utf8');
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns:g="http:\/\/base\.google\.com\/ns\/1\.0"/);
  const items = xml.match(/<item>/g) || [];
  assert.ok(items.length >= 1, 'has at least one product');
  const firstItem = xml.slice(xml.indexOf('<item>'), xml.indexOf('</item>') + '</item>'.length);
  for (const tag of ['g:id', 'title', 'description', 'link', 'g:image_link', 'g:availability', 'g:price', 'g:condition', 'g:brand', 'g:product_type', 'g:identifier_exists']) {
    assert.match(firstItem, new RegExp('<' + tag + '>'), 'missing <' + tag + '> in first item');
  }
  assert.match(firstItem, /<g:price>[\d.]+ BDT<\/g:price>/, 'price carries the BDT currency code Google requires');
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|#)/, 'unescaped ampersand would break XML parsing');
});

test('google-product-feed.xml: every item link points at a real product page on the live domain', () => {
  const xml = fs.readFileSync(feedPath, 'utf8');
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const links = itemBlocks.map(block => (block.match(/<link>([^<]+)<\/link>/) || [])[1]);
  assert.ok(links.length >= 1);
  for (const link of links) assert.match(link, /^https:\/\/muslimabaya\.com\/product\/[^/]+$/);
});
