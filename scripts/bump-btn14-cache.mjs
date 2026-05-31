import fs from "fs";
import path from "path";

const root = path.resolve(".");
const files = [
  "abaya.html",
  "premium-two-piece.html",
  "cover-up.html",
  "tops-kurti.html",
  "embroidery.html",
  "karchupi.html",
  "kaftan.html",
  "hijab.html",
  "category.html"
];
const ver = "20260603btn14";

for (const f of files) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  let c = fs.readFileSync(p, "utf8");
  const n = c
    .replace(/shop-page\.css\?v=[^"']+/g, `shop-page.css?v=${ver}`)
    .replace(/category-sidebar\.css\?v=[^"']+/g, `category-sidebar.css?v=${ver}`);
  if (n !== c) {
    fs.writeFileSync(p, n);
    console.log("updated", f);
  }
}
