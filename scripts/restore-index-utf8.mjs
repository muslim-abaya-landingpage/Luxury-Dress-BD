import { execSync } from "child_process";
import fs from "fs";

const good = execSync("git show 7721f89:index.html", {
  encoding: "utf8",
  maxBuffer: 15 * 1024 * 1024,
});
const cur = fs.readFileSync("index.html", "utf8");

function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1] : "";
}

function extractHeadPerf(html) {
  const lines = [];
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] || "";
  for (const pat of [
    /index-critical\.css[^"']*/,
    /index-home\.css[^"']*/,
    /cart-drawer\.css[^"']*/,
    /qty-stepper\.css[^"']*/,
    /fetchpriority="high"/,
    /20260531logo/,
    /20260531perf/,
    /fonts\.googleapis\.com\/css2\?family=Hind\+Siliguri[^"']+/,
  ]) {
    if (pat.test(head)) lines.push("has:" + pat.source);
  }
  return head;
}

// Take good UTF-8 body text blocks by replacing corrupted sections in current file
// Strategy: use good file as base, re-apply perf head + structure from current

let out = good;

// --- Head: perf links (from current pattern) ---
out = out.replace(
  /<link rel="stylesheet" href="site-header\.css\?v=[^"]+">/,
  '<link rel="stylesheet" href="site-header.css?v=20260531logo">'
);
out = out.replace(
  /<link rel="preload" href="site-header\.css[^>]+>\s*/i,
  '<link rel="preload" href="site-header.css?v=20260531logo" as="style">\n    '
);
if (!out.includes("index-critical.css")) {
  out = out.replace(
    '<link rel="stylesheet" href="qty-stepper.css?v=20260531qty">',
    `<link rel="stylesheet" href="qty-stepper.css?v=20260531qty">
    <link rel="stylesheet" href="cart-drawer.css?v=20260528b">
    <link rel="stylesheet" href="index-critical.css?v=20260531perf">
    <link rel="preload" href="index-home.css?v=20260531perf" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link rel="stylesheet" href="index-home.css?v=20260531perf"></noscript>`
  );
}
out = out.replace(
  /family=Hind\+Siliguri[^"']*Poppins[^"']*/g,
  "family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;500;600;700"
);
out = out.replace(
  /<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]+rel="stylesheet">/,
  `<link rel="preload" href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"></noscript>`
);
if (!out.includes('fetchpriority="high"')) {
  out = out.replace(
    'href="images/Baby-Pink-Floral-Print.jpeg"',
    'href="images/Baby-Pink-Floral-Print.jpeg" fetchpriority="high"'
  );
}
// Remove blocking GTM from head if still present
out = out.replace(
  /<script>\(function\(w,d,s,l,i\)[\s\S]*?GTM-ML7RL6BR'\);<\/script>\s*/i,
  ""
);

// Remove all inline <style> blocks
out = out.replace(/<style>[\s\S]*?<\/style>\s*/gi, "");

// YouTube facade
out = out.replace(
  /<div class="lux-video-ratio">\s*<iframe[\s\S]*?<\/iframe>\s*<\/div>/,
  `<div class="lux-video-ratio" id="luxVideoEmbed" data-video-id="Wyrw0gzKMqk">
                <button type="button" class="lux-video-facade" aria-label="Play video">
                    <img src="https://i.ytimg.com/vi/Wyrw0gzKMqk/hqdefault.jpg" alt="" width="480" height="360" loading="lazy" decoding="async">
                    <span class="lux-video-play" aria-hidden="true"></span>
                </button>
            </div>`
);

// Defer catalog scripts
out = out.replace(
  /<script src="product-config\.js[^>]*><\/script>\s*<script src="product-utils\.js[^>]*><\/script>\s*<script src="product-catalog-sections\.js[^>]*><\/script>\s*<script src="category-products\.js[^>]*><\/script>\s*<script src="product-links-data\.js[^>]*><\/script>\s*<script src="product-catalog-loader\.js[^>]*><\/script>/,
  '<script defer src="index-catalog-defer.js?v=20260531perf"></script>'
);
out = out.replace(/<script src="cart-utils\.js/g, '<script defer src="cart-utils.js');
out = out.replace(/<script src="cart-drawer\.js/g, '<script defer src="cart-drawer.js');
out = out.replace(
  /<link rel="stylesheet" href="cart-drawer\.css[^>]*>\s*(?=<script defer src="cart-utils)/,
  ""
);

// site-header defer + version
out = out.replace(
  /<script src="site-header\.js[^>]*><\/script>/,
  '<script defer src="site-header.js?v=20260531perf"></script>'
);
out = out.replace(
  /<script src="site-seo-config\.js/g,
  '<script defer src="site-seo-config.js'
);
out = out.replace(
  /<script src="site-seo\.js/g,
  '<script defer src="site-seo.js'
);
out = out.replace(
  /<script src="site-api-config\.js/g,
  '<script defer src="site-api-config.js'
);
out = out.replace(
  /<script src="site-footer\.js/g,
  '<script defer src="site-footer.js'
);

// Footer mount (no separate social follow strip)
if (!out.includes("site-footer-mount")) {
  out = out.replace(
    /<div id="videoModal"/,
    `<div id="site-footer-mount"></div>

<div id="videoModal"`
  );
}

// Home catalog refresh hook before closing main script
if (!out.includes("__homeRefreshCatalog")) {
  out = out.replace(
    /}\s*<\/script>\s*<style>\s*\.announcement-slider/,
    `}
window.hydrateHomeProducts = hydrateHomeProducts;
window.renderSidebar = renderSidebar;
window.selectProduct = selectProduct;
window.__homeRefreshCatalog = function () {
    hydrateHomeProducts();
    renderSidebar();
    if (products.length) selectProduct(Math.min(currentIdx, products.length - 1), products[Math.min(currentIdx, products.length - 1)].id, false);
};
</script>
<style>
.announcement-slider`
  );
}

// Enhanced updateCartIcon in inline script (before changeProduct)
const cartIconFix = `function updateCartIcon(total) {
    if (typeof window.updateCartBadge === 'function') {
        window.updateCartBadge();
        return;
    }
    const cartBadge = document.getElementById('cart-count');
    if (cartBadge) {
        if (total > 0) {
            cartBadge.innerText = total;
            cartBadge.style.display = 'flex';
            cartBadge.classList.remove('cart-animate');
            void cartBadge.offsetWidth;
            cartBadge.classList.add('cart-animate');
        } else {
            cartBadge.style.display = 'none';
        }
    }
}`;

out = out.replace(
  /function updateCartIcon\(total\) \{[\s\S]*?\}\s*function changeProduct/,
  cartIconFix + "\nfunction changeProduct"
);

if (!out.includes("index-youtube-lazy.js")) {
  out = out.replace(
    "</body>",
    '<script defer src="index-youtube-lazy.js?v=20260531perf"></script>\n</body>'
  );
}

out = out.replace(/^\uFEFF/, "");
out = out.replace(/^<!DOCTYPE html>\s*<html/, '<!DOCTYPE html>\n<html lang="bn" data-seo-managed="full">\n<html');
out = out.replace(
  /^<!DOCTYPE html>\s*<html lang="bn" data-seo-managed="full">\s*<html lang="bn" data-seo-managed="full">/,
  "<!DOCTYPE html>\n<html lang=\"bn\" data-seo-managed=\"full\">"
);

fs.writeFileSync("index.html", out, { encoding: "utf8" });
const bn = (out.match(/[\u0980-\u09FF]/g) || []).length;
console.log("restored index.html, Bengali chars:", bn);
