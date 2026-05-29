import fs from "fs";

const FOOTER_CSS = "site-footer.css?v=20260530ft7";
const FOOTER_JS = "site-footer.js?v=20260629post";
const HOME_CSS = "index-home.css?v=20260530ft2";

function fixFooterCss(html) {
  html = html.replace(
    /<link rel="stylesheet" href="site-footer\.css\?v=[^"]+"[^>]*>\s*(?:<noscript>[\s\S]*?<\/noscript>\s*)*/g,
    `<link rel="stylesheet" href="${FOOTER_CSS}" media="print" onload="this.media='all'">\n  <noscript><link rel="stylesheet" href="${FOOTER_CSS}"></noscript>\n`
  );
  html = html.replace(/(<noscript><link[^>]+><\/noscript>)\s*\n\s*<\/noscript>/g, "$1");
  return html;
}

function fixShopCss(html) {
  html = html.replace(
    /<link rel="stylesheet" href="shop-page\.css\?v=[^"]+"[^>]*>\s*(?:<noscript>[\s\S]*?<\/noscript>\s*)*/g,
    `<link rel="stylesheet" href="shop-page.css?v=20260624pro" media="print" onload="this.media='all'">\n  <noscript><link rel="stylesheet" href="shop-page.css?v=20260624pro"></noscript>\n`
  );
  html = html.replace(/(<noscript><link[^>]+><\/noscript>)\s*\n\s*<\/noscript>/g, "$1");
  return html;
}

let n = 0;
for (const file of fs.readdirSync(".").filter((x) => x.endsWith(".html"))) {
  let html = fs.readFileSync(file, "utf8");
  const orig = html;
  html = fixFooterCss(html);
  html = fixShopCss(html);
  html = html.replace(/site-footer\.js\?v=[^"]+/g, FOOTER_JS);
  html = html.replace(/index-home\.css\?v=[^"']+/g, HOME_CSS);
  if (html !== orig) {
    fs.writeFileSync(file, html, "utf8");
    n++;
  }
}

console.log("Fixed footer links in", n, "html files");
