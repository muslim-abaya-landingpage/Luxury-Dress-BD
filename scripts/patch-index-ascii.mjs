import fs from "fs";

const VER = "20260629pro";
let html = fs.readFileSync("index.html", { encoding: "utf8" });

const bnBefore = (html.match(/[\u0980-\u09FF]/g) || []).length;
if (bnBefore < 800) {
  console.error("Refusing patch: Bengali missing", bnBefore);
  process.exit(1);
}

html = html.replace(
  /<link rel="stylesheet" href="cart-drawer\.css[^"]+">\s*(?=<script defer src="cart-utils)/,
  ""
);

if (!html.includes('role="status"')) {
  html = html.replace(
    '<div id="cartToast" class="cart-toast">',
    '<div id="cartToast" class="cart-toast" role="status" aria-live="polite">'
  );
}

if (!html.includes("index-sales-sticky.css")) {
  html = html.replace(
    /(<noscript><link rel="stylesheet" href="index-home\.css[^>]+><\/noscript>)/,
    `$1\n    <link rel="stylesheet" href="index-sales-sticky.css?v=${VER}" media="print" onload="this.media='all'">\n    <noscript><link rel="stylesheet" href="index-sales-sticky.css?v=${VER}"></noscript>`
  );
}

html = html.replace(
  /<div id="site-footer-mount"><\/div>\s*<link rel="stylesheet" href="index-sales-sticky\.css[^>]+>\s*<noscript>[\s\S]*?<\/noscript>\s*(?=<script defer src="site-seo-config)/,
  "<div id=\"site-footer-mount\"></div>\n"
);

html = html.replace(
  /<span onclick="closeVideo\(\)" style="position: absolute; top: -50px; right: 0; color: #fff; font-size: 40px; cursor: pointer; font-weight: bold;">&times;<\/span>/,
  '<button type="button" onclick="closeVideo()" aria-label="Close video" style="position: absolute; top: -50px; right: 0; color: #fff; font-size: 40px; cursor: pointer; font-weight: bold; background: transparent; border: none;">&times;</button>'
);

html = html.replace(/<noscript><\/noscript>/g, "");

fs.writeFileSync("index.html", html.replace(/^\uFEFF/, ""), { encoding: "utf8" });

const bn = (html.match(/[\u0980-\u09FF]/g) || []).length;
const bad = (html.match(/\?\?\?/g) || []).length;
console.log("Patched index.html Bengali:", bn, "???? blocks:", bad);
if (bn < 800 || bad > 0) process.exit(1);
