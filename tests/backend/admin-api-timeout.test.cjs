const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const apiSource = fs.readFileSync(path.join(__dirname, '../../admin-api.js'), 'utf8');
const hostSetTimeout = setTimeout;

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index],
    get length() { return values.size; }
  };
}

function fixture() {
  const calls = [];
  const timeoutDelays = [];
  const localStorage = storage();
  const sessionStorage = storage();
  localStorage.setItem('ma_admin_session', JSON.stringify({ token: 'session-a', role: 'admin', expires: Date.now() + 60000 }));
  const window = { MA_ADMIN_CONFIG: { apiUrl: 'https://example.invalid/api' } };
  const context = vm.createContext({
    window, localStorage, sessionStorage, URLSearchParams, Date, Promise,
    setTimeout: (callback, delay, ...args) => {
      timeoutDelays.push(Number(delay));
      return hostSetTimeout(callback, Math.min(Number(delay) || 0, 40), ...args);
    },
    clearTimeout,
    location: { pathname: '/admin-dashboard', search: '', href: '' },
    document: { documentElement: { getAttribute: () => null } },
    fetch: (url, options) => new Promise(resolve => calls.push({
      url: String(url),
      fields: Object.fromEntries(options.body),
      reply: body => resolve({ text: () => Promise.resolve(JSON.stringify(body)) })
    }))
  });
  vm.runInNewContext(apiSource, context, { filename: 'admin-api.js' });
  return { window, calls, timeoutDelays };
}

async function checkBoundedRequest(makeRequest) {
  const f = fixture();
  const pending = makeRequest(f.window.MaAdmin);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.calls.length, 1, 'one read request should reach fetch');
  await assert.rejects(pending, /REQUEST_TIMEOUT/);
  assert.ok(f.timeoutDelays.includes(25), 'the request should use the dashboard timeout');
  assert.ok(!f.timeoutDelays.includes(30000), 'the request should not use the 30-second default');
}

test('AdminOrderList accepts a dashboard-specific timeout', async () => {
  await checkBoundedRequest(api => api.call('AdminOrderList', { Limit: 1000 }, { timeoutMs: 25 }));
});

test('stock variant reads accept a dashboard-specific timeout', async () => {
  await checkBoundedRequest(api => api.getStockVariants({ stockStatus: 'all', timeoutMs: 25 }));
});
