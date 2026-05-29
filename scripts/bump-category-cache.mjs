import fs from "fs";

const VER = "20260530sale";
for (const f of fs.readdirSync(".").filter((x) => x.endsWith(".html"))) {
  let h = fs.readFileSync(f, "utf8");
  const n = h
    .replace(/category-renderer\.js\?v=[^"']+/g, `category-renderer.js?v=${VER}`)
    .replace(/category-sidebar\.css\?v=[^"']+/g, `category-sidebar.css?v=${VER}`);
  if (n !== h) fs.writeFileSync(f, n, "utf8");
}
console.log("bumped category cache", VER);
