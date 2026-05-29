import fs from "fs";

const VER = "20260530ft4";
let n = 0;
for (const file of fs.readdirSync(".").filter((x) => x.endsWith(".html"))) {
  let html = fs.readFileSync(file, "utf8");
  const next = html.replace(/site-seo\.css\?v=[^"']+/g, `site-seo.css?v=${VER}`);
  if (next !== html) {
    fs.writeFileSync(file, next, "utf8");
    n++;
  }
}
console.log("site-seo.css bumped in", n, "files");
