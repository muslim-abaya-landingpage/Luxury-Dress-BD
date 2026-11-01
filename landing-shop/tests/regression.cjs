const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
let count=0;const ok=name=>{console.log('PASS '+name);count++};
(async()=>{
 const runtimeFiles=JSON.parse(read('site-router.js').match(/const runtimeFiles = (.*?);/)[1]);
 // Simulate a slow network: dependencies must wait for the site script.
 const scripts=[],window={},document={documentElement:{dataset:{}},createElement:()=>({}),head:{appendChild(s){scripts.push(s)}},body:{prepend(){}}};
 const boot=vm.runInNewContext(read('site-router.js'),{window,document,location:{hostname:'offer01.muslimabaya.co',search:'',pathname:'/'},URLSearchParams,console});
 assert.deepEqual(scripts.map(s=>s.src),['sites/offer01.js']);
 for(const expected of ['sites/offer01.js',runtimeFiles.landing]){assert.equal(scripts.at(-1).src,expected);scripts.at(-1).onload();await new Promise(r=>setImmediate(r))}await boot;ok('Delayed site override completes before theme, SEO, tracking and app');
 const previewScripts=[];const preview=vm.runInNewContext(read('site-router.js'),{window:{},document:{...document,head:{appendChild(s){previewScripts.push(s)}}},location:{hostname:'localhost',search:'?builderPreview=1',pathname:'/thank-you.html'},URLSearchParams,console});
 for(const expected of [runtimeFiles.thanks]){assert.equal(previewScripts.at(-1).src,expected);previewScripts.at(-1).onload();await new Promise(r=>setImmediate(r))}await preview;ok('Builder preview keeps its draft and thank-you uses ordered initialization');
 for (const [kind,files] of Object.entries({landing:['theme.js','seo.js','tracking.js','app.js'],thanks:['theme.js','tracking.js','thank-you.js']})) {
   const bundle=read(runtimeFiles[kind]); let offset=-1;
   for(const file of files) {const at=bundle.indexOf(read(file));assert(at>offset, file+' missing or out of order');offset=at;}
   const page=read(kind==='landing'?'index.html':'thank-you.html');assert(page.includes('as="script" href="'+runtimeFiles[kind]+'"'));
 }
 ok('Preloaded bundles preserve original source execution order');
 const box={window:{},location:{search:''}};vm.runInNewContext(read('config.js'),box);const cfg=box.window.LANDING_CONFIG;
 const html=read('index.html');const schema=JSON.parse(html.match(/id="product-schema"[^>]*>(.*?)<\/script>/s)[1]);assert.equal(schema.length,cfg.products.length);assert.equal(schema[0].offers.price,2385);assert(html.includes('৳2385'));assert(html.includes(cfg.sections.features[0]));ok('Static HTML contains actual product prices, features and matching schema');
 for(const ref of [...cfg.hero.images,...cfg.products.map(p=>p.image),...cfg.reviews.map(r=>r.image)])assert(fs.existsSync(path.join(root,ref)),ref);ok('Configured product, gallery and review assets exist');
 let worker=read('_worker.js').replace("import siteMetadata from './seo-data.js';",'const siteMetadata={};').replace('export default {','globalThis.worker = {');
 let forwarded=0;const sandbox={URL,URLSearchParams,Request,Response,Headers,TextEncoder,crypto:require('node:crypto').webcrypto,console,fetch:async()=>{forwarded++;return new Response('Success|TEST-123')}};vm.runInNewContext(worker,sandbox);
 const handler=sandbox.worker.fetch,ctx={waitUntil(){}},env={ASSETS:{fetch:async()=>new Response('asset',{headers:{'Content-Type':'text/plain'}})}};
 const order={RecordType:'Order',Name:'Test',Address:'Test address',Phone:'01912345678',Total:'2480',Quantity:'1',_hp:''};
 const request=(data,origin='https://muslimabaya.co')=>new Request('https://muslimabaya.co/api/order',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Origin':origin},body:new URLSearchParams(data)});
 for(const patch of [{_hp:'bot'},{Phone:'bad'},{Total:'-1'},{Total:'Infinity'},{Quantity:'1.5'},{Name:''}])assert.equal((await handler(request({...order,...patch}),env,ctx)).status,400);
 assert.equal(forwarded,0);assert.equal((await handler(request(order,'https://other.example'),env,ctx)).status,403);ok('Worker rejects invalid orders, honeypot and cross-origin submissions without forwarding');
 assert.equal(await (await handler(request(order),env,ctx)).text(),'Success|TEST-123');assert.equal(forwarded,1);ok('Valid mock order reaches upstream and returns confirmed ID');
 sandbox.fetch=async()=>new Response('<html>Error</html>',{status:500});assert.equal((await handler(request(order),env,ctx)).status,502);ok('Upstream failure never returns order success');
 for(const file of ['robots.txt','sitemap.xml']){const response=await handler(new Request('https://offer01.muslimabaya.co/'+file),env,ctx);assert((await response.text()).includes('https://offer01.muslimabaya.co/'))}ok('Robots and sitemap use the requested subdomain');
 const rewritten={};sandbox.HTMLRewriter=class {on(selector,handler){rewritten[selector]=handler;return this}transform(response){return response}};
 const htmlEnv={ASSETS:{fetch:async()=>new Response('<html></html>',{headers:{'Content-Type':'text/html'}})}};
 await handler(new Request('https://offer01.muslimabaya.co/'),htmlEnv,ctx);
 let title='',canonical='',schemaText='';rewritten.title.element({setInnerContent:value=>title=value});rewritten['link[rel="canonical"]'].element({setAttribute:(key,value)=>canonical=value});rewritten['#product-schema'].element({setInnerContent:value=>schemaText=value});
 assert.equal(title,'বিশেষ অফার | Muslim Abaya');assert.equal(canonical,'https://offer01.muslimabaya.co/');assert.equal(JSON.parse(schemaText)[0].offers.url,canonical+'#products');ok('Worker selects correct subdomain title, canonical and product schema');
 assert.equal((await handler(new Request('https://muslimabaya.co/index.html?utm_source=test'),env,ctx)).headers.get('Location'),'https://muslimabaya.co/?utm_source=test');ok('Canonical redirect preserves campaign query');
 // Execute the actual form update function against a valid basket.
 const app=read('app.js'),nodes={};const get=id=>nodes[id]??=( {value:'',textContent:'',dataset:{},classList:{toggle(){}},disabled:false});get('name').value='Test';get('address').value='Address';get('phone').value='01912345678';
 const state={selected:{p:{active:true,qty:1,size:'54'}},products:[{id:'p',name:'Product',sizes:['54'],price:2400}],areas:[{id:'inside',label:'Dhaka',charge:80}],c:{order:{mode:'apps-script'}},submitting:false,$:get,text:(id,v)=>get(id).textContent=v,money:String,escape:String,variantFor:()=>null,priceFor:p=>p.price,sizeInStock:()=>true,normalizePhone:String,document:{querySelector:q=>q.includes('area_choice')?{value:'inside'}:null}};
 const update=app.slice(app.indexOf('  function update() {'),app.indexOf('  function saveDraft()'));
 vm.createContext(state);vm.runInContext(update,state);assert.equal(state.update().total,2480);assert.equal(get('submit').disabled,false);state.submitting=true;state.update();assert.equal(get('submit').disabled,true);state.submitting=false;state.selected.p.size='99';state.update();assert.equal(get('submit').disabled,true);ok('Checkout total, pending-submit lock and stale-size validation');
 const submit=app.slice(app.indexOf("  $('order').addEventListener('submit'"),app.indexOf("  $('copy').onclick"));
 let prevented=false,handlerFn;vm.runInNewContext(submit,{URLSearchParams,location:{search:''},submitting:true,$:()=>({addEventListener:(type,fn)=>handlerFn=fn})});handlerFn({preventDefault(){prevented=true}});assert(prevented);ok('Repeated submit exits immediately while request is pending');
 // v8.1 fixes
 for(const pathname of ['/thank-you','/thank-you.html']){const loaded=[];const doc={documentElement:{dataset:{}},createElement:()=>({}),head:{appendChild(s){loaded.push(s);setImmediate(()=>s.onload())}},body:{prepend(){}}};await vm.runInNewContext(read('site-router.js'),{window:{},document:doc,location:{hostname:'shop.muslimabaya.com',search:'',pathname},URLSearchParams,console,setImmediate});assert.equal(loaded.at(-1).src,runtimeFiles.thanks,pathname)}ok('Cloudflare extensionless /thank-you loads thank-you runtime');
 assert(read('app.js').includes("location.assign('/thank-you')"));assert(/isThanks=\/\\\/thank-you\(\?:\\\.html\)\?\$\//.test(read('tracking.js')));ok('Lead tracking recognises /thank-you');
 const meta=JSON.parse(read('_worker.js').match(/const siteMetadata = (.*);\n\/\* SEO-DATA-END/s)[1]);for(const f of fs.readdirSync(path.join(root,'sites')))assert(meta[f.slice(0,-3)],'metadata missing '+f);assert(meta.main.deliveryAreas.length);ok('Worker metadata covers every sites/*.js and delivery areas');
 let sent='';sandbox.fetch=async(u,o)=>{sent=o.body;return new Response('Success|T-1')};
 const good={...order,Total:'2465',Quantity:'1',DeliveryArea:'inside',Site:'main',CartJSON:JSON.stringify([{id:'hafeza-set',qty:1,size:'54',variant:'black'}])};
 assert.equal(await (await handler(request(good),env,ctx)).text(),'Success|T-1');assert.equal(new URLSearchParams(sent).get('PriceCheck'),'OK');
 await handler(request({...good,Total:'100'}),env,ctx);const bad=new URLSearchParams(sent);assert.equal(bad.get('PriceCheck'),'FAILED');assert(bad.get('SpecialNotes').includes('expected total 2465'));
 await handler(request({...good,DeliveryArea:'outside',Total:'2535'}),env,ctx);assert.equal(new URLSearchParams(sent).get('PriceCheck'),'OK');
 ok('Worker re-checks total from catalog and flags tampered orders without losing them');
 const appSrc=read('app.js');assert(appSrc.includes('restoreDraft(); saveDraft();'));ok('Restored draft is saved back with product selection');
 // v8.2 first-party cookies
 const pageEnv={ASSETS:{fetch:async()=>new Response('<html></html>',{headers:{'Content-Type':'text/html'}})}};sandbox.HTMLRewriter=class{on(){return this}transform(r){return r}};
 let res=await handler(new Request('https://shop.muslimabaya.com/?fbclid=IwAR123abcDEF456',{headers:{Cookie:'_ttp=abcdefghij12345'}}),pageEnv,ctx);let sc=res.headers.getSetCookie();
 assert(sc.some(c=>/^_fbp=fb\.1\.\d{13}\.\d+; Max-Age=7776000; Path=\/; Domain=\.muslimabaya\.com; Secure; SameSite=Lax$/.test(c)),'fbp');assert(sc.some(c=>/^_fbc=fb\.1\.\d{13}\.IwAR123abcDEF456;/.test(c)),'fbc');assert(sc.some(c=>c.startsWith('_ttp=abcdefghij12345;')),'ttp');assert(sc.some(c=>c.startsWith('ma_vid=')));assert.equal(res.headers.get('Cache-Control'),'private, no-cache');
 res=await handler(new Request('https://shop.muslimabaya.com/',{headers:{Cookie:'_fbp=fb.1.1700000000000.123456789; _fbc=fb.1.1700000000000.OLDCLICKID123'}}),pageEnv,ctx);sc=res.headers.getSetCookie();
 assert(sc.includes('_fbp=fb.1.1700000000000.123456789; Max-Age=7776000; Path=/; Domain=.muslimabaya.com; Secure; SameSite=Lax'));assert(sc.some(c=>c.startsWith('_fbc=fb.1.1700000000000.OLDCLICKID123;')));
 res=await handler(new Request('https://x.pages.dev/'),pageEnv,ctx);assert(!res.headers.getSetCookie().some(c=>c.startsWith('_fbp')));
 res=await handler(new Request('https://shop.muslimabaya.com/',{headers:{Cookie:'_fbp=bad;value'}}),pageEnv,ctx);assert(res.headers.getSetCookie().some(c=>/^_fbp=fb\.1\.\d{13}\.\d+;/.test(c)));
 ok('Worker re-issues _fbp/_fbc/_ttp as 90-day first-party cookies on own domain only');
 console.log(`${count} regression checks passed. No live orders or ad events sent.`);
})().catch(e=>{console.error(e);process.exitCode=1});
