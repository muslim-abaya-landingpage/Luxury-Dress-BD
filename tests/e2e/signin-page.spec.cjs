const { test, expect } = require('@playwright/test');

async function stubServer(page, reply) {
  await page.route(/facebook|gtag|doubleclick|cloudflareinsights|googletagmanager|clarity|tiktok|accounts\.google\.com/, (r) => r.abort());
  await page.route(/script\.google(usercontent)?\.com/, (r) => {
    const body = new URLSearchParams(r.request().postData() || '');
    return r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(reply(body)) });
  });
}

test('wrong password shows a plain message, not a code, and keeps the user on the page', async ({ page }) => {
  await stubServer(page, () => ({ ok: false, error: 'INVALID_PASSWORD', message: 'পাসওয়ার্ড ভুল।' }));
  await page.goto('/signin.html');
  await expect(page).toHaveTitle('Sign in | Muslim Abaya');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex, follow/);
  await expect(page.locator('h1')).toHaveText('Sign in');
  await page.fill('#si-login', '01712345678');
  await page.fill('#si-pass', 'wrong-pass');
  await page.click('#signinBtn');
  await expect(page.locator('#signinMsg')).toContainText('password is not right');
  await expect(page.locator('#signinMsg')).not.toContainText('INVALID_PASSWORD');
  await expect(page.locator('#signinBtn')).toBeEnabled();
  await expect(page.locator('.auth-api-notice')).toHaveCount(0);
});

test('after signing in, an outside ?next= address is ignored', async ({ page }) => {
  await stubServer(page, () => ({ ok: true, token: 't', email: 'a@b.co', name: 'A', expires: Date.now() + 3600000 }));
  await page.goto('/signin.html?next=https://evil.example/steal');
  await page.fill('#si-login', 'a@b.co');
  await page.fill('#si-pass', 'secret123');
  await page.click('#signinBtn');
  await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/index.html', { waitUntil: 'commit' });
  expect(new URL(page.url()).hostname).toBe('127.0.0.1');
});

test('a same-site ?next= is kept, and a signed-in visitor skips the form', async ({ page }) => {
  await stubServer(page, () => ({ ok: true }));
  await page.goto('/signin.html');
  await page.evaluate(() => localStorage.setItem('ma_auth_session', JSON.stringify({ token: 't', expires: Date.now() + 3600000 })));
  await page.goto('/signin.html?next=/checkout.html');
  await page.waitForURL(/\/checkout(\.html)?$/, { waitUntil: 'commit' });
});

test('empty fields are flagged next to the field', async ({ page }) => {
  await stubServer(page, () => ({ ok: true }));
  await page.goto('/signin.html');
  await page.click('#signinBtn');
  await expect(page.locator('.am-field.is-invalid')).toHaveCount(2);
  await expect(page.locator('.am-field-error').first()).toContainText('Enter your email or mobile number');
});
