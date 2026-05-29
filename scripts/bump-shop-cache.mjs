import fs from "fs";

const VER = "20260530ft4";
for (const f of fs.readdirSync(".").filter((x) => x.endsWith(".html"))) {
  let h = fs.readFileSync(f, "utf8");
  const n = h.replace(/shop-page\.css\?v=[^"']+/g, `shop-page.css?v=${VER}`);
  if (n !== h) fs.writeFileSync(f, n, "utf8");
}
console.log("shop-page cache", VER);
