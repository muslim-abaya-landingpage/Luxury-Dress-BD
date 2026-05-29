import { execSync } from "child_process";
import fs from "fs";

const good = execSync("git show 7721f89:index.html", {
  encoding: "utf8",
  maxBuffer: 15 * 1024 * 1024,
});
let out = fs.readFileSync("index.html", "utf8");

function sub(curRe, goodRe) {
  const m = good.match(goodRe);
  if (m) out = out.replace(curRe, m[0]);
}

sub(
  /<div class="price-tag" id="homePriceTag">[^<]*<\/div>/,
  /<div class="price-tag" id="homePriceTag">[^<]*<\/div>/
);
sub(
  /toast\.querySelector\('\.toast-text'\)\.innerText = "[^"]*"/,
  /toast\.querySelector\('\.toast-text'\)\.innerText = "[^"]*"/
);
sub(
  /if \(priceEl\) priceEl\.textContent = '[^']*' \+ p\.price/,
  /if \(priceEl\) priceEl\.textContent = '[^']*' \+ p\.price/
);
sub(/alert\('[^']*'\);\s*\n\s*return;\s*\n\s*}\s*\n\s*if \(typeof flushStoreCart/, /alert\('[^']*'\);\s*\n\s*return;\s*\n\s*}\s*\n\s*if \(typeof flushStoreCart/);

if (!out.includes("__homeRefreshCatalog")) {
  out = out.replace(
    /}\s*<\/script>\s*<div id="ma-social-connect-mount">/,
    `}
window.hydrateHomeProducts = hydrateHomeProducts;
window.renderSidebar = renderSidebar;
window.selectProduct = selectProduct;
window.__homeRefreshCatalog = function () {
    hydrateHomeProducts();
    renderSidebar();
    if (products.length) selectProduct(Math.min(currentIdx, products.length - 1), products[Math.min(currentIdx, products.length - 1)].id, false);
};
</script>

</div>
</div>
</div>
<div id="ma-social-connect-mount">`
  );
}

out = out.replace(
  'site-footer.js?v=20260531wa',
  "site-footer.js?v=20260531fb1"
);

fs.writeFileSync("index.html", out, "utf8");
console.log(
  "ok",
  out.includes("৫৫০"),
  out.includes("প্রোডাক্টটি"),
  out.includes("__homeRefreshCatalog")
);
