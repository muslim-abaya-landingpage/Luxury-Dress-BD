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
  await expect(page.locator('#tab-signin')).toHaveAttribute('aria-selected', 'true');
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

test('sign-up: duplicate email gets a clear message on the email field; +880 mobile is accepted', async ({ page }) => {
  let sent = null;
  await stubServer(page, (body) => { sent = Object.fromEntries(body); return { ok: false, error: 'EMAIL_EXISTS', message: 'এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে।' }; });
  await page.goto('/signup.html?next=https://evil.example/');
  await expect(page).toHaveTitle('Create an account | Muslim Abaya');
  await expect(page.locator('#tab-signup')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#panel-signin')).toHaveAttribute('inert', '');
  await page.fill('#su-name', 'Ayesha Rahman');
  await page.fill('#su-mobile', '+8801712345678');
  await page.fill('#su-email', 'Ayesha@Example.com');
  await page.fill('#su-pass', 'abc12345');
  await page.fill('#su-confirm', 'abc12345');
  await page.click('#signupBtn');
  await expect(page.locator('#signupMsg')).toContainText('already uses this email');
  await expect(page.locator('#su-email')).toBeFocused();
  expect(sent.Phone).toBe('01712345678');
  expect(sent.Email).toBe('ayesha@example.com');
});

test('sign-up: password hint states the full rule and mismatched passwords are flagged', async ({ page }) => {
  await stubServer(page, () => ({ ok: true }));
  await page.goto('/signup.html');
  await expect(page.locator('#suPassHint')).toContainText('a letter and a number');
  await page.fill('#su-pass', 'abc12345');
  await page.fill('#su-confirm', 'abc12399');
  await page.click('#signupBtn');
  await expect(page.locator('.am-field.is-invalid')).toHaveCount(4);
  await expect(page.locator('#su-confirm').locator('xpath=ancestor::div[contains(@class,"am-field")]')).toContainText('Passwords do not match');
});

test('sign-up: success goes to a same-site page only', async ({ page }) => {
  await stubServer(page, () => ({ ok: true, token: 't', email: 'a@b.co', name: 'A', expires: Date.now() + 3600000 }));
  await page.goto('/signup.html?next=//evil.example/x');
  await page.fill('#su-name', 'Ayesha Rahman');
  await page.fill('#su-mobile', '01712345678');
  await page.fill('#su-email', 'a@b.co');
  await page.fill('#su-pass', 'abc12345');
  await page.fill('#su-confirm', 'abc12345');
  await page.click('#signupBtn');
  await page.waitForURL((u) => u.pathname === '/' || u.pathname === '/index.html', { waitUntil: 'commit' });
  expect(new URL(page.url()).hostname).toBe('127.0.0.1');
});

test('sign in / sign up slide side by side without reloading, and the address follows', async ({ page }) => {
  await stubServer(page, () => ({ ok: true }));
  await page.goto('/signin.html?next=/checkout.html');
  await page.evaluate(() => { window.__sameDoc = true; });
  await expect(page.locator('.si-perks')).toHaveCount(0);
  await page.click('#tab-signup');
  await expect(page.locator('#authTrack')).toHaveAttribute('data-active', 'signup');
  await expect(page).toHaveURL(/\/signup\?next=%2Fcheckout\.html$|\/signup\?next=\/checkout\.html$/);
  await expect(page).toHaveTitle('Create an account | Muslim Abaya');
  await expect(page.locator('#su-name')).toBeVisible();
  await expect.poll(() => page.evaluate(() => { const r = document.getElementById('panel-signup').getBoundingClientRect(); const v = document.querySelector('.si-viewport').getBoundingClientRect(); return Math.round(r.left - v.left); })).toBeLessThan(4);
  await page.click('#panel-signup [data-auth-tab="signin"]');
  await expect(page.locator('#authTrack')).toHaveAttribute('data-active', 'signin');
  await expect(page.locator('#si-login')).toBeFocused();
  expect(await page.evaluate(() => window.__sameDoc)).toBe(true);
});
