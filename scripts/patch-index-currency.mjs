import fs from "fs";

const VER = "20260620ft";
let h = fs.readFileSync("index.html", "utf8");

h = h.replace(/id="homePriceTag">[^<]+</, 'id="homePriceTag">&#2547; ৫৫০<');
h = h.replace(/site-footer\.css\?v=[^"]+/g, `site-footer.css?v=${VER}`);
h = h.replace(/site-footer\.js\?v=[^"]+/g, `site-footer.js?v=${VER}`);
h = h.replace(/index-home\.css\?v=[^"]+/g, `index-home.css?v=${VER}`);
h = h.replace(/index-critical\.css\?v=[^"]+/g, `index-critical.css?v=${VER}`);

fs.writeFileSync("index.html", h, { encoding: "utf8" });
const bn = (h.match(/[\u0980-\u09FF]/g) || []).length;
const bad = (h.match(/\?\?\?\?/g) || []).length;
console.log("index.html Bengali:", bn, "???? blocks:", bad);
if (bn < 800 || bad > 0) process.exit(1);
