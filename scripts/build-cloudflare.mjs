// Cloudflare Pages build command: node scripts/build-cloudflare.mjs
// Build output directory: . (the repository is a static multi-page site).
import {execFileSync} from 'node:child_process';
for (const script of ['scripts/build-catalog-validation.mjs','scripts/build-product-seo.mjs','scripts/test-operations.cjs']) {
  execFileSync(process.execPath,[script],{stdio:'inherit'});
}
