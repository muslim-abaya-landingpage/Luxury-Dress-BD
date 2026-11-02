// Support-agent pages send a Cloudflare Turnstile token with every Supabase Auth call
// (needed once CAPTCHA protection is on in Supabase Auth → Attack Protection).
// Turnstile and supabase-js are stubbed: this checks what our pages pass to supabase-js.
const { test, expect } = require('@playwright/test');

const TURNSTILE_STUB = `
  window.__turnstileRenders = [];
  window.turnstile = {
    render: function (box, opts) {
      window.__turnstileRenders.push({ box: box.id, sitekey: opts.sitekey, action: opts.action });
      setTimeout(function () { opts.callback('tok-' + opts.action + '-' + window.__turnstileRenders.length); }, 10);
      return 'w' + window.__turnstileRenders.length;
    },
    remove: function () {}
  };`;

const SUPABASE_STUB = `
  window.__authCalls = [];
  var authErr = { message: 'stub: stop here' };
  var auth = {
    signInWithPassword: function (a) { window.__authCalls.push({ fn: 'signInWithPassword', arg: a }); return Promise.resolve({ data: {}, error: authErr }); },
    signUp: function (a) { window.__authCalls.push({ fn: 'signUp', arg: a }); return Promise.resolve({ data: {}, error: authErr }); },
    resetPasswordForEmail: function (e, o) { window.__authCalls.push({ fn: 'resetPasswordForEmail', email: e, arg: o }); return Promise.resolve({ data: {}, error: null }); },
    getSession: function () { return Promise.resolve({ data: { session: null }, error: null }); },
    getUser: function () { return Promise.resolve({ data: { user: null }, error: null }); },
    onAuthStateChange: function () { return { data: { subscription: { unsubscribe: function () {} } } }; },
    signOut: function () { return Promise.resolve({ error: null }); }
  };
  window.supabase = { createClient: function () { return { auth: auth, from: function () { return {}; }, channel: function () { return { on: function () { return this; }, subscribe: function () { return this; } }; }, removeChannel: function () {} }; } };`;

async function stub(page) {
  await page.route('https://challenges.cloudflare.com/**', (r) => r.fulfill({ contentType: 'application/javascript', body: TURNSTILE_STUB }));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/**', (r) => r.fulfill({ contentType: 'application/javascript', body: SUPABASE_STUB }));
}

test('support inbox sign in and sign up send a Turnstile captchaToken', async ({ page }) => {
  await stub(page);
  await page.goto('/admin-support-inbox.html');
  await page.fill('#email', 'Agent@Example.com');
  await page.fill('#password', 'secret-pass-1');
  await page.click('#loginForm button[type="submit"]');
  await expect.poll(() => page.evaluate(() => window.__authCalls.length)).toBe(1);
  await page.click('#signupBtn');
  await expect.poll(() => page.evaluate(() => window.__authCalls.length)).toBe(2);

  const calls = await page.evaluate(() => window.__authCalls);
  expect(calls[0]).toEqual({ fn: 'signInWithPassword', arg: { email: 'agent@example.com', password: 'secret-pass-1', options: { captchaToken: 'tok-agent_login-1' } } });
  expect(calls[1].fn).toBe('signUp');
  expect(calls[1].arg.options).toEqual({ captchaToken: 'tok-agent_signup-2' });
  const renders = await page.evaluate(() => window.__turnstileRenders);
  expect(renders[0]).toEqual({ box: 'loginCaptcha', sitekey: '0x4AAAAAAFfxnZO3GtKn9kh3', action: 'agent_login' });
  await expect(page.locator('#loginNotice')).toContainText('stub: stop here');
});

test('password reset request sends a Turnstile captchaToken', async ({ page }) => {
  await stub(page);
  await page.goto('/admin-support-reset.html');
  await page.fill('#email', 'agent@example.com');
  await page.click('#requestButton');
  await expect.poll(() => page.evaluate(() => (window.__authCalls || []).length)).toBe(1);
  const call = (await page.evaluate(() => window.__authCalls))[0];
  expect(call.fn).toBe('resetPasswordForEmail');
  expect(call.arg.captchaToken).toBe('tok-agent_reset-1');
  expect(call.arg.redirectTo).toMatch(/\/admin-support-reset\.html$/);
  await expect(page.locator('#requestNotice')).toContainText('recovery email');
});

test('Telegram agent panel sign in sends a Turnstile captchaToken', async ({ page }) => {
  await stub(page);
  await page.goto('/support-agent-telegram.html');
  await page.fill('#email', 'agent@example.com');
  await page.fill('#password', 'secret-pass-1');
  await page.click('#login-form button');
  await expect.poll(() => page.evaluate(() => window.__authCalls.length)).toBe(1);
  const call = (await page.evaluate(() => window.__authCalls))[0];
  expect(call.arg.options).toEqual({ captchaToken: 'tok-agent_login-1' });
  await expect(page.locator('#login-error')).toContainText('stub: stop here');
});

test('a CAPTCHA load failure shows an error and makes no Auth call', async ({ page }) => {
  await page.route('https://challenges.cloudflare.com/**', (r) => r.abort());
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/**', (r) => r.fulfill({ contentType: 'application/javascript', body: SUPABASE_STUB }));
  await page.goto('/admin-support-inbox.html');
  await page.fill('#email', 'agent@example.com');
  await page.fill('#password', 'secret-pass-1');
  await page.click('#loginForm button[type="submit"]');
  await expect(page.locator('#loginNotice')).toContainText('CAPTCHA could not load');
  expect(await page.evaluate(() => window.__authCalls.length)).toBe(0);
});
