// Customer support chat: Bangla-first friendly copy, quick-help chips, and the header (close button)
// stays visible above the site's sticky header on mobile. Live chat backend is blocked here.
const { test, expect } = require('@playwright/test');

async function openChat(page) {
  await page.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
  await page.goto('/index.html');
  await page.waitForSelector('#maChatFab', { timeout: 20000 });
  await page.click('#maChatFab');
  await expect(page.locator('#maChatPanel')).toHaveClass(/is-open/);
}

test('chat greets in Bangla and chips fill a Bangla message', async ({ page }) => {
  await openChat(page);
  await expect(page.locator('.ma-chat-greet')).toContainText('আসসালামু আলাইকুম');
  await expect(page.locator('.ma-chat-input')).toHaveAttribute('placeholder', 'এখানে আপনার প্রশ্ন লিখুন…');
  await expect(page.locator('.ma-chat-chip')).toHaveCount(5);
  await page.locator('.ma-chat-chip', { hasText: 'সাইজ বুঝতে সাহায্য' }).click();
  await expect(page.locator('.ma-chat-input')).toHaveValue(/কোন সাইজ ঠিক হবে/);
  await page.locator('.ma-chat-chip', { hasText: 'আমার অর্ডার কোথায়?' }).click();
  await expect(page.locator('.ma-chat-order-form')).toBeVisible();
});

test('contact details are optional and only shown when requested', async ({ page }) => {
  await openChat(page);
  const prompt = page.getByRole('button', { name: /নাম ও ফোন শেয়ার করুন/ });
  const form = page.locator('.ma-chat-contact');
  await expect(prompt).toBeVisible();
  await expect(form).toBeHidden();
  await prompt.click();
  await expect(prompt).toBeHidden();
  await expect(form).toBeVisible();
  await expect(page.locator('#maChatContactName')).toBeFocused();
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

test('chat panel stays compact on desktop and mobile', async ({ page }) => {
  for (const vp of [{ width: 1280, height: 800 }, { width: 390, height: 844 }, { width: 360, height: 640 }]) {
    await page.setViewportSize(vp);
    await openChat(page);
    const box = await page.locator('#maChatPanel').boundingBox();
    const heightLimit = vp.width <= 560 ? Math.min(560, vp.height * 0.72) + 2 : 600;
    expect(box.height).toBeLessThanOrEqual(heightLimit);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    // quick-help options are a visible two-column grid without a horizontal scroll trap
    const layout = await page.locator('.ma-chat-chips').evaluate((el) => {
      const style = getComputedStyle(el);
      return { display: style.display, columns: style.gridTemplateColumns.trim().split(/\s+/).length, width: el.clientWidth, scrollWidth: el.scrollWidth };
    });
    expect(layout.display).toBe('grid');
    expect(layout.columns).toBe(2);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.width);
  }
});
