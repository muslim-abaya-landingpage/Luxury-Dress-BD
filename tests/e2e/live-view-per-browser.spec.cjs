// "X জন এখন দেখছেন": the same browser counts once, even with the product open in two tabs.
// The /_ma/view endpoint is mocked to count distinct ids, like the real worker does.
const { test, expect } = require('@playwright/test');

test('two tabs of one browser send the same viewer id; another browser sends a different one', async ({ browser }) => {
  const ids = new Set();
  const mock = async (ctx) => {
    await ctx.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|clarity\.ms|script\.google\.com|images\.muslimabaya/, (r) => r.fulfill({ status: 204, body: '' }));
    await ctx.route('**/_ma/view', async (route) => {
      ids.add(JSON.parse(route.request().postData()).sessionId);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, viewing: ids.size }) });
    });
  };
  const a = await browser.newContext(); await mock(a);
  const t1 = await a.newPage(); await t1.goto('/product/DR-01');
  await expect.poll(() => ids.size).toBe(1);
  const t2 = await a.newPage(); await t2.goto('/product/DR-01');
  await t2.waitForTimeout(1500);
  expect(ids.size).toBe(1);
  await expect(t2.locator('#pqvLiveViewing')).toBeHidden();

  const b = await browser.newContext(); await mock(b);
  const other = await b.newPage(); await other.goto('/product/DR-01');
  await expect.poll(() => ids.size).toBe(2);
  await expect(other.locator('#pqvLiveViewing')).toContainText('2 জন এখন দেখছেন');
  await a.close(); await b.close();
});
