import { execSync } from "child_process";
import fs from "fs";

const SRC = "7721f89";
const VER = "20260620ft";
let html = execSync(`git show ${SRC}:checkout.html`, {
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
}).replace(/^\uFEFF/, "");

const bnBefore = (html.match(/[\u0980-\u09FF]/g) || []).length;
if (bnBefore < 800) {
  console.error("Source missing Bengali:", bnBefore);
  process.exit(1);
}

html = html.replace(
  /<script>\(function\(w,d,s,l,i\)[\s\S]*?GTM-ML7RL6BR'\);<\/script>\s*/i,
  ""
);

html = html.replace(
  /<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=Inter[^>]+>/,
  `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'">
    <noscript><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet"></noscript>`
);

html = html.replace(/site-footer\.css\?v=[^"]+/, `site-footer.css?v=${VER}`);
html = html.replace(/site-footer\.js\?v=[^"]+/, `site-footer.js?v=${VER}`);
html = html.replace(
  /<script defer src="site-header\.js[^>]*>/,
  '<script defer src="site-header.js?v=20260531nav">'
);

html = html.replace(
  /font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;/,
  "font-family: 'Inter', 'Hind Siliguri', system-ui, -apple-system, 'Segoe UI', sans-serif;"
);

html = html.replace(
  /\.summary-item strong \{ font-weight: 700; color: #111; \}/,
  ".summary-item strong { font-weight: 700; color: #111; font-family: 'Hind Siliguri', 'Inter', sans-serif; }\n        #orderReviewMeta { font-family: 'Hind Siliguri', 'Inter', sans-serif; }"
);

html = html.replace(
  /\.gb-order-price \{\n            font-weight: 700;/,
  ".gb-order-price {\n            font-family: 'Hind Siliguri', 'Inter', sans-serif;\n            font-weight: 700;"
);

html = html.replace(
  /<strong id="side-subtotal">[^<]+<\/strong>/,
  '<strong id="side-subtotal">&#2547;0</strong>'
);
html = html.replace(
  /<strong id="side-delivery">[^<]+<\/strong>/,
  '<strong id="side-delivery">&#2547;0</strong>'
);
html = html.replace(
  /<strong id="side-total">[^<]+<\/strong>/,
  '<strong id="side-total">&#2547;0 BDT</strong>'
);

html = html.replace(
  /function formatBdt\(amount\) \{\s*var n = parseInt\(amount, 10\) \|\| 0;\s*return '[^']*' \+/,
  "function formatBdt(amount) {\n        if (typeof window.formatBdt === 'function') return window.formatBdt(amount);\n        var n = parseInt(amount, 10) || 0;\n        return '\\u09F3' +"
);

fs.writeFileSync("checkout.html", html, { encoding: "utf8" });

const bn = (html.match(/[\u0980-\u09FF]/g) || []).length;
const bad = (html.match(/\?\?\?\?/g) || []).length;
console.log("checkout.html Bengali:", bn, "???? blocks:", bad);
if (bn < 800 || bad > 0) process.exit(1);
