/**
 * POST /api/token-status — owner-only health check of the secrets stored in Cloudflare Pages (luxury-dress-bd).
 * Never returns a secret, only whether it is set, whether it works and when it expires.
 *
 * GITHUB_TOKEN is checked against GitHub; its expiry comes from the "github-authentication-token-expiration"
 * response header (absent when the token was made with "No expiration").
 */
import { isOwner, isOwnerCached } from '../_lib/owner-auth.js';

const DEFAULT_REPO = 'muslim-abaya-landingpage/Luxury-Dress-BD';
const WARN_DAYS = 14;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}

/** "2026-12-01 10:00:00 UTC" or "2026-12-01 10:00:00 +0600" → Date (null when unreadable). */
export function parseGithubExpiry(text) {
  const m = /^(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d)\s*(UTC|Z|[+-]\d\d:?\d\d)?/.exec(String(text || '').trim());
  if (!m) return null;
  let zone = m[3] || 'Z';
  if (zone === 'UTC') zone = 'Z';
  else if (/^[+-]\d{4}$/.test(zone)) zone = zone.slice(0, 3) + ':' + zone.slice(3);
  const d = new Date(m[1] + 'T' + m[2] + zone);
  return isNaN(d.getTime()) ? null : d;
}

export async function checkGithubToken(env, fetchImpl, now) {
  const out = { id: 'cf-github', name: 'GITHUB_TOKEN', where: 'Cloudflare → luxury-dress-bd → Settings → Variables and Secrets', configured: !!env.GITHUB_TOKEN };
  if (!env.GITHUB_TOKEN) return Object.assign(out, { state: 'off', message: 'বসানো নেই — দ্রুত-সেভ বন্ধ, সেভ পুরোনো পথে (ধীরে) হচ্ছে।' });
  let res;
  try {
    res = await fetchImpl('https://api.github.com/repos/' + (env.GITHUB_REPO || DEFAULT_REPO), {
      headers: { Authorization: 'Bearer ' + env.GITHUB_TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'MuslimAbaya-TokenStatus', 'X-GitHub-Api-Version': '2022-11-28' },
    });
  } catch (e) {
    return Object.assign(out, { state: 'warn', message: 'GitHub-এ যাচাই করা যায়নি, পরে আবার দেখুন।' });
  }
  if (res.status === 401) return Object.assign(out, { state: 'bad', message: 'টোকেন কাজ করছে না (মেয়াদ শেষ বা মুছে ফেলা)। নতুন টোকেন বানিয়ে বদলান।' });
  if (!res.ok) return Object.assign(out, { state: 'bad', message: 'GitHub উত্তর দিয়েছে ' + res.status + '। টোকেনে Luxury-Dress-BD রিপো আর Contents: Read and write আছে কিনা দেখুন।' });
  const header = res.headers.get('github-authentication-token-expiration');
  if (!header) return Object.assign(out, { state: 'ok', expiresAt: null, message: 'ঠিক আছে · মেয়াদ নেই (No expiration)' });
  const when = parseGithubExpiry(header);
  if (!when) return Object.assign(out, { state: 'ok', expiresAt: header, message: 'ঠিক আছে · মেয়াদ: ' + header });
  const days = Math.floor((when.getTime() - now) / 86400000);
  const date = new Date(when.getTime() + 6 * 3600000).toISOString().slice(0, 10);
  out.expiresAt = when.toISOString();
  out.daysLeft = days;
  if (days < 0) return Object.assign(out, { state: 'bad', message: 'মেয়াদ শেষ হয়েছে ' + date + '। নতুন টোকেন বানিয়ে বদলান।' });
  if (days <= WARN_DAYS) return Object.assign(out, { state: 'warn', message: 'মেয়াদ শেষ হবে ' + date + ' (' + days + ' দিন বাকি)। এখনই নতুন টোকেন বানিয়ে বদলান।' });
  return Object.assign(out, { state: 'ok', message: 'ঠিক আছে · মেয়াদ শেষ ' + date + ' (' + days + ' দিন বাকি)' });
}

export async function handleTokenStatus(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ ok: false, error: 'ORIGIN' }, 403);
  let payload;
  try { payload = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  const token = String(payload && payload.Token || '').trim();
  if (!token) return json({ ok: false, error: 'NO_TOKEN' }, 401);
  if (!env || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);
  try {
    const error = deps.authorize ? await deps.authorize(token, env) : await isOwnerCached(token, now, () => isOwner(token, env, fetchImpl, now));
    if (error) return json({ ok: false, error }, error === 'NOT_LOGGED_IN' ? 401 : 403);
  } catch (e) { return json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503); }

  const items = [await checkGithubToken(env, fetchImpl, now)];
  items.push({ id: 'cf-google', name: 'GOOGLE_SA_JSON', where: 'Cloudflare → luxury-dress-bd → Settings → Variables and Secrets', configured: true, state: 'ok', message: 'বসানো আছে (Google Sheet পড়া চলছে বলেই এই পেজ খুলেছে)' });
  items.push({ id: 'cf-db', name: 'STOCK_DB / PRODUCT_IMAGES', where: 'Cloudflare → luxury-dress-bd → Settings → Bindings', configured: !!(env.STOCK_DB && env.PRODUCT_IMAGES), state: env.STOCK_DB && env.PRODUCT_IMAGES ? 'ok' : 'bad', message: env.STOCK_DB && env.PRODUCT_IMAGES ? 'যুক্ত আছে' : 'D1 বা R2 সংযোগ নেই' });
  return json({ ok: true, checkedAt: new Date(now).toISOString(), items });
}

export const onRequestPost = ({ request, env }) => handleTokenStatus(request, env);
