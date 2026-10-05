import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Cloudflare accepts "! Header" detach rules; Netlify does not. Generate a
// Netlify-only publish file while keeping the repository's Cloudflare file.
// Exact cache paths also avoid comma-joining conflicting max-age directives.
export function compileNetlifyHeaders(source, publicPaths) {
  const rules = [];
  let rule;
  for (const line of source.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      if (!value.startsWith('/')) throw new Error(`Invalid header path: ${value}`);
      rule = { path: value, headers: [], cache: [] };
      rules.push(rule);
      continue;
    }
    if (!rule) throw new Error('Header without a path');
    const detach = /^!\s+([^:]+)$/.exec(value);
    const header = /^([^:]+):\s*(.*)$/.exec(value);
    if (!detach && !header) throw new Error(`Invalid header: ${value}`);
    const name = (detach?.[1] || header[1]).trim();
    if (name.toLowerCase() === 'cache-control') {
      rule.cache.push(detach ? null : header[2]);
    } else {
      if (detach) throw new Error(`Unsupported non-cache detach: ${name}`);
      rule.headers.push(value);
    }
  }
  const matches = (pattern, path) => {
    const expression = pattern.split('*').map(part =>
      part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${expression}$`).test(path);
  };
  const blocks = rules.filter(item => item.headers.length).map(item =>
    `${item.path}\n${item.headers.map(value => `  ${value}`).join('\n')}`);
  for (const path of [...new Set(publicPaths)].sort()) {
    let cache;
    for (const item of rules) {
      if (matches(item.path, path)) {
        for (const value of item.cache) cache = value;
      }
    }
    if (cache != null) blocks.push(`${path}\n  Cache-Control: ${cache}`);
  }
  return `# Generated for Netlify from the Cloudflare header policy.\n\n${blocks.join('\n\n')}\n`;
}

async function collectPublicPaths(root, directory = root) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await collectPublicPaths(root, file));
    else if (entry.isFile()) {
      const path = '/' + relative(root, file).split(sep).join('/');
      paths.push(path);
      if (path.endsWith('.html')) paths.push(path.slice(0, -5));
    }
  }
  return paths;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = resolve(process.argv[2] || '.');
  const file = resolve(root, '_headers');
  const source = await readFile(file, 'utf8');
  const paths = ['/', ...await collectPublicPaths(root)];
  await writeFile(file, compileNetlifyHeaders(source, paths));
  console.log(`Prepared valid Netlify headers for ${new Set(paths).size} public paths.`);
}
