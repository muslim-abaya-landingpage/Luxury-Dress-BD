// Messenger Inbox: each conversation shows its Facebook Page's own logo next to the Page name
// (public Page picture; no token). A missing logo is removed, the name stays.
const { test, expect } = require('@playwright/test');

const CONTACTS = [
  { pageId: '381729145014885', pageName: 'Muslim Abaya', psid: 'c1', name: '', lastSeen: 'আজ', lastMessage: 'দাম কত?', lastDirection: 'in', unread: 1, status: 'New', fromAd: false, assignedTo: '' },
  { pageId: 'not-a-number', pageName: 'Odd Page', psid: 'c2', name: 'Rina', lastSeen: 'আজ', lastMessage: 'hi', lastDirection: 'in', unread: 0, status: 'New', fromAd: false, assignedTo: '' },
];

test('Page logo next to the Page name in the list and in the open conversation', async ({ page }) => {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin",name:"Owner"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: `
    window.MaAdmin = { cached: function () { return null; }, logout: function () {},
      inboxCall: function (type) {
        if (type === 'InboxThread') return Promise.resolve({ ok: true, contact: ${JSON.stringify(CONTACTS[0])}, messages: [] });
        if (type === 'InboxProfile') return Promise.resolve({ ok: true, contact: ${JSON.stringify(CONTACTS[0])} });
        return Promise.resolve({ ok: true, pages: [], statuses: ['New'], team: [], contacts: ${JSON.stringify(CONTACTS)}, stats: { total: 2, unread: 1, fromAd: 0, confirmed: 0, byPage: {} } });
      } };` }));
  // A tiny PNG stands in for Facebook's Page picture.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.route('https://graph.facebook.com/**', (r) => r.fulfill({ contentType: 'image/png', body: png }));
  await page.goto('/admin-inbox.html');
  const tag = page.locator('.ibx-tag.page', { hasText: 'Muslim Abaya' }).first();
  await expect(tag).toBeVisible();
  await expect(tag.locator('img.ibx-page-logo')).toHaveAttribute('src', 'https://graph.facebook.com/381729145014885/picture?type=square&width=48&height=48');
  // An id that is not a Facebook Page id gets no picture (and no request), only the name.
  const odd = page.locator('.ibx-tag.page', { hasText: 'Odd Page' }).first();
  await expect(odd).toBeVisible();
  await expect(odd.locator('img')).toHaveCount(0);
  await tag.click();
  await expect(page.locator('#ibxThreadName')).toBeVisible();
  await expect(page.locator('#ibxThreadName ~ .ibx-tag.page img.ibx-page-logo').first()).toBeVisible();
});
