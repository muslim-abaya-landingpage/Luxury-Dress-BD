/**
 * POST /api/media-library — owner-only list / delete of the photos uploaded from the admin panel to R2
 * (bucket muslimabaya-product-images, keys images/uploads/<name>-<20 hex>.webp, see image-upload.js).
 * Photos that live in the website folder (images/… in GitHub) are listed by media-manifest.json, built at deploy.
 *
 *   {Token, action:"list"}             → {ok, items:[{key, url, size, uploaded, sourcePath}]}, newest first
 *   {Token, action:"delete", key}      → deletes the photo and its "-card" copy, unless a product still uses it
 *
 * Delete safety: the key must be a panel upload, and the current catalog (instant live copy in D1 and the
 * deployed category-products.js) must not mention it. If the catalog cannot be read, nothing is deleted.
 */
import { isOwner, isOwnerCached } from '../_lib/owner-auth.js';

const CDN_BASE = 'https://images.muslimabaya.com/';
const UPLOAD_KEY = /^images\/uploads\/[a-z0-9_-]+-[0-9a-f]{20}\.webp$/;
const MAX_PAGES = 20;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
export function cdnUrl(key) { return CDN_BASE + key.split('/').map(encodeURIComponent).join('/'); }
/** "-card" copies are smaller versions made for product cards; the library shows only the main photo. */
export function isCardCopy(key) { return /-card(?:-[0-9a-f]{20})?\.[a-z]+$/i.test(key); }

export async function listUploads(bucket) {
  const all = [];
  let cursor;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await bucket.list({ prefix: 'images/uploads/', cursor, include: ['customMetadata'] });
    (res.objects || []).forEach((o) => {
      if (!UPLOAD_KEY.test(o.key)) return;
      all.push({
        key: o.key,
        url: cdnUrl(o.key),
        size: o.size || 0,
        uploaded: o.uploaded ? new Date(o.uploaded).getTime() : 0,
        sourcePath: (o.customMetadata && o.customMetadata.sourcePath) || '',
      });
    });
    if (!res.truncated) break;
    cursor = res.cursor;
  }
  // Pair each photo with its card copy (same source name + "-card"), then drop the copies from the list.
  const cardBySource = {};
  all.forEach((o) => { if (isCardCopy(o.key) && o.sourcePath) cardBySource[o.sourcePath] = o.url; });
  return all.filter((o) => !isCardCopy(o.key))
    .map((o) => {
      const card = o.sourcePath ? cardBySource[o.sourcePath.replace(/\.webp$/, '-card.webp')] : '';
      return card ? Object.assign(o, { card }) : o;
    })
    .sort((a, b) => b.uploaded - a.uploaded);
}

/** Every catalog text we can read now; throws when none can be read (then nothing may be deleted). */
export async function catalogTexts(env, origin) {
  const texts = [];
  try {
    const row = env.STOCK_DB && await env.STOCK_DB.prepare('SELECT v FROM live_catalog WHERE k = ?').bind('state').first();
    if (row && row.v) texts.push(String(row.v));
  } catch (e) { /* table may not exist yet */ }
  try {
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(new Request(origin + '/category-products.js'));
      if (res.ok) texts.push(await res.text());
    }
  } catch (e) {}
  if (!texts.length) throw Error('CATALOG_UNREADABLE');
  return texts;
}
export function usedIn(texts, key) {
  const forms = [key, cdnUrl(key), encodeURI(key)];
  return texts.some((t) => forms.some((f) => t.indexOf(f) !== -1 || t.indexOf(JSON.stringify(f).slice(1, -1)) !== -1));
}

export async function handleMediaLibrary(request, env, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = deps.now ? deps.now() : Date.now();
  if (request.method !== 'POST') return json({ ok: false, error: 'METHOD' }, 405);
  const site = new URL(request.url).origin;
  const origin = request.headers.get('Origin');
  if (origin && origin !== site) return json({ ok: false, error: 'ORIGIN' }, 403);
  if (!env || !env.PRODUCT_IMAGES || !env.GOOGLE_SA_JSON) return json({ ok: false, error: 'NOT_CONFIGURED' }, 503);

  let payload;
  try { payload = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, error: 'BAD_REQUEST' }, 400); }
  const token = String(payload && payload.Token || '').trim();
  if (!token) return json({ ok: false, error: 'NO_TOKEN' }, 401);
  try {
    const error = deps.authorize ? await deps.authorize(token, env) : await isOwnerCached(token, now, () => isOwner(token, env, fetchImpl, now));
    if (error === 'NOT_LOGGED_IN') return json({ ok: false, error }, 401);
    if (error) return json({ ok: false, error }, 403);
  } catch (e) { return json({ ok: false, error: 'AUTH_UNAVAILABLE' }, 503); }

  const bucket = env.PRODUCT_IMAGES;
  if (payload.action === 'list') {
    try { return json({ ok: true, items: await listUploads(bucket) }); }
    catch (e) { return json({ ok: false, error: 'R2_LIST_FAILED' }, 503); }
  }

  if (payload.action === 'delete') {
    const key = String(payload.key || '');
    if (!UPLOAD_KEY.test(key) || isCardCopy(key)) return json({ ok: false, error: 'NOT_DELETABLE', message: 'শুধু প্যানেল থেকে আপলোড করা ছবি এখানে মোছা যায়।' }, 400);
    let texts;
    try { texts = await catalogTexts(env, site); }
    catch (e) { return json({ ok: false, error: 'CATALOG_UNREADABLE', message: 'পণ্যের তালিকা পড়া যায়নি, তাই কিছু মোছা হয়নি। পরে আবার চেষ্টা করুন।' }, 503); }
    if (usedIn(texts, key)) return json({ ok: false, error: 'IN_USE', message: 'এই ছবি এখনো কোনো পণ্যে ব্যবহার হচ্ছে, তাই মোছা হয়নি।' }, 409);
    try {
      const head = await bucket.head(key);
      if (!head) return json({ ok: true, deleted: [] });
      const source = head.customMetadata && head.customMetadata.sourcePath;
      const keys = [key];
      if (source) {
        const cardSource = source.replace(/\.webp$/, '-card.webp');
        (await listCards(bucket, cardSource)).forEach((k) => { if (!usedIn(texts, k)) keys.push(k); });
      }
      await bucket.delete(keys);
      return json({ ok: true, deleted: keys });
    } catch (e) { return json({ ok: false, error: 'R2_DELETE_FAILED' }, 503); }
  }
  return json({ ok: false, error: 'BAD_ACTION' }, 400);
}

async function listCards(bucket, cardSource) {
  const stem = cardSource.replace(/\.webp$/, '-');
  const res = await bucket.list({ prefix: stem, include: ['customMetadata'] });
  return (res.objects || []).filter((o) => UPLOAD_KEY.test(o.key) && o.customMetadata && o.customMetadata.sourcePath === cardSource).map((o) => o.key);
}

export const onRequestPost = ({ request, env }) => handleMediaLibrary(request, env);
