// Regenerates apps-script-copy.html from apps-script/*.gs|*.html.
// Cross-platform equivalent of scripts/build-apps-script-copy.ps1.
// Run after changing any file in apps-script/:  node scripts/build-apps-script-copy.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'apps-script');
const preferred = ['Code.gs', 'AdminOrders.gs', 'FixSheetHeaders.gs'];
const all = fs.readdirSync(dir).filter(n => /\.(gs|html)$/.test(n));
const files = preferred.filter(n => all.includes(n))
  .concat(all.filter(n => !preferred.includes(n)).sort((a, b) => a.localeCompare(b, 'en', {sensitivity: 'base'})));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const ids = {'Code.gs': ['codeBox', 'copyBtn'], 'AdminOrders.gs': ['admBox', 'copyAdm'], 'FixSheetHeaders.gs': ['fixBox', 'copyFix']};

let sections = '';
const binds = [];
files.forEach((name, i) => {
  const [box, btn] = ids[name] || [`fileBox${i + 1}`, `copyFile${i + 1}`];
  const content = fs.readFileSync(path.join(dir, name), 'utf8');
  sections += `<h2>${i + 1}. ${esc(name)}</h2>\n<textarea id="${box}" readonly>${esc(content)}</textarea><br>\n<button type="button" id="${btn}">${esc(name)} কপি</button>\n`;
  binds.push(`bind('${btn}', '${box}');`);
});

const html = `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8"><title>Apps Script কোড</title><style>body { font-family: system-ui, sans-serif; margin: 16px; max-width: 960px; } textarea { width: 100%; height: 52vh; font: 11px Consolas, monospace; } button { margin-top: 10px; padding: 12px 20px; font-size: 15px; cursor: pointer; } .step { background: #fff8e1; border: 1px solid #f0d58a; padding: 10px 14px; border-radius: 6px; }</style></head><body><h1>Apps Script কোড (সম্পূর্ণ project)</h1><p>এই page-এ canonical project-এর সব source file আছে: ${files.join(', ')}</p><div class="step"><p><strong>গুরুত্বপূর্ণ:</strong> Admin dashboard-এর সব API চালাতে নিচের সব ফাইল একই Apps Script project-এ রাখতে হবে। <code>.gs</code> ফাইলের জন্য <strong>＋ → Script</strong>, আর <code>.html</code> ফাইলের জন্য <strong>＋ → HTML</strong> ব্যবহার করুন; একই নাম রেখে প্রতিটি কোড সংশ্লিষ্ট ফাইলে কপি করুন। একাধিক <code>doGet</code> function রাখবেন না—canonical router শুধু <code>Code.gs</code>-এ।</p><ol><li>প্রতিটি source file-এর নাম অনুযায়ী Apps Script file তৈরি বা update করুন।</li><li><strong>Save</strong> চাপুন এবং <code>npm run test:backend</code> parity test পাস হয়েছে কি নিশ্চিত করুন।</li><li><strong>Deploy → Manage deployments → Edit → Version: New version → Deploy</strong> করে বিদ্যমান Web App URL রাখুন।</li></ol></div>${sections.replace(/\n$/, '')}<script>function bind(btn, box) { document.getElementById(btn).onclick = function () { var t = document.getElementById(box).value; navigator.clipboard.writeText(t).then(function () { alert("কপি হয়েছে!"); }); }; }${binds.join('\n')}</script></body></html>`;
fs.writeFileSync(path.join(root, 'apps-script-copy.html'), html);
console.log(`apps-script-copy.html: ${files.length} files (${files.join(', ')})`);
