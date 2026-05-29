import fs from "fs";

const htmlPath = "index.html";
let html = fs.readFileSync(htmlPath, "utf8");

const re = /<style>([\s\S]*?)<\/style>/g;
const parts = [];
let m;
while ((m = re.exec(html)) !== null) parts.push(m[1].trim());

const css =
  "/* Muslim Abaya homepage — extracted from index.html */\n\n" +
  parts.join("\n\n/* --- */\n\n");
fs.writeFileSync("index-home.css", css, "utf8");

html = html.replace(re, "");

const perfLinks =
  '    <link rel="stylesheet" href="index-critical.css?v=20260531perf">\n' +
  '    <link rel="preload" href="index-home.css?v=20260531perf" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">\n' +
  '    <noscript><link rel="stylesheet" href="index-home.css?v=20260531perf"></noscript>\n';

if (!html.includes("index-critical.css")) {
  html = html.replace(
    '<link rel="stylesheet" href="qty-stepper.css?v=20260531qty">',
    '<link rel="stylesheet" href="qty-stepper.css?v=20260531qty">\n' + perfLinks
  );
}

html = html.replace(
  /family=Hind\+Siliguri[^"']*Poppins[^"']*/g,
  "family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;500;600;700"
);

html = html.replace(
  /<div class="lux-video-ratio">\s*<iframe[\s\S]*?<\/iframe>\s*<\/div>/,
  `<div class="lux-video-ratio" id="luxVideoEmbed" data-video-id="Wyrw0gzKMqk">
                <button type="button" class="lux-video-facade" aria-label="Play video">
                    <img src="https://i.ytimg.com/vi/Wyrw0gzKMqk/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async">
                    <span class="lux-video-play" aria-hidden="true"></span>
                </button>
            </div>`
);

html = html.replace(
  /<script defer src="product-config\.js[^>]*><\/script>\s*<script defer src="product-utils\.js[^>]*><\/script>\s*<script defer src="product-catalog-sections\.js[^>]*><\/script>\s*<script defer src="category-products\.js[^>]*><\/script>\s*<script defer src="product-links-data\.js[^>]*><\/script>\s*<script defer src="product-catalog-loader\.js[^>]*><\/script>/,
  '<script defer src="index-catalog-defer.js?v=20260531perf"></script>'
);

html = html.replace(
  /<link rel="stylesheet" href="cart-drawer\.css[^>]*>\s*<link rel="stylesheet" href="qty-stepper\.css[^>]*>\s*(?=<script defer src="cart-utils)/,
  ""
);

html = html.replace(
  /    \/\* Footer styles: site-footer\.css\?v=20260531ft"ma-social-connect-mount"><\/div>/,
  "    /* Footer styles: site-footer.css */\n</style>\n<div id=\"ma-social-connect-mount\"></div>"
);

if (!html.includes("index-youtube-lazy.js")) {
  html = html.replace(
    "</body>",
    '<script defer src="index-youtube-lazy.js?v=20260531perf"></script>\n</body>'
  );
}

if (!html.includes('href="cart-drawer.css')) {
  html = html.replace(
    '<link rel="stylesheet" href="qty-stepper.css?v=20260531qty">',
    '<link rel="stylesheet" href="qty-stepper.css?v=20260531qty">\n    <link rel="stylesheet" href="cart-drawer.css?v=20260528b">'
  );
}

fs.writeFileSync(htmlPath, html, "utf8");
console.log("OK:", parts.length, "style blocks →", css.length, "bytes CSS");
