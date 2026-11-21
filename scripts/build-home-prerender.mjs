// Cloudflare build step (run from scripts/build-cloudflare.mjs, before the asset-version step).
//
// The homepage product cards are the mobile LCP element, and they used to appear only after ~20 deferred
// scripts had downloaded and run. This step makes the first paint already contain them:
//   1. The three stylesheets the cards depend on (index-home-muslim-abaya.min.css, home-glass.css,
//      liquid-glass-ui.min.css) are inlined in place of their deferred <link>s, so prerendered cards are
//      styled on first paint (no unstyled flash, no layout shift).
//   2. The category rail (#homeCatnav) and the FIRST category section (#homeSections) are rendered with the
//      same code the browser uses (index-home-muslim-abaya.js via home-render.min.js) and written into the
//      page. When the scripts run, they re-render both with the same markup, so nothing moves.
//
// The repository copy of index.html is left as it is (readable <link>s, empty containers); only the
// deployed copy is changed. Run locally: node scripts/build-home-prerender.mjs [--out some.html]
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import os from 'node:os';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const outFile = outArg > -1 ? path.resolve(process.argv[outArg + 1]) : path.join(root, 'index.html');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const INLINE_CSS = ['index-home-muslim-abaya.min.css', 'home-glass.css', 'liquid-glass-ui.min.css'];
// Same order as the deferred catalog <script>s in index.html (network-only scripts left out).
const SCRIPTS = ['product-config.js', 'home-catalog-utils.min.js', 'size-core.js', 'size-storefront.js', 'category-products.js', 'product-links-data.js', 'home-render.min.js'];


export function renderHomeParts() {
  const noop = () => {};
  const el = () => ({style: {}, setAttribute: noop, appendChild: noop, addEventListener: noop, classList: {add: noop, remove: noop, contains: () => false}});
  const document = {
    readyState: 'loading', // keeps the renderer's boot() waiting; we call the prerender hook ourselves
    documentElement: {hasAttribute: () => false, getAttribute: () => null, setAttribute: noop, classList: {add: noop, remove: noop, contains: () => false}},
    head: el(), body: el(),
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    createElement: el, addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    cookie: '',
  };
  const storage = {getItem: () => null, setItem: noop, removeItem: noop};
  const ctx = {
    document, console,
    location: {protocol: 'https:', hostname: 'muslimabaya.com', host: 'muslimabaya.com', origin: 'https://muslimabaya.com', pathname: '/', search: '', hash: '', href: 'https://muslimabaya.com/'},
    navigator: {userAgent: 'node-prerender'}, localStorage: storage, sessionStorage: storage,
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: () => 0, addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    matchMedia: () => ({matches: false, addEventListener: noop, addListener: noop}),
    CustomEvent: function CustomEvent() {}, fetch: () => new Promise(noop),
    URL, URLSearchParams,
  };
  ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of SCRIPTS) vm.runInContext(read(f), ctx, {filename: f});
  if (typeof ctx.__maHomePrerender !== 'function') throw new Error('home-render.min.js has no __maHomePrerender hook (rebuild with scripts/build-home-speed.mjs)');
  const parts = ctx.__maHomePrerender();
  if (!parts || !parts.sections || !parts.catnav) throw new Error('Homepage prerender produced no sections');
  // No "Shop by category" tiles any more: the card deck at the top of the homepage replaced them (owner's choice, Nov 2026).
  return parts;
}

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function prerenderIndex(html, parts) {
  let out = html;
  for (const css of INLINE_CSS) {
    const re = new RegExp(`[ \\t]*<link rel="stylesheet" href="${escapeRegExp(css)}[^"]*" media="print" onload="this\\.media='all'">\\s*<noscript><link rel="stylesheet" href="${escapeRegExp(css)}[^"]*"></noscript>`);
    if (!re.test(out)) throw new Error('index.html: deferred link for ' + css + ' not found');
    const body = read(css).replace(/<\/style/gi, '<\\/style');
    out = out.replace(re, () => `    <style data-inline-from="${css}">${body}</style>`);
  }
  // The preload for the (now inlined) card stylesheet is no longer needed.
  out = out.replace(/[ \t]*<!-- Product cards render only after this stylesheet loads[^\n]*-->\n/, '');
  out = out.replace(/[ \t]*<link rel="preload" as="style" href="index-home-muslim-abaya\.min\.css[^"]*">\n/, '');
  const nav = '<nav id="homeCatnav" class="home-catnav" aria-label="Shop categories"></nav>';
  const main = '<main id="homeSections" class="home-sections"></main>';
  if (!out.includes(nav) || !out.includes(main)) throw new Error('index.html: empty #homeCatnav / #homeSections not found');
  out = out.replace(nav, () => nav.replace('></nav>', '>' + parts.catnav + '</nav>'));
  // The image-led category cards must be in the first HTML response. Injecting them after DOMContentLoaded
  // used to push the already-rendered first product section down by ~700px (CLS ~0.80 on mobile).
  out = out.replace(main, () => main.replace('></main>', ' data-prerendered="1">' + parts.sections + '</main>'));
  // Storyboard at the top: the newest products' card deck and list, with the first photo preloaded (mobile LCP).
  if (parts.story) {
    const st = parts.story;
    const deck = '<div class="ms-deck" aria-live="polite"></div>';
    const list = '<ol class="ms-list-items"></ol>';
    const board = '<div id="msBoard" class="ms-board" tabindex="-1">';
    if (!out.includes(deck) || !out.includes(list) || !out.includes(board)) throw new Error('index.html: empty storyboard (#msBoard) not found');
    const keyAttr = st.key.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    out = out.replace(board, () => `<div id="msBoard" class="ms-board is-ready" tabindex="-1" data-ms-key="${keyAttr}">`);
    out = out.replace(deck, () => deck.replace('></div>', '>' + st.deck + '</div>'));
    out = out.replace(list, () => list.replace('></ol>', '>' + st.list + '</ol>'));
    out = out.replace('<span class="ms-count">01 / 12</span>', () => `<span class="ms-count">${st.count}</span>`);
    const href = st.firstSrc.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    // Right after <meta viewport> at the very top of <head>, so the browser starts the photo before parsing
    // the large inlined CSS. Photos from the image host also get an early connection.
    const vp = '<meta name="viewport" content="width=device-width, initial-scale=1.0">';
    if (!out.includes(vp)) throw new Error('index.html: viewport meta not found');
    const host = /^https:\/\/[^/]+/.exec(st.firstSrc);
    out = out.replace(vp, () => vp + (host ? `\n    <link rel="preconnect" href="${host[0]}">` : '') + `\n    <link rel="preload" as="image" href="${href}" fetchpriority="high">`);
  }
  // The card button-row rules index-home-muslim-abaya.js injects at runtime (same id, so it is not added twice).
  if (parts.btnCss && !out.includes('id="ma-home-btn-row"')) out = out.replace('</head>', () => '<style id="ma-home-btn-row">' + parts.btnCss + '</style>\n</head>');
  return out;
}

// The first storyboard photo is the mobile LCP. When it lives on the image host, the phone first has to open a
// second connection (slow on 4G). At deploy time we copy that one photo next to the site (images/lcp/, not in
// git) and point the first card and its preload at the copy. If the download fails, the remote photo is kept.
export async function selfHostLcpPhoto(html, parts, {fetchImpl = globalThis.fetch, dir = path.join(root, 'images', 'lcp'), shrink = loadSharp} = {}) {
  const src = parts && parts.story && parts.story.firstSrc;
  if (!src || !/^https:\/\//.test(src) || typeof fetchImpl !== 'function') return html;
  let name = (src.split('?')[0].split('/').pop() || '').replace(/[^A-Za-z0-9._-]/g, '');
  if (!/\.(webp|avif|jpe?g|png)$/i.test(name)) return html;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetchImpl(src, {signal: ctrl.signal});
    clearTimeout(timer);
    const type = String(res.headers && res.headers.get ? res.headers.get('content-type') || '' : '');
    if (!res.ok || !/^image\//.test(type)) throw new Error('HTTP ' + res.status + ' ' + type);
    let buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500 || buf.length > 2000000) throw new Error('unexpected size ' + buf.length);
    const small = await shrinkForPhones(buf, shrink);
    if (small && small.length < buf.length) {
      console.log(`index.html prerender: LCP photo ${Math.round(buf.length / 1024)} KB -> ${Math.round(small.length / 1024)} KB (480 px wide)`);
      buf = small;
      name = name.replace(/\.(webp|avif|jpe?g|png)$/i, '') + '-480.webp';
    }
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, name), buf);
  } catch (e) {
    console.log('index.html prerender: LCP photo kept on the image host (' + String(e && e.message || e).slice(0, 120) + ')');
    return html;
  }
  const local = '/images/lcp/' + name;
  const esc = src.replace(/&/g, '&amp;');
  let out = html.replace(`<link rel="preload" as="image" href="${esc}" fetchpriority="high">`, () => `<link rel="preload" as="image" href="${local}" fetchpriority="high">`);
  out = out.replace(/<link rel="preconnect" href="https:\/\/[^"]+">\n\s*(?=<link rel="preload" as="image" href="\/images\/lcp\/)/, '');
  out = out.replace(`<a class='ms-card is-active'`, '\u0000').replace(/\u0000([^>]*><img src=')([^']+)'/, (m, mid, old) => `<a class='ms-card is-active'${mid}${old === src ? local : old}'`);
  console.log('index.html prerender: LCP photo served from ' + local);
  return out;
}

// sharp (free, open source) resizes the photo. It is not a site dependency, so the build installs it into a temp
// folder when it is missing. Any failure just keeps the original photo.
async function loadSharp() {
  try { return (await import('sharp')).default; } catch (e) { /* not installed */ }
  const prefix = path.join(os.tmpdir(), 'ma-build-sharp');
  try {
    const req = createRequire(path.join(prefix, 'package.json'));
    try { return req('sharp'); } catch (e) { /* install below */ }
    fs.mkdirSync(prefix, {recursive: true});
    execFileSync('npm', ['install', '--no-save', '--no-audit', '--no-fund', '--silent', '--prefix', prefix, 'sharp@0.34.4'], {stdio: 'ignore', timeout: 120000});
    return req('sharp');
  } catch (e) {
    console.log('index.html prerender: sharp not available (' + String(e && e.message || e).slice(0, 80) + ')');
    return null;
  }
}

async function shrinkForPhones(buf, shrink) {
  try {
    const sharp = typeof shrink === 'function' ? await shrink() : null;
    if (!sharp) return null;
    return await sharp(buf).resize({width: 480, withoutEnlargement: true}).webp({quality: 68, effort: 5}).toBuffer();
  } catch (e) {
    console.log('index.html prerender: could not shrink LCP photo (' + String(e && e.message || e).slice(0, 80) + ')');
    return null;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = read('index.html');
  if (html.includes('data-prerendered="1"')) {
    console.log('index.html is already prerendered; skipping.');
  } else {
    const parts = renderHomeParts();
    let out = prerenderIndex(html, parts);
    out = await selfHostLcpPhoto(out, parts);
    fs.writeFileSync(outFile, out);
    const cards = (parts.sections.match(/<article /g) || []).length;
    console.log(`index.html prerender: ${cards} cards in the first section, ${INLINE_CSS.length} stylesheets inlined, ${Buffer.byteLength(html)} -> ${Buffer.byteLength(out)} bytes -> ${path.relative(root, outFile)}`);
  }
}
