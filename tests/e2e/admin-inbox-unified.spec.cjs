// Unified inbox: channel column (Facebook Pages with unread counts, website chat, Telegram) and product cards.
const { test, expect } = require('@playwright/test');

const PAGES = [{ id: '381729145014885', name: 'Muslim Abaya', connected: true }, { id: '964928770039259', name: 'Luxury Dress BD', connected: true }, { id: '258170054039575', name: 'Luxury Dress', connected: false }];
const CONTACTS = [
  { pageId: PAGES[0].id, pageName: 'Muslim Abaya', psid: 'a', name: '', lastSeen: 'আজ', lastSeenMs: 2, lastMessage: 'স্টকে আছে?', lastDirection: 'in', unread: 2, status: 'নতুন', fromAd: false, assignedTo: '' },
  { pageId: PAGES[0].id, pageName: 'Muslim Abaya', psid: 'b', name: '', lastSeen: 'আজ', lastSeenMs: 1, lastMessage: 'ধন্যবাদ', lastDirection: 'out', unread: 0, status: 'নতুন', fromAd: false, assignedTo: '' },
  { pageId: PAGES[1].id, pageName: 'Luxury Dress BD', psid: 'c', name: '', lastSeen: 'আজ', lastSeenMs: 1, lastMessage: 'hi', lastDirection: 'in', unread: 1, status: 'নতুন', fromAd: false, assignedTo: '' },
];
const FEED = '"id","title","description","availability","condition","price","link","image_link"\n' +
  '"ABY-MAROON-1","Maroon Abaya Set","d","in stock","new","1250.00 BDT","https://muslimabaya.com/product/ABY-MAROON-1","https://muslimabaya.com/images/maroon.jpeg"\n' +
  '"DR-4","Black White Polka Dot ""Set""","d","out of stock","new","990.00 BDT","https://muslimabaya.com/product/DR-4","https://muslimabaya.com/images/dr4.jpeg"\n';

async function open(page) {
  await page.route('**/admin-guard.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: 'window.MaAdminGuard={require:function(){return Promise.resolve({ok:true,role:"admin",name:"Owner"});}};' }));
  await page.route('**/admin-api.js*', (r) => r.fulfill({ contentType: 'application/javascript', body: `
    window.__calls = [];
    var C = ${JSON.stringify(CONTACTS)};
    window.MaAdmin = { cached: function () { return null; }, logout: function () {},
      inboxCall: function (type, f) {
        window.__calls.push([type, f]);
        if (type === 'InboxThread' || type === 'InboxProfile') return Promise.resolve({ ok: true, contact: C[0], messages: [{ direction: 'in', text: 'স্টকে আছে?', time: 'আজ' }], statuses: ['নতুন'], team: [] });
        if (type === 'InboxProductCard') return Promise.resolve({ ok: true, messageId: 'm1' });
        var list = f && f.PageId ? C.filter(function (c) { return c.pageId === f.PageId; }) : C;
        return Promise.resolve({ ok: true, pages: ${JSON.stringify(PAGES)}, statuses: ['নতুন'], team: [], contacts: list, stats: { total: list.length, unread: list.filter(function (c) { return c.unread; }).length, fromAd: 0, confirmed: 0, byPage: {} } });
      } };` }));
  await page.route('https://graph.facebook.com/**', (r) => r.abort());
  await page.route('**/meta-product-feed.csv*', (r) => r.fulfill({ contentType: 'text/csv', body: FEED }));
  await page.goto('/admin-inbox.html');
}

test('channel column: every Page with its unread count; clicking a Page filters the list; website chat and Telegram open Live support', async ({ page }) => {
  await open(page);
  const ch = page.locator('#ibxChannels');
  // Two columns: the channel list is the "সব কথোপকথন ⌄" dropdown of the conversation column.
  await expect(ch).toBeHidden();
  await expect(page.locator('#ibxChBtn')).toContainText('সব কথোপকথন');
  await page.click('#ibxChBtn');
  await expect(ch.locator('[data-ch-page=""]')).toContainText('সব কথোপকথন');
  await expect(ch.locator('[data-ch-page=""] .ibx-unread')).toHaveText('2');
  await expect(ch.locator('[data-ch-page="381729145014885"] .ibx-unread')).toHaveText('1'); // 1 unread conversation
  await expect(ch.locator('[data-ch-page="381729145014885"] .ibx-ch-count')).toHaveText('2');
  await expect(ch.locator('[data-ch-page="258170054039575"]')).toContainText('Token নেই');
  // A failed logo leaves the first letter.
  await expect(ch.locator('[data-ch-page="964928770039259"] .ibx-ch-icon')).toHaveText('L');
  await ch.locator('[data-ch-page="964928770039259"]').click();
  await expect(ch).toBeHidden(); // closes after choosing
  await expect(page.locator('#ibxChBtn')).toContainText('Luxury Dress BD');
  await expect(page.locator('#ibxList .ibx-item')).toHaveCount(1);
  await page.click('#ibxChBtn');
  expect(await page.evaluate(() => window.__calls.filter((c) => c[0] === 'InboxList').pop()[1].PageId)).toBe('964928770039259');
  await expect(ch.locator('[data-ch-page="964928770039259"]')).toHaveClass(/is-on/);
  // The full-list counts stay while one Page is shown.
  await expect(ch.locator('[data-ch-page="381729145014885"] .ibx-ch-count')).toHaveText('2');
  await expect(ch.locator('a[href="admin-support-inbox.html?channel=website"]')).toContainText('ওয়েবসাইট চ্যাট');
  await expect(ch.locator('a[href="admin-support-inbox.html?channel=telegram"]')).toContainText('Telegram');
});

test('product card: pick a product from the shop feed and it is sent with photo, price and link', async ({ page }) => {
  await open(page);
  await page.locator('#ibxList .ibx-item').first().click();
  await page.click('#ibxProdBtn');
  await expect(page.locator('#ibxProdList .ibx-prod')).toHaveCount(2);
  await expect(page.locator('#ibxProdList')).toContainText('Black White Polka Dot "Set"'); // quoted CSV value
  await expect(page.locator('#ibxProdList [data-prod="DR-4"]')).toContainText('স্টকে নেই');
  await page.fill('#ibxProdQ', 'maroon');
  await expect(page.locator('#ibxProdList .ibx-prod')).toHaveCount(1);
  await page.click('#ibxProdList [data-prod="ABY-MAROON-1"]');
  await expect(page.locator('#ibxThread')).toContainText('পণ্যের কার্ড পাঠানো হয়েছে');
  const sent = await page.evaluate(() => window.__calls.filter((c) => c[0] === 'InboxProductCard').map((c) => c[1]));
  expect(sent).toEqual([{ PageId: '381729145014885', PSID: 'a', Title: 'Maroon Abaya Set', Subtitle: '৳1250 · ক্যাশ অন ডেলিভারি', Url: 'https://muslimabaya.com/product/ABY-MAROON-1', ImageUrl: 'https://muslimabaya.com/images/maroon.jpeg' }]);
});

test('phone: summary is one swipe row, channel dropdown, no sideways page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await page.click('#ibxChBtn');
  await expect(page.locator('#ibxChannels [data-ch-page="381729145014885"]')).toBeVisible();
  await page.keyboard.press('Escape');
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(390);
  const statsH = await page.locator('.ibx-stats').evaluate((el) => el.getBoundingClientRect().height);
  expect(statsH).toBeLessThan(130);
});

test('chat looks like a messaging app: bubbles, product card with View Details, round send, details folded away', async ({ page }) => {
  await open(page);
  await page.route('**/admin-api.js*', (r) => r.continue());
  await page.evaluate(() => {
    const orig = window.MaAdmin.inboxCall;
    window.MaAdmin.inboxCall = function (t, f) {
      if (t === 'InboxThread') return Promise.resolve({ ok: true, contact: { pageId: '381729145014885', pageName: 'Muslim Abaya', psid: 'a', name: 'Sarah' }, messages: [
        { direction: 'in', text: 'আছে?', time: '10:24' },
        { direction: 'out', text: '🛍 Maroon Abaya Set — ৳1250 · ক্যাশ অন ডেলিভারি\nhttps://muslimabaya.com/product/ABY-MAROON-1', time: '10:25', by: 'Owner' }] });
      return orig.apply(this, arguments);
    };
  });
  await page.locator('#ibxList .ibx-item').first().click();
  const card = page.locator('.ibx-card[data-url="https://muslimabaya.com/product/ABY-MAROON-1"]');
  await expect(card).toContainText('Maroon Abaya Set');
  await expect(card).toContainText('৳1250');
  await expect(card.locator('a.ibx-card-btn')).toHaveAttribute('href', 'https://muslimabaya.com/product/ABY-MAROON-1');
  await expect(card.locator('img')).toHaveAttribute('src', 'https://muslimabaya.com/images/maroon.jpeg'); // photo from the shop feed
  await expect(page.locator('.ibx-msg.in')).toHaveCSS('border-top-left-radius', '16px'); // admin theme does not square it
  await expect(page.locator('#ibxSend')).toHaveCSS('border-top-left-radius', /^(21px|50%)$/);
  await expect(page.locator('#ibxDetails')).toBeHidden();
  await page.click('#ibxDetailsBtn');
  await expect(page.locator('#mStatus')).toBeVisible();
  await expect(page.locator('.ibx-list .ibx-item.is-active')).toHaveCSS('background-color', 'rgb(238, 244, 255)');
});


test('compact rows: customer label, friendly media text, short time, Page logo on the avatar, 🔍 search', async ({ page }) => {
  await open(page);
  const rows = page.locator('#ibxList .ibx-item');
  await expect(rows.first().locator('.ibx-name')).toHaveText('গ্রাহক #a'); // no name from Facebook yet
  await expect(rows.first().locator('.ibx-ava-letter')).toBeVisible();
  await expect(rows.first().locator('img.ibx-ava-page')).toHaveCount(0); // logo request blocked in this test → removed
  await expect(rows.first()).not.toContainText('Muslim Abaya'); // no repeated Page tag on every row
  await expect(rows.first()).not.toContainText('নতুন');
  await page.click('#ibxSearchBtn');
  await page.fill('#ibxSearchInput', 'ধন্যবাদ');
  await expect.poll(() => page.evaluate(() => window.__calls.filter((c) => c[0] === 'InboxList').pop()[1].Q)).toBe('ধন্যবাদ');
  expect(await page.evaluate(() => ['[audio]', '[image, video]', 'হ্যালো', '[message]'].map(window.__maInboxText))).toEqual(['🎤 ভয়েস মেসেজ', '📷 ছবি · 🎥 ভিডিও', 'হ্যালো', '💬 মেসেজ']);
});
