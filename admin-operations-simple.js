(function(){'use strict';
function setup(){
 var main=document.querySelector('main');if(!main||document.getElementById('opsWorkspaceNav'))return;
 var summary=document.getElementById('opsSummary'),finance=document.getElementById('opsFinanceOrder'),returns=document.getElementById('opsReturns'),health=document.getElementById('opsHealth');
 if(!summary||!finance||!returns||!health)return;
 function section(el){return el.closest('section');}
 var panels=[section(summary),section(finance),section(returns),section(health)];
 if(panels.some(function(p){return !p;}))return;
 var names=['ওভারভিউ','অর্ডার হিসাব','রিটার্ন ও এক্সচেঞ্জ','সিস্টেমের অবস্থা'];
 var intro=document.createElement('div');intro.className='ops-workspace-intro';intro.textContent='প্রথমে সারসংক্ষেপ দেখুন। অর্ডারের হিসাব বা রিটার্ন করতে উপরের বিভাগ নির্বাচন করুন। অসম্পূর্ণ তথ্য দিয়ে চূড়ান্ত লাভ দেখানো হবে না।';
 var nav=document.createElement('div');nav.id='opsWorkspaceNav';nav.className='ops-workspace-nav';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','হিসাব ব্যবস্থাপনা');
 panels.forEach(function(p,i){p.classList.add('ops-workspace-panel');p.id='opsWorkspacePanel'+i;p.setAttribute('role','tabpanel');var b=document.createElement('button');b.type='button';b.id='opsWorkspaceTab'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls',p.id);b.textContent=names[i];b.addEventListener('click',function(){activate(i);});nav.appendChild(b);});
 function activate(index){panels.forEach(function(p,i){p.hidden=i!==index;var b=nav.children[i];b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});}
 var first=panels[0];first.parentNode.insertBefore(nav,first);first.parentNode.insertBefore(intro,first);activate(0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();