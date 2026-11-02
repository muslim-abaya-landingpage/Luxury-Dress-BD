// On-site popup checkout: Order Now / Buy Now opens a popup, the order is sent with the same fields as
// /checkout, and WhatsApp is offered only after the order is saved. The order server is mocked here
// (script.google.com), so these tests prove what the browser sends and shows — not the live Google Sheet.
const { test, expect } = require('@playwright/test');

const ORDER_ID = 'MA-20261102-4321';

async function setup(page, opts) {
  opts = opts || {};
  const posts = [];
  await page.route(/googletagmanager|gtm\.js|analytics\.tiktok|connect\.facebook|clarity\.ms/, (r) => r.fulfill({ status: 204, body: '' }));
  await page.route(/script\.google\.com/, async (r) => {
    if (r.request().method() !== 'POST') {
      return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{}' });
    }
    const body = r.request().postData() || '';
    const p = new URLSearchParams(body);
    if (p.get('RecordType') !== 'Order') {
      return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'application/json', body: '{"ok":true}' });
    }
    posts.push(p);
    const reply = opts.reply ? opts.reply(p, posts.length) : 'Success|' + ORDER_ID;
    if (reply === 'ABORT') return r.abort('internetdisconnected');
    if (opts.delayMs) await new Promise((res) => setTimeout(res, opts.delayMs));
    return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, contentType: 'text/plain', body: reply });
  });
  page.on('dialog', (d) => d.accept());
  return posts;
}

async function openFromProductPage(page, id, pick) {
  await page.goto('/product/' + id);
  const root = page.locator('.pqv-muslim-abaya').first();
  await expect(root.locator('.pqv-act-buy').first()).toBeVisible();
  if (pick) await pick(root);
  await root.locator('.pqv-act-buy').first().click();
  await expect(page.locator('.ma-cop.is-open')).toBeVisible();
  return page.locator('.ma-cop');
}

async function fill(page, o) {
  o = Object.assign({ name: 'Fatema Akter', phone: '01712345678', district: 'ঢাকা', area: 1, address: 'House 12, Road 5, Block C' }, o || {});
  if (o.name != null) await page.fill('#ma-cop-name', o.name);
  if (o.phone != null) await page.fill('#ma-cop-phone', o.phone);
  if (o.district) {
    const idx = await page.locator('#ma-cop-district option').evaluateAll((els, bn) => els.findIndex((e) => e.textContent.indexOf(bn) === 0), o.district);
    await page.selectOption('#ma-cop-district', { index: idx });
    if (await page.locator('#ma-cop-area-text').count()) await page.fill('#ma-cop-area-text', 'Sadar');
    else await page.selectOption('#ma-cop-area', { index: o.area });
  }
  if (o.address != null) await page.fill('#ma-cop-address', o.address);
  if (o.note) await page.fill('#ma-cop-note', o.note);
}

const total = (page) => page.locator('[data-cop-total]').innerText();
const fee = (page) => page.locator('[data-cop-fee]').innerText();

test('abaya: popup shows the chosen size, totals follow qty + district, order saved, then optional WhatsApp', async ({ page }) => {
  const posts = await setup(page);
  const pop = await openFromProductPage(page, 'ABY-MAROON-1', async (root) => {
    await root.locator('.pqv-length-opt[data-length-value="54"]').first().click();
  });
  await expect(pop.locator('.ma-cop__name')).toContainText('Maroon Abaya');
  await expect(pop.locator('.ma-cop__item')).toContainText('Length 54');
  await expect(pop.locator('.ma-cop__img')).toHaveAttribute('src', /\S/);
  const unit = parseInt((await pop.locator('[data-cop-unit]').innerText()).replace(/\D/g, ''), 10);
  expect(unit).toBeGreaterThan(0);
  await expect(page.locator('[data-cop-fee]')).toHaveText('জেলা বাছাই করুন');
  await fill(page);
  await expect(page.locator('[data-cop-fee]')).toHaveText('৳80');
  await page.click('[data-cop-qty="1"]');
  expect((await total(page)).replace(/\D/g, '')).toBe(String(unit * 2 + 80));
  await fill(page, { name: null, phone: null, address: null, district: 'চট্টগ্রাম' });
  expect(await fee(page)).toBe('৳150');
  await page.click('[data-cop-qty="1"]');
  expect(await fee(page)).toBe('ফ্রি');
  expect((await total(page)).replace(/\D/g, '')).toBe(String(unit * 3));
  await page.click('[data-cop-qty="-1"]');
  await page.fill('#ma-cop-note', 'ডেলিভারির আগে কল করবেন');
  await page.click('[data-cop-go]');
  await expect(page.locator('[data-cop-success]')).toBeVisible();
  await expect(page.locator('[data-cop-oid]')).toHaveText(ORDER_ID);
  expect(posts.length).toBe(1);
  const p = posts[0];
  expect(p.get('RecordType')).toBe('Order');
  expect(p.get('Phone')).toBe('01712345678');
  expect(p.get('District')).toBe('চট্টগ্রাম');
  expect(p.get('Quantity')).toBe('2');
  expect(p.get('Total')).toBe(String(unit * 2 + 150));
  expect(p.get('PaymentMethod')).toBe('Cash On Delivery');
  expect(p.get('SpecialNotes')).toContain('ডেলিভারির আগে কল করবেন');
  expect(p.get('Address')).toContain('চট্টগ্রাম');
  expect(p.get('EventID')).toMatch(/^order_\d+_[a-z0-9]+$/);
  const cart = JSON.parse(p.get('CartJSON'));
  expect(cart).toHaveLength(1);
  expect(cart[0]).toMatchObject({ id: 'ABY-MAROON-1', qty: 2, price: unit, category: 'abaya' });
  expect(cart[0].size).toMatch(/Length 54/);
  // WhatsApp appears only now, after the order was saved, and carries the order ID.
  const wa = page.locator('[data-cop-wa]');
  await expect(wa).toBeVisible();
  expect(decodeURIComponent(await wa.getAttribute('href'))).toContain(ORDER_ID);
  // The customer's cart is not touched by an Order Now order.
  expect(await page.evaluate(() => window.loadStoreCart({ readOnly: true }).length)).toBe(0);
  await page.click('.ma-cop__acts [data-cop-close]');
  await expect(page.locator('.ma-cop')).toHaveCount(0);
});

for (const c of [
  { label: 'two-piece', id: 'TP-6', cat: 'premium-two-piece' },
  { label: 'kurti', id: 'KURTI-02', cat: 'tops-kurti' },
  { label: 'panjabi', id: 'PAN-001', cat: 'panjabi' }
]) {
  test(c.label + ': Buy Now opens the popup and the order carries this category\'s own size text', async ({ page }) => {
    const posts = await setup(page);
    await openFromProductPage(page, c.id);
    const shownSize = (await page.locator('.ma-cop__item').innerText());
    await fill(page);
    await page.click('[data-cop-go]');
    await expect(page.locator('[data-cop-success]')).toBeVisible();
    expect(posts.length).toBe(1);
    const line = JSON.parse(posts[0].get('CartJSON'))[0];
    expect(line.id).toBe(c.id);
    expect(line.category).toBe(c.cat);
    expect(line.size).not.toBe('');
    expect(shownSize).toContain('সাইজ');
  });
}

test('validation: missing fields and a wrong mobile number are shown and nothing is sent', async ({ page }) => {
  const posts = await setup(page);
  await openFromProductPage(page, 'KURTI-02');
  await page.click('[data-cop-go]');
  for (const k of ['name', 'phone', 'district', 'area', 'address']) {
    await expect(page.locator(`[data-cop-f="${k}"]`)).toHaveClass(/is-bad/);
  }
  await fill(page, { phone: '0171234' });
  await page.click('[data-cop-go]');
  await expect(page.locator('[data-cop-f="phone"]')).toHaveClass(/is-bad/);
  await page.fill('#ma-cop-phone', '01212345678'); // 012 is not a BD mobile prefix
  await page.click('[data-cop-go]');
  await expect(page.locator('[data-cop-f="phone"]')).toHaveClass(/is-bad/);
  expect(posts.length).toBe(0);
  // Bangla digits and +880 are accepted and sent as 01XXXXXXXXX.
  await page.fill('#ma-cop-phone', '+৮৮০ ১৮১২-৩৪৫৬৭৮');
  await page.click('[data-cop-go]');
  await expect(page.locator('[data-cop-success]')).toBeVisible();
  expect(posts[0].get('Phone')).toBe('01812345678');
});

test('duplicate: double tapping Confirm sends one order and the button shows loading', async ({ page }) => {
  const posts = await setup(page, { delayMs: 800 });
  await openFromProductPage(page, 'KURTI-02');
  await fill(page);
  const go = page.locator('[data-cop-go]');
  await go.click();
  await expect(go).toBeDisabled();
  await expect(go).toHaveClass(/is-busy/);
  await go.click({ force: true }).catch(() => {});
  await page.locator('.ma-cop__form').evaluate((f) => f.requestSubmit());
  await expect(page.locator('[data-cop-success]')).toBeVisible();
  expect(posts.length).toBe(1);
});

test('network failure: clear message, nothing claimed; retry sends the SAME attempt (EventID) and succeeds', async ({ page }) => {
  const posts = await setup(page, { reply: (p, n) => (n === 1 ? 'ABORT' : 'Success|' + ORDER_ID) });
  await openFromProductPage(page, 'KURTI-02');
  await fill(page);
  await page.click('[data-cop-go]');
  await expect(page.locator('[data-cop-alert]')).toHaveClass(/is-on/);
  await expect(page.locator('[data-cop-alert]')).toContainText('একই অর্ডার দুবার হবে না');
  await expect(page.locator('[data-cop-success]')).toHaveCount(0);
  await expect(page.locator('[data-cop-go]')).toBeEnabled();
  await page.click('[data-cop-go]');
  await expect(page.locator('[data-cop-success]')).toBeVisible();
  expect(posts.length).toBe(2);
  expect(posts[1].get('EventID')).toBe(posts[0].get('EventID'));
});

test('out of stock / server refusal: the server message is shown and no success screen', async ({ page }) => {
  const posts = await setup(page, { reply: () => 'Error|দুঃখিত, Kurti এই মুহূর্তে স্টকে নেই। অন্য একটি পণ্য বেছে নিন অথবা কিছুক্ষণ পর আবার চেষ্টা করুন।' });
  await openFromProductPage(page, 'KURTI-02');
  await fill(page);
  await page.click('[data-cop-go]');
  await expect(page.locator('[data-cop-alert]')).toContainText('স্টকে নেই');
  await expect(page.locator('[data-cop-success]')).toHaveCount(0);
  await expect(page.locator('[data-cop-wa]')).toHaveCount(0);
  expect(posts.length).toBe(1);
});

test('out of stock product: Order Now on the product page is disabled', async ({ page }) => {
  await setup(page);
  await page.route(/\/category-products\.js(\?.*)?$/, async (r) => {
    const res = await r.fetch();
    const body = (await res.text()).replace('id: "KURTI-02",', 'id: "KURTI-02",\n      inStock: false,');
    return r.fulfill({ contentType: 'application/javascript', body });
  });
  await page.goto('/product/KURTI-02');
  await expect(page.locator('.pqv-act-buy').first()).toBeDisabled();
});

test('shop grid card "অর্ডার করুন" no longer leaves for WhatsApp: it opens the quick view or the popup', async ({ page }) => {
  await setup(page);
  await page.goto('/tops-kurti');
  const btn = page.locator('.card-actions-muslim-abaya .muslim-abaya-btn-msg').first();
  await expect(btn).toBeVisible();
  expect(await btn.evaluate((el) => el.tagName)).toBe('BUTTON');
  await btn.click();
  // Kurti has two sizes, so the product view opens first for the size; nothing goes to WhatsApp.
  await expect(page.locator('.pqv-muslim-abaya .pqv-act-buy').first()).toBeVisible();
  expect(page.url()).not.toContain('wa.me');
  await expect(page.locator('.ma-cop')).toHaveCount(0);
  // Then Buy Now there opens the popup.
  await page.locator('.pqv-muslim-abaya .pqv-act-buy').first().click();
  await expect(page.locator('.ma-cop.is-open')).toBeVisible();
});

test('shop grid card for a one-size product opens the popup straight away', async ({ page }) => {
  await setup(page);
  await page.goto('/hijab');
  const btn = page.locator('.card-actions-muslim-abaya .muslim-abaya-btn-msg').first();
  await btn.click();
  await expect(page.locator('.ma-cop.is-open')).toBeVisible();
  await expect(page.locator('.ma-cop__item')).toContainText('Free Size');
});

test('popup script cannot load: Buy Now falls back to the checkout page as before', async ({ page }) => {
  await setup(page);
  await page.route(/checkout-popup\.js/, (r) => r.abort());
  await page.goto('/product/KURTI-02');
  await page.locator('.pqv-muslim-abaya .pqv-act-buy').first().click();
  await page.waitForURL(/checkout/);
  expect(await page.evaluate(() => window.loadStoreCart({ readOnly: true }).length)).toBe(1);
});

for (const vp of [{ w: 360, h: 740 }, { w: 390, h: 844 }, { w: 1280, h: 860 }]) {
  test(`layout ${vp.w}px: popup fits the screen, no sideways scroll, big confirm button`, async ({ page }) => {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await setup(page);
    await openFromProductPage(page, 'ABY-MAROON-1');
    await page.waitForTimeout(400); // open animation
    const box = await page.locator('.ma-cop__panel').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.w + 0.5);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.h + 0.5);
    const overflow = await page.locator('.ma-cop__body').evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.locator('[data-cop-go]').scrollIntoViewIfNeeded();
    const go = await page.locator('[data-cop-go]').boundingBox();
    expect(go.height).toBeGreaterThanOrEqual(48);
    // Phone-size inputs use 16px text so iOS does not zoom in.
    expect(await page.locator('#ma-cop-phone').evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
    // Escape closes it.
    await page.keyboard.press('Escape');
    await expect(page.locator('.ma-cop')).toHaveCount(0);
  });
}
