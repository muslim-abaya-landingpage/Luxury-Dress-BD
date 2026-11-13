// Builds media-manifest.json: the product photos that live in the website folder (images/…), for the
// admin Media Library. Photos uploaded from the panel are in R2 and listed by /api/media-library instead.
// Left out: smaller copies the site makes for speed (card/, card-avif/, m900/, opt/, "-card" files, .avif).
// Each entry: {path, date} — date = last git commit that changed the file (0 when git history is missing).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = 'images';
const SKIP_DIRS = new Set(['card', 'card-avif', 'm900', 'opt', 'admin']);
const IMAGE = /\.(webp|jpe?g|png|gif)$/i;

export function isLibraryPhoto(p) {
  const parts = p.split('/');
  if (parts.length > 2 && SKIP_DIRS.has(parts[1])) return false;
  if (!IMAGE.test(p)) return false;
  return !/-card\.[a-z]+$/i.test(p);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.posix.join(dir, d.name);
    return d.isDirectory() ? walk(p) : [p];
  });
}

function gitDates() {
  const dates = {};
  try {
    const out = execFileSync('git', ['log', '--format=@%ct', '--name-only', '--', ROOT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    let t = 0;
    out.split('\n').forEach((line) => {
      if (line.startsWith('@')) t = Number(line.slice(1)) * 1000;
      else if (line && !(line in dates)) dates[line] = t;
    });
  } catch (e) {}
  return dates;
}

export function buildManifest() {
  const dates = gitDates();
  const items = walk(ROOT).filter(isLibraryPhoto).map((p) => ({ path: p, date: dates[p] || 0 }));
  items.sort((a, b) => b.date - a.date || a.path.localeCompare(b.path));
  return { version: 1, items };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const m = buildManifest();
  fs.writeFileSync('media-manifest.json', JSON.stringify(m));
  console.log('media-manifest.json: ' + m.items.length + ' photos');
}
