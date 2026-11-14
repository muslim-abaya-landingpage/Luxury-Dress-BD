/**
 * POST /api/seo-report
 *   Owner (Admin → SEO Manager):   {Token, action:"get"} → {ok, build, pages, live:[latest scheduled audits]}
 *       build = seo-report.json (checked at every deploy), pages = seo-pages.json (automatic vs manual page SEO)
 *   Scheduled audit (GitHub Actions, .github/workflows/seo-audit.yml), body = the live-site report → stored in D1:
 *       Authorization: Bearer <GitHub OIDC token> — signed by GitHub for this repository's main-branch seo-audit
 *       workflow (no secret to set up or rotate), or header X-SEO-Audit-Key = Pages secret SEO_AUDIT_KEY.
 */
import { ownerRequest } from './seo-settings.js';
import { verifyGithubOidc } from '../_lib/github-oidc.js';

export const OIDC = { audience: 'https://muslimabaya.com/api/seo-report', repository: 'muslim-abaya-landingpage/Luxury-Dress-BD', workflow: '.github/workflows/seo-audit.yml', ref: 'refs/heads/main' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
async function ensureTable(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS seo_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, source TEXT NOT NULL, report TEXT NOT NULL)').run();
}
function sameKey(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
/** Keeps only the fields the dashboard shows, with length limits (the body comes from a workflow, not a browser). */
export function cleanLiveReport(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.issues)) throw Error('BAD_REPORT');
  const t = (v, n) => String(v == null ? '' : v).slice(0, n);
  const levels = ['error', 'warning', 'info'];
  const issues = r.issues.slice(0, 500).filter((i) => i && levels.indexOf(i.level) >= 0).map((i) => ({ level: i.level, type: t(i.type, 40), url: t(i.url, 300), message: t(i.message, 400), fix: t(i.fix, 300) }));
  const s = r.summary || {};
  const num = (v) => Math.max(0, Math.min(100000, Number(v) || 0));
  return {
    version: 1, source: 'live', generatedAt: t(r.generatedAt, 40),
    summary: { urls: num(s.urls), errors: issues.filter((i) => i.level === 'error').length, warnings: issues.filter((i) => i.level === 'warning').length, info: issues.filter((i) => i.level === 'info').length, msAverage: num(s.msAverage) },
    issues,
  };
}

export async function handleSeoReport(request, env, deps = {}) {
  const db = env && env.STOCK_DB;
  const auditKey = request.headers.get('X-SEO-Audit-Key');
  const bearer = /^Bearer\s+(\S+)$/.exec(request.headers.get('Authorization') || '');
  if (auditKey !== null || bearer) {
    if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
    let allowed = auditKey !== null && !!env.SEO_AUDIT_KEY && sameKey(auditKey, env.SEO_AUDIT_KEY);
    if (!allowed && bearer) {
      try { await verifyGithubOidc(bearer[1], OIDC, deps.fetch || fetch, deps.now ? deps.now() : Date.now()); allowed = true; }
      catch (e) { return json({ ok: false, error: 'FORBIDDEN', reason: String(e.message || '').slice(0, 30) }, 403); }
    }
    if (!allowed) return json({ ok: false, error: 'FORBIDDEN' }, 403);
    if (!db) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
    let report;
    try { const text = await request.text(); if (text.length > 600000) throw Error('big'); report = cleanLiveReport(JSON.parse(text)); }
    catch (e) { return json({ ok: false, error: 'BAD_REPORT' }, 400); }
    const now = deps.now ? deps.now() : Date.now();
    await ensureTable(db);
    await db.prepare('INSERT INTO seo_reports (created_at, source, report) VALUES (?, ?, ?)').bind(now, 'live', JSON.stringify(report)).run();
    await db.prepare('DELETE FROM seo_reports WHERE id NOT IN (SELECT id FROM seo_reports ORDER BY id DESC LIMIT 60)').run();
    return json({ ok: true, stored: true, summary: report.summary });
  }

  const req = await ownerRequest(request, env, deps);
  if (req.response) return req.response;
  if (req.payload.action !== 'get') return json({ ok: false, error: 'UNKNOWN_ACTION' }, 400);
  const origin = new URL(request.url).origin;
  const asset = async (name) => {
    try {
      const res = env.ASSETS ? await env.ASSETS.fetch(new Request(origin + '/' + name)) : await req.fetchImpl(origin + '/' + name);
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  };
  const [build, pages] = await Promise.all([asset('seo-report.json'), asset('seo-pages.json')]);
  let live = [];
  if (db) {
    try {
      await ensureTable(db);
      const rows = await db.prepare('SELECT created_at, report FROM seo_reports ORDER BY id DESC LIMIT 14').all();
      live = (rows.results || []).map((r, i) => {
        const rep = JSON.parse(r.report);
        // Full issue list only for the newest run; older runs give the trend.
        return i === 0 ? Object.assign(rep, { storedAt: r.created_at }) : { storedAt: r.created_at, generatedAt: rep.generatedAt, summary: rep.summary };
      });
    } catch (e) { live = []; }
  }
  return json({ ok: true, build, pages, live, scheduled: true });
}

export const onRequestPost = ({ request, env }) => handleSeoReport(request, env);
