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
