import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
// Keep editable product-config/category-products/product-links-data separate.
const groups = {
 'home-catalog-utils.min.js': ['product-utils.js', 'product-catalog-sync.js'],
 'home-render.min.js': ['product-catalog-loader.js', 'index-home-muslim-abaya.js', 'index-catalog-defer.js']
};
for (const [outfile, sources] of Object.entries(groups)) {
 const input = sources.map(p => fs.readFileSync(p, 'utf8')).join('\n;\n');
 const run = spawnSync('npm', ['exec','--yes','--package=esbuild@0.25.0','--','esbuild','--minify','--target=es2018','--charset=utf8'], {input,encoding:'utf8'});
 if (run.status !== 0) throw new Error(run.stderr || 'Homepage build failed');
 fs.writeFileSync(outfile, run.stdout);
 console.log(`${outfile}: ${Buffer.byteLength(input)} → ${fs.statSync(outfile).size} bytes`);
}
