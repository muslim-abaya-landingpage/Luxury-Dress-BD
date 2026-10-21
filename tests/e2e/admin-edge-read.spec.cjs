const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const API = 'https://script.google.com/macros/s/TEST/exec';
const apiSource = fs.readFileSync(path.join(__dirname, '../../admin-api.js'), 'utf8');

async function setup(page, edgeHandler) {
  const calls = { edge: 0, apps: [] };
  await page.route('**/api/admin-read', async (route) => { calls.edge++; await edgeHandler(route); });
  await page.route(API, (route) => {
    const body = new URLSearchParams(route.request().postData() || '');
    calls.apps.push(body.get('RecordType'));
    route.fulfill({ contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, source: 'apps', orders: [] }) });
  });
  await page.goto('/index.html');
  await page.evaluate(({ src, api }) => {
    sessionStorage.clear();
    localStorage.setItem('ma_admin_session', JSON.stringify({ token: 'tok', role: 'admin', expires: Date.now() + 3600000 }));
    window.MA_ADMIN_CONFIG = { apiUrl: api };
    (0, eval)(src);
  }, { src: apiSource, api: API });
  return calls;
}

test('order reads come from the fast edge copy when it answers ok', async ({ page }) => {
  const calls = await setup(page, (r) => r.fulfill({ contentType: 'application/json', headers: { 'X-MA-Source': 'edge' }, body: JSON.stringify({ ok: true, source: 'edge', orders: [] }) }));
  const res = await page.evaluate(() => window.MaAdmin.call('AdminOrderList', { Limit: 80 }));
  expect(res.source).toBe('edge');
  expect(calls.apps).toEqual([]);
  // Writes and other reads never use the edge.
  await page.evaluate(() => window.MaAdmin.call('AdminOrderUpdate', { OrderId: 'MA-1' }));
  await page.evaluate(() => window.MaAdmin.call('AdminStockVariantsList', {}));
  expect(calls.edge).toBe(1);
  expect(calls.apps).toEqual(['AdminOrderUpdate', 'AdminStockVariantsList']);
});

test('anything but ok from the edge falls back to Apps Script', async ({ page }) => {
  const calls = await setup(page, (r) => r.fulfill({ status: 409, contentType: 'application/json', headers: { 'X-MA-Source': 'edge' }, body: JSON.stringify({ ok: false, error: 'EDGE_DECLINED' }) }));
  const res = await page.evaluate(() => window.MaAdmin.call('AdminOrderGet', { OrderId: 'MA-1' }));
  expect(res.source).toBe('apps');
  expect(calls.apps).toEqual(['AdminOrderGet']);
});

test('an unconfigured edge is skipped after the first try', async ({ page }) => {
  const calls = await setup(page, (r) => r.fulfill({ status: 503, contentType: 'application/json', headers: { 'X-MA-Source': 'edge' }, body: JSON.stringify({ ok: false, error: 'NOT_CONFIGURED' }) }));
  await page.evaluate(() => window.MaAdmin.call('AdminOrderList', { Limit: 80 }, {}));
  await page.evaluate(() => window.MaAdmin.call('AdminOrderGet', { OrderId: 'MA-2' }));
  expect(calls.edge).toBe(1);
  expect(calls.apps).toEqual(['AdminOrderList', 'AdminOrderGet']);
});
