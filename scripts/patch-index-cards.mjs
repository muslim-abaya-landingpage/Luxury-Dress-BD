import fs from "fs";

const VER = "20260621cards";
let h = fs.readFileSync("index.html", "utf8");

if (!h.includes("index-home-cards.css")) {
  h = h.replace(
    /(<noscript><link rel="stylesheet" href="index-home\.css\?v=[^"]+"><\/noscript>)/,
    `$1
    <link rel="stylesheet" href="index-home-cards.css?v=${VER}">`
  );
}

h = h.replace(
  /(<div class="price-tag" id="homePriceTag">)[\s\S]*?(<\/div>)/,
  '$1<span class="price-tag-cur">&#2547;</span><span class="price-tag-amt">৫৫০</span>$2'
);
h = h.replace(/index-home\.css\?v=[^"]+/g, `index-home.css?v=${VER}`);
h = h.replace(/index-home-cards\.css\?v=[^"]+/g, `index-home-cards.css?v=${VER}`);
h = h.replace(/index-home-app\.js\?v=[^"]+/g, `index-home-app.js?v=${VER}`);

fs.writeFileSync("index.html", h, { encoding: "utf8" });
console.log("ok", (h.match(/[\u0980-\u09FF]/g) || []).length, "bn");
