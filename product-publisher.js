(function(g){'use strict';
 var base=null,assets={},request=null,job=null,checking=false,timer=null,notify=function(){};
 function call(type,data){return g.MaAdmin.call(type,data||{},{maxAgeMs:0});}
 function bytes(text){return new TextEncoder().encode(text);}
 function hex(buf){return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');}
 async function gitHash(text){var content=bytes(text),header=bytes('blob '+content.length+'\u0000'),full=new Uint8Array(header.length+content.length);full.set(header);full.set(content,header.length);return hex(await crypto.subtle.digest('SHA-1',full));}
 function storeJob(){try{sessionStorage.setItem('ma_product_publish_job',JSON.stringify(job));}catch(e){}}
 function setJob(j){job=j;storeJob();}
 function status(s,error){notify(s,!!error);}
 async function check(){
  if(!job||checking)return;checking=true;
  try {
   var manifest=await fetch('/catalog-validation.json?publish='+job.sha,{cache:'no-store'}).then(function(r){if(!r.ok)throw Error('NOT_READY');return r.json();});
   if(manifest.releaseSha===job.sha&&(!job.productId||manifest.products.some(function(p){return p.id===job.productId;}))){status('✅ পণ্য ওয়েবসাইটে দেখা যাচ্ছে।');document.dispatchEvent(new CustomEvent('ma-product-live',{detail:job}));setJob(null);clearTimeout(timer);return;}
   try{var r=await call('AdminCatalogStatus',{Sha:job.sha});if(r.state==='failed'){status('প্রকাশের পরীক্ষা ব্যর্থ হয়েছে। আগের সাইট চালু আছে; নতুন তথ্য সেভ আছে।',true);clearTimeout(timer);return;}}catch(e){}
   status('ছবি ও তথ্য সেভ হয়েছে। ওয়েবসাইটে প্রকাশ হচ্ছে…');
  }catch(e){status('তথ্য সেভ হয়েছে। প্রকাশের অবস্থা যাচাই করা হচ্ছে…');}
  finally{checking=false;}
  if(job&&Date.now()-job.started<10*60*1000)timer=setTimeout(check,15000);
  else if(job)status('তথ্য সেভ আছে; প্রকাশের নিশ্চয়তা এখনো পাওয়া যায়নি। “প্রকাশের অবস্থা দেখুন” চাপুন।',true);
 }
 async function init(onStatus,reloadData){
  notify=onStatus;status('বর্তমান পণ্যের তথ্য মিলিয়ে নেওয়া হচ্ছে…');
  base=await call('AdminCatalogState');if(base.version!==1)throw Error('প্রকাশের নতুন ব্যবস্থা এখনো চালু হয়নি।');
  var paths=['product-config.js','category-products.js','product-links-data.js','product-catalog-sections.js'];
  for(var path of paths){var response=await fetch('/'+path+'?catalog='+base.head,{cache:'reload'});if(!response.ok||await gitHash(await response.text())!==base.shas[path])throw Error('সাইটে আগের পরিবর্তন প্রকাশ হচ্ছে। একটু পরে বর্তমান ডেটা আবার লোড করুন।');}
  for(var path of paths)await new Promise(function(resolve,reject){var script=document.createElement('script');script.src='/'+path+'?catalog='+base.head;script.onload=resolve;script.onerror=reject;document.head.appendChild(script);});
  reloadData();status('প্রস্তুত। নতুন পণ্য যোগ করুন অথবা আগের পণ্য সম্পাদনা করুন।');
  try{job=JSON.parse(sessionStorage.getItem('ma_product_publish_job')||'null');}catch(e){}if(job)check();
 }
 async function publish(files,target){
  if(!base)throw Error('বর্তমান ডেটা প্রস্তুত হয়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।');
  var data={baseShas:base.shas,files:files.map(function(f){return {path:f.path,content:f.content};}),assets:Object.keys(assets).map(function(k){return assets[k];})};
  var fingerprint=JSON.stringify(data);if(!request||request.fingerprint!==fingerprint)request={fingerprint:fingerprint,id:crypto.randomUUID()};data.requestId=request.id;
  status('ছবি ও পণ্যের তথ্য সেভ হচ্ছে… পেজটি খোলা রাখুন।');
  var result=await call('AdminCatalogPublish',{Payload:JSON.stringify(data)});
  if(!result.sha)throw Error('প্রকাশের তথ্য পাওয়া যায়নি।');
  assets={};base={head:result.sha,shas:result.shas};request=null;setJob({sha:result.sha,productId:target&&target.id||'',category:target&&target.category||'',started:Date.now()});
  status('✅ ছবি ও পণ্যের তথ্য সেভ হয়েছে। ওয়েবসাইটে প্রকাশ চলছে…');check();return result;
 }
 g.MaCatalogPublisher={init:init,publish:publish,enqueue:function(rows){rows.forEach(function(a){assets[a.path]=a;});},check:check,isReady:function(){return !!base;},gitHash:gitHash};
})(window);
