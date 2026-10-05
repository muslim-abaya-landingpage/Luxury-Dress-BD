import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileNetlifyHeaders } from './prepare-netlify-headers.mjs';

const source = await readFile(new URL('../_headers', import.meta.url), 'utf8');
const cases = {
  '/': 'public, max-age=0, must-revalidate',
  '/checkout': 'public, max-age=0, must-revalidate',
  '/index.html': 'public, max-age=300, must-revalidate',
  '/site-header.js': 'public, max-age=31536000, immutable',
  '/category-products.js': 'public, max-age=300, must-revalidate',
  '/product-catalog-sections.js': 'public, max-age=300, must-revalidate',
  '/product-links-data.js': 'public, max-age=300, must-revalidate',
  '/product-config.js': 'public, max-age=300, must-revalidate',
  '/site-footer.css': 'public, max-age=31536000, immutable',
  '/images/product.webp': 'public, max-age=31536000, immutable',
  '/images/gallery/product.webp': 'public, max-age=86400, must-revalidate',
  '/assets/logo.svg': 'public, max-age=31536000, immutable',
  '/fonts/body.woff2': 'public, max-age=31536000, immutable'
};
const output = compileNetlifyHeaders(source, Object.keys(cases));

test('Netlify output preserves the existing cache policy without conflicting matches', () => {
  const blocks = output.split(/\n\s*\n/).filter(block => !block.startsWith('#'));
  for (const [path, expected] of Object.entries(cases)) {
    const caches = blocks.flatMap(block => {
      const [pattern, ...headers] = block.split('\n');
      const regex = new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*') + '$');
      return regex.test(path) ? headers.filter(value => /^\s*Cache-Control:/.test(value)) : [];
    });
    assert.deepEqual(caches, [`  Cache-Control: ${expected}`], path);
  }
});

test('Netlify output removes detach syntax and retains all security and metadata headers', () => {
  assert.doesNotMatch(output, /^\s*!\s/m);
  for (const line of source.split(/\r?\n/)) {
    if (/^\s+[^!].*:\s/.test(line) && !/Cache-Control:/i.test(line)) {
      assert.ok(output.includes(line), line);
    }
  }
  assert.equal(compileNetlifyHeaders(source, Object.keys(cases)), output);
});

test('unsupported or malformed header rules fail rather than silently dropping protections', () => {
  assert.throws(() => compileNetlifyHeaders('/*\n  ! X-Frame-Options\n', ['/']), /Unsupported non-cache detach/);
  assert.throws(() => compileNetlifyHeaders('/*\n  broken header\n', ['/']), /Invalid header/);
});
