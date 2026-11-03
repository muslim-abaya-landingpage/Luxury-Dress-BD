// Copies every file under images/ that is not yet in the R2 bucket, under the same key
// (images/<path>), so https://images.muslimabaya.com/images/<path> serves the same photo.
// Backup only: it never overwrites or deletes an object, and the site keeps serving /images/ from Pages.
// Needs CF_TOKEN with "Workers R2 Storage Write" on the account. DRY_RUN=1 lists what it would upload.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ACCOUNT = process.env.ACCOUNT_ID || 'b24e0c217c57ed7b4e19e104a1411309';
const BUCKET = process.env.BUCKET || 'muslimabaya-product-images';
const TOKEN = process.env.CF_TOKEN || '';
const DRY = process.env.DRY_RUN === '1';
const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2/buckets/${BUCKET}/objects`;
const TYPES = { webp: 'image/webp', avif: 'image/avif', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif' };

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.posix.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

export function imageFiles(root = 'images') {
  return walk(root).filter((p) => TYPES[p.split('.').pop().toLowerCase()]).sort();
}

async function cf(method, url, body, headers = {}) {
  const res = await fetch(url, { method, body, headers: { Authorization: `Bearer ${TOKEN}`, ...headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${url.replace(API, '<bucket>')} -> ${res.status} ${JSON.stringify(json.errors || [])}`);
  }
  return json;
}

async function remoteObjects() {
  const out = new Map();
  let cursor;
  do {
    const q = new URLSearchParams({ per_page: '1000', prefix: 'images/' });
    if (cursor) q.set('cursor', cursor);
    const r = await cf('GET', `${API}?${q}`);
    for (const o of r.result || []) out.set(o.key, Number(o.size));
    cursor = r.result_info && r.result_info.is_truncated ? r.result_info.cursor : '';
  } while (cursor);
  return out;
}

async function main() {
  if (!TOKEN) throw new Error('CF_TOKEN is not set');
  const files = imageFiles();
  const before = await remoteObjects();
  const todo = files.filter((f) => !before.has(f));
  console.log(`images/: ${files.length} files, already in R2: ${files.length - todo.length}, to upload: ${todo.length}`);
  if (DRY) { todo.forEach((f) => console.log('would upload', f)); return; }

  let done = 0;
  const queue = todo.slice();
  async function worker() {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const body = fs.readFileSync(f);
      const type = TYPES[f.split('.').pop().toLowerCase()];
      const key = f.split('/').map(encodeURIComponent).join('/');
      for (let attempt = 1; ; attempt++) {
        try {
          await cf('PUT', `${API}/${key}`, body, { 'Content-Type': type });
          break;
        } catch (e) {
          if (attempt >= 4) throw e;
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
      }
      if (++done % 50 === 0) console.log(`uploaded ${done}/${todo.length}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));

  // Verify: every local file is in R2 with the same size.
  const after = await remoteObjects();
  const missing = files.filter((f) => !after.has(f));
  const wrongSize = files.filter((f) => after.has(f) && after.get(f) !== fs.statSync(f).size);
  const sha = crypto.createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
  console.log(`verify: ${files.length - missing.length}/${files.length} in R2, size mismatches: ${wrongSize.length}, list hash ${sha}`);
  if (missing.length || wrongSize.length) {
    missing.forEach((f) => console.error('missing', f));
    wrongSize.forEach((f) => console.error('size differs', f, fs.statSync(f).size, after.get(f)));
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
