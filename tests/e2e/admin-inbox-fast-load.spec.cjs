const { test, expect } = require('@playwright/test');

const CONTACT = {
  pageId: 'page-1', pageName: 'Main Page', psid: 'customer-1', name: 'Ayesha',
  lastSeen: 'আজ', lastMessage: 'দাম কত?', lastDirection: 'in', unread: 1,
  status: 'New', fromAd: false, assignedTo: ''
};
const STATS = { total: 1, unread: 1, fromAd: 0, confirmed: 0, byPage: {} };

async function stubInbox(page) {
  await page.route('**/admin-guard.js*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin",name:"Owner"});}};'
  }));
  await page.route('**/admin-api.js*', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: `
      window.__inboxCalls = [];
      window.MaAdmin = {
        cached: function () { return null; },
        logout: function () {},
        inboxCall: function (type, fields, options) {
          options = options || {};
          window.__inboxCalls.push({ type: type, options: options });
          if (options.edgeSummary) {
            return Promise.resolve({ ok: true, pagesOmitted: true, statuses: ['New'], team: [], contacts: ${JSON.stringify([CONTACT])}, stats: ${JSON.stringify(STATS)} });
          }
          return new Promise(function (resolve) {
            setTimeout(function () {
              resolve({ ok: true, pages: [{ id: 'page-1', name: 'Main Page', connected: true }], statuses: ['New'], team: [], contacts: ${JSON.stringify([CONTACT])}, stats: ${JSON.stringify(STATS)} });
            }, 800);
          });
        }
      };
    `
  }));
}

test('fresh Messenger Inbox shows the edge summary before loading page metadata in the background', async ({ page }) => {
  await stubInbox(page);
  await page.goto('/admin-inbox.html');

  await expect(page.locator('.ibx-item')).toHaveCount(1);
  await expect(page.locator('#fPage option')).toHaveCount(1);
  const initialCalls = await page.evaluate(() => window.__inboxCalls);
  expect(initialCalls[0]).toMatchObject({ type: 'InboxList', options: { edgeSummary: true } });
  expect(initialCalls[1]).toMatchObject({ type: 'InboxList', options: { edgeSummary: false } });

  await expect(page.locator('#fPage')).toContainText('Main Page');
  await expect(page.locator('.ibx-item')).toHaveCount(1);
});
