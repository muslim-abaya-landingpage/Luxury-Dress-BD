(function(g){'use strict';
 var MAX_ASSETS=6,base=null,assets={},request=null,job=null,checking=false,timer=null,notify=function(){};
 function call(type,data){return g.MaAdmin.call(type,data||{},{maxAgeMs:0});}
 function bytes(text){return new TextEncoder().encode(text);}
 function hex(buf){return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');}
 async function gitHash(text){var content=bytes(text),header=bytes('blob '+content.length+'\u0000'),full=new Uint8Array(header.length+content.length);full.set(header);full.set(content,header.length);return hex(await crypto.subtle.digest('SHA-1',full));}
 function storeJob(){try{sessionStorage.setItem('ma_product_publish_job',JSON.stringify(job));}catch(e){}}
 function setJob(j){job=j;storeJob();}
 function status(s,error){notify(s,!!error);}
 function sha256Hex(text){return crypto.subtle.digest('SHA-256',bytes(text)).then(hex);}
 async function codeText(path){var r=await fetch('/'+path+'?live='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('LIVE_CODE_'+path);return r.text();}
 // Same order-check data the website build makes (scripts/build-catalog-validation.mjs), computed in a
 // sandboxed Web Worker from the files just saved, so order prices match what visitors now see.
 async function buildValidation(map,sha){
  var core=await codeText('catalog-validation-core.js'),utils=await codeText('product-utils.js'),sync=await codeText('product-catalog-sync.js');
  var sources=['product-config.js','product-utils.js','category-products.js','product-links-data.js','product-catalog-sync.js'];
  var texts={'product-config.js':map['product-config.js'],'product-utils.js':utils,'category-products.js':map['category-products.js'],'product-links-data.js':map['product-links-data.js'],'product-catalog-sync.js':sync};
  if(sources.some(function(f){return typeof texts[f]!=='string';}))throw Error('LIVE_FILES_MISSING');
  var code='var __post=self.postMessage.bind(self);(function(){var window={},console={log:function(){},info:function(){},warn:function(){},error:function(){}},self,fetch,XMLHttpRequest,importScripts,setTimeout,setInterval,localStorage,sessionStorage,indexedDB,document,location,navigator,postMessage,caches;\n'+sources.map(function(f){return texts[f];}).join('\n;\n')+'\n;\n'+core+'\n;try{__post({ok:true,sources:window.__maValidationSources,products:window.__maBuildValidationProducts(window)});}catch(e){__post({ok:false,error:String(e&&e.message||e)});}})();';
  var url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker=new Worker(url);
  var out=await new Promise(function(resolve,reject){var t=setTimeout(function(){reject(Error('LIVE_TIMEOUT'));},15000);worker.onmessage=function(e){clearTimeout(t);resolve(e.data);};worker.onerror=function(e){clearTimeout(t);e.preventDefault&&e.preventDefault();reject(Error('LIVE_WORKER'));};}).finally(function(){worker.terminate();URL.revokeObjectURL(url);});
  if(!out||!out.ok||JSON.stringify(out.sources)!==JSON.stringify(sources))throw Error('LIVE_VALIDATION');
  var hash=await sha256Hex(sources.map(function(f){return f+'\u0000'+texts[f]+'\u0000';}).join(''));
  return {products:out.products,json:JSON.stringify({version:1,releaseSha:sha,sources:sources,sourceSha256:hash,products:out.products})};
 }
 async function pushLive(files,sent,sha){
  try{
   var session=g.MaAdmin&&g.MaAdmin.getSession&&g.MaAdmin.getSession();if(!session||!session.token)return false;
   var map={};files.forEach(function(f){map[f.path]=f.content;});
   var v=await buildValidation(map,sha),index={},names={};
   v.products.forEach(function(p){index[p.id]=p.category;names[p.id]=p.name;});
   var res=await fetch('/api/live-publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({Token:session.token,sha:sha,files:map,validation:v.json,index:index,names:names,assets:(sent||[]).map(function(a){return {path:a.path,content:a.content};})})});
   var r=await res.json().catch(function(){return null;});
   return !!(r&&r.ok);
  }catch(e){return false;}
 }
 async function servesFiles(shas){
  try{for(var path of Object.keys(shas)){var r=await fetch('/'+path+'?live='+Date.now(),{cache:'no-store'});if(!r.ok||await gitHash(await r.text())!==shas[path])return false;}return Object.keys(shas).length>0;}catch(e){return false;}
 }
 async function check(){
  if(!job||checking)return;checking=true;
  try {
   var manifest=await fetch('/catalog-validation.json?publish='+job.sha+'-'+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('NOT_READY');return r.json();});
   var live=manifest.releaseSha===job.sha&&(!job.productId||manifest.products.some(function(p){return p.id===job.productId;}));
   // A later commit (another save, a code update) can be the one that went live; it still carries this save,
   // so also accept the change as live when the site serves exactly the catalog files this save wrote.
   if(!live&&manifest.releaseSha!==job.sha&&job.shas)live=await servesFiles(job.shas);
   if(live){status('✅ Product is visible on the website.');document.dispatchEvent(new CustomEvent('ma-product-live',{detail:job}));setJob(null);clearTimeout(timer);return;}
   try{var r=await call('AdminCatalogStatus',{Sha:job.sha});if(r.state==='failed'){status('Publish check failed. The previous site is still live; the new details are saved.',true);clearTimeout(timer);return;}}catch(e){}
   status('Photos and details saved. Publishing to the website…');
  }catch(e){status('Details saved. Checking publish status…');}
  finally{checking=false;}
  if(job&&Date.now()-job.started<10*60*1000)timer=setTimeout(check,5000);
  else if(job)status('Details are saved; publishing is not confirmed yet. Click “Check publish status”.',true);
 }
 async function init(onStatus,reloadData){
  notify=onStatus;status('Syncing current product data…');
  base=await call('AdminCatalogState');if(base.version!==1)throw Error('The new publishing system is not active yet.');
  var paths=['product-config.js','category-products.js','product-links-data.js','product-catalog-sections.js'];
  for(var path of paths){var response=await fetch('/'+path+'?catalog='+base.head,{cache:'reload'});if(!response.ok||await gitHash(await response.text())!==base.shas[path])throw Error('Earlier changes are being published. Reload current data in a moment.');}
  for(var path of paths)await new Promise(function(resolve,reject){var script=document.createElement('script');script.src='/'+path+'?catalog='+base.head;script.onload=resolve;script.onerror=reject;document.head.appendChild(script);});
  reloadData();status('Ready. Add a new product or edit an existing one.');
  try{job=JSON.parse(sessionStorage.getItem('ma_product_publish_job')||'null');}catch(e){}if(job)check();
 }
 async function publish(files,target){
  if(!base)throw Error('Current data is not ready. Refresh the page and try again.');
  // Photos picked in the editor wait here and go up in the same commit as the details, so one save = one
  // website build. Photos removed again before saving are dropped (only paths the catalog uses are sent).
  var text=files.map(function(f){return f.content;}).join('\n');
  Object.keys(assets).forEach(function(k){if(text.indexOf(k)<0)delete assets[k];});
  var queued=Object.keys(assets).map(function(k){return assets[k];});
  // The publisher accepts at most 6 photos per save; any extra ones are uploaded on their own first.
  while(queued.length>MAX_ASSETS){var extra=queued.pop();status('Uploading extra photos… keep this page open.');var up=await g.MaAdmin.uploadImage(extra.path,extra.content,'image/webp');if(!up||!up.ok)throw Error((up&&(up.message||up.error))||'Photo upload failed.');delete assets[extra.path];}
  var data={baseShas:base.shas,files:files.map(function(f){return {path:f.path,content:f.content};}),assets:queued};
  var fingerprint=JSON.stringify(data);if(!request||request.fingerprint!==fingerprint)request={fingerprint:fingerprint,id:crypto.randomUUID()};data.requestId=request.id;
  status('Saving photos and product details… keep this page open.');
  var result=await call('AdminCatalogPublish',{Payload:JSON.stringify(data)});
  if(!result.sha)throw Error('Publish info not found.');
  assets={};base={head:result.sha,shas:result.shas};request=null;setJob({sha:result.sha,shas:result.shas,productId:target&&target.id||'',category:target&&target.category||'',started:Date.now()});
  status('✅ Saved. Updating the website…');
  // Instant update: the same files go to the site's live copy right away (the deploy follows in ~1 min).
  if(await pushLive(data.files,queued,result.sha)){var done=job;setJob(null);clearTimeout(timer);status('✅ Saved and live on the website now.');document.dispatchEvent(new CustomEvent('ma-product-live',{detail:done}));result.live=true;return result;}
  status('✅ Photos and product details saved. Publishing to the website…');check();return result;
 }
 g.MaCatalogPublisher={init:init,publish:publish,enqueue:function(rows){rows.forEach(function(a){assets[a.path]=a;});},pendingPhotos:function(){return Object.keys(assets).length;},check:check,_buildValidation:buildValidation,isReady:function(){return !!base;},gitHash:gitHash};
})(window);
