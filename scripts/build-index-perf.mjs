import { execSync, spawnSync } from "child_process";
import fs from "fs";

const SRC = "7721f89";
const VER = "20260530sale";
const FOOTER_JS = "site-footer.js?v=20260629post";
const FOOTER_CSS = "site-footer.css?v=20260530ft3";

function deferCss(href) {
  return (
    `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">\n` +
    `    <noscript><link rel="stylesheet" href="${href}"></noscript>`
  );
}

let html = execSync(`git show ${SRC}:index.html`, {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
}).replace(/^\uFEFF/, "");

const bnBefore = (html.match(/[\u0980-\u09FF]/g) || []).length;
if (bnBefore < 800) {
  console.error("Source commit missing Bengali text:", bnBefore);
  process.exit(1);
}

// Remove blocking GTM in head
html = html.replace(
  /<script>\(function\(w,d,s,l,i\)[\s\S]*?GTM-ML7RL6BR'\);<\/script>\s*/i,
  ""
);

// Head: fonts + perf CSS (only header + critical block render)
html = html.replace(
  /<link rel="preload" as="image" href="images\/Baby-Pink-Floral-Print\.jpeg">/,
  `<link rel="preload" as="image" href="images/Baby-Pink-Floral-Print.jpeg" fetchpriority="high">
    <link rel="preload" as="image" href="assets/logo-muslim-abaya.svg" type="image/svg+xml">`
);
html = html.replace(
  /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Hind\+Siliguri[^>]+>\s*<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Poppins[^>]+>/,
  `<link rel="preload" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"></noscript>`
);
html = html.replace(
  /<link rel="stylesheet" href="site-header\.css\?v=[^"]+">/,
  `<link rel="preload" href="site-header.css?v=20260531logo" as="style">
    <link rel="stylesheet" href="site-header.css?v=20260531logo">`
);
html = html.replace(/site-footer\.css\?v=[^"]+/, `site-footer.css?v=${FOOTER_CSS}`);
html = html.replace(/site-seo\.css\?v=[^"]+/, `site-seo.css?v=${VER}`);

if (!html.includes("index-critical.css")) {
  html = html.replace(
    `site-seo.css?v=${VER}">`,
    `site-seo.css?v=${VER}">
    ${deferCss(`site-footer.css?v=${FOOTER_CSS}`)}
    ${deferCss(`site-seo.css?v=${VER}`)}
    ${deferCss(`qty-stepper.css?v=${VER}`)}
    ${deferCss("cart-drawer.css?v=20260528b")}
    <link rel="stylesheet" href="index-critical.css?v=${VER}">
    <link rel="preload" href="index-home.css?v=${VER}" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="index-home.css?v=${VER}"></noscript>`
  );
  // site-seo was duplicated — remove blocking duplicate, keep deferred only
  html = html.replace(
    new RegExp(`<link rel="stylesheet" href="site-seo\\.css\\?v=${VER}">\\s*`),
    ""
  );
  html = html.replace(
    new RegExp(`<link rel="stylesheet" href="site-footer\\.css\\?v=${FOOTER_CSS}">\\s*`),
    ""
  );
}

// Strip inline styles → external index-home.css (skip if already extracted — preserves sale-badge etc.)
const skipHomeCss = fs.existsSync("index-home.css");
if (!skipHomeCss) {
  const styles = [];
  html = html.replace(/<style>([\s\S]*?)<\/style>\s*/gi, (_, css) => {
    styles.push(css.trim());
    return "";
  });
  const homeCss =
    "/* Muslim Abaya homepage */\n\n" + styles.join("\n\n/* --- */\n\n");
  fs.writeFileSync("index-home.css", homeCss, { encoding: "utf8" });
} else {
  html = html.replace(/<style>([\s\S]*?)<\/style>\s*/gi, "");
}

// YouTube click-to-load
html = html.replace(
  /<div class="lux-video-ratio">\s*<iframe[\s\S]*?<\/iframe>\s*<\/div>/,
  `<div class="lux-video-ratio" id="luxVideoEmbed" data-video-id="Wyrw0gzKMqk">
                <button type="button" class="lux-video-facade" aria-label="ভিডিও চালু করুন">
                    <img src="https://i.ytimg.com/vi/Wyrw0gzKMqk/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async">
                    <span class="lux-video-play" aria-hidden="true"></span>
                </button>
            </div>`
);

// Hero product before video — LCP image earlier in DOM
const videoRe = /<section id="main-video-section"[\s\S]*?<\/section>\s*/;
const videoMatch = html.match(videoRe);
if (videoMatch) {
  const videoBlock = videoMatch[0];
  html = html.replace(videoRe, "");
  html = html.replace(
    /(<div id="ma-social-connect-mount">)/,
    videoBlock + "\n$1"
  );
}

// Scripts: defer + catalog idle load (remove body cart-drawer link only)
html = html.replace(
  /<link rel="stylesheet" href="cart-drawer\.css[^>]*>\s*(?=<script defer src="cart-utils)/i,
  ""
);
html = html.replace(/<script src="cart-utils\.js/g, '<script defer src="cart-utils.js');
html = html.replace(/<script src="cart-drawer\.js/g, '<script defer src="cart-drawer.js');
html = html.replace(
  /<script src="product-config\.js[^>]*><\/script>\s*<script src="product-utils\.js[^>]*><\/script>\s*<script src="product-catalog-sections\.js[^>]*><\/script>\s*<script src="category-products\.js[^>]*><\/script>\s*<script src="product-links-data\.js[^>]*><\/script>\s*<script src="product-catalog-loader\.js[^>]*><\/script>/,
  `<script defer src="index-catalog-defer.js?v=${VER}"></script>`
);
html = html.replace(
  /<script src="site-header\.js[^>]*><\/script>/,
  `<script defer src="site-header.js?v=20260531nav"></script>`
);
html = html.replace(/<script src="site-seo-config\.js/g, '<script defer src="site-seo-config.js');
html = html.replace(/<script src="site-seo\.js/g, '<script defer src="site-seo.js');
html = html.replace(/<script src="site-api-config\.js/g, '<script defer src="site-api-config.js');
html = html.replace(
  /<script src="site-footer\.js[^>]*><\/script>/,
  `<script defer src="site-footer.js?v=${FOOTER_JS}"></script>`
);

// Currency in dynamic cards
html = html.replace(
  /<span class="product-card-price">\$\{p\.price\}<\/span>/,
  '<span class="product-card-price">৳${p.price}</span>'
);
html = html.replace(
  /<span class="product-card-price">\?/g,
  '<span class="product-card-price">৳'
);

// Viewport — zoom allowed (PageSpeed a11y)
html = html.replace(
  /<meta name="viewport" content="[^"]*">/,
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
);

// Hero LCP — sync decode, no lazy swap on first paint
html = html.replace(
  /(<img id="view"[\s\S]*?)decoding="async"/,
  '$1decoding="sync"'
);

// Defer non-critical CSS (footer, seo, cards)
for (const base of ["site-footer", "site-seo", "index-home-cards"]) {
  const re = new RegExp(
    `<link rel="stylesheet" href="${base}\\.css\\?v=[^"]+">\\s*`,
    "g"
  );
  html = html.replace(re, "");
}
if (!html.includes("index-home-cards.css")) {
  html = html.replace(
    /(<link rel="stylesheet" href="index-critical\.css[^>]+>)/,
    `$1\n    ${deferCss(`index-home-cards.css?v=${VER}`)}`
  );
}
html = html.replace(
  /(<link rel="stylesheet" href="index-critical\.css[^>]+>)/,
  (m) => {
    if (html.includes("site-footer.css")) return m;
    return (
      `${deferCss(`site-footer.css?v=${VER}`)}\n    ${deferCss(`site-seo.css?v=${VER}`)}\n    ${m}`
    );
  }
);

// Sales sticky bar removed — footer flows directly after social connect

// Extract large inline catalog script
const mainScriptRe =
  /<script>\s*\nlet currentIdx = 0;[\s\S]*?function removeFromCart\(productId\) \{[\s\S]*?\n\}\s*\n<\/script>/;
const scriptMatch = html.match(mainScriptRe);
const skipHomeAppExtract = fs.existsSync("index-home-app.js");
if (scriptMatch && !skipHomeAppExtract) {
  let js = scriptMatch[0].replace(/^<script>\s*/, "").replace(/\s*<\/script>$/, "");
  js +=
    "\nwindow.hydrateHomeProducts = hydrateHomeProducts;\n" +
    "window.renderSidebar = renderSidebar;\n" +
    "window.selectProduct = selectProduct;\n" +
    "window.__homeRefreshCatalog = function () {\n" +
    "    hydrateHomeProducts();\n" +
    "    renderSidebar();\n" +
    "    if (products.length) {\n" +
    "        var idx = Math.min(currentIdx, products.length - 1);\n" +
    "        selectProduct(idx, products[idx].id, false);\n" +
    "    }\n" +
    "};\n";
  fs.writeFileSync("index-home-app.js", js, { encoding: "utf8" });
  html = html.replace(
    mainScriptRe,
    `<script defer src="index-home-app.js?v=${VER}"></script>`
  );
} else if (skipHomeAppExtract) {
  html = html.replace(mainScriptRe, "");
  if (!html.includes("index-home-app.js")) {
    html = html.replace(
      /<script defer src="index-catalog-defer\.js[^>]+><\/script>/,
      `$&\n<script defer src="index-home-app.js?v=${VER}"></script>`
    );
  }
  html = html.replace(/index-home-app\.js\?v=[^"]+/g, `index-home-app.js?v=${VER}`);
}

if (!html.includes("index-youtube-lazy.js")) {
  html = html.replace(
    "</body>",
    `<script defer src="index-youtube-lazy.js?v=${VER}"></script>\n</body>`
  );
}

// Bump remaining cache query strings
html = html.replace(/index-catalog-defer\.js\?v=[^"]+/g, `index-catalog-defer.js?v=${VER}`);
html = html.replace(/index-youtube-lazy\.js\?v=[^"]+/g, `index-youtube-lazy.js?v=${VER}`);
html = html.replace(/index-critical\.css\?v=[^"]+/g, `index-critical.css?v=${VER}`);
html = html.replace(/index-home\.css\?v=[^"]+/g, `index-home.css?v=${VER}`);

// Font Awesome loads idle via index-catalog-defer.js (not render-blocking)
html = html.replace(
  /\n<link rel="stylesheet" href="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome[^>]+>\s*/i,
  "\n"
);

fs.writeFileSync("index.html", html.replace(/^\uFEFF/, ""), { encoding: "utf8" });

if (!skipHomeCss) {
  let css = fs.readFileSync("index-home.css", "utf8");
  css = css.replace(/\.price-tag::before\s*\{[\s\S]*?\}/, `.price-tag::before {
    content: "";
    display: none;
}`);
  fs.writeFileSync("index-home.css", css, { encoding: "utf8" });
}

const bn = (html.match(/[\u0980-\u09FF]/g) || []).length;
const bad = (html.match(/\?\?\?/g) || []).length;
console.log("index.html Bengali:", bn, "???? blocks:", bad, "skipHomeCss:", skipHomeCss);
console.log("video after product:", html.indexOf("premium-collection") < html.indexOf("main-video-section"));
if (bn < 800 || bad > 0) process.exit(1);

spawnSync(process.execPath, ["scripts/patch-index-ascii.mjs"], {
  stdio: "inherit",
  cwd: process.cwd(),
});
