/**
 * Read-only responsive audit of the checked-out site.
 * Uses a local static server. All connected order/admin APIs are mocked.
 * Never places real orders, edits sheets or authenticates to production.
 */
const { test, expect } = require('@playwright/test');

const paths = [
  { name: 'home', path: '/index.html' },
  { name: 'category', path: '/category.html' },
  { name: 'product', path: '/product/DR-01.html' },
  { name: 'checkout', path: '/checkout.html' },
  { name: 'admin-dashboard', path: '/admin-dashboard.html', admin: true },
  { name: 'admin-orders', path: '/admin-orders.html', admin: true },
  { name: 'admin-order', path: '/admin-order.html?id=RESPONSIVE-TEST', admin: true },
];
const widths = [320, 360, 390, 768, 1024, 1440];
const record = {
  row: 2, time: '23-10-2026 02:00', name: 'QA Responsive Fixture', phone: '01700000000',
  qty: 1, charge: 70, address: 'Dhaka test address', design: 'Abaya fixture size M',
  total: 1200, orderId: 'RESPONSIVE-TEST', status: 'Pending', items: ['Abaya fixture × 1'],
  courierStatus: '', tracking: '', district: 'ঢাকা', payment: 'Cash On Delivery'
};
async function mockNetwork(page, isAdmin) {
  await page.route('https://script.google.com/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ ok: true, orders: [record], order: record, statuses: ['Pending'], items: [] })
  }));
  await page.route('**/api/admin-read', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, orders: [record], order: record, items: [] })
  }));
  if (isAdmin) {
    await page.route('**/admin-guard.js*', route => route.fulfill({
      contentType: 'application/javascript',
      body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin",name:"QA Owner"});}};'
    }));
    await page.route('**/admin-api.js*', route => route.fulfill({
      contentType: 'application/javascript', body: [
        'window.MaAdmin={',
        ' getSession:()=>({token:"test",role:"admin",name:"QA Owner"}),',
        ' verifySession:()=>Promise.resolve({ok:true,role:"admin",name:"QA Owner"}),',
        ' cached:()=>null,',
        ' fetchOrders:()=>Promise.resolve({ok:true,orders:'+JSON.stringify([record])+',count:1}),',
        ' getStockVariants:()=>Promise.resolve({ok:true,items:[]}),',
        ' getAnalyticsV2:()=>Promise.resolve({ok:true,summary:{},salesByMonth:[],topProducts:[],sourceBreakdown:[]}),',
        ' inboxCall:()=>Promise.resolve({ok:true,contacts:[],stats:{unread:0}}),',
        ' call:(type)=>Promise.resolve(type==="AdminOrderGet"?{ok:true,order:'+JSON.stringify(record)+',statuses:["Pending"],couriers:["Steadfast"],history:{stats:{total:1,delivered:0,cancelled:0},recent:[]}}:{ok:true,orders:'+JSON.stringify([record])+',items:[],statuses:["Pending"],counts:{all:1}}),',
        ' logout:()=>{}',
        '};'
      ].join('\n')
    }));
  }
}
function nodeName(element) {
  const name = element.tagName.toLowerCase();
  return name + (element.id ? '#' + element.id : '') + (typeof element.className === 'string' && element.className.trim() ? '.' + element.className.trim().split(/\s+/).slice(0,2).join('.') : '');
}
for (const spec of paths) {
  for (const width of widths) {
    test(spec.name + ' at ' + width + 'px', async ({ page }) => {
      await page.setViewportSize({ width, height: width < 600 ? 780 : 900 });
      await mockNetwork(page, spec.admin);
      const errors = [];
      page.on('pageerror', error => errors.push(String(error).slice(0,180)));
      const response = await page.goto(spec.path, { waitUntil: 'domcontentloaded', timeout: 25000 });
      expect(response, 'document should exist').not.toBeNull();
      expect(response.status(), 'HTTP response should be successful').toBeLessThan(400);
      await page.waitForTimeout(600);
      const findings = await page.evaluate(() => {
        const doc = document.documentElement;
        const viewport = doc.clientWidth;
        const offenders = Array.from(document.querySelectorAll('body *'))
          .filter(element => {
            const css = getComputedStyle(element);
            if (css.display === 'none' || css.visibility === 'hidden') return false;
            if (element.closest('[hidden]')) return false;
            const r = element.getBoundingClientRect();
            return r.width > 10 && r.height > 3 && r.right > viewport + 4 &&
              r.left < viewport && css.position !== 'fixed' && css.position !== 'absolute';
          })
          .slice(0, 10).map(element => ({
            selector: (element.tagName.toLowerCase() + (element.id ? '#' + element.id : '') +
              (typeof element.className === 'string' ? '.' + element.className.trim().split(/\s+/).slice(0,2).join('.') : '')),
            right: Math.round(element.getBoundingClientRect().right),
            width: Math.round(element.getBoundingClientRect().width)
          }));
        const smallInputs = Array.from(document.querySelectorAll('input:not([type="hidden"]),textarea,select'))
          .filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' &&
              !el.closest('[hidden]') && parseFloat(getComputedStyle(el).fontSize) < 16;
          }).slice(0, 5).map(el => ({ id: el.id, font: getComputedStyle(el).fontSize }));
        const mobileControls = Array.from(document.querySelectorAll('button, a, input, select'))
          .filter(el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.left >= 0 &&
              r.right < viewport && r.top >= 0 && r.top < innerHeight &&
              getComputedStyle(el).visibility !== 'hidden' && !el.closest('[hidden]');
          });
        return {
          viewport, htmlScrollWidth: doc.scrollWidth, bodyScrollWidth: document.body.scrollWidth,
          title: document.title, mediaViewport: !!document.querySelector('meta[name="viewport"]'),
          offenders, smallInputs,
          visibleControls: mobileControls.length,
          smallTargets: mobileControls.filter(el => {
            const r = el.getBoundingClientRect();
            return r.width < 30 || r.height < 30;
          }).slice(0, 6).map(el => ({ name: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''), height: Math.round(el.getBoundingClientRect().height), width: Math.round(el.getBoundingClientRect().width) }))
        };
      });
      console.log('RESPONSIVE_AUDIT ' + JSON.stringify({ source: process.env.E2E_BASE_URL ? 'production' : 'local', page: spec.name, width, ...findings, pageErrors: errors }));
      if (findings.htmlScrollWidth > findings.viewport + 2) {
        await page.screenshot({ path: 'test-results/overflow-' + spec.name + '-' + width + '.png', fullPage: true }).catch(() => {});
      }
      expect(findings.mediaViewport).toBe(true);
      expect(findings.htmlScrollWidth, 'document horizontal overflow').toBeLessThanOrEqual(findings.viewport + 2);
      // These are new improvements in this PR: verify in the checked-out
      // branch only. The production scan is intentionally read-only and
      // reports the currently deployed state before the PR is merged.
      if (!process.env.E2E_BASE_URL && width <= 390) {
        if (!spec.admin) {
          const search = await page.locator('#navSearchOpen').evaluate(el => {
            const r = el.getBoundingClientRect();
            return { width: Math.round(r.width), height: Math.round(r.height) };
          });
          expect(search.width, 'header search tap width').toBeGreaterThanOrEqual(44);
          expect(search.height, 'header search tap height').toBeGreaterThanOrEqual(44);
        }
        if (['home', 'product', 'category'].includes(spec.name)) {
          const footerFont = await page.locator('.newsletter-form input:not([type="checkbox"])').first().evaluate(
            el => parseFloat(getComputedStyle(el).fontSize));
          expect(footerFont, 'newsletter contact input font').toBeGreaterThanOrEqual(16);
        }
        if (spec.name === 'category') {
          const selectFont = await page.locator('#shopSort').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
          expect(selectFont, 'category sort font').toBeGreaterThanOrEqual(16);
        }
        if (spec.name === 'admin-dashboard') {
          const font = await page.locator('#admReportRange').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
          expect(font, 'admin report filter font').toBeGreaterThanOrEqual(16);
        }
        if (spec.name === 'admin-orders') {
          const sizes = await page.locator('#ordSearch, #ordDateFilter').evaluateAll(elements =>
            elements.map(el => parseFloat(getComputedStyle(el).fontSize)));
          expect(sizes).toHaveLength(2);
          sizes.forEach(font => expect(font, 'orders filter font').toBeGreaterThanOrEqual(16));
          await expect(page.locator('#ordersTableHint')).toBeVisible();
          const table = page.locator('.pn-table-wrap');
          await expect(table).toHaveAttribute('tabindex', '0');
          const geometry = await table.evaluate(el => {
            const first = el.querySelector('thead th:first-child');
            const second = el.querySelector('thead th:nth-child(2)');
            el.scrollLeft = 160;
            return {
              moved: el.scrollLeft,
              firstSticky: getComputedStyle(first).position === 'sticky',
              secondSticky: getComputedStyle(second).position === 'sticky',
              firstLeft: Math.round(first.getBoundingClientRect().left),
              secondLeft: Math.round(second.getBoundingClientRect().left)
            };
          });
          expect(geometry.moved, 'order list can scroll independently').toBeGreaterThan(0);
          expect(geometry.firstSticky).toBe(true);
          expect(geometry.secondSticky).toBe(true);
          expect(geometry.secondLeft).toBeGreaterThan(geometry.firstLeft);
        }
      }

    });
  }
}
