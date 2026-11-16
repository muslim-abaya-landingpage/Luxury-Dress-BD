// Purge All (admin bar): owner only, one rebuild per 5 minutes, honest errors.
const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../../functions/api/admin-purge.js');

function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...a) { args = a; return stmt; },
        async run() {
          if (/^CREATE/.test(sql)) return { meta: { changes: 0 } };
          if (/^INSERT/.test(sql)) {
            const [now, limit] = args; const cur = rows.get('purge:last');
            if (!cur || cur.updated_at <= limit) { rows.set('purge:last', { value: 'started', updated_at: now }); return { meta: { changes: 1 } }; }
            return { meta: { changes: 0 } };
          }
          if (/^DELETE/.test(sql)) { const cur = rows.get('purge:last'); if (cur && cur.updated_at === args[0]) rows.delete('purge:last'); return { meta: { changes: 1 } }; }
          throw new Error('unexpected ' + sql);
        },
        async first() { return rows.get('purge:last') || null; }
      };
      return stmt;
    }
  };
}
const req = (body, origin) => new Request('https://muslimabaya.com/api/admin-purge', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, origin ? { Origin: origin } : {}), body: JSON.stringify(body) });
function github(status) {
  const calls = [];
  const f = async (url, init = {}) => { calls.push([init.method || 'GET', url, init.body ? JSON.parse(init.body) : null]); return init.method === 'PUT' ? new Response('{}', { status }) : new Response(JSON.stringify({ sha: 'abc' }), { status: 200 }); };
  f.calls = calls; return f;
}

test('owner click commits one rebuild trigger; a second click within 5 minutes is refused', async () => {
  const { handleAdminPurge } = await load();
  const env = { STOCK_DB: fakeDb(), GITHUB_TOKEN: 't' };
  const gh = github(200); let now = 1_000_000_000_000;
  const deps = { fetch: gh, now: () => now, authorize: async () => '' };
  const a = await (await handleAdminPurge(req({ Token: 'x' }), env, deps)).json();
  assert.equal(a.ok, true);
  const put = gh.calls.filter((c) => c[0] === 'PUT');
  assert.equal(put.length, 1);
  assert.match(put[0][1], /contents\/\.rebuild-trigger$/);
  assert.match(put[0][2].message, /^Rebuild: Purge All from the admin bar/);
  now += 60_000;
  const r2 = await handleAdminPurge(req({ Token: 'x' }), env, deps);
  assert.equal(r2.status, 429);
  const b = await r2.json();
  assert.equal(b.error, 'TOO_SOON'); assert.equal(b.retryAfter, 240);
  now += 5 * 60_000;
  assert.equal((await (await handleAdminPurge(req({ Token: 'x' }), env, deps)).json()).ok, true);
});

test('not logged in / not the owner / other site: nothing is rebuilt', async () => {
  const { handleAdminPurge } = await load();
  const env = { STOCK_DB: fakeDb(), GITHUB_TOKEN: 't' };
  const gh = github(200);
  assert.equal((await handleAdminPurge(req({}), env, { fetch: gh })).status, 401);
  assert.equal((await handleAdminPurge(req({ Token: 'x' }), env, { fetch: gh, authorize: async () => 'OWNER_ONLY' })).status, 403);
  assert.equal((await handleAdminPurge(req({ Token: 'x' }, 'https://evil.example'), env, { fetch: gh, authorize: async () => '' })).status, 403);
  assert.equal(gh.calls.length, 0);
});

test('a failed GitHub commit is reported and does not block the next try', async () => {
  const { handleAdminPurge } = await load();
  const env = { STOCK_DB: fakeDb(), GITHUB_TOKEN: 't' };
  const deps = { fetch: github(409), now: () => 5, authorize: async () => '' };
  const r = await handleAdminPurge(req({ Token: 'x' }), env, deps);
  assert.equal(r.status, 502);
  assert.equal((await r.json()).error, 'COMMIT_409');
  assert.equal(env.STOCK_DB.rows.has('purge:last'), false);
  assert.equal((await (await handleAdminPurge(req({ Token: 'x' }), { STOCK_DB: fakeDb() }, deps)).json()).error, 'NOT_CONFIGURED');
});

test('admin bar: Purge menu with "Purge All" and "Purge this browser", which keeps login and unsaved work', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../admin-wp.js'), 'utf8');
  assert.match(src, /id="wpAbPurgeAll">Purge All</);
  assert.match(src, /id="wpAbPurgeLocal">Purge this browser</);
  assert.match(src, /fetch\('\/api\/admin-purge'/);
  const keys = /LOCAL_CACHE_KEYS = (\[[^\]]*\])/.exec(src)[1];
  assert.doesNotMatch(keys, /session|pending|ma_admin_session/);
});
