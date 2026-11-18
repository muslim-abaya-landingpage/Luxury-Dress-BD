(function(){
  'use strict';
  var WORKER='https://muslim-abaya-cache-manager.muslimabeya.workers.dev';
  var $=function(id){return document.getElementById(id);};
  var token='';
  var busy=false;
  var actions=0;

  function setConnection(ok,label){
    var el=$('cmConnection');
    el.className='cm-status-pill '+(ok?'is-ok':'is-error');
    el.lastElementChild.textContent=label;
  }
  function setNotice(title,message,isError){
    var el=$('cmNotice');
    el.innerHTML='';
    var icon=document.createElement('span');icon.className='cm-notice-icon';icon.textContent=isError?'!':'i';
    var wrap=document.createElement('div');var b=document.createElement('b');b.textContent=title;
    var p=document.createElement('p');p.textContent=message;wrap.append(b,p);el.append(icon,wrap);
    el.style.borderColor=isError?'#efc7c3':'';
  }
  function setBusy(value){
    busy=value;
    ['cmRefresh','cmPurgeSite','cmPurgeUrls','cmPurgePrefixes'].forEach(function(id){var el=$(id);if(el)el.disabled=value||!token;});
    if(value){$('cmConnection').lastElementChild.textContent='Working securely…';}
  }
  function sessionToken(){
    try{
      var s=window.MaAdmin&&window.MaAdmin.getSession&&window.MaAdmin.getSession();
      if(!s||!s.token||s.role!=='admin'||(s.expires&&Number(s.expires)<Date.now()))return '';
      return String(s.token);
    }catch(e){return '';}
  }
  async function request(path,options){
    var res=await fetch(WORKER+path,Object.assign({headers:{Authorization:'Bearer '+token}},options||{}));
    var data={};try{data=await res.json();}catch(e){}
    if(!res.ok||!data.ok)throw new Error(data.error||('HTTP_'+res.status));
    return data;
  }
  async function loadStatus(){
    if(busy)return;
    setBusy(true);
    try{
      var data=await request('/api/status',{method:'GET'});
      $('cmService').textContent='Connected · v'+data.version;
      $('cmToken').textContent=data.cloudflareTokenConfigured?'Configured':'Missing';
      $('cmToken').style.color=data.cloudflareTokenConfigured?'#16794a':'#b42318';
      setConnection(true,'Owner verified · Worker online');
      setNotice('Ready for controlled cache maintenance','Only the main storefront hosts can be purged here. The shop subdomain and full zone are excluded.',false);
    }catch(e){
      $('cmService').textContent='Unavailable';
      $('cmToken').textContent='Not verified';
      setConnection(false,'Connection or permission check failed');
      setNotice('Could not verify Cache Manager',friendly(e.message)+' — no cache action was sent.',true);
    }finally{setBusy(false);}
  }
  function friendly(code){
    var map={NOT_LOGGED_IN:'Your admin session has expired. Sign in again.',OWNER_ONLY:'This action is restricted to the store owner.',AUTH_UNAVAILABLE:'Owner verification is temporarily unavailable.',ORIGIN_NOT_ALLOWED:'This page origin is not allowed.',CLOUDFLARE_TOKEN_NOT_CONFIGURED:'The Cloudflare Worker Secret is missing.',CLOUDFLARE_PERMISSION_DENIED:'The API token does not have the required Cache Purge permission.',RATE_LIMITED:'Please wait a moment before trying again.',INVALID_URLS:'Enter valid HTTPS URLs from muslimabaya.com or www.muslimabaya.com.',INVALID_PREFIXES:'Enter valid storefront host/path prefixes.'};
    return map[code]||String(code||'Unknown error').replace(/_/g,' ');
  }
  function lines(id){return $(id).value.split(/\r?\n/).map(function(s){return s.trim();}).filter(Boolean);}
  function logActivity(label,data,error){
    actions++;$('cmActivityCount').textContent=actions+' action'+(actions===1?'':'s')+' this session';
    var row=document.createElement('div');row.className='cm-activity-entry';
    var left=document.createElement('div');var strong=document.createElement('strong');strong.textContent=label;
    var small=document.createElement('small');small.textContent=error?friendly(error):('Scope: '+data.scope+' · '+(data.purgedAt||new Date().toISOString()));
    left.append(strong,small);var state=document.createElement('span');state.className=error?'bad':'ok';state.textContent=error?'Failed':'Completed';
    row.append(left,state);$('cmActivity').replaceChildren(row);
  }
  async function purge(action,label,payload){
    if(busy)return;
    var details=action==='site'?'the main storefront (muslimabaya.com and www.muslimabaya.com)':(action==='urls'?payload.urls.length+' selected URL(s)':payload.prefixes.length+' URL prefix(es)');
    if(!window.confirm('Confirm cache purge?\n\nThis will clear '+details+'.\nThe separate shop subdomain will not be affected.'))return;
    setBusy(true);setConnection(true,'Owner verification and purge in progress…');
    try{
      var data=await request('/api/purge',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      logActivity(label,data,null);
      setConnection(true,'Owner verified · Purge completed');
      setNotice('Cache purge completed','Cloudflare accepted the request. Purge ID: '+(data.purgeId||'not provided'),false);
    }catch(e){
      logActivity(label,{},e.message);
      setConnection(false,'Purge was not completed');
      setNotice('Cache purge failed',friendly(e.message)+' — check your owner login and Worker permissions.',true);
    }finally{setBusy(false);}
  }
  async function init(){
    if(!window.MaAdminGuard||!window.MaAdmin){setConnection(false,'Admin security could not load');return;}
    var owner=await window.MaAdminGuard.requireOwner();
    if(!owner){setConnection(false,'Owner login required');return;}
    token=String(owner.token||sessionToken());
    if(!token){setConnection(false,'Owner session not found');return;}
    await loadStatus();
    $('cmRefresh').addEventListener('click',loadStatus);
    $('cmPurgeSite').addEventListener('click',function(){purge('site','Storefront cache',{action:'site'});});
    $('cmPurgeUrls').addEventListener('click',function(){
      var urls=lines('cmUrls');if(!urls.length||urls.length>30){setNotice('Check the URL list','Add between 1 and 30 HTTPS storefront URLs.',true);return;}
      purge('urls','Selected URL cache',{action:'urls',urls:urls});
    });
    $('cmPurgePrefixes').addEventListener('click',function(){
      var prefixes=lines('cmPrefixes');if(!prefixes.length||prefixes.length>10){setNotice('Check the prefix list','Add between 1 and 10 storefront prefixes.',true);return;}
      purge('prefixes','Selected prefix cache',{action:'prefixes',prefixes:prefixes});
    });
  }
  document.addEventListener('DOMContentLoaded',init);
})();