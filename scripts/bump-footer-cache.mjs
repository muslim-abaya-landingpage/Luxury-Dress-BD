import fs from "fs";

const FOOTER_JS = "site-footer.js?v=20260629post";
const FOOTER_CSS = "site-footer.css?v=20260629sub";

function deferCss(href) {
  return (
    `<link rel="stylesheet" href="${href}" media="print" onload="this.media='all'">\n` +
    `  <noscript><link rel="stylesheet" href="${href}"></noscript>`
  );
}

const categoryPages = [
  "abaya.html",
  "cover-up.html",
  "embroidery.html",
  "hijab.html",
  "kaftan.html",
  "karchupi.html",
  "premium-two-piece.html",
  "tops-kurti.html",
  "category.html",
];

for (const file of categoryPages) {
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/site-footer\.css\?v=[^"]+"/g, `${FOOTER_CSS}"`);
  html = html.replace(
    `<link rel="stylesheet" href="${FOOTER_CSS}">`,
    deferCss(FOOTER_CSS)
  );
  html = html.replace(
    '<link rel="stylesheet" href="shop-page.css?v=20260624pro">',
    deferCss("shop-page.css?v=20260624pro")
  );
  html = html.replace(/site-footer\.js\?v=[^"]+/g, FOOTER_JS);
  fs.writeFileSync(file, html, "utf8");
}

const allHtml = fs.readdirSync(".").filter((x) => x.endsWith(".html"));
let bumped = 0;
for (const file of allHtml) {
  let html = fs.readFileSync(file, "utf8");
  const next = html.replace(/site-footer\.js\?v=[^"]+/g, FOOTER_JS);
  if (next !== html) {
    fs.writeFileSync(file, next, "utf8");
    bumped++;
  }
}

console.log("Footer cache:", FOOTER_JS, "| category pages:", categoryPages.length, "| html bumped:", bumped);
