// Admin → SEO Manager (APIs mocked) and Product Manager SEO box: results, approve, redirects, save; keywords + "Use suggestion".
const { test, expect } = require('@playwright/test');

const report = {
  ok: true, scheduled: true,
  build: { generatedAt: '2026-11-15T01:00:00Z', summary: { pages: 106, products: 79, sitemapUrls: 97, errors: 1, warnings: 1, info: 1 },
    issues: [
      { level: 'error', type: 'broken-link', url: 'https://muslimabaya.com/old-abaya', message: 'Broken internal link', fix: 'Add a redirect' },
      { level: 'warning', type: 'long-title', url: 'https://muslimabaya.com/help', message: 'Title is 70 characters', fix: '' },
      { level: 'info', type: 'auto-seo', url: 'https://muslimabaya.com/product-manager', message: '1 product(s) use automatic SEO text.', fix: '' }],
    suggestions: [{ id: 'ABY-MAROON-1', category: 'abaya', name: 'Maroon Abaya Set', url: 'https://muslimabaya.com/product/ABY-MAROON-1', title: 'Maroon Abaya Set | Muslim Abaya Bangladesh', description: 'Auto desc', titleIsManual: false, descriptionIsManual: false }] },
  pages: { pages: [{ path: '/abaya', file: 'abaya.html', auto: { title: 'Auto abaya title', description: 'Auto abaya description', robots: 'index, follow', canonical: 'https://muslimabaya.com/abaya' }, manual: null }] },
  live: [{ storedAt: Date.parse('2026-11-15T02:00:00Z'), generatedAt: '2026-11-15T02:00:00Z', summary: { urls: 97, errors: 0, warnings: 1, info: 0, msAverage: 170 }, issues: [{ level: 'warning', type: 'duplicate-title', url: 'https://muslimabaya.com/product/x', message: '2 pages share the title', fix: '' }] }],
};

async function stubAdmin(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdmin={getSession:function(){return {token:"t",role:"admin"}},isLoggedIn:function(){return true},call:function(){return Promise.resolve({ok:true,items:{}})},cached:function(){return null},getStockVariants:function(){return Promise.resolve({ok:true,items:[]})}};' }));
}

test('SEO Manager shows deploy + live results, approves page SEO, adds a redirect and saves', async ({ page }) => {
  await stubAdmin(page);
  const saves = [];
  await page.route('**/api/seo-report', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(report) }));
  await page.route('**/api/seo-settings', async (r) => {
    const body = JSON.parse(r.request().postData());
    if (body.action === 'get') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, sha: 'a'.repeat(40), settings: { version: 1, global: {}, pages: {}, redirects: [], robots: { disallow: [] } } }) });
    saves.push(body);
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, sha: 'b'.repeat(40), settings: body.settings }) });
  });
  await page.goto('/admin-seo.html');
  await expect(page.locator('#seoCards')).toContainText('Errors');
  await expect(page.locator('#seoCards .seo-card').first()).toContainText('1');
  await expect(page.locator('#seoIssues')).toContainText('Broken internal link');
  await expect(page.locator('#seoIssues')).toContainText('2 pages share the title');
  await page.selectOption('#seoLevel', 'error');
  await expect(page.locator('#seoIssues .seo-issue')).toHaveCount(1);

  await page.click('[data-tab="products"]');
  await expect(page.locator('#seoProducts a[href="product-manager.html?edit=ABY-MAROON-1#seo"]')).toBeVisible();

  await page.click('[data-tab="pages"]');
  const box = page.locator('.seo-page[data-path="/abaya"]');
  await expect(box.locator('input[data-k="title"]')).toHaveAttribute('placeholder', 'Auto abaya title');
  await box.locator('[data-approve]').click();
  await expect(page.locator('.seo-page[data-path="/abaya"] input[data-k="title"]')).toHaveValue('Auto abaya title');

  await page.click('[data-tab="redirects"]');
  await page.click('#seoAddRedirect');
  await page.locator('#seoRedirects [data-r="from"]').fill('/old-abaya');
  await page.locator('#seoRedirects [data-r="to"]').fill('/abaya');
  await page.click('#seoSave');
  await expect(page.locator('#seoSaveMsg')).toContainText('Saved');
  expect(saves).toHaveLength(1);
  expect(saves[0].sha).toBe('a'.repeat(40));
  expect(saves[0].settings.pages['/abaya']).toEqual({ title: 'Auto abaya title', description: 'Auto abaya description' });
  expect(saves[0].settings.redirects).toEqual([{ from: '/old-abaya', to: '/abaya', code: 301 }]);
});

test('SEO Manager on a phone: no sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await stubAdmin(page);
  await page.route('**/api/seo-report', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(report) }));
  await page.route('**/api/seo-settings', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, sha: '', settings: { version: 1, global: {}, pages: {}, redirects: [{ from: '/a', to: '/b', code: 302 }], robots: { disallow: [] } } }) }));
  await page.goto('/admin-seo.html');
  await expect(page.locator('#seoIssues')).toContainText('Broken internal link');
  for (const tab of ['pages', 'redirects', 'google']) {
    await page.route('**/api/seo-google', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, serviceAccount: 'reader@example.iam.gserviceaccount.com', gsc: { connected: false, error: 'NO_ACCESS' }, ga4: { connected: false, error: 'NO_PROPERTY_ID' } }) }));
    await page.click('[data-tab="' + tab + '"]');
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w, tab).toBeLessThanOrEqual(375);
  }
  await expect(page.locator('#seoGsc')).toContainText('reader@example.iam.gserviceaccount.com');
});

test('Product Manager: ?edit= opens the product; "Use suggestion" approves the automatic SEO; keywords are saved', async ({ page }) => {
  await stubAdmin(page);
  page.on('dialog', (d) => d.accept());
  await page.goto('/product-manager.html?edit=ABY-MAROON-1#seo');
  await expect(page.locator('.pm-wp-name')).toHaveValue('Maroon Abaya Set', { timeout: 15000 });
  await page.evaluate(() => { window.MaCatalogPublisher = Object.assign({}, window.MaCatalogPublisher, { isReady: () => true, publish: (files) => { window.__published = files; return Promise.resolve({ ok: true }); } }); });
  const ph = await page.locator('#pmSeoTitle').getAttribute('placeholder');
  expect(ph).toBe('Maroon Abaya Set | Muslim Abaya Bangladesh');
  await page.click('#pmSeoApprove');
  await expect(page.locator('#pmSeoTitle')).toHaveValue(ph);
  await expect(page.locator('#pmSeoDesc')).not.toHaveValue('');
  await page.locator('#pmSeoKeyword').fill('মেরুন আবায়া');
  await page.locator('#pmSeoKeywords').fill('maroon abaya, borka');
  await page.click('#pmEditUpdate');
  await expect.poll(() => page.evaluate(() => !!window.__published)).toBe(true);
  const file = await page.evaluate(() => window.__published.find((f) => f.path === 'category-products.js').content);
  const block = file.slice(file.indexOf('"ABY-MAROON-1"'), file.indexOf('\n    }', file.indexOf('"ABY-MAROON-1"')));
  expect(block).toContain('seoTitle: "Maroon Abaya Set | Muslim Abaya Bangladesh"');
  expect(block).toContain('seoKeyword: "মেরুন আবায়া"');
  expect(block).toMatch(/seoKeywords: \["maroon abaya","borka"\]/);
});
