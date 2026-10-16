import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ctx={window:{},console}; vm.createContext(ctx);
const sources=['product-config.js','product-utils.js','category-products.js','product-links-data.js','product-catalog-sync.js'];
let sourceText='';
for(const f of sources){const code=fs.readFileSync(path.join(root,f),'utf8');sourceText+=f+'\u0000'+code+'\u0000';vm.runInContext(code,ctx,{filename:f});}
const w=ctx.window, catalog=w.maCatalog.normalizeAll(w.CATEGORY_PRODUCTS,w.PRODUCT_LINKS_DATA||{});
const products=[];
for(const [category,rows] of Object.entries(catalog)) for(const p of rows){
  const ab=w.isAbayaProduct(p,category), tp=w.isTwoPieceProduct(p,category);
  const cfg=ab?w.getAbayaSizeConfig(p):tp?w.getTwoPieceSizeConfig(p):null;
  const custom=w.SITE_LINKS?.sizeChart?.byCategory?.[category]?.customSize||w.SITE_LINKS?.sizeChart?.default?.customSize||[];
  products.push({id:p.id,name:p.name,category,price:p.price,prices:p.priceByType||null,sizes:p.sizes||[],
    bodySizes:cfg?.bodySizes||[],bodyLabel:cfg?.bodySizeLabel||'',lengths:ab?(p.lengthSizes||p.sizes||cfg.lengthSizes):[],
    dressLengths:cfg?.dressLengths||[],palazzoLengths:cfg?.palazzoLengths||[],lengthLabel:cfg?.lengthSizeLabel||'',
    custom,kind:ab?'abaya':tp?'two-piece':'simple'});
}
if(new Set(products.map(p=>p.id)).size!==products.length)throw Error('Duplicate product IDs');
fs.writeFileSync(path.join(root,'catalog-validation.json'),JSON.stringify({version:1,releaseSha:process.env.CF_PAGES_COMMIT_SHA||'',sources,sourceSha256:createHash('sha256').update(sourceText).digest('hex'),products}));
console.log('Validation catalog: '+products.length+' products');

