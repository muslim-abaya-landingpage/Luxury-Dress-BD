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
  out = out.replace(main, () => main.replace('></main>', ' data-prerendered="1">' + parts.sections + '</main>'));
  // The card button-row rules index-home-muslim-abaya.js injects at runtime (same id, so it is not added twice).
  if (parts.btnCss && !out.includes('id="ma-home-btn-row"')) out = out.replace('</head>', () => '<style id="ma-home-btn-row">' + parts.btnCss + '</style>\n</head>');
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = read('index.html');
  if (html.includes('data-prerendered="1"')) {
    console.log('index.html is already prerendered; skipping.');
  } else {
    const parts = renderHomeParts();
    const out = prerenderIndex(html, parts);
    fs.writeFileSync(outFile, out);
    const cards = (parts.sections.match(/<article /g) || []).length;
    console.log(`index.html prerender: ${cards} cards in the first section, ${INLINE_CSS.length} stylesheets inlined, ${Buffer.byteLength(html)} -> ${Buffer.byteLength(out)} bytes -> ${path.relative(root, outFile)}`);
  }
}
