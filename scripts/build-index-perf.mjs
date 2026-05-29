import { execSync } from "child_process";
import fs from "fs";

const SRC = "7721f89";
let html = execSync(`git show ${SRC}:index.html`, {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});

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

// Head: fonts + perf CSS
html = html.replace(
  /<link rel="preload" as="image" href="images\/Baby-Pink-Floral-Print\.jpeg">/,
  '<link rel="preload" as="image" href="images/Baby-Pink-Floral-Print.jpeg" fetchpriority="high">'
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
html = html.replace(
  /site-footer\.css\?v=[^"]+/,
  "site-footer.css?v=20260531ft"
);
html = html.replace(
  /site-seo\.css\?v=[^"]+/,
  "site-seo.css?v=20260531b"
);
if (!html.includes("qty-stepper.css")) {
  html = html.replace(
    'site-seo.css?v=20260531b">',
    `site-seo.css?v=20260531b">
    <link rel="stylesheet" href="qty-stepper.css?v=20260531qty">
    <link rel="stylesheet" href="cart-drawer.css?v=20260528b">
    <link rel="stylesheet" href="index-critical.css?v=20260531perf">
    <link rel="preload" href="index-home.css?v=20260531perf" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="index-home.css?v=20260531perf"></noscript>`
  );
}

// Strip inline styles → external index-home.css (regenerate)
const styles = [];
html = html.replace(/<style>([\s\S]*?)<\/style>\s*/gi, (_, css) => {
  styles.push(css.trim());
  return "";
});
const homeCss =
  "/* Muslim Abaya homepage */\n\n" + styles.join("\n\n/* --- */\n\n");
fs.writeFileSync("index-home.css", homeCss, { encoding: "utf8" });

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

// Scripts: defer + catalog idle load
html = html.replace(
  /<link rel="stylesheet" href="cart-drawer\.css[^>]*>\s*/i,
  ""
);
html = html.replace(/<script src="cart-utils\.js/g, '<script defer src="cart-utils.js');
html = html.replace(/<script src="cart-drawer\.js/g, '<script defer src="cart-drawer.js');
html = html.replace(
  /<script src="product-config\.js[^>]*><\/script>\s*<script src="product-utils\.js[^>]*><\/script>\s*<script src="product-catalog-sections\.js[^>]*><\/script>\s*<script src="category-products\.js[^>]*><\/script>\s*<script src="product-links-data\.js[^>]*><\/script>\s*<script src="product-catalog-loader\.js[^>]*><\/script>/,
  '<script defer src="index-catalog-defer.js?v=20260531perf"></script>'
);
html = html.replace(
  /<script src="site-header\.js[^>]*><\/script>/,
  '<script defer src="site-header.js?v=20260531perf"></script>'
);
html = html.replace(/<script src="site-seo-config\.js/g, '<script defer src="site-seo-config.js');
html = html.replace(/<script src="site-seo\.js/g, '<script defer src="site-seo.js');
html = html.replace(/<script src="site-api-config\.js/g, '<script defer src="site-api-config.js');
html = html.replace(
  /<script src="site-footer\.js[^>]*><\/script>/,
  '<script defer src="site-footer.js?v=20260531fb1"></script>'
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

// Catalog refresh hook (before footer mounts block)
if (!html.includes("__homeRefreshCatalog")) {
  html = html.replace(
    /function removeFromCart\(productId\) \{[\s\S]*?\n\}\s*<\/script>\s*<div id="ma-social-connect-mount">/,
    (m) =>
      m.replace(
        "</script>\n<div id=\"ma-social-connect-mount\">",
        `}
window.hydrateHomeProducts = hydrateHomeProducts;
window.renderSidebar = renderSidebar;
window.selectProduct = selectProduct;
window.__homeRefreshCatalog = function () {
    hydrateHomeProducts();
    renderSidebar();
    if (products.length) {
        var idx = Math.min(currentIdx, products.length - 1);
        selectProduct(idx, products[idx].id, false);
    }
};
</script>

</div>
</div>
</div>
<div id="ma-social-connect-mount">`
      )
  );
}

if (!html.includes("index-youtube-lazy.js")) {
  html = html.replace(
    "</body>",
    '<script defer src="index-youtube-lazy.js?v=20260531perf"></script>\n</body>'
  );
}

fs.writeFileSync("index.html", html, { encoding: "utf8" });

let css = fs.readFileSync("index-home.css", "utf8");
css = css.replace(/\.price-tag::before\s*\{[\s\S]*?\}/, `.price-tag::before {
    content: "";
    display: none;
}`);
fs.writeFileSync("index-home.css", css, { encoding: "utf8" });

const bn = (html.match(/[\u0980-\u09FF]/g) || []).length;
const bad = (html.match(/\?\?\?/g) || []).length;
console.log("index.html Bengali:", bn, "???? blocks:", bad, "CSS bytes:", css.length);
if (bn < 800 || bad > 0) process.exit(1);
