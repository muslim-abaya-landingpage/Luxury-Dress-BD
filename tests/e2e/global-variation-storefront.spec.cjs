// End-to-end purchasable Global Attribute variation: storefront → cart → checkout → mocked order.
// All catalog and Apps Script endpoints are intercepted; this test never creates a live order or changes stock.
const { test, expect } = require('@playwright/test');

const PRODUCT_ID = 'ABY-MAROON-1';
const ATTRIBUTE = { id: 'fabric-type', name: 'Fabric Type', variation: true, visible: true,
  terms: [{ id: 'cotton', name: 'Cotton' }, { id: 'linen', name: 'Linen' }] };
const VARIATIONS = [
  { size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'cotton', name: 'Fabric Type', term: 'Cotton' }], sku: 'E2E-KURTI-COTTON', price: 1200 },
  { size: 'M', globalAttributes: [{ id: 'fabric-type', termId: 'linen', name: 'Fabric Type', term: 'Linen' }], sku: 'E2E-MAROON-LINEN', price: 1450 }
];
const PRODUCT = { id: PRODUCT_ID, name: 'E2E Global Variation Kurti', category: 'tops-kurti', kind: 'simple',
  productType: 'simple', price: 900, image: '/images/Baby-Pink-Floral-Print.jpeg', sizes: ['M'],
  globalAttributes: [ATTRIBUTE], variations: VARIATIONS };

async function installFixture(page) {
  // Follow the established storefront E2E pattern: patch the existing catalog fixture
  // in-memory, so product-page.js loads the exact same product lookup path as production.
  const fs = require('fs');
  const path = require('path');
  const realCatalog = fs.readFileSync(path.join(__dirname, '../../category-products.js'), 'utf8');
  const marker = 'id: "ABY-MAROON-1",';
  if (!realCatalog.includes(marker)) throw new Error('Maroon Abaya Set test fixture missing');
  const patchedCatalog = realCatalog.replace(marker, marker + '\\n      globalAttributes: ' + JSON.stringify([ATTRIBUTE]) + ',\\n      variations: ' + JSON.stringify(VARIATIONS) + ',');
  await page.route(/\\/category-products\\.js(\\?.*)?$/, (route) =>
    route.fulfill({ contentType: 'application/javascript', body: patchedCatalog }));
  await page.route(/googletagmanager|gtm\\.js|analytics\\.tiktok|connect\\.facebook|clarity\\.ms/, (route) =>
    route.fulfill({ status: 204, body: '' }));
}

