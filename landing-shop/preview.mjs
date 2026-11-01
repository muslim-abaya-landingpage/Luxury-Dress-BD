// লোকাল প্রিভিউ (কোনো ইনস্টল লাগে না, Node 18+): node preview.mjs  →  ব্রাউজারে http://localhost:8080
// আসল Cloudflare-এর মতোই _worker.js দিয়ে চলে (SEO, দাম-যাচাই, /api/order)।
// অর্ডার পরীক্ষা করতে: ORDER_API_URL=<Apps Script URL> node preview.mjs  (না দিলে অর্ডার নেওয়া হয় না — নিরাপদ)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
// HTMLRewriter শুধু Cloudflare-এ থাকে; লোকালে পেজ যেমন আছে তেমন দেখানো হয় (build-seo.cjs আগেই সব বসিয়ে দেয়)।
globalThis.HTMLRewriter ??= class { on() { return this; } transform(r) { return r; } };
const worker = (await import(pathToFileURL(path.join(root, '_worker.js')).href + '?t=' + Date.now())).default;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
const ASSETS = { async fetch(req) {
  let p = decodeURIComponent(new URL(req.url).pathname);
  if (p.endsWith('/')) p += 'index.html';
  let file = path.join(root, p);
  if (!file.startsWith(root)) return new Response('Forbidden', { status: 403 });
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return new Response(fs.readFileSync(path.join(root, '404.html')), { status: 404, headers: { 'Content-Type': types['.html'] } });
  return new Response(fs.readFileSync(file), { headers: { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' } });
} };
const env = { ASSETS, ORDER_API_URL: process.env.ORDER_API_URL || '' };
const port = Number(process.env.PORT) || 8080;
http.createServer(async (req, res) => {
  try {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const r = await worker.fetch(new Request('http://localhost:' + port + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), env, { waitUntil() {} });
    const h = {}; r.headers.forEach((v, k) => { if (k !== 'set-cookie') h[k] = v; });
    res.writeHead(r.status, h); res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(port, () => console.log('প্রিভিউ চালু: http://localhost:' + port + '   (এডিটর: http://localhost:' + port + '/admin.html)   বন্ধ করতে Ctrl+C'));
