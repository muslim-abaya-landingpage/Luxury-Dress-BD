import fs from "fs";
import path from "path";

const root = path.resolve(".");
const ver = "20260603vc14";
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

for (const f of files) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) continue;
  let c = fs.readFileSync(p, "utf8");
  const n = c.replace(/category-renderer\.js\?v=[^"']+/g, `category-renderer.js?v=${ver}`);
  if (n !== c) {
    fs.writeFileSync(p, n);
    console.log("updated", f);
  }
}
