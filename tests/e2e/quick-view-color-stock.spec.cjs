// Product view (quick view / product page panel): a colour whose stock rows are all 0 is marked sold out,
// and choosing it disables Add to Cart / Buy Now. Colours without their own rows are left alone.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const real = fs.readFileSync(path.join(__dirname, '../../category-products.js'), 'utf8');
function catalogWith(stockVariants) {
  return real + '\n(function(){var p=(window.CATEGORY_PRODUCTS.abaya||[]).find(function(x){return x.id==="ABY-MAROON-1";});if(p){' +
    'p.colorLabel="Maroon, Navy";p.color="maroon";p.colorVariants=[{color:"maroon",colorLabel:"Maroon",image:p.image},{color:"navy",colorLabel:"Navy",image:p.image.replace(/\\.jpeg$/,"-navy.jpeg")}];' +
    'p.images=[p.colorVariants[1].image];delete p.stock;p.stockVariants=' + JSON.stringify(stockVariants) + ';}})();\n';
}
async function open(page, stockVariants) {
  await page.route(/\/category-products\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: catalogWith(stockVariants) }));
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|script\.google\.com|\/api\/stock/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.goto('/product/ABY-MAROON-1');
  await expect(page.locator('.pqv-color-opt')).toHaveCount(2);
}
const pill = (page, label) => page.locator('.pqv-color-opt[data-color-label="' + label + '"]');
const cart = (page) => page.locator('.pqv-act-cart[data-product-idx]:not(.pqv-wholesale-add)').first();

test('a sold-out colour is marked, and choosing it turns Add to Cart off; the other colour turns it back on', async ({ page }) => {
  await open(page, { 'maroon · 52': { tracked: true, available: 3 }, 'navy · 52': { tracked: true, available: 0 }, 'navy · 54': { tracked: true, available: 0 } });
  await expect(pill(page, 'Navy')).toHaveClass(/is-soldout/);
  await expect(pill(page, 'Maroon')).not.toHaveClass(/is-soldout/);
  await expect(cart(page)).toBeEnabled();
  await pill(page, 'Navy').click();
  await expect(page.locator('.pqv-stock').first()).toHaveText('This color is sold out');
  await expect(cart(page)).toBeDisabled();
  await expect(page.locator('.pqv-act-buy').first()).toBeDisabled();
  await pill(page, 'Maroon').click();
  await expect(page.locator('.pqv-stock').first()).toHaveText('In Stock');
  await expect(cart(page)).toBeEnabled();
});

test('stock counted only by size (no colour rows): no colour is marked sold out', async ({ page }) => {
  await open(page, { '52': { tracked: true, available: 2 }, '54': { tracked: true, available: 0 } });
  await expect(page.locator('.pqv-color-opt.is-soldout')).toHaveCount(0);
  await pill(page, 'Navy').click();
  await expect(cart(page)).toBeEnabled();
});
