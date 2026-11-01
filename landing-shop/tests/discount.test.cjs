/* ডিসকাউন্ট টেস্ট: node tests/discount.test.cjs */
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const root=path.join(__dirname,'..');
const ctx={};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'discount.js'),'utf8'),ctx);
const {maApplyDiscount}=ctx;
const base=()=>({hero:{badge:'অফার'},products:[{id:'a',price:2385,variants:[{id:'black',price:2385}]},{id:'b',price:1200}]});
const T=Date.parse('2026-11-05T12:00:00+06:00');
let c=maApplyDiscount({...base(),discount:{enabled:false,type:'percent',value:10}},T);
assert.equal(c.products[0].price,2385);assert.equal(c.products[0].regularPrice,undefined);
c=maApplyDiscount({...base(),discount:{enabled:true,type:'percent',value:10,label:'১০% ছাড়'}},T);
assert.equal(c.products[0].price,2147);assert.equal(c.products[0].regularPrice,2385);assert.equal(c.products[0].variants[0].price,2147);assert.equal(c.products[1].price,1080);assert.equal(c.hero.badge,'১০% ছাড়');
c=maApplyDiscount({...base(),discount:{enabled:true,type:'fixed',value:200,products:['a']}},T);
assert.equal(c.products[0].price,2185);assert.equal(c.products[1].price,1200,'only listed products');
c=maApplyDiscount({...base(),discount:{enabled:true,type:'percent',value:10,startsAt:'2026-11-06T00:00:00+06:00'}},T);
assert.equal(c.products[0].price,2385,'not started yet');
c=maApplyDiscount({...base(),discount:{enabled:true,type:'percent',value:10,endsAt:'2026-11-05T11:00:00+06:00'}},T);
assert.equal(c.products[0].price,2385,'ended -> back to normal automatically');
c=maApplyDiscount({...base(),discount:{enabled:true,type:'fixed',value:999999}},T);
assert.equal(c.products[1].price,120,'never more than 90% off');
const twice=maApplyDiscount(maApplyDiscount({...base(),discount:{enabled:true,type:'percent',value:10}},T),T);
assert.equal(twice.products[0].price,2147,'applied only once');
// Server order check uses the same rules
(async()=>{
 const src=fs.readFileSync(path.join(root,'_worker.js'),'utf8').replace(/export default/,'globalThis.__w =');
 const meta=JSON.parse(src.match(/const siteMetadata = (.*?);\n/)[1]);
 const cfgObj=meta.main;cfgObj.discount={enabled:true,type:'percent',value:10};
 const wctx={URL,URLSearchParams,Response,Request,Headers,console,fetch:async()=>new Response('x'),crypto,TextEncoder,setTimeout,globalThis:{}};
 vm.createContext(wctx);vm.runInContext(src.replace(/const siteMetadata = .*?;\n/,'const siteMetadata = '+JSON.stringify(meta)+';\n')+'\n;globalThis.__et=expectedTotal;',wctx);
 const P=cfgObj.products[0],V=P.variants?.[0];
 const fields=new URLSearchParams({CartJSON:JSON.stringify([{id:P.id,qty:1,size:P.sizes?.[0]||'',variant:V?.id||''}]),DeliveryArea:'inside'});
 const inside=cfgObj.deliveryAreas.find(a=>a.id==='inside').charge;
 const unit=Math.round((V?.price??P.price)*0.9);
 assert.equal(wctx.globalThis.__et(cfgObj,fields).total,unit+inside,'server total = discounted price + delivery');
 assert.equal(cfgObj.products[0].price,P.price,'server check does not change the shared catalog');
 cfgObj.discount.endsAt='2000-01-01T00:00:00Z';
 assert.equal(wctx.globalThis.__et(cfgObj,fields).total,(V?.price??P.price)+inside,'expired discount -> full price on server too');
 console.log('discount tests passed (8 checks)');
})().catch(e=>{console.error(e);process.exit(1)});
