// Product cards must line up: in every row the cards are the same height and the Add to Cart / অর্ডার করুন
// buttons sit at the same height, whether a name takes one line or two and whether a sale price is shown.
// Checked on the homepage rows, a category grid and the product-page "Related Products", on desktop and phone.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const real = fs.readFileSync(path.join(__dirname, '../../category-products.js'), 'utf8');
// One long name and one sale price next to normal cards, so uneven content is always present.
const catalog = real + '\n(function(){var a=window.CATEGORY_PRODUCTS.abaya||[];' +
  'if(a[0]){a[0].name="Premium Dubai Cherry Fabrics Abaya With Full Embroidery Design And Matching Hijab";}' +
  'if(a[1]){a[1].regularPrice=(a[1].price||1000)+400;}})();\n';

async function prepare(page) {
  await page.route(/\/category-products\.js(\?.*)?$/, (r) => r.fulfill({ contentType: 'application/javascript', body: catalog }));
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|clarity\.ms|script\.google\.com/, (r) => r.fulfill({ status: 204, body: '' }));
}

/** For each visual row of visible cards: [{cards, heights, buttonTops}] */
function rows(page, cardSel, buttonSel) {
  return page.evaluate(([cardSel, buttonSel]) => {
    const groups = {};
    document.querySelectorAll(cardSel).forEach((c) => {
      const r = c.getBoundingClientRect();
      if (!r.width || !r.height || r.right <= 0 || r.left >= innerWidth) return;
      const b = c.querySelector(buttonSel);
      if (!b) return;
      const key = c.parentElement && Array.prototype.indexOf.call(document.querySelectorAll('*'), c.parentElement) + ':' + Math.round(r.top + scrollY);
      (groups[key] = groups[key] || []).push({ h: r.height, b: b.getBoundingClientRect().top - r.top });
    });
    return Object.values(groups).filter((g) => g.length > 1);
  }, [cardSel, buttonSel]);
}

function expectEven(found, label, oneColumnOk) {
  if (!oneColumnOk) expect(found.length, label + ': no rows with 2+ cards found').toBeGreaterThan(0);
  found.forEach((g) => {
    const hs = g.map((x) => x.h); const bs = g.map((x) => x.b);
    expect(Math.max(...hs) - Math.min(...hs), label + ' card heights ' + hs.join(',')).toBeLessThanOrEqual(1);
    expect(Math.max(...bs) - Math.min(...bs), label + ' button positions ' + bs.join(',')).toBeLessThanOrEqual(1);
  });
}

for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'phone', width: 390, height: 844 }]) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('homepage rows: cards and buttons line up', async ({ page }) => {
      await prepare(page);
      await page.goto('/index.html');
      await page.waitForSelector('.home-row .ah-card .ah-actions');
      if (vp.width < 600) {
        // One card per view on phones: compare the cards of a row side by side by widening the row.
        await page.addStyleTag({ content: '.home-row{grid-auto-columns:48%!important}' });
      }
      expectEven(await rows(page, '.home-row > .ah-card', '.ah-actions'), 'home');
    });

    test('category grid: cards and buttons line up', async ({ page }) => {
      await prepare(page);
      await page.goto('/abaya.html');
      await page.waitForSelector('.product-grid > .card .card-actions-muslim-abaya');
      expectEven(await rows(page, '.product-grid > .card', '.card-actions-muslim-abaya'), 'category'); // phones now show two cards per row
    });
  });
}
