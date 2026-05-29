import fs from "fs";

const FOOTER_VER = "20260629full";
const SEO_VER = "20260629full";

for (const f of fs.readdirSync(".").filter((x) => x.endsWith(".html"))) {
  let h = fs.readFileSync(f, "utf8");
  let n = h
    .replace(/site-footer\.css\?v=[^"']+/g, `site-footer.css?v=${FOOTER_VER}`)
    .replace(/site-seo\.css\?v=[^"']+/g, `site-seo.css?v=${SEO_VER}`);
  if (n !== h) fs.writeFileSync(f, n, "utf8");
}
console.log("bumped footer", FOOTER_VER, "seo", SEO_VER);
