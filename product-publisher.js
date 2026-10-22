(function(g){'use strict';
 var MAX_ASSETS=6,base=null,assets={},request=null,job=null,checking=false,timer=null,notify=function(){};
 function call(type,data){return g.MaAdmin.call(type,data||{},{maxAgeMs:0});}
 function bytes(text){return new TextEncoder().encode(text);}
 function hex(buf){return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');}
 async function gitHash(text){var content=bytes(text),header=bytes('blob '+content.length+'\u0000'),full=new Uint8Array(header.length+content.length);full.set(header);full.set(content,header.length);return hex(await crypto.subtle.digest('SHA-1',full));}
 function storeJob(){try{sessionStorage.setItem('ma_product_publish_job',JSON.stringify(job));}catch(e){}}
 function setJob(j){job=j;storeJob();}
 function status(s,error){notify(s,!!error);}
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
  status('✅ Photos and product details saved. Publishing to the website…');check();return result;
 }
 g.MaCatalogPublisher={init:init,publish:publish,enqueue:function(rows){rows.forEach(function(a){assets[a.path]=a;});},pendingPhotos:function(){return Object.keys(assets).length;},check:check,isReady:function(){return !!base;},gitHash:gitHash};
})(window);
