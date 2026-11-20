// Sign-in page in the reference layout, "Login With OTP Instead" (code by email) and Forgot Password.
const { test, expect } = require('@playwright/test');

async function stubServer(page, reply) {
  const calls = [];
  await page.route(/facebook|gtag|doubleclick|cloudflareinsights|googletagmanager|clarity|tiktok|accounts\.google\.com/, (r) => r.abort());
  await page.route(/script\.google(usercontent)?\.com/, (r) => {
    const body = Object.fromEntries(new URLSearchParams(r.request().postData() || ''));
    calls.push(body);
    return r.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(reply(body)) });
  });
  return calls;
}
const SENT = { ok: true, message: 'If an account exists for this email or mobile number, a 6-digit code has been sent to its email. Check Inbox and Spam.' };

test('layout: Welcome heading, black active tab, forgot link, OTP link, Register footer, Terms & Privacy line', async ({ page }) => {
  await stubServer(page, () => ({ ok: true }));
  await page.goto('/signin.html');
  await expect(page.locator('h1')).toHaveText('Welcome');
  await expect(page.locator('#siKicker')).toHaveText('Sign in to your account');
  expect(await page.locator('#tab-signin').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(17, 17, 17)');
  await expect(page.locator('#si-login')).toHaveAttribute('placeholder', 'Enter your email or phone number');
  await expect(page.locator('.si-forgot')).toHaveAttribute('href', '/forgot-password');
  await expect(page.locator('[data-si-mode="otp"]')).toHaveText('Login With OTP Instead');
  await expect(page.locator('.si-foot:visible')).toContainText("Don't have an account?");
  await expect(page.locator('.si-legal a')).toHaveText(['Terms', 'Privacy Policy']);
  for (const sel of ['.si-card', '#signinBtn', '.si-tab', '.am-input input']) {
    expect(await page.locator(sel).first().evaluate((e) => getComputedStyle(e).borderRadius), sel).toBe('0px');
  }
  // switching to Sign up changes the caption and the footer line
  await page.click('#tab-signup');
  await expect(page.locator('#siKicker')).toHaveText('Create your account');
  await expect(page.locator('.si-foot:visible')).toContainText('Already have an account?');
});

test('OTP sign-in: code is asked for the typed mobile number, then the code signs in', async ({ page }) => {
  const calls = await stubServer(page, (b) => (b.RecordType === 'CustomerCodeRequest' ? SENT : b.RecordType === 'CustomerCodeLogin'
    ? (b.Code === '123456' ? { ok: true, token: 't', email: 'a@b.co', name: 'A', expires: Date.now() + 3600000 } : { ok: false, error: 'INVALID_CODE' }) : { ok: true }));
  await page.goto('/signin.html?next=/checkout.html');
  await page.fill('#si-login', '+880 1712-345678');
  await page.click('[data-si-mode="otp"]');
  await expect(page.locator('#signinForm')).toBeHidden();
  await expect(page.locator('#otp-login')).toHaveValue('+880 1712-345678'); // carried over
  await page.click('#otpBtn');
  await expect(page.locator('#otpMsg')).toContainText('6-digit code has been sent');
  expect(calls.at(-1)).toMatchObject({ RecordType: 'CustomerCodeRequest', Login: '01712345678', Purpose: 'login' });
  await expect(page.locator('#otpResend')).toBeDisabled(); // 60 s wait before a new code
  await expect(page.locator('#otpBtn')).toHaveText('Verify & sign in');
  await page.fill('#otp-code', '999999');
  await page.click('#otpBtn');
  await expect(page.locator('#otpMsg')).toContainText('not right or has expired');
  await page.fill('#otp-code', '12a3456');
  await expect(page.locator('#otp-code')).toHaveValue('123456');
  await page.click('#otpBtn');
  await page.waitForURL(/\/checkout(\.html)?$/, { waitUntil: 'commit' });
  expect(calls.at(-1)).toMatchObject({ RecordType: 'CustomerCodeLogin', Login: '01712345678', Code: '123456' });
});

test('OTP: "Login With Password Instead" goes back to the password form', async ({ page }) => {
  await stubServer(page, () => ({ ok: true }));
  await page.goto('/signin.html');
  await page.click('[data-si-mode="otp"]');
  await page.click('[data-si-mode="password"]');
  await expect(page.locator('#signinForm')).toBeVisible();
  await expect(page.locator('#otpForm')).toBeHidden();
});

test('forgot password: code by email, new password set, signed in', async ({ page }) => {
  const calls = await stubServer(page, (b) => (b.RecordType === 'CustomerCodeRequest' ? SENT
    : b.RecordType === 'CustomerPasswordReset' ? { ok: true, token: 't', email: 'sumi@example.com', name: 'Sumi', expires: Date.now() + 3600000 } : { ok: true }));
  await page.goto('/forgot-password.html');
  await expect(page.locator('h1')).toHaveText('Forgot Password');
  await expect(page.locator('#fpStep2')).toBeHidden();
  await page.fill('#fp-login', 'Sumi@Example.com');
  await page.click('#forgotBtn');
  await expect(page.locator('#forgotMsg')).toContainText('6-digit code has been sent');
  expect(calls.at(-1)).toMatchObject({ RecordType: 'CustomerCodeRequest', Login: 'sumi@example.com', Purpose: 'reset' });
  await expect(page.locator('#fpStep2')).toBeVisible();
  await page.fill('#fp-code', '123456');
  await page.fill('#fp-pass', 'newpass12');
  await page.fill('#fp-confirm', 'newpass99');
  await page.click('#forgotBtn');
  await expect(page.locator('#forgotMsg')).toContainText('do not match');
  await page.fill('#fp-confirm', 'newpass12');
  await page.click('#forgotBtn');
  await expect(page.locator('#forgotMsg')).toContainText('password has been changed');
  expect(calls.at(-1)).toMatchObject({ RecordType: 'CustomerPasswordReset', Login: 'sumi@example.com', Code: '123456', Password: 'newpass12' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ma_auth_session')).token)).toBe('t');
});

test('forgot password: out of daily email quota shows a plain message', async ({ page }) => {
  await stubServer(page, () => ({ ok: false, error: 'EMAIL_LIMIT', message: 'x' }));
  await page.goto('/forgot-password.html');
  await page.fill('#fp-login', '01712345678');
  await page.click('#forgotBtn');
  await expect(page.locator('#forgotMsg')).toContainText('cannot send codes right now');
  await expect(page.locator('#fpStep2')).toBeHidden();
});

test('OTP: the panel top stays in view after the code box gets the cursor', async ({ page }) => {
  await stubServer(page, () => SENT);
  await page.goto('/signin.html');
  await page.click('[data-si-mode="otp"]');
  await page.fill('#otp-login', 'a@b.co');
  await page.click('#otpBtn');
  await expect(page.locator('#otp-code')).toBeFocused();
  expect(await page.locator('.si-viewport').evaluate((v) => v.scrollTop)).toBe(0);
  await expect(page.locator('#panel-signin .si-sub')).toBeInViewport();
});
