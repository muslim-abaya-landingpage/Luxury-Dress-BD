import fs from "fs";
import path from "path";

const root = path.resolve(".");
const ver = "20260603cart14";
const files = [
  "abaya.html",
  "premium-two-piece.html",
  "cover-up.html",
  "tops-kurti.html",
  "embroidery.html",
  "karchupi.html",
  "kaftan.html",
  "hijab.html",
  "category.html",
  "index.html"
];

for (const f of files) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  let c = fs.readFileSync(p, "utf8");
  const n = c
    .replace(/shop-page\.css\?v=[^"']+/g, `shop-page.css?v=${ver}`)
    .replace(/category-sidebar\.css\?v=[^"']+/g, `category-sidebar.css?v=${ver}`)
    .replace(/category-renderer\.js\?v=[^"']+/g, `category-renderer.js?v=${ver}`)
    .replace(/index-home\.css\?v=[^"']+/g, `index-home.css?v=${ver}`)
    .replace(/index-home-cards\.css\?v=[^"']+/g, `index-home-cards.css?v=${ver}`)
    .replace(/index-home-app\.js\?v=[^"']+/g, `index-home-app.js?v=${ver}`);
  if (n !== c) {
    fs.writeFileSync(p, n);
    console.log("updated", f);
  }
}
