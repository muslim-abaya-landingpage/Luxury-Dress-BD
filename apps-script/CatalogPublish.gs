// Owner-only, atomic product publication. Reuses the existing repository token and access scope.
var CP_FILES_ = ['category-products.js','product-links-data.js','product-catalog-sections.js','product-config.js'];
function cpGit_(method,path,payload) {
  var token=PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if(!token)throw Error('PUBLISH_NOT_CONFIGURED');
  var opts={method:method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','User-Agent':'MuslimAbaya-Catalog'},muteHttpExceptions:true};
  if(payload){opts.contentType='application/json';opts.payload=JSON.stringify(payload);}
  var res=UrlFetchApp.fetch('https://api.github.com/repos/muslim-abaya-landingpage/Luxury-Dress-BD/'+path,opts),code=res.getResponseCode();
  if(code<200||code>=300)throw Error(code===409||code===422?'CATALOG_CONFLICT':'PUBLISH_HTTP_'+code);
  return JSON.parse(res.getContentText());
}
function cpHead_() {
  var ref=cpGit_('get','git/ref/heads/main'),commit=cpGit_('get','git/commits/'+ref.object.sha),tree=cpGit_('get','git/trees/'+commit.tree.sha),shas={};
  tree.tree.forEach(function(f){if(CP_FILES_.indexOf(f.path)>=0)shas[f.path]=f.sha;});
  if(CP_FILES_.some(function(p){return !shas[p];}))throw Error('CATALOG_FILES_MISSING');
  return {head:ref.object.sha,tree:commit.tree.sha,shas:shas};
}
function cpValidate_(p) {
  if(!p||!/^[-a-zA-Z0-9]{16,80}$/.test(String(p.requestId||'')))throw Error('INVALID_REQUEST_ID');
  if(!Array.isArray(p.files)||p.files.length!==4)throw Error('CATALOG_FILES_REQUIRED');
  var seen={},bytes=0;
  p.files.forEach(function(f){if(CP_FILES_.indexOf(f.path)<0||seen[f.path]||typeof f.content!=='string'||!f.content||f.content.length>1500000)throw Error('INVALID_CATALOG_FILE');seen[f.path]=true;bytes+=f.content.length;});
  if(!p.baseShas||CP_FILES_.some(function(path){return !/^[a-f0-9]{40}$/.test(String(p.baseShas[path]||''));}))throw Error('CATALOG_REFRESH_REQUIRED');
  var assets=p.assets||[];if(!Array.isArray(assets)||assets.length>6)throw Error('TOO_MANY_IMAGES');
  assets.forEach(function(a){
    if(!/^images\/uploads\/[a-z0-9-]+\.(webp|jpg|png)$/.test(String(a.path||''))||seen[a.path])throw Error('INVALID_IMAGE_PATH');seen[a.path]=true;
    if(typeof a.content!=='string'||a.content.length>3500000||!/^[A-Za-z0-9+/]+={0,2}$/.test(a.content))throw Error('INVALID_IMAGE');
    var data=Utilities.base64Decode(a.content),ext=a.path.split('.').pop();bytes+=data.length;
    if(data.length<12||data.length>2621440)throw Error('IMAGE_SIZE_LIMIT');
    function b(i){return (data[i]+256)%256;}
    var valid=ext==='webp'?b(0)===82&&b(1)===73&&b(2)===70&&b(3)===70&&b(8)===87&&b(9)===69&&b(10)===66&&b(11)===80:ext==='jpg'?b(0)===255&&b(1)===216&&b(2)===255:b(0)===137&&b(1)===80&&b(2)===78&&b(3)===71;
    if(!valid)throw Error('IMAGE_FORMAT_MISMATCH');
  });
  if(bytes>9000000)throw Error('UPLOAD_SIZE_LIMIT');
  return p;
}
function cpPublish_(p) {
  cpValidate_(p);
  var digest=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(p)).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  var cache=CacheService.getScriptCache(),key='catalog_publish_'+p.requestId,prior=cache.get(key);
  if(prior){var receipt=JSON.parse(prior);if(receipt.digest!==digest)throw Error('REQUEST_CHANGED');return receipt.result;}
  var lock=LockService.getUserLock();lock.waitLock(20000);
  try {
    prior=cache.get(key);if(prior){var duplicate=JSON.parse(prior);if(duplicate.digest!==digest)throw Error('REQUEST_CHANGED');return duplicate.result;}
    var base=cpHead_();if(CP_FILES_.some(function(path){return base.shas[path]!==p.baseShas[path];}))throw Error('CATALOG_CONFLICT');
    var entries=p.files.map(function(f){return {path:f.path,mode:'100644',type:'blob',content:f.content};});
    (p.assets||[]).forEach(function(a){var blob=cpGit_('post','git/blobs',{content:a.content,encoding:'base64'});entries.push({path:a.path,mode:'100644',type:'blob',sha:blob.sha});});
    var tree=cpGit_('post','git/trees',{base_tree:base.tree,tree:entries});
    var commit=cpGit_('post','git/commits',{message:'Publish product catalog from owner panel',tree:tree.sha,parents:[base.head]});
    cpGit_('patch','git/refs/heads/main',{sha:commit.sha,force:false});
    var newShas={};(tree.tree||[]).forEach(function(f){if(CP_FILES_.indexOf(f.path)>=0)newShas[f.path]=f.sha;});
    var result={ok:true,version:1,sha:commit.sha,shas:newShas,message:'ছবি ও পণ্যের তথ্য একসঙ্গে সেভ হয়েছে। ওয়েবসাইটে প্রকাশ চলছে।'};
    cache.put(key,JSON.stringify({digest:digest,result:result}),21600);return result;
  } finally {lock.releaseLock();}
}
function cpStatus_(sha) {
  if(!/^[a-f0-9]{40}$/.test(sha))throw Error('INVALID_COMMIT');
  var result=cpGit_('get','commits/'+sha+'/check-runs?per_page=100'),checks=(result.check_runs||[]).filter(function(c){return c.name==='Cloudflare Pages'&&c.head_sha===sha;});
  if(!checks.length)return {ok:true,state:'queued',sha:sha};
  checks.sort(function(a,b){return b.id-a.id;});var c=checks[0];
  return {ok:true,state:c.status!=='completed'?'building':c.conclusion==='success'?'live':'failed',sha:sha};
}
function catalogPublishHandle_(type,e) {
  var who=verifyAdminSession_(param_(e,'Token'));if(!who.ok)return who;var denied=requireOwnerAdmin_(who);if(denied)return denied;
  try {
    if(type==='AdminCatalogState'){var h=cpHead_();return {ok:true,version:1,head:h.head,shas:h.shas};}
    if(type==='AdminCatalogPublish')return cpPublish_(JSON.parse(param_(e,'Payload')||'{}'));
    if(type==='AdminCatalogStatus')return cpStatus_(String(param_(e,'Sha')||''));
    return {ok:false,error:'UNKNOWN_TYPE'};
  } catch(err) {
    var code=String(err.message||err),messages={CATALOG_CONFLICT:'অন্য জায়গা থেকে পণ্য বদলেছে। আপনার ফর্মটি রেখে নতুন ডেটা লোড করুন।',CATALOG_REFRESH_REQUIRED:'বর্তমান পণ্যের তথ্য নতুন করে লোড করুন।',PUBLISH_NOT_CONFIGURED:'প্রকাশের সংযোগটি এখনো প্রস্তুত নয়।',REQUEST_CHANGED:'আগের অনুরোধের তথ্য বদলেছে। নতুন অনুরোধ দিয়ে চেষ্টা করুন।',IMAGE_SIZE_LIMIT:'ছবির সাইজ কমিয়ে আবার চেষ্টা করুন।'};
    return {ok:false,error:code.slice(0,80),message:messages[code]||'প্রকাশ করা যায়নি। তথ্য অক্ষত আছে; আবার চেষ্টা করুন।'};
  }
}
