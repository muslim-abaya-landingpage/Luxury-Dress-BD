/**
 * POST /api/catalog-save — fast product save from the owner panel.
 *
 * Does in one Cloudflare request what used to take two trips (Apps Script → GitHub, then /api/live-publish):
 *   1. owner login check (cached for a minute, see _lib/owner-auth.js)
 *   2. the same checks as Apps Script cpValidate_ (4 catalog files, base SHAs, request id)
 *   3. one GitHub commit with the 4 catalog files (Git Data API: ref → commit → tree → new tree → commit →
 *      move main with force:false, so a parallel save or edit is reported as CATALOG_CONFLICT, never overwritten)
 *   4. the catalog is put in D1 so the website shows it at once (same as /api/live-publish)
 * The commit is finished before the answer is sent, so nothing is lost if the browser closes.
 * Photos are not accepted here: they are uploaded to R2 first (/api/image-upload) and the files hold URLs.
 *
 * Needs the Pages secret GITHUB_TOKEN (fine-grained token, this repository, Contents: Read and write).
 * Without it the endpoint answers NOT_CONFIGURED and the panel uses the old Apps Script path.
 *
 * Body: {Token, requestId, baseShas:{path:sha}, files:[{path,content}×4], validation, index, names}
 */
import { isOwner, isOwnerCached } from '../_lib/owner-auth.js';
import { CATALOG_FILES } from '../_lib/live-catalog.js';
import { validatePayload, writeLiveState } from './live-publish.js';

const MAX_BODY = 14 * 1024 * 1024;
const DEFAULT_REPO = 'muslim-abaya-landingpage/Luxury-Dress-BD';
const COMMIT_MESSAGE = 'Publish product catalog from owner panel';

const MESSAGES = {
  CATALOG_CONFLICT: 'অন্য জায়গা থেকে পণ্য বদলেছে। আপনার ফর্মটি রেখে নতুন ডেটা লোড করুন।',
  CATALOG_REFRESH_REQUIRED: 'বর্তমান পণ্যের তথ্য নতুন করে লোড করুন।',
  REQUEST_CHANGED: 'আগের অনুরোধের তথ্য বদলেছে। নতুন করে সেভ করুন।',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function fail(code, status) {
  return json({ ok: false, error: code, message: MESSAGES[code] || 'প্রকাশ করা যায়নি। তথ্য অক্ষত আছে; আবার চেষ্টা করুন।' }, status);
}
async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Same rules as apps-script/CatalogPublish.gs cpValidate_ (photos are not allowed here). */
export function validateSave(p) {
  if (!p || !/^[-a-zA-Z0-9]{16,80}$/.test(String(p.requestId || ''))) throw Error('INVALID_REQUEST_ID');
  if (!Array.isArray(p.files) || p.files.length !== CATALOG_FILES.length) throw Error('CATALOG_FILES_REQUIRED');
  const seen = {};
  p.files.forEach((f) => {
    if (!f || CATALOG_FILES.indexOf(f.path) < 0 || seen[f.path] || typeof f.content !== 'string' || !f.content || f.content.length > 1500000) throw Error('INVALID_CATALOG_FILE');
    seen[f.path] = true;
  });
  if (!p.baseShas || CATALOG_FILES.some((path) => !/^[a-f0-9]{40}$/.test(String(p.baseShas[path] || '')))) throw Error('CATALOG_REFRESH_REQUIRED');
  if (Array.isArray(p.assets) && p.assets.length) throw Error('R2_REQUIRED');
  if (typeof p.validation !== 'string') throw Error('BAD_VALIDATION');
  return p;
}

function github(env, fetchImpl) {
  const repo = env.GITHUB_REPO || DEFAULT_REPO;
  return async function gh(method, path, body) {
    const res = await fetchImpl('https://api.github.com/repos/' + repo + '/' + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + env.GITHUB_TOKEN,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'MuslimAbaya-Catalog',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 409 || res.status === 422) throw Error('CATALOG_CONFLICT');
    if (res.status === 401 || res.status === 403 || res.status === 404) throw Error('GITHUB_ACCESS_' + res.status);
    if (!res.ok) throw Error('PUBLISH_HTTP_' + res.status);
    return res.json();
  };
}

/** Commits the 4 files on top of main; fails with CATALOG_CONFLICT if they changed since the panel loaded them. */
export async function commitCatalog(gh, files, baseShas) {
  const ref = await gh('GET', 'git/ref/heads/main');
  const head = ref.object.sha;
  const commit = await gh('GET', 'git/commits/' + head);
  const tree = await gh('GET', 'git/trees/' + commit.tree.sha);
  const current = {};
  (tree.tree || []).forEach((f) => { if (CATALOG_FILES.indexOf(f.path) >= 0) current[f.path] = f.sha; });
  if (CATALOG_FILES.some((path) => !current[path])) throw Error('CATALOG_FILES_MISSING');
  if (CATALOG_FILES.some((path) => current[path] !== baseShas[path])) throw Error('CATALOG_CONFLICT');
  const newTree = await gh('POST', 'git/trees', {
    base_tree: commit.tree.sha,
    tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
  });
  const newCommit = await gh('POST', 'git/commits', { message: COMMIT_MESSAGE, tree: newTree.sha, parents: [head] });
  await gh('PATCH', 'git/refs/heads/main', { sha: newCommit.sha, force: false });
  const shas = {};
  (newTree.tree || []).forEach((f) => { if (CATALOG_FILES.indexOf(f.path) >= 0) shas[f.path] = f.sha; });
  return { sha: newCommit.sha, shas };
}

async function ensureReceipts(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS catalog_save_receipts (request_id TEXT PRIMARY KEY, digest TEXT NOT NULL, result TEXT NOT NULL, saved_at INTEGER NOT NULL)').run();
}

export async function handleCatalogSave(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  const site = new URL(request.url).origin;
  if (origin && origin !== site) return json({ ok: false, error: 'ORIGIN' }, 403);
  if (!env || !env.GITHUB_TOKEN || !env.STOCK_DB || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BODY) return json({ ok: false, error: 'TOO_LARGE' }, 413);

  let payload;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return json({ ok: false, error: 'TOO_LARGE' }, 413);
    payload = JSON.parse(text);
  } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  const token = String(payload && payload.Token || '').trim();
  if (!token) return json({ ok: false, error: 'NO_TOKEN' }, 401);

  try {
    const error = deps.authorize ? await deps.authorize(token, env) : await isOwnerCached(token, now, () => isOwner(token, env, fetchImpl, now));
    if (error === 'NOT_LOGGED_IN') return json({ ok: false, error }, 401);
    if (error) return json({ ok: false, error }, 403);
  } catch (e) { return json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503); }

  try { validateSave(payload); } catch (e) { return fail(String(e.message || 'BAD_REQUEST'), 400); }

  // Same request sent again (a retry after a dropped connection): answer with the first result.
  const db = env.STOCK_DB;
  const digest = await sha256(JSON.stringify({ files: payload.files, baseShas: payload.baseShas }));
  try {
    await ensureReceipts(db);
    const prior = await db.prepare('SELECT digest, result FROM catalog_save_receipts WHERE request_id = ?').bind(payload.requestId).first();
    if (prior) return prior.digest === digest ? json(JSON.parse(prior.result)) : fail('REQUEST_CHANGED', 409);
  } catch (e) { /* receipts are a convenience; GitHub's force:false still prevents double commits */ }

  let saved;
  try {
    saved = await commitCatalog(github(env, fetchImpl), payload.files, payload.baseShas);
  } catch (e) {
    const code = String(e.message || 'PUBLISH_FAILED');
    return fail(code, code === 'CATALOG_CONFLICT' ? 409 : 502);
  }

  const result = { ok: true, version: 1, sha: saved.sha, shas: saved.shas, live: false };
  // Live at once: the order-price check data is stamped with the new commit, then stored in D1.
  try {
    const v = JSON.parse(payload.validation);
    v.releaseSha = saved.sha;
    const files = {};
    payload.files.forEach((f) => { files[f.path] = f.content; });
    const checked = validatePayload({ sha: saved.sha, files, validation: JSON.stringify(v), index: payload.index, names: payload.names });
    await writeLiveState(db, site, checked.state, now, deps);
    result.live = true;
  } catch (e) {
    result.liveError = String(e.message || 'LIVE_FAILED').slice(0, 60);
  }
  try {
    await db.prepare('INSERT OR REPLACE INTO catalog_save_receipts (request_id, digest, result, saved_at) VALUES (?, ?, ?, ?)')
      .bind(payload.requestId, digest, JSON.stringify(result), now).run();
    await db.prepare('DELETE FROM catalog_save_receipts WHERE saved_at < ?').bind(now - 6 * 3600 * 1000).run();
  } catch (e) {}
  return json(result);
}

export const onRequestPost = ({ request, env }) => handleCatalogSave(request, env);
