// Cloudflare Pages build command: node scripts/build-cloudflare.mjs
// Build output directory: . (the repository is a static multi-page site).
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
// What this deployment was built from; the instant live catalog (functions/_lib/live-catalog.js) uses it to
// know when a product save from the admin panel has reached the deployed site.
function git(args){try{return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch(e){return '';}}
const sha=process.env.CF_PAGES_COMMIT_SHA||git(['rev-parse','HEAD']);
const commitTime=Number(git(['log','-1','--format=%ct']))||Math.floor(Date.now()/1000);
const history=git(['log','-200','--format=%H']).split('\n').filter(Boolean);
fs.writeFileSync('live-build.json',JSON.stringify({sha,commitTime,history}));
console.log('live-build.json: '+sha.slice(0,12)+' with '+history.length+' commits of history');
for (const script of ['scripts/build-catalog-validation.mjs','scripts/build-product-seo.mjs','scripts/build-home-prerender.mjs','scripts/build-catalog-asset-versions.mjs','scripts/test-operations.cjs','scripts/test-product-publish.cjs','scripts/test-product-gallery.cjs','scripts/test-stock-publication.cjs','scripts/prune-deploy.mjs']) {
  execFileSync(process.execPath,[script],{stdio:'inherit'});
}
