// Customer support chat: Bangla-first clean layout (start screen, message box), and the header (close button)
// stays visible above the site's sticky header on mobile. Live chat backend is blocked here.
const { test, expect } = require('@playwright/test');

async function waitForChatDrawer(page) {
  const panel = page.locator('#maChatPanel');
  await expect(panel).toHaveClass(/is-open/);
  // The panel intentionally slides in; wait until its transform finishes before
  // checking hit targets or viewport bounds (class visibility alone is immediate).
  await expect.poll(() => panel.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.left >= -0.5 && box.right <= window.innerWidth + 0.5;
  })).toBe(true);
}

async function openChat(page) {
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
  await page.goto('/index.html');
  await page.waitForSelector('#maChatFab', { timeout: 20000 });
  await page.click('#maChatFab');
  await waitForChatDrawer(page);
}

async function openChatWithMockHistory(page) {
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
  await page.addInitScript(() => {
    window.SITE_CHAT = { supabaseUrl: 'https://mock.supabase.co', supabaseKey: 'test-public-key' };
    window.__supportMessageRows = [
      { id: 'customer-message-1', conversation_id: 'test-conversation', sender_id: 'test-visitor', sender_role: 'customer', body: '1080', created_at: '2026-11-06T01:43:00.000Z' },
      { id: 'agent-message-1', conversation_id: 'test-conversation', sender_id: 'support-agent', sender_role: 'agent', body: 'আপনাকে সাইজে সাহায্য করছি।', created_at: '2026-11-06T01:44:00.000Z' }
    ];
    window.__supportMessageDeleteCalls = 0;
    function query() {
      return {
        select() { return this; },
        insert() { return Promise.resolve({ data: null, error: null }); },
        update() { return this; },
        delete() { window.__supportMessageDeleteCalls += 1; return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return Promise.resolve({ data: window.__supportMessageRows, error: null }); },
        maybeSingle() { return Promise.resolve({ data: { id: 'test-conversation', status: 'open' }, error: null }); },
        is() { return Promise.resolve({ error: null }); }
      };
    }
    window.supabase = {
      createClient() {
        return {
          auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'test-visitor' } } } }) },
          from: () => query(),
          channel: () => ({ on() { return this; }, subscribe(callback) { if (callback) callback('SUBSCRIBED'); return this; } }),
          removeChannel: () => Promise.resolve(),
          storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://mock.supabase.co/test-file' }, error: null }) }) },
          functions: { invoke: () => Promise.resolve({ error: null }) }
        };
      }
    };
    localStorage.setItem('maSupportConversation:test-visitor', 'test-conversation');
  });
  await page.goto('/index.html');
  await page.waitForSelector('#maChatFab', { timeout: 20000 });
  await page.click('#maChatFab');
  await waitForChatDrawer(page);
  await expect(page.locator('.ma-chat-transcript .ma-chat-message')).toHaveCount(2);
}

test('clean start screen: heading, one line and the message box only (no quick-topic buttons)', async ({ page }) => {
  await openChat(page);
  await expect(page.locator('.ma-chat-empty')).toBeVisible();
  await expect(page.locator('.ma-chat-brand img')).toHaveAttribute('src', '/assets/logo-muslim-abaya.svg');
  await expect(page.locator('.ma-chat-brand img')).toHaveAttribute('alt', 'Muslim Abaya');
  await expect(page.locator('.ma-chat-brand img')).toBeVisible();
  await expect(page.locator('.ma-chat-brand-text')).toHaveCount(0);
  await expect(page.locator('.ma-chat-empty strong')).toHaveText('কাস্টমার সাপোর্ট');
  await expect(page.locator('#maChatFab .ma-chat-fab-label')).toHaveText('CUSTOMER SUPPORT');
  await expect(page.locator('#maChatFab .ma-chat-fab-badge img')).toBeVisible();
  await expect(page.locator('.ma-chat-empty strong')).toHaveText('কাস্টমার সাপোর্ট');
  await expect(page.locator('.ma-chat-online')).toContainText('লাইভ সাপোর্ট');
  await expect(page.locator('.ma-chat-input')).toHaveAttribute('placeholder', 'Write your message / এখানে লিখুন…');
  await expect(page.locator('.ma-chat-chips')).toBeHidden();
  await expect(page.locator('.ma-chat-contact-prompt')).toBeHidden();
  // WhatsApp / Messenger links show only when the live chat cannot connect (this mock cannot connect).
  await expect(page.locator('#maChatPanel')).toHaveClass(/ma-chat-fallback/);
  await expect(page.locator('.ma-chat-alt')).toBeVisible();
  await page.evaluate(() => document.getElementById('maChatPanel').classList.remove('ma-chat-fallback'));
  await expect(page.locator('.ma-chat-alt')).toBeHidden();
  await expect(page.locator('.ma-chat-attach')).toBeVisible();
  await expect(page.locator('.ma-chat-verified')).toHaveText('✓');
  await expect(page.locator('#maChatSub')).toContainText('Online · Replies in 2m');
  await expect(page.locator('.ma-chat-head button[aria-label="চ্যাট বন্ধ করুন"] svg path').first()).toHaveAttribute('d', 'M19 12H5');
  const send = page.locator('.ma-chat-send');
  const composerInput = page.locator('.ma-chat-input');
  await expect(send).toHaveAttribute('aria-disabled', 'true');
  await expect(send).toHaveClass(/is-disabled/);
  await expect(send.locator('svg')).toHaveAttribute('stroke', 'currentColor');
  await expect(composerInput).toHaveCSS('background-color', 'rgb(247, 246, 243)');
  await expect(page.locator('.ma-chat-note')).toHaveCSS('font-size', '10px');
  await composerInput.fill('Hello Muslim Abaya');
  await expect(send).toHaveAttribute('aria-disabled', 'false');
  await expect(send).not.toHaveClass(/is-disabled/);
  await composerInput.fill('');
  await expect(send).toHaveAttribute('aria-disabled', 'true');
});

test('message delete and clear only hide local history; support-team records remain', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openChatWithMockHistory(page);
  const firstMessage = page.locator('.ma-chat-transcript .ma-chat-message').first();
  const panelBounds = await page.locator('#maChatPanel').boundingBox();
  const removeBounds = await firstMessage.getByRole('button', { name: 'এই ডিভাইসের চ্যাট থেকে মেসেজটি মুছুন' }).boundingBox();
  expect(panelBounds.x).toBeGreaterThanOrEqual(0);
  expect(panelBounds.x + panelBounds.width).toBeLessThanOrEqual(390);
  expect(removeBounds.x).toBeGreaterThanOrEqual(0);
  expect(removeBounds.x + removeBounds.width).toBeLessThanOrEqual(390);
  await firstMessage.getByRole('button', { name: 'এই ডিভাইসের চ্যাট থেকে মেসেজটি মুছুন' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('সাপোর্ট টিমের কাছে আসল মেসেজ ও সংযুক্তির কপি থাকবে');
  await dialog.getByRole('button', { name: 'এই ডিভাইস থেকে সরান' }).click();
  await expect(page.locator('.ma-chat-transcript .ma-chat-message')).toHaveCount(1);
  await expect(page.locator('.ma-chat-note')).toContainText('সাপোর্ট টিমের কপি থাকবে');
  let hiddenIds = await page.evaluate(() => JSON.parse(localStorage.getItem('maSupportHiddenMessages:test-conversation')));
  expect(hiddenIds).toContain('customer-message-1');
  expect(await page.evaluate(() => window.__supportMessageDeleteCalls)).toBe(0);

  await page.reload();
  await page.waitForSelector('#maChatFab');
  await page.click('#maChatFab');
  await expect(page.locator('.ma-chat-transcript .ma-chat-message')).toHaveCount(1);
  await expect(page.locator('.ma-chat-transcript .ma-chat-message')).toContainText('আপনাকে সাইজে সাহায্য করছি।');
  await page.getByRole('button', { name: 'এই ডিভাইসের চ্যাট পরিষ্কার করুন' }).click();
  const clearDialog = page.getByRole('alertdialog');
  await expect(clearDialog).toContainText('সাপোর্ট টিমের কাছে সব কপি থাকবে');
  await clearDialog.getByRole('button', { name: 'চ্যাট পরিষ্কার করুন' }).click();
  await expect(page.locator('.ma-chat-transcript .ma-chat-message')).toHaveCount(0);
  await expect(page.locator('.ma-chat-body')).not.toHaveClass(/has-messages/);
  await expect(page.locator('.ma-chat-note')).toContainText('সাপোর্ট টিমের কপি অক্ষত আছে');
  hiddenIds = await page.evaluate(() => JSON.parse(localStorage.getItem('maSupportHiddenMessages:test-conversation')));
  expect(hiddenIds).toContain('customer-message-1');
  expect(hiddenIds).toContain('agent-message-1');
  expect(await page.evaluate(() => window.__supportMessageRows.length)).toBe(2);
  expect(await page.evaluate(() => window.__supportMessageDeleteCalls)).toBe(0);
});

test('image attachment is previewed as a draft and can be removed before sending', async ({ page }) => {
  await openChat(page);
  const file = { name: 'customer-photo.png', mimeType: 'image/png', buffer: Buffer.from('fake-png-for-preview') };
  await page.locator('.ma-chat-panel input[type="file"]').setInputFiles(file);
  const draft = page.locator('.ma-chat-image-draft');
  await expect(draft).toBeVisible();
  await expect(draft.locator('img')).toHaveAttribute('alt', 'পাঠানোর জন্য নির্বাচিত ছবির প্রিভিউ');
  await expect(draft).toContainText('customer-photo.png');
  await expect(page.locator('.ma-chat-transcript .ma-chat-message')).toHaveCount(0);
  await page.locator('.ma-chat-panel input[type="file"]').setInputFiles({
    name: 'replacement-photo.webp', mimeType: 'image/webp', buffer: Buffer.from('replacement-image')
  });
  await expect(draft).toContainText('replacement-photo.webp');
  await expect(draft).not.toContainText('customer-photo.png');
  await page.getByRole('button', { name: 'ছবি সরান' }).click();
  await expect(draft).toBeHidden();
  await expect(page.locator('.ma-chat-transcript .ma-chat-message')).toHaveCount(0);
});

test('mobile: chat header and close button are on top of the site header', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openChat(page);
  const closeBtn = page.locator('.ma-chat-head button[aria-label="চ্যাট বন্ধ করুন"]');
  const box = await closeBtn.boundingBox();
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return Boolean(el && el.closest('.ma-chat-head'));
  }, [box.x + box.width / 2, box.y + box.height / 2]);
  expect(hit).toBe(true);
  await closeBtn.click();
  await expect(page.locator('#maChatPanel')).not.toHaveClass(/is-open/);
});

test('chat panel: compact box on desktop, full screen that fits the visible area on phones', async ({ page }) => {
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 360, height: 640 }, { width: 360, height: 420 }]) {
    await page.setViewportSize(vp);
    await openChat(page);
    const box = await page.locator('#maChatPanel').boundingBox();
    if (vp.width <= 560) {
      // phone: whole visible screen (the keyboard shrinks it), header and message box both on screen
      expect(Math.abs(box.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(box.height - vp.height)).toBeLessThanOrEqual(2);
      const head = await page.locator('#maChatPanel .ma-chat-head').boundingBox();
      const foot = await page.locator('#maChatPanel .ma-chat-input').boundingBox();
      expect(head.y).toBeGreaterThanOrEqual(0);
      expect(foot.y + foot.height).toBeLessThanOrEqual(vp.height);
      await expect(page.locator('.ma-chat-fab')).toBeHidden();
      await expect(page.locator('body')).toHaveClass(/ma-chat-mobile-open/);
    } else {
      expect(box.height).toBeLessThanOrEqual(600);
    }
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    // message box fits: image button, input and send on one row without sideways scrolling
    const row = await page.locator('.ma-chat-row').evaluate((el) => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
    expect(row.scrollWidth).toBeLessThanOrEqual(row.width);
  }
});
