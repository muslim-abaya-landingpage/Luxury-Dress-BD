import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
// The product list comes from catalog-validation-core.js, which the admin panel also uses for instant
// live updates, so both always produce the same order-check data.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ctx={window:{},console}; vm.createContext(ctx);
const sources=['product-config.js','product-utils.js','category-products.js','product-links-data.js','product-catalog-sync.js'];
let sourceText='';
for(const f of sources){const code=fs.readFileSync(path.join(root,f),'utf8');sourceText+=f+'\u0000'+code+'\u0000';vm.runInContext(code,ctx,{filename:f});}
vm.runInContext(fs.readFileSync(path.join(root,'catalog-validation-core.js'),'utf8'),ctx,{filename:'catalog-validation-core.js'});
if(JSON.stringify(ctx.window.__maValidationSources)!==JSON.stringify(sources))throw Error('catalog-validation-core.js source list differs');
const products=ctx.window.__maBuildValidationProducts(ctx.window);
fs.writeFileSync(path.join(root,'catalog-validation.json'),JSON.stringify({version:1,releaseSha:process.env.CF_PAGES_COMMIT_SHA||'',sources,sourceSha256:createHash('sha256').update(sourceText).digest('hex'),products}));
console.log('Validation catalog: '+products.length+' products');
